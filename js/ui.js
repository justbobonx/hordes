/** HUD, overlays, and DOM wiring. Game keeps board state. */

// Canvas status toast over the board (seconds / layout / colors matching status-* CSS).
const TOAST_FADE_IN = 0.15;
const TOAST_HOLD = 1.8;
const TOAST_FADE_OUT = 0.3;
const TOAST_Y_FRAC = 0.35;
// Font scales with board width, then shrinks to fit the longest line.
const TOAST_FONT_FRAC = 0.14;
const TOAST_FONT_MIN = 28;
const TOAST_FONT_MAX = 96;
const TOAST_WIDTH_FRAC = 0.95;
const TOAST_OUTLINE_DIV = 16;
const TOAST_OUTLINE_MIN = 1;
const TOAST_GAP_DIV = 8;
const TOAST_OUTLINE_ALPHA = 0.2;
const TOAST_COLOR_BLUE = "#8eb0f0";
const TOAST_COLOR_GREEN = "#a8e0a0";
const TOAST_COLOR_RED = "#f09090";
const TOAST_COLOR_GOLD = "#f0e6a8";
const TOAST_COLOR_ORANGE = "#e07a2f";

// Fallback only when the bar is missing or display:none (height 0).
// Mobile bar height is auto; desktop stays ~72. Live layout reads the real height.
const HUD_BOT_MIN = 56;

// Plan row vertical place: hub sits in the lower band under stats; hex uses a gap.
const PLAN_HUB_CENTER_Y_FRAC = 0.62;
const PLAN_HEX_GAP = 16;
const PLAN_SAFE_TOP = 12;
const PLAN_SAFE_BOT = 12;

function Ui() {
  this.canvas = document.getElementById("board");
  this.ctx = this.canvas.getContext("2d");
  this.elStatus = document.getElementById("status-msg");
  this.elTally = document.getElementById("tally-text");
  this.elHudBottom = document.getElementById("hud-bottom");
  this.btnBack = document.getElementById("btn-back");
  this.btnUndo = document.getElementById("btn-undo");
  this.btnHint = document.getElementById("btn-hint");
  this.btnReset = document.getElementById("btn-reset");
  this.btnCampaign = document.getElementById("btn-campaign");
  this.btnEndless = document.getElementById("btn-endless");
  this.btnHelp = document.getElementById("btn-help");
  this.modeRowContinue = document.getElementById("mode-row-continue");
  this.modeRowCampaign = document.getElementById("mode-row-campaign");
  this.modeRowEndless = document.getElementById("mode-row-endless");
  if (!this.modeRowCampaign || !this.modeRowEndless) {
    const panel = this.elStart && this.elStart.querySelector(".start-panel");
    if (panel) {
      if (!this.modeRowCampaign) {
        this.modeRowCampaign = document.createElement("div");
        this.modeRowCampaign.id = "mode-row-campaign";
        this.modeRowCampaign.className = "mode-row";
        panel.insertBefore(this.modeRowCampaign, this.btnHelp);
      }
      if (!this.modeRowEndless) {
        this.modeRowEndless = document.createElement("div");
        this.modeRowEndless.id = "mode-row-endless";
        this.modeRowEndless.className = "mode-row";
        panel.insertBefore(this.modeRowEndless, this.btnHelp);
      }
    }
  }
  this.elStart = document.getElementById("start-screen");
  this.elPlan = document.getElementById("plan-screen");
  this.elPlanRow = document.getElementById("plan-row");
  this.elStory = document.getElementById("story-screen");
  this.elStorySlot = document.getElementById("story-slot");
  this.elHub = document.getElementById("endless-hub");
  this.btnHubBack = document.getElementById("btn-hub-back");
  this.planAnchor = null;
  this.onPlanPick = null;
  this.onPlanBack = null;
  this.onStoryContinue = null;
  this.expandedMode = null;
  // Canvas status toast over the board; not part of the bottom bar.
  this.toast = null;
  this.toastKey = "";
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

// anchor: { kind: "hub" } or { kind: "hex", clientY }. No dim; place row once on open.
Ui.prototype.showPlan = function (anchor) {
  if (!this.elPlan) return;
  this.planAnchor = anchor || { kind: "hub" };
  const overMap = this.planAnchor.kind === "hex";
  this.elPlan.classList.toggle("plan-over-map", overMap);
  this.elPlan.classList.remove("over-map");
  this.planShownAt = performance.now();
  this.elPlan.hidden = false;
  this.placePlanRow(this.planAnchor);
};

Ui.prototype.placePlanRow = function (anchor) {
  const row = this.elPlanRow;
  if (!row) return;
  const h = row.offsetHeight || 0;
  const vh = window.innerHeight;
  const safeTop = PLAN_SAFE_TOP;
  const safeBot = PLAN_SAFE_BOT;
  let top;
  if (!anchor || anchor.kind !== "hex") {
    const cy = vh * PLAN_HUB_CENTER_Y_FRAC;
    top = cy - h / 2;
  } else {
    const clientY = +anchor.clientY || vh / 2;
    const gap = PLAN_HEX_GAP;
    if (clientY + gap + h <= vh - safeBot) top = clientY + gap;
    else if (clientY - gap - h >= safeTop) top = clientY - gap - h;
    else top = Math.max(safeTop, Math.min(vh - safeBot - h, clientY - h / 2));
  }
  top = Math.max(safeTop, Math.min(Math.max(safeTop, vh - safeBot - h), top));
  row.style.top = Math.round(top) + "px";
};

Ui.prototype.hidePlan = function () {
  if (!this.elPlan || this.elPlan.hidden) return false;
  this.elPlan.hidden = true;
  this.elPlan.classList.remove("plan-over-map");
  this.elPlan.classList.remove("over-map");
  this.planAnchor = null;
  if (this.elPlanRow) this.elPlanRow.style.top = "";
  return true;
};

Ui.prototype.showHub = function () {
  if (this.elHub) this.elHub.hidden = false;
};

Ui.prototype.hideHub = function () {
  if (this.elHub) this.elHub.hidden = true;
};

Ui.prototype.paintHub = function (view) {
  if (!view) return;
  function set(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }
  set("hub-wave", view.wave);
  set("hub-avg", view.avg);
  set("hub-perfects", view.perfects);
  set("hub-retries", view.retries);
  set("hub-total-time", view.totalTime);
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
  // Fixed bottom bar; fallback only if the node is hidden.
  return {
    bot: barHeight(this.elHudBottom, HUD_BOT_MIN),
  };
};

Ui.prototype.paintHud = function (view) {
  if (this.elTally) {
    this.elTally.textContent = view.tally || "";
    this.elTally.style.color = view.tallyColor || "";
  }
  this.paintStatus(view);
  if (this.btnHint) {
    this.btnHint.hidden = false;
    this.btnHint.disabled = !view.canHint;
  }
  if (this.btnUndo) this.btnUndo.disabled = !view.canUndo;
  if (this.btnReset) this.btnReset.textContent = view.resetLabel || "RESET";
  if (this.btnBack) {
    this.btnBack.hidden = false;
    this.btnBack.disabled = !view.canBack;
  }
};

// Level status lives on the canvas toast; keep the bar slot empty.
Ui.prototype.paintStatus = function () {
  if (!this.elStatus) return;
  this.elStatus.textContent = "";
  this.elStatus.className = "";
  this.elStatus.style.whiteSpace = "";
};

Ui.prototype.paintPlans = function (cards) {
  if (!this.elPlanRow) return;
  this.elPlanRow.innerHTML = "";
  for (let i = 0; i < cards.length; i++) this.elPlanRow.appendChild(this.makeCard(cards[i], i));
};

Ui.prototype.makeCard = function (card, index) {
  const plan = card.plan;
  const self = this;
  const btn = document.createElement("div");
  btn.className = "plan-card";
  btn.setAttribute("data-index", String(index));

  const waveLabel = document.createElement("div");
  waveLabel.className = "plan-wave";
  const prefix = card.isTutorial ? "TUTORIAL " : "WAVE ";
  waveLabel.innerHTML = plan.wave ? prefix + plan.wave : "TEST";
  waveLabel.innerHTML += "<br>" + generateCityName();
  btn.appendChild(waveLabel);

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
  const flushPct = Math.round((+plan.flush || 0) * 100);
  const centeredPct = Math.round((+plan.centered || 0) * 100);
  const rejoinPct = Math.round((+plan.rejoin || 0) * 100);
  const trimPct = Math.round((+plan.trim || 0) * 100);
  const fuelPct = Math.round((+plan.fuelChance || 0) * 100);
  const ovPct = Math.round((+plan.overlap || 0) * 100);
  const stPct = Math.round((+plan.stronger || 0) * 100);
  let metaText = "Center:" + centeredPct + "  Flush:" + flushPct + "  Rejoin:" + rejoinPct + "<br>"
    + "Trim:" + trimPct + "  Area:" + plan.area + "<br>"
    + "Fuel:" + fuelPct + "  Overlap:" + ovPct + "  Strong:" + stPct;
  meta.innerHTML = metaText;
  btn.appendChild(meta);

  const actions = document.createElement("div");
  actions.className = "plan-actions";
  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.textContent = "Back";
  backBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    if (self.onPlanBack) self.onPlanBack();
  });
  const goBtn = document.createElement("button");
  goBtn.type = "button";
  goBtn.textContent = "GO!";
  goBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    if (self.onPlanPick) self.onPlanPick(card, index);
  });
  actions.appendChild(backBtn);
  actions.appendChild(goBtn);
  btn.appendChild(actions);

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
  this.handlers = handlers;
  this.onPlanPick = handlers.planPick || null;
  this.onPlanBack = handlers.planBack || null;
  this.onStoryContinue = handlers.storyContinue || null;
  on(this.btnHelp, "click", handlers.help);
  on(this.btnBack, "click", handlers.back);
  on(this.btnHubBack, "click", handlers.hubBack || handlers.planBack);
  on(this.btnUndo, "click", handlers.undo);
  on(this.btnHint, "click", handlers.hint);
  on(this.btnReset, "click", handlers.reset);

  const self = this;
  if (this.elPlan) {
    // Swallow the late synthetic click from the tap that opened the card.
    this.elPlan.addEventListener("click", function (e) {
      if (performance.now() - (self.planShownAt || 0) >= 250) return;
      e.stopPropagation();
      e.preventDefault();
    }, true);
    // Card clicks stop propagation, so this only sees the backdrop. Hex/map only: dismiss.
    this.elPlan.addEventListener("click", function () {
      if (self.elPlan.classList.contains("plan-over-map") && self.onPlanBack) self.onPlanBack();
    });
  }
  document.addEventListener("click", function (e) {
    if (!self.startOpen() || !self.expandedMode) return;
    const panel = self.elStart && self.elStart.querySelector(".start-panel");
    if (panel && !panel.contains(e.target)) {
      self.expandedMode = null;
      self.renderModeRows();
    }
  });
  if (this.elStart) {
    let timer = 0;
    this.elStart.addEventListener("pointerdown", function (e) {
      if (e.target.closest("button")) return;
      timer = window.setTimeout(function () {
        timer = 0;
        if (self.handlers && self.handlers.startOver) self.handlers.startOver();
      }, 800);
    });
    this.elStart.addEventListener("pointerup", function () {
      if (timer) window.clearTimeout(timer);
      timer = 0;
    });
    this.elStart.addEventListener("pointercancel", function () {
      if (timer) window.clearTimeout(timer);
      timer = 0;
    });
  }
  this.renderModeRows();
};

Ui.prototype.updateStartInfo = function (data) {
  if (!this.handlers) this.handlers = {};
  if (data) {
    this.handlers.introDone = !!data.introDone;
    this.handlers.resumeMode = data.resumeMode || null;
    this.handlers.resumeLabel = data.resumeLabel || "";
    this.handlers.hasCampaignSave = !!data.hasCampaignSave;
    this.handlers.hasEndlessSave = !!data.hasEndlessSave;
    this.handlers.campaignInfo = data.campaignInfo || "";
    this.handlers.endlessInfo = data.endlessInfo || "";
  }
  this.expandedMode = null;
  this.renderModeRows();
};

Ui.prototype.renderModeRows = function () {
  const handlers = this.handlers || {};
  const self = this;
  function fillRow(row, mode, hasSave, info) {
    if (!row) return;
    row.innerHTML = "";
    if (self.expandedMode === mode && hasSave) {
      const cont = document.createElement("button");
      cont.type = "button";
      cont.className = "btn-title btn-continue";
      cont.textContent = "Continue";
      cont.addEventListener("click", function (e) {
        e.stopPropagation();
        if (handlers.continueMode) handlers.continueMode(mode);
      });
      const neu = document.createElement("button");
      neu.type = "button";
      neu.className = "btn-title btn-new";
      neu.textContent = "New";
      neu.addEventListener("click", function (e) {
        e.stopPropagation();
        if (handlers.newMode) handlers.newMode(mode);
      });
      row.appendChild(cont);
      row.appendChild(neu);
      if (info) {
        const infoEl = document.createElement("div");
        infoEl.className = "continue-info";
        infoEl.textContent = info;
        row.parentNode.insertBefore(infoEl, row.nextSibling);
      }
    } else {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn-title";
      btn.textContent = mode === "campaign" ? "Campaign" : "Endless";
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        if (hasSave) {
          self.expandedMode = mode;
          self.renderModeRows();
        } else if (handlers.newMode) {
          handlers.newMode(mode);
        }
      });
      row.appendChild(btn);
    }
  }
  const infos = this.elStart ? this.elStart.querySelectorAll(".continue-info") : [];
  for (let i = 0; i < infos.length; i++) infos[i].remove();

  // CONTINUE: one tap back into the last mode played.
  const resume = this.modeRowContinue;
  if (resume) {
    resume.innerHTML = "";
    resume.hidden = !handlers.resumeLabel;
    if (handlers.resumeLabel) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn-title btn-resume";
      btn.textContent = "Continue";
      const sub = document.createElement("span");
      sub.className = "resume-sub";
      sub.textContent = handlers.resumeLabel;
      btn.appendChild(sub);
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        if (handlers.continueMode) handlers.continueMode(handlers.resumeMode);
      });
      resume.appendChild(btn);
    }
  }

  // Until the tutorial is done there is no mode choice: one Start button.
  if (!handlers.introDone) {
    if (this.modeRowCampaign) {
      this.modeRowCampaign.innerHTML = "";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn-title";
      btn.textContent = "Start";
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        if (handlers.continueMode) handlers.continueMode("campaign");
      });
      this.modeRowCampaign.appendChild(btn);
    }
    if (this.modeRowEndless) {
      this.modeRowEndless.innerHTML = "";
      this.modeRowEndless.hidden = true;
    }
    return;
  }
  if (this.modeRowEndless) this.modeRowEndless.hidden = false;
  fillRow(this.modeRowCampaign, "campaign", handlers.hasCampaignSave, handlers.campaignInfo);
  fillRow(this.modeRowEndless, "endless", handlers.hasEndlessSave, handlers.endlessInfo);
};

Ui.prototype.toastColor = function (cls) {
  if (cls === "status-green") return TOAST_COLOR_GREEN;
  if (cls === "status-red") return TOAST_COLOR_RED;
  if (cls === "status-blue") return TOAST_COLOR_BLUE;
  return TOAST_COLOR_BLUE;
};

// Show or refresh the canvas toast when status text/color/stickiness changes.
Ui.prototype.syncToast = function (status) {
  const text = status && status.text ? status.text : "";
  const color = text ? this.toastColor(status.cls) : "";
  const lineColors = status && status.lineColors ? status.lineColors : null;
  const sticky = !!(status && status.sticky);
  const key = text ? text + "\0" + color + "\0" + (lineColors ? lineColors.join(",") : "") + "\0" + (sticky ? "1" : "0") : "";
  if (!text) {
    this.toastKey = "";
    this.dismissToast();
    return;
  }
  // Sticky plan-debug toast stays until I is pressed again (end-level sticky still wins).
  const cur = this.toast;
  if (cur && cur.debug && !cur.done && cur.phase !== "out" && !sticky) return;
  // Same status already presented: do not restart a finished timed toast.
  if (key === this.toastKey) return;
  this.toastKey = key;
  this.toast = {
    text: text,
    color: color,
    lineColors: lineColors,
    sticky: sticky,
    phase: "in",
    t: 0,
    alpha: 0,
    outFrom: 1,
    done: false,
  };
};

// Sticky plan-config toast (toggled by I); text comes from the game.
Ui.prototype.showPlanDebug = function (text) {
  if (!text) return;
  // Clear key so the next status sync re-presents the real status after this.
  this.toastKey = "";
  this.toast = {
    text: text, color: TOAST_COLOR_BLUE, sticky: true, debug: true,
    phase: "in", t: 0, alpha: 0, outFrom: 1, done: false,
  };
};

// I key: toggle the sticky plan-debug toast.
Ui.prototype.togglePlanDebug = function (text) {
  const cur = this.toast;
  if (cur && cur.debug && !cur.done && cur.phase !== "out") {
    this.toastKey = "";
    this.dismissToast();
    return;
  }
  this.showPlanDebug(text);
};

Ui.prototype.dismissToast = function () {
  const cur = this.toast;
  if (!cur || cur.done) {
    this.toast = null;
    return;
  }
  if (cur.phase === "out") return;
  cur.sticky = false;
  cur.phase = "out";
  cur.t = 0;
  cur.outFrom = cur.alpha > 0 ? cur.alpha : 1;
};

// Drop toast immediately (no fade); use when leaving the level board.
Ui.prototype.clearToast = function () {
  this.toast = null;
  this.toastKey = "";
};

Ui.prototype.stepToast = function (dt) {
  const toast = this.toast;
  if (!toast || toast.done) return;
  toast.t += dt;
  if (toast.phase === "in") {
    toast.alpha = Math.min(1, toast.t / TOAST_FADE_IN);
    if (toast.t >= TOAST_FADE_IN) {
      toast.phase = "hold";
      toast.t = 0;
      toast.alpha = 1;
    }
  } else if (toast.phase === "hold") {
    toast.alpha = 1;
    if (!toast.sticky && toast.t >= TOAST_HOLD) {
      toast.phase = "out";
      toast.t = 0;
      toast.outFrom = 1;
    }
  } else if (toast.phase === "out") {
    const from = toast.outFrom != null ? toast.outFrom : 1;
    toast.alpha = Math.max(0, from * (1 - toast.t / TOAST_FADE_OUT));
    if (toast.t >= TOAST_FADE_OUT) {
      toast.done = true;
      toast.alpha = 0;
      this.toast = null;
    }
  }
};

Ui.prototype.drawToast = function (ctx, origin) {
  const toast = this.toast;
  if (!toast || toast.done || toast.alpha <= 0) return;
  const o = origin;
  if (!o) return;
  const lines = toast.text.split("\n");
  const boardW = o.cols * o.cell;
  const boardH = o.rows * o.cell;
  let fontPx = Math.max(TOAST_FONT_MIN, Math.min(TOAST_FONT_MAX, boardW * TOAST_FONT_FRAC));
  ctx.save();
  ctx.font = fontPx + "px m5x7, monospace";
  let longest = 0;
  for (let i = 0; i < lines.length; i++) {
    const w = ctx.measureText(lines[i]).width;
    if (w > longest) longest = w;
  }
  const maxW = boardW * TOAST_WIDTH_FRAC;
  if (longest > maxW && longest > 0) {
    fontPx = Math.max(TOAST_FONT_MIN, fontPx * (maxW / longest));
  }
  const gap = fontPx / TOAST_GAP_DIV;
  const outline = Math.max(TOAST_OUTLINE_MIN, Math.round(fontPx / TOAST_OUTLINE_DIV));
  const lineH = fontPx;
  const totalH = lines.length * lineH + Math.max(0, lines.length - 1) * gap;
  const cx = o.x + boardW / 2;
  const cy = o.y + boardH * TOAST_Y_FRAC;
  const y0 = cy - totalH / 2 + lineH / 2;
  ctx.globalAlpha = toast.alpha;
  ctx.font = fontPx + "px m5x7, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i < lines.length; i++) {
    const x = cx;
    const y = y0 + i * (lineH + gap);
    ctx.fillStyle = "#000000";
    ctx.globalAlpha = toast.alpha * TOAST_OUTLINE_ALPHA;
    for (let dy = -outline; dy <= outline; dy++) {
      for (let dx = -outline; dx <= outline; dx++) {
        if (dx === 0 && dy === 0) continue;
        ctx.fillText(lines[i], x + dx, y + dy);
      }
    }
    ctx.globalAlpha = toast.alpha;
    ctx.fillStyle = (toast.lineColors && toast.lineColors[i]) || toast.color;
    ctx.fillText(lines[i], x, y);
  }
  ctx.restore();
};
