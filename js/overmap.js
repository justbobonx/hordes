/** Overmap logic: axial hex country, stages, spread, cooling. No DOM. */

const AXIAL_NEIGHBORS = [
  [1, 0], [1, -1], [0, -1],
  [-1, 0], [-1, 1], [0, 1]
];

const STAGE_CLEAR = 0;
const STAGE_YELLOW = 1;
const STAGE_RED_OUTLINE = 2;
const STAGE_INFECTED = 3;

const SPREAD_PROBS = [0, 0.05, 0.10, 0.40, 0.70, 0.90, 1.00];

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

Overmap.generate = function (seed, targetCount, startWave) {
  targetCount = targetCount || 33;
  startWave = startWave || 7;
  const rng = mulberry32(seed || Date.now());
  const hexes = {};

  // Organic blob
  const center = { q: 0, r: 0 };
  const queue = [center];
  const seen = {};
  seen[Overmap.key(0, 0)] = true;
  let added = 0;
  while (added < targetCount && queue.length) {
    queue.sort(function (a, b) {
      const na = Overmap.neighbors(a.q, a.r).filter(function (n) {
        return seen[Overmap.key(n.q, n.r)];
      }).length;
      const nb = Overmap.neighbors(b.q, b.r).filter(function (n) {
        return seen[Overmap.key(n.q, n.r)];
      }).length;
      return nb - na + (rng() - 0.5) * 0.3;
    });
    const cur = queue.shift();
    const k = Overmap.key(cur.q, cur.r);
    if (hexes[k]) continue;
    hexes[k] = { q: cur.q, r: cur.r, stage: STAGE_CLEAR, plan: null, wave: 0 };
    added++;
    const neigh = Overmap.neighbors(cur.q, cur.r);
    for (let i = neigh.length - 1; i > 0; i--) {
      const j = (rng() * (i + 1)) | 0;
      const tmp = neigh[i];
      neigh[i] = neigh[j];
      neigh[j] = tmp;
    }
    for (let i = 0; i < neigh.length; i++) {
      const nk = Overmap.key(neigh[i].q, neigh[i].r);
      if (!seen[nk]) {
        seen[nk] = true;
        queue.push(neigh[i]);
      }
    }
  }

  const keys = Object.keys(hexes);
  // Pick 3 clear cores that are ~2 apart
  const cores = [];
  for (let attempt = 0; attempt < 100 && cores.length < 3; attempt++) {
    const k = keys[(rng() * keys.length) | 0];
    const h = hexes[k];
    let ok = true;
    for (let i = 0; i < cores.length; i++) {
      if (Overmap.dist(h, hexes[cores[i]]) < 2) ok = false;
    }
    if (ok) cores.push(k);
  }
  // Seed 7 infected around the cores (prefer neighbors of cores, not the cores themselves)
  const infectedSet = {};
  const candidates = [];
  for (let c = 0; c < cores.length; c++) {
    const core = hexes[cores[c]];
    const neigh = Overmap.neighbors(core.q, core.r);
    for (let i = 0; i < neigh.length; i++) {
      const nk = Overmap.key(neigh[i].q, neigh[i].r);
      if (hexes[nk] && cores.indexOf(nk) < 0) candidates.push(nk);
    }
  }
  // Unique candidates
  const uniq = [];
  const seenC = {};
  for (let i = 0; i < candidates.length; i++) {
    if (!seenC[candidates[i]]) {
      seenC[candidates[i]] = true;
      uniq.push(candidates[i]);
    }
  }
  // Shuffle and take up to 7
  for (let i = uniq.length - 1; i > 0; i--) {
    const j = (rng() * (i + 1)) | 0;
    const tmp = uniq[i];
    uniq[i] = uniq[j];
    uniq[j] = tmp;
  }
  const toInfect = uniq.slice(0, 7);
  // If short, add more from remaining
  if (toInfect.length < 7) {
    for (let i = 0; i < keys.length && toInfect.length < 7; i++) {
      if (cores.indexOf(keys[i]) < 0 && toInfect.indexOf(keys[i]) < 0) toInfect.push(keys[i]);
    }
  }

  let nextWave = startWave;
  for (let i = 0; i < toInfect.length; i++) {
    const h = hexes[toInfect[i]];
    h.stage = STAGE_INFECTED;
    h.wave = nextWave;
    const cards = Planner.offer(nextWave);
    h.plan = cards[0] ? Plan.copy(cards[0].plan) : Plan.blank();
    if (h.plan) h.plan.wave = nextWave;
    nextWave++;
  }

  const country = {
    seed: seed || Date.now(),
    time: 0,
    nextWave: nextWave,
    hexes: hexes,
    wins: 0,
    losses: 0,
    totalTime: 0,
    status: ""
  };

  // Advance until we have at least one stage-2 (red outline)
  let guard = 0;
  while (guard < 12) {
    let hasRedOutline = false;
    const ks = Object.keys(country.hexes);
    for (let i = 0; i < ks.length; i++) {
      if (country.hexes[ks[i]].stage === STAGE_RED_OUTLINE) hasRedOutline = true;
    }
    if (hasRedOutline) break;
    Overmap.advance(country);
    guard++;
  }
  country.time = 1;

  return country;
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
  const neigh = Overmap.neighbors(h.q, h.r);
  for (let i = 0; i < neigh.length; i++) {
    const nk = Overmap.key(neigh[i].q, neigh[i].r);
    const nh = country.hexes[nk];
    if (nh && (nh.stage === STAGE_YELLOW || nh.stage === STAGE_RED_OUTLINE)) {
      nh.stage = STAGE_CLEAR;
      nh.plan = null;
      nh.wave = 0;
    }
  }
  Overmap.cool(country);
};

Overmap.advance = function (country) {
  const keys = Object.keys(country.hexes);
  const toAdvance = [];
  for (let i = 0; i < keys.length; i++) {
    const h = country.hexes[keys[i]];
    if (h.stage >= STAGE_INFECTED) continue;
    const n = Overmap.infectedNeighborCount(country, keys[i]);
    if (n === 0) continue;
    const p = SPREAD_PROBS[Math.min(n, 6)];
    if (Math.random() < p) toAdvance.push(keys[i]);
  }
  for (let i = 0; i < toAdvance.length; i++) {
    const h = country.hexes[toAdvance[i]];
    h.stage += 1;
    if (h.stage === STAGE_INFECTED && !h.plan) {
      const wave = country.nextWave || 7;
      const cards = Planner.offer(wave);
      h.plan = cards[0] ? Plan.copy(cards[0].plan) : Plan.blank();
      if (h.plan) h.plan.wave = wave;
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
