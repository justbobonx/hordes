/** Propagation, action queue, fuel chains. Mutates grid + actions only. */

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
    let extra = [];
    if (action.anchorRow != null && action.anchorCol != null) {
      const cells = Grid.fuelFootprint(this.grid.rows, this.grid.cols, r, c, action.anchorRow, action.anchorCol);
      for (let i = 0; i < cells.length; i++) {
        if (cells[i].r === r && cells[i].c === c) continue;
        extra.push(cells[i]);
      }
    } else {
      // no anchor: full centered 3x3
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const rr = r + dr;
          const cc = c + dc;
          if (rr < 0 || cc < 0 || rr >= this.grid.rows || cc >= this.grid.cols) continue;
          extra.push({ r: rr, c: cc });
        }
      }
    }
    if (extra.length) {
      const candidates = extra.slice();
      candidates.push({ r: r, c: c });
      const fuelSeed = [{ r: r, c: c }];
      const pruned = this.reachable(candidates, fuelSeed, r, c);
      for (let i = 0; i < pruned.length; i++) {
        const cell = pruned[i];
        if (cell.r === r && cell.c === c) continue;
        const key = cell.r + "," + cell.c;
        if (action.have[key]) continue;
        action.have[key] = cell;
        action.cells.push(cell);
      }
    }
    // Advance the chain anchor so any later fuel in this wave orients off this fuel.
    action.anchorRow = r;
    action.anchorCol = c;
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
  // Reset highlight to default next piece (rightmost / index 0)
  this.selectedQ = this.queue.length ? 0 : null;
  this.preview = null;
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
  // Reset highlight to default next piece (rightmost / index 0)
  this.selectedQ = this.queue.length ? 0 : null;
  this.preview = null;
  if (this.grid && !this.queue.length) this.finish();
};

Game.prototype.abortActions = function () {
  if (this.actionTimer) window.clearTimeout(this.actionTimer);
  this.actionTimer = 0;
  if (this.hintTimer) window.clearTimeout(this.hintTimer);
  this.hintTimer = 0;
  this.hintLock = false;
  this.actions = [];
  this.stampHeld = false;
};
