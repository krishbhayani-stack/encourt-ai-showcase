// matchmaker/test/daemon.test.js — poll-loop core (injected client + clock, no network).
import { mkdtempSync, existsSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../lib/tokenstore.js';
import { Ledger } from '../lib/ledger.js';
import { Daemon, inQuietHours } from '../lib/daemon.js';
import { proposalId } from '../lib/ledger.js';
import { cases } from './fixtures/cases.js';

let pass = 0, fail = 0;
const ok = (n, c, x = '') => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}  ${x}`); } };
const NOW = Date.parse('2026-08-11T10:00:00Z');   // 11:00 London — outside quiet hours

// mock client: date-keyed so repeated ticks re-see the same matches (real dedup test).
// NOW = 2026-08-11T10:00Z -> London date 2026-08-11 (offset 0), 2026-08-12 (offset 1).
function mockClient(byDate) {
  return { fetchOpenMatches: async (d) => byDate[d] ?? [] };
}
function freshDaemon(overrides = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'mmd-'));
  const store = new Store(dir);
  const ledger = new Ledger(join(dir, 'ledger.jsonl'));
  const rules = { windowMin: 30, levelRule: 'strict', pollIntervalSec: 600, pollJitterSec: 0, lookaheadDays: [0, 1], proposalCooldownHours: 6, maxProposalsPerPlayerPerDay: 1, quietHours: { start: '21:30', end: '08:30', tz: 'Europe/London' } };
  const client = overrides.client || mockClient({ '2026-08-11': cases.origin.matches });
  const d = new Daemon({ client, store, ledger, rules, dir, now: () => NOW, log: () => {} });
  return { d, store, ledger, dir };
}

// ---- quiet hours ----
console.log('daemon — quiet hours (Europe/London):');
ok('02:00 UTC (03:00 BST) is quiet', inQuietHours(Date.parse('2026-08-11T02:00:00Z'), { start: '21:30', end: '08:30' }) === true);
ok('10:00 UTC (11:00 BST) not quiet', inQuietHours(Date.parse('2026-08-11T10:00:00Z'), { start: '21:30', end: '08:30' }) === false);
ok('21:00 UTC (22:00 BST) is quiet', inQuietHours(Date.parse('2026-08-11T21:00:00Z'), { start: '21:30', end: '08:30' }) === true);

// ---- tick detects + queues, then dedups ----
console.log('\ndaemon — tick detect/queue/dedup:');
{
  const { d, ledger, dir } = freshDaemon();
  const r1 = await d.tick();
  ok('first tick finds the merge + queues 1', r1.found === 1 && r1.newlyQueued === 1, JSON.stringify(r1));
  ok('ledger has the proposal', ledger.all().filter(e => e.type === 'proposal').length === 1);
  ok('queue.json written for dashboard', existsSync(join(dir, 'queue.json')));
  const q = JSON.parse(readFileSync(join(dir, 'queue.json'), 'utf8'));
  ok('queue has 1 pending proposal with messages', q.pending.length === 1 && q.pending[0].messages.length >= 1);
  // second tick — same matches — must dedup (nothing new queued)
  const r2 = await d.tick();
  ok('second tick dedups (0 newly queued)', r2.found === 1 && r2.newlyQueued === 0, JSON.stringify(r2));
  ok('ledger still has just 1 proposal', ledger.all().filter(e => e.type === 'proposal').length === 1);
}

// ---- per-player daily cap ----
console.log('\ndaemon — per-player daily cap:');
{
  // two DIFFERENT proposals sharing a mover, both same day -> second capped
  const { d, ledger } = freshDaemon({ client: mockClient({ '2026-08-11': cases.origin.matches }) });
  await d.tick();  // queues the proposal (movers incl. a C_1530 + B_1530 player)
  const before = ledger.all().filter(e => e.type === 'proposal').length;
  // inject a fabricated different proposal reusing a mover, on the same day
  const mover = ledger.all().find(e => e.type === 'proposal').moverUserIds[0];
  ledger.append({ type: 'proposal', atMs: NOW, moverUserIds: [mover], proposalId: 'fake', targetMatchId: 'Z' });
  const cnt = ledger.playerProposalCount(mover, 24 * 3600 * 1000, NOW);
  ok('playerProposalCount counts distinct proposals for a mover', cnt === 2);
}

// ---- fail-closed: AUTH_DEAD + KILL ----
console.log('\ndaemon — fail-closed guards:');
{
  const { d, store } = freshDaemon();
  store.saveState({ authDead: true });
  const r = await d.tick();
  ok('AUTH_DEAD -> paused, no polling', r.paused === 'AUTH_DEAD');
}
{
  const { d, dir } = freshDaemon();
  writeFileSync(join(dir, 'KILL'), '1');
  const r = await d.tick();
  ok('KILL file -> paused', r.paused === 'KILL');
}

// ---- schema drift / scope downgrade surface as alerts (no queue) ----
console.log('\ndaemon — error handling:');
{
  const throwing = { fetchOpenMatches: async () => { const e = new Error('drift'); e.schemaDrift = true; throw e; } };
  const { d } = freshDaemon({ client: throwing });
  const r = await d.tick();
  ok('SCHEMA_DRIFT -> alert, not a crash', r.alert === 'SCHEMA_DRIFT');
}
{
  const throwing = { fetchOpenMatches: async () => { const e = new Error('scope'); e.scopeDowngrade = true; throw e; } };
  const { d } = freshDaemon({ client: throwing });
  const r = await d.tick();
  ok('SCOPE_DOWNGRADE -> alert', r.alert === 'SCOPE_DOWNGRADE');
}

// ---- proposalId is deterministic ----
console.log('\nledger — deterministic proposal id:');
{
  const a = proposalId({ targetMatchId: 'T', sourceMatchIds: ['B', 'A'], moverUserIds: [2, 1] });
  const b = proposalId({ targetMatchId: 'T', sourceMatchIds: ['A', 'B'], moverUserIds: [1, 2] });
  ok('order-independent + stable', a === b);
}

console.log(`\n${fail === 0 ? 'ALL PASS' : 'FAILURES'} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
