/** Generic particle pool: white fading dots that drift, slow or speed up, swell, and vanish. */

// Most particles alive at once; new emits are dropped while full.
const PARTICLES_MAX = 400;
// A particle this faint is gone.
const ALPHA_DEAD = 0.02;
const PARTICLE_COLOR = "#ffffff";

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
  this.list = [];
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
  if (this.list.length >= PARTICLES_MAX) return;
  this.list.push({ x: x, y: y, size: size, vx: vx, vy: vy, alpha: alpha, alphaDecay: alphaDecay, speedDecay: speedDecay, growth: growth });
};

Particles.prototype.step = function (dt) {
  let i = 0;
  while (i < this.list.length) {
    const p = this.list[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.alpha *= Math.pow(p.alphaDecay, dt);
    p.size *= Math.pow(p.growth, dt);
    const slow = Math.pow(p.speedDecay, dt);
    p.vx *= slow;
    p.vy *= slow;
    if (p.alpha >= ALPHA_DEAD) {
      i++;
      continue;
    }
    // Swap the last particle into this slot and look at the slot again.
    this.list[i] = this.list[this.list.length - 1];
    this.list.pop();
  }
};

Particles.prototype.draw = function (ctx) {
  if (!this.list.length) return;
  const alpha = ctx.globalAlpha;
  ctx.fillStyle = PARTICLE_COLOR;
  for (let i = 0; i < this.list.length; i++) {
    const p = this.list[i];
    ctx.globalAlpha = p.alpha;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = alpha;
};

Particles.prototype.clear = function () {
  this.list.length = 0;
};

// Count is how many dots fan out and scale grows or shrinks them, both
// defaulting to the standard burst.
Particles.prototype.burst = function (cx, cy, cellSize, count = BURST_COUNT, scale = 1) {
  const base = Math.random() * Math.PI * 2;
  for (let i = 0; i < count; i++) {
    const angle = base + i * Math.PI * 2 / count + Particles.spread(BURST_ANGLE_JITTER);
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const start = BURST_START * (1 + Particles.spread(BURST_START_JITTER)) * cellSize;
    const speed = BURST_SPEED * (1 + Particles.spread(BURST_SPEED_JITTER)) * cellSize;
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
