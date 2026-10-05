/** Drop stamps, then backfill cities. Half random. */

function GridBuilder() {}

GridBuilder.RED_CAP = 0.66;

GridBuilder.build = function (plan) {
  const rows = plan.rows | 0;
  const cols = plan.cols | 0;
  const stamps = plan.stamps && plan.stamps.length ? plan.stamps.slice() : ["3"];
  let grid = null;
  for (let attempt = 0; attempt < 24; attempt++) {
    grid = new Grid(rows, cols);
    const cover = [];
    const sole = [];
    for (let r = 0; r < rows; r++) {
      const crow = [];
      const srow = [];
      for (let c = 0; c < cols; c++) {
        crow.push(0);
        srow.push(-1);
      }
      cover.push(crow);
      sole.push(srow);
    }
    const own = [];
    let ok = true;
    for (let i = 0; i < stamps.length; i++) {
      const placed = GridBuilder.dropStamp(grid, stamps[i], i, i > 0, cover, sole, own);
      if (!placed) {
        ok = false;
        break;
      }
    }
    if (!ok || grid.redCount() < 1) continue;
    GridBuilder.paintCities(grid, plan.cities | 0);
    grid.dress();
    return grid;
  }
  grid = new Grid(rows, cols);
  const midR = (rows / 2) | 0;
  const midC = (cols / 2) | 0;
  const seed = Grid.footprint(rows, cols, stamps[0] || "3", midR, midC);
  for (let i = 0; i < seed.length; i++) grid.at(seed[i].r, seed[i].c).setType("horde");
  GridBuilder.paintCities(grid, plan.cities | 0);
  grid.dress();
  return grid;
};

GridBuilder.dropStamp = function (grid, kind, id, needOverlap, cover, sole, own) {
  const rows = grid.rows;
  const cols = grid.cols;
  const cap = Math.floor(rows * cols * GridBuilder.RED_CAP);
  const passing = [];
  const loose = [];
  for (let t = 0; t < 140; t++) {
    const row = (Math.random() * rows) | 0;
    const col = (Math.random() * cols) | 0;
    const cells = Grid.footprint(rows, cols, kind, row, col);
    if (!cells.length) continue;
    let overlap = 0;
    let fresh = 0;
    const lost = [];
    for (let i = 0; i < cells.length; i++) {
      const r = cells[i].r;
      const c = cells[i].c;
      if (cover[r][c] === 0) fresh++;
      else {
        overlap++;
        if (cover[r][c] === 1) {
          const owner = sole[r][c];
          lost[owner] = (lost[owner] || 0) + 1;
        }
      }
    }
    const floor = cells.length < 3 ? 1 : kind === "col" ? 2 : 3;
    if (fresh < floor) continue;
    if (grid.redCount() + fresh > cap) continue;
    let keeps = true;
    for (let s = 0; s < id; s++) {
      const left = own[s] - (lost[s] || 0);
      const need = own[s] < 2 ? 1 : 2;
      if (left < need) {
        keeps = false;
        break;
      }
    }
    if (!keeps) continue;
    const hit = { cells: cells };
    if (!needOverlap || overlap > 0) passing.push(hit);
    else loose.push(hit);
  }
  const pool = passing.length ? passing : loose;
  if (!pool.length) return false;
  const pick = pool[(Math.random() * pool.length) | 0];
  own[id] = 0;
  for (let i = 0; i < pick.cells.length; i++) {
    const r = pick.cells[i].r;
    const c = pick.cells[i].c;
    const cell = grid.at(r, c);
    if (cover[r][c] === 0) {
      cover[r][c] = 1;
      sole[r][c] = id;
      own[id]++;
      if (!cell.is("horde")) cell.setType("horde");
    } else if (cover[r][c] === 1) {
      own[sole[r][c]]--;
      sole[r][c] = -1;
      cover[r][c] = 2;
    } else cover[r][c]++;
  }
  return true;
};

GridBuilder.paintCities = function (grid, count) {
  if (count < 1) return;
  const halo = [];
  const far = [];
  const rows = grid.rows;
  const cols = grid.cols;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!grid.at(r, c).is("grass")) continue;
      let near = false;
      for (let dr = -1; dr <= 1 && !near; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const other = grid.at(r + dr, c + dc);
          if (other && other.is("horde")) near = true;
        }
      }
      (near ? halo : far).push({ r: r, c: c });
    }
  }
  GridBuilder.shuffle(halo);
  GridBuilder.shuffle(far);
  const spots = halo.concat(far);
  const take = count < spots.length ? count : spots.length;
  for (let i = 0; i < take; i++) grid.at(spots[i].r, spots[i].c).setType("city");
};

GridBuilder.shuffle = function (list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    const tmp = list[i];
    list[i] = list[j];
    list[j] = tmp;
  }
};
