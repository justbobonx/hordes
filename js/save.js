const SAVE_BOARD = "horde_board";
const SAVE_RUN = "horde_run";

function Save() {}

Save.readBoard = function () {
  try {
    const data = JSON.parse(localStorage.getItem(SAVE_BOARD) || "null");
    return data && data.n && data.cells ? data : null;
  } catch (err) {
    return null;
  }
};

Save.writeBoard = function (data) {
  try {
    localStorage.setItem(SAVE_BOARD, JSON.stringify(data));
  } catch (err) {}
};

Save.clearBoard = function () {
  try {
    localStorage.removeItem(SAVE_BOARD);
  } catch (err) {}
};

Save.readRun = function () {
  try {
    const data = JSON.parse(localStorage.getItem(SAVE_RUN) || "null");
    return data && typeof data === "object" ? data : null;
  } catch (err) {
    return null;
  }
};

Save.writeRun = function (data) {
  try {
    localStorage.setItem(SAVE_RUN, JSON.stringify(data));
  } catch (err) {}
};
