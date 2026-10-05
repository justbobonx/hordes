/** Drop stamps, then backfill cities. Half random. */

function GridBuilder() {}

GridBuilder.RED_CAP = 0.66;

GridBuilder.build = function (plan) {
  const rows = plan.rows | 0;
  const cols = plan.cols | 0;
  const stamps = plan.stamps && plan.stamps.length ? plan.stamps.slice() : ["3"];
  const seats = plan.seats || [];
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
      const placed = GridBuilder.dropStamp(grid, stamps[i], i, i > 0, cover, sole, own, seats[i]);
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

GridBuilder.dropStamp = function (grid, kind, id, needOverlap, cover, sole, own, want) {
  const rows = grid.rows;
  const cols = grid.cols;
  const cap = Math.floor(rows * cols * GridBuilder.RED_CAP);
  const pools = { inner: [], edge: [], clipped: [] };
  const loose = { inner: [], edge: [], clipped: [] };
  function consider(row, col, into) {
    const cells = Grid.footprint(rows, cols, kind, row, col);
    if (!cells.length) return;
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
    if (fresh < floor) return;
    if (grid.redCount() + fresh > cap) return;
    let keeps = true;
    for (let s = 0; s < id; s++) {
      const left = own[s] - (lost[s] || 0);
      const need = own[s] < 2 ? 1 : 2;
      if (left < need) {
        keeps = false;
        break;
      }
    }
    if (!keeps) return;
    let seat = "edge";
    if (kind !== "col") {
      const rad = kind === "5" ? 2 : 1;
      const full = (rad * 2 + 1) * (rad * 2 + 1);
      if (cells.length < full) seat = "clipped";
      else {
        seat = "inner";
        for (let i = 0; i < cells.length; i++) {
          const r = cells[i].r;
          const c = cells[i].c;
          if (r === 0 || c === 0 || r === rows - 1 || c === cols - 1) {
            seat = "edge";
            break;
          }
        }
      }
    }
    const hit = { cells: cells };
    if (!needOverlap || overlap > 0) into[seat].push(hit);
    else loose[seat].push(hit);
  }
  for (let t = 0; t < 140; t++) {
    consider((Math.random() * rows) | 0, (Math.random() * cols) | 0, pools);
  }
  if ((want === "inner" || want === "edge" || want === "clipped") && !pools[want].length) {
    const found = { inner: [], edge: [], clipped: [] };
    for (let row = 0; row < rows && found[want].length < 8; row++) {
      for (let col = 0; col < cols && found[want].length < 8; col++) consider(row, col, found);
    }
    pools[want] = found[want];
  }
  const order = want === "inner" || want === "edge" || want === "clipped" ? [want, "inner", "edge", "clipped"] : ["inner", "edge", "clipped"];
  let bag = null;
  if (want) {
    for (let i = 0; i < order.length; i++) {
      if (pools[order[i]].length) {
        bag = pools[order[i]];
        break;
      }
    }
  } else {
    const open = [];
    for (let i = 0; i < order.length; i++) if (pools[order[i]].length) open.push(pools[order[i]]);
    if (open.length) bag = open[(Math.random() * open.length) | 0];
  }
  if (!bag) {
    for (let i = 0; i < order.length; i++) {
      if (loose[order[i]].length) {
        bag = loose[order[i]];
        break;
      }
    }
  }
  if (!bag || !bag.length) return false;
  const pick = bag[(Math.random() * bag.length) | 0];
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
