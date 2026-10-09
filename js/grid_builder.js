/** Pack stamps in a sandbox, then seat the blob. Cities paint after the seat. */

function GridBuilder() {}

GridBuilder.MIN_SOLE = 2;

GridBuilder.build = function (plan) {
  const stamps = plan.stamps && plan.stamps.length ? plan.stamps.slice() : ["33"];
  const cityN = plan.cities | 0;
  const clip = plan.clip | 0;
  for (let attempt = 0; attempt < 28; attempt++) {
    const pack = GridBuilder.pack(stamps, attempt > 18);
    if (!pack) continue;
    const grid = GridBuilder.seat(pack, clip, attempt);
    if (!grid) continue;
    GridBuilder.paintCities(grid, cityN);
    grid.dress();
    return grid;
  }
  const pack = GridBuilder.pack([stamps[0] || "33"], true) || { cells: [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 1, c: 0 }, { r: 1, c: 1 }] };
  const grid = GridBuilder.seat(pack, clip, 0) || new Grid(6, 6);
  GridBuilder.paintCities(grid, cityN);
  grid.dress();
  return grid;
};

GridBuilder.pack = function (stamps, relax) {
  const placed = [];
  const pending = [];
  for (let i = 0; i < stamps.length; i++) pending.push({ id: i, kind: stamps[i] });
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  function shapeOf(kind) {
    return Grid.STAMP_DEFINITIONS[kind];
  }

  function cellsOf(hit) {
    const out = [];
    for (let dr = 0; dr < hit.h; dr++) {
      for (let dc = 0; dc < hit.w; dc++) out.push({ r: hit.r + dr, c: hit.c + dc });
    }
    return out;
  }

  function covered(list) {
    const map = {};
    for (let i = 0; i < list.length; i++) {
      const cells = cellsOf(list[i]);
      for (let k = 0; k < cells.length; k++) map[cells[k].r + "," + cells[k].c] = (map[cells[k].r + "," + cells[k].c] || 0) + 1;
    }
    return map;
  }

  function bounds(map) {
    let minR = 99;
    let maxR = -99;
    let minC = 99;
    let maxC = -99;
    let n = 0;
    for (const key in map) {
      const bits = key.split(",");
      const r = parseInt(bits[0], 10);
      const c = parseInt(bits[1], 10);
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
      if (c < minC) minC = c;
      if (c > maxC) maxC = c;
      n++;
    }
    return { minR: minR, maxR: maxR, minC: minC, maxC: maxC, n: n };
  }

  function blobSizes(list) {
    const sizes = [];
    for (let i = 0; i < list.length; i++) {
      const b = list[i].blob;
      sizes[b] = (sizes[b] || 0) + 1;
    }
    return sizes;
  }

  function consider(kind, blob, allowSplit) {
    const shape = shapeOf(kind);
    if (!shape) return null;
    const map = covered(placed);
    const box = bounds(map);
    const hits = [];
    for (let i = 0; i < placed.length; i++) {
      if (placed[i].blob !== blob && !allowSplit) continue;
      const host = placed[i];
      const sides = [
        { r: host.r - shape.h, c: host.c, edge: "h" },
        { r: host.r + host.h, c: host.c, edge: "h" },
        { r: host.r, c: host.c - shape.w, edge: "v" },
        { r: host.r, c: host.c + host.w, edge: "v" },
      ];
      for (let s = 0; s < sides.length; s++) {
        const slide = sides[s].edge === "h" ? host.w - shape.w : host.h - shape.h;
        const steps = [];
        if (slide === 0) steps.push(0);
        else if (slide > 0) {
          steps.push(0);
          steps.push(slide);
          if (slide > 1) steps.push(slide >> 1);
        } else {
          steps.push(0);
          steps.push(slide);
        }
        for (let t = 0; t < steps.length; t++) {
          const hit = { r: sides[s].r, c: sides[s].c, w: shape.w, h: shape.h, blob: blob, overlap: 0, edge: sides[s].edge === "h" ? shape.w : shape.h };
          if (sides[s].edge === "h") hit.c += steps[t];
          else hit.r += steps[t];
          hits.push(hit);
        }
      }
      if (relax || Math.random() < 0.22) {
        if (host.w === shape.w) {
          hits.push({ r: host.r - shape.h + 1, c: host.c, w: shape.w, h: shape.h, blob: blob, overlap: 1, edge: shape.w });
          hits.push({ r: host.r + host.h - 1, c: host.c, w: shape.w, h: shape.h, blob: blob, overlap: 1, edge: shape.w });
        }
        if (host.h === shape.h) {
          hits.push({ r: host.r, c: host.c - shape.w + 1, w: shape.w, h: shape.h, blob: blob, overlap: 1, edge: shape.h });
          hits.push({ r: host.r, c: host.c + host.w - 1, w: shape.w, h: shape.h, blob: blob, overlap: 1, edge: shape.h });
        }
      }
    }
    let best = null;
    for (let i = 0; i < hits.length; i++) {
      const hit = hits[i];
      const cells = cellsOf(hit);
      let fresh = 0;
      let share = 0;
      let touch = 0;
      const seen = {};
      let bad = false;
      for (let k = 0; k < cells.length; k++) {
        const key = cells[k].r + "," + cells[k].c;
        if (seen[key]) {
          bad = true;
          break;
        }
        seen[key] = 1;
        if (map[key]) share++;
        else fresh++;
      }
      if (bad || fresh < GridBuilder.MIN_SOLE) continue;
      if (hit.overlap) {
        if (share !== hit.w && share !== hit.h) continue;
        if (share !== cells.length - fresh) continue;
      } else if (share) continue;
      for (let k = 0; k < cells.length; k++) {
        if (map[cells[k].r + "," + cells[k].c]) continue;
        for (let d = 0; d < 4; d++) {
          const rr = cells[k].r + dirs[d][0];
          const cc = cells[k].c + dirs[d][1];
          if (map[rr + "," + cc] && !seen[rr + "," + cc]) touch++;
        }
      }
      if (!hit.overlap && touch < hit.edge) continue;
      const next = {};
      for (const key in map) next[key] = 1;
      for (let k = 0; k < cells.length; k++) next[cells[k].r + "," + cells[k].c] = 1;
      const box2 = bounds(next);
      const area = (box2.maxR - box2.minR + 1) * (box2.maxC - box2.minC + 1);
      const fill = box2.n / area;
      if (fill < (relax ? 0.7 : 0.8)) continue;
      let holes = 0;
      for (let r = box2.minR; r <= box2.maxR; r++) {
        for (let c = box2.minC; c <= box2.maxC; c++) {
          if (next[r + "," + c]) continue;
          if (r === box2.minR || r === box2.maxR || c === box2.minC || c === box2.maxC) continue;
          holes++;
        }
      }
      if (holes > 2) continue;
      let score = fill * 20 + fresh - share * 0.5 - holes * 3 + Math.random();
      if (hit.overlap) score -= 4;
      if (!best || score > best.score) best = { hit: hit, score: score };
    }
    return best ? best.hit : null;
  }

  const seed = pending.splice(pending.reduce(function (best, item, index) {
    const shape = shapeOf(item.kind);
    const area = shape ? shape.w * shape.h : 0;
    return area > best.area ? { index: index, area: area } : best;
  }, { index: 0, area: -1 }).index, 1)[0];
  const seedShape = shapeOf(seed.kind);
  if (!seedShape) return null;
  placed.push({ id: seed.id, kind: seed.kind, r: 0, c: 0, w: seedShape.w, h: seedShape.h, blob: 0 });
  let nextBlob = 1;

  while (pending.length) {
    const sizes = blobSizes(placed);
    let infant = -1;
    let mature = false;
    for (let b = 0; b < sizes.length; b++) {
      if (!sizes[b]) continue;
      if (sizes[b] < 3) infant = b;
      if (sizes[b] >= 3) mature = true;
    }
    const target = infant >= 0 ? infant : 0;
    const allowSplit = infant < 0 && mature && pending.length >= 3;
    let pickAt = -1;
    let pick = null;
    for (let p = 0; p < pending.length; p++) {
      const hit = consider(pending[p].kind, target, false);
      if (hit && (!pick || hit.overlap < pick.overlap)) {
        pick = hit;
        pickAt = p;
      }
    }
    if (!pick && allowSplit) {
      const kind = pending[0].kind;
      const shape = shapeOf(kind);
      const box = bounds(covered(placed));
      pick = { r: box.maxR + 2, c: box.minC, w: shape.w, h: shape.h, blob: nextBlob, overlap: 0 };
      pickAt = 0;
      nextBlob++;
    }
    if (!pick || pickAt < 0) return null;
    pick.id = pending[pickAt].id;
    pick.kind = pending[pickAt].kind;
    placed.push(pick);
    pending.splice(pickAt, 1);
  }

  const map = covered(placed);
  const cells = [];
  for (const key in map) {
    const bits = key.split(",");
    cells.push({ r: parseInt(bits[0], 10), c: parseInt(bits[1], 10) });
  }
  return { cells: cells, placed: placed };
};

GridBuilder.seat = function (pack, clip, attempt) {
  if (!pack || !pack.cells || !pack.cells.length) return null;
  let minR = 99;
  let maxR = -99;
  let minC = 99;
  let maxC = -99;
  for (let i = 0; i < pack.cells.length; i++) {
    const cell = pack.cells[i];
    if (cell.r < minR) minR = cell.r;
    if (cell.r > maxR) maxR = cell.r;
    if (cell.c < minC) minC = cell.c;
    if (cell.c > maxC) maxC = cell.c;
  }
  const packH = maxR - minR + 1;
  const packW = maxC - minC + 1;
  let margin = packH >= 7 || packW >= 7 ? 1 : 1 + ((attempt | 0) & 1);
  let cutT = 0;
  let cutB = 0;
  let cutL = 0;
  let cutR = 0;
  if (clip) {
    const roll = (attempt | 0) % 4;
    if (roll === 0) cutT = margin + 1;
    else if (roll === 1) cutB = margin + 1;
    else if (roll === 2) cutL = margin + 1;
    else cutR = margin + 1;
    if (clip > 1 && roll < 2) cutL = margin + 1;
    if (clip > 1 && roll >= 2) cutT = margin + 1;
  }
  let rows = packH + margin * 2 - cutT - cutB;
  let cols = packW + margin * 2 - cutL - cutR;
  let originR = margin - cutT - minR;
  let originC = margin - cutL - minC;
  if (rows < 5) {
    const need = 5 - rows;
    if (cutB && !cutT) originR += need;
    rows += need;
  }
  if (cols < 5) {
    const need = 5 - cols;
    if (cutR && !cutL) originC += need;
    cols += need;
  }
  if (rows > 16) rows = 16;
  if (cols > 13) cols = 13;
  const grid = new Grid(rows, cols);
  let painted = 0;
  for (let i = 0; i < pack.cells.length; i++) {
    const r = pack.cells[i].r + originR;
    const c = pack.cells[i].c + originC;
    const cell = grid.at(r, c);
    if (!cell) continue;
    cell.setType("horde");
    painted++;
  }
  if (painted < GridBuilder.MIN_SOLE) return null;
  return grid;
};

GridBuilder.paintCities = function (grid, count) {
  if (count < 1) return;
  const rows = grid.rows;
  const cols = grid.cols;
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  const crooks = [];
  const grass = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!grid.at(r, c).is("grass")) continue;
      let redN = 0;
      for (let d = 0; d < 4; d++) {
        const cell = grid.at(r + dirs[d][0], c + dirs[d][1]);
        if (cell && cell.is("horde")) redN++;
      }
      const spot = { r: r, c: c };
      if (redN >= 3) crooks.push(spot);
      grass.push(spot);
    }
  }
  GridBuilder.shuffle(crooks);
  GridBuilder.shuffle(grass);
  let placed = 0;
  const crookCap = Math.min(count, Math.max(1, Math.floor(count / 4)));
  for (let i = 0; i < crooks.length && placed < crookCap; i++) {
    grid.at(crooks[i].r, crooks[i].c).setType("city");
    placed++;
  }
  const scatterCap = placed + Math.max(1, Math.floor(count / 3));
  for (let i = 0; i < grass.length && placed < scatterCap && placed < count; i++) {
    if (!grid.at(grass[i].r, grass[i].c).is("grass")) continue;
    let beside = false;
    for (let d = 0; d < 4; d++) {
      const cell = grid.at(grass[i].r + dirs[d][0], grass[i].c + dirs[d][1]);
      if (cell && cell.is("city")) beside = true;
    }
    if (beside) continue;
    grid.at(grass[i].r, grass[i].c).setType("city");
    placed++;
  }
  const closed = [];
  for (let r = 0; r < rows; r++) closed.push([]);
  while (placed < count) {
    const seeds = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!grid.at(r, c).is("city") || closed[r][c]) continue;
        for (let d = 0; d < 4; d++) {
          const cell = grid.at(r + dirs[d][0], c + dirs[d][1]);
          if (cell && cell.is("grass")) {
            seeds.push({ r: r, c: c });
            break;
          }
        }
      }
    }
    if (!seeds.length) {
      let dumped = false;
      for (let i = 0; i < grass.length; i++) {
        if (!grid.at(grass[i].r, grass[i].c).is("grass")) continue;
        grid.at(grass[i].r, grass[i].c).setType("city");
        placed++;
        dumped = true;
        break;
      }
      if (!dumped) return;
      continue;
    }
    const seed = seeds[(Math.random() * seeds.length) | 0];
    const clump = [{ r: seed.r, c: seed.c }];
    const room = 1 + ((Math.random() * 2) | 0);
    let grew = 0;
    while (grew < room && placed < count) {
      const next = [];
      for (let i = 0; i < clump.length; i++) {
        for (let d = 0; d < 4; d++) {
          const rr = clump[i].r + dirs[d][0];
          const cc = clump[i].c + dirs[d][1];
          const cell = grid.at(rr, cc);
          if (cell && cell.is("grass")) next.push({ r: rr, c: cc });
        }
      }
      if (!next.length) break;
      const add = next[(Math.random() * next.length) | 0];
      grid.at(add.r, add.c).setType("city");
      clump.push(add);
      placed++;
      grew++;
    }
    for (let i = 0; i < clump.length; i++) closed[clump[i].r][clump[i].c] = 1;
    if (!grew) {
      let dumped = false;
      for (let i = 0; i < grass.length; i++) {
        if (!grid.at(grass[i].r, grass[i].c).is("grass")) continue;
        grid.at(grass[i].r, grass[i].c).setType("city");
        placed++;
        dumped = true;
        break;
      }
      if (!dumped) return;
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
