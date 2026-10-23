/** Generic particle pool: white fading dots that drift, slow or speed up, swell, and vanish. */

// Most particles alive at once; when full, a new one replaces the oldest.
const PARTICLES_MAX = 600;
// A particle this faint is gone.
const ALPHA_DEAD = 0.02;
const PARTICLE_COLOR = "#ffffff";
// Dots are stamped from one image drawn at startup instead of filling a path
// for each one. Soft fades the dot out toward its edge, otherwise it is a
// crisp solid circle that looks the same as a vector fill.
const PARTICLE_SOFT = false;
// Pixel width of that image, big enough that the largest dot on a dense
// screen is shrunk rather than stretched.
const PARTICLE_DOT_PX = 128;
// For the soft dot, how far out from the center it stays fully solid, as a
// fraction of its radius, before fading to clear at the edge.
const PARTICLE_SOFT_CORE = 0.3;

// Hit burst: a few dots fanning out evenly from the cell center.
// Sizes and distances are fractions of a cell, speeds are cells per second,
// fades are milliseconds, speed decay is the speed fraction left after a second,
// and growth is how many times bigger a dot gets each second.
const BURST_COUNT = 3;
const BURST_ANGLE_JITTER = 15 * Math.PI / 180;
const BURST_START = 0.15;
const BURST_START_JITTER = 0.2;
const BURST_SPEED = 0.6;
const BURST_SPEED_JITTER = 0.3;
const BURST_SPEED_DECAY = 0.2;
const BURST_SPEED_DECAY_JITTER = 0.3;
const BURST_SIZE = 0.35;
const BURST_SIZE_JITTER = 0.2;
const BURST_GROWTH = 2.0;
const BURST_GROWTH_JITTER = 0.2;
const BURST_ALPHA = 0.35;
const BURST_ALPHA_JITTER = 0.1;
const BURST_FADE_MS = 850;
const BURST_FADE_JITTER = 0.2;

// Ruined city smoke: one faint dot rising from near the center, drifting a
// little sideways, gathering speed and widening, gone after about a cell of travel.
const PUFF_START_JITTER = 0.15;
const PUFF_RISE = 0.8;
const PUFF_RISE_JITTER = 0.3;
const PUFF_DRIFT = 0.15;
const PUFF_SPEED_DECAY = 1.15;
const PUFF_SPEED_DECAY_JITTER = 0.04;
const PUFF_SIZE = 0.16;
const PUFF_SIZE_JITTER = 0.25;
const PUFF_GROWTH = 1.8;
const PUFF_GROWTH_JITTER = 0.2;
const PUFF_ALPHA = 0.3;
const PUFF_ALPHA_JITTER = 0.08;
const PUFF_FADE_MS = 1200;
const PUFF_FADE_JITTER = 0.25;

function Particles() {
  // A fixed ring of slots; new particles go in the next slot around, so the
  // slot being reused always holds the oldest one. Dead slots are just skipped.
  this.list = [];
  for (let i = 0; i < PARTICLES_MAX; i++) {
    this.list.push({ x: 0, y: 0, size: 0, vx: 0, vy: 0, alpha: 0, alphaDecay: 1, speedDecay: 1, growth: 1 });
  }
  this.next = 0;
  this.dot = document.createElement("canvas");
  this.dot.width = PARTICLE_DOT_PX;
  this.dot.height = PARTICLE_DOT_PX;
  const ctx = this.dot.getContext("2d");
  const r = PARTICLE_DOT_PX / 2;
  if (PARTICLE_SOFT) {
    const fade = ctx.createRadialGradient(r, r, 0, r, r, r);
    fade.addColorStop(0, PARTICLE_COLOR);
    fade.addColorStop(PARTICLE_SOFT_CORE, PARTICLE_COLOR);
    fade.addColorStop(1, PARTICLE_COLOR + "00");
    ctx.fillStyle = fade;
  } else {
    ctx.fillStyle = PARTICLE_COLOR;
  }
  ctx.beginPath();
  ctx.arc(r, r, r, 0, Math.PI * 2);
  ctx.fill();
}

// A random offset anywhere within the given amount either side of zero.
Particles.spread = function (amount) {
  return (Math.random() * 2 - 1) * amount;
};

// The per-second fade that takes a particle from its starting alpha down to
// dead in the wanted time.
Particles.fadeDecay = function (alpha, fadeMs) {
  return Math.pow(ALPHA_DEAD / alpha, 1000 / fadeMs);
};

Particles.prototype.emit = function (x, y, size, vx, vy, alpha, alphaDecay, speedDecay, growth) {
  const p = this.list[this.next];
  this.next = (this.next + 1) % PARTICLES_MAX;
  p.x = x;
  p.y = y;
  p.size = size;
  p.vx = vx;
  p.vy = vy;
  p.alpha = alpha;
  p.alphaDecay = alphaDecay;
  p.speedDecay = speedDecay;
  p.growth = growth;
};

Particles.prototype.step = function (dt) {
  for (let i = 0; i < PARTICLES_MAX; i++) {
    const p = this.list[i];
    if (!p.alpha) continue;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.alpha *= Math.pow(p.alphaDecay, dt);
    p.size *= Math.pow(p.growth, dt);
    const slow = Math.pow(p.speedDecay, dt);
    p.vx *= slow;
    p.vy *= slow;
    if (p.alpha < ALPHA_DEAD) p.alpha = 0;
  }
};

Particles.prototype.draw = function (ctx) {
  const alpha = ctx.globalAlpha;
  for (let i = 0; i < PARTICLES_MAX; i++) {
    const p = this.list[i];
    if (!p.alpha) continue;
    ctx.globalAlpha = p.alpha;
    ctx.drawImage(this.dot, p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = alpha;
};

Particles.prototype.clear = function () {
  for (let i = 0; i < PARTICLES_MAX; i++) this.list[i].alpha = 0;
};

// Count is how many dots fan out and scale grows or shrinks them, both
// defaulting to the standard burst. Scale also pulls smaller bursts in closer
// to the center and slows their drift, so a small pop is a smaller copy of a big one.
Particles.prototype.burst = function (cx, cy, cellSize, count = BURST_COUNT, scale = 1) {
  const base = Math.random() * Math.PI * 2;
  for (let i = 0; i < count; i++) {
    const angle = base + i * Math.PI * 2 / count + Particles.spread(BURST_ANGLE_JITTER);
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const start = BURST_START * scale * (1 + Particles.spread(BURST_START_JITTER)) * cellSize;
    const speed = BURST_SPEED * scale * (1 + Particles.spread(BURST_SPEED_JITTER)) * cellSize;
    const alpha = BURST_ALPHA + Particles.spread(BURST_ALPHA_JITTER);
    this.emit(
      cx + dx * start,
      cy + dy * start,
      BURST_SIZE * scale * (1 + Particles.spread(BURST_SIZE_JITTER)) * cellSize,
      dx * speed,
      dy * speed,
      alpha,
      Particles.fadeDecay(alpha, BURST_FADE_MS * (1 + Particles.spread(BURST_FADE_JITTER))),
      BURST_SPEED_DECAY * (1 + Particles.spread(BURST_SPEED_DECAY_JITTER)),
      BURST_GROWTH * (1 + Particles.spread(BURST_GROWTH_JITTER))
    );
  }
};

Particles.prototype.puff = function (cx, cy, cellSize) {
  const alpha = PUFF_ALPHA + Particles.spread(PUFF_ALPHA_JITTER);
  this.emit(
    cx + Particles.spread(PUFF_START_JITTER) * cellSize,
    cy + Particles.spread(PUFF_START_JITTER) * cellSize,
    PUFF_SIZE * (1 + Particles.spread(PUFF_SIZE_JITTER)) * cellSize,
    Particles.spread(PUFF_DRIFT) * cellSize,
    -PUFF_RISE * (1 + Particles.spread(PUFF_RISE_JITTER)) * cellSize,
    alpha,
    Particles.fadeDecay(alpha, PUFF_FADE_MS * (1 + Particles.spread(PUFF_FADE_JITTER))),
    PUFF_SPEED_DECAY * (1 + Particles.spread(PUFF_SPEED_DECAY_JITTER)),
    PUFF_GROWTH * (1 + Particles.spread(PUFF_GROWTH_JITTER))
  );
};
