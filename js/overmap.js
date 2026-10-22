/** Overmap logic: axial hex country, stages, spread, cooling. No DOM. */

const AXIAL_NEIGHBORS = [
  [1, 0], [1, -1], [0, -1],
  [-1, 0], [-1, 1], [0, 1]
];

const STAGE_JUST_CLEARED = -3;
const STAGE_SAFER = -2;
const STAGE_SAFE = -1;
const STAGE_CLEAR = 0;
const STAGE_YELLOW = 1;
const STAGE_ORANGE = 2;
const STAGE_INFECTED = 3;

const MIN_INFECTED_SEEDS = 6
const MIN_NON_CLEAR_SEEDS = 11;

//const SPREAD_PROBS = [0, 0.05, 0.10, 0.40, 0.70, 0.90, 1.00];
const SPREAD_PROBS = [0.0, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8];
const YELLOW_PLUS = 0.2;
const ORANGE_PLUS = 0.4;

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
  const radius = 8;
  const inletGoal = 9;
  const live = {};
  // solid disk
  for (let q = -radius; q <= radius; q++) {
    const r1 = Math.max(-radius, -q - radius);
    const r2 = Math.min(radius, -q + radius);
    for (let r = r1; r <= r2; r++) {
      live[Overmap.key(q, r)] = { q, r, stage: STAGE_CLEAR, plan: null, wave: 0 };
    }
  }
  // deterministic RNG from seed
  let s = seed >>> 0;
  function rand() {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  }
  const MIN = 42, MAX = 44;
  let count = Object.keys(live).length;
  while (count > MAX) {
    // collect boundary cells (those with at least one empty neighbor)
    const boundary = [];
    const keys = Object.keys(live);
    for (let i = 0; i < keys.length; i++) {
      const h = live[keys[i]];
      const neigh = Overmap.neighbors(h.q, h.r);
      let open = 0;
      for (let j = 0; j < neigh.length; j++) {
        if (!live[Overmap.key(neigh[j].q, neigh[j].r)]) open++;
      }
      if (open > 0) boundary.push(keys[i]);
    }
    if (boundary.length === 0) break;
    // bias toward cells with more open neighbors (creates inlets / bays)
    boundary.sort((a, b) => {
      const ha = live[a], hb = live[b];
      let oa = 0, ob = 0;
      const na = Overmap.neighbors(ha.q, ha.r);
      const nb = Overmap.neighbors(hb.q, hb.r);
      for (let j = 0; j < na.length; j++) if (!live[Overmap.key(na[j].q, na[j].r)]) oa++;
      for (let j = 0; j < nb.length; j++) if (!live[Overmap.key(nb[j].q, nb[j].r)]) ob++;
      return ob - oa || rand() - 0.5;
    });
    // remove the best candidate that does not strand any neighbor
    let removed = false;
    for (let i = 0; i < boundary.length; i++) {
      const cand = boundary[i];
      const h = live[cand];
      const neigh = Overmap.neighbors(h.q, h.r);
      let strands = false;
      for (let j = 0; j < neigh.length; j++) {
        const nk = Overmap.key(neigh[j].q, neigh[j].r);
        if (!live[nk]) continue;
        const nn = Overmap.neighbors(neigh[j].q, neigh[j].r);
        let others = 0;
        for (let k = 0; k < nn.length; k++) {
          const nkk = Overmap.key(nn[k].q, nn[k].r);
          if (nkk !== cand && live[nkk]) others++;
        }
        if (others === 0) { strands = true; break; }
      }
      if (!strands) {
        delete live[cand];
        count--;
        removed = true;
        break;
      }
    }
    if (!removed) break;
  }
  // if we overshot below MIN (rare), grow back a little by filling the best empty neighbor
  while (count < MIN) {
    const candidates = {};
    const keys = Object.keys(live);
    for (let i = 0; i < keys.length; i++) {
      const h = live[keys[i]];
      const neigh = Overmap.neighbors(h.q, h.r);
      for (let j = 0; j < neigh.length; j++) {
        const n = neigh[j];
        if (Overmap.dist({q:0, r:0}, n) > radius) continue;
        const nk = Overmap.key(n.q, n.r);
        if (!live[nk]) candidates[nk] = n;
      }
    }
    const ckeys = Object.keys(candidates);
    if (ckeys.length === 0) break;
    // prefer the one with most live neighbors
    let best = ckeys[0], bestC = -1;
    for (let i = 0; i < ckeys.length; i++) {
      const n = candidates[ckeys[i]];
      const neigh = Overmap.neighbors(n.q, n.r);
      let c = 0;
      for (let j = 0; j < neigh.length; j++) {
        if (live[Overmap.key(neigh[j].q, neigh[j].r)]) c++;
      }
      if (c > bestC) { bestC = c; best = ckeys[i]; }
    }
    const parts = best.split(",");
    live[best] = { q: +parts[0], r: +parts[1], stage: STAGE_CLEAR, plan: null, wave: 0 };
    count++;
  }
  return live;
};

Overmap.generate = function (seed, targetCount, startWave) {
  targetCount = targetCount || 33;
  startWave = startWave || 7;
  const MAX_LAND_TRIES = 10;
  const MAX_ADVANCE = 100;
  const MIN_SEED_DIST = 5;
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
      clears: 0,
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

// One cool step: decay, then protect, then clear empties. Decay runs first so
// a hex cleared this level becomes SAFER and protects on the very next day.
Overmap.cool = function (country) {
  const keys = Object.keys(country.hexes);
  // decay: JUST_CLEARED -> SAFER, SAFER -> SAFE, SAFE -> CLEAR
  for (let i = 0; i < keys.length; i++) {
    const h = country.hexes[keys[i]];
    if (h.stage < 0) h.stage += 1;
  }
  // protect: each SAFER lowers neighboring yellow/orange one step
  for (let i = 0; i < keys.length; i++) {
    const h = country.hexes[keys[i]];
    if (h.stage !== STAGE_SAFER) continue;
    const neigh = Overmap.neighbors(h.q, h.r);
    for (let j = 0; j < neigh.length; j++) {
      const nh = country.hexes[Overmap.key(neigh[j].q, neigh[j].r)];
      if (nh && nh.stage > STAGE_CLEAR && nh.stage < STAGE_INFECTED) {
        nh.stage -= 1;
      }
    }
  }
  // clear empties: yellow/orange with no infected neighbor
  for (let i = 0; i < keys.length; i++) {
    const h = country.hexes[keys[i]];
    if (h.stage === STAGE_YELLOW || h.stage === STAGE_ORANGE) {
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
  h.stage = STAGE_JUST_CLEARED;
  h.plan = null;
  h.wave = 0;   
};

Overmap.advance = function (country) {
  const keys = Object.keys(country.hexes);
  const toAdvance = [];
  for (let i = 0; i < keys.length; i++) {
    const h = country.hexes[keys[i]];
    if (h.stage >= STAGE_INFECTED || h.stage < 0) continue;
    const n = Overmap.infectedNeighborCount(country, keys[i]);

    let p;
    if (h.stage === STAGE_CLEAR) {
      p = SPREAD_PROBS[n];
    } else if (h.stage === STAGE_YELLOW) {
      p = Math.min(1, SPREAD_PROBS[Math.min(n, 6)] + YELLOW_PLUS);
    } else { // STAGE_ORANGE
      p = Math.min(1, SPREAD_PROBS[Math.min(n, 6)] + ORANGE_PLUS);
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


// New campaign country with the standard size and starting wave.
Overmap.create = function (seed) {
  return Overmap.generate(seed, 32, 1);
};

// Queue everything that happens on the map after a level: the clear on a
// win, then a cool and an advance per day. Days grow with resets, hints and
// undos. Steps play one at a time via Overmap.step and persist with the
// country, so an interrupted run resumes.
Overmap.endLevel = function (country, key, won, stats) {
  const days = 1 + (stats.resets | 0) + Math.floor(((stats.hints | 0) + (stats.undos | 0)) * 0.5);
  if (!country.pending) country.pending = [];
  if (won && key) country.pending.push({ type: "clear", key: key });
  for (let i = 0; i < days; i++) {
    country.pending.push({ type: "cool" });
    country.pending.push({ type: "advance" });
  }
};

// Apply the next queued step. Returns true while more steps remain.
Overmap.step = function (country) {
  const s = country.pending && country.pending.shift();
  if (s && s.type === "clear") {
    Overmap.clearInfected(country, s.key);
    country.clears = (country.clears | 0) + 1;
  } else if (s && s.type === "cool") {
    Overmap.cool(country);
  } else if (s && s.type === "advance") {
    Overmap.advance(country);
    country.time = (country.time | 0) + 1;
  }
  return Overmap.busy(country);
};

Overmap.busy = function (country) {
  return !!(country && country.pending && country.pending.length);
};

Overmap.playable = function (country, key) {
  const h = country.hexes[key];
  return !!(h && h.stage === STAGE_INFECTED && h.plan);
};

Overmap.hexCount = function (country) {
  return Object.keys(country.hexes).length;
};

Overmap.infectedCount = function (country) {
  let n = 0;
  const keys = Object.keys(country.hexes);
  for (let i = 0; i < keys.length; i++) {
    if (country.hexes[keys[i]].stage === STAGE_INFECTED) n++;
  }
  return n;
};

Overmap.setHexPlan = function (country, key, plan) {
  if (country.hexes[key]) country.hexes[key].plan = Plan.copy(plan);
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
