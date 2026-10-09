/** One-card offer. Reads the stamp chart. Does not build a board. */

function Planner() {}

Planner.INTRO = {
  1: { cols: 6, rows: 6, stamps: ["33"], cities: 0, open: "inner" },
  2: { cols: 6, rows: 7, stamps: ["33"], cities: 1, open: "edge" },
  3: { cols: 7, rows: 7, stamps: ["33", "33"], cities: 1, open: "inner" },
  4: { cols: 7, rows: 8, stamps: ["33", "35"], cities: 2, open: "inner" },
  6: { cols: 8, rows: 8, stamps: ["33", "53"], cities: 2, open: "inner" },
  8: { cols: 8, rows: 9, stamps: ["33", "55"], cities: 2, open: "inner" },
  12: { cols: 9, rows: 10, stamps: ["33", "33", "51"], cities: 3, open: "inner" },
  13: { cols: 9, rows: 10, stamps: ["33", "35", "15"], cities: 3, open: "inner" },
};

Planner.offer = function (wave) {
  const w = wave > 0 ? wave : 1;
  const scripted = Planner.INTRO[w];
  if (scripted) {
    return [{ plan: Plan.copy({ wave: w, rows: scripted.rows, cols: scripted.cols, stamps: scripted.stamps, cities: scripted.cities, open: scripted.open }), locked: false }];
  }
  let cols = 6 + (((w - 1) / 3) | 0);
  if (cols > 13) cols = 13;
  let rows = cols + (((w - 1) / 6) | 0);
  if (rows > 16) rows = 16;
  let count = 1 + (((w - 1) / 4) | 0);
  if (count > 9) count = 9;
  const open = [];
  let total = 0;
  const ids = Object.keys(Grid.STAMP_DEFINITIONS);
  for (let i = 0; i < ids.length; i++) {
    const piece = Grid.STAMP_DEFINITIONS[ids[i]];
    if (piece.minlevel > w) continue;
    open.push(ids[i]);
    total += piece.p;
  }
  const stamps = [];
  for (let n = 0; n < count; n++) {
    let roll = Math.random() * total;
    let pick = open[open.length - 1];
    for (let i = 0; i < open.length; i++) {
      roll -= Grid.STAMP_DEFINITIONS[open[i]].p;
      if (roll < 0) {
        pick = open[i];
        break;
      }
    }
    stamps.push(pick);
  }
  let cities = w < 2 ? 0 : 1 + (((w - 2) / 3) | 0);
  if (cities > 8) cities = 8;
  return [{ plan: Plan.copy({ wave: w, rows: rows, cols: cols, stamps: stamps, cities: cities, open: "inner" }), locked: false }];
};
