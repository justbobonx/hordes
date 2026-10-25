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
  // Particles live in board pixels, which a new layout moves.
  this.particles.clear();
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
  this.layoutBot = pad.bot;
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

Game.prototype.draw = function (dt) {
  const ctx = this.ui.ctx;
  const w = window.innerWidth;
  const h = window.innerHeight;
  ctx.fillStyle = "#112211";
  ctx.fillRect(0, 0, w, h);
  this.layoutTray();
  this.drawTray(ctx);
  if (!this.grid) return;
  this.drawBoard(ctx);
  if (this.mode !== "level") return;
  // Smoke rises from whatever cities are ruined right now, so undo and reset
  // need no bookkeeping. It keeps going after the level ends.
  const o = this.origin;
  for (let r = 0; r < this.grid.rows; r++) {
    for (let c = 0; c < this.grid.cols; c++) {
      if (!this.grid.at(r, c).is("ruined") || Math.random() >= CITY_PUFFS_PER_SEC * dt) continue;
      this.particles.puff(o.x + (c + 0.5) * o.cell, o.y + (r + 0.5) * o.cell, o.cell);
    }
  }
  this.particles.step(dt);
  this.particles.draw(ctx);
  this.stepToast(dt);
  this.drawToast(ctx);
};

Game.prototype.stepToast = function (dt) {
  const toast = this.toast;
  if (!toast || toast.done) return;
  toast.t += dt;
  if (toast.phase === "in") {
    toast.alpha = Math.min(1, toast.t / TOAST_FADE_IN);
    if (toast.t >= TOAST_FADE_IN) {
      toast.phase = "hold";
      toast.t = 0;
      toast.alpha = 1;
    }
  } else if (toast.phase === "hold") {
    toast.alpha = 1;
    if (!toast.sticky && toast.t >= TOAST_HOLD) {
      toast.phase = "out";
      toast.t = 0;
      toast.outFrom = 1;
    }
  } else if (toast.phase === "out") {
    const from = toast.outFrom != null ? toast.outFrom : 1;
    toast.alpha = Math.max(0, from * (1 - toast.t / TOAST_FADE_OUT));
    if (toast.t >= TOAST_FADE_OUT) {
      toast.done = true;
      toast.alpha = 0;
      this.toast = null;
    }
  }
};

Game.prototype.drawToast = function (ctx) {
  const toast = this.toast;
  if (!toast || toast.done || toast.alpha <= 0) return;
  const o = this.origin;
  if (!o) return;
  const lines = toast.text.split("\n");
  const fontPx = TOAST_FONT_PX;
  const lineH = fontPx;
  const gap = TOAST_LINE_GAP;
  const totalH = lines.length * lineH + Math.max(0, lines.length - 1) * gap;
  const boardH = o.rows * o.cell;
  const cx = o.x + (o.cols * o.cell) / 2;
  const cy = o.y + boardH * TOAST_Y_FRAC;
  const y0 = cy - totalH / 2 + lineH / 2;
  const outline = TOAST_OUTLINE;
  ctx.save();
  ctx.globalAlpha = toast.alpha;
  ctx.font = fontPx + "px m5x7, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i < lines.length; i++) {
    const x = cx;
    const y = y0 + i * (lineH + gap);
    ctx.fillStyle = "#000000";
    ctx.globalAlpha = toast.alpha * 0.15;
    for (let dy = -outline; dy <= outline; dy++) {
      for (let dx = -outline; dx <= outline; dx++) {
        if (dx === 0 && dy === 0) continue;
        ctx.fillText(lines[i], x + dx, y + dy);
      }
    }
    ctx.globalAlpha = toast.alpha;
    ctx.fillStyle = toast.color;
    ctx.fillText(lines[i], x, y);
  }
  ctx.restore();
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
    const shape = Grid.STAMP_DEFINITIONS[s.kind];
    const live = s.index === selected;
    ctx.fillStyle = "#1c2418";
    ctx.fillRect(s.x - 2, s.y - 2, s.w + 4, s.h + 4);
    ctx.fillStyle = shape.trayColor;
    const cell = s.cell;    
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
  let last = 0;
  function tick(now) {
    const dt = last ? Math.min(FRAME_DT_MAX, (now - last) / 1000) : 0;
    last = now;
    self.runActions(dt);
    if (self.mode === "map") self.drawMap();
    else self.draw(dt);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
};

Game.prototype.drawBoard = function (ctx) {
  const o = this.origin;
  const rows = this.grid.rows;
  const cols = this.grid.cols;
  const gap = Math.max(1, o.cell * 0.03);
  ctx.fillStyle = "#112211";
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
