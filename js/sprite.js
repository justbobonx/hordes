/** Named drawable. Bitmaps are 32x32; fill color used until image loads. */

const TILE = 32;

function Sprite(id) {
  this.id = id;
  this.image = null;
  this.tile = TILE;
}

Sprite.prototype.load = function (src, done) {
  const img = new Image();
  const self = this;
  img.onload = function () {
    self.image = img;
    if (done) done(self);
  };
  img.src = src;
  return this;
};

Sprite.prototype.draw = function (ctx, x, y, size) {
  if (!this.image) return;
  ctx.drawImage(this.image, 0, 0, this.tile, this.tile, x, y, size, size);
};

function SpriteBank() {
  this.map = {};
}

SpriteBank.prototype.add = function (sprite) {
  this.map[sprite.id] = sprite;
  return sprite;
};

SpriteBank.prototype.get = function (id) {
  return id ? this.map[id] || null : null;
};

SpriteBank.defaults = function (onReady) {
  const bank = new SpriteBank();
  const grass = bank.add(new Sprite("grass"));
  const scorched = bank.add(new Sprite("scorched"));
  const city = bank.add(new Sprite("city"));
  const horde = bank.add(new Sprite("horde"));
  const cleared = bank.add(new Sprite("cleared"));
  const ruined = bank.add(new Sprite("ruined"));
  const clearedHint = bank.add(new Sprite("cleared_hint"));
  let left = 7;
  function tick() {
    left--;
    if (left <= 0 && onReady) onReady();
  }
  grass.load("images/grass.png", tick);
  scorched.load("images/grass_scorched.png", tick);
  city.load("images/city.png", tick);
  horde.load("images/horde.png", tick);
  cleared.load("images/horde_scorched.png", tick);
  ruined.load("images/city_ruins.png", tick);
  clearedHint.load("images/horde_scorched_hint.png", tick);
  return bank;
};
