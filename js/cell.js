/** Cell data and draw. */

// Flip to true to draw sprites instead of procedural fills + Xs.
// Sprite code and assets stay loaded either way.
const USE_SPRITES = false;

// Extra inset per hit taken, as a fraction of cell size:
// STRENGTH_INSET_STEP * (FIRST for hit 1, then + NEXT per additional hit).
const STRENGTH_INSET_STEP = 0.1;
const STRENGTH_INSET_FIRST = 0.8;
const STRENGTH_INSET_NEXT = 0.2;

// Default seconds for one pulse-vary cycle; cell type may set vspeed to override.
const PULSE_PERIOD_SEC = 4.0;

// Indent cast on horde: shrink + left inset as fractions of drawn cell, then opacity.
const HORDE_INDENT_SHRINK = 0.28;
const HORDE_INDENT_INSET = 0.12;
const HORDE_INDENT_ALPHA = 0.15;

// Min circular phase gap from each 4-way pulse neighbor (radians on the cycle).
const PULSE_MIN_NEIGHBOR_SEP = Math.PI / 3;
// How many random re-rolls when a pulse cell sits too close to a neighbor.
const PULSE_PHASE_TRIES = 16;

const CELL_TYPES = {
  grass: { fill: "#3b7540", mark: null, group: false, round: 0.5, vary: "cell", varyAmount: 0.08 },
  scorched: { fill: "#365139", mark: null, group: false, round: 0.5, vary: "cell", varyAmount: 0.05 },
  city: { fill: "#1665d3", mark: null, group: true, round: 1, vary: "group", varyAmount: 0.09, outline: "#92adc3" },
  //city: { fill: "#677592", mark: null, group: true, round: 1, vary: "group", varyAmount: 0.09, outline: "#41b441" },
  horde: { fill: "#b7362c", mark: null, group: false, round: 1, vary: "pulse", varyAmount: 0.165 },
  cleared: { fill: "#3f6242", mark: "#b8352c", group: false, round: 1, vary: "cell", varyAmount: 0.05 },
  cleared_hint: { fill: "#3f6242", mark: "#e07a2f", group: false, round: 1, vary: "cell", varyAmount: 0.05 },
  ruined: { fill: "#3c4d72", mark: "#6e88ba", group: true, round: 1, vary: "group", varyAmount: 0.05 },
  barrier: { fill: "#664719", mark: null, group: false, round: 0.2, vary: "cell", varyAmount: 0.06 },
  fuel: { fill: "#d6bf48", mark: null, group: false, round: 2, vary: "pulse", varyAmount: 0.08, vspeed:1.0, outline: "#de8830" },
};

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r, g, b) {
  return "#" + ((1 << 24) + ((r & 255) << 16) + ((g & 255) << 8) + (b & 255)).toString(16).slice(1);
}

function hashSeed(seed) {
  let h = seed | 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

function varyColor(baseHex, seed, amount) {
  const rgb = hexToRgb(baseHex);
  const h = hashSeed(seed);
  const unit = (h % 10000) / 10000 - 0.5;
  const delta = unit * amount * 255;
  return rgbToHex(
    Math.max(0, Math.min(255, Math.round(rgb[0] + delta))),
    Math.max(0, Math.min(255, Math.round(rgb[1] + delta))),
    Math.max(0, Math.min(255, Math.round(rgb[2] + delta)))
  );
}

function Cell(type) {
  this.type = type || "grass";
  this.fill = CELL_TYPES.grass.fill;
  this.mark = null;
  this.round = [true, true, true, true];
  this.outer = [true, true, true, true]; // top, right, bottom, left
  this.groupId = null;
  this.seed = (Math.random() * 0xffffffff) >>> 0;
  this.phase = Math.random() * Math.PI * 2; // random; dress may re-roll if too close to pulse neighbors
  this.strength = 1;
  this.oStrength = 1;
  this.dress();
}

Cell.prototype.is = function (name) {
  return this.type === name;
};

Cell.prototype.setType = function (name) {
  this.type = CELL_TYPES[name] ? name : "grass";
  if (this.type !== "horde") {
    this.strength = 1;
    this.oStrength = 1;
  }
  this.dress();
};

Cell.prototype.dress = function () {
  const look = CELL_TYPES[this.type] || CELL_TYPES.grass;
  this.mark = look.mark;
  const amount = look.varyAmount != null ? look.varyAmount : 0.06;
  if (look.vary === "cell") {
    this.fill = varyColor(look.fill, this.seed, amount);
  } else if (look.vary === "group") {
    this.fill = varyColor(look.fill, this.groupId || this.seed, amount);
  } else {
    this.fill = look.fill;
  }
};

Cell.sameGroup = function (grid, cell, row, col) {
  if (row < 0 || col < 0 || row >= grid.rows || col >= grid.cols) return false;
  const other = grid.at(row, col);
  if (!other) return false;
  if (other.type === cell.type) return true;
  const a = cell.type;
  const b = other.type;
  return (a === "city" || a === "ruined") && (b === "city" || b === "ruined");
};

function cellVariesPulse(cell) {
  const look = CELL_TYPES[cell.type] || CELL_TYPES.grass;
  return look.vary === "pulse";
}

// Keep phase if already clear of every neighbor; otherwise re-roll and keep the
// candidate with the largest gap (stop early once the minimum is met).
function phaseOffsyncFromNeighbors(phase, neighborPhases) {
  const tau = Math.PI * 2;
  if (neighborPhases.length === 0) return phase;

  function minNeighborSep(p) {
    let m = Infinity;
    for (let i = 0; i < neighborPhases.length; i++) {
      const d = Math.abs(p - neighborPhases[i]) % tau;
      const s = Math.min(d, tau - d);
      if (s < m) m = s;
    }
    return m;
  }

  let best = phase;
  let bestSep = minNeighborSep(phase);
  if (bestSep >= PULSE_MIN_NEIGHBOR_SEP) return best;

  for (let t = 0; t < PULSE_PHASE_TRIES; t++) {
    const cand = Math.random() * tau;
    const sep = minNeighborSep(cand);
    if (sep > bestSep) {
      best = cand;
      bestSep = sep;
      if (bestSep >= PULSE_MIN_NEIGHBOR_SEP) break;
    }
  }
  return best;
}

Cell.dressGrid = function (grid) {
  if (!grid) return;
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const cell = grid.at(r, c);
      const look = CELL_TYPES[cell.type] || CELL_TYPES.grass;
      if (!look.group) {
        cell.round = [true, true, true, true];
        cell.outer = [true, true, true, true];
        continue;
      }
      const up = Cell.sameGroup(grid, cell, r - 1, c);
      const down = Cell.sameGroup(grid, cell, r + 1, c);
      const left = Cell.sameGroup(grid, cell, r, c - 1);
      const right = Cell.sameGroup(grid, cell, r, c + 1);
      // TL, TR, BR, BL — round only outer corners of the group
      cell.round = [!(up || left), !(up || right), !(down || right), !(down || left)];
      // top, right, bottom, left — outline only outer edges
      cell.outer = [!up, !right, !down, !left];
    }
  }

  // One-shot: only re-roll pulse cells whose phase sits too close to a pulse neighbor.
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const cell = grid.at(r, c);
      if (!cell || !cellVariesPulse(cell)) continue;
      const neighborPhases = [];
      for (let d = 0; d < dirs.length; d++) {
        const nr = r + dirs[d][0];
        const nc = c + dirs[d][1];
        if (nr < 0 || nc < 0 || nr >= grid.rows || nc >= grid.cols) continue;
        const nb = grid.at(nr, nc);
        if (!nb || !cellVariesPulse(nb)) continue;
        neighborPhases.push(nb.phase);
      }
      cell.phase = phaseOffsyncFromNeighbors(cell.phase, neighborPhases);
    }
  }
};

Cell.prototype.draw = function (ctx, sprites, x, y, size) {
  const baseInset = Math.max(1, size * 0.06);
  const hits = Math.max(0, (this.oStrength || 1) - (this.strength || 1));
  const extra = hits > 0 ? STRENGTH_INSET_STEP * (STRENGTH_INSET_FIRST + STRENGTH_INSET_NEXT * (hits - 1)) * size : 0;
  const inset = baseInset + extra;
  const look = CELL_TYPES[this.type] || CELL_TYPES.grass;
  const base = Math.max(4, Math.floor(size * 0.18));
  const rad = Math.floor(base * (look.round || 1));

  // burnt grass at normal inset when the horde has shrunk
  if (hits > 0 && this.type === "horde") {
    const bix = x + baseInset;
    const biy = y + baseInset;
    const bis = size - baseInset * 2;
    const maxR = bis / 2;
    const corners = [
      Math.min(this.round[0] ? rad : 0, maxR),
      Math.min(this.round[1] ? rad : 0, maxR),
      Math.min(this.round[2] ? rad : 0, maxR),
      Math.min(this.round[3] ? rad : 0, maxR),
    ];
    fillRounded(ctx, bix, biy, bis, corners, CELL_TYPES.scorched.fill);
  }

  const ix = x + inset;
  const iy = y + inset;
  const is = size - inset * 2;
  const maxR = is / 2;
  const corners = [
    Math.min(this.round[0] ? rad : 0, maxR),
    Math.min(this.round[1] ? rad : 0, maxR),
    Math.min(this.round[2] ? rad : 0, maxR),
    Math.min(this.round[3] ? rad : 0, maxR),
  ];

  let fill = this.fill;
  if (look.vary === "pulse") {
    const t = Date.now() / 1000;
    const period = look.vspeed != null ? look.vspeed : PULSE_PERIOD_SEC;
    const s = Math.sin(t * (Math.PI * 2 / period) + this.phase);
    const baseAmt = look.varyAmount != null ? look.varyAmount : 0.12;
    const amount = s >= 0 ? s * baseAmt * 0.6 : s * baseAmt * 1.3;
    fill = varyColor(look.fill, 0, amount);
  }
  fillRounded(ctx, ix, iy, is, corners, fill);

  // Smaller dark pad inside the cell: shrunk, then inset left and down.
  if (this.type === "horde") {
    const shrink = is * HORDE_INDENT_SHRINK;
    const inset = is * HORDE_INDENT_INSET;
    const pad = Math.max(1, is - shrink);
    fillRounded(ctx, ix + inset, iy + shrink - inset, pad, corners, "rgba(96,0,0," + HORDE_INDENT_ALPHA + ")");
  }

  if (look.outline && ctx.roundRect) {
    const lw = Math.min(4, Math.max(2, size * 0.11));
    const outer = this.outer || [true, true, true, true];
    const r = corners;
    ctx.strokeStyle = look.outline;
    ctx.lineWidth = lw;
    ctx.lineCap = "butt";
    ctx.lineJoin = "round";
    // Top
    if (outer[0]) {
      ctx.beginPath();
      const sx = ix + (outer[3] && r[0] > 0 ? r[0] : 0);
      const ex = ix + is - (outer[1] && r[1] > 0 ? r[1] : 0);
      ctx.moveTo(sx, iy);
      ctx.lineTo(ex, iy);
      ctx.stroke();
    }
    // Right
    if (outer[1]) {
      ctx.beginPath();
      const sy = iy + (outer[0] && r[1] > 0 ? r[1] : 0);
      const ey = iy + is - (outer[2] && r[2] > 0 ? r[2] : 0);
      ctx.moveTo(ix + is, sy);
      ctx.lineTo(ix + is, ey);
      ctx.stroke();
    }
    // Bottom
    if (outer[2]) {
      ctx.beginPath();
      const sx = ix + is - (outer[1] && r[2] > 0 ? r[2] : 0);
      const ex = ix + (outer[3] && r[3] > 0 ? r[3] : 0);
      ctx.moveTo(sx, iy + is);
      ctx.lineTo(ex, iy + is);
      ctx.stroke();
    }
    // Left
    if (outer[3]) {
      ctx.beginPath();
      const sy = iy + is - (outer[2] && r[3] > 0 ? r[3] : 0);
      const ey = iy + (outer[0] && r[0] > 0 ? r[0] : 0);
      ctx.moveTo(ix, sy);
      ctx.lineTo(ix, ey);
      ctx.stroke();
    }
    // Corner arcs (only when both adjacent sides are outer and radius > 0)
    if (outer[0] && outer[3] && r[0] > 0) {
      ctx.beginPath();
      ctx.arc(ix + r[0], iy + r[0], r[0], Math.PI, Math.PI * 1.5, false);
      ctx.stroke();
    }
    if (outer[0] && outer[1] && r[1] > 0) {
      ctx.beginPath();
      ctx.arc(ix + is - r[1], iy + r[1], r[1], Math.PI * 1.5, Math.PI * 2, false);
      ctx.stroke();
    }
    if (outer[1] && outer[2] && r[2] > 0) {
      ctx.beginPath();
      ctx.arc(ix + is - r[2], iy + is - r[2], r[2], 0, Math.PI / 2, false);
      ctx.stroke();
    }
    if (outer[2] && outer[3] && r[3] > 0) {
      ctx.beginPath();
      ctx.arc(ix + r[3], iy + is - r[3], r[3], Math.PI / 2, Math.PI, false);
      ctx.stroke();
    }
  }
  if (USE_SPRITES && sprites) {
    const spr = sprites.get(this.type);
    if (spr) spr.draw(ctx, ix, iy, is);
    return;
  }
  // Procedural marks (Xs) when sprites are off. Centered on the full cell.
  const pad = size * 0.28;
  ctx.lineWidth = Math.max(2, size * 0.08);
  ctx.lineCap = "square";
  if (this.mark) {
    ctx.strokeStyle = this.mark;
    ctx.beginPath();
    ctx.moveTo(x + pad, y + pad);
    ctx.lineTo(x + size - pad, y + size - pad);
    ctx.moveTo(x + size - pad, y + pad);
    ctx.lineTo(x + pad, y + size - pad);
    ctx.stroke();
  }
  // Strength number for multi-hit horde (show even after shrinking to 1)
  if (this.type === "horde" && this.strength > 1) {
    const offset = size * 0.05;
    const fontScale = Math.max(0.72, 1 - hits * 0.1);
    ctx.font = (size * 1.2 * fontScale) + "px m5x7, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#442222";
    ctx.fillText(String(this.strength), x + size / 2 + offset * 1.5, y + size / 2);
    ctx.fillStyle = "#e5ce7a";
    ctx.fillText(String(this.strength), x + size / 2 + offset / 2, y + size / 2 - offset);
  }
};

function fillRounded(ctx, x, y, size, corners, color) {
  ctx.fillStyle = color;
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, corners);
    ctx.fill();
  } else {
    ctx.fillRect(x, y, size, size);
  }
}