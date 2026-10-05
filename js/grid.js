/** Live board. Footprint, apply, dump / load. No generate. */

function Grid(n) {
  this.n = n;
  this.cells = [];
  for (let r = 0; r < n; r++) {
    const row = [];
    for (let c = 0; c < n; c++) row.push(new Cell("grass"));
    this.cells.push(row);
  }
}

Grid.footprint = function (n, kind, row, col) {
  const out = [];
  if (row < 0 || col < 0 || row >= n || col >= n) return out;
  if (kind === "col") {
    for (let r = 0; r < n; r++) out.push({ r: r, c: col });
    return out;
  }
  const rad = kind === "5" ? 2 : 1;
  for (let dr = -rad; dr <= rad; dr++) {
    for (let dc = -rad; dc <= rad; dc++) {
      const rr = row + dr;
      const cc = col + dc;
      if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
      out.push({ r: rr, c: cc });
    }
  }
  return out;
};

Grid.prototype.at = function (r, c) {
  if (r < 0 || c < 0 || r >= this.n || c >= this.n) return null;
  return this.cells[r][c];
};

Grid.prototype.redCount = function () {
  let n = 0;
  for (let r = 0; r < this.n; r++) {
    for (let c = 0; c < this.n; c++) {
      if (this.cells[r][c].is("horde")) n++;
    }
  }
  return n;
};

Grid.prototype.ruinedCount = function () {
  let n = 0;
  for (let r = 0; r < this.n; r++) {
    for (let c = 0; c < this.n; c++) {
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
  for (let r = 0; r < this.n; r++) {
    const row = [];
    for (let c = 0; c < this.n; c++) row.push(this.cells[r][c].type);
    rows.push(row);
  }
  return rows;
};

Grid.prototype.writeTypes = function (rows) {
  if (!rows) return;
  for (let r = 0; r < this.n; r++) {
    for (let c = 0; c < this.n; c++) {
      const name = rows[r] && rows[r][c];
      this.cells[r][c].setType(name);
    }
  }
};

Grid.prototype.dress = function () {
  for (let r = 0; r < this.n; r++) {
    for (let c = 0; c < this.n; c++) this.cells[r][c].dress();
  }
};

Grid.prototype.dump = function () {
  return { n: this.n, cells: this.types() };
};

Grid.load = function (data) {
  if (!data || !data.n || !data.cells) return null;
  const grid = new Grid(data.n);
  grid.writeTypes(data.cells);
  grid.dress();
  return grid;
};
