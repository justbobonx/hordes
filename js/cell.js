/** Cell data and draw. */

const CELL_TYPES = {
  grass: { fill: "#3f8f45" },
  scorched: { fill: "#1c5a28" },
  city: { fill: "#2a62d0" },
  horde: { fill: "#c4392f" },
  cleared: { fill: "#3f8f45" },
  ruined: { fill: "#8a8a8a" },
};

function Cell(type) {
  this.type = type || "grass";
  this.fill = CELL_TYPES.grass.fill;
  this.hint = false;
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
};

Cell.prototype.draw = function (ctx, sprites, x, y, size) {
  const inset = Math.max(1, size * 0.06);
  const ix = x + inset;
  const iy = y + inset;
  const is = size - inset * 2;
  ctx.fillStyle = this.fill;
  ctx.fillRect(ix, iy, is, is);
  const id = this.hint && this.type === "cleared" ? "cleared_hint" : this.type;
  const spr = sprites && sprites.get(id);
  if (spr) spr.draw(ctx, ix, iy, is);
};
