/** HUD, overlays, and DOM wiring. Game keeps board state. */

function Ui() {
  this.canvas = document.getElementById("board");
  this.ctx = this.canvas.getContext("2d");
  this.elWave = document.getElementById("wave-label");
  this.elStatus = document.getElementById("status-msg");
  this.elHudBottom = document.getElementById("hud-bottom");
  this.btnBack = document.getElementById("btn-back");
  this.btnHint = document.getElementById("btn-hint");
  this.btnReset = document.getElementById("btn-reset");
  this.btnStart = document.getElementById("btn-start");
  this.btnHelp = document.getElementById("btn-help");
  this.elStart = document.getElementById("start-screen");
  this.elPlan = document.getElementById("plan-screen");
  this.elPlanRow = document.getElementById("plan-row");
  this.btnPlanBack = document.getElementById("btn-plan-back");
  this.elStory = document.getElementById("story-screen");
  this.elStorySlot = document.getElementById("story-slot");
  this.onPlanPick = null;
  this.onStoryContinue = null;
}

Ui.prototype.planOpen = function () {
  return !!(this.elPlan && !this.elPlan.hidden);
};

Ui.prototype.storyOpen = function () {
  return !!(this.elStory && !this.elStory.hidden);
};

Ui.prototype.startOpen = function () {
  return !!(this.elStart && !this.elStart.hidden);
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
    bot: Math.max(72, barHeight(this.elHudBottom, 72)),
  };
};

Ui.prototype.paintHud = function (view) {
  if (this.elWave) {
    let label = view.testPlan ? "TEST" : "WAVE " + view.wave;
    if (view.plan) {
      const c = Math.round((+view.plan.centered || 0) * 100);
      const f = Math.round((+view.plan.tight || 0) * 100);
      const t = Math.round((+view.plan.thin || 0) * 100);
      const pad = function (n) { return (n < 10 ? "0" : "") + n; };
      label += "<br>(C:" + pad(c) + ",F:" + pad(f) + ",T:" + pad(t);
      if (view.plan.area != null) label += ",A:" + view.plan.area;
      label += ")";
    }
    this.elWave.innerHTML = label;
  }
  this.paintStatus(view);
  if (this.btnHint) this.btnHint.hidden = !!view.hideHint;
  if (this.btnReset) this.btnReset.textContent = view.resetLabel || "RESET";
};

Ui.prototype.paintStatus = function (view) {
  if (!this.elStatus) return;
  const text = view.statusText || "";
  if (text.indexOf("\n") >= 0) {
    this.elStatus.innerHTML = text.replace(/\n/g, "<br>");
    this.elStatus.style.whiteSpace = "normal";
  } else {
    this.elStatus.textContent = text;
    this.elStatus.style.whiteSpace = "";
  }
  this.elStatus.className = view.statusClass || "";
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
  wave.innerHTML  = plan.wave ? "WAVE " + plan.wave : "TEST";
  wave.innerHTML  += "<br>"+generateCityName();
  
  btn.appendChild(wave);

  const size = document.createElement("div");
  size.className = "plan-size";
  size.textContent = plan.cols + "\u00d7" + plan.rows;
  btn.appendChild(size);

  const count = document.createElement("div");
  count.className = "plan-count";
  const n = plan.stamps ? plan.stamps.length : 0;
  count.textContent = n + (n === 1 ? " PIECE" : " PIECES");
  btn.appendChild(count);

  const meta = document.createElement("div");
  meta.className = "plan-meta";
  const tightPct = Math.round((+plan.tight || 0) * 100);
  const centeredPct = Math.round((+plan.centered || 0) * 100);
  const thinPct = Math.round((+plan.thin || 0) * 100);
  let metaText = "Center:" + centeredPct + "  Flush:" + tightPct + "<br>"
    + "Trim:" + thinPct + "  Area:" + plan.area;
  meta.innerHTML = metaText;
  btn.appendChild(meta);

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
  on(this.btnBack, "click", handlers.back);
  on(this.btnHint, "click", handlers.hint);
  on(this.btnReset, "click", handlers.reset);
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
