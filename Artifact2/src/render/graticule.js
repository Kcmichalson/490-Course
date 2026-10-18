// Graticule overlay: latitude/longitude lines with small degree labels.
// Drawn in screen space every frame, so lines stay crisp at any zoom and
// repeat across wrapped copies. The spacing tightens as you zoom in
// (30° → 10° → 5° → 2° → 1°). Tropics and polar circles join in M3.

import { visibleCopies } from './viewport.js';
import { normalizeLon } from '../sim/coords.js';

const STEPS = [1, 2, 5, 10, 30];
const MIN_SPACING_PX = 70;
const LINE = 'rgba(255, 255, 255, 0.20)';
const LINE_STRONG = 'rgba(255, 255, 255, 0.42)';
const LABEL = 'rgba(255, 255, 255, 0.85)';
const HALO = 'rgba(0, 0, 0, 0.55)';

function chooseStep(pxPerDeg) {
  return STEPS.find((s) => s * pxPerDeg >= MIN_SPACING_PX) ?? STEPS[STEPS.length - 1];
}

const latLabel = (lat) => (lat === 0 ? '0°' : `${Math.abs(lat)}°${lat > 0 ? 'N' : 'S'}`);
function lonLabel(lon) {
  const l = Math.round(normalizeLon(lon));
  if (l === 0 || l === -180) return l === 0 ? '0°' : '180°';
  return `${Math.abs(l)}°${l > 0 ? 'E' : 'W'}`;
}

export function drawGraticule(ctx, { map, view, viewW, viewH, dpr }) {
  const s = view.scale;
  const mapW = map.sourceWidth * s;
  const mapH = map.sourceHeight * s;
  const latRange = map.latTop - map.latBottom;
  const step = chooseStep(Math.min(mapH / latRange, mapW / map.lonSpan));

  const top = view.offsetY;
  const L = Math.max(0, map.wraps ? 0 : view.offsetX);
  const R = Math.min(viewW, map.wraps ? viewW : view.offsetX + mapW);
  const T = Math.max(0, top);
  const B = Math.min(viewH, top + mapH);
  if (R <= L || B <= T) return;

  // Align 1-px lines to the device pixel grid.
  const devW = Math.max(1, Math.round(dpr));
  const snap = (v) => (Math.round(v * dpr) + (devW % 2) / 2) / dpr;

  ctx.save();
  ctx.lineWidth = devW / dpr;
  ctx.font = '10px system-ui, -apple-system, "Segoe UI", sans-serif';
  const labels = [];

  // Parallels
  for (let lat = Math.ceil(map.latBottom / step) * step; lat <= map.latTop; lat += step) {
    if (lat === map.latTop || lat === map.latBottom) continue; // map edges
    const y = top + ((map.latTop - lat) / latRange) * mapH;
    if (y < T - 1 || y > B + 1) continue;
    ctx.strokeStyle = lat === 0 ? LINE_STRONG : LINE;
    ctx.beginPath();
    ctx.moveTo(L, snap(y));
    ctx.lineTo(R, snap(y));
    ctx.stroke();
    if (y - 3 > T + 16) labels.push({ text: latLabel(lat), x: L + 4, y: y - 3, baseline: 'alphabetic' });
  }

  // Meridians, once per visible copy
  const lonEnd = map.lonWest + map.lonSpan;
  for (const k of visibleCopies(view, map.sourceWidth, viewW, map.wraps)) {
    const copyX = view.offsetX + k * mapW;
    for (let lon = Math.ceil(map.lonWest / step) * step; lon <= lonEnd; lon += step) {
      if (map.wraps ? lon === lonEnd : lon === map.lonWest || lon === lonEnd) continue;
      const x = copyX + ((lon - map.lonWest) / map.lonSpan) * mapW;
      if (x < L - 1 || x > R + 1) continue;
      ctx.strokeStyle = Math.round(normalizeLon(lon)) === 0 ? LINE_STRONG : LINE;
      ctx.beginPath();
      ctx.moveTo(snap(x), T);
      ctx.lineTo(snap(x), B);
      ctx.stroke();
      if (x + 3 > L + 34) labels.push({ text: lonLabel(lon), x: x + 3, y: T + 4, baseline: 'top' });
    }
  }

  // Labels last, with a dark halo so they read over any map mode.
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  for (const l of labels) {
    ctx.textBaseline = l.baseline;
    ctx.strokeStyle = HALO;
    ctx.strokeText(l.text, l.x, l.y);
    ctx.fillStyle = LABEL;
    ctx.fillText(l.text, l.x, l.y);
  }
  ctx.restore();
}
