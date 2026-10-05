/** Drop stamps, then backfill cities. Half random. */

function GridBuilder() {}

GridBuilder.RED_CAP = 0.66;

GridBuilder.build = function (plan) {
  const n = plan.size | 0;
  const stamps = plan.stamps && plan.stamps.length ? plan.stamps.slice() : ["3"];
  let grid = null;
  for (let attempt = 0; attempt < 24; attempt++) {
    grid = new Grid(n);
    let ok = true;
    for (let i = 0; i < stamps.length; i++) {
      const placed = GridBuilder.dropStamp(grid, stamps[i], i > 0);
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
  grid = new Grid(n);
  const mid = (n / 2) | 0;
  grid.apply([]);
  const seed = Grid.footprint(n, stamps[0] || "3", mid, mid);
  for (let i = 0; i < seed.length; i++) grid.at(seed[i].r, seed[i].c).setType("horde");
  GridBuilder.paintCities(grid, plan.cities | 0);
  grid.dress();
  return grid;
};

GridBuilder.dropStamp = function (grid, kind, needOverlap) {
  const n = grid.n;
  const cap = Math.floor(n * n * GridBuilder.RED_CAP);
  const passing = [];
  const loose = [];
  for (let t = 0; t < 90; t++) {
    const row = (Math.random() * n) | 0;
    const col = (Math.random() * n) | 0;
    const cells = Grid.footprint(n, kind, row, col);
    if (!cells.length) continue;
    let overlap = 0;
    let fresh = 0;
    for (let i = 0; i < cells.length; i++) {
      if (grid.at(cells[i].r, cells[i].c).is("horde")) overlap++;
      else fresh++;
    }
    const floor = cells.length < 3 ? 1 : kind === "col" ? 2 : 3;
    if (fresh < floor) continue;
    if (grid.redCount() + fresh > cap) continue;
    const hit = { cells: cells };
    if (!needOverlap || overlap > 0) passing.push(hit);
    else loose.push(hit);
  }
  const pool = passing.length ? passing : loose;
  if (!pool.length) return false;
  const pick = pool[(Math.random() * pool.length) | 0];
  for (let i = 0; i < pick.cells.length; i++) {
    const cell = grid.at(pick.cells[i].r, pick.cells[i].c);
    if (!cell.is("horde")) cell.setType("horde");
  }
  return true;
};

GridBuilder.paintCities = function (grid, count) {
  if (count < 1) return;
  const halo = [];
  const far = [];
  const n = grid.n;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
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
