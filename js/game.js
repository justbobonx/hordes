/** Layout, input, flow, clock, draw. */

function Game() {
  this.ui = new Ui();
  this.chrome = new PlayChrome();
  this.grid = null;
  this.initial = null;
  this.queue = [];
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
  this.holdTimer = 0;
  this.hold = null;
  this.preview = null;
  this.origin = { x: 0, y: 0, cell: 32, rows: 6, cols: 6 };
  this.bound = false;
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
  const board = Save.readBoard();
  if (board && board.cells) this.restore(board);
  else this.ui.showStart();
  this.paint();
  const self = this;
  window.addEventListener("resize", function () {
    self.layout();
    self.paint();
  });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      self.pauseClock();
      self.persist();
    } else if (self.grid && !self.ended && !self.ui.startOpen()) {
      self.clockOn = Date.now();
    }
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
    menu: function () {
      if (self.ui.menuOpen()) self.ui.hideMenu();
      else self.ui.showMenu();
    },
    menuBackdrop: function (e) {
      if (e.target === self.ui.elMenu) self.ui.hideMenu();
    },
    reset: function () {
      self.ui.hideMenu();
      self.resetWave();
    },
    giveUp: function () {
      self.giveUp();
    },
    end: function () {
      if (self.ended === "lose") {
        self.ui.hideEnd();
        self.ended = null;
        self.resetWave();
        return;
      }
      self.onEnd();
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
  Save.clearBoard();
  Save.clearRun();
  this.wave = 1;
  this.cleared = 0;
  this.seen = {};
  this.grid = null;
  this.initial = null;
  this.queue = [];
  this.plan = null;
  this.lost = false;
  this.ended = null;
  this.elapsedMs = 0;
  this.clockOn = 0;
  this.storyQueue = [];
  this.storyAfter = null;
  this.clearHold();
  this.ui.hideEnd();
  this.ui.hideMenu();
  this.ui.hidePlan();
  this.ui.hideStory();
  this.ui.showStart();
  this.paint();
};

Game.prototype.onStart = function (help) {
  this.ui.hideStart();
  this.ui.hideMenu();
  this.ui.hideEnd();
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
  this.paint();
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
  this.plan = Plan.copy(plan);
  this.grid = GridBuilder.build(this.plan);
  this.initial = this.grid.types();
  this.queue = this.plan.stamps.slice();
  this.lost = false;
  this.ended = null;
  this.elapsedMs = 0;
  this.clockOn = Date.now();
  this.clearHold();
  this.ui.hideEnd();
  this.ui.hideMenu();
  this.layout();
  this.persist();
  this.paint();
};

Game.prototype.restore = function (data) {
  this.grid = Grid.load(data);
  this.initial = data.initial || this.grid.types();
  this.queue = Array.isArray(data.queue) ? data.queue.slice() : [];
  this.plan = Plan.copy(data.plan);
  this.wave = data.wave || this.plan.wave || this.wave;
  this.lost = !!data.lost;
  this.ended = data.ended || null;
  this.testPlan = data.testPlan ? Plan.copy(data.testPlan) : this.testPlan;
  this.elapsedMs = data.elapsedMs | 0;
  this.clockOn = this.ended ? 0 : Date.now();
  this.ui.hideStart();
  this.layout();
  if (this.ended) this.showEnd();
};

Game.prototype.resetWave = function () {
  if (!this.grid || !this.initial) return;
  this.grid.writeTypes(this.initial);
  this.grid.dress();
  this.queue = this.plan.stamps.slice();
  this.lost = false;
  this.ended = null;
  this.elapsedMs = 0;
  this.clockOn = Date.now();
  this.clearHold();
  this.ui.hideEnd();
  this.persist();
  this.paint();
};

Game.prototype.giveUp = function () {
  this.pauseClock();
  this.clearHold();
  this.ui.hideMenu();
  this.ui.hideEnd();
  this.grid = null;
  this.ended = null;
  Save.clearBoard();
  this.ui.showStart();
  this.paint();
};

Game.prototype.onEnd = function () {
  const won = this.ended === "win";
  this.ui.hideEnd();
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

Game.prototype.showEnd = function () {
  this.pauseClock();
  const won = this.ended === "win";
  let scorched = 0;
  for (let r = 0; r < this.grid.rows; r++) {
    for (let c = 0; c < this.grid.cols; c++) {
      if (this.grid.at(r, c).is("scorched")) scorched++;
    }
  }
  const cities = this.grid.ruinedCount();
  let title = "The horde still stands!";
  let sub = "";
  if (won && scorched === 0) title = "Precision strike!";
  else if (won) title = "The horde is gone!";
  else if (cities > 0) {
    title = cities === 1 ? "1 city hit!" : cities + " cities hit!";
    if (this.grid.redCount() > 0) sub = "The horde still stands!";
  }
  this.ui.paintEnd(won, this.formatTime(this.elapsedMs), title, sub);
  this.ui.showEnd();
  this.persist();
  this.paint();
};

Game.prototype.finish = function () {
  if (this.ended) return;
  const clear = this.grid.redCount() === 0 && !this.lost && this.grid.ruinedCount() === 0;
  this.ended = clear ? "win" : "lose";
  this.showEnd();
  this.paint();
};

Game.prototype.dropAt = function (row, col) {
  if (!this.grid || this.ended || !this.queue.length) return;
  if (this.ui.menuOpen() || this.ui.storyOpen() || this.ui.planOpen() || this.ui.endOpen()) return;
  const kind = this.queue[0];
  const cells = Grid.footprint(this.grid.rows, this.grid.cols, kind, row, col);
  if (!cells.length) return;
  if (this.grid.apply(cells)) this.lost = true;
  this.queue.shift();
  this.persist();
  this.paint();
  if (!this.queue.length) this.finish();
};

Game.prototype.onDown = function (e) {
  if (!this.grid || this.ended) return;
  if (this.ui.menuOpen() || this.ui.endOpen() || this.ui.storyOpen() || this.ui.planOpen() || this.ui.startOpen()) return;
  e.preventDefault();
  const hit = this.aim(e);
  if (!hit) return;
  this.clearHold();
  this.hold = { pointerId: e.pointerId };
  this.preview = { row: hit.row, col: hit.col };
  this.paint();
  try {
    this.ui.canvas.setPointerCapture(e.pointerId);
  } catch (err) {}
};

Game.prototype.onMove = function (e) {
  if (!this.hold || e.pointerId !== this.hold.pointerId) return;
  const hit = this.aim(e);
  if (!hit) return;
  if (this.preview && hit.row === this.preview.row && hit.col === this.preview.col) return;
  this.preview = { row: hit.row, col: hit.col };
  this.paint();
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
  if (this.holdTimer) window.clearTimeout(this.holdTimer);
  this.holdTimer = 0;
  this.hold = null;
  this.preview = null;
};

Game.prototype.aim = function (e) {
  if (!this.grid || !this.queue.length) return null;
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
  const row = axis(y, o.y, this.grid.rows, shape.h);
  if (row === null || col === null) return null;
  return { row: row, col: col };
};

Game.prototype.layout = function () {
  const canvas = this.ui.canvas;
  const pad = this.ui.hudPad();
  const w = window.innerWidth;
  const h = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
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

Game.prototype.paint = function () {
  const ctx = this.ui.ctx;
  const w = window.innerWidth;
  const h = window.innerHeight;
  ctx.fillStyle = "#171c14";
  ctx.fillRect(0, 0, w, h);
  if (this.grid) this.drawBoard(ctx);
  this.ui.paintHud({
    left: this.queue.length,
    wave: this.plan ? this.plan.wave || this.wave : this.wave,
    cleared: this.cleared,
    lost: this.lost && !this.ended,
    testPlan: !!this.testPlan,
    queue: this.queue,
  });
};

Game.prototype.drawBoard = function (ctx) {
  const o = this.origin;
  const rows = this.grid.rows;
  const cols = this.grid.cols;
  const gap = Math.max(1, o.cell * 0.06);
  ctx.fillStyle = "#10140e";
  ctx.fillRect(o.x - gap, o.y - gap, o.cell * cols + gap * 2, o.cell * rows + gap * 2);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      this.grid.at(r, c).draw(ctx, o.x + c * o.cell, o.y + r * o.cell, o.cell);
    }
  }
  if (!this.preview || !this.queue.length) return;
  const kind = this.queue[0];
  const cells = Grid.footprint(rows, cols, kind, this.preview.row, this.preview.col);
  ctx.strokeStyle = "#f2e27a";
  ctx.lineWidth = Math.max(2, o.cell * 0.07);
  for (let i = 0; i < cells.length; i++) {
    const x = o.x + cells[i].c * o.cell;
    const y = o.y + cells[i].r * o.cell;
    const inset = Math.max(2, o.cell * 0.1);
    ctx.strokeRect(x + inset, y + inset, o.cell - inset * 2, o.cell - inset * 2);
  }
  const ax = o.x + (this.preview.col + 0.5) * o.cell;
  const ay = o.y + (this.preview.row + 0.5) * o.cell;
  ctx.fillStyle = "#f2e27a";
  const m = o.cell * 0.16;
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
