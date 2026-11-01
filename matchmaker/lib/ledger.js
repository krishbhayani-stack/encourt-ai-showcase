// matchmaker/lib/ledger.js
// Append-only JSONL ledger — the durable record that carries the never-double-send guarantee.
// In PILOT mode it records detected proposals (deduped) so the same near-miss isn't re-queued
// every poll; in the WRITER phase it gains write-ahead 'pending'->'confirmed' send entries.
// Atomic-ish: each append is a single write + fsync; a torn last line is tolerated on read.
import { openSync, writeSync, fsyncSync, closeSync, readFileSync, existsSync, chmodSync } from 'node:fs';
import { createHash } from 'node:crypto';

// Deterministic proposal id — pure hash of the merge's identity (no time/random), so the same
// near-miss maps to the same id across polls and restarts (dedup + future idempotent send).
export function proposalId({ targetMatchId, sourceMatchIds, moverUserIds }) {
  const canon = JSON.stringify({
    t: targetMatchId,
    s: [...sourceMatchIds].sort(),
    m: [...moverUserIds].map(String).sort(),
  });
  return createHash('sha1').update(canon).digest('hex').slice(0, 16);
}

export class Ledger {
  constructor(path) { this.path = path; }

  append(entry) {
    const line = JSON.stringify(entry) + '\n';
    const fd = openSync(this.path, 'a', 0o600);
    try { writeSync(fd, line); fsyncSync(fd); } finally { closeSync(fd); }
    try { chmodSync(this.path, 0o600); } catch {}
  }

  all() {
    if (!existsSync(this.path)) return [];
    const raw = readFileSync(this.path, 'utf8');
    const out = [];
    for (const line of raw.split('\n')) {
      const s = line.trim();
      if (!s) continue;
      try { out.push(JSON.parse(s)); } catch { /* torn/partial last line — ignore */ }
    }
    return out;
  }

  // Has this proposal been recorded within `windowMs` of `nowMs`? (dedup across polls)
  hasRecentProposal(pid, windowMs, nowMs) {
    for (const e of this.all()) {
      if (e.type === 'proposal' && e.proposalId === pid && typeof e.atMs === 'number' && nowMs - e.atMs <= windowMs) return true;
    }
    return false;
  }

  // How many distinct proposals has this player been asked to move in [nowMs-windowMs, now]?
  // (send-time per-player cap; also useful to avoid over-asking one person in pilot)
  playerProposalCount(userId, windowMs, nowMs) {
    const seen = new Set();
    for (const e of this.all()) {
      if (e.type !== 'proposal' || typeof e.atMs !== 'number' || nowMs - e.atMs > windowMs) continue;
      if ((e.moverUserIds || []).map(String).includes(String(userId))) seen.add(e.proposalId);
    }
    return seen.size;
  }

  // Current pending proposals (recorded within windowMs, not resolved) — feeds the dashboard queue.
  pending(windowMs, nowMs) {
    const resolved = new Set();
    const props = new Map();
    for (const e of this.all()) {
      if (e.type === 'proposal') { if (typeof e.atMs === 'number' && nowMs - e.atMs <= windowMs) props.set(e.proposalId, e); }
      else if (e.type === 'resolve' && e.proposalId) resolved.add(e.proposalId);
    }
    return [...props.values()].filter(p => !resolved.has(p.proposalId));
  }
}
