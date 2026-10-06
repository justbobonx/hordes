/** Wave spec. Copies, reads, query parse. Does not offer a card. */

function Plan() {}

Plan.blank = function () {
  return { wave: 1, rows: 6, cols: 6, stamps: ["33"], cities: 0 };
};

Plan.copy = function (plan) {
  if (!plan) return Plan.blank();
  const stamps = [];
  const src = Array.isArray(plan.stamps) ? plan.stamps : [];
  for (let i = 0; i < src.length; i++) {
    if (Grid.SHAPES[src[i]]) stamps.push(src[i]);
  }
  if (!stamps.length) stamps.push("33");
  let rows = plan.rows | 0;
  let cols = plan.cols | 0;
  if (!rows && plan.size) rows = plan.size | 0;
  if (!cols && plan.size) cols = plan.size | 0;
  if (rows < 5) rows = 5;
  if (cols < 5) cols = 5;
  if (rows > 16) rows = 16;
  if (cols > 13) cols = 13;
  let cities = plan.cities | 0;
  if (cities < 0) cities = 0;
  if (cities > 8) cities = 8;
  const wave = plan.wave | 0 || 1;
  const openSeat = plan.open === "edge" ? "edge" : "inner";
  return {
    wave: wave,
    rows: rows,
    cols: cols,
    stamps: stamps,
    cities: cities,
    open: openSeat,
  };
};

Plan.has = function (plan, kind) {
  if (!plan || !plan.stamps) return false;
  for (let i = 0; i < plan.stamps.length; i++) {
    if (plan.stamps[i] === kind) return true;
  }
  return false;
};

Plan.label = function (kind) {
  const shape = Grid.SHAPES[kind];
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
  const cities = parts.length > 2 ? parseInt(parts[2], 10) : 2;
  return Plan.copy({ wave: 0, rows: rows, cols: cols, stamps: stamps, cities: cities });
};
