/** Drop stamps from an inner start, then backfill cities. */

function GridBuilder() {}

GridBuilder.RED_CAP = 0.66;

GridBuilder.build = function (plan) {
  const rows = plan.rows | 0;
  const cols = plan.cols | 0;
  const stamps = plan.stamps && plan.stamps.length ? plan.stamps.slice() : ["33"];
  const cityN = plan.cities | 0;
  for (let attempt = 0; attempt < 36; attempt++) {
    const built = GridBuilder.dropAll(rows, cols, stamps, plan.open === "edge" ? "edge" : "inner", attempt > 24);
    if (!built) continue;
    GridBuilder.paintCities(built.grid, cityN, built.blobAt);
    built.grid.dress();
    return built.grid;
  }
  const built = GridBuilder.dropAll(rows, cols, stamps, plan.open === "edge" ? "edge" : "inner", true);
  const grid = built ? built.grid : new Grid(rows, cols);
  if (!built) {
    const midR = (rows / 2) | 0;
    const midC = (cols / 2) | 0;
    const seed = Grid.footprint(rows, cols, stamps[0] || "33", midR, midC);
    for (let i = 0; i < seed.length; i++) grid.at(seed[i].r, seed[i].c).setType("horde");
  }
  GridBuilder.paintCities(grid, cityN, built ? built.blobAt : null);
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
  const shape = Grid.SHAPES[kind];
  const full = shape ? shape.w * shape.h : 0;
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

  for (let t = 0; t < 180; t++) consider((Math.random() * rows) | 0, (Math.random() * cols) | 0);
  let bag = GridBuilder.pickBag(pools, first, openSeat, wantNew, open, relax);
  if (!bag || !bag.length) {
    pools.attach = { inner: [], edge: [], clipped: [] };
    pools.free = { inner: [], edge: [], clipped: [] };
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) consider(row, col);
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

GridBuilder.paintCities = function (grid, count, blobAt) {
  if (count < 1) return;
  const rows = grid.rows;
  const cols = grid.cols;
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  const taken = [];
  function spaced(r, c) {
    for (let i = 0; i < taken.length; i++) {
      let dr = r - taken[i].r;
      let dc = c - taken[i].c;
      if (dr < 0) dr = -dr;
      if (dc < 0) dc = -dc;
      if ((dr > dc ? dr : dc) < 2) return false;
    }
    return true;
  }
  function redNeighbors(r, c) {
    let n = 0;
    for (let d = 0; d < 4; d++) {
      const cell = grid.at(r + dirs[d][0], c + dirs[d][1]);
      if (cell && cell.is("horde")) n++;
    }
    return n;
  }
  const pocket = [];
  const bay = [];
  const tip = [];
  const halo = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!grid.at(r, c).is("grass")) continue;
      const blobs = [];
      let redN = 0;
      let tipTouch = false;
      for (let d = 0; d < 4; d++) {
        const rr = r + dirs[d][0];
        const cc = c + dirs[d][1];
        const cell = grid.at(rr, cc);
        if (!cell || !cell.is("horde")) continue;
        redN++;
        if (redNeighbors(rr, cc) <= 1) tipTouch = true;
        if (blobAt) {
          const blob = blobAt[rr][cc];
          if (blob >= 0 && blobs.indexOf(blob) < 0) blobs.push(blob);
        }
      }
      if (!redN) continue;
      const spot = { r: r, c: c };
      if (redN >= 4) pocket.push(spot);
      else if (blobs.length > 1) bay.push(spot);
      else if (redN >= 3) bay.push(spot);
      else if (tipTouch) tip.push(spot);
      else halo.push(spot);
    }
  }
  GridBuilder.shuffle(pocket);
  GridBuilder.shuffle(bay);
  GridBuilder.shuffle(tip);
  GridBuilder.shuffle(halo);
  const struct = pocket.concat(bay, tip);
  const structN = (count + 1) >> 1;
  let placed = 0;
  for (let i = 0; i < struct.length && placed < structN; i++) {
    if (!spaced(struct[i].r, struct[i].c)) continue;
    grid.at(struct[i].r, struct[i].c).setType("city");
    taken.push(struct[i]);
    placed++;
  }
  const rest = halo.concat(struct);
  for (let i = 0; i < rest.length && placed < count; i++) {
    if (!grid.at(rest[i].r, rest[i].c).is("grass")) continue;
    if (!spaced(rest[i].r, rest[i].c)) continue;
    grid.at(rest[i].r, rest[i].c).setType("city");
    taken.push(rest[i]);
    placed++;
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
