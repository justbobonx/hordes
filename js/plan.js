/** Wave spec. Copies, reads, query parse. Does not offer a card. */

function Plan() {}

Plan.blank = function () {
  return { wave: 1, stamps: ["33"], cities: 3, clip: 0 };
};

Plan.copy = function (plan) {
  if (!plan) return Plan.blank();
  const stamps = [];
  const src = Array.isArray(plan.stamps) ? plan.stamps : [];
  for (let i = 0; i < src.length; i++) {
    if (Grid.STAMP_DEFINITIONS[src[i]]) stamps.push(src[i]);
  }
  if (!stamps.length) stamps.push("33");
  let cities = plan.cities | 0;
  if (cities < 0) cities = 0;
  if (cities > 14) cities = 14;
  const wave = plan.wave | 0 || 1;
  const clip = plan.clip | 0;
  return {
    wave: wave,
    stamps: stamps,
    cities: cities,
    clip: clip > 2 ? 2 : clip,
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
  const stamps = parts[0] ? parts[0].split(/[+ ]+/) : ["33"];
  const cities = parts.length > 1 ? parseInt(parts[1], 10) : 3;
  const clip = parts.length > 2 ? parseInt(parts[2], 10) : 0;
  return Plan.copy({ wave: 0, stamps: stamps, cities: cities, clip: clip });
};
