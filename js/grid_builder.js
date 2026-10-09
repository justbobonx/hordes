/** Drop stamps, then dress grass with towns. The blob stays red. */

function GridBuilder() {}

GridBuilder.RED_CAP = 0.66;

GridBuilder.build = function (plan) {
  const rows = plan.rows | 0;
  const cols = plan.cols | 0;
  const stamps = plan.stamps && plan.stamps.length ? plan.stamps.slice() : ["33"];
  for (let attempt = 0; attempt < 36; attempt++) {
    const built = GridBuilder.dropAll(rows, cols, stamps, plan.open === "edge" ? "edge" : "inner", attempt > 24);
    if (!built) continue;
    GridBuilder.paintCities(built.grid);
    built.grid.dress();
    return built.grid;
  }
  const built = GridBuilder.dropAll(rows, cols, stamps, plan.open === "edge" ? "edge" : "inner", true);
  const grid = built ? built.grid : new Grid(rows, cols);
  if (!built) {
    const kind = stamps[0] || "33";
    const shape = Grid.STAMP_DEFINITIONS[kind];
    let midR = (rows / 2) | 0;
    let midC = (cols / 2) | 0;
    if (shape && !(shape.h & 1)) midR = Math.min(rows - 1.5, Math.max(0.5, midR - 0.5));
    if (shape && !(shape.w & 1)) midC = Math.min(cols - 1.5, Math.max(0.5, midC - 0.5));
    const seed = Grid.footprint(rows, cols, kind, midR, midC);
    for (let i = 0; i < seed.length; i++) grid.at(seed[i].r, seed[i].c).setType("horde");
  }
  GridBuilder.paintCities(grid);
  grid.dress();
  return grid;
};

GridBuilder.dropAll = function (rows, cols, stamps, openSeat, relax) {
  const grid = new Grid(rows, cols);
  const cover = [];
  const sole = [];
  const blobAt = [];
  for (let r = 0; r < rows; r++) {
    const crow = [];
    const srow = [];
    const brow = [];
    for (let c = 0; c < cols; c++) {
      crow.push(0);
      srow.push(-1);
      brow.push(-1);
    }
    cover.push(crow);
    sole.push(srow);
    blobAt.push(brow);
  }
  const own = [];
  const blobSize = [];
  let nextBlob = 0;
  for (let i = 0; i < stamps.length; i++) {
    let open = blobSize.length > 0;
    for (let b = 0; b < blobSize.length; b++) {
      if (blobSize[b] < 3) open = false;
    }
    const wantNew = open && Math.random() < 0.5;
    const placed = GridBuilder.dropStamp(grid, stamps[i], i, i === 0, openSeat, wantNew, open, relax, cover, sole, blobAt, own, blobSize, nextBlob);
    if (!placed) return null;
    if (placed.blob === nextBlob) nextBlob++;
    blobSize[placed.blob] = (blobSize[placed.blob] || 0) + 1;
  }
  return { grid: grid, blobAt: blobAt };
};

GridBuilder.dropStamp = function (grid, kind, id, first, openSeat, wantNew, open, relax, cover, sole, blobAt, own, blobSize, nextBlob) {
  const rows = grid.rows;
  const cols = grid.cols;
  const cap = Math.floor(rows * cols * GridBuilder.RED_CAP);
  const shape = Grid.STAMP_DEFINITIONS[kind];
  const full = shape ? shape.w * shape.h : 0;
  const rowAnchors = [];
  const colAnchors = [];
  if (shape && shape.h & 1) {
    for (let r = 0; r < rows; r++) rowAnchors.push(r);
  } else if (rows > 1) {
    for (let r = 0; r < rows - 1; r++) rowAnchors.push(r + 0.5);
  }
  if (shape && shape.w & 1) {
    for (let c = 0; c < cols; c++) colAnchors.push(c);
  } else if (cols > 1) {
    for (let c = 0; c < cols - 1; c++) colAnchors.push(c + 0.5);
  }
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  const pools = {
    attach: { inner: [], edge: [], clipped: [] },
    free: { inner: [], edge: [], clipped: [] },
  };

  function consider(row, col) {
    const cells = Grid.footprint(rows, cols, kind, row, col);
    if (!cells.length) return;
    let fresh = 0;
    let overlap = 0;
    const lost = [];
    const touched = [];
    for (let i = 0; i < cells.length; i++) {
      const r = cells[i].r;
      const c = cells[i].c;
      if (cover[r][c] === 0) fresh++;
      else {
        overlap++;
        const blob = blobAt[r][c];
        if (touched.indexOf(blob) < 0) touched.push(blob);
        if (cover[r][c] === 1) {
          const owner = sole[r][c];
          lost[owner] = (lost[owner] || 0) + 1;
        }
      }
    }
    for (let i = 0; i < cells.length; i++) {
      for (let d = 0; d < 4; d++) {
        const rr = cells[i].r + dirs[d][0];
        const cc = cells[i].c + dirs[d][1];
        if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
        if (cover[rr][cc] === 0) continue;
        let inside = false;
        for (let k = 0; k < cells.length; k++) {
          if (cells[k].r === rr && cells[k].c === cc) {
            inside = true;
            break;
          }
        }
        if (inside) continue;
        const blob = blobAt[rr][cc];
        if (touched.indexOf(blob) < 0) touched.push(blob);
      }
    }
    if (fresh < 1) return;
    if (grid.redCount() + fresh > cap) return;
    for (let s = 0; s < id; s++) {
      if (own[s] - (lost[s] || 0) < 1) return;
    }
    let seat = "inner";
    if (cells.length < full) seat = "clipped";
    else {
      for (let i = 0; i < cells.length; i++) {
        const r = cells[i].r;
        const c = cells[i].c;
        if (r === 0 || c === 0 || r === rows - 1 || c === cols - 1) {
          seat = "edge";
          break;
        }
      }
    }
    const hit = { cells: cells, fresh: fresh };
    if (!touched.length) pools.free[seat].push(hit);
    else if (touched.length === 1 && (overlap > 0 || true)) pools.attach[seat].push(hit);
  }

  if (!rowAnchors.length || !colAnchors.length) return null;
  for (let t = 0; t < 180; t++) consider(rowAnchors[(Math.random() * rowAnchors.length) | 0], colAnchors[(Math.random() * colAnchors.length) | 0]);
  let bag = GridBuilder.pickBag(pools, first, openSeat, wantNew, open, relax);
  if (!bag || !bag.length) {
    pools.attach = { inner: [], edge: [], clipped: [] };
    pools.free = { inner: [], edge: [], clipped: [] };
    for (let ri = 0; ri < rowAnchors.length; ri++) {
      for (let ci = 0; ci < colAnchors.length; ci++) consider(rowAnchors[ri], colAnchors[ci]);
    }
    bag = GridBuilder.pickBag(pools, first, openSeat, wantNew, open, relax);
  }
  if (!bag || !bag.length) return null;
  const pick = bag[(Math.random() * bag.length) | 0];
  let blob = nextBlob;
  for (let i = 0; i < pick.cells.length; i++) {
    const r = pick.cells[i].r;
    const c = pick.cells[i].c;
    if (cover[r][c] > 0 && blobAt[r][c] >= 0) blob = blobAt[r][c];
  }
  own[id] = 0;
  for (let i = 0; i < pick.cells.length; i++) {
    const r = pick.cells[i].r;
    const c = pick.cells[i].c;
    const cell = grid.at(r, c);
    if (cover[r][c] === 0) {
      cover[r][c] = 1;
      sole[r][c] = id;
      blobAt[r][c] = blob;
      own[id]++;
      if (!cell.is("horde")) cell.setType("horde");
    } else if (cover[r][c] === 1) {
      own[sole[r][c]]--;
      sole[r][c] = -1;
      cover[r][c] = 2;
    } else cover[r][c]++;
  }
  if (own[id] < 1) return null;
  return { blob: blob };
};

GridBuilder.pickBag = function (pools, first, openSeat, wantNew, open, relax) {
  function weighted(group) {
    const seats = [
      ["inner", 2],
      ["edge", 2],
      ["clipped", 2],
    ];
    let total = 0;
    const bag = [];
    for (let i = 0; i < seats.length; i++) {
      if (!group[seats[i][0]].length) continue;
      total += seats[i][1];
      bag.push(seats[i]);
    }
    if (!total) return null;
    let roll = Math.random() * total;
    for (let i = 0; i < bag.length; i++) {
      roll -= bag[i][1];
      if (roll < 0) return group[bag[i][0]];
    }
    return group[bag[bag.length - 1][0]];
  }
  if (first) {
    if (openSeat === "edge" && pools.free.edge.length) return pools.free.edge;
    if (pools.free.inner.length) return pools.free.inner;
    if (relax && pools.free.edge.length) return pools.free.edge;
    return null;
  }
  if (wantNew) {
    if (pools.free.edge.length) return pools.free.edge;
    if (relax && pools.free.inner.length) return pools.free.inner;
  }
  const attached = weighted(pools.attach);
  if (attached) return attached;
  if (open && pools.free.edge.length) return pools.free.edge;
  return null;
};

GridBuilder.paintCities = function (grid) {
  const rows = grid.rows;
  const cols = grid.cols;
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!grid.at(r, c).is("grass")) continue;
      let redN = 0;
      for (let d = 0; d < 4; d++) {
        const cell = grid.at(r + dirs[d][0], c + dirs[d][1]);
        if (cell && cell.is("horde")) redN++;
      }
      if (redN >= 2) grid.at(r, c).setType("city");
    }
  }
  const open = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid.at(r, c).is("grass")) open.push({ r: r, c: c });
    }
  }
  GridBuilder.shuffle(open);
  for (let i = 0; i < open.length; i++) {
    const r = open[i].r;
    const c = open[i].c;
    if (!grid.at(r, c).is("grass")) continue;
    let clear = true;
    for (let rr = r - 2; rr <= r + 2 && clear; rr++) {
      for (let cc = c - 2; cc <= c + 2; cc++) {
        if (rr === r && cc === c) continue;
        const cell = grid.at(rr, cc);
        if (cell && (cell.is("horde") || cell.is("city"))) clear = false;
      }
    }
    if (clear) grid.at(r, c).setType("city");
  }
  const fringe = [];
  for (let i = 0; i < open.length; i++) {
    const r = open[i].r;
    const c = open[i].c;
    if (!grid.at(r, c).is("grass")) continue;
    let boxed = true;
    let clear = true;
    for (let d = 0; d < 4; d++) {
      const cell = grid.at(r + dirs[d][0], c + dirs[d][1]);
      if (cell && !cell.is("grass")) boxed = false;
    }
    for (let rr = r - 2; rr <= r + 2 && clear; rr++) {
      for (let cc = c - 2; cc <= c + 2; cc++) {
        if (rr === r && cc === c) continue;
        const cell = grid.at(rr, cc);
        if (cell && (cell.is("horde") || cell.is("city"))) clear = false;
      }
    }
    if (boxed && clear) fringe.push(open[i]);
  }
  let extra = 0;
  if (Math.random() < 0.55) extra = 1;
  if (Math.random() < 0.25) extra = 2;
  for (let i = 0; i < fringe.length && extra > 0; i++) {
    const r = fringe[i].r;
    const c = fringe[i].c;
    if (!grid.at(r, c).is("grass")) continue;
    let boxed = true;
    let clear = true;
    for (let d = 0; d < 4; d++) {
      const cell = grid.at(r + dirs[d][0], c + dirs[d][1]);
      if (cell && !cell.is("grass")) boxed = false;
    }
    for (let rr = r - 2; rr <= r + 2 && clear; rr++) {
      for (let cc = c - 2; cc <= c + 2; cc++) {
        if (rr === r && cc === c) continue;
        const cell = grid.at(rr, cc);
        if (cell && (cell.is("horde") || cell.is("city"))) clear = false;
      }
    }
    if (!boxed || !clear) continue;
    grid.at(r, c).setType("city");
    extra--;
  }
  const seen = [];
  for (let r = 0; r < rows; r++) seen.push([]);
  const redFlows = [2, 2, 3, 3, 3, 4, 4, 4];
  const fieldFlows = [0, 1, 1, 1, 2, 2, 2, 3];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (seen[r][c] || !grid.at(r, c).is("city")) continue;
      const blob = [{ r: r, c: c }];
      seen[r][c] = 1;
      let byRed = false;
      for (let i = 0; i < blob.length; i++) {
        for (let d = 0; d < 4; d++) {
          const rr = blob[i].r + dirs[d][0];
          const cc = blob[i].c + dirs[d][1];
          const cell = grid.at(rr, cc);
          if (!cell) continue;
          if (cell.is("horde")) byRed = true;
          if (!cell.is("city") || seen[rr][cc]) continue;
          seen[rr][cc] = 1;
          blob.push({ r: rr, c: cc });
        }
      }
      const bag = byRed ? redFlows : fieldFlows;
      const times = bag[(Math.random() * bag.length) | 0];
      for (let t = 0; t < times; t++) {
        const open = [];
        for (let i = 0; i < blob.length; i++) {
          for (let d = 0; d < 4; d++) {
            const rr = blob[i].r + dirs[d][0];
            const cc = blob[i].c + dirs[d][1];
            const cell = grid.at(rr, cc);
            if (!cell || !cell.is("grass")) continue;
            let dup = false;
            for (let k = 0; k < open.length; k++) {
              if (open[k].r === rr && open[k].c === cc) dup = true;
            }
            if (!dup) open.push({ r: rr, c: cc });
          }
        }
        if (!open.length) break;
        const pick = open[(Math.random() * open.length) | 0];
        let other = false;
        for (let d = 0; d < 4 && !other; d++) {
          const rr = pick.r + dirs[d][0];
          const cc = pick.c + dirs[d][1];
          const cell = grid.at(rr, cc);
          if (!cell || !cell.is("city")) continue;
          let own = false;
          for (let k = 0; k < blob.length; k++) {
            if (blob[k].r === rr && blob[k].c === cc) own = true;
          }
          if (!own) other = true;
        }
        if (other) break;
        grid.at(pick.r, pick.c).setType("city");
        blob.push(pick);
        seen[pick.r][pick.c] = 1;
      }
    }
  }
};

GridBuilder.shuffle = function (list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    const tmp = list[i];
    list[i] = list[j];
    list[j] = tmp;
  }
};
