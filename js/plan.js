/** Wave spec. Copies, reads, query parse. Does not offer a card. */

function Plan() {}

Plan.blank = function () {
  return { wave: 1, rows: 6, cols: 6, stamps: ["3"], cities: 2 };
};

Plan.copy = function (plan) {
  if (!plan) return Plan.blank();
  const stamps = [];
  const src = Array.isArray(plan.stamps) ? plan.stamps : [];
  for (let i = 0; i < src.length; i++) {
    if (src[i] === "3" || src[i] === "5" || src[i] === "col") stamps.push(src[i]);
  }
  if (!stamps.length) stamps.push("3");
  let rows = plan.rows | 0;
  let cols = plan.cols | 0;
  if (!rows && plan.size) rows = plan.size | 0;
  if (!cols && plan.size) cols = plan.size | 0;
  if (rows < 5) rows = 5;
  if (cols < 5) cols = 5;
  if (rows > 14) rows = 14;
  if (cols > 12) cols = 12;
  let cities = plan.cities | 0;
  if (cities < 0) cities = 0;
  const seats = [];
  const seatSrc = Array.isArray(plan.seats) ? plan.seats : [];
  let seated = false;
  for (let i = 0; i < stamps.length; i++) {
    const seat = seatSrc[i];
    if (seat === "inner" || seat === "edge" || seat === "clipped") {
      seats.push(seat);
      seated = true;
    } else seats.push("");
  }
  const out = {
    wave: plan.wave | 0 || 1,
    rows: rows,
    cols: cols,
    stamps: stamps,
    cities: cities,
  };
  if (seated) out.seats = seats;
  return out;
};

Plan.has = function (plan, kind) {
  if (!plan || !plan.stamps) return false;
  for (let i = 0; i < plan.stamps.length; i++) {
    if (plan.stamps[i] === kind) return true;
  }
  return false;
};

Plan.label = function (kind) {
  if (kind === "5") return "5×5";
  if (kind === "col") return "COL";
  return "3×3";
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
  const stamps = parts[1] ? parts[1].split(/[+ ]+/) : ["3"];
  const cities = parts.length > 2 ? parseInt(parts[2], 10) : 2;
  return Plan.copy({ wave: 0, rows: rows, cols: cols, stamps: stamps, cities: cities });
};
