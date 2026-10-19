// Wind Arrows overlay (SPEC 13.4, M3): short curved streamlines with an
// arrowhead, drawn in screen space each frame on every visible wrapped copy,
// plus optional band labels. Arrows sit on a lattice of sim cells anchored to
// the map (so they don't swim while panning), thinned by powers of two as you
// zoom out. Pure helpers are exported for tests.

import { visibleCopies } from './viewport.js';

export const ARROW_MIN_SPACING_PX = 36;
const STEPS = 4;            // streamline steps per arrow
const MIN_ARROW_PX = 4;
const DRAW_CUTOFF = 0.05;   // |(u,v)| below this: no arrow
const VARIABLE_MIN_SPEED = 0.2; // Annual Mean: "variable winds" marker when the mean speed is at least this
const LABEL_EVERY_PX = 700;
const LABEL_MIN_BAND_PX = 18;
const LABEL_LEFT_PX = 60;   // clear of the graticule's latitude labels
const MIN_COS = 0.05;

// Smallest power-of-two stride (in sim cells) whose spacing on screen is at
// least minPx.
export function arrowStride(cellScreenPx, minPx = ARROW_MIN_SPACING_PX) {
  let s = 1;
  while (s * cellScreenPx < minPx && s < 1 << 16) s *= 2;
  return s;
}

// Screen direction (unit vector) of a wind vector on an equirectangular map.
// East-west distances shrink with cos(latitude), so the same u moves farther
// across the map near the poles; screen y points down, so v is negated.
// Only the direction uses this; arrow length is set separately, so the 1/cosφ
// factor never stretches arrows.
export function screenDirection(u, v, latDeg, degPerPxX, degPerPxY) {
  const c = Math.max(MIN_COS, Math.cos((latDeg * Math.PI) / 180));
  const dx = u / (c * degPerPxX);
  const dy = -v / degPerPxY;
  const m = Math.hypot(dx, dy);
  return m > 0 ? { dx: dx / m, dy: dy / m } : { dx: 0, dy: 0 };
}

// Wraps (or clamps) a sim column index.
export const wrapCol = (i, width, wraps) => (wraps ? ((i % width) + width) % width : Math.min(width - 1, Math.max(0, i)));

// Bilinear wind at a continuous source position (x, y) → { u, v, speed }.
export function sampleWind(climate, map, x, y) {
  const { width: W, height: H } = climate.grid;
  const fx = (x / map.sourceWidth) * W - 0.5;
  const fy = Math.min(H - 1, Math.max(0, (y / map.sourceHeight) * H - 0.5));
  const i0 = Math.floor(fx);
  const j0 = Math.floor(fy);
  const tx = fx - i0;
  const ty = fy - j0;
  const j1 = Math.min(H - 1, j0 + 1);
  const a = wrapCol(i0, W, map.wraps);
  const b = wrapCol(i0 + 1, W, map.wraps);
  const r = climate.result;
  const lerp = (f) => {
    const top = f[j0 * W + a] * (1 - tx) + f[j0 * W + b] * tx;
    const bot = f[j1 * W + a] * (1 - tx) + f[j1 * W + b] * tx;
    return top * (1 - ty) + bot * ty;
  };
  return { u: lerp(r.u), v: lerp(r.v), speed: lerp(r.speed) };
}

const latAt = (map, y) => map.latTop - (y / map.sourceHeight) * (map.latTop - map.latBottom);

// Streamline from a source position: STEPS points, each a fixed screen
// distance (lengthPx / STEPS) along the local projected wind direction.
// → [{ x, y }] in source px (STEPS + 1 points).
export function streamline(climate, map, x, y, lengthPx, scale) {
  const degX = map.lonSpan / map.sourceWidth;
  const degY = (map.latTop - map.latBottom) / map.sourceHeight;
  const stepSrc = lengthPx / STEPS / scale;
  const pts = [{ x, y }];
  for (let s = 0; s < STEPS; s++) {
    const w = sampleWind(climate, map, x, y);
    const d = screenDirection(w.u, w.v, latAt(map, y), degX, degY);
    x += d.dx * stepSrc;
    y = Math.min(map.sourceHeight, Math.max(0, y + d.dy * stepSrc));
    pts.push({ x, y });
  }
  return pts;
}

function overlapsAny(box, rects) {
  return rects.some((r) => box.x < r.x + r.w && box.x + box.w > r.x && box.y < r.y + r.h && box.y + box.h > r.y);
}

// env: { map, view, viewW, viewH, theme, reserved, climate: { result, grid }, labels }
export function drawWindArrows(ctx, env) {
  const { map, view, viewW, viewH, theme, climate } = env;
  if (!climate?.result) return;
  const { width: W, height: H } = climate.grid;
  const s = view.scale;
  const cellW = (map.sourceWidth / W) * s;
  const cellH = (map.sourceHeight / H) * s;
  const stride = arrowStride(Math.min(cellW, cellH));
  const spacing = stride * Math.min(cellW, cellH);
  const maxLen = spacing * 0.8;
  const annual = Boolean(climate.result.meta?.annual);
  const mapW = map.sourceWidth * s;
  const off = Math.floor(stride / 2);

  const arrows = [];
  const markers = [];
  const j0 = Math.max(0, Math.floor((-view.offsetY / s / map.sourceHeight) * H) - stride);
  const j1 = Math.min(H - 1, Math.ceil(((viewH - view.offsetY) / s / map.sourceHeight) * H) + stride);
  for (const k of visibleCopies(view, map.sourceWidth, viewW, map.wraps)) {
    const copyX = view.offsetX + k * mapW;
    const i0 = Math.max(0, Math.floor((-copyX / s / map.sourceWidth) * W) - stride);
    const i1 = Math.min(W - 1, Math.ceil(((viewW - copyX) / s / map.sourceWidth) * W) + stride);
    const iStart = Math.ceil((i0 - off) / stride) * stride + off;
    const jStart = Math.ceil((j0 - off) / stride) * stride + off;
    for (let j = jStart; j <= j1; j += stride) {
      const y = ((j + 0.5) / H) * map.sourceHeight;
      for (let i = iStart; i <= i1; i += stride) {
        const x = ((i + 0.5) / W) * map.sourceWidth;
        const idx = j * W + i;
        const mag = Math.hypot(climate.result.u[idx], climate.result.v[idx]);
        const sx = copyX + x * s;
        const sy = view.offsetY + y * s;
        if (mag < DRAW_CUTOFF) {
          if (annual && climate.result.speed[idx] >= VARIABLE_MIN_SPEED) markers.push({ sx, sy });
          continue;
        }
        const len = Math.max(MIN_ARROW_PX, maxLen * Math.min(1, mag));
        const pts = streamline(climate, map, x, y, len, s);
        // Center the arrow on its lattice point.
        const mid = pts[STEPS >> 1];
        const shiftX = (x - mid.x) * s;
        const shiftY = (y - mid.y) * s;
        arrows.push(pts.map((p) => ({ x: copyX + p.x * s + shiftX, y: view.offsetY + p.y * s + shiftY })));
      }
    }
  }

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const pass of [{ color: theme.windArrowHalo, width: 3.5 }, { color: theme.windArrow, width: 1.5 }]) {
    ctx.strokeStyle = pass.color;
    ctx.lineWidth = pass.width;
    ctx.beginPath();
    for (const pts of arrows) {
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let p = 1; p < pts.length; p++) ctx.lineTo(pts[p].x, pts[p].y);
      // Arrowhead along the last segment.
      const a = pts[pts.length - 2];
      const b = pts[pts.length - 1];
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      const head = Math.min(6, Math.max(3, Math.hypot(b.x - pts[0].x, b.y - pts[0].y) * 0.35));
      ctx.moveTo(b.x - head * Math.cos(ang - 0.5), b.y - head * Math.sin(ang - 0.5));
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(b.x - head * Math.cos(ang + 0.5), b.y - head * Math.sin(ang + 0.5));
    }
    ctx.stroke();
    ctx.beginPath();
    for (const m of markers) {
      ctx.moveTo(m.sx + 3, m.sy);
      ctx.arc(m.sx, m.sy, 3, 0, Math.PI * 2);
    }
    ctx.stroke();
  }
  if (env.labels) drawBandLabels(ctx, env);
  ctx.restore();
}

const yOfLat = (map, view, lat) => view.offsetY + ((map.latTop - lat) / (map.latTop - map.latBottom)) * map.sourceHeight * view.scale;

// One label per band per hemisphere at its center latitude, repeated across
// the view; skipped where the band is too thin or an on-map control covers it.
function drawBandLabels(ctx, { map, view, viewW, theme, reserved = [], climate }) {
  const mapW = map.sourceWidth * view.scale;
  const left = map.wraps ? 0 : Math.max(0, view.offsetX);
  const right = map.wraps ? viewW : Math.min(viewW, view.offsetX + mapW);
  ctx.font = '600 11px system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 3;
  for (const band of climate.result.meta.bands) {
    if (band.latCenter > map.latTop || band.latCenter < map.latBottom) continue;
    const y0 = yOfLat(map, view, Math.min(map.latTop, Math.max(band.lat0, band.lat1)));
    const y1 = yOfLat(map, view, Math.max(map.latBottom, Math.min(band.lat0, band.lat1)));
    if (y1 - y0 < LABEL_MIN_BAND_PX) continue;
    const y = yOfLat(map, view, band.latCenter);
    const w = ctx.measureText(band.name).width;
    for (let x = left + LABEL_LEFT_PX; x + w <= right; x += LABEL_EVERY_PX) {
      if (overlapsAny({ x: x - 4, y: y - 9, w: w + 8, h: 18 }, reserved)) continue;
      ctx.strokeStyle = theme.labelHalo;
      ctx.strokeText(band.name, x, y);
      ctx.fillStyle = theme.bandLabel;
      ctx.fillText(band.name, x, y);
    }
  }
}
