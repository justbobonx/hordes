/** One-card offer. Reads the stamp chart. Does not build a board. */

function Planner() {}

Planner.INTRO = {
  1: { cols: 6, rows: 6, stamps: ["33"], open: "inner", thin:0 },
  2: { cols: 6, rows: 7, stamps: ["33"], open: "clipped", thin:0 },
  3: { cols: 7, rows: 7, stamps: ["33", "33"], open: "edge", thin:0 },
  4: { cols: 7, rows: 8, stamps: ["33", "35"], open: "clipped", thin:0 },
  5: { cols: 9, rows: 10, stamps: ["33", "35", "42"], open: "inner", thin:0 },
};

Planner.offer = function (wave) {
  const w = wave > 0 ? wave : 1;
  const scripted = Planner.INTRO[w];
  if (scripted) {
    return [{ plan: Plan.copy({ wave: w, rows: scripted.rows, cols: scripted.cols, stamps: scripted.stamps, open: scripted.open, thin:scripted.thin }), locked: false }];
  }
  let base = 4;
  let hold = 3;
  let at = 6;
  while (w >= at + hold && base < 9) {
    at += hold;
    base++;
    hold = base - 1;
  }
  let count = base + ((Math.random() * 3) | 0) - 1;
  if (count < 1) count = 1;
  const pool = [];
  const ids = Object.keys(Grid.STAMP_DEFINITIONS);
  for (let i = 0; i < ids.length; i++) {
    const piece = Grid.STAMP_DEFINITIONS[ids[i]];
    if (piece.minlevel > w) continue;
    for (let k = 0; k < piece.p; k++) pool.push(ids[i]);
  }
  for (let i = pool.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }
  const stamps = [];
  for (let n = 0; n < count && pool.length; n++) stamps.push(pool[n]);
  let cells = 0;
  let maxW = 1;
  let maxH = 1;
  for (let n = 0; n < stamps.length; n++) {
    const piece = Grid.STAMP_DEFINITIONS[stamps[n]];
    cells += piece.w * piece.h;
    if (piece.w > maxW) maxW = piece.w;
    if (piece.h > maxH) maxH = piece.h;
  }
  const mult = 1.5 + Math.random() * 0.5;
  let area = cells * mult;
  const a = Math.round(mult * 10);
  const minC = maxW + 2;
  const minR = maxH + 2;
  if (area < minC * minR) area = minC * minR;
  const delta = 1 + ((Math.random() * 3) | 0);
  let cols = Math.round((-delta + Math.sqrt(delta * delta + 4 * area)) / 2);
  if (cols < minC) cols = minC;
  let rows = cols + delta;
  if (rows < minR) rows = minR;
  while (rows * cols < area) {
    cols++;
    rows = cols + delta;
    if (rows < minR) rows = minR;
  }
  return [{
    plan: Plan.copy({
      wave: w,
      rows: rows,
      cols: cols,
      stamps: stamps,
      open: "any",
      // centered: (Math.random()+Math.random())/2,
      // tight: (Math.random()+Math.random())/2,
      // thin: (Math.random()+Math.random())/2,
      centered: Math.random(),
      tight: Math.random(),
      thin: Math.random(),
      area: a,
    }),
    locked: false,
  }];
};
