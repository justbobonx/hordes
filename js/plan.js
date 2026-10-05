/** Wave spec and the one-card offer. Path comes later. */

function Plan() {}

Plan.blank = function () {
  return { wave: 1, size: 6, stamps: ["3"], cities: 2 };
};

Plan.copy = function (plan) {
  if (!plan) return Plan.blank();
  const stamps = [];
  const src = Array.isArray(plan.stamps) ? plan.stamps : [];
  for (let i = 0; i < src.length; i++) {
    if (src[i] === "3" || src[i] === "5" || src[i] === "col") stamps.push(src[i]);
  }
  if (!stamps.length) stamps.push("3");
  let size = plan.size | 0;
  if (size < 5) size = 5;
  if (size > 12) size = 12;
  let cities = plan.cities | 0;
  if (cities < 0) cities = 0;
  return {
    wave: plan.wave | 0 || 1,
    size: size,
    stamps: stamps,
    cities: cities,
  };
};

Plan.forWave = function (wave) {
  const w = wave > 0 ? wave : 1;
  if (w === 1) return Plan.copy({ wave: 1, size: 6, stamps: ["3"], cities: 2 });
  if (w === 2) return Plan.copy({ wave: 2, size: 6, stamps: ["3", "3"], cities: 3 });
  if (w === 3) return Plan.copy({ wave: 3, size: 7, stamps: ["5"], cities: 2 });
  if (w === 4) return Plan.copy({ wave: 4, size: 7, stamps: ["3", "5"], cities: 3 });
  if (w === 5) return Plan.copy({ wave: 5, size: 7, stamps: ["3", "col"], cities: 3 });
  if (w === 6) return Plan.copy({ wave: 6, size: 8, stamps: ["3", "3", "5"], cities: 4 });
  if (w === 7) return Plan.copy({ wave: 7, size: 8, stamps: ["5", "col"], cities: 4 });
  if (w === 8) return Plan.copy({ wave: 8, size: 8, stamps: ["3", "5", "col"], cities: 5 });
  const size = w < 12 ? 9 : 10;
  const stamps = ["3", "3", "5"];
  if (w % 2 === 0) stamps.push("col");
  if (w > 12) stamps.push("5");
  return Plan.copy({ wave: w, size: size, stamps: stamps, cities: 4 + ((w / 3) | 0) });
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

Plan.offer = function (wave) {
  return [{ plan: Plan.forWave(wave), locked: false }];
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
  const size = parseInt(parts[0], 10);
  if (!size) return null;
  const stamps = parts[1] ? parts[1].split("+") : ["3"];
  const cities = parts.length > 2 ? parseInt(parts[2], 10) : 2;
  return Plan.copy({ wave: 0, size: size, stamps: stamps, cities: cities });
};
