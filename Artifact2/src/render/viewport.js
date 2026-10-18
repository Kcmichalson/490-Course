// Viewport transform math. Pure functions on a plain view object:
//   view = { scale, offsetX, offsetY }
//   screen = source * scale + offset      (CSS pixels)
// No DOM here, so it can be tested in Node.

export const MAX_SCALE = 32;          // 3200 %: one source pixel = 32 screen px
const MIN_FRACTION_OF_FIT = 0.5;      // can zoom out to half the fit scale
const FIT_MARGIN = 0.96;              // leave a small border when fitting

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function sourceToScreen(view, x, y) {
  return { x: x * view.scale + view.offsetX, y: y * view.scale + view.offsetY };
}

export function screenToSource(view, sx, sy) {
  return { x: (sx - view.offsetX) / view.scale, y: (sy - view.offsetY) / view.scale };
}

export function fitScale(mapW, mapH, viewW, viewH) {
  return Math.min(viewW / mapW, viewH / mapH) * FIT_MARGIN;
}

export function scaleLimits(mapW, mapH, viewW, viewH) {
  const fit = fitScale(mapW, mapH, viewW, viewH);
  return { min: fit * MIN_FRACTION_OF_FIT, max: Math.max(MAX_SCALE, fit) };
}

// Whole map centered in the viewport.
export function fitView(mapW, mapH, viewW, viewH) {
  const scale = fitScale(mapW, mapH, viewW, viewH);
  return { scale, offsetX: (viewW - mapW * scale) / 2, offsetY: (viewH - mapH * scale) / 2 };
}

// Zoom by a factor while keeping the source point under (sx, sy) fixed.
export function zoomAt(view, factor, sx, sy, limits) {
  const scale = clamp(view.scale * factor, limits.min, limits.max);
  const k = scale / view.scale;
  return { scale, offsetX: sx - (sx - view.offsetX) * k, offsetY: sy - (sy - view.offsetY) * k };
}

export function zoomToScale(view, scale, sx, sy, limits) {
  return zoomAt(view, scale / view.scale, sx, sy, limits);
}

export function panBy(view, dx, dy) {
  return { ...view, offsetX: view.offsetX + dx, offsetY: view.offsetY + dy };
}

// Put source point (x, y) at the viewport center.
export function centerOn(view, x, y, viewW, viewH) {
  return { ...view, offsetX: viewW / 2 - x * view.scale, offsetY: viewH / 2 - y * view.scale };
}

// A map smaller than the viewport stays fully inside it; a larger one can't
// leave empty space at its edges.
function clampAxis(offset, size, viewSize) {
  if (size <= viewSize) return clamp(offset, 0, viewSize - size);
  return clamp(offset, viewSize - size, 0);
}

// Keeps the map on screen. Vertical is always clamped (no north-south wrap).
// On wrapping maps, offsetX is kept in [-W*scale, 0) so it never grows; the
// renderer draws as many copies as needed to fill the viewport.
export function clampView(view, map, viewW, viewH) {
  const w = map.width * view.scale;
  const h = map.height * view.scale;
  const offsetY = clampAxis(view.offsetY, h, viewH);
  const offsetX = map.wraps
    ? (((view.offsetX % w) + w) % w) - w
    : clampAxis(view.offsetX, w, viewW);
  return { scale: view.scale, offsetX, offsetY };
}

// Indices k of the map copies (drawn at offsetX + k*W*scale) that intersect
// the viewport. Non-wrapping maps have only copy 0.
export function visibleCopies(view, mapW, viewW, wraps) {
  if (!wraps) return [0];
  const w = mapW * view.scale;
  const first = Math.floor(-view.offsetX / w);
  const last = Math.ceil((viewW - view.offsetX) / w) - 1;
  const ks = [];
  for (let k = first; k <= last; k++) ks.push(k);
  return ks;
}

export function zoomPercent(view) {
  return view.scale * 100;
}

// Wheel delta → zoom factor. Handles line/page delta modes, and the small
// deltas trackpad pinches send (with ctrlKey set).
export function wheelZoomFactor(deltaY, deltaMode = 0, ctrlKey = false) {
  let px = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 800 : deltaY;
  px = clamp(px, -300, 300);
  return Math.exp(-px * (ctrlKey ? 0.01 : 0.0015));
}
