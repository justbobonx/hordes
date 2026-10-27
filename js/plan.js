/** Wave spec. Copies, reads, query parse. Does not offer a card. */

// Fueled plans read bigger on the map. Their stamps scaled up by fuel chance span
// the FROM range (smallest stamps at lowest fuel to biggest growable stamps at
// highest fuel), which maps onto the TO range of displayed sizes.
const FUEL_SIZE_FROM_MIN = 3.6;
const FUEL_SIZE_FROM_MAX = 10.5;
const FUEL_SIZE_TO_MIN = 4;
const FUEL_SIZE_TO_MAX = 9;

function Plan() {}

Plan.blank = function () {
  return { wave: 1, rows: 6, cols: 6, stamps: ["33"], fuelChance: 0, overlap: 0, stronger: 0 };
};

Plan.copy = function (plan) {
  if (!plan) return Plan.blank();
  const stamps = [];
  const src = Array.isArray(plan.stamps) ? plan.stamps : [];
  for (let i = 0; i < src.length; i++) {
    if (Grid.STAMP_DEFINITIONS[src[i]]) stamps.push(src[i]);
  }
  if (!stamps.length) stamps.push("33");
  let rows = plan.rows | 0;
  let cols = plan.cols | 0;
  if (!rows && plan.size) rows = plan.size | 0;
  if (!cols && plan.size) cols = plan.size | 0;
  if (rows < 3) rows = 3;
  if (cols < 3) cols = 3;
  const wave = plan.wave | 0 || 1;
  let openSeat = plan.open;
  if (openSeat !== "edge" && openSeat !== "clipped" && openSeat !== "inner" && openSeat !== "any") openSeat = "any";
  let centered = plan.centered;
  if (centered === undefined || centered === null || centered === "") centered = CENTERED_DEFAULT;
  centered = +centered;
  if (centered !== centered) centered = CENTERED_DEFAULT;
  if (centered < 0) centered = 0;
  if (centered > 1) centered = 1;
  let flush = plan.flush;
  if (flush === undefined || flush === null || flush === "") flush = plan.tight;
  if (flush === undefined || flush === null || flush === "") flush = FLUSH_DEFAULT;
  flush = +flush;
  if (flush !== flush) flush = FLUSH_DEFAULT;
  if (flush < 0) flush = 0;
  if (flush > 1) flush = 1;
  let trim = plan.trim;
  if (trim === undefined || trim === null || trim === "") trim = TRIM_DEFAULT;
  trim = +trim;
  if (trim !== trim) trim = TRIM_DEFAULT;
  if (trim < 0) trim = 0;
  if (trim > 1) trim = 1;
  let area = plan.area;
  if (area != null) area = area | 0;
  let fuelChance = plan.fuelChance;
  if (fuelChance == null || fuelChance !== fuelChance) fuelChance = 0;
  fuelChance = +fuelChance;
  if (fuelChance < 0) fuelChance = 0;
  if (fuelChance > 1) fuelChance = 1;
  let overlap = plan.overlap;
  if (overlap == null || overlap !== overlap) overlap = 0;
  overlap = +overlap;
  if (overlap < 0) overlap = 0;
  if (overlap > 1) overlap = 1;
  let stronger = plan.stronger;
  if (stronger == null || stronger !== stronger) stronger = 0;
  stronger = +stronger;
  if (stronger < 0) stronger = 0;
  if (stronger > 1) stronger = 1;
  const out = {
    wave: wave,
    rows: rows,
    cols: cols,
    stamps: stamps,
    open: openSeat,
    centered: centered,
    flush: flush,
    trim: trim,
    fuelChance: fuelChance,
    overlap: overlap,
    stronger: stronger,
  };
  if (area != null) out.area = area;
  if (plan.seed != null) out.seed = plan.seed >>> 0;
  return out;
};

// Pieces the plan looks like on the map: its stamps, or for a fueled plan its
// fuel-scaled stamps mapped onto the display range and rounded to a whole piece.
Plan.fuelSizeAdjust = function (plan) {
  if (plan.fuelChance <= 0) return plan.stamps.length;
  const raw = plan.stamps.length * (1 + plan.fuelChance);
  return Math.round(FUEL_SIZE_TO_MIN + (raw - FUEL_SIZE_FROM_MIN) * (FUEL_SIZE_TO_MAX - FUEL_SIZE_TO_MIN) / (FUEL_SIZE_FROM_MAX - FUEL_SIZE_FROM_MIN));
};

Plan.label = function (kind) {
  const shape = Grid.STAMP_DEFINITIONS[kind];
  if (!shape) return kind || "";
  return shape.w + "\u00d7" + shape.h;
};

Plan.fromQuery = function (search) {
  let raw = "";
  try {
    raw = new URLSearchParams(search || "").get("plan") || "";
  } catch (err) {
    return null;
  }
  raw = raw.trim();
  if (!raw) return null;
  if (raw.charAt(0) === "{") {
    try {
      return Plan.copy(JSON.parse(raw));
    } catch (err) {
      return null;
    }
  }
  const parts = raw.split(",");
  const head = parts[0] || "";
  let rows = 0;
  let cols = 0;
  if (head.indexOf("x") >= 0) {
    const dims = head.split("x");
    cols = parseInt(dims[0], 10);
    rows = parseInt(dims[1], 10);
  } else {
    cols = parseInt(head, 10);
    rows = cols;
  }
  if (!cols || !rows) return null;
  const stamps = parts[1] ? parts[1].split(/[+ ]+/) : ["33"];
  return Plan.copy({ wave: 0, rows: rows, cols: cols, stamps: stamps });
};
