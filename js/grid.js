/** Live board. Apply, dump / load. Footprints live in pieces. */

function Grid(rows, cols) {
  this.rows = rows | 0;
  this.cols = cols | 0 || this.rows;
  this.cells = [];
  this.pieces = [];
  for (let r = 0; r < this.rows; r++) {
    const row = [];
    for (let c = 0; c < this.cols; c++) row.push(new Cell("grass"));
    this.cells.push(row);
  }
}

Grid.STAMP_DEFINITIONS = {                          //area  ave wh
  "22": { w: 2, h: 2, p: 1, trayColor:"#c4450c" },  //  4    2
  "33": { w: 3, h: 3, p: 2, trayColor:"#e5550b" },  //  9    3
  "24": { w: 2, h: 4, p: 3, trayColor:"#a98636" },  //  8    3
  "42": { w: 4, h: 2, p: 3, trayColor:"#d09e2f" },  //  8    3
  "35": { w: 3, h: 5, p: 3, trayColor:"#d6613d" },  // 15    4
  "53": { w: 5, h: 3, p: 3, trayColor:"#cb5b39" },  // 15    4
  "45": { w: 4, h: 5, p: 2, trayColor:"#f49838" },  // 20    4.5
  "54": { w: 5, h: 4, p: 2, trayColor:"#f2a049" },  // 20    4.5
  "15": { w: 1, h: 5, p: 1, trayColor:"#cf506b" },  //  5    3
  "51": { w: 5, h: 1, p: 1, trayColor:"#b8484f" },  //  5    3
};
// 3352445152
// 1223344555

Grid.prototype.at = function (r, c) {
  if (r < 0 || c < 0 || r >= this.rows || c >= this.cols) return null;
  return this.cells[r][c];
};

Grid.prototype.redCount = function () {
  let n = 0;
  for (let r = 0; r < this.rows; r++) {
    for (let c = 0; c < this.cols; c++) {
      if (this.cells[r][c].is("horde")) n++;
    }
  }
  return n;
};

Grid.prototype.ruinedCount = function () {
  let n = 0;
  for (let r = 0; r < this.rows; r++) {
    for (let c = 0; c < this.cols; c++) {
      if (this.cells[r][c].is("ruined")) n++;
    }
  }
  return n;
};

Grid.prototype.apply = function (cells) {
  let ruined = false;
  for (let i = 0; i < cells.length; i++) {
    const cell = this.at(cells[i].r, cells[i].c);
    if (!cell) continue;
    if (cell.is("horde")) {
      if (cell.strength > 1) {
        cell.strength--;
        if (cell.strength < 1) cell.strength = 1;
      } else {
        cell.setType("cleared");
      }
    } else if (cell.is("city")) {
      cell.setType("ruined");
      ruined = true;
    } else if (cell.is("grass")) cell.setType("scorched");
    else if (cell.is("barrier")) cell.setType("grass");
    else if (cell.is("fuel")) cell.setType("scorched");
  }
  this.dress();
  return ruined;
};

Grid.prototype.types = function () {
  const rows = [];
  for (let r = 0; r < this.rows; r++) {
    const row = [];
    for (let c = 0; c < this.cols; c++) row.push(this.cells[r][c].type);
    rows.push(row);
  }
  return rows;
};

Grid.prototype.writeTypes = function (rows) {
  if (!rows) return;
  for (let r = 0; r < this.rows; r++) {
    for (let c = 0; c < this.cols; c++) {
      const name = rows[r] && rows[r][c];
      this.cells[r][c].setType(name);
    }
  }
  this.dress();
};

Grid.prototype.assignGroups = function () {
  const seen = [];
  for (let r = 0; r < this.rows; r++) seen.push([]);
  let nextId = 1;
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (let r = 0; r < this.rows; r++) {
    for (let c = 0; c < this.cols; c++) {
      if (seen[r][c]) continue;
      const cell = this.at(r, c);
      const look = CELL_TYPES[cell.type];
      if (!look || look.vary !== "group") continue;
      const id = nextId++;
      const stack = [{ r: r, c: c }];
      seen[r][c] = true;
      while (stack.length) {
        const cur = stack.pop();
        this.at(cur.r, cur.c).groupId = id;
        for (let d = 0; d < 4; d++) {
          const rr = cur.r + dirs[d][0];
          const cc = cur.c + dirs[d][1];
          if (rr < 0 || cc < 0 || rr >= this.rows || cc >= this.cols || seen[rr][cc]) continue;
          const other = this.at(rr, cc);
          if (!other) continue;
          const same = other.type === cell.type ||
            ((cell.type === "city" || cell.type === "ruined") &&
             (other.type === "city" || other.type === "ruined"));
          if (same) {
            seen[rr][cc] = true;
            stack.push({ r: rr, c: cc });
          }
        }
      }
    }
  }
};

Grid.prototype.dress = function () {
  this.assignGroups();
  for (let r = 0; r < this.rows; r++) {
    for (let c = 0; c < this.cols; c++) this.cells[r][c].dress();
  }
  Cell.dressGrid(this);
};

Grid.prototype.strengths = function () {
  const rows = [];
  for (let r = 0; r < this.rows; r++) {
    const row = [];
    for (let c = 0; c < this.cols; c++) row.push(this.cells[r][c].strength || 1);
    rows.push(row);
  }
  return rows;
};

Grid.prototype.writeStrengths = function (rows) {
  if (!rows) return;
  for (let r = 0; r < this.rows; r++) {
    for (let c = 0; c < this.cols; c++) {
      const st = rows[r] && rows[r][c];
      this.cells[r][c].strength = st > 1 ? st : 1;
    }
  }
};

Grid.prototype.oStrengths = function () {
  const rows = [];
  for (let r = 0; r < this.rows; r++) {
    const row = [];
    for (let c = 0; c < this.cols; c++) row.push(this.cells[r][c].oStrength || 1);
    rows.push(row);
  }
  return rows;
};

Grid.prototype.writeOStrengths = function (rows) {
  if (!rows) return;
  for (let r = 0; r < this.rows; r++) {
    for (let c = 0; c < this.cols; c++) {
      const st = rows[r] && rows[r][c];
      this.cells[r][c].oStrength = st > 1 ? st : 1;
    }
  }
};

Grid.prototype.dump = function () {
  const pieces = [];
  for (let i = 0; i < this.pieces.length; i++) pieces.push(this.pieces[i].toJSON());
  return { rows: this.rows, cols: this.cols, cells: this.types(), strengths: this.strengths(), oStrengths: this.oStrengths(), pieces: pieces };
};

Grid.load = function (data) {
  if (!data || !data.cells) return null;
  const rows = data.rows || data.n;
  const cols = data.cols || data.n;
  if (!rows || !cols) return null;
  const grid = new Grid(rows, cols);
  grid.writeTypes(data.cells);
  if (data.strengths) grid.writeStrengths(data.strengths);
  if (data.oStrengths) {
    grid.writeOStrengths(data.oStrengths);
  } else {
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        const cell = grid.at(r, c);
        cell.oStrength = cell.strength || 1;
      }
    }
  }
  grid.pieces = [];
  if (Array.isArray(data.pieces)) {
    for (let i = 0; i < data.pieces.length; i++) {
      const fp = Footprint.fromJSON(data.pieces[i]);
      if (fp) grid.pieces.push(fp);
    }
  }
  grid.dress();
  return grid;
};
