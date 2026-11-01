// matchmaker/lib/messages.js
// Renders the WARM CLUB VOICE pilot templates (locked, Krish 10 Aug 2026).
// One message per SOURCE match thread: it tells the players in an under-filled
// match about a fuller target match at their level they could hop to.
// Pure + deterministic. Times formatted in Europe/London (BST) for display.

const LONDON = 'Europe/London';

export function fmtTime(iso) {
  const d = new Date(iso.endsWith('Z') || /[+-]\d\d:\d\d$/.test(iso) ? iso : iso + 'Z');
  let s = new Intl.DateTimeFormat('en-GB', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: LONDON,
  }).format(d);                       // "3:30 pm"
  s = s.replace(' ', '').replace(':00', '');   // -> "3:30pm" / "3pm"
  return s;
}

// Build the messages a single proposal generates — one per distinct source match.
// Needs the original matches (for source fill/level) keyed by id, plus optional
// name lookup id->name for the solo template.
export function messagesForProposal(proposal, matchById, nameById = {}) {
  const t = proposal.target;
  const alt_time = fmtTime(t.start_date);
  const alt_needed = t.capacity - t.filledBefore;       // spots still open in the target
  const alt_filled = t.filledBefore;
  const min = t.min_level, max = t.max_level;

  // group movers by their source match
  const bySource = new Map();
  for (const mv of proposal.movers) {
    if (!bySource.has(mv.fromMatchId)) bySource.set(mv.fromMatchId, []);
    bySource.get(mv.fromMatchId).push(mv);
  }

  const out = [];
  for (const [sourceId, movers] of bySource) {
    const src = matchById[sourceId];
    const start_time = fmtTime(src ? src.start_date : movers[0].fromStart);
    const srcPlayers = src ? (src.teams || []).flatMap(x => x.players || []) : [];
    const needed = srcMatchNeeded(src);
    const solo = srcPlayers.length === 1;

    let text;
    if (solo) {
      const name = nameById[srcPlayers[0].id] || 'there';
      text = `Hi ${name} 👋 Encourt here. Your ${start_time} game hasn't filled — but there's a `
        + `${lvl(min)}–${lvl(max)} game at ${alt_time} with ${alt_filled} already in, so you'd `
        + `make up the group 🎾 Want me to switch you over? Just reply here.`;
    } else {
      text = `Hi 👋 Encourt here. Your ${start_time} game still needs ${needed} to go ahead. `
        + `There's a ${lvl(min)}–${lvl(max)} game at ${alt_time} today that just needs ${alt_needed} `
        + `more — hop over and you'll all get a proper game 🎾 Happy to switch you across? `
        + `Reply here and we'll sort it.`;
    }

    out.push({
      toMatchId: sourceId,            // post into THIS match's chat thread
      targetMatchId: t.match_id,
      movers: movers.map(m => m.id),
      text,
    });
  }
  return out;
}

function srcMatchNeeded(src) {
  if (!src) return 1;
  const players = (src.teams || []).flatMap(t => t.players || []);
  const cap = (src.teams || []).length * (src.max_per_team || 2) || (src.max_per_team || 2) * 2;
  return Math.max(1, cap - players.length);
}

// tidy level formatting: 3 -> "3", 3.3 -> "3.3", 2.33 -> "2.33"
function lvl(n) { return String(Number(n)); }
