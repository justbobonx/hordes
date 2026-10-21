/** Map canvas drawing and hit testing. Knows stages and colors only. */

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

MapDraw.styleFor = function (hex, size) {
  const baseFill = [26, 58, 26];
  const baseStroke = [74, 122, 74];
  const baseLW = Math.max(1.5, size * 0.08);
  const thickLW = Math.max(2, size * 0.12);
  if (!hex || hex.stage === STAGE_CLEAR) {
    return { fill: baseFill, stroke: baseStroke, lineW: baseLW };
  }
  if (hex.stage === STAGE_JUST_CLEARED) {
    return { fill: [210, 255, 210], stroke: [230, 255, 230], lineW: baseLW };
  }
  if (hex.stage === STAGE_SAFER || hex.stage === STAGE_SAFE) {
    return { fill: [60, 150, 60], stroke: [90, 190, 90], lineW: baseLW };
  }
  if (hex.stage === STAGE_YELLOW) {
    return { fill: baseFill, stroke: [242, 226, 122], lineW: thickLW };
  }
  if (hex.stage === STAGE_RED_OUTLINE) {
    return { fill: baseFill, stroke: [247, 162, 39], lineW: thickLW };
  }
  // STAGE_INFECTED
  const pieces = hex.plan && hex.plan.stamps ? hex.plan.stamps.length : 4;
  const t = Math.max(0, Math.min(1, (pieces - 4) / 5));
  const r = 110 + t * 90;
  const g = 28 + t * 18;
  const b = 28;
  return { fill: [r | 0, g | 0, b], stroke: [225, 90, 82], lineW: baseLW };
};

MapDraw.captureStyles = function (country, size) {
  const styles = {};
  const keys = Object.keys(country.hexes);
  for (let i = 0; i < keys.length; i++) {
    const hex = country.hexes[keys[i]];
    const st = MapDraw.styleFor(hex, size);
    st.stage = hex.stage;
    // explicit visual scale at capture time so later stage changes cannot confuse the shrink
    if (hex.stage === STAGE_SAFE) st.scale = 0.4;
    else if (hex.stage === STAGE_SAFER || hex.stage === STAGE_JUST_CLEARED) st.scale = 0.9;
    else st.scale = 0.9;
    styles[keys[i]] = st;
  }
  return styles;
};

MapDraw.lerpColor = function (a, b, t) {
  return [
    (a[0] + (b[0] - a[0]) * t) | 0,
    (a[1] + (b[1] - a[1]) * t) | 0,
    (a[2] + (b[2] - a[2]) * t) | 0,
  ];
};

MapDraw.render = function (ctx, country, layout, highlightKey, fade) {
  const dpr = window.devicePixelRatio || 1;
  const w = ctx.canvas.width / dpr;
  const h = ctx.canvas.height / dpr;
  ctx.fillStyle = "#0a1a2a";
  ctx.fillRect(0, 0, w, h);
  const keys = Object.keys(layout.positions || {});
  const size = layout.size;
  const t = fade && fade.t != null ? Math.max(0, Math.min(1, fade.t)) : 1;
  const oldStyles = fade && fade.oldStyles;
  for (let i = 0; i < keys.length; i++) {
    const pos = layout.positions[keys[i]];
    const hex = country.hexes[keys[i]];
    const highlight = keys[i] === highlightKey;
    if (oldStyles && oldStyles[keys[i]] && t < 1) {
      const from = oldStyles[keys[i]];
      const to = MapDraw.styleFor(hex, size);
      to.stage = hex.stage;
      MapDraw.drawHexLerp(ctx, pos.x, pos.y, size, from, to, t, highlight);
    } else {
      MapDraw.drawHex(ctx, pos.x, pos.y, size, hex, highlight);
    }
  }
};

MapDraw.drawHex = function (ctx, x, y, size, hex, highlight) {
  if (hex && hex.stage === STAGE_SAFE) {
    const base = MapDraw.styleFor({ stage: STAGE_CLEAR }, size);
    MapDraw.paintHex(ctx, x, y, size, base, false);
    const med = { fill: [60, 150, 60], stroke: [90, 190, 90], lineW: Math.max(1, size * 0.05) };
    MapDraw.paintHexAt(ctx, x, y, size * 0.4, med, highlight);
    return;
  }
  const st = MapDraw.styleFor(hex, size);
  MapDraw.paintHex(ctx, x, y, size, st, highlight);
};

MapDraw.drawHexLerp = function (ctx, x, y, size, from, to, t, highlight) {
  const s = t * t * (3 - 2 * t); // smoothstep
  const fromStage = from.stage;
  const toStage = to.stage;
  const fromScale = from.scale != null ? from.scale : 0.9;
  const medFill = [60, 150, 60];
  const med = { fill: medFill, stroke: [90, 190, 90], lineW: Math.max(1, size * 0.05) };

  // SAFER (full) → SAFE (inset): shrink from 0.9 to 0.4
  if (fromScale > 0.5 && toStage === STAGE_SAFE) {
    const base = MapDraw.styleFor({ stage: STAGE_CLEAR }, size);
    MapDraw.paintHex(ctx, x, y, size, base, false);
    const pathSize = size * (0.9 + (0.4 - 0.9) * s);
    MapDraw.paintHexAt(ctx, x, y, pathSize, med, highlight);
    return;
  }

  // SAFE (inset) → CLEAR: shrink from 0.4 to 0
  if (fromScale <= 0.5 && toStage === STAGE_CLEAR) {
    const base = MapDraw.styleFor({ stage: STAGE_CLEAR }, size);
    MapDraw.paintHex(ctx, x, y, size, base, false);
    const pathSize = size * fromScale * (1 - s);
    if (pathSize > 0.5) MapDraw.paintHexAt(ctx, x, y, pathSize, med, highlight);
    return;
  }

  // default color lerp
  const fill = MapDraw.lerpColor(from.fill, to.fill, s);
  const stroke = MapDraw.lerpColor(from.stroke, to.stroke, s);
  const lineW = from.lineW + (to.lineW - from.lineW) * s;
  MapDraw.paintHex(ctx, x, y, size, { fill: fill, stroke: stroke, lineW: lineW }, highlight);
};

MapDraw.paintHex = function (ctx, x, y, size, style, highlight) {
  MapDraw.paintHexAt(ctx, x, y, size * 0.9, style, highlight);
};

MapDraw.paintHexAt = function (ctx, x, y, pathSize, style, highlight) {
  if (pathSize <= 0) return;
  MapDraw.hexPath(ctx, x, y, pathSize);
  ctx.fillStyle = "rgb(" + style.fill[0] + "," + style.fill[1] + "," + style.fill[2] + ")";
  ctx.fill();
  ctx.strokeStyle = "rgb(" + style.stroke[0] + "," + style.stroke[1] + "," + style.stroke[2] + ")";
  ctx.lineWidth = style.lineW;
  ctx.stroke();
  if (highlight) {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = style.lineW + 1;
    ctx.stroke();
  }
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
  return bestD < (size * 0.9) * (size * 0.9) ? best : null;
};
