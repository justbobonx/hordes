/** Cell data and draw. */

// Flip to true to draw sprites instead of procedural fills + Xs.
// Sprite code and assets stay loaded either way.
const USE_SPRITES = false;

const CELL_TYPES = {
  grass: { fill: "#3f8f45", mark: null, group: false, rad: 0.5 },
  scorched: { fill: "#1c5a28", mark: null, group: false, rad: 0.5 },
  city: { fill: "#2a62d0", mark: null, group: true, rad: 1 },
  horde: { fill: "#c4392f", mark: null, group: false, rad: 1 },
  cleared: { fill: "#3b7540", mark: "#c4392f", group: false, rad: 1 },
  cleared_hint: { fill: "#3b7540", mark: "#e07a2f", group: false, rad: 1 },
  ruined: { fill: "#556787", mark: "#2a2a2a", group: true, rad: 1 },
};

function Cell(type) {
  this.type = type || "grass";
  this.fill = CELL_TYPES.grass.fill;
  this.mark = null;
  this.hint = false;
  this.round = [true, true, true, true];
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
  this.fill = look.fill;
  this.mark = look.mark;
};

Cell.sameGroup = function (grid, cell, row, col) {
  if (row < 0 || col < 0 || row >= grid.rows || col >= grid.cols) return false;
  const other = grid.at(row, col);
  return other && other.type === cell.type;
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
  const rad = Math.floor(base * (look.rad || 1));
  const maxR = is / 2;
  const corners = [
    Math.min(this.round[0] ? rad : 0, maxR),
    Math.min(this.round[1] ? rad : 0, maxR),
    Math.min(this.round[2] ? rad : 0, maxR),
    Math.min(this.round[3] ? rad : 0, maxR),
  ];

  ctx.fillStyle = this.fill;
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
