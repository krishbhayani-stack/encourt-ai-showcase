// matchmaker/analyze.js — READ-ONLY landscape report (does NOT take the daemon lock, safe to run
// alongside the daemon). Shows upcoming under-filled matches for today+tomorrow, the qualifying
// ±30/strict merges, AND the "near-misses" (would merge if the window/level were a touch looser)
// so you can see the real opportunity and tune the rules.
import { loadEnv } from './lib/env.js';
import { Store } from './lib/tokenstore.js';
import { PlaytomicClient } from './lib/playtomic.js';
import { findMerges, fillOf, isUnderFilled, toEpochMin } from './lib/scorer.js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DIR = dirname(fileURLToPath(import.meta.url));
const env = loadEnv(join(DIR, '.env'));
const client = new PlaytomicClient({ store: new Store(DIR), env, log: () => {} });
const LEAD = 15;
const fmt = iso => new Intl.DateTimeFormat('en-GB', { weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Europe/London' }).format(new Date(iso.endsWith('Z') ? iso : iso + 'Z'));
const dateStr = off => new Date(Date.now() + off * 86400000).toISOString().slice(0, 10);
const lvlOverlap = (a, b) => a.min_level <= b.max_level && b.min_level <= a.max_level;

for (const off of [0, 1]) {
  const d = dateStr(off);
  let matches; try { matches = await client.fetchOpenMatches(d); } catch (e) { console.log(`${d}: ${e.message}`); continue; }
  const cutoff = Math.floor(Date.now() / 60000) + LEAD;
  const live = matches.filter(m => toEpochMin(m.start_date) >= cutoff);
  const under = live.filter(isUnderFilled).sort((a, b) => toEpochMin(a.start_date) - toEpochMin(b.start_date));
  const props = findMerges(live);
  console.log(`\n━━ ${d} ━━  ${matches.length} open · ${live.length} still upcoming · ${under.length} upcoming under-filled · ${props.length} QUALIFYING merge(s)`);
  for (const m of under) { const f = fillOf(m); console.log(`   ${fmt(m.start_date).padEnd(13)} ${String(m.min_level)}-${m.max_level}  ${f.filled}/${f.capacity}  ${m.court || '(no court)'}`); }
  // near-misses: pairs within 60 min with level overlap that AREN'T already a qualifying merge
  const near = [];
  for (let i = 0; i < under.length; i++) for (let j = i + 1; j < under.length; j++) {
    const a = under[i], b = under[j]; const gap = Math.abs(toEpochMin(a.start_date) - toEpochMin(b.start_date));
    if (gap > 0 && gap <= 60 && lvlOverlap(a, b)) near.push(`${fmt(a.start_date)} (${a.min_level}-${a.max_level}) ↔ ${fmt(b.start_date)} (${b.min_level}-${b.max_level}) — ${gap}min apart`);
  }
  if (props.length === 0 && near.length) { console.log('   near-misses (would merge with a looser window/level):'); near.forEach(n => console.log('     ~ ' + n)); }
}
console.log('\n(read-only — nothing sent, daemon untouched)');
