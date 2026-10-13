/** Cell data and draw. */

// Flip to true to draw sprites instead of procedural fills + Xs.
// Sprite code and assets stay loaded either way.
const USE_SPRITES = false;

const CELL_TYPES = {
  grass: { fill: "#3f8f45", mark: null, group: false, round: 0.5, vary: "cell", varyAmount: 0.07 },
  scorched: { fill: "#1c5a28", mark: null, group: false, round: 0.5, vary: "cell", varyAmount: 0.05 },
  city: { fill: "#2a62d0", mark: null, group: true, round: 1, vary: "group", varyAmount: 0.09 },
  horde: { fill: "#c4392f", mark: null, group: false, round: 1, vary: "pulse", varyAmount: 0.15 },
  cleared: { fill: "#3b7540", mark: "#c4392f", group: false, round: 1, vary: "cell", varyAmount: 0.05 },
  cleared_hint: { fill: "#3b7540", mark: "#e07a2f", group: false, round: 1, vary: "cell",varyAmount: 0.05 },
  ruined: { fill: "#556787", mark: "#2a2a2a", group: true, round: 1, vary: "group", varyAmount: 0.05 },
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
  this.hint = false;
  this.round = [true, true, true, true];
  this.groupId = null;
  this.seed = (Math.random() * 0xffffffff) >>> 0;
  this.phase = Math.random() * Math.PI * 2;
  this.dress();
}

Cell.prototype.is = function (name) {
  return this.type === name;
};

Cell.prototype.setType = function (name) {
  this.type = CELL_TYPES[name] ? name : "grass";
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

Cell.dressGrid = function (grid) {
  if (!grid) return;
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const cell = grid.at(r, c);
      const look = CELL_TYPES[cell.type] || CELL_TYPES.grass;
      if (!look.group) {
        cell.round = [true, true, true, true];
        continue;
      }
      const up = Cell.sameGroup(grid, cell, r - 1, c);
      const down = Cell.sameGroup(grid, cell, r + 1, c);
      const left = Cell.sameGroup(grid, cell, r, c - 1);
      const right = Cell.sameGroup(grid, cell, r, c + 1);
      // TL, TR, BR, BL — round only outer corners of the group
      cell.round = [!(up || left), !(up || right), !(down || right), !(down || left)];
    }
  }
};

Cell.prototype.draw = function (ctx, sprites, x, y, size) {
  const inset = Math.max(1, size * 0.06);
  const ix = x + inset;
  const iy = y + inset;
  const is = size - inset * 2;

  const look = CELL_TYPES[this.type] || CELL_TYPES.grass;
  const base = Math.max(4, Math.floor(size * 0.18));
  const rad = Math.floor(base * (look.round || 1));
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
    const s = Math.sin(t * (Math.PI * 2 / 3.2) + this.phase);
    const base = look.varyAmount != null ? look.varyAmount : 0.12;
    const amount = s >= 0 ? s * base * 0.6 : s * base * 1.3;
    fill = varyColor(look.fill, 0, amount);
  }
  ctx.fillStyle = fill;

  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(ix, iy, is, is, corners);
    ctx.fill();
  } else {
    ctx.fillRect(ix, iy, is, is);
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
};
