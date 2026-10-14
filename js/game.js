/** Layout, input, flow, clock, draw. */

function Game() {
  this.ui = new Ui();
  this.chrome = new PlayChrome();
  this.grid = null;
  this.initial = null;
  this.queue = [];
  this.anchors = [];
  this.plan = null;
  this.wave = 1;
  this.cleared = 0;
  this.seen = {};
  this.lost = false;
  this.ended = null;
  this.testPlan = null;
  this.clockOn = 0;
  this.elapsedMs = 0;
  this.storyQueue = [];
  this.storyAfter = null;
  this.hold = null;
  this.preview = null;
  this.origin = { x: 0, y: 0, cell: 32, rows: 6, cols: 6 };
  this.bound = false;
  this.propMs = 60;
  this.actions = [];
  this.actionTimer = 0;
  this.stampHeld = false;
  this.sprites = null;
}

Game.prototype.boot = function () {
  const run = Save.readRun();
  if (run) {
    this.wave = run.wave > 0 ? run.wave : 1;
    this.cleared = run.cleared | 0;
    this.seen = run.seen || {};
  }
  this.testPlan = Plan.fromQuery(location.search);
  this.bind();
  this.layout();
  const self = this;
  this.sprites = SpriteBank.defaults(function () {});
  const board = Save.readBoard();
  if (board && board.cells) this.restore(board);
  else this.ui.showStart();
  this.updateHud();
  this.loop();
  window.addEventListener("resize", function () {
    self.layout();
  });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      self.flushActions();
      self.pauseClock();
      self.persist();
    } else if (self.grid && !self.ended && !self.ui.startOpen()) {
      self.clockOn = Date.now();
    }
  });
  window.addEventListener("pagehide", function () {
    self.flushActions();
    self.pauseClock();
    self.persist();
  });
};

Game.prototype.bind = function () {
  if (this.bound) return;
  this.bound = true;
  const self = this;
  this.ui.bind({
    start: function () {
      self.chrome.enter();
      self.onStart(false);
    },
    startOver: function () {
      self.startOver();
    },
    help: function () {
      self.chrome.enter();
      self.onStart(true);
    },
    planPick: function (card) {
      self.chrome.enter();
      self.onPlan(card);
    },
    planBack: function () {
      self.ui.hidePlan();
      self.ui.showStart();
    },
    storyContinue: function () {
      self.chrome.enter();
      self.advanceStory();
    },
    back: function () {
      self.giveUp();
    },
    hint: function () {
      self.onHint();
    },
    reset: function () {
      if (self.ended === "win") self.onEnd();
      else self.resetWave();
    },
  });
  const canvas = this.ui.canvas;
  canvas.addEventListener("pointerdown", function (e) {
    self.onDown(e);
  });
  canvas.addEventListener("pointermove", function (e) {
    self.onMove(e);
  });
  canvas.addEventListener("pointerup", function (e) {
    self.onUp(e);
  });
  canvas.addEventListener("pointercancel", function () {
    self.clearHold();
  });
  canvas.addEventListener("contextmenu", function (e) {
    e.preventDefault();
  });
  canvas.addEventListener("selectstart", function (e) {
    e.preventDefault();
  });
};

Game.prototype.startOver = function () {
  this.abortActions();
  Save.clearBoard();
  Save.clearRun();
  this.wave = 1;
  this.cleared = 0;
  this.seen = {};
  this.grid = null;
  this.initial = null;
  this.queue = [];
  this.anchors = [];
  this.plan = null;
  this.lost = false;
  this.ended = null;
  this.elapsedMs = 0;
  this.clockOn = 0;
  this.storyQueue = [];
  this.storyAfter = null;
  this.clearHold();
  this.ui.hidePlan();
  this.ui.hideStory();
  this.ui.showStart();
  this.updateHud();
};

Game.prototype.onStart = function (help) {
  this.ui.hideStart();
  this.ui.hidePlan();
  if (help || !this.seen.start) {
    this.seen.start = true;
    this.persistRun();
    this.openStory("start", help ? "title" : "plan");
    return;
  }
  this.openPlan();
};

Game.prototype.openPlan = function () {
  const cards = this.testPlan
    ? [{ plan: this.testPlan, locked: false }]
    : Planner.offer(this.wave);
  this.ui.paintPlans(cards);
  this.ui.showPlan();
  this.updateHud();
};

Game.prototype.openStory = function (id, after) {
  const pages = Story.pages(id);
  if (!pages.length) {
    this.afterStory(after);
    return;
  }
  this.storyQueue = pages;
  this.storyAfter = after;
  this.ui.paintStory(this.storyQueue.shift());
  this.ui.showStory();
};

Game.prototype.advanceStory = function () {
  if (this.storyQueue.length) {
    this.ui.paintStory(this.storyQueue.shift());
    return;
  }
  this.ui.hideStory();
  const after = this.storyAfter;
  this.storyAfter = null;
  this.afterStory(after);
};

Game.prototype.afterStory = function (after) {
  if (after === "title") {
    this.ui.showStart();
    return;
  }
  if (after === "play") {
    this.beginWave(this.plan);
    return;
  }
  this.openPlan();
};

Game.prototype.onPlan = function (card) {
  this.ui.hidePlan();
  this.plan = Plan.copy(card.plan);
  this.beginWave(this.plan);
};

Game.prototype.beginWave = function (plan) {
  this.abortActions();
  this.plan = Plan.copy(plan);
  this.grid = GridBuilder.build(this.plan);
  this.initial = this.grid.types();
  this.queue = this.plan.stamps.slice();
  this.anchors = this.grid.anchors ? this.grid.anchors.slice() : [];
  this.lost = false;
  this.ended = null;
  this.elapsedMs = 0;
  this.clockOn = Date.now();
  this.clearHold();
  this.layout();
  this.persist();
  this.updateHud();
};

Game.prototype.restore = function (data) {
  this.abortActions();
  this.grid = Grid.load(data);
  this.initial = data.initial || this.grid.types();
  this.queue = Array.isArray(data.queue) ? data.queue.slice() : [];
  this.anchors = this.grid.anchors ? this.grid.anchors.slice() : [];
  this.plan = Plan.copy(data.plan);
  this.wave = data.wave || this.plan.wave || this.wave;
  this.lost = !!data.lost;
  this.ended = data.ended || null;
  this.testPlan = data.testPlan ? Plan.copy(data.testPlan) : this.testPlan;
  this.elapsedMs = data.elapsedMs | 0;
  this.clockOn = this.ended ? 0 : Date.now();
  this.ui.hideStart();
  this.layout();
  if (this.ended) this.pauseClock();
};

Game.prototype.resetWave = function () {
  if (!this.grid || !this.initial) return;
  this.abortActions();
  this.grid.writeTypes(this.initial);
  this.queue = this.plan.stamps.slice();
  this.lost = false;
  this.ended = null;
  this.elapsedMs = 0;
  this.clockOn = Date.now();
  this.clearHold();
  this.persist();
  this.updateHud();
};

Game.prototype.giveUp = function () {
  this.abortActions();
  this.pauseClock();
  this.clearHold();
  this.grid = null;
  this.ended = null;
  Save.clearBoard();
  this.ui.showStart();
  this.updateHud();
};

Game.prototype.onEnd = function () {
  const won = this.ended === "win";
  this.ended = null;
  Save.clearBoard();
  if (won && !this.testPlan) {
    this.cleared++;
    this.wave++;
    this.persistRun();
  }
  this.grid = null;
  this.openPlan();
};

Game.prototype.finish = function () {
  if (this.ended) return;
  if (this.actions.length || this.stampHeld) return;
  const clear = this.grid.redCount() === 0 && !this.lost && this.grid.ruinedCount() === 0;
  this.ended = clear ? "win" : "lose";
  this.pauseClock();
  this.persist();
  this.updateHud();
};

Game.prototype.waiting = function () {
  return this.actions.length > 0 || this.stampHeld;
};

Game.prototype.dropAt = function (row, col) {
  if (!this.grid || this.ended || !this.queue.length || this.waiting()) return;
  if (this.ui.storyOpen() || this.ui.planOpen()) return;
  this.beginDrop(row, col, false);
};

Game.prototype.onHint = function () {
  if (!this.grid || this.ended || !this.queue.length || !this.plan || this.waiting()) return;
  if (this.ui.storyOpen() || this.ui.planOpen() || this.ui.startOpen()) return;
  const index = this.plan.stamps.length - this.queue.length;
  const seat = this.anchors[index];
  if (!seat) return;
  this.beginDrop(seat.row, seat.col, true);
};

Game.prototype.beginDrop = function (row, col, hint) {
  const kind = this.queue[0];
  const cells = Grid.footprint(this.grid.rows, this.grid.cols, kind, row, col);
  if (!cells.length) return;
  const have = {};
  for (let i = 0; i < cells.length; i++) have[cells[i].r + "," + cells[i].c] = true;
  const rowHalf = row !== Math.floor(row);
  const colHalf = col !== Math.floor(col);
  const r0 = rowHalf ? Math.floor(row) : row;
  const c0 = colHalf ? Math.floor(col) : col;
  const r1 = rowHalf ? r0 + 1 : r0;
  const c1 = colHalf ? c0 + 1 : c0;
  const candidates = [
    { r: r0, c: c0 },
    { r: r0, c: c1 },
    { r: r1, c: c0 },
    { r: r1, c: c1 },
  ];
  const seeds = [];
  const seen = {};
  for (let i = 0; i < candidates.length; i++) {
    const key = candidates[i].r + "," + candidates[i].c;
    if (seen[key] || !have[key]) continue;
    seen[key] = true;
    seeds.push(candidates[i]);
  }
  if (!seeds.length) return;
  if (!this.enqueueProp(cells, seeds, hint, row, col)) return;
  this.stampHeld = true;
  this.clearHold();
  this.persist();
  this.updateHud();
  this.kickActions();
};

// cells and seeds are { r, c, from? }. Seeds must sit in cells. from null means launch all dirs (anchor). Later effects call this from onCellLand.
Game.prototype.enqueueProp = function (cells, seeds, hint, anchorRow, anchorCol) {
  if (!cells || !cells.length || !seeds || !seeds.length) return null;
  const have = {};
  for (let i = 0; i < cells.length; i++) have[cells[i].r + "," + cells[i].c] = cells[i];
  const frontier = [];
  const seen = {};
  for (let i = 0; i < seeds.length; i++) {
    const key = seeds[i].r + "," + seeds[i].c;
    if (seen[key] || !have[key]) continue;
    seen[key] = true;
    frontier.push({ r: seeds[i].r, c: seeds[i].c, from: seeds[i].from || null });
  }
  if (!frontier.length) return null;
  const action = {
    type: "wave",
    hint: !!hint,
    cells: cells,
    have: have,
    frontier: frontier,
    landed: {},
    stopped: false,
    done: false,
    anchorRow: anchorRow,
    anchorCol: anchorCol,
  };
  this.actions.push(action);
  return action;
};

// Return { stop: true } to keep the wave from leaving this cell.
// Set action.stopped to halt the wave after this generation.
// enqueueProp from here to start another prop. The wait stays up until those drain.
Game.prototype.onCellLand = function (action, r, c, wasBarrier, wasFuel, from) {
  if (wasBarrier) return { stop: true };
  if (wasFuel) {
    const dirs = [
      [-1, -1], // NW
      [-1, 0],  // N
      [-1, 1],  // NE
      [0, 1],   // E
      [1, 1],   // SE
      [1, 0],   // S
      [1, -1],  // SW
      [0, -1],  // W
    ];
    let useFull = false;
    let idx = -1;
    if (action.anchorRow == null || action.anchorCol == null) {
      useFull = true;
    } else {
      const dr = r - action.anchorRow;
      const dc = c - action.anchorCol;
      if (dr === 0 && dc === 0) {
        useFull = true;
      } else {
        // snap to nearest octant by max dot product
        let best = 0;
        let bestDot = -Infinity;
        const len = Math.sqrt(dr * dr + dc * dc);
        for (let i = 0; i < dirs.length; i++) {
          const dlen = Math.sqrt(dirs[i][0] * dirs[i][0] + dirs[i][1] * dirs[i][1]);
          const dot = (dr * dirs[i][0] + dc * dirs[i][1]) / (len * dlen);
          if (dot > bestDot) {
            bestDot = dot;
            best = i;
          }
        }
        idx = best;
      }
    }
    const extra = [];
    const seeds = [];
    if (useFull) {
      for (let i = 0; i < dirs.length; i++) {
        const rr = r + dirs[i][0];
        const cc = c + dirs[i][1];
        if (rr < 0 || cc < 0 || rr >= this.grid.rows || cc >= this.grid.cols) continue;
        extra.push({ r: rr, c: cc });
        seeds.push({ r: rr, c: cc, from: dirs[i] });
      }
    } else if (idx >= 0) {
      const offsets = [-2, -1, 0, 1, 2];
      for (let k = 0; k < offsets.length; k++) {
        const di = (idx + offsets[k] + 8) % 8;
        const ddr = dirs[di][0];
        const ddc = dirs[di][1];
        const rr = r + ddr;
        const cc = c + ddc;
        if (rr < 0 || cc < 0 || rr >= this.grid.rows || cc >= this.grid.cols) continue;
        extra.push({ r: rr, c: cc });
        seeds.push({ r: rr, c: cc, from: [ddr, ddc] });
      }
    }
    if (extra.length) {
      this.enqueueProp(extra, seeds, action.hint, action.anchorRow, action.anchorCol);
    }
    return { stop: true };
  }
  return null;
};

Game.prototype.kickActions = function () {
  if (this.actionTimer || !this.actions.length) return;
  const self = this;
  this.actionTimer = window.setTimeout(function () {
    self.actionTimer = 0;
    self.stepActions();
  }, this.propMs);
};

Game.prototype.stepActions = function () {
  if (!this.grid || !this.actions.length) {
    this.settleStamp();
    return;
  }
  const action = this.actions[0];
  if (action.type === "wave") this.stepWave(action);
  if (action.done) this.actions.shift();
  if (this.actions.length) this.kickActions();
  else this.settleStamp();
};

// Shared land path for both animated step and flush.
// Returns the onCellLand result (or null).
Game.prototype.landCell = function (action, hit) {
  const key = hit.r + "," + hit.c;
  if (action.landed[key]) return null;
  action.landed[key] = true;
  const cell = this.grid.at(hit.r, hit.c);
  const wasBarrier = cell && cell.is("barrier");
  const wasFuel = cell && cell.is("fuel");
  if (this.grid.apply([hit])) this.lost = true;
  if (action.hint) {
    const after = this.grid.at(hit.r, hit.c);
    if (after && after.is("cleared")) after.setType("cleared_hint");
  }
  if (wasBarrier) {
    if (!action.walls) action.walls = {};
    action.walls[key] = true;
  }
  const result = this.onCellLand(action, hit.r, hit.c, wasBarrier, wasFuel, hit.from);
  return result;
};

Game.prototype.losBlocked = function (action, tr, tc) {
  if (action.anchorRow == null || action.anchorCol == null) return false;
  const ar = action.anchorRow;
  const ac = action.anchorCol;
  // Simple grid line from anchor (may be *.5) to target cell center
  const steps = Math.max(Math.abs(tr - ar), Math.abs(tc - ac)) * 2 + 1;
  if (steps < 2) return false;
  for (let s = 1; s < steps; s++) {
    const t = s / steps;
    const rr = Math.round(ar + (tr - ar) * t);
    const cc = Math.round(ac + (tc - ac) * t);
    if (rr === tr && cc === tc) continue;
    const key = rr + "," + cc;
    if (action.walls && action.walls[key]) return true;
    const cell = this.grid.at(rr, cc);
    if (cell && cell.is("barrier")) return true;
  }
  return false;
};

Game.prototype.stepWave = function (action) {
  const spreaders = [];
  for (let i = 0; i < action.frontier.length; i++) {
    const hit = action.frontier[i];
    const spread = this.landCell(action, hit);
    if (action.stopped || (spread && spread.stop)) continue;
    spreaders.push(hit);
  }
  if (action.stopped) {
    action.done = true;
    return;
  }
  const next = [];
  const nextSeen = {};
  const allDirs = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1],
  ];
  for (let i = 0; i < spreaders.length; i++) {
    const hit = spreaders[i];
    for (let d = 0; d < allDirs.length; d++) {
      const dr = allDirs[d][0];
      const dc = allDirs[d][1];
      const rr = hit.r + dr;
      const cc = hit.c + dc;
      const nkey = rr + "," + cc;
      if (!action.have[nkey] || action.landed[nkey] || nextSeen[nkey]) continue;
      // Diagonal corner block
      if (dr !== 0 && dc !== 0) {
        const o1r = hit.r + dr;
        const o1c = hit.c;
        const o2r = hit.r;
        const o2c = hit.c + dc;
        const o1key = o1r + "," + o1c;
        const o2key = o2r + "," + o2c;
        const ortho1 = this.grid.at(o1r, o1c);
        const ortho2 = this.grid.at(o2r, o2c);
        const blocked1 = (action.walls && action.walls[o1key]) || (ortho1 && ortho1.is("barrier"));
        const blocked2 = (action.walls && action.walls[o2key]) || (ortho2 && ortho2.is("barrier"));
        if (blocked1 || blocked2) continue;
      }
      // Radial shadow: skip if line-of-sight from anchor crosses a barrier
      if (this.losBlocked(action, rr, cc)) continue;
      nextSeen[nkey] = true;
      next.push({ r: rr, c: cc, from: [dr, dc] });
    }
  }
  if (!next.length) action.done = true;
  else action.frontier = next;
};

Game.prototype.settleStamp = function () {
  if (this.actions.length) return;
  if (this.stampHeld) {
    this.queue.shift();
    this.stampHeld = false;
  }
  this.persist();
  this.updateHud();
  if (!this.queue.length) this.finish();
};

Game.prototype.flushActions = function () {
  if (this.actionTimer) window.clearTimeout(this.actionTimer);
  this.actionTimer = 0;
  while (this.actions.length && this.grid) {
    const action = this.actions[0];
    if (action.type === "wave" && !action.stopped) {
      for (let i = 0; i < action.cells.length; i++) {
        this.landCell(action, action.cells[i]);
      }
    }
    action.done = true;
    this.actions.shift();
  }
  this.actions = [];
  if (this.stampHeld) {
    this.queue.shift();
    this.stampHeld = false;
  }
  if (this.grid && !this.queue.length) this.finish();
};

Game.prototype.abortActions = function () {
  if (this.actionTimer) window.clearTimeout(this.actionTimer);
  this.actionTimer = 0;
  this.actions = [];
  this.stampHeld = false;
};

Game.prototype.onDown = function (e) {
  if (!this.grid || this.ended || this.waiting()) return;
  if (this.ui.storyOpen() || this.ui.planOpen() || this.ui.startOpen()) return;
  e.preventDefault();
  if (e.shiftKey) {
    const hit = this.aimCell(e);
    if (hit) this.cycleCell(hit.row, hit.col);
    return;
  }
  const hit = this.aim(e);
  if (!hit) return;
  this.clearHold();
  this.hold = { pointerId: e.pointerId };
  this.preview = { row: hit.row, col: hit.col, x: hit.x, y: hit.y };
  try {
    this.ui.canvas.setPointerCapture(e.pointerId);
  } catch (err) {}
};

Game.prototype.onMove = function (e) {
  if (!this.hold || e.pointerId !== this.hold.pointerId) return;
  const hit = this.aim(e);
  if (!hit) return;
  this.preview = { row: hit.row, col: hit.col, x: hit.x, y: hit.y };
};

Game.prototype.onUp = function (e) {
  if (!this.hold || e.pointerId !== this.hold.pointerId) return;
  const hit = this.aim(e);
  const aim = hit || this.preview;
  this.clearHold();
  if (!hit || !aim) return;
  this.dropAt(aim.row, aim.col);
};

Game.prototype.clearHold = function () {
  this.hold = null;
  this.preview = null;
};

Game.prototype.aim = function (e) {
  if (!this.grid || !this.queue.length || this.waiting()) return null;
  const shape = Grid.STAMP_DEFINITIONS[this.queue[0]];
  if (!shape) return null;
  const rect = this.ui.canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const o = this.origin;
  function axis(p, origin, n, size) {
    const local = (p - origin) / o.cell;
    if (size & 1) {
      const i = Math.floor(local);
      if (i < 0 || i >= n) return null;
      return i;
    }
    if (n < 2) return null;
    if (local < -0.5 || local > n + 0.5) return null;
    let line = Math.round(local);
    if (line < 1) line = 1;
    if (line > n - 1) line = n - 1;
    return line - 0.5;
  }
  const col = axis(x, o.x, this.grid.cols, shape.w);
  // Offset only for touch/pen so the bottom edge of the stamp sits at the pointer.
  // Mouse keeps the unshifted center aim.
  let aimY = y;
  if (e.pointerType !== "mouse") {
    aimY = y - ((shape.h + 1) / 2) * o.cell;
  }
  const row = axis(aimY, o.y, this.grid.rows, shape.h);
  if (row === null || col === null) return null;
  return { row: row, col: col, x: x, y: y };
};

Game.prototype.aimCell = function (e) {
  if (!this.grid) return null;
  const rect = this.ui.canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const o = this.origin;
  const col = Math.floor((x - o.x) / o.cell);
  const row = Math.floor((y - o.y) / o.cell);
  if (row < 0 || col < 0 || row >= this.grid.rows || col >= this.grid.cols) return null;
  return { row: row, col: col };
};

Game.prototype.cycleCell = function (row, col) {
  const cell = this.grid.at(row, col);
  if (!cell) return;
  const order = ["grass", "horde", "city", "barrier", "fuel"];
  let i = order.indexOf(cell.type);
  if (i < 0) i = 0;
  const next = order[(i + 1) % order.length];
  cell.setType(next);
  this.grid.dress();
  this.persist();
};

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
  const availW = w - 12;
  const availH = h - pad.top - pad.bot - 12;
  const cell = Math.max(8, Math.min(availW / cols, availH / rows));
  const boardW = cell * cols;
  const boardH = cell * rows;
  this.origin = {
    x: (w - boardW) / 2,
    y: pad.top + (h - pad.top - pad.bot - boardH) / 2,
    cell: cell,
    rows: rows,
    cols: cols,
  };
};

Game.prototype.draw = function () {
  const ctx = this.ui.ctx;
  const w = window.innerWidth;
  const h = window.innerHeight;
  ctx.fillStyle = "#171c14";
  ctx.fillRect(0, 0, w, h);
  if (this.grid) this.drawBoard(ctx);
};

Game.prototype.loop = function () {
  const self = this;
  function tick() {
    self.draw();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
};

Game.prototype.updateHud = function () {
  const status = this.statusView();
  this.ui.paintHud({
    wave: this.plan ? this.plan.wave || this.wave : this.wave,
    plan: this.plan,
    testPlan: !!this.testPlan,
    queue: this.queue,
    statusText: status.text,
    statusClass: status.cls,
    resetLabel: status.resetLabel,
    hideHint: status.hideHint,
  });
};

Game.prototype.statusView = function () {
  if (!this.grid) return { text: "", cls: "", resetLabel: "RESET", hideHint: false };
  const cities = this.grid.ruinedCount();
  const hordeGone = this.grid.redCount() === 0 && !this.lost;
  const piecesGone = this.queue.length === 0;
  let text = "";
  let cls = "";
  if (!piecesGone) {
    if (cities > 0) {
      text = cities + " CITIES DESTROYED!";
      cls = "status-blue";
    }
  } else {
    if (hordeGone && cities === 0) {
      const elapsed = this.elapsedMs + (this.clockOn ? Date.now() - this.clockOn : 0);
      text = "HORDE DESTROYED! (" + this.formatTime(elapsed) + ")";
      cls = "status-green";
    } else if (hordeGone && cities > 0) {
      text = cities + " CITIES DESTROYED!";
      cls = "status-red";
    } else {
      text = "THE HORDE LIVES!";
      cls = "status-red";
    }
  }
  let resetLabel = "RESET";
  if (this.ended === "win") resetLabel = "NEXT WAVE";
  else if (this.ended === "lose" || piecesGone) resetLabel = "TRY AGAIN";
  return {
    text: text,
    cls: cls,
    resetLabel: resetLabel,
    hideHint: piecesGone,
  };
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
  if (!this.preview || !this.queue.length || this.waiting()) return;
  const kind = this.queue[0];
  const cells = Grid.footprint(rows, cols, kind, this.preview.row, this.preview.col);
  if (!cells.length) return;
  for (let i = 0; i < cells.length; i++) {
    const x = o.x + cells[i].c * o.cell;
    const y = o.y + cells[i].r * o.cell;
    ctx.strokeRect(x + inset, y + inset, o.cell - inset * 2, o.cell - inset * 2);
  }
  const ax = o.x + (this.preview.col + 0.5) * o.cell;
  const ay = o.y + (this.preview.row + 0.5) * o.cell;
  const m = o.cell * 0.16;
  // Black half-alpha box twice the yellow size, over the stamp hilite, under the yellow.
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  const bm = m * 2;
  ctx.fillRect(ax - bm / 2, ay - bm / 2, bm, bm);
  ctx.fillStyle = "#f2e27a";
  ctx.fillRect(ax - m / 2, ay - m / 2, m, m);
};

Game.prototype.pauseClock = function () {
  if (!this.clockOn) return;
  this.elapsedMs += Date.now() - this.clockOn;
  this.clockOn = 0;
};

Game.prototype.formatTime = function (ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m + ":" + (r < 10 ? "0" : "") + r;
};

Game.prototype.persistRun = function () {
  Save.writeRun({ wave: this.wave, cleared: this.cleared, seen: this.seen });
};

Game.prototype.persist = function () {
  this.persistRun();
  if (!this.grid) return;
  const elapsed = this.elapsedMs + (this.clockOn ? Date.now() - this.clockOn : 0);
  Save.writeBoard({
    rows: this.grid.rows,
    cols: this.grid.cols,
    cells: this.grid.types(),
    anchors: this.anchors,
    initial: this.initial,
    queue: this.queue.slice(),
    plan: this.plan,
    wave: this.wave,
    lost: this.lost,
    ended: this.ended,
    elapsedMs: elapsed,
    testPlan: this.testPlan,
  });
};

const game = new Game();
game.boot();

