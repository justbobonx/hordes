/** One-card offer. Reads the ramp. Does not build a board. */

function Planner() {}

const PLAN_RAMP = [
  { cols: 6, rows: 6, stamps: ["3"], cities: 2 },
  { cols: 6, rows: 7, stamps: ["3", "3"], seats: ["inner", "inner"], cities: 3 },
  { cols: 6, rows: 7, stamps: ["3", "3"], cities: 2 },
  { cols: 7, rows: 7, stamps: ["3", "3", "3"], cities: 3 },
  { cols: 9, rows: 9, stamps: ["5"], cities: 2 },
  { cols: 9, rows: 9, stamps: ["3", "5"], cities: 3 },
  { cols: 9, rows: 10, stamps: ["3", "3", "5"], cities: 4 },
  { cols: 9, rows: 10, stamps: ["3", "5"], cities: 4 },
  { cols: 8, rows: 9, stamps: ["3", "col"], cities: 3 },
  { cols: 10, rows: 10, stamps: ["3", "5"], cities: 4 },
  { cols: 10, rows: 11, stamps: ["5", "col"], cities: 4 },
  { cols: 10, rows: 12, stamps: ["5", "5"], cities: 5 },
  { cols: 10, rows: 12, stamps: ["3", "5", "col"], cities: 5 },
  { cols: 11, rows: 13, stamps: ["3", "3", "5", "col"], cities: 6 },
  { cols: 12, rows: 14, stamps: ["3", "5", "5", "col"], cities: 6 },
];

Planner.offer = function (wave) {
  const w = wave > 0 ? wave : 1;
  const row = PLAN_RAMP[w - 1] || PLAN_RAMP[PLAN_RAMP.length - 1];
  const stamps = row.stamps.slice();
  if (w > PLAN_RAMP.length && w % 2 === 0) stamps.push("3");
  const cities = w > PLAN_RAMP.length ? 7 + (((w - PLAN_RAMP.length) / 3) | 0) : row.cities;
  const seen = {};
  const prior = w - 1 < PLAN_RAMP.length ? w - 1 : PLAN_RAMP.length;
  for (let i = 0; i < prior; i++) {
    const prev = PLAN_RAMP[i].stamps;
    for (let k = 0; k < prev.length; k++) seen[prev[k]] = true;
  }
  const written = Array.isArray(row.seats) ? row.seats : [];
  const seats = [];
  let seated = false;
  for (let i = 0; i < stamps.length; i++) {
    const kind = stamps[i];
    const forced = written[i];
    if (forced === "inner" || forced === "edge" || forced === "clipped") {
      seats.push(forced);
      seated = true;
    } else if (!seen[kind] && kind !== "col") {
      seats.push("inner");
      seated = true;
    } else seats.push("");
    seen[kind] = true;
  }
  const spec = {
    wave: w,
    rows: row.rows,
    cols: row.cols,
    stamps: stamps,
    cities: cities,
  };
  if (seated) spec.seats = seats;
  return [{ plan: Plan.copy(spec), locked: false }];
};
