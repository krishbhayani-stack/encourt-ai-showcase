// matchmaker/test/fixtures/cases.js
// Curated golden cases with known-correct expected outcomes. Schema matches the
// live Playtomic PENDING payload confirmed 10 Aug 2026 (min_level/max_level,
// teams[].players[].level, max_per_team). Levels/ids synthetic; no PII.

// helper to make a match tersely
const M = (id, start, min, max, playerLevels, court = null) => ({
  match_id: id, start_date: start, end_date: start,
  min_level: min, max_level: max, min_per_team: 2, max_per_team: 2, court,
  teams: [
    { players: playerLevels.slice(0, 2).map((lv, i) => ({ id: `${id}_p${i}`, level: lv, conf: 0.4 })) },
    { players: playerLevels.slice(2, 4).map((lv, i) => ({ id: `${id}_p${i + 2}`, level: lv, conf: 0.4 })) },
  ],
});

export const cases = {

  // 1) ORIGINATING SCREENSHOT: 15:00 (2 in, range 2.33-3.33), two 15:30 games (range fits).
  //    The 15:00 game needs 2; the 15:30 games supply strict-fit movers within 30 min.
  //    Expect: at least one proposal that fills the 15:00 target.
  origin: {
    matches: [
      M('A_1500', '2026-08-11T15:00:00', 2.33, 3.33, [3.0, 2.58]),          // 2 in, needs 2
      M('B_1530', '2026-08-11T15:30:00', 2.75, 3.75, [3.0]),               // 1 in (solo)
      M('C_1530', '2026-08-11T15:30:00', 3.05, 4.05, [3.3, 3.3]),          // 2 in
    ],
    expect: (props) => {
      const p = props.find(x => x.target.match_id === 'A_1500');
      return p && p.fillsTarget && p.playersMoved === 2
        && p.movers.every(m => m.level >= 2.33 && m.level <= 3.33);
    },
  },

  // 2) LEVEL OUT OF RANGE: mover is 3.8, target range 2.33-3.33 -> excluded, no fill possible.
  levelExcluded: {
    matches: [
      M('T', '2026-08-11T18:00:00', 2.33, 3.33, [3.0, 3.1]),   // needs 2
      M('S', '2026-08-11T18:20:00', 3.5, 4.5, [3.8, 3.9]),     // both too strong -> excluded
    ],
    expect: (props) => props.length === 0,
  },

  // 3) TIME WINDOW BOUNDARY: 30 min apart is IN, 31 min apart is OUT.
  timeIn: {
    matches: [
      M('T', '2026-08-11T19:00:00', 2.0, 3.0, [2.5, 2.5]),     // needs 2
      M('S', '2026-08-11T19:30:00', 2.0, 3.0, [2.4, 2.6]),     // exactly +30 min -> in
    ],
    expect: (props) => props.some(p => p.target.match_id === 'T' && p.fillsTarget),
  },
  timeOut: {
    matches: [
      M('T', '2026-08-11T19:00:00', 2.0, 3.0, [2.5, 2.5]),
      M('S', '2026-08-11T19:31:00', 2.0, 3.0, [2.4, 2.6]),     // +31 min -> out
    ],
    expect: (props) => props.length === 0,
  },

  // 4) ALREADY FULL match is neither target nor source; empty match is ignored.
  fullAndEmpty: {
    matches: [
      M('FULL', '2026-08-11T20:00:00', 2.0, 3.0, [2.1, 2.2, 2.3, 2.4]),  // 4/4 full
      M('EMPTY', '2026-08-11T20:00:00', 2.0, 3.0, []),                    // 0 players
      M('NEED', '2026-08-11T20:15:00', 2.0, 3.0, [2.5]),                  // 1 in, needs 3
    ],
    // NEED needs 3 movers but only source (FULL/EMPTY) can't supply -> no proposal
    expect: (props) => props.length === 0,
  },

  // 5) COURT-FREEING drain: target needs 2; a small 2-player source can be fully emptied,
  //    freeing its court. Expect the winning proposal to flag freesCourts.
  freesCourt: {
    matches: [
      M('T', '2026-08-11T21:00:00', 2.0, 3.5, [2.8, 2.9]),     // needs 2
      M('S2', '2026-08-11T21:20:00', 2.0, 3.5, [2.5, 2.6]),    // 2 in -> both move -> S2 emptied
    ],
    expect: (props) => {
      const p = props.find(x => x.target.match_id === 'T');
      return p && p.freesCourts.includes('S2') && p.playersMoved === 2;
    },
  },

  // 6) NO DOUBLE-BOOKING: one mover cannot be assigned to two different targets.
  noDoubleBook: {
    matches: [
      M('T1', '2026-08-11T09:00:00', 2.0, 3.0, [2.5, 2.5, 2.5]), // needs 1
      M('T2', '2026-08-11T09:10:00', 2.0, 3.0, [2.5, 2.5, 2.5]), // needs 1
      M('S', '2026-08-11T09:05:00', 2.0, 3.0, [2.5]),            // ONE solo mover
    ],
    // Only one target can be filled by the single mover; the mover appears once total.
    expect: (props) => {
      const used = props.flatMap(p => p.movers.map(m => m.id));
      const uniq = new Set(used);
      return used.length === uniq.size && props.filter(p => p.fillsTarget).length <= 1;
    },
  },
};
