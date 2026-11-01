// matchmaker/lib/scorer.js
// Deterministic near-miss match consolidator. NO AI, NO randomness, NO clock reads.
// Same input -> same output (constitution rule 3). Pure functions only.
//
// Input: an array of PENDING (open) match objects as returned by
//   GET /api/v1/matches?...&match_status=PENDING  (see brain/specs/open-match-consolidation.md)
// Each match: { match_id, start_date, end_date, min_level, max_level,
//               min_per_team, max_per_team, court, teams:[{players:[{id,level,conf}]}], ... }
//
// Output: findMerges() -> ranked list of merge proposals. A proposal says
//   "move these players from their (source) matches into this target match, and it fills."

const DEFAULTS = {
  windowMin: 30,        // ± minutes a player may be asked to move  (LOCKED rule)
  levelRule: 'strict',  // strict: target.min_level <= player.level <= target.max_level  (LOCKED)
};

// ---- pure helpers -------------------------------------------------------

// Parse an ISO timestamp to epoch minutes. We treat the API's naive ISO as a
// fixed instant; only DIFFERENCES between matches matter for the ±window, and
// those are timezone-invariant, so no BST conversion is needed here.
export function toEpochMin(iso) {
  const ms = Date.parse(iso.endsWith('Z') || /[+-]\d\d:\d\d$/.test(iso) ? iso : iso + 'Z');
  return Math.round(ms / 60000);
}

// Capacity = seats across all teams. filled = players currently registered.
export function fillOf(match) {
  const teams = match.teams || [];
  const capacity = teams.reduce((n, t) => n + (match.max_per_team || 2), 0)
    || (match.max_per_team || 2) * 2;
  const players = teams.flatMap(t => t.players || []);
  return { capacity, filled: players.length, needed: capacity - players.length, players };
}

// A match is a consolidation candidate if it is open but not empty:
// 0 < filled < capacity. Empty matches have nobody to move and nobody to attract.
export function isUnderFilled(match) {
  const { capacity, filled } = fillOf(match);
  return filled > 0 && filled < capacity;
}

// strict level fit: player's level sits inside the target's stated range.
export function levelFits(player, target, rule = 'strict') {
  if (player.level == null) return false;
  if (rule === 'strict') return player.level >= target.min_level && player.level <= target.max_level;
  throw new Error(`unknown levelRule: ${rule}`);
}

// ---- the scorer ---------------------------------------------------------

// findMerges(matches, opts) -> [proposal]
// proposal = {
//   target: {match_id, start_date, min_level, max_level, court, filledBefore, capacity},
//   movers: [{id, level, fromMatchId, fromStart}],
//   fillsTarget: bool,        // target reaches capacity after the moves
//   freesCourts: [matchId],   // source matches fully emptied by the moves (resellable slots)
//   playersMoved: int,
//   score: number             // higher = better; used for ranking
// }
export function findMerges(matches, opts = {}) {
  const { windowMin, levelRule } = { ...DEFAULTS, ...opts };

  // annotate + keep only under-filled matches, earliest first (deterministic order)
  const open = matches
    .filter(isUnderFilled)
    .map(m => ({ m, ...fillOf(m), startMin: toEpochMin(m.start_date) }))
    .sort((a, b) =>
      a.startMin - b.startMin ||
      a.needed - b.needed ||
      String(a.m.match_id).localeCompare(String(b.m.match_id)));

  const assigned = new Set();   // player ids already committed to a proposal this pass
  const role = new Map();       // match_id -> 'target' | 'source' (a match is one, never both)
  const proposals = [];

  // Prioritise targets: earliest start, then the ones closest to filling (fewest needed).
  for (const T of open) {
    const tNeed = T.needed;
    if (tNeed <= 0) continue;
    if (role.get(T.m.match_id) === 'source') continue;  // already donated players — can't also receive

    // candidate movers: players from OTHER under-filled matches, within ±window, strict-fit,
    // not already assigned, and NOT from a match we've already committed as a target
    // (don't cannibalise a game we just decided to fill). Each carries its source match.
    const candidates = [];
    for (const S of open) {
      if (S.m.match_id === T.m.match_id) continue;
      if (role.get(S.m.match_id) === 'target') continue;   // its players are staying put
      if (Math.abs(S.startMin - T.startMin) > windowMin) continue;
      for (const p of S.players) {
        if (p.id == null || assigned.has(p.id)) continue;
        if (!levelFits(p, T.m, levelRule)) continue;
        candidates.push({
          id: p.id, level: p.level, conf: p.conf ?? 0,
          fromMatchId: S.m.match_id, fromStart: S.m.start_date,
          fromStartMin: S.startMin, sourcePlayers: S.players.length,
        });
      }
    }
    if (candidates.length < tNeed) continue;  // can't fill this target — skip

    // Rank candidates: prefer moves that would EMPTY a small source match (frees a court),
    // then closest in time, then highest level confidence, then stable by id.
    // Count how many candidates each source contributes, so we can spot full drains.
    const bySource = new Map();
    for (const c of candidates) bySource.set(c.fromMatchId, (bySource.get(c.fromMatchId) || 0) + 1);
    candidates.sort((a, b) =>
      drainScore(a, bySource) - drainScore(b, bySource) ||       // smaller source first (easier to empty)
      Math.abs(a.fromStartMin - T.startMin) - Math.abs(b.fromStartMin - T.startMin) ||
      (b.conf - a.conf) ||
      String(a.id).localeCompare(String(b.id)));

    const movers = candidates.slice(0, tNeed);
    movers.forEach(c => assigned.add(c.id));
    role.set(T.m.match_id, 'target');   // this match now receives — lock it from donating

    // which source matches are fully emptied by these moves? mark every donor a source.
    const movedFrom = new Map();
    for (const c of movers) movedFrom.set(c.fromMatchId, (movedFrom.get(c.fromMatchId) || 0) + 1);
    const freesCourts = [];
    for (const [mid, n] of movedFrom) {
      role.set(mid, 'source');
      const src = open.find(o => o.m.match_id === mid);
      if (src && n >= src.filled) freesCourts.push(mid);
    }

    proposals.push({
      target: {
        match_id: T.m.match_id, start_date: T.m.start_date,
        min_level: T.m.min_level, max_level: T.m.max_level,
        court: T.m.court || null, filledBefore: T.filled, capacity: T.capacity,
      },
      movers: movers.map(c => ({ id: c.id, level: c.level, fromMatchId: c.fromMatchId, fromStart: c.fromStart })),
      fillsTarget: true,                 // we only slice exactly tNeed, so target always fills
      freesCourts,
      playersMoved: movers.length,
      score: scoreProposal(movers.length, freesCourts.length),
    });
  }

  return proposals.sort((a, b) =>
    b.score - a.score ||
    a.playersMoved - b.playersMoved ||
    String(a.target.match_id).localeCompare(String(b.target.match_id)));
}

// smaller source contribution => easier to fully drain => preferred (lower sorts first)
function drainScore(c, bySource) { return bySource.get(c.fromMatchId) || 99; }

// Ranking: freeing courts is worth a lot (resellable slot); moving fewer players is better.
function scoreProposal(playersMoved, courtsFreed) {
  return courtsFreed * 100 - playersMoved * 10;
}

export { DEFAULTS };
