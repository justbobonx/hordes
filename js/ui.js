/** HUD, overlays, and DOM wiring. Game keeps board state. */

// Fallback only when the bar is missing or display:none (height 0).
// Mobile bar height is auto; desktop stays ~72. Live layout reads the real height.
const HUD_BOT_MIN = 56;

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
  this.onPlanPick = null;
  this.onPlanBack = null;
  this.onStoryContinue = null;
  this.expandedMode = null;
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

// overMap: campaign card floats over the live map instead of its own backdrop.
Ui.prototype.showPlan = function (overMap) {
  if (!this.elPlan) return;
  this.elPlan.classList.toggle("over-map", !!overMap);
  this.planShownAt = performance.now();
  this.elPlan.hidden = false;
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
  const thinPct = Math.round((+plan.thin || 0) * 100);
  const fuelPct = Math.round((+plan.fuelChance || 0) * 100);
  const ovPct = Math.round((+plan.overlap || 0) * 100);
  const stPct = Math.round((+plan.stronger || 0) * 100);
  let metaText = "Center:" + centeredPct + "  Flush:" + flushPct + "<br>"
    + "Trim:" + thinPct + "  Area:" + plan.area + "<br>"
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
    // Card clicks stop propagation, so this only sees the backdrop. Over the map it means Back.
    this.elPlan.addEventListener("click", function () {
      if (self.elPlan.classList.contains("over-map") && self.onPlanBack) self.onPlanBack();
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
