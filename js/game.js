/** Flow, input, clock, persist. Drawing in drawing.js, mechanics in mechanics.js. */

const AIM_COLOR = "#f2e27a";
const AIM_HINT_COLOR = "#f7a227";

// Each ruined city on the level board sends up smoke puffs at about this rate.
const CITY_PUFFS_PER_SEC = 3;
// Dots and size scale of the burst for each kind of hit: the small default poof
// on any cell, a strong horde cell losing a point, a horde cell killed, a city
// ruined or fuel set off.
const BURST_POOF = 3;
const BURST_POOF_SCALE = 0.45;
const BURST_STRENGTH = 3;
const BURST_STRENGTH_SCALE = 1;
const BURST_HORDE = 5;
const BURST_HORDE_SCALE = 1;
const BURST_CITY = 5;
const BURST_CITY_SCALE = 0.75;
// Longest frame step in seconds, so a stalled or hidden tab does not make the world jump.
const FRAME_DT_MAX = 0.1;

// Mission clock: each drop costs a slice of a day, scored in hours.
// Day length is the shared mission-day constant declared with the overmap.
const CSO_SDT_MULT = 1.5;
const HINT_SDT_MULT = 3;
// Endless score: 100 at one mission day of hours, 0 at this many (all-hint).
const SCORE_ZERO_HOURS = 72;

// Status toast over the board (seconds / layout / colors matching status-* CSS).
const TOAST_FADE_IN = 0.15;
const TOAST_HOLD = 1.8;
const TOAST_FADE_OUT = 0.3;
const TOAST_Y_FRAC = 0.35;
// Font scales with board width, then shrinks to fit the longest line.
const TOAST_FONT_FRAC = 0.14;
const TOAST_FONT_MIN = 28;
const TOAST_FONT_MAX = 96;
const TOAST_WIDTH_FRAC = 0.95;
const TOAST_OUTLINE_DIV = 16;
const TOAST_OUTLINE_MIN = 1;
const TOAST_GAP_DIV = 8;
const TOAST_OUTLINE_ALPHA = 0.2;
const TOAST_COLOR_BLUE = "#8eb0f0";
const TOAST_COLOR_GREEN = "#a8e0a0";
const TOAST_COLOR_RED = "#f09090";
const TOAST_COLOR_GOLD = "#f0e6a8";
const TOAST_COLOR_ORANGE = "#e07a2f";

function Game() {
  this.ui = new Ui();
  this.chrome = new PlayChrome();
  this.grid = null;
  this.initial = null;
  this.queue = [];
  this.used = [];
  this.undoStack = [];
  this.pendingUndo = null;
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
  this.hintCount = 0;
  this.undoCount = 0;
  this.perfect = true;
  this.missionHours = 0;
  this.tries = 0;
  this.totalTime = 0;
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
  this.propMs = 90;
  this.actions = [];
  // Time banked toward the next wave step, filled by the frame loop.
  this.actionMs = 0;
  this.stampHeld = false;
  this.hintLock = false;
  this.hintTimer = 0;
  this.sprites = null;
  this.undoStack = [];
  this.pendingUndo = null;
  this.mode = "level";
  this.gameMode = null;
  this.country = null;
  this.mapView = null;
  this.activeHexKey = null;
  this.lastHexKey = null;
  this.mapBound = false;
  this.global = Save.readGlobal();
  this.isTutorial = false;
  // Level board effects only, in board canvas pixels.
  this.particles = new Particles();
  // Canvas status toast over the board; not part of the bottom bar.
  this.toast = null;
  this.toastKey = "";
}

Game.prototype.boot = function () {
  this.global = Save.readGlobal();
  this.testPlan = Plan.fromQuery(location.search);
  this.mapView = new MapView(document.getElementById("map"), this.updateMapHud.bind(this));
  this.bind();
  const mapMenu = document.getElementById("btn-map-menu");
  if (mapMenu) {
    const self = this;
    mapMenu.addEventListener("click", function () {
      self.persist();
      self.returnToStart();
    });
  }
  this.layout();
  const self = this;
  this.sprites = SpriteBank.defaults(function () {});
  this.returnToStart();
  this.updateHud();
  this.updateMapHud();
  this.loop();
  window.addEventListener("resize", function () { self.onResize(); });
  document.addEventListener("fullscreenchange", function () { self.onResize(); });
  document.addEventListener("webkitfullscreenchange", function () { self.onResize(); });
  document.addEventListener("visibilitychange", function () {
    // Leaving the page saves and drops to the title, so coming back never
    // lands mid-play with a stale clock or lost fullscreen.
    if (!document.hidden) return;
    self.flushActions();
    self.pauseClock();
    self.persist();
    if (!self.ui.startOpen()) self.returnToStart();
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
    // Help plays the start story, then returns to the title.
    help: function () {
      self.ui.hideStart();
      self.openStory("start", "title");
    },
    planPick: function (card) {
      self.onPlan(card);
    },
    planBack: function () {
      self.onPlanBack();
    },
    storyContinue: function () {
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
    undo: function () {
      self.onUndo();
    },
    // Starting any mode from the title is the one place play goes fullscreen.
    continueMode: function (mode) {
      self.chrome.enter();
      self.enterMode(mode, false);
    },
    newMode: function (mode) {
      self.chrome.enter();
      self.enterMode(mode, true);
    },
    startOver: function () {
      self.startOver();
    },
  });
  const canvas = this.ui.canvas;
  document.addEventListener("keydown", function (e) {
    if (e.key !== "i" && e.key !== "I") return;
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (self.mode !== "level") return;
    self.togglePlanDebug();
  });
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

Game.prototype.campaignInfo = function () {
  const run = Save.readRun("campaign");
  const country = Save.readCountry();
  if (!country && !run) return "";
  const day = country ? (country.time | 0) : 0;
  const tries = run ? (run.tries | 0) : 0;
  return "DAY " + day + " · " + tries + " tries";
};

Game.prototype.endlessInfo = function () {
  const run = Save.readRun("endless");
  if (!run) return "";
  return "WAVE " + (run.wave || 1);
};

// Title state. Before the tutorial is done the title is just Start + Help.
// After it, CONTINUE resumes the last mode played if that mode still has a save.
Game.prototype.refreshStart = function () {
  const hasCampaignSave = !!(Save.readCountry() || Save.readRun("campaign") || Save.readBoard("campaign"));
  const hasEndlessSave = !!(Save.readRun("endless") || Save.readBoard("endless"));
  const introDone = !!this.global.introDone;
  const last = this.global.lastMode;
  let resumeLabel = "";
  if (introDone && last === "campaign" && hasCampaignSave) {
    const country = Save.readCountry();
    resumeLabel = "Campaign - Day " + (country ? (country.time | 0) : 0);
  } else if (introDone && last === "endless" && hasEndlessSave) {
    const run = Save.readRun("endless");
    resumeLabel = "Endless - Wave " + ((run && run.wave) || 1);
  }
  this.ui.updateStartInfo({
    introDone: introDone,
    hasCampaignSave: hasCampaignSave,
    hasEndlessSave: hasEndlessSave,
    campaignInfo: this.campaignInfo(),
    endlessInfo: this.endlessInfo(),
    resumeMode: resumeLabel ? last : null,
    resumeLabel: resumeLabel,
  });
};

Game.prototype.returnToStart = function () {
  this.abortActions();
  this.pauseClock();
  this.chrome.leave();
  this.clearHold();
  this.preview = null;
  this.particles.clear();
  this.clearToast();
  this.grid = null;
  this.plan = null;
  this.ended = null;
  this.activeHexKey = null;
  this.ui.hidePlan();
  this.ui.hideStory();
  this.setMode("start");
  this.refreshStart();
  this.ui.showStart();
};

Game.prototype.enterMode = function (mode, isNew) {
  this.gameMode = mode;
  this.global.lastMode = mode;
  Save.writeGlobal(this.global);
  this.ui.hideStart();
  if (isNew) {
    Save.clearBoard(mode);
    Save.clearRun(mode);
    if (mode === "campaign") Save.clearCountry();
    this.wave = 1;
    this.cleared = 0;
    this.elapsedMs = 0;
    this.resets = 0;
    this.hintCount = 0;
    this.undoCount = 0;
    this.perfect = true;
    this.missionHours = 0;
    this.tries = 0;
    this.totalTime = 0;
    this.activeHexKey = null;
    this.lastHexKey = null;
    this.country = null;
  } else {
    const run = Save.readRun(mode) || {};
    this.wave = run.wave > 0 ? run.wave : 1;
    this.cleared = run.cleared | 0;
    this.elapsedMs = run.elapsedMs | 0;
    this.resets = run.resets | 0;
    this.hintCount = run.hintCount | 0;
    this.undoCount = run.undoCount | 0;
    this.perfect = !!run.perfect;
    this.tries = run.tries | 0;
    this.totalTime = run.totalTime | 0;
    this.activeHexKey = run.activeHexKey || null;
    this.lastHexKey = run.lastHexKey || null;
    if (mode === "campaign") this.country = Save.readCountry();
  }
  if (!this.global.introDone) {
    this.startTutorial();
    return;
  }
  this.isTutorial = false;
  if (mode === "campaign") {
    if (!this.country) this.finishIntro();
    else {
      const board = Save.readBoard("campaign");
      if (board && board.cells && this.activeHexKey) {
        this.setMode("level");
        this.restore(board);
      } else {
        this.activeHexKey = null;
        this.setMode("map");
      }
    }
  } else {
    const board = Save.readBoard("endless");
    if (board && board.cells) {
      this.setMode("level");
      this.restore(board);
    } else {
      this.openPlan();
    }
  }
};

Game.prototype.startTutorial = function () {
  const step = this.global.nextTutorial || 1;
  const keys = Object.keys(Planner.INTRO).map(Number).sort(function (a, b) { return a - b; });
  if (step > keys.length) {
    this.global.introDone = true;
    Save.writeGlobal(this.global);
    this.isTutorial = false;
    this.enterMode(this.gameMode, false);
    return;
  }
  this.isTutorial = true;
  this.wave = keys[step - 1] || step;
  if (!this.global.seenStart) {
    this.global.seenStart = true;
    Save.writeGlobal(this.global);
    this.openStory("start", "tutorial");
    return;
  }
  this.openPlan();
};

Game.prototype.onPlanBack = function () {
  this.ui.hidePlan();
  if (this.gameMode === "campaign" && this.country) {
    // Keep the backed-out hex outlined so the player sees what they had picked.
    this.lastHexKey = this.activeHexKey;
    this.activeHexKey = null;
    this.setMode("map");
  } else {
    this.persist();
    this.returnToStart();
  }
};

Game.prototype.startOver = function () {
  this.abortActions();
  Save.clearAll();
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
  this.hintCount = 0;
  this.undoCount = 0;
  this.perfect = true;
  this.missionHours = 0;
  this.tries = 0;
  this.totalTime = 0;
  this.clockOn = 0;
  this.storyQueue = [];
  this.storyAfter = null;
  this.country = null;
  this.gameMode = null;
  this.isTutorial = false;
  this.global = Save.readGlobal();
  this.activeHexKey = null;
  this.lastHexKey = null;
  this.clearHold();
  this.preview = null;
  this.returnToStart();
  this.updateHud();
};

Game.prototype.resetMapAfterIntro = function () {
  this.abortActions();
  Save.clearBoard(this.gameMode);
  Save.clearCountry();
  this.grid = null;
  this.initial = null;
  this.queue = [];
  this.used = [];
  this.plan = null;
  this.lost = false;
  this.ended = null;
  this.clockOn = 0;
  this.storyQueue = [];
  this.storyAfter = null;
  this.country = null;
  this.activeHexKey = null;
  this.lastHexKey = null;
  this.clearHold();
  this.preview = null;
  this.ui.hidePlan();
  this.ui.hideStory();
  this.ui.hideStart();
  // leave introDone / seen.start so story stays skipped
  this.finishIntro();
};

Game.prototype.openPlan = function () {
  let cards;
  if (this.testPlan) {
    cards = [{ plan: this.testPlan, locked: false, isTutorial: false }];
  } else if (this.isTutorial) {
    const introPlan = Planner.intro(this.wave);
    if (introPlan) {
      cards = [{
        plan: introPlan,
        locked: false,
        isTutorial: true
      }];
    } else {
      cards = Planner.offer(Planner.waveTier(this.wave), this.wave);
      for (let i = 0; i < cards.length; i++) cards[i].isTutorial = true;
    }
  } else {
    cards = Planner.offer(Planner.waveTier(this.wave), this.wave);
    for (let i = 0; i < cards.length; i++) cards[i].isTutorial = false;
  }
  this.ui.paintPlans(cards);
  this.ui.hideStart();
  this.ui.hideStory();
  this.setMode("plan");
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
    this.returnToStart();
    return;
  }
  if (after === "play") {
    this.beginWave(this.plan);
    return;
  }
  if (after === "tutorial") {
    this.startTutorial();
    return;
  }
  this.openPlan();
};

Game.prototype.onPlan = function (card) {
  this.ui.hidePlan();
  // Campaign card shown over the map: play the selected hex.
  if (this.mode === "map" && this.activeHexKey) {
    this.enterHexLevel(this.activeHexKey);
    return;
  }
  this.plan = Plan.copy(card.plan);
  this.beginWave(this.plan);
};

Game.prototype.beginWave = function (plan) {
  this.abortActions();
  this.clearToast();
  this.setMode("level");
  this.ui.hidePlan();
  this.ui.hideStory();
  this.ui.hideStart();
  this.plan = Plan.copy(plan);
  if (this.plan.seed == null) {
    this.plan.seed = (Math.random() * 0x100000000) >>> 0;
    if (this.country && this.activeHexKey) {
      Overmap.setHexPlan(this.country, this.activeHexKey, this.plan);
      Save.writeCountry(this.country);
    }
  }
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
  this.undoStack = [];
  this.pendingUndo = null;
  this.rebuildQueue();
  this.lost = false;
  this.ended = null;
  this.elapsedMs = 0;
  this.resets = 0;
  this.hintCount = 0;
  this.undoCount = 0;
  this.perfect = true;
  this.missionHours = 0;
  this.clockOn = Date.now();
  this.clearHold();
  this.preview = null;
  this.particles.clear();
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
  this.undoStack = Array.isArray(data.undoStack) ? data.undoStack.slice() : [];
  if (!this.queue.length) this.rebuildQueue();
  this.plan = Plan.copy(data.plan);
  this.wave = data.wave || this.plan.wave || this.wave;
  this.missionHours = data.missionHours > 0 ? data.missionHours : 0;
  this.lost = !!data.lost;
  this.ended = data.ended || null;
  this.testPlan = data.testPlan ? Plan.copy(data.testPlan) : this.testPlan;
  // elapsed and resets come from run (already loaded in boot)
  this.clockOn = this.ended ? 0 : Date.now();
  this.ui.hideStart();
  this.particles.clear();
  this.layout();
  if (this.ended) this.pauseClock();
  this.updateHud();
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
  this.undoStack = [];
  this.pendingUndo = null;
  this.rebuildQueue();
  this.lost = false;
  this.ended = null;
  this.resets = (this.resets | 0) + 1;
  this.perfect = false;
  // do not zero elapsedMs — keep the figuring-out time
  this.clockOn = Date.now();
  this.clearHold();
  this.preview = null;
  this.particles.clear();
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
  this.undoStack = [];
  this.pendingUndo = null;
  Save.clearBoard(this.gameMode);
  this.onLevelExit("quit");
};

Game.prototype.onEnd = function () {
  const won = this.ended === "win";
  this.ended = null;
  Save.clearBoard(this.gameMode);
  if (won && !this.testPlan) {
    this.cleared++;
    this.persistRun();
  }
  this.grid = null;
  this.onLevelExit(won ? "win" : "lose");
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
  this.perfect = false;
  this.hintLock = true;
  this.updateHud();
  const self = this;
  if (this.hintTimer) window.clearTimeout(this.hintTimer);
  this.hintTimer = window.setTimeout(function () {
    self.hintTimer = 0;
    self.hintLock = false;
    if (!self.grid || self.ended || best >= self.queue.length) return;
    self.hintCount = (self.hintCount | 0) + 1;
    self.persistRun();
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
  this.pendingUndo = {
    piece: boardId,
    qIndex: qIndex,
    hint: !!hint,
    row: row,
    col: col,
    types: this.grid.types(),
    strengths: this.grid.strengths(),
    oStrengths: this.grid.oStrengths(),
  };
  this.stampHeld = true;
  this.stampHeldIndex = qIndex;
  this.preview = null;
  this.clearHold();
  this.preview = null;
  this.persist();
  this.updateHud();
};

Game.prototype.onDown = function (e) {
  // Win toast: any board tap finishes like Done; lose/retry stays button-only.
  if (this.ended === "win") {
    e.preventDefault();
    this.onEnd();
    return;
  }
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
  const inTray = y<this.trayH; 
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
    // Any tray tap or drag (drag aim and tap-select in onMove/onUp start here) costs the perfect.
    this.selectedQ = trayHit.index;
    this.perfect = false;
    this.updateHud();
  }else if( inTray ) {
    //in tray but no piece
    return;
  }
  else if (!this.preview && this.queue.length) {
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
  const rect = this.ui.canvas.getBoundingClientRect();
  const y = e.clientY - rect.top;
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
  if( y<this.trayH ) {
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

Game.prototype.diffUndo = function (types, strengths, oStrengths) {
  const changes = [];
  if (!this.grid || !types) return changes;
  for (let r = 0; r < this.grid.rows; r++) {
    for (let c = 0; c < this.grid.cols; c++) {
      const cell = this.grid.at(r, c);
      if (!cell) continue;
      const oldType = types[r] && types[r][c];
      const oldStr = (strengths && strengths[r] && strengths[r][c]) || 1;
      const oldO = (oStrengths && oStrengths[r] && oStrengths[r][c]) || 1;
      if (cell.type !== oldType || (cell.strength || 1) !== oldStr || (cell.oStrength || 1) !== oldO) {
        changes.push({ r: r, c: c, type: oldType, strength: oldStr, oStrength: oldO });
      }
    }
  }
  return changes;
};

Game.prototype.commitPendingUndo = function () {
  if (!this.pendingUndo || !this.grid) {
    this.pendingUndo = null;
    return;
  }
  const changes = this.diffUndo(this.pendingUndo.types, this.pendingUndo.strengths, this.pendingUndo.oStrengths);
  if (changes.length) {
    // Charge even on the winning last drop; undo stack is only for mid-level.
    const charged = this.chargeDrop(this.pendingUndo.qIndex, this.pendingUndo.hint);
    if (this.ended !== "win") {
      this.undoStack.push({
        piece: this.pendingUndo.piece,
        qIndex: this.pendingUndo.qIndex,
        row: this.pendingUndo.row,
        col: this.pendingUndo.col,
        changeCells: changes,
        chargedHours: charged,
        hint: !!this.pendingUndo.hint,
      });
    }
  }
  this.pendingUndo = null;
};

Game.prototype.onUndo = function () {
  if (!this.grid || this.ended === "win" || this.waiting() || !this.undoStack.length) return;
  if (this.ui.storyOpen() || this.ui.planOpen() || this.ui.startOpen()) return;
  const rec = this.undoStack.pop();
  if (!rec) return;
  for (let i = 0; i < rec.changeCells.length; i++) {
    const ch = rec.changeCells[i];
    const cell = this.grid.at(ch.r, ch.c);
    if (!cell) continue;
    cell.setType(ch.type);
    cell.strength = ch.strength > 1 ? ch.strength : 1;
    cell.oStrength = ch.oStrength > 1 ? ch.oStrength : 1;
  }
  this.grid.dress();
  const idx = this.used.indexOf(rec.piece);
  if (idx >= 0) this.used.splice(idx, 1);
  this.undoCount = (this.undoCount | 0) + 1;
  this.perfect = false;
  this.refundDrop(rec);
  this.rebuildQueue();
  this.lost = this.grid.ruinedCount() > 0;
  if (this.ended === "lose") {
    this.ended = null;
    this.clockOn = Date.now();
  }
  // The queue keeps board-piece order, so the undone piece is back at the
  // index it was dropped from; show it aimed where it landed.
  this.selectedQ = rec.qIndex;
  this.preview = { qIndex: rec.qIndex, row: rec.row, col: rec.col };
  this.clearHold();
  this.persist();
  this.updateHud();
};

// Hours one standard drop costs for this level's piece count.
Game.prototype.sdt = function () {
  const n = this.plan && this.plan.stamps ? this.plan.stamps.length : 1;
  return Math.floor(MISSION_DAY_HOURS / n);
};

// Add drop cost to the level clock; returns hours charged.
Game.prototype.chargeDrop = function (qIndex, hint) {
  const sdt = this.sdt();
  let charged;
  if (hint) {
    charged = HINT_SDT_MULT * sdt;
    this.perfect = false;
  } else if ((qIndex | 0) === 0) {
    charged = sdt;
  } else {
    charged = CSO_SDT_MULT * sdt;
    this.perfect = false;
  }
  this.missionHours = (this.missionHours || 0) + charged;
  return charged;
};

// Undo returns the drop's hours; a hinted drop keeps its premium.
Game.prototype.refundDrop = function (rec) {
  if (!rec) return;
  const refund = rec.hint ? this.sdt() : (rec.chargedHours || 0);
  this.missionHours = Math.max(0, (this.missionHours || 0) - refund);
};

// Hours the endless score reads. Live HUD adds remaining tray at 1× SDT
// (finish-perfect projection); end toast leaves that off.
Game.prototype.endlessScoreHours = function (live) {
  let h = this.missionHours || 0;
  if (live) {
    const left = this.queue ? this.queue.length : 0;
    h += left * this.sdt();
  }
  return h;
};

// Endless score from mission hours: 100 at one day, 0 at SCORE_ZERO_HOURS.
// Perfect (including exact 24h piece counts like n=4) always gets the plus.
Game.prototype.endlessScoreRaw = function (live) {
  const h = this.endlessScoreHours(live);
  const span = SCORE_ZERO_HOURS - MISSION_DAY_HOURS;
  return 100 * (1 - (h - MISSION_DAY_HOURS) / span);
};

Game.prototype.endlessScore = function (live) {
  if (this.perfect) return "100+";
  const raw = this.endlessScoreRaw(live);
  if (raw > 100) return "100+";
  return String(Math.round(Math.max(0, raw)));
};

// HUD tally color from perfect flag and score bands.
Game.prototype.endlessScoreColor = function (live) {
  if (this.perfect) return TOAST_COLOR_GOLD;
  const n = Math.round(Math.max(0, this.endlessScoreRaw(live)));
  if (n >= 80) return "#ffffff";
  if (n >= 65) return "#e8e475";
  if (n >= 50) return TOAST_COLOR_ORANGE;
  return TOAST_COLOR_RED;
};

// Pad so the live tally digits do not jump as hours grow.
Game.prototype.formatMissionClock = function (hours) {
  const total = Math.max(0, Math.floor(hours || 0));
  const days = Math.floor(total / MISSION_DAY_HOURS);
  const hrs = total % MISSION_DAY_HOURS;
  return "T+ " + String(days).padStart(2, " ") + "D " + String(hrs).padStart(2, " ") + "H";
};

// Hours handed to the overmap from this level's mission clock.
Game.prototype.levelExitHours = function (won) {
  return this.missionHours || 0;
};

Game.prototype.updateHud = function () {
  const status = this.statusView();
  let tally = "";
  let tallyColor = "";
  if (this.grid && this.plan && !this.isTutorial) {
    if (this.gameMode === "endless") {
      tally = this.endlessScore(true);
      tallyColor = this.endlessScoreColor(true);
    } else {
      tally = this.formatMissionClock(this.missionHours);
    }
  }
  this.ui.paintHud({
    queue: this.queue,
    resetLabel: status.resetLabel,
    canHint: status.canHint,
    canBack: status.canBack,
    canUndo: this.undoStack.length > 0 && this.ended !== "win",
    tally: tally,
    tallyColor: tallyColor,
  });
  if (this.mode === "level") this.syncToast(status);
  else this.clearToast();
};

Game.prototype.statusView = function () {
  if (!this.grid) return { text: "", cls: "", sticky: false, resetLabel: "RESET", canHint: true, canBack: true };
  const cities = this.grid.ruinedCount();
  const hordeGone = this.grid.redCount() === 0 && !this.lost;
  const piecesGone = this.queue.length === 0;
  let text = "";
  let cls = "";
  let lineColors = null;
  if (!piecesGone) {
    if (cities > 0) {
      text = cities + " CITIES DESTROYED!";
      cls = "status-blue";
    }
  } else {
    if (hordeGone && cities === 0) {
      const elapsed = this.elapsedMs + (this.clockOn ? Date.now() - this.clockOn : 0);
      const tries = 1 + this.resets;
      const lines = [
        "HORDE DESTROYED!",
        "TIME: " + this.formatTime(elapsed) + "  TRIES: " + tries,
      ];
      const colors = [
        TOAST_COLOR_GREEN,
        TOAST_COLOR_GREEN,
      ];
      if (this.gameMode === "endless") {
        lines.push("SCORE " + this.endlessScore());
        colors.push(this.endlessScoreColor());
      } else {
        lines.push(this.formatMissionClock(this.levelExitHours(true)));
        colors.push(TOAST_COLOR_ORANGE);
      }
      if (this.perfect) {
        lines.push("PERFECT CLEAR!");
        colors.push(TOAST_COLOR_GOLD);
      }
      text = lines.join("\n");
      cls = "status-green";
      lineColors = colors;
    } else if (hordeGone && cities > 0) {
      text = cities + " CITIES DESTROYED!";
      cls = "status-red";
    } else {
      text = "THE HORDE LIVES!";
      cls = "status-red";
    }
  }
  let resetLabel = "RESET";
  if (this.ended === "win") resetLabel = this.gameMode === "endless" ? "NEXT" : "DONE";
  else if (this.ended === "lose" || piecesGone) resetLabel = "TRY AGAIN";
  return {
    text: text,
    cls: cls,
    lineColors: lineColors,
    // End-of-level result holds until the status clears; mid-play city alerts time out.
    sticky: !!(piecesGone && text),
    resetLabel: resetLabel,
    canHint: !piecesGone,
    canBack: this.ended !== "win",
  };
};

Game.prototype.toastColor = function (cls) {
  if (cls === "status-green") return TOAST_COLOR_GREEN;
  if (cls === "status-red") return TOAST_COLOR_RED;
  if (cls === "status-blue") return TOAST_COLOR_BLUE;
  return TOAST_COLOR_BLUE;
};

// Show or refresh the canvas toast when status text/color/stickiness changes.
Game.prototype.syncToast = function (status) {
  const text = status && status.text ? status.text : "";
  const color = text ? this.toastColor(status.cls) : "";
  const lineColors = status && status.lineColors ? status.lineColors : null;
  const sticky = !!(status && status.sticky);
  const key = text ? text + "\0" + color + "\0" + (lineColors ? lineColors.join(",") : "") + "\0" + (sticky ? "1" : "0") : "";
  if (!text) {
    this.toastKey = "";
    this.dismissToast();
    return;
  }
  // Sticky plan-debug toast stays until I is pressed again (end-level sticky still wins).
  const cur = this.toast;
  if (cur && cur.debug && !cur.done && cur.phase !== "out" && !sticky) return;
  // Same status already presented: do not restart a finished timed toast.
  if (key === this.toastKey) return;
  this.toastKey = key;
  this.toast = {
    text: text,
    color: color,
    lineColors: lineColors,
    sticky: sticky,
    phase: "in",
    t: 0,
    alpha: 0,
    outFrom: 1,
    done: false,
  };
};

// Debug: plan config line (formerly on the wave label), as a sticky toast (toggled by I).
Game.prototype.planDebugText = function () {
  const p = this.plan;
  if (!p) return "";
  const pct = function (v) { return Math.round((+v || 0) * 100); };
  const pad = function (n) { return (n < 10 ? "0" : "") + n; };
  return "(C:" + pad(pct(p.centered)) + ",F:" + pad(pct(p.flush)) + ",T:" + pad(pct(p.thin)) +
    ",A:" + p.area + "  F:" + pct(p.fuelChance) +
    ",O:" + pad(pct(p.overlap)) + ",S:" + pad(pct(p.stronger)) + ")";
};

Game.prototype.showPlanDebug = function () {
  const text = this.planDebugText();
  if (!text) return;
  // Clear key so the next status sync re-presents the real status after this.
  this.toastKey = "";
  this.toast = {
    text: text, color: TOAST_COLOR_BLUE, sticky: true, debug: true,
    phase: "in", t: 0, alpha: 0, outFrom: 1, done: false,
  };
};

// I key: toggle the sticky plan-debug toast.
Game.prototype.togglePlanDebug = function () {
  const cur = this.toast;
  if (cur && cur.debug && !cur.done && cur.phase !== "out") {
    this.toastKey = "";
    this.dismissToast();
    return;
  }
  this.showPlanDebug();
};

Game.prototype.dismissToast = function () {
  const cur = this.toast;
  if (!cur || cur.done) {
    this.toast = null;
    return;
  }
  if (cur.phase === "out") return;
  cur.sticky = false;
  cur.phase = "out";
  cur.t = 0;
  cur.outFrom = cur.alpha > 0 ? cur.alpha : 1;
};

// Drop toast immediately (no fade); use when leaving the level board.
Game.prototype.clearToast = function () {
  this.toast = null;
  this.toastKey = "";
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
  if (!this.gameMode) return;
  const elapsed = this.elapsedMs + (this.clockOn ? Date.now() - this.clockOn : 0);
  Save.writeRun(this.gameMode, {
    wave: this.wave,
    cleared: this.cleared,
    seen: this.seen,
    elapsedMs: elapsed,
    resets: this.resets | 0,
    hintCount: this.hintCount | 0,
    undoCount: this.undoCount | 0,
    perfect: this.perfect,
    activeHexKey: this.activeHexKey || null,
    lastHexKey: this.lastHexKey || null,
    tries: this.tries | 0,
    totalTime: this.totalTime | 0,
  });
};

Game.prototype.persist = function () {
  this.persistRun();
  if (!this.grid || !this.gameMode) return;
  Save.writeBoard(this.gameMode, {
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
    missionHours: this.missionHours || 0,
    lost: this.lost,
    ended: this.ended,
    testPlan: this.testPlan,
    undoStack: this.undoStack.slice(),
  });
};

Game.prototype.setMode = function (mode) {
  const wasLevel = this.mode === "level";
  this.mode = mode;
  const board = this.ui.canvas;
  const map = this.mapView.canvas;
  const mapTop = document.getElementById("map-hud-top");
  const mapBot = document.getElementById("map-hud-bottom");
  const levelHud = document.getElementById("hud-bottom");
  const isMap = mode === "map";
  const isLevel = mode === "level";
  // Sticky end-of-level toast must not freeze across overmap / next level.
  if (wasLevel && !isLevel) this.clearToast();
  if (board) board.classList.toggle("inactive", !isLevel);
  if (map) map.classList.toggle("active", isMap);
  if (mapTop) mapTop.hidden = !isMap;
  if (mapBot) mapBot.hidden = !isMap;
  if (levelHud) levelHud.style.display = isLevel ? "" : "none";
  if (isMap) {
    this.bindMap();
    this.mapView.layout(this.country);
    this.drawMap();
  } else {
    this.unbindMap();
    if (isLevel) this.layout();
  }
  this.updateMapHud();
};

Game.prototype.bindMap = function () {
  if (this.mapBound || !this.mapView.canvas) return;
  this.mapBound = true;
  const self = this;
  this._mapDown = function (e) { self.onMapDown(e); };
  this._mapUp = function (e) { self.onMapUp(e); };
  this.mapView.canvas.addEventListener("pointerdown", this._mapDown);
  this.mapView.canvas.addEventListener("pointerup", this._mapUp);
};

Game.prototype.unbindMap = function () {
  if (!this.mapBound || !this.mapView.canvas) return;
  this.mapBound = false;
  if (this._mapDown) this.mapView.canvas.removeEventListener("pointerdown", this._mapDown);
  if (this._mapUp) this.mapView.canvas.removeEventListener("pointerup", this._mapUp);
};

Game.prototype.onResize = function () {
  if (this.mode === "map") {
    this.mapView.layout(this.country);
    this.drawMap();
  } else {
    this.layout();
  }
};

Game.prototype.drawMap = function () {
  this.mapView.draw(this.country, this.activeHexKey || this.lastHexKey);
};

// Select on release, not press: opening the card on pointerdown let the touch
// click that follows land on the card (GO/Back). Down only records the hex.
Game.prototype.onMapDown = function (e) {
  this.mapPress = null;
  if (this.mode !== "map" || !this.country || Overmap.busy(this.country) || this.ui.planOpen()) return;
  e.preventDefault();
  const key = this.mapView.hit(e);
  if (key) this.mapPress = { id: e.pointerId, key: key };
};

Game.prototype.onMapUp = function (e) {
  const press = this.mapPress;
  this.mapPress = null;
  if (!press || press.id !== e.pointerId) return;
  if (this.mode !== "map" || !this.country || Overmap.busy(this.country) || this.ui.planOpen()) return;
  const key = this.mapView.hit(e);
  if (key !== press.key || !Overmap.playable(this.country, key)) return;
  const hex = this.country.hexes[key];
  // Stay in map mode: the card opens over the live map and the hex stays outlined.
  this.activeHexKey = key;
  this.ui.hideStart();
  this.ui.paintPlans([{ plan: hex.plan, locked: false }]);
  this.ui.showPlan(true);
};

Game.prototype.enterHexLevel = function (key) {
  const hex = this.country.hexes[key];
  if (!hex || !hex.plan) return;
  this.activeHexKey = key;
  this.setMode("level");
  this.beginWave(hex.plan);
};

Game.prototype.onLevelExit = function (reason) {
  if (this.isTutorial) {
    if (reason === "win") {
      this.global.nextTutorial = (this.global.nextTutorial || 1) + 1;
      Save.writeGlobal(this.global);
      this.startTutorial();
    } else {
      this.returnToStart();
    }
    this.grid = null;
    this.plan = null;
    this.ended = null;
    return;
  }
  if (this.gameMode === "endless") {
    if (reason === "win") {
      this.wave++;
      this.tries = (this.tries | 0) + 1;
      this.totalTime = (this.totalTime | 0) + this.elapsedMs;
      this.persistRun();
      this.openPlan();
    } else {
      this.persistRun();
      Save.clearBoard("endless");
      this.returnToStart();
    }
    return;
  }
  // campaign: Overmap queues the clear and the days; the map view plays them.
  const key = this.activeHexKey;
  Overmap.endLevel(this.country, key, reason === "win", {
    hours: this.levelExitHours(reason === "win"),
    perfect: this.perfect,
  });
  Save.writeCountry(this.country);
  this.resets = 0;
  this.hintCount = 0;
  this.undoCount = 0;
  this.perfect = true;
  this.missionHours = 0;
  this.tries = (this.tries | 0) + 1;
  this.totalTime = (this.totalTime | 0) + this.elapsedMs;
  this.activeHexKey = null;
  // Quit leaves the hex outlined; a win is already marked by JUST_CLEARED.
  this.lastHexKey = reason === "quit" ? key : null;
  this.persistRun();
  Save.clearBoard("campaign");
  this.grid = null;
  this.ended = null;
  this.plan = null;
  this.clearToast();
  this.setMode("map");
};

Game.prototype.finishIntro = function () {
  this.global.introDone = true;
  Save.writeGlobal(this.global);
  this.wave = 1;
  this.country = Overmap.create(Date.now());
  Save.writeCountry(this.country);
  this.persistRun();
  this.setMode("map");
};

Game.prototype.updateMapHud = function () {
  if (!this.country) return;
  const elI = document.getElementById("map-infected");
  const elT = document.getElementById("map-time");
  const elC = document.getElementById("map-clears");
  const elTries = document.getElementById("map-tries");
  const elTime = document.getElementById("map-total-time");
  if (elI) elI.textContent = Overmap.infectedCount(this.country) + "/" + Overmap.hexCount(this.country);
  if (elT) elT.textContent = String(this.country.time | 0);
  const elH = document.getElementById("map-hours-extra");
  if (elH) {
    const hide = this.country.mapFloat && this.country.mapFloat.hideHudLeftover;
    const rem = Math.floor(this.country.hourRemainder || 0);
    elH.textContent = (!hide && rem > 0) ? "+" + rem + "H" : "";
    elH.style.color = MAP_LEFTOVER_HOURS_COLOR;
  }
  if (elC) elC.textContent = String(this.country.clears | 0);
  if (elTries) elTries.textContent = String(this.tries | 0);
  if (elTime) elTime.textContent = this.formatTime(this.totalTime | 0);
  const elStatus = document.getElementById("map-status");
  if (elStatus) {
    let status = "";
    if (!Overmap.busy(this.country)) {
      if (Overmap.isWin(this.country)) status = "COUNTRY CLEARED";
      else if (Overmap.isLoss(this.country)) status = "THE HORDE CONSUMED THE COUNTRY";
    }
    elStatus.textContent = status;
  }
};






