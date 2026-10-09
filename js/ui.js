/** HUD, overlays, and DOM wiring. Game keeps board state. */

function Ui() {
  this.canvas = document.getElementById("board");
  this.ctx = this.canvas.getContext("2d");
  this.elWave = document.getElementById("wave-label");
  this.elLeft = document.getElementById("stamp-left");
  this.elClears = document.getElementById("score-clears");
  this.elTray = document.getElementById("stamp-tray");
  this.elLost = document.getElementById("lost-flag");
  this.elHud = document.getElementById("hud");
  this.elHudBottom = document.getElementById("hud-bottom");
  this.elEndTitle = document.getElementById("end-title");
  this.elEndTime = document.getElementById("end-time");
  this.elEndNote = document.getElementById("end-note");
  this.btnEnd = document.getElementById("btn-end");
  this.btnMenu = document.getElementById("btn-menu");
  this.btnReset = document.getElementById("btn-reset");
  this.btnResetMenu = document.getElementById("btn-reset-menu");
  this.btnGiveUp = document.getElementById("btn-give-up");
  this.btnStart = document.getElementById("btn-start");
  this.btnHelp = document.getElementById("btn-help");
  this.elStart = document.getElementById("start-screen");
  this.elMenu = document.getElementById("menu-screen");
  this.elEnd = document.getElementById("end-screen");
  this.elPlan = document.getElementById("plan-screen");
  this.elPlanRow = document.getElementById("plan-row");
  this.btnPlanBack = document.getElementById("btn-plan-back");
  this.elStory = document.getElementById("story-screen");
  this.elStorySlot = document.getElementById("story-slot");
  this.onPlanPick = null;
  this.onStoryContinue = null;
}

Ui.prototype.endOpen = function () {
  return !!(this.elEnd && !this.elEnd.hidden);
};

Ui.prototype.planOpen = function () {
  return !!(this.elPlan && !this.elPlan.hidden);
};

Ui.prototype.storyOpen = function () {
  return !!(this.elStory && !this.elStory.hidden);
};

Ui.prototype.menuOpen = function () {
  return !!(this.elMenu && !this.elMenu.hidden);
};

Ui.prototype.startOpen = function () {
  return !!(this.elStart && !this.elStart.hidden);
};

Ui.prototype.hideEnd = function () {
  if (this.elEnd) this.elEnd.hidden = true;
};

Ui.prototype.showEnd = function () {
  if (this.elEnd) this.elEnd.hidden = false;
};

Ui.prototype.hideMenu = function () {
  if (this.elMenu) this.elMenu.hidden = true;
};

Ui.prototype.showMenu = function () {
  if (this.elMenu) this.elMenu.hidden = false;
};

Ui.prototype.hideStart = function () {
  if (this.elStart) this.elStart.hidden = true;
};

Ui.prototype.showStart = function () {
  if (this.elStart) this.elStart.hidden = false;
};

Ui.prototype.showPlan = function () {
  if (this.elPlan) this.elPlan.hidden = false;
};

Ui.prototype.hidePlan = function () {
  if (!this.elPlan || this.elPlan.hidden) return false;
  this.elPlan.hidden = true;
  return true;
};

Ui.prototype.showStory = function () {
  if (this.elStory) this.elStory.hidden = false;
};

Ui.prototype.hideStory = function () {
  if (!this.elStory || this.elStory.hidden) return false;
  this.elStory.hidden = true;
  return true;
};

Ui.prototype.hudPad = function () {
  function barHeight(el, fallback) {
    if (!el) return fallback;
    const h = Math.ceil(el.getBoundingClientRect().height);
    return h > 0 ? h : fallback;
  }
  return {
    top: Math.max(78, barHeight(this.elHud, 78)),
    bot: Math.max(56, barHeight(this.elHudBottom, 56)),
  };
};

Ui.prototype.paintHud = function (view) {
  if (this.elLeft) this.elLeft.textContent = view.left + " LEFT";
  if (this.elWave) this.elWave.textContent = view.testPlan ? "TEST" : "WAVE " + view.wave;
  if (this.elClears) this.elClears.textContent = "\u2605 " + view.cleared;
  if (this.elLost) this.elLost.hidden = !view.lost;
  this.paintTray(view.queue);
};

Ui.prototype.paintTray = function (queue) {
  if (!this.elTray) return;
  this.elTray.innerHTML = "";
  const list = queue || [];
  for (let i = list.length - 1; i >= 0; i--) {
    const live = i === 0;
    const kind = list[i];
    const shape = Grid.STAMP_DEFINITIONS[kind] || Grid.STAMP_DEFINITIONS["33"];
    const stamp = document.createElement("div");
    stamp.className = "stamp" + (live ? " live" : "");
    stamp.title = Plan.label(kind);
    stamp.style.gridTemplateColumns = "repeat(" + shape.w + ", 7px)";
    for (let k = 0; k < shape.w * shape.h; k++) {
      stamp.appendChild(document.createElement("i"));
    }
    this.elTray.appendChild(stamp);
  }
};

Ui.prototype.paintEnd = function (won, timeText, title, sub) {
  if (this.elEndTitle) this.elEndTitle.textContent = title || (won ? "The horde is gone!" : "The horde still stands!");
  if (this.elEndTime) this.elEndTime.textContent = timeText;
  if (this.elEndNote) this.elEndNote.textContent = sub || "";
  if (this.btnEnd) this.btnEnd.textContent = won ? "NEXT" : "TRY AGAIN";
};

Ui.prototype.paintPlans = function (cards) {
  if (!this.elPlanRow) return;
  this.elPlanRow.innerHTML = "";
  for (let i = 0; i < cards.length; i++) this.elPlanRow.appendChild(this.makeCard(cards[i], i));
};

Ui.prototype.makeCard = function (card, index) {
  const plan = card.plan;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "plan-card";
  btn.setAttribute("data-index", String(index));

  const wave = document.createElement("div");
  wave.className = "plan-wave";
  wave.textContent = plan.wave ? "WAVE " + plan.wave : "TEST";
  btn.appendChild(wave);

  const size = document.createElement("div");
  size.className = "plan-size";
  size.textContent = plan.cols + "\u00d7" + plan.rows;
  btn.appendChild(size);

  const stamps = document.createElement("div");
  stamps.className = "plan-stamps";
  for (let i = 0; i < plan.stamps.length; i++) {
    const bit = document.createElement("span");
    bit.textContent = Plan.label(plan.stamps[i]);
    stamps.appendChild(bit);
  }
  btn.appendChild(stamps);

  const foot = document.createElement("span");
  foot.className = "plan-select";
  foot.textContent = "SELECT";
  btn.appendChild(foot);

  const self = this;
  btn.addEventListener("click", function (e) {
    e.stopPropagation();
    if (self.onPlanPick) self.onPlanPick(card, index);
  });
  return btn;
};

Ui.prototype.paintStory = function (page) {
  if (!this.elStorySlot || !page) return;
  this.elStorySlot.innerHTML = "";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "story-card";

  if (page.image) {
    const img = document.createElement("img");
    img.className = "story-art";
    img.src = page.image;
    img.width = page.sizex || 64;
    img.height = page.sizey || 64;
    img.alt = "";
    btn.appendChild(img);
  } else if (page.swatch) {
    const sw = document.createElement("div");
    sw.className = "story-swatch";
    sw.style.background = page.swatch;
    btn.appendChild(sw);
  }

  if (page.text) {
    const body = document.createElement("div");
    body.className = "story-text";
    body.textContent = page.text;
    btn.appendChild(body);
  }

  const foot = document.createElement("span");
  foot.className = "story-continue";
  foot.textContent = "TAP TO CONTINUE";
  btn.appendChild(foot);

  const self = this;
  btn.addEventListener("click", function (e) {
    e.stopPropagation();
    if (self.onStoryContinue) self.onStoryContinue();
  });
  this.elStorySlot.appendChild(btn);
};

Ui.prototype.bind = function (handlers) {
  const on = function (el, ev, fn) {
    if (el && fn) el.addEventListener(ev, fn);
  };
  this.onPlanPick = handlers.planPick || null;
  this.onStoryContinue = handlers.storyContinue || null;
  on(this.btnHelp, "click", handlers.help);
  on(this.btnPlanBack, "click", function (e) {
    e.stopPropagation();
    if (handlers.planBack) handlers.planBack();
  });
  on(this.btnMenu, "click", handlers.menu);
  on(this.btnReset, "click", handlers.reset);
  on(this.btnResetMenu, "click", handlers.reset);
  on(this.btnGiveUp, "click", handlers.giveUp);
  on(this.btnEnd, "click", handlers.end);
  on(this.elMenu, "click", handlers.menuBackdrop);
  const start = this.btnStart;
  if (!start) return;
  const label = start.textContent;
  let timer = 0;
  let armed = false;
  let skipClick = false;
  start.addEventListener("pointerdown", function (e) {
    if (e.button && e.button !== 0) return;
    armed = false;
    skipClick = false;
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(function () {
      timer = 0;
      armed = true;
      start.textContent = "Start Over";
    }, 500);
  });
  start.addEventListener("pointerup", function () {
    if (timer) window.clearTimeout(timer);
    timer = 0;
    if (!armed) return;
    armed = false;
    skipClick = true;
    start.textContent = label;
    if (handlers.startOver) handlers.startOver();
  });
  start.addEventListener("pointerleave", function () {
    if (timer) window.clearTimeout(timer);
    timer = 0;
    armed = false;
    start.textContent = label;
  });
  start.addEventListener("pointercancel", function () {
    if (timer) window.clearTimeout(timer);
    timer = 0;
    armed = false;
    start.textContent = label;
  });
  start.addEventListener("contextmenu", function (e) {
    e.preventDefault();
  });
  start.addEventListener("click", function (e) {
    if (skipClick) {
      skipClick = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (handlers.start) handlers.start();
  });
};
