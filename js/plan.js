/** Wave spec. Copies, reads, query parse. Does not offer a card. */

function Plan() {}

Plan.blank = function () {
  return { wave: 1, rows: 6, cols: 6, stamps: ["33"], fuelChance: 0 };
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
  let tight = plan.tight;
  if (tight === undefined || tight === null || tight === "") tight = TIGHT_DEFAULT;
  tight = +tight;
  if (tight !== tight) tight = TIGHT_DEFAULT;
  if (tight < 0) tight = 0;
  if (tight > 1) tight = 1;
  let thin = plan.thin;
  if (thin === undefined || thin === null || thin === "") thin = THIN_DEFAULT;
  thin = +thin;
  if (thin !== thin) thin = THIN_DEFAULT;
  if (thin < 0) thin = 0;
  if (thin > 1) thin = 1;
  let area = plan.area;
  if (area != null) {
    area = area | 0;
    if (area < 15) area = 15;
    if (area > 20) area = 20;
  }
  let fuelChance = plan.fuelChance;
  if (fuelChance == null || fuelChance !== fuelChance) fuelChance = 0;
  fuelChance = +fuelChance;
  if (fuelChance < 0) fuelChance = 0;
  if (fuelChance > 1) fuelChance = 1;
  const out = {
    wave: wave,
    rows: rows,
    cols: cols,
    stamps: stamps,
    open: openSeat,
    centered: centered,
    tight: tight,
    thin: thin,
    fuelChance: fuelChance,
  };
  if (area != null) out.area = area;
  return out;
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
