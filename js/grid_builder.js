/** Drop stamps, then dress grass with towns. The blob stays red. */

function GridBuilder() {}

GridBuilder.build = function (plan) {
  const rows = plan.rows | 0;
  const cols = plan.cols | 0;
  const stamps = plan.stamps && plan.stamps.length ? plan.stamps.slice() : ["33"];
  const openSeat = plan.open === "edge" ? "edge" : "inner";
  const grow = plan.grow === "stray" ? "stray" : "tight";
  let centered = plan.centered;
  if (centered === undefined || centered === null || centered === "") centered = 0.5;
  centered = +centered;
  if (centered !== centered) centered = 0.5;
  if (centered < 0) centered = 0;
  if (centered > 1) centered = 1;
  for (let attempt = 0; attempt < 36; attempt++) {
    const built = GridBuilder.dropAll(rows, cols, stamps, openSeat, grow, centered);
    if (!built) continue;
    GridBuilder.paintCities(built.grid);
    built.grid.dress();
    return built.grid;
  }
  const built = GridBuilder.dropAll(rows, cols, stamps, openSeat, grow, centered);
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

GridBuilder.dropAll = function (rows, cols, stamps, openSeat, grow, centered) {
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
  const stampFull = [];
  const blobSize = [];
  let nextBlob = 0;
  for (let i = 0; i < stamps.length; i++) {
    let small = false;
    let grown = blobSize.length > 0;
    for (let b = 0; b < blobSize.length; b++) {
      if (!blobSize[b]) continue;
      if (blobSize[b] < 3) {
        small = true;
        grown = false;
      }
    }
    const left = stamps.length - i;
    const wantNew = i > 0 && grown && left >= 3 && Math.random() < 0.5;
    const placed = GridBuilder.dropStamp(grid, stamps[i], i, i === 0, openSeat, wantNew, small, grow, centered, cover, sole, blobAt, own, stampFull, blobSize, nextBlob);
    if (!placed) return null;
    if (placed.spawned) nextBlob++;
  }
  return { grid: grid, blobAt: blobAt };
};

GridBuilder.dropStamp = function (grid, kind, id, first, openSeat, wantNew, small, grow, centered, cover, sole, blobAt, own, stampFull, blobSize, nextBlob) {
  const rows = grid.rows;
  const cols = grid.cols;
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
    const cells = Grid.footprint(rows, cols, kind, row, col);
    if (!cells.length || !full) return;
    let fresh = 0;
    let freshR = 0;
    let freshC = 0;
    const lost = [];
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
          if (cells[k].r === rr && cells[k].c === cc) inside = true;
        }
        if (!inside) mark(blobAt[rr][cc], rr, cc);
      }
    }
    if (fresh * 2 <= full) return;
    for (let s = 0; s < id; s++) {
      if ((own[s] - (lost[s] || 0)) * 2 <= stampFull[s]) return;
    }
    const hits = [];
    const grazes = [];
    let join = -1;
    for (let b = 0; b < touch.length; b++) {
      if (!touch[b] || !touch[b].length) continue;
      grazes.push(b);
      if (touch[b].length < 2) continue;
      hits.push(b);
      if (join < 0) join = b;
      if (small && blobSize[b] && blobSize[b] < 3) join = b;
    }
    if (first) {
      let edge = false;
      for (let i = 0; i < cells.length; i++) {
        const r = cells[i].r;
        const c = cells[i].c;
        if (r === 0 || c === 0 || r === rows - 1 || c === cols - 1) edge = true;
      }
      if (openSeat === "edge" ? !edge : edge) return;
      legal.push({ cells: cells, hits: [], join: nextBlob, fr: freshR / fresh, fc: freshC / fresh });
      return;
    }
    if (wantNew) {
      legal.push({ cells: cells, hits: grazes, join: grazes.length ? grazes[0] : nextBlob, fr: freshR / fresh, fc: freshC / fresh });
      return;
    }
    if (join < 0) return;
    if (small && !(blobSize[join] && blobSize[join] < 3)) return;
    legal.push({ cells: cells, hits: hits, join: join, fr: freshR / fresh, fc: freshC / fresh });
  }

  if (!rowAnchors.length || !colAnchors.length) return null;
  for (let ri = 0; ri < rowAnchors.length; ri++) {
    for (let ci = 0; ci < colAnchors.length; ci++) consider(rowAnchors[ri], colAnchors[ci]);
  }
  if (!legal.length) return null;
  let total = 0;
  for (let i = 0; i < legal.length; i++) {
    const seat = legal[i];
    let affinity = near(seat.fr, seat.fc, midR, midC);
    if (!first && seat.join !== nextBlob) {
      let n = 0;
      let br = 0;
      let bc = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (blobAt[r][c] !== seat.join) continue;
          n++;
          br += r;
          bc += c;
        }
      }
      if (n) affinity = affinity * 0.5 + near(seat.fr, seat.fc, br / n, bc / n) * 0.5;
    }
    const noise = 0.6 + Math.random() * 0.4;
    seat.weight = ((1 - centered) + centered * affinity) * noise;
    if (seat.weight < 0.05) seat.weight = 0.05;
    total += seat.weight;
  }
  let roll = Math.random() * total;
  let pick = legal[legal.length - 1];
  for (let i = 0; i < legal.length; i++) {
    roll -= legal[i].weight;
    if (roll <= 0) {
      pick = legal[i];
      break;
    }
  }
  let keeper = pick.join;
  let spawned = keeper === nextBlob;
  if (pick.hits.length) {
    spawned = false;
    if (pick.hits.indexOf(keeper) < 0) keeper = pick.hits[0];
    for (let h = 0; h < pick.hits.length; h++) {
      const other = pick.hits[h];
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
  stampFull[id] = full;
  own[id] = 0;
  for (let i = 0; i < pick.cells.length; i++) {
    const r = pick.cells[i].r;
    const c = pick.cells[i].c;
    const cell = grid.at(r, c);
    if (cover[r][c] === 0) {
      cover[r][c] = 1;
      sole[r][c] = id;
      blobAt[r][c] = keeper;
      own[id]++;
      if (!cell.is("horde")) cell.setType("horde");
    } else if (cover[r][c] === 1) {
      own[sole[r][c]]--;
      sole[r][c] = -1;
      cover[r][c] = 2;
      blobAt[r][c] = keeper;
    } else {
      cover[r][c]++;
      blobAt[r][c] = keeper;
    }
  }
  if (own[id] * 2 <= full) return null;
  if (grow === "stray") return { spawned: spawned };
  return { spawned: spawned };
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
