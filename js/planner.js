/** One-card offer. Reads the stamp chart. Does not build a board. */

function Planner() {}

const EXTRAS_UNLOCK = {
  fuel: { minlevel: 10, onPlan: 0.6, range: [0.2, 0.6] },
  strength: { minlevel: 10, onPlan: 0.6 },
  // barrier
};

Planner.INTRO = {
  1: { cols: 6, rows: 6, stamps: ["33"], open: "inner", thin: 0 },
  2: { cols: 6, rows: 7, stamps: ["33"], open: "edge", thin: 0 },
  3: { cols: 7, rows: 7, stamps: ["33", "33"], open: "inner", centered: 0, tight:0, thin: 0 },
  4: { cols: 7, rows: 8, stamps: ["33", "35"], open: "clipped", centered: 0.5, tight:0, thin: 0 },
  5: { cols: 9, rows: 10, stamps: ["33", "35", "42"], open: "inner", centered: 0.5, tight:0.5, thin: 0 },
  6: { cols: 9, rows: 10, stamps: ["45", "51", "24"], open: "inner", centered: 0.3, tight:0.7, thin: .5 },
};

Planner.offer = function (wave) {
  const w = wave > 0 ? wave : 1;
  const scripted = Planner.INTRO[w];
  if (scripted) {
    return [{
      plan: Plan.copy({
        wave: w,
        fuelChance: 0,
        overlap: 0,
        stronger: 0,
        area: 1,        
        ...scripted
      }),
      locked: false
    }];
  }
  //piece count per wave size from calculated base plus rando range
  // 1-8   | 4 | 2–4 |
  // 9–12  | 5 | 3–5 |
  // 13–17 | 6 | 4–6 |
  // 18-23 | 7 | 5–7 |
  // 24-30 | 8 | 5–8 |
  // 31+   | 9 | 5–9 |
  let base = 4;
  let hold = 3;
  let at = 6;
  while (w >= at + hold && base < 9) {
    at += hold;
    base++;
    hold = base - 1;
  }
  let sub = base <= 7 ? 2 : base - 5;
  let count = base + (((Math.random() * (sub + 1)) | 0) - sub);
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

  let fuelChance = 0;
  if (w >= EXTRAS_UNLOCK.fuel.minlevel && Math.random() < EXTRAS_UNLOCK.fuel.onPlan) {
    const lo = EXTRAS_UNLOCK.fuel.range[0];
    const hi = EXTRAS_UNLOCK.fuel.range[1];
    fuelChance = lo + Math.random() * (hi - lo);
  }

  let cells = 0;
  let maxW = 1;
  let maxH = 1;
  for (let n = 0; n < stamps.length; n++) {
    const piece = Grid.STAMP_DEFINITIONS[stamps[n]];
    cells += piece.w * piece.h;
    if (piece.w > maxW) maxW = piece.w;
    if (piece.h > maxH) maxH = piece.h;
  }
  if (fuelChance > 0 && stamps.length > 0) {
    const expectedExtras = fuelChance / (1 - fuelChance);
    cells += stamps.length * expectedExtras * 9;
    if (3 > maxW) maxW = 3;
    if (3 > maxH) maxH = 3;
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
  let overlap = 0;
  let stronger = 0;
  // stronger is now the relative excess above the overlap floor (0 = floors only, 1 = all overlaps).
  // overlap > 0 still produces a mandatory strong floor even when stronger = 0.
  if ( w >= EXTRAS_UNLOCK.strength.minlevel && Math.random() < EXTRAS_UNLOCK.strength.onPlan) {
    overlap = Math.random();
    stronger = Math.random();
  }
  overlap = 1;
  stronger = 1;
  return [{
    plan: Plan.copy({
      wave: w,
      rows: rows,
      cols: cols,
      stamps: stamps,
      open: "any",
      centered: Math.random(),
      tight: Math.random(),
      thin: Math.random(),
      area: a,
      fuelChance: fuelChance,
      overlap: overlap,
      stronger: stronger,
    }),
    locked: false,
  }];
};
