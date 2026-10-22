/** Map canvas drawing and hit testing. Knows stages and colors only. */

// Every hex is a full-size base tile plus an inner hex. Inner scale is a
// fraction of the radius (0 = bare tile). Line width is lineW * size, never
// under lineMin pixels. "Empty" inner hexes reuse the base fill so tweens to a
// filled stage blend. INFECTED gives [4-stamp, 9-stamp] ranges for scale and fill.
const HEX_BASE_LOOK = { fill: "#1a3a1a", stroke: "#4a7a4a", lineW: 0.08, lineMin: 1.5 };

const HEX_TYPE_LOOK = {
  [STAGE_CLEAR]:        { scale: 0,   fill: HEX_BASE_LOOK.fill, stroke: HEX_BASE_LOOK.stroke, lineW: 0.05, lineMin: 1 },
  [STAGE_JUST_CLEARED]: { scale: 1,   fill: "#d2ffd2",          stroke: "#e6ffe6",            lineW: 0.08, lineMin: 1.5 },
  [STAGE_SAFER]:        { scale: 0.8, fill: "#3c963c",          stroke: "#5abe5a",            lineW: 0.05, lineMin: 1 },
  [STAGE_SAFE]:         { scale: 0.5, fill: "#3c963c",          stroke: "#5abe5a",            lineW: 0.05, lineMin: 1 },
  [STAGE_YELLOW]:       { scale: 0.6, fill: HEX_BASE_LOOK.fill, stroke: "#f2e27a",            lineW: 0.09, lineMin: 1.5 },
  [STAGE_ORANGE]:       { scale: 0.8, fill: HEX_BASE_LOOK.fill, stroke: "#f7a227",            lineW: 0.09, lineMin: 1.5 },
  [STAGE_INFECTED]:     { scale: [0.5, 0.9], fill: ["#6e1c1c", "#c82e1c"], stroke: "#e15a52", lineW: 0.05, lineMin: 1 },
};

function MapDraw() {}

MapDraw.layout = function (canvas, country, insets) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.width / dpr;
  const h = canvas.height / dpr;
  const keys = Object.keys(country.hexes);
  if (!keys.length) return { size: 20, positions: {} };
  const top = (insets && insets.top) || 0;
  const bot = (insets && insets.bot) || 0;
  const left = (insets && insets.left) || 0;
  const right = (insets && insets.right) || 0;

  let minUX = Infinity, maxUX = -Infinity, minUY = Infinity, maxUY = -Infinity;
  for (let i = 0; i < keys.length; i++) {
    const hex = country.hexes[keys[i]];
    const ux = hex.q * 1.5;
    const uy = (hex.r + hex.q / 2) * Math.sqrt(3);
    if (ux < minUX) minUX = ux;
    if (ux > maxUX) maxUX = ux;
    if (uy < minUY) minUY = uy;
    if (uy > maxUY) maxUY = uy;
  }
  const deltaX = maxUX - minUX;
  const deltaY = maxUY - minUY;

  const pad = 24;
  const availW = Math.max(40, w - left - right - pad * 2);
  const availH = Math.max(40, h - top - bot - pad * 2);
  const sizeByW = availW / (deltaX + 2);
  const sizeByH = availH / (deltaY + Math.sqrt(3));
  const size = Math.min(sizeByW, sizeByH);

  const fullW = size * (deltaX + 2);
  const fullH = size * (deltaY + Math.sqrt(3));
  const clearW = w - left - right;
  const clearH = h - top - bot;
  const leftEdge = left + (clearW - fullW) / 2;
  const topEdge = top + (clearH - fullH) / 2;

  // place so the outer edges of the extreme hexes sit on leftEdge / topEdge
  const originX = leftEdge - minUX * size + size;
  const originY = topEdge - minUY * size + (Math.sqrt(3) / 2) * size;

  const positions = {};
  for (let i = 0; i < keys.length; i++) {
    const hex = country.hexes[keys[i]];
    const x = originX + hex.q * size * 1.5;
    const y = originY + (hex.r + hex.q / 2) * size * Math.sqrt(3);
    positions[keys[i]] = { x: x, y: y, q: hex.q, r: hex.r };
  }
  return { size: size, positions: positions };
};

MapDraw.hexPath = function (ctx, x, y, size) {
  // Flat-top: start at 0° so sides align with axial neighbors
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 3 * i;
    const px = x + size * Math.cos(angle);
    const py = y + size * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
};

// Resolve a hex to a ready-to-paint {scale, fill, stroke, lineW}.
MapDraw.lookFor = function (hex, size) {
  const e = HEX_TYPE_LOOK[hex ? hex.stage : STAGE_CLEAR];
  const lineW = Math.max(e.lineMin, size * e.lineW);
  if (!Array.isArray(e.scale)) return { scale: e.scale, fill: e.fill, stroke: e.stroke, lineW: lineW };
  const pieces = hex.plan && hex.plan.stamps ? hex.plan.stamps.length : 4;
  const t = Math.max(0, Math.min(1, (pieces - 4) / 5));
  return {
    scale: e.scale[0] + (e.scale[1] - e.scale[0]) * t,
    fill: MapDraw.lerpColor(e.fill[0], e.fill[1], t),
    stroke: e.stroke,
    lineW: lineW,
  };
};

MapDraw.captureStyles = function (country, size) {
  const styles = {};
  const keys = Object.keys(country.hexes);
  for (let i = 0; i < keys.length; i++) {
    styles[keys[i]] = MapDraw.lookFor(country.hexes[keys[i]], size);
  }
  return styles;
};

// Blend two "#rrggbb" colors; returns "#rrggbb".
MapDraw.lerpColor = function (a, b, t) {
  const x = parseInt(a.slice(1), 16);
  const y = parseInt(b.slice(1), 16);
  let out = 0;
  for (let shift = 16; shift >= 0; shift -= 8) {
    const ca = (x >> shift) & 255;
    out |= ((ca + (((y >> shift) & 255) - ca) * t) | 0) << shift;
  }
  return "#" + out.toString(16).padStart(6, "0");
};

MapDraw.render = function (ctx, country, layout, highlightKey, fade) {
  const dpr = window.devicePixelRatio || 1;
  const w = ctx.canvas.width / dpr;
  const h = ctx.canvas.height / dpr;
  ctx.fillStyle = "#0a1a2a";
  ctx.fillRect(0, 0, w, h);
  const keys = Object.keys(layout.positions || {});
  const size = layout.size;
  const baseLW = Math.max(HEX_BASE_LOOK.lineMin, size * HEX_BASE_LOOK.lineW);
  const t = fade && fade.t != null ? Math.max(0, Math.min(1, fade.t)) : 1;
  const s = t * t * (3 - 2 * t); // smoothstep
  const oldStyles = fade && fade.oldStyles;

  // Pass 1: base tiles at full radius, sharing edges with neighbors.
  for (let i = 0; i < keys.length; i++) {
    const pos = layout.positions[keys[i]];
    MapDraw.paintHexAt(ctx, pos.x, pos.y, size,
      { fill: HEX_BASE_LOOK.fill, stroke: HEX_BASE_LOOK.stroke, lineW: baseLW });
  }

  // Pass 2: inner hexes, after all bases so a full-size inner (JUST_CLEARED)
  // is not half-covered by a later neighbor's edge.
  for (let i = 0; i < keys.length; i++) {
    const pos = layout.positions[keys[i]];
    const to = MapDraw.lookFor(country.hexes[keys[i]], size);
    const from = oldStyles && t < 1 ? oldStyles[keys[i]] : null;
    let st = to;
    if (from) {
      // Growing from or shrinking to a bare tile keeps the visible side's colors.
      const colorsFrom = from.scale === 0 ? to : from;
      const colorsTo = to.scale === 0 ? from : to;
      st = {
        scale: from.scale + (to.scale - from.scale) * s,
        fill: MapDraw.lerpColor(colorsFrom.fill, colorsTo.fill, s),
        stroke: MapDraw.lerpColor(colorsFrom.stroke, colorsTo.stroke, s),
        lineW: colorsFrom.lineW + (colorsTo.lineW - colorsFrom.lineW) * s,
      };
    }
    if (size * st.scale > 0.5) MapDraw.paintHexAt(ctx, pos.x, pos.y, size * st.scale, st);
  }

  // Pass 3: selection on the full tile edge, same width as the base border.
  const sel = highlightKey && layout.positions[highlightKey];
  if (sel) {
    MapDraw.hexPath(ctx, sel.x, sel.y, size);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
    ctx.lineWidth = baseLW;
    ctx.stroke();
  }
};

MapDraw.paintHexAt = function (ctx, x, y, pathSize, style) {
  if (pathSize <= 0) return;
  MapDraw.hexPath(ctx, x, y, pathSize);
  ctx.fillStyle = style.fill;
  ctx.fill();
  ctx.strokeStyle = style.stroke;
  ctx.lineWidth = style.lineW;
  ctx.stroke();
};

MapDraw.hit = function (layout, x, y) {
  if (!layout || !layout.positions) return null;
  const size = layout.size;
  const keys = Object.keys(layout.positions);
  let best = null;
  let bestD = size * size;
  for (let i = 0; i < keys.length; i++) {
    const pos = layout.positions[keys[i]];
    const dx = x - pos.x;
    const dy = y - pos.y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = keys[i];
    }
  }
  return bestD < size * size ? best : null;
};
