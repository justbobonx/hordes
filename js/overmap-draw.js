/** Map canvas drawing and hit testing. Knows stages and colors only. */

function MapDraw() {}

MapDraw.layout = function (canvas, country) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.width / dpr;
  const h = canvas.height / dpr;
  const keys = Object.keys(country.hexes);
  if (!keys.length) return { size: 20, positions: {} };

  let minQ = Infinity, maxQ = -Infinity, minR = Infinity, maxR = -Infinity;
  for (let i = 0; i < keys.length; i++) {
    const hex = country.hexes[keys[i]];
    if (hex.q < minQ) minQ = hex.q;
    if (hex.q > maxQ) maxQ = hex.q;
    if (hex.r < minR) minR = hex.r;
    if (hex.r > maxR) maxR = hex.r;
  }

  // Compute bounding box in axial flat-top space, then scale to fill screen with padding
  const spanQ = maxQ - minQ + 1;
  const spanR = maxR - minR + 1;
  const pad = 24;
  const availW = Math.max(40, w - pad * 2);
  const availH = Math.max(40, h - pad * 2);
  // Flat-top: width ~ size * 1.5 * spanQ, height ~ size * √3 * spanR
  const sizeByW = availW / (spanQ * 1.5 + 0.5);
  const sizeByH = availH / (spanR * Math.sqrt(3) + 0.5);
  const size = Math.max(14, Math.min(sizeByW, sizeByH, 42) * 0.92);

  const totalW = spanQ * size * 1.5;
  const totalH = spanR * size * Math.sqrt(3);
  const originX = (w - totalW) / 2 - minQ * size * 1.5 + size * 0.25;
  const originY = (h - totalH) / 2 - minR * size * Math.sqrt(3) + size * 0.5;

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

MapDraw.render = function (ctx, country, layout, highlightKey) {
  const dpr = window.devicePixelRatio || 1;
  const w = ctx.canvas.width / dpr;
  const h = ctx.canvas.height / dpr;
  ctx.fillStyle = "#0a1a2a";
  ctx.fillRect(0, 0, w, h);
  const keys = Object.keys(layout.positions || {});
  for (let i = 0; i < keys.length; i++) {
    const pos = layout.positions[keys[i]];
    const hex = country.hexes[keys[i]];
    MapDraw.drawHex(ctx, pos.x, pos.y, layout.size, hex, keys[i] === highlightKey);
  }
};

MapDraw.drawHex = function (ctx, x, y, size, hex, highlight) {
  MapDraw.hexPath(ctx, x, y, size * 0.94);
  let fill = "#1a3a1a";
  let stroke = "#4a7a4a";
  let lineW = Math.max(1.5, size * 0.08);
  if (hex.stage === STAGE_YELLOW) {
    fill = "#1a3a1a";
    stroke = "#f2e27a";
    lineW = Math.max(2, size * 0.12);
  } else if (hex.stage === STAGE_RED_OUTLINE) {
    fill = "#1a3a1a";
    stroke = "#e15a52";
    lineW = Math.max(2, size * 0.12);
  } else if (hex.stage === STAGE_INFECTED) {
    const pieces = hex.plan && hex.plan.stamps ? hex.plan.stamps.length : 4;
    const t = Math.max(0, Math.min(1, (pieces - 4) / 5));
    const r = 110 + t * 90;
    const g = 28 + t * 18;
    const b = 28;
    fill = "rgb(" + (r|0) + "," + (g|0) + "," + b + ")";
    stroke = "#e15a52";
    lineW = Math.max(1.5, size * 0.08);
  }
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineW;
  ctx.stroke();
  if (highlight) {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = lineW + 1;
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
