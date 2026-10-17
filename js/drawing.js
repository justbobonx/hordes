/** Canvas layout and drawing. Reads state, paints. */

Game.prototype.layout = function () {
  const canvas = this.ui.canvas;
  const pad = this.ui.hudPad();
  const w = window.innerWidth;
  const h = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
  canvas.style.imageRendering = "pixelated";
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  this.ui.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const rows = this.grid ? this.grid.rows : 6;
  const cols = this.grid ? this.grid.cols : 6;
  const trayH = this.trayH;
  const availW = w - 12;
  const availH = h - trayH - pad.bot - 12;
  const cell = Math.max(8, Math.min(availW / cols, availH / rows));
  const boardW = cell * cols;
  const boardH = cell * rows;
  this.origin = {
    x: (w - boardW) / 2,
    y: trayH + (h - trayH - pad.bot - boardH) / 2,
    cell: cell,
    rows: rows,
    cols: cols,
  };
  this.layoutTray();
};

Game.prototype.layoutTray = function () {
  const w = window.innerWidth;
  const h = this.trayH;
  const list = this.queue || [];
  if (!list.length) {
    this.tray = { h: h, stamps: [] };
    return;
  }
  let unitsW = 0;
  let maxH = 0;
  const shapes = [];
  const kinds = [];
  for (let i = 0; i < list.length; i++) {
    const fp = this.pieceById(list[i]);
    const kind = fp ? fp.kind : "33";
    kinds.push(kind);
    const s = Grid.STAMP_DEFINITIONS[kind] || { w: 1, h: 1 };
    shapes.push(s);
    unitsW += s.w;
    if (s.h > maxH) maxH = s.h;
  }
  const gaps = Math.max(0, list.length - 1);
  const pad = 8;
  const cellByW = (w - pad * 2 - gaps * 6) / Math.max(1, unitsW);
  const cellByH = (h - pad * 2) / Math.max(1, maxH);
  const cell = Math.max(4, Math.min(cellByW, cellByH, 16));
  const totalW = unitsW * cell + gaps * 6;
  let x = (w - totalW) / 2;
  const stamps = [];
  for (let i = list.length - 1; i >= 0; i--) {
    const s = shapes[i];
    const sw = s.w * cell;
    const sh = s.h * cell;
    const y = (h - sh) / 2;
    stamps.push({ index: i, kind: kinds[i], x: x, y: y, w: sw, h: sh, cell: cell });
    x += sw + 6;
  }
  this.tray = { h: h, cell: cell, stamps: stamps };
};

Game.prototype.hitTray = function (x, y) {
  if (!this.tray || !this.tray.stamps) return null;
  for (let i = 0; i < this.tray.stamps.length; i++) {
    const s = this.tray.stamps[i];
    if (x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h) return s;
  }
  return null;
};

Game.prototype.pointOnPreview = function (x, y) {
  if (!this.preview || !this.grid) return false;
  const fp = this.pieceById(this.queue[this.preview.qIndex]);
  if (!fp) return false;
  const aimed = Footprint.fromStamp(this.grid.rows, this.grid.cols, fp.kind, this.preview.row, this.preview.col);
  if (!aimed) return false;
  const cells = aimed.cells;
  const o = this.origin;
  for (let i = 0; i < cells.length; i++) {
    const cx = o.x + cells[i].c * o.cell;
    const cy = o.y + cells[i].r * o.cell;
    if (x >= cx && x < cx + o.cell && y >= cy && y < cy + o.cell) return true;
  }
  return false;
};

Game.prototype.draw = function () {
  const ctx = this.ui.ctx;
  const w = window.innerWidth;
  const h = window.innerHeight;
  ctx.fillStyle = "#171c14";
  ctx.fillRect(0, 0, w, h);
  this.layoutTray();
  this.drawTray(ctx);
  if (this.grid) this.drawBoard(ctx);
};

Game.prototype.drawTray = function (ctx) {
  const h = this.trayH;
  const w = window.innerWidth;
  ctx.fillStyle = "#12160f";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#2a3324";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, h - 1);
  ctx.lineTo(w, h - 1);
  ctx.stroke();
  const stamps = this.tray && this.tray.stamps ? this.tray.stamps : [];
  const selected = this.selectedQ != null ? this.selectedQ : (this.preview ? this.preview.qIndex : 0);
  for (let i = 0; i < stamps.length; i++) {
    const s = stamps[i];
    const live = s.index === selected;
    ctx.fillStyle = "#1c2418";
    ctx.fillRect(s.x - 2, s.y - 2, s.w + 4, s.h + 4);
    ctx.fillStyle = "#e07a2f";
    const cell = s.cell;
    const shape = Grid.STAMP_DEFINITIONS[s.kind] || { w: 1, h: 1 };
    for (let r = 0; r < shape.h; r++) {
      for (let c = 0; c < shape.w; c++) {
        ctx.fillRect(s.x + c * cell + 1, s.y + r * cell + 1, cell - 2, cell - 2);
      }
    }
    if (live) {
      ctx.strokeStyle = "#f2e27a";
      ctx.lineWidth = 2;
      ctx.strokeRect(s.x - 2, s.y - 2, s.w + 4, s.h + 4);
    }
  }
};

Game.prototype.loop = function () {
  const self = this;
  function tick() {
    self.draw();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
};

Game.prototype.drawBoard = function (ctx) {
  const o = this.origin;
  const rows = this.grid.rows;
  const cols = this.grid.cols;
  const gap = Math.max(1, o.cell * 0.03);
  ctx.fillStyle = "#10140e";
  ctx.fillRect(o.x - gap, o.y - gap, o.cell * cols + gap * 2, o.cell * rows + gap * 2);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      this.grid.at(r, c).draw(ctx, this.sprites, o.x + c * o.cell, o.y + r * o.cell, o.cell);
    }
  }
  ctx.strokeStyle = "#f2e27a";
  ctx.lineWidth = Math.max(2, o.cell * 0.07);
  const inset = Math.max(2, o.cell * 0.05);
  for (let a = 0; a < this.actions.length; a++) {
    const action = this.actions[a];
    if (action.type !== "wave") continue;
    for (let i = 0; i < action.cells.length; i++) {
      const hit = action.cells[i];
      if (action.landed[hit.r + "," + hit.c]) continue;
      const x = o.x + hit.c * o.cell;
      const y = o.y + hit.r * o.cell;
      ctx.strokeRect(x + inset, y + inset, o.cell - inset * 2, o.cell - inset * 2);
    }
  }
  if (!this.preview || !this.queue.length || (this.waiting() && !this.hintLock)) return;
  const fp = this.pieceById(this.queue[this.preview.qIndex]);
  if (!fp) return;
  const aimed = Footprint.fromStamp(rows, cols, fp.kind, this.preview.row, this.preview.col);
  if (!aimed || !aimed.cells.length) return;
  const raw = aimed.cells;
  const have = {};
  for (let i = 0; i < raw.length; i++) have[raw[i].r + "," + raw[i].c] = true;
  const row = this.preview.row;
  const col = this.preview.col;
  const rowHalf = row !== Math.floor(row);
  const colHalf = col !== Math.floor(col);
  const r0 = rowHalf ? Math.floor(row) : row;
  const c0 = colHalf ? Math.floor(col) : col;
  const r1 = rowHalf ? r0 + 1 : r0;
  const c1 = colHalf ? c0 + 1 : c0;
  const candidates = [{ r: r0, c: c0 }, { r: r0, c: c1 }, { r: r1, c: c0 }, { r: r1, c: c1 }];
  const seeds = [];
  const seen = {};
  for (let i = 0; i < candidates.length; i++) {
    const key = candidates[i].r + "," + candidates[i].c;
    if (seen[key] || !have[key]) continue;
    seen[key] = true;
    seeds.push(candidates[i]);
  }
  const primary = this.reachable(raw, seeds, row, col);
  ctx.strokeStyle = this.hintLock ? AIM_HINT_COLOR : AIM_COLOR;
  for (let i = 0; i < primary.length; i++) {
    const x = o.x + primary[i].c * o.cell;
    const y = o.y + primary[i].r * o.cell;
    ctx.strokeRect(x + inset, y + inset, o.cell - inset * 2, o.cell - inset * 2);
  }
  const orangeInset = Math.max(6, o.cell * 0.18);
  const fuelSeen = {};
  const queue = [];
  // Origin for the first fuel is the aimed stamp's anchor, same as the builder.
  for (let i = 0; i < primary.length; i++) {
    const cell = this.grid.at(primary[i].r, primary[i].c);
    if (cell && cell.is("fuel")) queue.push({ fuel: primary[i], prevR: row, prevC: col });
  }
  while (queue.length) {
    const item = queue.shift();
    const fuel = item.fuel;
    const prevR = item.prevR;
    const prevC = item.prevC;
    const fk = fuel.r + "," + fuel.c;
    if (fuelSeen[fk]) continue;
    fuelSeen[fk] = true;
    const extra = this.fuelCellsFrom(fuel.r, fuel.c, prevR, prevC);
    const fseeds = extra.slice();
    const secondary = this.reachable(extra, fseeds, prevR, prevC);
    const orange = [{ r: fuel.r, c: fuel.c }].concat(secondary);
    const oseen = {};
    for (let i = 0; i < orange.length; i++) {
      const ok = orange[i].r + "," + orange[i].c;
      if (oseen[ok]) continue;
      oseen[ok] = true;
      const x = o.x + orange[i].c * o.cell;
      const y = o.y + orange[i].r * o.cell;
      ctx.strokeStyle = "#EBB447";
      ctx.strokeRect(x + orangeInset, y + orangeInset, o.cell - orangeInset * 2, o.cell - orangeInset * 2);
      const ncell = this.grid.at(orange[i].r, orange[i].c);
      if (ncell && ncell.is("fuel") && !fuelSeen[ok]) {
        // Next fuel orients off this fuel cell, same as the builder chain.
        queue.push({ fuel: orange[i], prevR: fuel.r, prevC: fuel.c });
      }
    }
  }
  ctx.strokeStyle = "#f2e27a";
  const ax = o.x + (this.preview.col + 0.5) * o.cell;
  const ay = o.y + (this.preview.row + 0.5) * o.cell;
  const m = o.cell * 0.16;
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  const bm = m * 2;
  ctx.fillRect(ax - bm / 2, ay - bm / 2, bm, bm);
  ctx.fillStyle = "#f2e27a";
  ctx.fillRect(ax - m / 2, ay - m / 2, m, m);
};

const game = new Game();
game.boot();
