/** One-card offer. Reads the piece chart. Does not build a board. */

function Planner() {}

Planner.PIECES = [
  { id: "33", p: 30, minlevel: 1 },
  { id: "35", p: 20, minlevel: 4 },
  { id: "53", p: 20, minlevel: 4 },
  { id: "55", p: 10, minlevel: 8 },
  { id: "14", p: 10, minlevel: 12 },
  { id: "41", p: 10, minlevel: 12 },
];

Planner.INTRO = {
  1: { cols: 6, rows: 6, stamps: ["33"], cities: 0, open: "inner" },
  2: { cols: 6, rows: 7, stamps: ["33"], cities: 1, open: "edge" },
  3: { cols: 7, rows: 7, stamps: ["33", "33"], cities: 1, open: "inner" },
  4: { cols: 7, rows: 8, stamps: ["33", "35"], cities: 2, open: "inner" },
  6: { cols: 8, rows: 8, stamps: ["33", "53"], cities: 2, open: "inner" },
  8: { cols: 8, rows: 9, stamps: ["33", "55"], cities: 2, open: "inner" },
  12: { cols: 9, rows: 10, stamps: ["33", "33", "14"], cities: 3, open: "inner" },
  13: { cols: 9, rows: 10, stamps: ["33", "35", "41"], cities: 3, open: "inner" },
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
  for (let i = 0; i < Planner.PIECES.length; i++) {
    const piece = Planner.PIECES[i];
    if (piece.minlevel > w) continue;
    open.push(piece);
    total += piece.p;
  }
  const stamps = [];
  for (let n = 0; n < count; n++) {
    let roll = Math.random() * total;
    let pick = open[open.length - 1].id;
    for (let i = 0; i < open.length; i++) {
      roll -= open[i].p;
      if (roll < 0) {
        pick = open[i].id;
        break;
      }
    }
    stamps.push(pick);
  }
  let cities = w < 2 ? 0 : 1 + (((w - 2) / 3) | 0);
  if (cities > 8) cities = 8;
  return [{ plan: Plan.copy({ wave: w, rows: rows, cols: cols, stamps: stamps, cities: cities, open: "inner" }), locked: false }];
};
