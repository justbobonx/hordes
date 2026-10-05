/** Live board. Footprint, apply, dump / load. No generate. */

function Grid(rows, cols) {
  this.rows = rows | 0;
  this.cols = cols | 0 || this.rows;
  this.cells = [];
  for (let r = 0; r < this.rows; r++) {
    const row = [];
    for (let c = 0; c < this.cols; c++) row.push(new Cell("grass"));
    this.cells.push(row);
  }
}

Grid.footprint = function (rows, cols, kind, row, col) {
  const out = [];
  if (row < 0 || col < 0 || row >= rows || col >= cols) return out;
  if (kind === "col") {
    for (let r = 0; r < rows; r++) out.push({ r: r, c: col });
    return out;
  }
  const rad = kind === "5" ? 2 : 1;
  for (let dr = -rad; dr <= rad; dr++) {
    for (let dc = -rad; dc <= rad; dc++) {
      const rr = row + dr;
      const cc = col + dc;
      if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
      out.push({ r: rr, c: cc });
    }
  }
  return out;
};

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
    if (cell.is("horde")) cell.setType("cleared");
    else if (cell.is("city")) {
      cell.setType("ruined");
      ruined = true;
    } else if (cell.is("grass")) cell.setType("scorched");
  }
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
};

Grid.prototype.dress = function () {
  for (let r = 0; r < this.rows; r++) {
    for (let c = 0; c < this.cols; c++) this.cells[r][c].dress();
  }
};

Grid.prototype.dump = function () {
  return { rows: this.rows, cols: this.cols, cells: this.types() };
};

Grid.load = function (data) {
  if (!data || !data.cells) return null;
  const rows = data.rows || data.n;
  const cols = data.cols || data.n;
  if (!rows || !cols) return null;
  const grid = new Grid(rows, cols);
  grid.writeTypes(data.cells);
  grid.dress();
  return grid;
};
