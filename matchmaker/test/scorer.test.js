// matchmaker/test/scorer.test.js
// Plain-node golden tests (no framework). Run: npm test  (from matchmaker/).
// Exits non-zero if any case fails.

import { findMerges } from '../lib/scorer.js';
import { messagesForProposal, fmtTime } from '../lib/messages.js';
import { cases } from './fixtures/cases.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}  ${extra}`); }
};

console.log('scorer golden cases:');
for (const [name, c] of Object.entries(cases)) {
  const props = findMerges(c.matches);
  let result;
  try { result = c.expect(props); }
  catch (e) { result = false; }
  ok(name, result, `-> got ${JSON.stringify(props.map(p => ({t:p.target.match_id, moved:p.playersMoved, frees:p.freesCourts})))}`);
}

// message rendering on the originating case (warm voice, real wording)
console.log('\nmessage rendering:');
{
  const props = findMerges(cases.origin.matches);
  const byId = Object.fromEntries(cases.origin.matches.map(m => [m.match_id, m]));
  const top = props.find(p => p.target.match_id === 'A_1500');
  const msgs = messagesForProposal(top, byId, { 'B_1530_p0': 'Sam' });
  ok('produces >=1 message', msgs.length >= 1);
  ok('message names a concrete alt time', msgs.every(m => /\d(am|pm)/.test(m.text)));
  ok('message mentions the level range', msgs.every(m => m.text.includes('2.33')));
  ok('solo source uses the named solo template', msgs.some(m => m.text.startsWith('Hi Sam')));
  console.log('\n  --- sample messages ---');
  for (const m of msgs) console.log(`  [thread ${m.toMatchId}] ${m.text}\n`);
}

// time formatting sanity
console.log('time formatting:');
ok('15:30 -> 4:30pm BST', fmtTime('2026-08-11T15:30:00') === '4:30pm', `got ${fmtTime('2026-08-11T15:30:00')}`);
ok('15:00 -> 4pm BST',   fmtTime('2026-08-11T15:00:00') === '4pm',    `got ${fmtTime('2026-08-11T15:00:00')}`);

console.log(`\n${fail === 0 ? 'ALL PASS' : 'FAILURES'} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
