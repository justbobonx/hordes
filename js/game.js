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
  this.selectedQ = null;
  this.origin = { x: 0, y: 0, cell: 32, rows: 6, cols: 6 };
  this.trayH = 80;
  this.tray = { h: 80, stamps: [] };
  this.remAnchors = [];
  this.stampHeldIndex = 0;
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
  this.queue = this.plan.stamps.slice();
  this.remAnchors = this.anchors.slice();
  this.anchors = this.grid.anchors ? this.grid.anchors.slice() : [];
  this.lost = false;
  this.ended = null;
  this.elapsedMs = 0;
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
  this.queue = Array.isArray(data.queue) ? data.queue.slice() : [];
  this.anchors = this.grid.anchors ? this.grid.anchors.slice() : [];
  this.remAnchors = Array.isArray(data.remAnchors) ? data.remAnchors.slice() : this.anchors.slice();
  if (this.remAnchors.length !== this.queue.length) this.remAnchors = this.anchors.slice(0, this.queue.length);
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
  this.remAnchors = this.anchors.slice();
  this.lost = false;
  this.ended = null;
  this.elapsedMs = 0;
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
  let best = -1;
  let bestScore = -1;
  for (let i = 0; i < this.queue.length; i++) {
    const seat = this.remAnchors[i];
    if (!seat) continue;
    const cells = Grid.footprint(this.grid.rows, this.grid.cols, this.queue[i], seat.row, seat.col);
    let score = 0;
    for (let k = 0; k < cells.length; k++) {
      const cell = this.grid.at(cells[k].r, cells[k].c);
      if (cell && cell.is("horde")) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  if (best < 0 || bestScore <= 0) return;
  const seat = this.remAnchors[best];
  this.beginDrop(seat.row, seat.col, true, best);
};

Game.prototype.beginDrop = function (row, col, hint, qIndex) {
  if (qIndex == null) qIndex = 0;
  if (qIndex < 0 || qIndex >= this.queue.length) return;
  const kind = this.queue[qIndex];
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


// Compute cells reachable from seeds inside candidateCells.
// Barriers are included (destroyed) but do not spread.
// Diagonal steps are blocked if either ortho is a barrier.
// Returns array of {r,c}. Boom step never sees barriers.
Game.prototype.reachable = function (candidateCells, seeds, anchorRow, anchorCol) {
  if (!candidateCells || !candidateCells.length || !seeds || !seeds.length) return [];
  const have = {};
  for (let i = 0; i < candidateCells.length; i++) {
    const k = candidateCells[i].r + "," + candidateCells[i].c;
    have[k] = true;
  }

  // Shadow: seed with barrier's in-cone neighbors, then flow outward inside the 45° cone.
  const shadowed = {};
  if (anchorRow != null && anchorCol != null) {
    const dirs8 = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
    for (let i = 0; i < candidateCells.length; i++) {
      const br = candidateCells[i].r;
      const bc = candidateCells[i].c;
      const bcell = this.grid.at(br, bc);
      if (!bcell || !bcell.is("barrier")) continue;
      const adr = br - anchorRow;
      const adc = bc - anchorCol;
      const alen2 = adr * adr + adc * adc;
      if (alen2 < 0.01) continue;
      function inCone(rr, cc) {
        const ddr = rr - br;
        const ddc = cc - bc;
        const parallel = adr * ddr + adc * ddc;
        if (parallel <= 0) return false;
        const cross = adr * ddc - adc * ddr;
        return Math.abs(cross) <= parallel; // angle <= 45°
      }
      const q = [];
      const seen = {};
      // pass 1: immediate neighbors in the cone
      for (let d = 0; d < dirs8.length; d++) {
        const rr = br + dirs8[d][0];
        const cc = bc + dirs8[d][1];
        const nk = rr + "," + cc;
        if (!have[nk] || !inCone(rr, cc)) continue;
        seen[nk] = true;
        shadowed[nk] = true;
        q.push({ r: rr, c: cc, par: adr * (rr - br) + adc * (cc - bc) });
      }
      // later passes: flow to cells with strictly greater parallel, still in cone
      while (q.length) {
        const cur = q.shift();
        for (let d = 0; d < dirs8.length; d++) {
          const rr = cur.r + dirs8[d][0];
          const cc = cur.c + dirs8[d][1];
          const nk = rr + "," + cc;
          if (seen[nk] || !have[nk] || !inCone(rr, cc)) continue;
          const par = adr * (rr - br) + adc * (cc - bc);
          if (par <= cur.par) continue; // must move further along away axis
          seen[nk] = true;
          shadowed[nk] = true;
          q.push({ r: rr, c: cc, par: par });
        }
      }
    }
  }

  const landed = {};
  const result = [];
  const frontier = [];
  const seenSeed = {};
  for (let i = 0; i < seeds.length; i++) {
    const k = seeds[i].r + "," + seeds[i].c;
    if (seenSeed[k] || !have[k] || shadowed[k]) continue;
    seenSeed[k] = true;
    frontier.push({ r: seeds[i].r, c: seeds[i].c });
  }
  const allDirs = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1],
  ];
  while (frontier.length) {
    const next = [];
    const nextSeen = {};
    for (let i = 0; i < frontier.length; i++) {
      const hit = frontier[i];
      const key = hit.r + "," + hit.c;
      if (landed[key]) continue;
      landed[key] = true;
      result.push({ r: hit.r, c: hit.c });
      const hitCell = this.grid.at(hit.r, hit.c);
      if (hitCell && hitCell.is("barrier")) continue; // land + destroy, do not spread
      for (let d = 0; d < allDirs.length; d++) {
        const dr = allDirs[d][0];
        const dc = allDirs[d][1];
        const rr = hit.r + dr;
        const cc = hit.c + dc;
        const nkey = rr + "," + cc;
        if (!have[nkey] || landed[nkey] || nextSeen[nkey] || shadowed[nkey]) continue;
        nextSeen[nkey] = true;
        next.push({ r: rr, c: cc });
      }
    }
    frontier.length = 0;
    for (let i = 0; i < next.length; i++) frontier.push(next[i]);
  }
  return result;
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
Game.prototype.onCellLand = function (action, r, c, wasFuel, from) {
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
      const pruned = this.reachable(extra, seeds, action.anchorRow, action.anchorCol);
      if (pruned.length) {
        this.enqueueProp(pruned, seeds, action.hint, action.anchorRow, action.anchorCol);
      }
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
  const wasFuel = cell && cell.is("fuel");
  if (this.grid.apply([hit])) this.lost = true;
  if (action.hint) {
    const after = this.grid.at(hit.r, hit.c);
    if (after && after.is("cleared")) after.setType("cleared_hint");
  }
  const result = this.onCellLand(action, hit.r, hit.c, wasFuel, hit.from);
  return result;
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
    const i = this.stampHeldIndex | 0;
    if (i >= 0 && i < this.queue.length) {
      this.queue.splice(i, 1);
      this.remAnchors.splice(i, 1);
    }
    this.stampHeld = false;
    this.stampHeldIndex = 0;
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
    const i = this.stampHeldIndex | 0;
    if (i >= 0 && i < this.queue.length) {
      this.queue.splice(i, 1);
      this.remAnchors.splice(i, 1);
    }
    this.stampHeld = false;
    this.stampHeldIndex = 0;
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
    const aim = this.aimAt(x, y, this.queue[0], e);
    if (aim) {
      this.preview.row = aim.row;
      this.preview.col = aim.col;
    }
    this.hold.placed = true;
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
    const kind = this.queue[this.hold.trayIndex];
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
  const kind = this.queue[this.preview.qIndex];
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
  const isClick = !this.hold.moved && dt < 300 && this.preview;
  this.hold = null;
  if (trayIndex != null && !placed) {
    this.preview = null;
    this.selectedQ = trayIndex;
    this.setSelected(trayIndex);
    return;
  }
  if (isClick) this.dropSelected();
};

Game.prototype.clearHold = function () {
  this.hold = null;
};

Game.prototype.setSelected = function (qIndex) {
  if (qIndex < 0 || qIndex >= this.queue.length) return;
  if (this.preview && this.preview.qIndex === qIndex) return;
  const kind = this.queue[qIndex];
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
  const kind = this.queue[this.preview.qIndex];
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
  for (let i = 0; i < list.length; i++) {
    const s = Grid.STAMP_DEFINITIONS[list[i]] || { w: 1, h: 1 };
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
    stamps.push({ index: i, kind: list[i], x: x, y: y, w: sw, h: sh, cell: cell });
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
  const kind = this.queue[this.preview.qIndex];
  if (!kind) return false;
  const cells = Grid.footprint(this.grid.rows, this.grid.cols, kind, this.preview.row, this.preview.col);
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
  const kind = this.queue[this.preview.qIndex];
  if (!kind) return;
  const raw = Grid.footprint(rows, cols, kind, this.preview.row, this.preview.col);
  if (!raw.length) return;
  // Seeds for primary (same logic as beginDrop)
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
  // Yellow: primary reachable
  for (let i = 0; i < primary.length; i++) {
    const x = o.x + primary[i].c * o.cell;
    const y = o.y + primary[i].r * o.cell;
    ctx.strokeRect(x + inset, y + inset, o.cell - inset * 2, o.cell - inset * 2);
  }
  // Orange: fuel secondaries (including the fuel cell itself), smaller box
  const orangeInset = Math.max(6, o.cell * 0.18);
  const fuelSeen = {};
  const queue = [];
  for (let i = 0; i < primary.length; i++) {
    const cell = this.grid.at(primary[i].r, primary[i].c);
    if (cell && cell.is("fuel")) queue.push(primary[i]);
  }
  while (queue.length) {
    const fuel = queue.shift();
    const fk = fuel.r + "," + fuel.c;
    if (fuelSeen[fk]) continue;
    fuelSeen[fk] = true;
    // Build cone exactly as onCellLand
    const dirs = [[-1,-1],[-1,0],[-1,1],[0,1],[1,1],[1,0],[1,-1],[0,-1]];
    let useFull = false;
    let idx = -1;
    if (row == null || col == null) useFull = true;
    else {
      const dr = fuel.r - row;
      const dc = fuel.c - col;
      if (dr === 0 && dc === 0) useFull = true;
      else {
        let best = 0, bestDot = -Infinity;
        const len = Math.sqrt(dr * dr + dc * dc);
        for (let i = 0; i < dirs.length; i++) {
          const dlen = Math.sqrt(dirs[i][0]*dirs[i][0] + dirs[i][1]*dirs[i][1]);
          const dot = (dr * dirs[i][0] + dc * dirs[i][1]) / (len * dlen);
          if (dot > bestDot) { bestDot = dot; best = i; }
        }
        idx = best;
      }
    }
    const extra = [];
    const fseeds = [];
    if (useFull) {
      for (let i = 0; i < dirs.length; i++) {
        const rr = fuel.r + dirs[i][0];
        const cc = fuel.c + dirs[i][1];
        if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
        extra.push({ r: rr, c: cc });
        fseeds.push({ r: rr, c: cc });
      }
    } else if (idx >= 0) {
      const offsets = [-2, -1, 0, 1, 2];
      for (let k = 0; k < offsets.length; k++) {
        const di = (idx + offsets[k] + 8) % 8;
        const rr = fuel.r + dirs[di][0];
        const cc = fuel.c + dirs[di][1];
        if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
        extra.push({ r: rr, c: cc });
        fseeds.push({ r: rr, c: cc });
      }
    }
    const secondary = this.reachable(extra, fseeds, row, col);
    // Include the fuel cell itself in the orange set
    const orange = [{ r: fuel.r, c: fuel.c }].concat(secondary);
    const oseen = {};
    for (let i = 0; i < orange.length; i++) {
      const ok = orange[i].r + "," + orange[i].c;
      if (oseen[ok]) continue;
      oseen[ok] = true;
      const x = o.x + orange[i].c * o.cell;
      const y = o.y + orange[i].r * o.cell;
      ctx.strokeStyle = "#e07a2f";
      ctx.strokeRect(x + orangeInset, y + orangeInset, o.cell - orangeInset * 2, o.cell - orangeInset * 2);
      // Chain: any new fuel in this secondary
      const ncell = this.grid.at(orange[i].r, orange[i].c);
      if (ncell && ncell.is("fuel") && !fuelSeen[ok]) queue.push(orange[i]);
    }
  }
  ctx.strokeStyle = "#f2e27a";
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
    remAnchors: this.remAnchors.slice(),
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

