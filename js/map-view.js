/** Campaign map canvas: layout, hit testing, and playing queued Overmap steps
 *  as tweens. Owns no rules; Overmap decides what each step does. */

// Each queued step (clear, cool, advance) and its tween. Tween == step so the
// next snapshot lands exactly as the previous tween finishes.
const MAP_STEP_MS = 450;

function MapView(canvas, onStep) {
  this.canvas = canvas;
  this.ctx = canvas ? canvas.getContext("2d") : null;
  this.layoutInfo = null;
  this.fade = null;
  this.stepAt = 0;
  this.onStep = onStep;
}

MapView.prototype.layout = function (country) {
  if (!this.ctx || !country) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  this.canvas.style.width = w + "px";
  this.canvas.style.height = h + "px";
  this.canvas.style.imageRendering = "pixelated";
  this.canvas.width = Math.floor(w * dpr);
  this.canvas.height = Math.floor(h * dpr);
  this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const topEl = document.getElementById("map-hud-top");
  const botEl = document.getElementById("map-hud-bottom");
  const top = topEl && !topEl.hidden ? topEl.getBoundingClientRect().height : 0;
  const bot = botEl && !botEl.hidden ? botEl.getBoundingClientRect().height : 0;
  this.layoutInfo = MapDraw.layout(this.canvas, country, { top: top, bot: bot });
};

// Called every frame while the map is showing. Plays one queued step every
// MAP_STEP_MS, so steps only advance while someone is looking at the map.
MapView.prototype.draw = function (country, highlightKey) {
  if (!this.ctx || !country || !this.layoutInfo) return;
  const now = Date.now();
  if (Overmap.busy(country)) {
    if (!this.stepAt) this.stepAt = now + MAP_STEP_MS;
    if (now >= this.stepAt) {
      const old = MapDraw.captureStyles(country, this.layoutInfo.size);
      const more = Overmap.step(country);
      Save.writeCountry(country);
      this.fade = { oldStyles: old, start: now };
      this.stepAt = more ? now + MAP_STEP_MS : 0;
      if (this.onStep) this.onStep();
    }
  } else {
    this.stepAt = 0;
  }
  let fade = null;
  if (this.fade) {
    const elapsed = now - this.fade.start;
    if (elapsed < MAP_STEP_MS) fade = { oldStyles: this.fade.oldStyles, t: elapsed / MAP_STEP_MS };
    else this.fade = null;
  }
  MapDraw.render(this.ctx, country, this.layoutInfo, highlightKey, fade);
};

MapView.prototype.hit = function (e) {
  const rect = this.canvas.getBoundingClientRect();
  return MapDraw.hit(this.layoutInfo, e.clientX - rect.left, e.clientY - rect.top);
};
