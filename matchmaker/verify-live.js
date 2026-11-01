// matchmaker/verify-live.js — end-to-end live check (READ-ONLY, sends NOTHING).
// Uses the real client: headless manager login -> fetch open matches -> scorer -> draft messages.
// Prints real merge proposals for today + tomorrow so we can see the pipeline work on live data.
import { loadEnv } from './lib/env.js';
import { Store } from './lib/tokenstore.js';
import { PlaytomicClient } from './lib/playtomic.js';
import { hasContactPII } from './lib/authcore.js';
import { findMerges, fillOf, isUnderFilled, toEpochMin } from './lib/scorer.js';
import { messagesForProposal } from './lib/messages.js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DIR = dirname(fileURLToPath(import.meta.url));
const env = loadEnv(join(DIR, '.env'));
const store = new Store(DIR);
const client = new PlaytomicClient({ store, env, log: (...a) => {} });

const dateStr = (offsetDays) => new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);

async function main() {
  console.log('▸ Matchmaker LIVE verify (read-only — nothing is sent)\n');
  let release;
  try { release = store.acquireLock(); } catch (e) { console.error('✗ another instance holds the lock:', e.message); process.exit(1); }
  try {
    for (const off of [0, 1]) {
      const d = dateStr(off);
      let matches;
      try { matches = await client.fetchOpenMatches(d); }
      catch (e) { console.log(`${d}: ✗ ${e.message}`); continue; }
      const pii = hasContactPII(matches);
      const props = findMerges(matches);
      const under = matches.filter(isUnderFilled);
      console.log(`━━ ${d} ━━  ${matches.length} open matches  ·  ${under.length} under-filled  ·  manager-scope(PII)=${pii}  ·  ${props.length} merge proposal(s)`);
      // landscape: show the under-filled matches (the raw near-miss candidates)
      for (const m of under.sort((a, b) => toEpochMin(a.start_date) - toEpochMin(b.start_date))) {
        const f = fillOf(m);
        console.log(`     ${fmt(m.start_date)}  ${String(m.min_level).padStart(4)}-${String(m.max_level).padEnd(4)}  ${f.filled}/${f.capacity}  ${m.court || '(no court)'}`);
      }
      const byId = Object.fromEntries(matches.map(m => [m.match_id, m]));
      const nameById = {}; for (const m of matches) for (const t of m.teams) for (const p of t.players) nameById[p.id] = p.name;
      for (const p of props) {
        const need = p.target.capacity - p.target.filledBefore;
        console.log(`\n  ▸ Fill the ${fmt(byId[p.target.match_id].start_date)} game (${p.target.min_level}-${p.target.max_level}, ${p.target.court || 'no court'}): move ${p.playersMoved}, frees ${p.freesCourts.length} court(s)`);
        for (const msg of messagesForProposal(p, byId, nameById)) console.log(`    [post to ${fmt(byId[msg.toMatchId].start_date)} thread] ${msg.text}`);
      }
      console.log('');
    }
    console.log('✓ Live pipeline works: manager login → open matches → scorer → drafted messages. NONE sent.');
  } finally { if (release) release(); }
}
function fmt(iso) { return new Intl.DateTimeFormat('en-GB', { weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Europe/London' }).format(new Date(iso.endsWith('Z') ? iso : iso + 'Z')); }
main().catch(e => { console.error('✗ verify error:', e.message); process.exit(3); });
