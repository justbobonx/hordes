/** Drop stamps, then dress grass with towns. The blob stays red. */

const THIN_CELL_WEIGHTS = {
  0: 0,
  1: 0.1,
  2: 1.5,
  3: 1.2,
  4: 1.0  
};

// Plan centered 0..1 maps onto this scoring range (0.25 stays neutral).
const CENTERED_SCORE_MIN = -0.5;
const CENTERED_SCORE_MAX = 1.5;
const CENTERED_DEFAULT = 0.4;
const FLUSH_SCORE_MAX = 1.5;
const FLUSH_DEFAULT = 0.6;
const THIN_DEFAULT = 0.45;
const MIN_BLOB_SIZE = 3;
const CROP_PAD = 3;

function GridBuilder() {}

GridBuilder.rand = function () {
  return GridBuilder._rng ? GridBuilder._rng() : Math.random();
};

GridBuilder.build = function (plan) {
  const prev = GridBuilder._rng;
  if (plan && plan.seed != null) {
    GridBuilder._rng = mulberry32(plan.seed);
  } else {
    GridBuilder._rng = null;
  }
  try {
    return GridBuilder._build(plan);
  } finally {
    GridBuilder._rng = prev;
  }
};

GridBuilder._build = function (plan) {
  const rows = plan.rows | 0;
  const cols = plan.cols | 0;
  const stamps = plan.stamps && plan.stamps.length ? plan.stamps.slice() : ["33"];
  let openSeat = plan.open;
  if (openSeat !== "edge" && openSeat !== "clipped" && openSeat !== "inner" && openSeat !== "any") openSeat = "any";
  let centered = plan.centered;
  if (centered === undefined || centered === null || centered === "") centered = 0.5;
  centered = +centered;
  if (centered !== centered) centered = CENTERED_DEFAULT;
  if (centered < 0) centered = 0;
  if (centered > 1) centered = 1;
  let flush = plan.flush;
  if (flush === undefined || flush === null || flush === "") flush = plan.tight;
  if (flush === undefined || flush === null || flush === "") flush = FLUSH_DEFAULT;
  flush = +flush;
  if (flush !== flush) flush = FLUSH_DEFAULT;
  if (flush < 0) flush = 0;
  if (flush > 1) flush = 1;
  let thin = plan.thin;
  if (thin === undefined || thin === null || thin === "") thin = 0.2;
  thin = +thin;
  if (thin !== thin) thin = THIN_DEFAULT;
  if (thin < 0) thin = 0;
  if (thin > 1) thin = 1;
  for (let attempt = 0; attempt < 36; attempt++) {
    const built = GridBuilder.dropAll(rows, cols, stamps, openSeat, flush, centered, plan.fuelChance || 0, plan.overlap || 0, plan.stronger || 0);
    if (!built) continue;
    GridBuilder.paintCities(built.grid, stamps.length);
    GridBuilder.thin(built.grid, built.cover, built.sole, built.own, built.uniqueMin, thin);
    GridBuilder.promote(built.grid, built.cover, built.stampsOn, built.strongCount, plan.stronger || 0);
    built.grid.pieces = built.pieces || [];
    built.grid.dress();
    return GridBuilder.cropEmptyRim(built.grid, plan);
  }
  const built = GridBuilder.dropAll(rows, cols, stamps, openSeat, flush, centered, plan.fuelChance || 0, plan.overlap || 0, plan.stronger || 0);
  const grid = built ? built.grid : new Grid(rows, cols);
  if (!built) {
    const kind = stamps[0] || "33";
    const shape = Grid.STAMP_DEFINITIONS[kind];
    let midR = (rows / 2) | 0;
    let midC = (cols / 2) | 0;
    if (shape && !(shape.h & 1)) midR = Math.min(rows - 1.5, Math.max(0.5, midR - 0.5));
    if (shape && !(shape.w & 1)) midC = Math.min(cols - 1.5, Math.max(0.5, midC - 0.5));
    const fp = Footprint.fromStamp(rows, cols, kind, midR, midC);
    grid.pieces = [];
    if (fp) {
      for (let i = 0; i < fp.cells.length; i++) grid.at(fp.cells[i].r, fp.cells[i].c).setType("horde");
      fp.boardId = 0;
      grid.pieces.push(fp);
    }
  } else {
    GridBuilder.paintCities(grid, stamps.length);
    GridBuilder.thin(grid, built.cover, built.sole, built.own, built.uniqueMin, thin);
    GridBuilder.promote(grid, built.cover, built.stampsOn, built.strongCount, plan.stronger || 0);
    grid.pieces = built.pieces || [];
  }
  if (!built) GridBuilder.paintCities(grid, stamps.length);
  grid.dress();
  return GridBuilder.cropEmptyRim(grid, plan);
};

GridBuilder.dropAll = function (rows, cols, stamps, openSeat, flush, centered, fuelChance, overlap, stronger) {
  const grid = new Grid(rows, cols);
  const cover = [];
  const sole = [];
  const blobAt = [];
  const stampsOn = [];
  for (let r = 0; r < rows; r++) {
    const crow = [];
    const srow = [];
    const brow = [];
    const son = [];
    for (let c = 0; c < cols; c++) {
      crow.push(0);
      srow.push(-1);
      brow.push(-1);
      son.push([]);
    }
    cover.push(crow);
    sole.push(srow);
    blobAt.push(brow);
    stampsOn.push(son);
  }
  const own = [];
  const uniqueMin = [];
  const strongCount = [];
  const blobSize = [];
  const pieces = [];
  let nextBlob = 0;
  let nextId = 0;
  for (let i = 0; i < stamps.length; i++) {
    let small = false;
    let deficit = 0;
    for (let b = 0; b < blobSize.length; b++) {
      if (!blobSize[b]) continue;
      if (blobSize[b] < MIN_BLOB_SIZE) {
        small = true;
        deficit += MIN_BLOB_SIZE - blobSize[b];
      }
    }
    const left = stamps.length - i;
    const canNew = left >= deficit + MIN_BLOB_SIZE;
    const wantNew = i > 0 && canNew && GridBuilder.rand() < 0.5;
    const stampId = nextId;
    const placed = GridBuilder.dropStamp(grid, stamps[i], stampId, i === 0, openSeat, wantNew, small, flush, centered, cover, sole, blobAt, own, uniqueMin, strongCount, blobSize, nextBlob, stampsOn, overlap);
    if (!placed) return null;
    if (placed.fp) { placed.fp.boardId = pieces.length; pieces.push(placed.fp); }
    if (placed.spawned) nextBlob++;
    nextId++;
    // fuel chain after this stamp
    let lastId = stampId;
    let lastAnchor = { r: placed.row, c: placed.col };
    let lastSole = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (sole[r][c] === lastId) lastSole.push({ r: r, c: c });
      }
    }
    while (fuelChance > 0 && GridBuilder.rand() < fuelChance && lastSole.length) {
      const fuel = GridBuilder.tryPlaceFuel(grid, lastId, lastSole, lastAnchor, cover, sole, blobAt, own, uniqueMin, strongCount, blobSize, nextBlob, stampsOn, overlap, nextId, rows, cols);
      if (!fuel) break;
      if (fuel.fp) { fuel.fp.boardId = pieces.length; pieces.push(fuel.fp); }
      lastId = fuel.id;
      lastAnchor = fuel.anchor;
      lastSole = fuel.soleCells;
      if (fuel.spawned) nextBlob++;
      nextId++;
    }
  }
  return { grid: grid, blobAt: blobAt, pieces: pieces, cover: cover, sole: sole, own: own, uniqueMin: uniqueMin, strongCount: strongCount, stampsOn: stampsOn };
};

GridBuilder.thin = function (grid, cover, sole, own, uniqueMin, thin) {
  if (!thin || thin <= 0 || !cover || !sole || !own || !uniqueMin) return;
  const rows = grid.rows;
  const cols = grid.cols;
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  function grassCount(r, c) {
    let n = 0;
    for (let d = 0; d < 4; d++) {
      const rr = r + dirs[d][0];
      const cc = c + dirs[d][1];
      if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
      if (grid.at(rr, cc).is("grass")) n++;
    }
    return n;
 }
  const remaining = [];
  for (let s = 0; s < own.length; s++) remaining[s] = Math.max(0, (own[s] || 0) - (uniqueMin[s] || 0));
  let initial = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!grid.at(r, c).is("horde")) continue;
      const g = grassCount(r, c);
      if (g < 1) continue;
      if (cover[r][c] >= 2) initial++;
      else if (cover[r][c] === 1 && remaining[sole[r][c]] > 0) initial++;
    }
  }
  const target = Math.round(initial * thin * 0.9);
  if (target < 1) return;
  for (let removed = 0; removed < target; removed++) {
    const eligible = [];
    let total = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!grid.at(r, c).is("horde")) continue;
        const g = grassCount(r, c);
        if (g < 1) continue;
        let allowed = false;
        if (cover[r][c] >= 2) allowed = true;
        else if (cover[r][c] === 1 && remaining[sole[r][c]] > 0) allowed = true;
        if (!allowed) continue;
        const w = THIN_CELL_WEIGHTS[g];
        if (w <= 0) continue;
        eligible.push({ r: r, c: c, w: w });
        total += w;
      }
    }
    if (!eligible.length || total <= 0) break;
    let roll = GridBuilder.rand() * total;
    let pick = eligible[eligible.length - 1];
    for (let i = 0; i < eligible.length; i++) {
      roll -= eligible[i].w;
      if (roll <= 0) {
        pick = eligible[i];
        break;
      }
    }
    grid.at(pick.r, pick.c).setType("grass");
    if (cover[pick.r][pick.c] === 1) remaining[sole[pick.r][pick.c]]--;
  }
};


// Shared safety check for a concrete footprint.
// Same rules a normal stamp uses: size, fresh minimum, uniqueMin protection for every earlier piece.
// Returns {fresh, need} or null.
// uniqueMinVal is original keep (full - ss). overlap scales the keep used for placement constraints.
GridBuilder.legalFootprint = function (cells, id, uniqueMinVal, overlap, cover, sole, own, uniqueMin) {
  if (!cells || !cells.length || !uniqueMinVal) return null;
  const ov = overlap || 0;
  const adjustedKeep = uniqueMinVal * (1 - ov);
  let fresh = 0;
  const lost = [];
  for (let i = 0; i < cells.length; i++) {
    const r = cells[i].r;
    const c = cells[i].c;
    if (cover[r][c] === 0) fresh++;
    else if (cover[r][c] === 1) {
      const owner = sole[r][c];
      if (owner >= 0) lost[owner] = (lost[owner] || 0) + 1;
    }
  }
  if (cells.length < uniqueMinVal) return null;
  const need = adjustedKeep;
  if (fresh < need) return null;
  for (let s = 0; s < id; s++) {
    const prevKeep = (uniqueMin[s] || 0) * (1 - ov);
    if ((own[s] || 0) - (lost[s] || 0) < prevKeep) return null;
  }
  return { fresh: fresh, need: need };
};

// Shared commit. Writes cover/sole/own/blob/type exactly as a normal stamp.
// fuelCell ({r,c} or null): that one cell becomes fuel, everything else horde.
// joinBlob: blob to join, or nextBlob to spawn. hits: other blobs to merge in.
// Returns {spawned, soleCells} .
GridBuilder.commitPiece = function (grid, cells, id, uniqueMinVal, strongN, joinBlob, hits, nextBlob, cover, sole, blobAt, own, uniqueMin, strongCount, blobSize, stampsOn, fuelCell) {
  const rows = grid.rows;
  const cols = grid.cols;
  let keeper = joinBlob;
  let spawned = keeper === nextBlob;
  if (hits && hits.length) {
    spawned = false;
    if (hits.indexOf(keeper) < 0) keeper = hits[0];
    for (let h = 0; h < hits.length; h++) {
      const other = hits[h];
      if (other === keeper) continue;
      blobSize[keeper] = (blobSize[keeper] || 0) + (blobSize[other] || 0);
      blobSize[other] = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (blobAt[r][c] === other) blobAt[r][c] = keeper;
        }
      }
    }
  }
  blobSize[keeper] = (blobSize[keeper] || 0) + 1;
  uniqueMin[id] = uniqueMinVal;
  strongCount[id] = strongN;
  own[id] = 0;
  const soleCells = [];
  for (let i = 0; i < cells.length; i++) {
    const r = cells[i].r;
    const c = cells[i].c;
    const cell = grid.at(r, c);
    const isFuel = fuelCell && r === fuelCell.r && c === fuelCell.c;
    stampsOn[r][c].push(id);
    if (cover[r][c] === 0) {
      cover[r][c] = 1;
      sole[r][c] = id;
      blobAt[r][c] = keeper;
      own[id]++;
      soleCells.push({ r: r, c: c });
      if (!cell.is("horde") && !cell.is("fuel")) cell.setType(isFuel ? "fuel" : "horde");
      else if (isFuel) cell.setType("fuel");
    } else if (cover[r][c] === 1) {
      own[sole[r][c]]--;
      sole[r][c] = -1;
      cover[r][c] = 2;
      blobAt[r][c] = keeper;
      if (isFuel) cell.setType("fuel");
    } else {
      cover[r][c]++;
      blobAt[r][c] = keeper;
      if (isFuel) cell.setType("fuel");
    }
  }
  return { spawned: spawned, soleCells: soleCells };
};

GridBuilder.dropStamp = function (grid, kind, id, first, openSeat, wantNew, small, flush, centered, cover, sole, blobAt, own, uniqueMin, strongCount, blobSize, nextBlob, stampsOn, overlap) {
  const rows = grid.rows;
  const cols = grid.cols;
  const shape = Grid.STAMP_DEFINITIONS[kind];
  const full = shape.w * shape.h;
  const ss = Math.min(shape.w, shape.h);
  const uniqueMinVal = full - ss;
  const ov = overlap || 0;
  let strongN = uniqueMinVal * ov; // floor from original keep * overlap
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
  const midR = (rows - 1) / 2;
  const midC = (cols - 1) / 2;
  const span = Math.sqrt(midR * midR + midC * midC) || 1;
  const legal = [];

  function near(r, c, tr, tc) {
    const dr = r - tr;
    const dc = c - tc;
    const dist = Math.sqrt(dr * dr + dc * dc) / span;
    return dist > 1 ? 0 : 1 - dist;
  }

  function consider(row, col) {
    const fp = Footprint.fromStamp(rows, cols, kind, row, col);
    if (!fp || !fp.cells.length || !full) return;
    const cells = fp.cells;
    let fresh = 0;
    let freshR = 0;
    let freshC = 0;
    const touch = [];
    function mark(blob, r, c) {
      if (blob < 0) return;
      if (!touch[blob]) touch[blob] = [];
      const key = r + "," + c;
      if (touch[blob].indexOf(key) < 0) touch[blob].push(key);
    }
    for (let i = 0; i < cells.length; i++) {
      const r = cells[i].r;
      const c = cells[i].c;
      if (cover[r][c] === 0) {
        fresh++;
        freshR += r;
        freshC += c;
      } else {
        mark(blobAt[r][c], r, c);
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
          if (cells[k].r === rr && cells[k].c === cc) inside = true;
        }
        if (!inside) mark(blobAt[rr][cc], rr, cc);
      }
    }
    const check = GridBuilder.legalFootprint(cells, id, uniqueMinVal, overlap, cover, sole, own, uniqueMin);
    if (!check) return;
    const need = check.need;
    const hits = [];
    const grazes = [];
    let join = -1;
    for (let b = 0; b < touch.length; b++) {
      if (!touch[b] || !touch[b].length) continue;
      grazes.push(b);
      if (touch[b].length < 2) continue;
      hits.push(b);
      if (join < 0) join = b;
      if (small && blobSize[b] && blobSize[b] < MIN_BLOB_SIZE) join = b;
    }
    if (first) {
      let edge = false;
      for (let i = 0; i < cells.length; i++) {
        const r = cells[i].r;
        const c = cells[i].c;
        if (r === 0 || c === 0 || r === rows - 1 || c === cols - 1) edge = true;
      }
      if (openSeat === "clipped") {
        if (cells.length >= full) return;
      } else if (openSeat === "edge") {
        if (!edge) return;
      } else if (openSeat === "inner") {
        if (edge) return;
      }
      legal.push({ cells: cells, hits: [], join: nextBlob, fr: fresh ? freshR / fresh : 0, fc: fresh ? freshC / fresh : 0, row: row, col: col, need: need });
      return;
    }
    if (wantNew) {
      legal.push({ cells: cells, hits: grazes, join: grazes.length ? grazes[0] : nextBlob, fr: fresh ? freshR / fresh : 0, fc: fresh ? freshC / fresh : 0, row: row, col: col, need: need });
      return;
    }
    if (join < 0) return;
    if (small && !(blobSize[join] && blobSize[join] < MIN_BLOB_SIZE)) return;
    legal.push({ cells: cells, hits: hits, join: join, fr: fresh ? freshR / fresh : 0, fc: fresh ? freshC / fresh : 0, row: row, col: col, need: need });
  }

  function flushOf(seat) {
    if (first || wantNew || seat.join === nextBlob) return 1;
    const hit = [];
    const sources = seat.hits && seat.hits.length ? seat.hits : [seat.join];
    for (let h = 0; h < sources.length; h++) hit[sources[h]] = 1;
    const cells = seat.cells;
    const inNew = {};
    let minR = rows;
    let maxR = 0;
    let minC = cols;
    let maxC = 0;
    for (let i = 0; i < cells.length; i++) {
      const r = cells[i].r;
      const c = cells[i].c;
      inNew[r + "," + c] = 1;
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
      if (c < minC) minC = c;
      if (c > maxC) maxC = c;
    }
    const spanH = maxR - minR + 1;
    const spanW = maxC - minC + 1;
    const vert = {};
    const horiz = {};
    function add(map, key, at) {
      if (!map[key]) map[key] = [];
      map[key].push(at);
    }
    for (let i = 0; i < cells.length; i++) {
      const r = cells[i].r;
      const c = cells[i].c;
      if (blobAt[r][c] >= 0 && hit[blobAt[r][c]]) {
        add(vert, "o" + c, r);
        add(horiz, "o" + r, c);
      }
      for (let d = 0; d < 4; d++) {
        const rr = r + dirs[d][0];
        const cc = c + dirs[d][1];
        if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
        if (inNew[rr + "," + cc]) continue;
        if (blobAt[rr][cc] < 0 || !hit[blobAt[rr][cc]]) continue;
        if (rr !== r) add(horiz, "a" + r + ":" + rr, c);
        else add(vert, "a" + c + ":" + cc, r);
      }
    }
    function longest(map) {
      let best = 0;
      const keys = Object.keys(map);
      for (let k = 0; k < keys.length; k++) {
        const list = map[keys[k]];
        list.sort(function (a, b) {
          return a - b;
        });
        let run = 1;
        for (let i = 1; i < list.length; i++) {
          if (list[i] === list[i - 1]) continue;
          if (list[i] === list[i - 1] + 1) run++;
          else {
            if (run > best) best = run;
            run = 1;
          }
        }
        if (run > best) best = run;
      }
      return best;
    }
    const vRun = longest(vert);
    const hRun = longest(horiz);
    let flush = 0;
    if (spanH && vRun / spanH > flush) flush = vRun / spanH;
    if (spanW && hRun / spanW > flush) flush = hRun / spanW;
    if (flush > 1) flush = 1;
    return flush;
  }

  if (!rowAnchors.length || !colAnchors.length) return null;
  for (let ri = 0; ri < rowAnchors.length; ri++) {
    for (let ci = 0; ci < colAnchors.length; ci++) consider(rowAnchors[ri], colAnchors[ci]);
  }
  if (!legal.length) return null;
  let total = 0;
  for (let i = 0; i < legal.length; i++) {
    const seat = legal[i];
    const affinity = near(seat.fr, seat.fc, midR, midC);
    // Plan centered maps to signed strength; zero leaves seats flat, positive
    // pulls middle, negative pulls rim.
    const centerStrength = CENTERED_SCORE_MIN + centered * (CENTERED_SCORE_MAX - CENTERED_SCORE_MIN);
    const centerTerm = 1 + centerStrength * (2 * affinity - 1);
    const flushScore = flushOf(seat);
    // Stretch flush preference so a flush seat can outweigh a neutral spot.
    const stretchedFlush = flushScore * FLUSH_SCORE_MAX;
    const noise = 0.6 + GridBuilder.rand() * 0.4;
    seat.weight = centerTerm * ((1 - flush) + flush * stretchedFlush) * noise;
    if (seat.weight < 0.05) seat.weight = 0.05;
    total += seat.weight;
  }
  let roll = GridBuilder.rand() * total;
  let pick = legal[legal.length - 1];
  for (let i = 0; i < legal.length; i++) {
    roll -= legal[i].weight;
    if (roll <= 0) {
      pick = legal[i];
      break;
    }
  }
  const committed = GridBuilder.commitPiece(grid, pick.cells, id, uniqueMinVal, strongN, pick.join, pick.hits, nextBlob, cover, sole, blobAt, own, uniqueMin, strongCount, blobSize, stampsOn, null);
  if (!committed || own[id] < (pick.need || 0)) return null;
  const fp = Footprint.fromStamp(rows, cols, kind, pick.row, pick.col);
  if (fp) { fp.uniqueMin = uniqueMinVal; fp.need = pick.need !== undefined ? pick.need : uniqueMinVal; fp.strongN = strongN; }
  return { spawned: committed.spawned, row: pick.row, col: pick.col, fp: fp };
};

GridBuilder.paintCities = function (grid, np) {
  const rows = grid.rows;
  const cols = grid.cols;
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  np = np | 0;
  if (np < 2) np = 2;

  // 1. Horde crook seeds
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
  let p1 = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid.at(r, c).is("city")) p1++;
    }
  }

  // 2. Horde rim seeds
  const rim = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!grid.at(r, c).is("grass")) continue;
      let redN = 0;
      for (let d = 0; d < 4; d++) {
        const cell = grid.at(r + dirs[d][0], c + dirs[d][1]);
        if (cell && cell.is("horde")) redN++;
      }
      if (redN >= 1) rim.push({ r: r, c: c });
    }
  }
  GridBuilder.shuffle(rim);
  const minRim = Math.max(0, ((np / 2) | 0) - p1);
  const maxRim = Math.max(2, np * 2 - p1);
  const targetRim = minRim + ((GridBuilder.rand() * (maxRim - minRim + 1)) | 0);
  let placedRim = 0;
  for (let i = 0; i < rim.length && placedRim < targetRim; i++) {
    const r = rim[i].r;
    const c = rim[i].c;
    if (!grid.at(r, c).is("grass")) continue;
    let adjCity = false;
    for (let d = 0; d < 4; d++) {
      const cell = grid.at(r + dirs[d][0], c + dirs[d][1]);
      if (cell && cell.is("city")) adjCity = true;
    }
    if (adjCity) continue;
    grid.at(r, c).setType("city");
    placedRim++;
  }

  // 3. Fringe seeds
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

  // 4. Seed blob growth
  const seen = [];
  for (let r = 0; r < rows; r++) seen.push([]);
  const redFlows = [1, 2, 3, 4];
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
      const times = bag[(GridBuilder.rand() * bag.length) | 0];
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
        const pick = open[(GridBuilder.rand() * open.length) | 0];
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

GridBuilder.tryPlaceFuel = function (grid, prevId, candidates, prevAnchor, cover, sole, blobAt, own, uniqueMin, strongCount, blobSize, nextBlob, stampsOn, overlap, nextId, rows, cols) {
  // Fuel is a 3x3 stamp. Candidates come from the last piece's sole cells.
  // Each candidate produces one footprint via fuelFootprint; that footprint
  // then faces the same legality and commit path a normal stamp uses.
  const FUEL_FULL = 9;
  const FUEL_SS = 3;
  const uniqueMinVal = FUEL_FULL - FUEL_SS;
  const ov = overlap || 0;
  let strongN = uniqueMinVal * ov; // floor from original keep * overlap

  const order = candidates.slice();
  GridBuilder.shuffle(order);

  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const legal = [];
  for (let ci = 0; ci < order.length; ci++) {
    const fuelCell = order[ci];
    if (cover[fuelCell.r][fuelCell.c] !== 1 || sole[fuelCell.r][fuelCell.c] !== prevId) continue;
    const fp = Footprint.fromFuel(rows, cols, fuelCell.r, fuelCell.c, prevAnchor.r, prevAnchor.c);
    if (!fp) continue;
    // Drop cells already belonging to the previous piece so the fuel only accounts for what it adds.
    const cells = [];
    for (let i = 0; i < fp.cells.length; i++) {
      const r = fp.cells[i].r;
      const c = fp.cells[i].c;
      const onPrev = stampsOn[r] && stampsOn[r][c] && stampsOn[r][c].indexOf(prevId) >= 0;
      if (!onPrev) cells.push(fp.cells[i]);
    }
    if (!cells.length) continue;
    const check = GridBuilder.legalFootprint(cells, nextId, uniqueMinVal, overlap, cover, sole, own, uniqueMin);
    if (!check) continue;

    // Touch detection so commit can join/merge blobs the same way a stamp does.
    // The fuel cell already sits in the parent blob, so join is guaranteed.
    const touch = [];
    function mark(blob, r, c) {
      if (blob < 0) return;
      if (!touch[blob]) touch[blob] = [];
      const key = r + "," + c;
      if (touch[blob].indexOf(key) < 0) touch[blob].push(key);
    }
    for (let i = 0; i < cells.length; i++) {
      const r = cells[i].r;
      const c = cells[i].c;
      if (cover[r][c] > 0) mark(blobAt[r][c], r, c);
      for (let d = 0; d < 4; d++) {
        const rr = r + dirs[d][0];
        const cc = c + dirs[d][1];
        if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
        if (cover[rr][cc] === 0) continue;
        let inside = false;
        for (let k = 0; k < cells.length; k++) {
          if (cells[k].r === rr && cells[k].c === cc) inside = true;
        }
        if (!inside) mark(blobAt[rr][cc], rr, cc);
      }
    }
    const hits = [];
    let join = blobAt[fuelCell.r][fuelCell.c];
    if (join < 0) join = nextBlob;
    for (let b = 0; b < touch.length; b++) {
      if (!touch[b] || touch[b].length < 2) continue;
      hits.push(b);
    }
    legal.push({ cells: cells, fuelCell: fuelCell, fresh: check.fresh, need: check.need, join: join, hits: hits });
  }
  if (!legal.length) return null;

  // Weight by fresh cell count: more new horde is better.
  let total = 0;
  for (let i = 0; i < legal.length; i++) total += legal[i].fresh;
  if (total <= 0) return null;
  let roll = GridBuilder.rand() * total;
  let pick = legal[legal.length - 1];
  for (let i = 0; i < legal.length; i++) {
    roll -= legal[i].fresh;
    if (roll <= 0) {
      pick = legal[i];
      break;
    }
  }

  const committed = GridBuilder.commitPiece(grid, pick.cells, nextId, uniqueMinVal, strongN, pick.join, pick.hits, nextBlob, cover, sole, blobAt, own, uniqueMin, strongCount, blobSize, stampsOn, pick.fuelCell);
  if (!committed || own[nextId] < (pick.need || 0)) return null;
  // Fuel cell itself stays on the previous piece for coverage but must be marked fuel.
  const fuelCell = grid.at(pick.fuelCell.r, pick.fuelCell.c);
  if (fuelCell) fuelCell.setType("fuel");
  const fp = Footprint.fromFuel(rows, cols, pick.fuelCell.r, pick.fuelCell.c, prevAnchor.r, prevAnchor.c);
  if (fp) { fp.uniqueMin = uniqueMinVal; fp.need = pick.need !== undefined ? pick.need : uniqueMinVal; fp.strongN = strongN; }
  return { id: nextId, soleCells: committed.soleCells, spawned: committed.spawned, anchor: { r: pick.fuelCell.r, c: pick.fuelCell.c }, fp: fp };
};


GridBuilder.promote = function (grid, cover, stampsOn, strongCount, stronger) {
  // stronger is relative excess above the overlap floor [0,1].
  // strongCount holds the mandatory floors (uniqueMin * overlap per stamp).
  // stronger=0 → only floors; stronger=1 → every overlap cell.
  if (!stampsOn || !strongCount) return;
  const rows = grid.rows;
  const cols = grid.cols;
  const floor = strongCount.slice();
  for (let i = 0; i < floor.length; i++) if (!floor[i]) floor[i] = 0;

  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
  function adjStrong(r, c) {
    let n = 0;
    for (let d = 0; d < 4; d++) {
      const cell = grid.at(r + dirs[d][0], c + dirs[d][1]);
      if (cell && cell.is("horde") && cell.strength > 1) n++;
    }
    return n;
  }

  const cands = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (cover[r][c] < 2) continue;
      const cell = grid.at(r, c);
      if (!cell || !cell.is("horde")) continue;
      cands.push({ r: r, c: c });
    }
  }
  if (!cands.length) return;

  function score(p) {
    const ids = stampsOn[p.r][p.c] || [];
    let w = 0.25;
    for (let k = 0; k < ids.length; k++) {
      if (floor[ids[k]] > 0) w += 5 + floor[ids[k]];
    }
    w += adjStrong(p.r, p.c) * 3;          // strong grouping
    w *= 0.55 + GridBuilder.rand() * 0.9;       // noise
    return w;
  }

  // Pass 1: mandatory floors. Greedy best-score among cells that help a remaining floor.
  let guard = cands.length * 4;
  while (guard-- > 0) {
    let any = false;
    for (let i = 0; i < floor.length; i++) if (floor[i] > 0) any = true;
    if (!any) break;

    let best = null;
    let bestW = -1;
    for (let i = 0; i < cands.length; i++) {
      const p = cands[i];
      if (grid.at(p.r, p.c).strength > 1) continue;
      const ids = stampsOn[p.r][p.c] || [];
      let helps = false;
      for (let k = 0; k < ids.length; k++) if (floor[ids[k]] > 0) helps = true;
      if (!helps) continue;
      const w = score(p);
      if (w > bestW) { bestW = w; best = p; }
    }
    if (!best) break;

    const ids = stampsOn[best.r][best.c] || [];
    let st = 0;
    for (let k = 0; k < ids.length; k++) {
      const sid = ids[k];
      if (floor[sid] > 0) {
        st++;
        floor[sid]--;
      }
    }
    st = Math.max(1, st);
    st = Math.min(st, cover[best.r][best.c]);
    grid.at(best.r, best.c).strength = st;
    grid.at(best.r, best.c).oStrength = st;
  }

  // Pass 2: excess density from relative stronger.
  // Grouping boosts chance; stronger=1 forces every remaining cell.
  if (stronger > 0) {
    for (let i = 0; i < cands.length; i++) {
      const p = cands[i];
      const cell = grid.at(p.r, p.c);
      if (cell.strength > 1) continue;
      const adj = adjStrong(p.r, p.c);
      const group = 1 + adj * 0.55;
      const noise = 0.65 + GridBuilder.rand() * 0.7;
      const chance = Math.min(1, stronger * group * noise);
      if (GridBuilder.rand() >= chance) continue;

      const ids = stampsOn[p.r][p.c] || [];
      let st = 0;
      for (let k = 0; k < ids.length; k++) {
        if (GridBuilder.rand() < stronger) st++;
      }
      st = Math.max(1, Math.min(st, cover[p.r][p.c]));
      if (st > 1) {
        cell.strength = st;
        cell.oStrength = st;
      }
    }
  }
};


// Trim empty rim around packed hordes, then rebuild the board at the origin.
GridBuilder.cropEmptyRim = function (grid, plan) {
  if (!grid) return grid;
  const pad = CROP_PAD;
  const rows = grid.rows;
  const cols = grid.cols;
  let minR = rows;
  let maxR = -1;
  let minC = cols;
  let maxC = -1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!grid.at(r, c).is("horde")) continue;
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
      if (c < minC) minC = c;
      if (c > maxC) maxC = c;
    }
  }
  if (maxR < 0) return grid;

  let r0 = minR - pad;
  let r1 = maxR + pad;
  let c0 = minC - pad;
  let c1 = maxC + pad;
  if (r0 < 0) r0 = 0;
  if (c0 < 0) c0 = 0;
  if (r1 > rows - 1) r1 = rows - 1;
  if (c1 > cols - 1) c1 = cols - 1;

  const newRows = r1 - r0 + 1;
  const newCols = c1 - c0 + 1;
  if (newRows < 1 || newCols < 1) return grid;
  if (r0 === 0 && c0 === 0 && newRows === rows && newCols === cols) return grid;

  const next = new Grid(newRows, newCols);
  for (let r = 0; r < newRows; r++) {
    for (let c = 0; c < newCols; c++) {
      const src = grid.at(r + r0, c + c0);
      const dst = next.at(r, c);
      dst.setType(src.type);
      dst.seed = src.seed;
      dst.phase = src.phase;
      if (src.type === "horde") {
        dst.strength = src.strength;
        dst.oStrength = src.oStrength;
      }
    }
  }

  const pieces = grid.pieces || [];
  next.pieces = [];
  for (let i = 0; i < pieces.length; i++) {
    const fp = pieces[i];
    const cells = [];
    const clipped = [];
    for (let k = 0; k < fp.cells.length; k++) {
      const nr = fp.cells[k].r - r0;
      const nc = fp.cells[k].c - c0;
      if (nr < 0 || nc < 0 || nr >= newRows || nc >= newCols) clipped.push({ r: nr, c: nc });
      else cells.push({ r: nr, c: nc });
    }
    for (let k = 0; k < (fp.clippedCells || []).length; k++) {
      clipped.push({ r: fp.clippedCells[k].r - r0, c: fp.clippedCells[k].c - c0 });
    }
    if (!cells.length) continue;
    fp.cells = cells;
    fp.clippedCells = clipped;
    if (fp.anchor) {
      fp.anchor = { r: fp.anchor.r - r0, c: fp.anchor.c - c0 };
    }
    if (fp.originAnchor) {
      fp.originAnchor = { r: fp.originAnchor.r - r0, c: fp.originAnchor.c - c0 };
    }
    const raw = cells.concat(clipped);
    fp.seating = Footprint.computeSeating(newRows, newCols, raw, cells);
    next.pieces.push(fp);
  }

  if (plan) {
    plan.rows = newRows;
    plan.cols = newCols;
  }
  next.dress();
  return next;
};

GridBuilder.shuffle = function (list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = (GridBuilder.rand() * (i + 1)) | 0;
    const tmp = list[i];
    list[i] = list[j];
    list[j] = tmp;
  }
};












