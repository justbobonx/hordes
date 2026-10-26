/** One-card offer. Reads the stamp chart. Does not build a board. */

function Planner() {}

// piece count per tier: uniform roll from min to max
// Wave  | Nebrs | Pieces | Ave Size
// 1-8   |   0   |  3–4   |  3.5
// 9–12  |   1   |  3–5   |  4
// 13–17 |   2   |  4–6   |  5
// 18-23 |   3   |  5–7   |  6
// 24-30 |   4   |  5–8   |  6.5
// 31+   |   5   |  5–9   |  7
//       |   6   |  6–9   |  7.5
// Endless picks the tier by wave; campaign passes a hex's infected-neighbor count.
const PIECE_TIERS = [
  { min: 3, max: 4 },
  { min: 3, max: 5 },
  { min: 4, max: 6 },
  { min: 5, max: 7 },
  { min: 5, max: 8 },
  { min: 5, max: 9 },
  { min: 6, max: 9 },
];
// first wave of tiers 1..5
const TIER_WAVES = [9, 13, 18, 24, 31];

const EXTRAS = {
  fuel: { onPlan: 0.7, range: [0.2, 0.5] },  //.7 makes up for boards that roll no good fuel
  strength: { onPlan: 0.6 },
  // barrier
};

// Board area = stamp cells * uniform roll in [AREA_MULT_MIN, AREA_MULT_MAX].
const AREA_MULT_MIN = 1.5;
const AREA_MULT_MAX = 2.5;
// Portrait aspect rows/cols; 1 is square, top end is the tallest boards.
const ASPECT_MIN = 1;
const ASPECT_MAX = 1.5;

Planner.INTRO = {
  1: { cols: 6, rows: 6, stamps: ["33"], open: "inner", thin: 0 },
  2: { cols: 6, rows: 7, stamps: ["33"], open: "edge", thin: 0 },
  3: { cols: 7, rows: 7, stamps: ["33", "33"], open: "inner", centered: 0, flush:0, thin: 0 },
  4: { cols: 7, rows: 8, stamps: ["33", "35"], open: "clipped", centered: 0.5, flush:0, thin: 0 },
  5: { cols: 9, rows: 10, stamps: ["33", "35", "42"], open: "inner", centered: 0.5, flush:0.5, thin: 0 },
  6: { cols: 9, rows: 10, stamps: ["45", "51", "24"], open: "inner", centered: 0.3, flush:0.7, thin: .5 },
};

Planner.intro = function (step) {
  const scripted = Planner.INTRO[step];
  if (!scripted) return null;
  return Plan.copy({
    wave: step,
    fuelChance: 0,
    overlap: 0,
    stronger: 0,
    area: 1,
    ...scripted
  });
};

Planner.waveTier = function (wave) {
  let tier = 0;
  while (tier < TIER_WAVES.length && wave >= TIER_WAVES[tier]) tier++;
  return tier;
};

// tier picks the piece count (see PIECE_TIERS); wave is only the plan's label.
Planner.offer = function (tier, wave) {
  const w = wave > 0 ? wave : 1;
  const range = PIECE_TIERS[Math.max(0, Math.min(PIECE_TIERS.length - 1, tier | 0))];
  const count = range.min + ((Math.random() * (range.max - range.min + 1)) | 0);

  const pool = [];
  const ids = Object.keys(Grid.STAMP_DEFINITIONS);
  for (let i = 0; i < ids.length; i++) {
    const piece = Grid.STAMP_DEFINITIONS[ids[i]];
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
  if (Math.random() < EXTRAS.fuel.onPlan) {
    const lo = EXTRAS.fuel.range[0];
    const hi = EXTRAS.fuel.range[1];
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
  const mult = AREA_MULT_MIN + Math.random() * (AREA_MULT_MAX - AREA_MULT_MIN);
  let area = cells * mult;
  const a = Math.round(mult * 10);
  const minC = maxW + 2;
  const minR = maxH + 2;
  if (area < minC * minR) area = minC * minR;
  const aspect = ASPECT_MIN + Math.random() * (ASPECT_MAX - ASPECT_MIN);
  let cols = Math.round(Math.sqrt(area / aspect));
  if (cols < minC) cols = minC;
  let rows = Math.round(cols * aspect);
  if (rows < minR) rows = minR;
  while (rows * cols < area) {
    cols++;
    rows = Math.round(cols * aspect);
    if (rows < minR) rows = minR;
  }
  let overlap = 0;
  let stronger = 0;
  // stronger is now the relative excess above the overlap floor (0 = floors only, 1 = all overlaps).
  // overlap > 0 still produces a mandatory strong floor even when stronger = 0.
  if (Math.random() < EXTRAS.strength.onPlan) {
    overlap = Math.random();
    stronger = Math.random();
  }  
  return [{
    plan: Plan.copy({
      wave: w,
      rows: rows,
      cols: cols,
      stamps: stamps,
      open: "any",
      centered: Math.random(),
      flush: Math.random(),
      thin: Math.random(),
      area: a,
      fuelChance: fuelChance,
      overlap: overlap,
      stronger: stronger,
    }),
    locked: false,
  }];
};
