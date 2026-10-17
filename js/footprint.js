/** Sole source for a realized or proto piece. Cells, anchor, seating, role. */

function Footprint(opts) {
  this.cells = opts.cells || [];
  this.anchor = opts.anchor || { r: 0, c: 0 };
  this.kind = opts.kind || "";
  this.dir = opts.dir || null;
  this.originAnchor = opts.originAnchor || null;
  this.seating = opts.seating || "inner";
  this.clippedCells = opts.clippedCells || [];
  this.uniqueMin = opts.uniqueMin | 0;
  this.need = opts.need | 0;
  this.strongN = opts.strongN | 0;
  this.boardId = opts.boardId != null ? opts.boardId : null;
  this.role = opts.role || "place";
}

Footprint.DIRS8 = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1]
];

Footprint.computeSeating = function (rows, cols, rawCells, onBoardCells) {
  if (rawCells.length > onBoardCells.length) return "clipped";
  for (let i = 0; i < onBoardCells.length; i++) {
    const r = onBoardCells[i].r;
    const c = onBoardCells[i].c;
    if (r === 0 || c === 0 || r === rows - 1 || c === cols - 1) return "edge";
  }
  return "inner";
};

Footprint.fromStamp = function (rows, cols, kind, row, col) {
  const shape = Grid.STAMP_DEFINITIONS[kind];
  if (!shape) return null;
  if (shape.w & 1) {
    if (col < 0 || col >= cols) return null;
  } else if (col < 0.5 || col > cols - 1.5) return null;
  if (shape.h & 1) {
    if (row < 0 || row >= rows) return null;
  } else if (row < 0.5 || row > rows - 1.5) return null;
  const r0 = Math.round(row - (shape.h - 1) / 2);
  const c0 = Math.round(col - (shape.w - 1) / 2);
  const raw = [];
  const cells = [];
  const clipped = [];
  for (let dr = 0; dr < shape.h; dr++) {
    for (let dc = 0; dc < shape.w; dc++) {
      const rr = r0 + dr;
      const cc = c0 + dc;
      raw.push({ r: rr, c: cc });
      if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) clipped.push({ r: rr, c: cc });
      else cells.push({ r: rr, c: cc });
    }
  }
  if (!cells.length) return null;
  const seating = Footprint.computeSeating(rows, cols, raw, cells);
  const full = shape.w * shape.h;
  const ss = Math.min(shape.w, shape.h);
  const uniqueMin = full - ss;
  return new Footprint({
    cells: cells,
    anchor: { r: row, c: col },
    kind: kind,
    dir: null,
    originAnchor: null,
    seating: seating,
    clippedCells: clipped,
    uniqueMin: uniqueMin,
    need: uniqueMin,
    strongN: 0,
    boardId: null,
    role: "place"
  });
};

Footprint.fromFuel = function (rows, cols, fuelR, fuelC, originR, originC) {
  const dr = fuelR - originR;
  const dc = fuelC - originC;
  let dir = null;
  let centerR = fuelR;
  let centerC = fuelC;
  if (dr === 0 && dc === 0) {
    dir = [0, 0];
  } else {
    let bestDir = 0;
    let bestDot = -Infinity;
    const len = Math.sqrt(dr * dr + dc * dc);
    for (let d = 0; d < Footprint.DIRS8.length; d++) {
      const dd = Footprint.DIRS8[d];
      const dlen = Math.sqrt(dd[0] * dd[0] + dd[1] * dd[1]);
      const dot = (dr * dd[0] + dc * dd[1]) / (len * dlen);
      if (dot > bestDot) {
        bestDot = dot;
        bestDir = d;
      }
    }
    dir = Footprint.DIRS8[bestDir];
    const rel = [-dir[0], -dir[1]];
    centerR = fuelR - rel[0];
    centerC = fuelC - rel[1];
  }
  const raw = [];
  const cells = [];
  const clipped = [];
  for (let ddr = -1; ddr <= 1; ddr++) {
    for (let ddc = -1; ddc <= 1; ddc++) {
      const rr = Math.round(centerR + ddr);
      const cc = Math.round(centerC + ddc);
      raw.push({ r: rr, c: cc });
      if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) clipped.push({ r: rr, c: cc });
      else cells.push({ r: rr, c: cc });
    }
  }
  if (!cells.length) return null;
  const seating = Footprint.computeSeating(rows, cols, raw, cells);
  const uniqueMin = 9 - 3;
  return new Footprint({
    cells: cells,
    anchor: { r: fuelR, c: fuelC },
    kind: "fuel",
    dir: dir,
    originAnchor: { r: originR, c: originC },
    seating: seating,
    clippedCells: clipped,
    uniqueMin: uniqueMin,
    need: uniqueMin,
    strongN: 0,
    boardId: null,
    role: "trigger"
  });
};

Footprint.prototype.contains = function (r, c) {
  for (let i = 0; i < this.cells.length; i++) {
    if (this.cells[i].r === r && this.cells[i].c === c) return true;
  }
  return false;
};

Footprint.prototype.toJSON = function () {
  return {
    cells: this.cells,
    anchor: this.anchor,
    kind: this.kind,
    dir: this.dir,
    originAnchor: this.originAnchor,
    seating: this.seating,
    clippedCells: this.clippedCells,
    uniqueMin: this.uniqueMin,
    need: this.need,
    strongN: this.strongN,
    boardId: this.boardId,
    role: this.role
  };
};

Footprint.fromJSON = function (data) {
  if (!data) return null;
  return new Footprint(data);
};
