/** Cell data and draw. */

const CELL_TYPES = {
  grass: { fill: "#3f8f45", mark: null },
  scorched: { fill: "#1c5a28", mark: null },
  city: { fill: "#2a62d0", mark: null },
  horde: { fill: "#c4392f", mark: null },
  cleared: { fill: "#3f8f45", mark: "#c4392f" },
  ruined: { fill: "#8a8a8a", mark: "#2a2a2a" },
};

function Cell(type) {
  this.type = type || "grass";
  this.fill = CELL_TYPES.grass.fill;
  this.mark = null;
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

Cell.prototype.draw = function (ctx, x, y, size) {
  const inset = Math.max(1, size * 0.06);
  ctx.fillStyle = this.fill;
  ctx.fillRect(x + inset, y + inset, size - inset * 2, size - inset * 2);
  if (!this.mark) return;
  const pad = size * 0.28;
  ctx.strokeStyle = this.mark;
  ctx.lineWidth = Math.max(2, size * 0.08);
  ctx.lineCap = "square";
  ctx.beginPath();
  ctx.moveTo(x + pad, y + pad);
  ctx.lineTo(x + size - pad, y + size - pad);
  ctx.moveTo(x + size - pad, y + pad);
  ctx.lineTo(x + pad, y + size - pad);
  ctx.stroke();
};
