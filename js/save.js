const SAVE_BOARD_CAMPAIGN = "hordes_board_campaign";
const SAVE_BOARD_ENDLESS = "hordes_board_endless";
const SAVE_RUN_CAMPAIGN = "hordes_run_campaign";
const SAVE_RUN_ENDLESS = "hordes_run_endless";
const SAVE_COUNTRY = "hordes_country";
const SAVE_GLOBAL = "hordes_global";

function Save() {}

function readJson(key) {
  try {
    const data = JSON.parse(localStorage.getItem(key) || "null");
    return data && typeof data === "object" ? data : null;
  } catch (err) {
    return null;
  }
}

function writeJson(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {}
}

function clearKey(key) {
  try {
    localStorage.removeItem(key);
  } catch (err) {}
}

Save.readBoard = function (mode) {
  const key = mode === "endless" ? SAVE_BOARD_ENDLESS : SAVE_BOARD_CAMPAIGN;
  const data = readJson(key);
  if (!data || !data.cells) return null;
  if ((data.rows && data.cols) || data.n) return data;
  return null;
};

Save.writeBoard = function (mode, data) {
  const key = mode === "endless" ? SAVE_BOARD_ENDLESS : SAVE_BOARD_CAMPAIGN;
  writeJson(key, data);
};

Save.clearBoard = function (mode) {
  const key = mode === "endless" ? SAVE_BOARD_ENDLESS : SAVE_BOARD_CAMPAIGN;
  clearKey(key);
};

Save.readRun = function (mode) {
  const key = mode === "endless" ? SAVE_RUN_ENDLESS : SAVE_RUN_CAMPAIGN;
  return readJson(key);
};

Save.writeRun = function (mode, data) {
  const key = mode === "endless" ? SAVE_RUN_ENDLESS : SAVE_RUN_CAMPAIGN;
  writeJson(key, data);
};

Save.clearRun = function (mode) {
  const key = mode === "endless" ? SAVE_RUN_ENDLESS : SAVE_RUN_CAMPAIGN;
  clearKey(key);
};

Save.readCountry = function () {
  const data = readJson(SAVE_COUNTRY);
  return data && data.hexes ? Overmap.deserialize(data) : null;
};

Save.writeCountry = function (country) {
  writeJson(SAVE_COUNTRY, Overmap.serialize(country));
};

Save.clearCountry = function () {
  clearKey(SAVE_COUNTRY);
};

Save.readGlobal = function () {
  return readJson(SAVE_GLOBAL) || { introDone: false, nextTutorial: 1 };
};

Save.writeGlobal = function (data) {
  writeJson(SAVE_GLOBAL, data);
};

Save.clearGlobal = function () {
  clearKey(SAVE_GLOBAL);
};

Save.clearAll = function () {
  Save.clearBoard("campaign");
  Save.clearBoard("endless");
  Save.clearRun("campaign");
  Save.clearRun("endless");
  Save.clearCountry();
  Save.clearGlobal();
};
