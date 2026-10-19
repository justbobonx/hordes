/** Flow, input, clock, persist. Drawing in drawing.js, mechanics in mechanics.js. */

const AIM_COLOR = "#f2e27a";
const AIM_HINT_COLOR = "#f7a227";

function Game() {
  this.ui = new Ui();
  this.chrome = new PlayChrome();
  this.grid = null;
  this.initial = null;
  this.queue = [];
  this.used = [];
  this.plan = null;
  this.wave = 1;
  this.cleared = 0;
  this.seen = {};
  this.lost = false;
  this.ended = null;
  this.testPlan = null;
  this.clockOn = 0;
  this.elapsedMs = 0;
  this.resets = 0;
  this.storyQueue = [];
  this.storyAfter = null;
  this.hold = null;
  this.preview = null;
  this.selectedQ = null;
  this.origin = { x: 0, y: 0, cell: 32, rows: 6, cols: 6 };
  this.trayH = 80;
  this.tray = { h: 80, stamps: [] };
    this.stampHeldIndex = 0;
  this.bound = false;
  this.propMs = 60;
  this.actions = [];
  this.actionTimer = 0;
  this.stampHeld = false;
  this.hintLock = false;
  this.hintTimer = 0;
  this.sprites = null;
}

Game.prototype.boot = function () {
  const run = Save.readRun();
  if (run) {
    this.wave = run.wave > 0 ? run.wave : 1;
    this.cleared = run.cleared | 0;
    this.seen = run.seen || {};
    this.elapsedMs = run.elapsedMs | 0;
    this.resets = run.resets | 0;
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
  this.used = [];
  this.plan = null;
  this.lost = false;
  this.ended = null;
  this.elapsedMs = 0;
  this.resets = 0;
  this.clockOn = 0;
  this.storyQueue = [];
  this.storyAfter = null;
  this.clearHold();
  this.preview = null;
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
  this.initialStrength = [];
  for (let r = 0; r < this.grid.rows; r++) {
    const row = [];
    for (let c = 0; c < this.grid.cols; c++) row.push(this.grid.at(r, c).strength || 1);
    this.initialStrength.push(row);
  }
  this.grid.writeTypes(this.initial);
  this.restoreStrength(this.initialStrength);
  this.used = [];
  this.rebuildQueue();
  this.lost = false;
  this.ended = null;
  this.elapsedMs = 0;
  this.resets = 0;
  this.clockOn = Date.now();
  this.clearHold();
  this.preview = null;
  this.layout();
  this.persist();
  this.updateHud();
};

Game.prototype.restore = function (data) {
  this.abortActions();
  this.grid = Grid.load(data);
  this.initial = data.initial || this.grid.types();
  this.initialStrength = data.initialStrength || null;
  if (data.strengths && this.grid.writeStrengths) this.grid.writeStrengths(data.strengths);
  if (data.oStrengths && this.grid.writeOStrengths) {
    this.grid.writeOStrengths(data.oStrengths);
  } else if (this.initialStrength) {
    for (let r = 0; r < this.grid.rows; r++) {
      for (let c = 0; c < this.grid.cols; c++) {
        const cell = this.grid.at(r, c);
        if (!cell) continue;
        const st = this.initialStrength[r] && this.initialStrength[r][c];
        cell.oStrength = st > 1 ? st : 1;
      }
    }
  }
  this.used = Array.isArray(data.used) ? data.used.slice() : [];
  this.queue = Array.isArray(data.queue) ? data.queue.slice() : [];
  if (!this.queue.length) this.rebuildQueue();
  this.plan = Plan.copy(data.plan);
  this.wave = data.wave || this.plan.wave || this.wave;
  this.lost = !!data.lost;
  this.ended = data.ended || null;
  this.testPlan = data.testPlan ? Plan.copy(data.testPlan) : this.testPlan;
  // elapsed and resets come from run (already loaded in boot)
  this.clockOn = this.ended ? 0 : Date.now();
  this.ui.hideStart();
  this.layout();
  if (this.ended) this.pauseClock();
};


Game.prototype.restoreStrength = function (strengths) {
  if (!this.grid || !strengths) return;
  for (let r = 0; r < this.grid.rows; r++) {
    for (let c = 0; c < this.grid.cols; c++) {
      const cell = this.grid.at(r, c);
      if (!cell) continue;
      const st = strengths[r] && strengths[r][c];
      const val = st > 1 ? st : 1;
      cell.strength = val;
      cell.oStrength = val;
    }
  }
};



Game.prototype.pieceById = function (boardId) {
  if (!this.grid || !this.grid.pieces) return null;
  for (let i = 0; i < this.grid.pieces.length; i++) {
    if (this.grid.pieces[i].boardId === boardId) return this.grid.pieces[i];
  }
  return null;
};

Game.prototype.rebuildQueue = function () {
  this.queue = [];
  if (!this.grid || !this.grid.pieces) return;
  for (let i = 0; i < this.grid.pieces.length; i++) {
    const fp = this.grid.pieces[i];
    if (fp.role === "place" && this.used.indexOf(fp.boardId) < 0) this.queue.push(fp.boardId);
  }
};

Game.prototype.resetWave = function () {
  if (!this.grid || !this.initial) return;
  this.abortActions();
  this.grid.writeTypes(this.initial);
  if (this.initialStrength) this.restoreStrength(this.initialStrength);
  this.used = [];
  this.rebuildQueue();
  this.lost = false;
  this.ended = null;
  this.resets = (this.resets | 0) + 1;
  // do not zero elapsedMs — keep the figuring-out time
  this.clockOn = Date.now();
  this.clearHold();
  this.preview = null;
  this.persist();
  this.updateHud();
};

Game.prototype.giveUp = function () {
  this.abortActions();
  this.pauseClock();
  this.clearHold();
  this.preview = null;
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
  return this.actions.length > 0 || this.stampHeld || this.hintLock;
};

Game.prototype.dropAt = function (row, col) {
  if (!this.grid || this.ended || !this.queue.length || this.waiting()) return;
  if (this.ui.storyOpen() || this.ui.planOpen()) return;
  this.beginDrop(row, col, false);
};

Game.prototype.onHint = function () {
  if (!this.grid || this.ended || !this.queue.length || !this.plan || this.waiting()) return;
  if (this.ui.storyOpen() || this.ui.planOpen() || this.ui.startOpen()) return;
  if (!this.queue.length) return;
  const best = 0;
  const boardId = this.queue[best];
  const fp = this.pieceById(boardId);
  if (!fp) return;
  this.selectedQ = best;
  this.preview = { qIndex: best, row: fp.anchor.r, col: fp.anchor.c };
  this.hintLock = true;
  const self = this;
  if (this.hintTimer) window.clearTimeout(this.hintTimer);
  this.hintTimer = window.setTimeout(function () {
    self.hintTimer = 0;
    self.hintLock = false;
    if (!self.grid || self.ended || best >= self.queue.length) return;
    self.beginDrop(fp.anchor.r, fp.anchor.c, true, best);
  }, 1000);
};

Game.prototype.beginDrop = function (row, col, hint, qIndex) {
  if (qIndex == null) qIndex = 0;
  if (qIndex < 0 || qIndex >= this.queue.length) return;
  const boardId = this.queue[qIndex];
  const fp = this.pieceById(boardId);
  if (!fp) return;
  const aimed = Footprint.fromStamp(this.grid.rows, this.grid.cols, fp.kind, row, col);
  if (!aimed || !aimed.cells.length) return;
  const cells = aimed.cells;
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
  const pruned = this.reachable(cells, seeds, row, col);
  if (!pruned.length) return;
  if (!this.enqueueProp(pruned, seeds, hint, row, col)) return;
  this.stampHeld = true;
  this.stampHeldIndex = qIndex;
  this.preview = null;
  this.clearHold();
  this.preview = null;
  this.persist();
  this.updateHud();
  this.kickActions();
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
  const rect = this.ui.canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const trayHit = this.hitTray(x, y);
  const onGhost = this.preview && this.pointOnPreview(x, y);
  this.hold = {
    id: e.pointerId,
    x0: x,
    y0: y,
    t0: Date.now(),
    moved: false,
    onPiece: !!onGhost,
    trayIndex: trayHit ? trayHit.index : null,
    placed: false,
    grabDx: 0,
    grabDy: 0,
  };
  if (trayHit) {
    this.selectedQ = trayHit.index;
  } else if (!this.preview && this.queue.length) {
    this.setSelected(0);
    const fp0 = this.pieceById(this.queue[0]); const aim = fp0 ? this.aimAt(x, y, fp0.kind, e) : null;
    if (aim) {
      this.preview.row = aim.row;
      this.preview.col = aim.col;
    }
    this.hold.placed = true;
    this.hold.justStarted = true;
  } else if (this.preview) {
    this.hold.placed = true;
  }
  if (this.preview && this.hold.placed) {
    const center = this.previewCenter();
    if (center) {
      this.hold.grabDx = x - center.x;
      this.hold.grabDy = y - center.y;
    }
  }
  try {
    this.ui.canvas.setPointerCapture(e.pointerId);
  } catch (err) {}
};

Game.prototype.onMove = function (e) {
  if (!this.hold || e.pointerId !== this.hold.id) return;
  const rect = this.ui.canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const dx = x - this.hold.x0;
  const dy = y - this.hold.y0;
  if (dx * dx + dy * dy > 64) this.hold.moved = true;
  if (this.hold.trayIndex != null && !this.hold.placed) {
    const fp = this.pieceById(this.queue[this.hold.trayIndex]); const kind = fp ? fp.kind : null;
    if (!kind) return;
    const aim = this.aimAt(x, y, kind, e);
    if (!aim) return;
    this.preview = { qIndex: this.hold.trayIndex, row: aim.row, col: aim.col };
    this.selectedQ = this.hold.trayIndex;
    const center = this.previewCenter();
    if (center) {
      this.hold.grabDx = x - center.x;
      this.hold.grabDy = y - center.y;
    }
    this.hold.placed = true;
    return;
  }
  if (!this.hold.moved || !this.preview) return;
  const fp = this.pieceById(this.queue[this.preview.qIndex]); const kind = fp ? fp.kind : null;
  if (!kind) return;
  const aim = this.aimAt(x - this.hold.grabDx, y - this.hold.grabDy, kind, null);
  if (aim) {
    this.preview.row = aim.row;
    this.preview.col = aim.col;
  }
};

Game.prototype.onUp = function (e) {
  if (!this.hold || e.pointerId !== this.hold.id) return;
  const dt = Date.now() - this.hold.t0;
  const trayIndex = this.hold.trayIndex;
  const placed = this.hold.placed;
  const justStarted = !!this.hold.justStarted;
  const isClick = !this.hold.moved && dt < 300 && this.preview;
  this.hold = null;
  if (trayIndex != null && !placed) {
    this.preview = null;
    this.selectedQ = trayIndex;
    this.setSelected(trayIndex);
    return;
  }
  // Aim-start gesture must not also count as the drop click
  if (isClick && !justStarted) this.dropSelected();
};

Game.prototype.clearHold = function () {
  this.hold = null;
};

Game.prototype.setSelected = function (qIndex) {
  if (qIndex < 0 || qIndex >= this.queue.length) return;
  if (this.preview && this.preview.qIndex === qIndex) return;
  const fp = this.pieceById(this.queue[qIndex]); const kind = fp ? fp.kind : null;
  const shape = Grid.STAMP_DEFINITIONS[kind];
  if (!shape) return;
  function snap(center, size, n) {
    if (size & 1) {
      let i = Math.round(center - 0.5);
      if (i < 0) i = 0;
      if (i >= n) i = n - 1;
      return i;
    }
    let line = Math.round(center);
    if (line < 1) line = 1;
    if (line > n - 1) line = n - 1;
    return line - 0.5;
  }
  const centerR = this.grid.rows / 2;
  const centerC = this.grid.cols / 2;
  this.preview = {
    qIndex: qIndex,
    row: snap(centerR, shape.h, this.grid.rows),
    col: snap(centerC, shape.w, this.grid.cols),
  };
  this.selectedQ = qIndex;
};

Game.prototype.previewCenter = function () {
  if (!this.preview || !this.origin) return null;
  const o = this.origin;
  return {
    x: o.x + (this.preview.col + 0.5) * o.cell,
    y: o.y + (this.preview.row + 0.5) * o.cell,
  };
};

Game.prototype.dropSelected = function () {
  if (!this.preview || !this.queue.length) return;
  const i = this.preview.qIndex;
  if (i < 0 || i >= this.queue.length) return;
  this.beginDrop(this.preview.row, this.preview.col, false, i);
};

Game.prototype.aimAt = function (x, y, kind, e) {
  if (!this.grid || !kind) return null;
  const shape = Grid.STAMP_DEFINITIONS[kind];
  if (!shape) return null;
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
  let aimY = y;
  if (e && e.pointerType !== "mouse") {
    aimY = y - ((shape.h + 1) / 2) * o.cell;
  }
  const row = axis(aimY, o.y, this.grid.rows, shape.h);
  if (row === null || col === null) return null;
  return { row: row, col: col };
};

Game.prototype.aim = function (e) {
  if (!this.preview || !this.queue.length) return null;
  const fp = this.pieceById(this.queue[this.preview.qIndex]); const kind = fp ? fp.kind : null;
  const rect = this.ui.canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  return this.aimAt(x, y, kind, e);
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
      const tries = 1 + this.resets;
      text = "HORDE DESTROYED!\nTIME: " + this.formatTime(elapsed) + "   TRIES: " + tries;
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
  const elapsed = this.elapsedMs + (this.clockOn ? Date.now() - this.clockOn : 0);
  Save.writeRun({
    wave: this.wave,
    cleared: this.cleared,
    seen: this.seen,
    elapsedMs: elapsed,
    resets: this.resets | 0,
  });
};

Game.prototype.persist = function () {
  this.persistRun();
  if (!this.grid) return;
  Save.writeBoard({
    rows: this.grid.rows,
    cols: this.grid.cols,
    cells: this.grid.types(),
    strengths: this.grid.strengths(),
    oStrengths: this.grid.oStrengths(),
    pieces: this.grid.pieces.map(function (p) { return p.toJSON(); }),
    initial: this.initial,
    initialStrength: this.initialStrength,
    queue: this.queue.slice(),
    used: this.used.slice(),
    plan: this.plan,
    wave: this.wave,
    lost: this.lost,
    ended: this.ended,
    testPlan: this.testPlan,
  });
};




