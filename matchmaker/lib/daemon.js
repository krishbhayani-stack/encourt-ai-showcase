// matchmaker/lib/daemon.js
// The 24/7 poll loop core. tick() = one cycle (testable with an injected client + clock).
// PILOT mode: detect near-miss merges, dedup, and QUEUE proposals for Krish's approval — NEVER
// sends (the Firebase writer stays disabled behind its gate). Fail-closed throughout.
import { existsSync, writeFileSync, chmodSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { findMerges, toEpochMin } from './scorer.js';
import { messagesForProposal } from './messages.js';
import { proposalId } from './ledger.js';

const KILL_FILE = 'KILL';
const QUEUE_FILE = 'queue.json';

// London-local time helpers (DST-aware) for quiet hours.
function londonHM(nowMs) {
  const p = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/London' })
    .formatToParts(new Date(nowMs));
  const h = +p.find(x => x.type === 'hour').value, m = +p.find(x => x.type === 'minute').value;
  return h * 60 + m;
}
function parseHM(s) { const [h, m] = String(s).split(':').map(Number); return h * 60 + m; }
export function inQuietHours(nowMs, quiet) {
  if (!quiet) return false;
  const now = londonHM(nowMs), a = parseHM(quiet.start), b = parseHM(quiet.end);
  return a <= b ? (now >= a && now < b) : (now >= a || now < b);   // wraps midnight
}

// playing date 'YYYY-MM-DD' for London, offset by whole days from now.
function londonDate(nowMs, offsetDays) {
  const d = new Date(nowMs + offsetDays * 86400000);
  const p = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Europe/London' }).formatToParts(d);
  return `${p.find(x => x.type === 'year').value}-${p.find(x => x.type === 'month').value}-${p.find(x => x.type === 'day').value}`;
}

export class Daemon {
  constructor({ client, store, ledger, rules, dir, now = () => Date.now(), log = () => {}, alert }) {
    this.client = client; this.store = store; this.ledger = ledger; this.rules = rules;
    this.dir = dir; this.now = now; this.log = log;
    this.alert = alert || ((kind, msg) => log(`ALERT[${kind}] ${msg}`));
    this._stop = false;
  }

  killEngaged() { return existsSync(join(this.dir, KILL_FILE)); }

  // ONE poll cycle. Returns a structured result; never throws for expected conditions.
  async tick() {
    const nowMs = this.now();
    const state = this.store.loadState();

    if (state.authDead) { this.alert('AUTH_DEAD', 'auth latched dead — not polling'); return { paused: 'AUTH_DEAD' }; }
    if (this.killEngaged()) { this.log('KILL engaged — paused'); return { paused: 'KILL' }; }

    const mode = state.mode;                       // 'PILOT' (default, fail-closed) | 'AUTO'
    const quiet = inQuietHours(nowMs, this.rules.quietHours);

    // 1) pull open matches for each look-ahead date + detect merges
    const found = [];
    const perDate = [];
    for (const off of this.rules.lookaheadDays) {
      const d = londonDate(nowMs, off);
      let matches;
      try { matches = await this.client.fetchOpenMatches(d); }
      catch (e) {
        if (e.authDead) { this.alert('AUTH_DEAD', e.message); return { paused: 'AUTH_DEAD' }; }
        if (e.schemaDrift) { this.alert('SCHEMA_DRIFT', e.message); this.store.saveState({ lastAlert: 'SCHEMA_DRIFT', lastAlertAt: nowMs }); return { alert: 'SCHEMA_DRIFT', date: d }; }
        if (e.scopeDowngrade) { this.alert('SCOPE_DOWNGRADE', e.message); this.store.saveState({ lastAlert: 'SCOPE_DOWNGRADE', lastAlertAt: nowMs }); return { alert: 'SCOPE_DOWNGRADE', date: d }; }
        this.log(`transient error on ${d}: ${e.message}`); perDate.push({ date: d, error: e.message }); continue;
      }
      // ACTIONABLE ONLY: drop matches that have already started (or start within the lead
      // buffer) — you can't fill a game there's no time left to ping people into.
      const leadMin = this.rules.minLeadMin ?? 15;
      const cutoffMin = Math.floor(nowMs / 60000) + leadMin;
      const live = matches.filter(m => toEpochMin(m.start_date) >= cutoffMin);
      const byId = Object.fromEntries(live.map(m => [m.match_id, m]));
      const nameById = {}; for (const m of live) for (const t of m.teams) for (const p of t.players) nameById[p.id] = p.name;
      const props = findMerges(live, { windowMin: this.rules.windowMin, levelRule: this.rules.levelRule });
      for (const p of props) found.push(this._enrich(p, byId, nameById));
      perDate.push({ date: d, matches: matches.length, upcoming: live.length, proposals: props.length });
    }

    // 2) dedup + queue (never send)
    const cooldownMs = this.rules.proposalCooldownHours * 3600 * 1000;
    const dayMs = 24 * 3600 * 1000;
    const newlyQueued = [];
    for (const p of found) {
      if (this.ledger.hasRecentProposal(p.proposalId, cooldownMs, nowMs)) continue;   // already queued recently
      // per-player-per-day cap (don't over-ask one person)
      const capped = p.moverUserIds.some(uid => this.ledger.playerProposalCount(uid, dayMs, nowMs) >= this.rules.maxProposalsPerPlayerPerDay);
      if (capped) { this.log(`skip ${p.proposalId} — a mover already at daily cap`); continue; }
      this.ledger.append({ type: 'proposal', atMs: nowMs, at: new Date(nowMs).toISOString(), mode, quietHold: quiet, ...p });
      newlyQueued.push(p);
    }

    // 3) heartbeat + dashboard queue snapshot
    this.store.saveState({ lastGoodPollAt: nowMs, lastTick: { at: new Date(nowMs).toISOString(), perDate, found: found.length, newlyQueued: newlyQueued.length, mode, quiet } });
    this._writeQueue(cooldownMs, nowMs);

    const summary = { mode, quiet, perDate, found: found.length, newlyQueued: newlyQueued.length };
    this.log(`tick: ${JSON.stringify(perDate)} · found ${found.length} · queued ${newlyQueued.length}${quiet ? ' · quiet-hours' : ''}`);
    return summary;
  }

  _enrich(p, byId, nameById) {
    const sourceMatchIds = [...new Set(p.movers.map(m => m.fromMatchId))];
    const moverUserIds = p.movers.map(m => m.id);
    const messages = messagesForProposal(p, byId, nameById);
    return {
      proposalId: proposalId({ targetMatchId: p.target.match_id, sourceMatchIds, moverUserIds }),
      targetMatchId: p.target.match_id, sourceMatchIds, moverUserIds,
      target: p.target, playersMoved: p.playersMoved, freesCourts: p.freesCourts,
      // include the SOURCE match start time so the dashboard labels the right thread
      messages: messages.map(m => ({ toMatchId: m.toMatchId, toStart: byId[m.toMatchId]?.start_date || null, text: m.text, movers: m.movers })),
    };
  }

  _writeQueue(cooldownMs, nowMs) {
    try {
      const pending = this.ledger.pending(cooldownMs, nowMs);
      const tmp = join(this.dir, QUEUE_FILE + '.tmp');
      writeFileSync(tmp, JSON.stringify({ at: new Date(nowMs).toISOString(), pending }, null, 1), { mode: 0o600 });
      chmodSync(tmp, 0o600);
      renameSync(tmp, join(this.dir, QUEUE_FILE));
    } catch (e) { this.log('queue write failed: ' + e.message); }
  }

  // main loop — jittered interval; graceful stop via stop().
  async run() {
    this.log(`daemon start (mode=${this.store.loadState().mode}, writer DISABLED)`);
    while (!this._stop) {
      try { await this.tick(); } catch (e) { this.alert('TICK_ERROR', e.message); }
      if (this._stop) break;
      const jitter = Math.floor((Math.random() - 0.5) * 2 * this.rules.pollJitterSec);
      const waitMs = Math.max(60, this.rules.pollIntervalSec + jitter) * 1000;
      await this._sleep(waitMs);
    }
    this.log('daemon stopped');
  }
  stop() { this._stop = true; if (this._timer) clearTimeout(this._timer); }
  _sleep(ms) { return new Promise(r => { this._timer = setTimeout(r, ms); }); }
}
