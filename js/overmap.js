/** Overmap logic: axial hex country, stages, spread, cooling. No DOM. */

const AXIAL_NEIGHBORS = [
  [1, 0], [1, -1], [0, -1],
  [-1, 0], [-1, 1], [0, 1]
];

const STAGE_CLEAR = 0;
const STAGE_YELLOW = 1;
const STAGE_RED_OUTLINE = 2;
const STAGE_INFECTED = 3;

const MIN_INFECTED_SEEDS = 6
const MIN_NON_CLEAR_SEEDS = 11;

const SPREAD_PROBS = [0, 0.05, 0.10, 0.40, 0.70, 0.90, 1.00];
const YELLOW_PLUS = 0.4;

function Overmap() {}

Overmap.key = function (q, r) {
  return q + "," + r;
};

Overmap.neighbors = function (q, r) {
  const out = [];
  for (let i = 0; i < AXIAL_NEIGHBORS.length; i++) {
    const d = AXIAL_NEIGHBORS[i];
    out.push({ q: q + d[0], r: r + d[1] });
  }
  return out;
};

Overmap.infectedNeighborCount = function (country, key) {
  const hex = country.hexes[key];
  if (!hex) return 0;
  let n = 0;
  const neigh = Overmap.neighbors(hex.q, hex.r);
  for (let i = 0; i < neigh.length; i++) {
    const nk = Overmap.key(neigh[i].q, neigh[i].r);
    const nh = country.hexes[nk];
    if (nh && nh.stage === STAGE_INFECTED) n++;
  }
  return n;
};

Overmap.dist = function (a, b) {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
};

Overmap.planSeed = function (countrySeed, q, r) {
  return (countrySeed ^ (q * 0x9e3779b1) ^ (r * 0x85ebca6b)) >>> 0;
};

Overmap.components = function (map) {
  const seen = {};
  const comps = [];
  const keys = Object.keys(map);
  for (let i = 0; i < keys.length; i++) {
    if (seen[keys[i]]) continue;
    const comp = [];
    const q = [map[keys[i]]];
    seen[keys[i]] = true;
    while (q.length) {
      const cur = q.shift();
      const k = Overmap.key(cur.q, cur.r);
      comp.push(k);
      const neigh = Overmap.neighbors(cur.q, cur.r);
      for (let j = 0; j < neigh.length; j++) {
        const nk = Overmap.key(neigh[j].q, neigh[j].r);
        if (map[nk] && !seen[nk]) {
          seen[nk] = true;
          q.push(map[nk]);
        }
      }
    }
    comps.push(comp);
  }
  return comps;
};

Overmap.generateShape = function (seed) {
  const radius = 7;
  const threshold = 0.45;
  const live = {};
  function noise(q, r) {
    let h = seed ^ (q * 0x9e3779b1) ^ (r * 0x85ebca6b);
    h = Math.imul(h ^ h >>> 15, 1 | h);
    h = Math.imul(h ^ h >>> 13, 61 | h);
    return ((h ^ h >>> 16) >>> 0) / 4294967296;
  }
  // Proper axial disk
  for (let q = -radius; q <= radius; q++) {
    const r1 = Math.max(-radius, -q - radius);
    const r2 = Math.min(radius, -q + radius);
    for (let r = r1; r <= r2; r++) {
      const n = noise(q, r);
      const d = Overmap.dist({q:0, r:0}, {q, r});
      const falloff = 1 - d / (radius + 1);
      if (n * (0.6 + 0.4 * falloff) > threshold) {
        live[Overmap.key(q, r)] = { q: q, r: r, stage: STAGE_CLEAR, plan: null, wave: 0 };
      }
    }
  }
  // CA smoothing (3 gens)
  for (let gen = 0; gen < 3; gen++) {
    const next = {};
    const candidates = {};
    const keys = Object.keys(live);
    for (let i = 0; i < keys.length; i++) {
      const h = live[keys[i]];
      candidates[keys[i]] = true;
      const neigh = Overmap.neighbors(h.q, h.r);
      for (let j = 0; j < neigh.length; j++) {
        const nk = Overmap.key(neigh[j].q, neigh[j].r);
        if (Overmap.dist({q:0,r:0}, neigh[j]) <= radius + 1)
          candidates[nk] = true;
      }
    }
    const ckeys = Object.keys(candidates);
    for (let i = 0; i < ckeys.length; i++) {
      const parts = ckeys[i].split(",");
      const q = +parts[0], r = +parts[1];
      const neigh = Overmap.neighbors(q, r);
      let count = 0;
      for (let j = 0; j < neigh.length; j++) {
        if (live[Overmap.key(neigh[j].q, neigh[j].r)]) count++;
      }
      const wasLive = !!live[ckeys[i]];
      if ((wasLive && count >= 2 && count <= 5) || (!wasLive && count >= 3 && count <= 4)) {
        next[ckeys[i]] = { q: q, r: r, stage: STAGE_CLEAR, plan: null, wave: 0 };
      }
    }
    for (const k in live) delete live[k];
    for (const k in next) live[k] = next[k];
  }
  // Drop small components
  const components = Overmap.components(live);
  for (let i = 0; i < components.length; i++) {
    if (components[i].length < 8) {
      for (let j = 0; j < components[i].length; j++) delete live[components[i][j]];
    }
  }
  // Trim peninsulas (≤1 neighbor)
  let trimmed = true;
  while (trimmed) {
    trimmed = false;
    const keys = Object.keys(live);
    for (let i = 0; i < keys.length; i++) {
      const h = live[keys[i]];
      const neigh = Overmap.neighbors(h.q, h.r);
      let c = 0;
      for (let j = 0; j < neigh.length; j++) {
        if (live[Overmap.key(neigh[j].q, neigh[j].r)]) c++;
      }
      if (c <= 1) {
        delete live[keys[i]];
        trimmed = true;
      }
    }
  }
  // Stricter 2nd pass: cut ≤2 hexes that are part of a thin chain
  let budget = 12;
  while (budget > 0) {
    let cut = false;
    const keys = Object.keys(live);
    for (let i = 0; i < keys.length && budget > 0; i++) {
      const h = live[keys[i]];
      const neigh = Overmap.neighbors(h.q, h.r);
      let c = 0;
      const lowNeigh = [];
      for (let j = 0; j < neigh.length; j++) {
        const nk = Overmap.key(neigh[j].q, neigh[j].r);
        if (live[nk]) {
          c++;
          const nn = Overmap.neighbors(neigh[j].q, neigh[j].r);
          let nc = 0;
          for (let k = 0; k < nn.length; k++) {
            if (live[Overmap.key(nn[k].q, nn[k].r)]) nc++;
          }
          if (nc <= 2) lowNeigh.push(true);
        }
      }
      if (c <= 2 && lowNeigh.length > 0) {
        delete live[keys[i]];
        budget--;
        cut = true;
      }
    }
    if (!cut) break;
  }
  // Lakes: keep largest enclosed component ≤3
  const exterior = {};
  const queue = [];
  for (let q = -radius - 1; q <= radius + 1; q++) {
    const r1 = Math.max(-radius - 1, -q - radius - 1);
    const r2 = Math.min(radius + 1, -q + radius + 1);
    for (let r = r1; r <= r2; r++) {
      const k = Overmap.key(q, r);
      if (live[k]) continue;
      if (Overmap.dist({q:0,r:0}, {q,r}) >= radius) {
        exterior[k] = true;
        queue.push({q, r});
      }
    }
  }
  while (queue.length) {
    const cur = queue.shift();
    const neigh = Overmap.neighbors(cur.q, cur.r);
    for (let j = 0; j < neigh.length; j++) {
      const nk = Overmap.key(neigh[j].q, neigh[j].r);
      if (!live[nk] && !exterior[nk] && Overmap.dist({q:0,r:0}, neigh[j]) <= radius + 1) {
        exterior[nk] = true;
        queue.push(neigh[j]);
      }
    }
  }
  const enclosed = {};
  for (let q = -radius; q <= radius; q++) {
    const r1 = Math.max(-radius, -q - radius);
    const r2 = Math.min(radius, -q + radius);
    for (let r = r1; r <= r2; r++) {
      const k = Overmap.key(q, r);
      if (!live[k] && !exterior[k]) enclosed[k] = {q, r};
    }
  }
  const lakeComps = Overmap.components(enclosed);
  let kept = null;
  let best = 0;
  for (let i = 0; i < lakeComps.length; i++) {
    const len = lakeComps[i].length;
    if (len <= 3 && len > best) {
      best = len;
      kept = lakeComps[i];
    }
  }
  for (let i = 0; i < lakeComps.length; i++) {
    if (lakeComps[i] === kept) continue;
    for (let j = 0; j < lakeComps[i].length; j++) {
      const k = lakeComps[i][j];
      const parts = k.split(",");
      live[k] = { q: +parts[0], r: +parts[1], stage: STAGE_CLEAR, plan: null, wave: 0 };
    }
  }
  return live;
};

Overmap.generate = function (seed, targetCount, startWave) {
  targetCount = targetCount || 33;
  startWave = startWave || 7;
  const MAX_LAND_TRIES = 10;
  const MAX_ADVANCE = 100;
  const MIN_SEED_DIST = 4;
  for (let landTry = 0; landTry < MAX_LAND_TRIES; landTry++) {
    const countrySeed = (seed || Date.now()) + landTry * 0x9e3779b1;
    const rng = mulberry32(countrySeed);
    const hexes = Overmap.generateShape(countrySeed);
    const keys = Object.keys(hexes);
    if (keys.length < 7) continue;
    const seeds = [];
    for (let attempt = 0; attempt < 120 && seeds.length < 3; attempt++) {
      const k = keys[(rng() * keys.length) | 0];
      const h = hexes[k];
      let ok = true;
      for (let i = 0; i < seeds.length; i++) {
        if (Overmap.dist(h, hexes[seeds[i]]) < MIN_SEED_DIST) ok = false;
      }
      if (ok) seeds.push(k);
    }
    for (let i = 0; i < keys.length && seeds.length < 3; i++) {
      if (seeds.indexOf(keys[i]) < 0) seeds.push(keys[i]);
    }
    let nextWave = startWave;
    for (let i = 0; i < seeds.length; i++) {
      const h = hexes[seeds[i]];
      h.stage = STAGE_INFECTED;
      h.wave = nextWave;
      const cards = Planner.offer(nextWave);
      h.plan = cards[0] ? Plan.copy(cards[0].plan) : Plan.blank();
      if (h.plan) {
        h.plan.wave = nextWave;
        h.plan.seed = Overmap.planSeed(countrySeed, h.q, h.r);
      }
      nextWave++;
    }
    const country = {
      seed: countrySeed,
      time: 0,
      nextWave: nextWave,
      hexes: hexes,
      wins: 0,
      losses: 0,
      totalTime: 0,
      status: ""
    };
    
    let advances = 0;
    while (advances < MAX_ADVANCE) {
      let infected = 0;
      let nonClear = 0;
      const ks = Object.keys(country.hexes);
      for (let i = 0; i < ks.length; i++) {
        const stage = country.hexes[ks[i]].stage;
        if (stage === STAGE_INFECTED) infected++;
        if (stage !== STAGE_CLEAR) nonClear++;
      }
      if (infected >= MIN_INFECTED_SEEDS && nonClear >= MIN_NON_CLEAR_SEEDS) {
        country.time = 1;
        return country;
      }
      Overmap.advance(country);
      advances++;
    }    
  }
  return null;
};

Overmap.cool = function (country) {
  const keys = Object.keys(country.hexes);
  for (let i = 0; i < keys.length; i++) {
    const h = country.hexes[keys[i]];
    if (h.stage === STAGE_YELLOW || h.stage === STAGE_RED_OUTLINE) {
      if (Overmap.infectedNeighborCount(country, keys[i]) === 0) {
        h.stage = STAGE_CLEAR;
        h.plan = null;
        h.wave = 0;
      }
    }
  }
};

Overmap.clearInfected = function (country, key) {
  const h = country.hexes[key];
  if (!h || h.stage !== STAGE_INFECTED) return;
  h.stage = STAGE_CLEAR;
  h.plan = null;
  h.wave = 0;   
};

Overmap.advance = function (country) {
  const keys = Object.keys(country.hexes);
  const toAdvance = [];
  for (let i = 0; i < keys.length; i++) {
    const h = country.hexes[keys[i]];
    if (h.stage >= STAGE_INFECTED) continue;
    const n = Overmap.infectedNeighborCount(country, keys[i]);

    let p;
    if (h.stage === STAGE_CLEAR) {
      p = SPREAD_PROBS[n];
    } else if (h.stage === STAGE_YELLOW) {
      p = Math.min(1, SPREAD_PROBS[Math.min(n, 6)] + YELLOW_PLUS);
    } else { // STAGE_RED_OUTLINE
      p = 1;
    }
    if (Math.random() < p) toAdvance.push(keys[i]);
  }
  for (let i = 0; i < toAdvance.length; i++) {
    const h = country.hexes[toAdvance[i]];
    h.stage += 1;
    if (h.stage === STAGE_INFECTED && !h.plan) {
      const wave = country.nextWave || 7;
      const cards = Planner.offer(wave);
      h.plan = cards[0] ? Plan.copy(cards[0].plan) : Plan.blank();
      if (h.plan) {
        h.plan.wave = wave;
        h.plan.seed = Overmap.planSeed(country.seed || 0, h.q, h.r);
      }
      h.wave = wave;
      country.nextWave = wave + 1;
    }
  }
};

Overmap.tick = function (country) {
  Overmap.cool(country);
  Overmap.advance(country);
  country.time = (country.time | 0) + 1;
};

Overmap.isWin = function (country) {
  const keys = Object.keys(country.hexes);
  for (let i = 0; i < keys.length; i++) {
    if (country.hexes[keys[i]].stage === STAGE_INFECTED) return false;
  }
  return keys.length > 0;
};

Overmap.isLoss = function (country) {
  const keys = Object.keys(country.hexes);
  for (let i = 0; i < keys.length; i++) {
    if (country.hexes[keys[i]].stage !== STAGE_INFECTED) return false;
  }
  return keys.length > 0;
};

Overmap.serialize = function (country) {
  return JSON.parse(JSON.stringify(country));
};

Overmap.deserialize = function (data) {
  return data || null;
};

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
