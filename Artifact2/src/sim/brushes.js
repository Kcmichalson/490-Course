// Sculpt brushes (SPEC 2.1). Pure: each dab reads the composed terrain,
// writes the edits layer, and recomposes the pixels it changed. Returns the
// dirty rectangles (split at the date line on wrapping maps) so the caller
// redraws and re-downsamples only those.
//
// Brush rules:
// - raise / lower: relative, cosine falloff; lakes skipped; sea ice acts as
//   ocean seafloor. Category comes from the compose rule (ocean raised
//   above 0 m becomes land; land lowered below 0 m stays land).
// - carve-trench: relative, ocean and sea ice only, sharper falloff.
// - smooth: relative, blends toward the local mean; never changes a
//   category or moves a coast; lakes skipped and left out of the mean.
// - draw-land: water (ocean, sea ice, lake) → LAND at max(current, 200 m).
// - erase: land, land ice, lake → OCEAN at min(current, −100 m).
//   Draw Land and Erase have a hard edge and ignore strength.

import { CATEGORY, isLandCategory, isOceanCategory } from './terrain.js';
import { TILE, touchTile, writeTilePixel } from './edits.js';
import {
  BRUSH_RAISE_M, BRUSH_MAX_M, BRUSH_LOWER_FLOOR_M, BRUSH_CARVE_M, TRENCH_FLOOR_M,
  DRAW_LAND_M, ERASE_OCEAN_M, SMOOTH_MAX_KERNEL_PX, MIN_LAND_M, MIN_OCEAN_M,
} from './constants.js';

export const BRUSH_IDS = ['draw-land', 'raise', 'lower', 'carve-trench', 'smooth', 'erase'];

// Brushes that ignore the strength slider.
export const FIXED_BRUSHES = new Set(['draw-land', 'erase']);

// Source-pixel rectangles a dab of `radius` at (cx, cy) covers, within the
// map. On wrapping maps a dab across the date line gives two rectangles.
export function dabRects(width, height, wraps, cx, cy, radius) {
  const y0 = Math.max(0, Math.floor(cy - radius));
  const y1 = Math.min(height, Math.ceil(cy + radius));
  if (y1 <= y0) return [];
  const ux0 = Math.floor(cx - radius);
  const ux1 = Math.ceil(cx + radius);
  if (!wraps) {
    const x0 = Math.max(0, ux0);
    const x1 = Math.min(width, ux1);
    return x1 > x0 ? [{ x0, y0, x1, y1 }] : [];
  }
  if (ux1 - ux0 >= width) return [{ x0: 0, y0, x1: width, y1 }];
  const a = ((ux0 % width) + width) % width;
  const b = a + (ux1 - ux0);
  if (b <= width) return [{ x0: a, y0, x1: b, y1 }];
  return [{ x0: a, y0, x1: width, y1 }, { x0: 0, y0, x1: b - width, y1 }];
}

// Dab centers from the last dab toward `to`, every `spacing` px.
// Returns { points, last } (last = the final dab placed, or the old one).
export function strokeDabs(last, to, spacing) {
  const dx = to.x - last.x;
  const dy = to.y - last.y;
  const dist = Math.hypot(dx, dy);
  const points = [];
  const steps = Math.floor(dist / spacing);
  for (let s = 1; s <= steps; s++) points.push({ x: last.x + (dx * s * spacing) / dist, y: last.y + (dy * s * spacing) / dist });
  return { points, last: points.length ? points[points.length - 1] : last };
}

// Cosine falloff 0.5·(1 + cos(π·d)), tabulated by d² so the inner loop
// needs no sqrt or cos.
const FALLOFF_STEPS = 4096;
const FALLOFF = new Float32Array(FALLOFF_STEPS + 1);
for (let k = 0; k <= FALLOFF_STEPS; k++) FALLOFF[k] = 0.5 * (1 + Math.cos(Math.PI * Math.sqrt(k / FALLOFF_STEPS)));

// Box radius for Smooth's local mean.
function kernelFor(radius) {
  return Math.max(1, Math.min(SMOOTH_MAX_KERNEL_PX, Math.round(radius / 8)));
}

// Scratch buffers reused between dabs (no allocation per dab).
let cols = new Float32Array(0);
function colDist(n) {
  if (cols.length < n) cols = new Float32Array(n);
  return cols;
}

let scratch = { size: 0 };
// n = pixels of the padded rect, width = its padded width.
function buffers(n, width) {
  if (scratch.size < n) {
    scratch = { size: n, cols: 0, val: new Float32Array(n), cnt: new Float32Array(n), hv: new Float32Array(n), hc: new Float32Array(n), out: new Float32Array(n) };
  }
  if (scratch.cols < width) {
    Object.assign(scratch, { cols: width, xs: new Int32Array(width), colV: new Float64Array(width), colC: new Float64Array(width) });
  }
  return scratch;
}

// Mean elevation of the non-lake pixels within kr of each pixel of rect
// (NaN where there are none). Reads across the date line on wrapping maps.
function localMean(t, rect, kr, wraps) {
  const { width: w, height: h, elevation: elev, category: cat } = t;
  const rw = rect.x1 - rect.x0;
  const rh = rect.y1 - rect.y0;
  const pw = rw + 2 * kr;
  const ph = rh + 2 * kr;
  const b = buffers(pw * ph, pw);
  // Source column of each padded column (−1 = off an open map's edge).
  const xs = b.xs;
  for (let px = 0; px < pw; px++) {
    let x = rect.x0 - kr + px;
    if (wraps) x = ((x % w) + w) % w;
    xs[px] = x >= 0 && x < w ? x : -1;
  }
  for (let py = 0; py < ph; py++) {
    const y = rect.y0 - kr + py;
    const p0 = py * pw;
    if (y < 0 || y >= h) {
      b.val.fill(0, p0, p0 + pw);
      b.cnt.fill(0, p0, p0 + pw);
      continue;
    }
    const row = y * w;
    for (let px = 0; px < pw; px++) {
      const x = xs[px];
      const ok = x >= 0 && cat[row + x] !== CATEGORY.LAKE;
      b.val[p0 + px] = ok ? elev[row + x] : 0;
      b.cnt[p0 + px] = ok ? 1 : 0;
    }
  }
  // Horizontal window sums (rw wide, ph tall).
  const win = 2 * kr + 1;
  for (let py = 0; py < ph; py++) {
    let sv = 0;
    let sc = 0;
    const row = py * pw;
    const hrow = py * rw;
    for (let px = 0; px < win; px++) { sv += b.val[row + px]; sc += b.cnt[row + px]; }
    for (let ox = 0; ox < rw; ox++) {
      b.hv[hrow + ox] = sv;
      b.hc[hrow + ox] = sc;
      if (ox + win < pw) {
        sv += b.val[row + ox + win] - b.val[row + ox];
        sc += b.cnt[row + ox + win] - b.cnt[row + ox];
      }
    }
  }
  // Vertical window sums, row by row (cache-friendly): colV/colC hold the
  // running sums of the win rows above each output row.
  const colV = b.colV;
  const colC = b.colC;
  colV.fill(0, 0, rw);
  colC.fill(0, 0, rw);
  for (let py = 0; py < win; py++) {
    const hrow = py * rw;
    for (let ox = 0; ox < rw; ox++) { colV[ox] += b.hv[hrow + ox]; colC[ox] += b.hc[hrow + ox]; }
  }
  for (let oy = 0; oy < rh; oy++) {
    const orow = oy * rw;
    for (let ox = 0; ox < rw; ox++) b.out[orow + ox] = colC[ox] > 0 ? colV[ox] / colC[ox] : NaN;
    if (oy + win < ph) {
      const add = (oy + win) * rw;
      const sub = oy * rw;
      for (let ox = 0; ox < rw; ox++) {
        colV[ox] += b.hv[add + ox] - b.hv[sub + ox];
        colC[ox] += b.hc[add + ox] - b.hc[sub + ox];
      }
    }
  }
  return b.out;
}

// One dab. ctx = { base, edits, terrain (composed, writable), wraps,
// journal? (Map for undo) }. opts = { radius (px), strength (0–1) }.
// Returns the rectangles that changed.
export function applyDab(ctx, brushId, cx, cy, { radius, strength = 1 }) {
  const { base, edits, terrain: out, wraps, journal = null } = ctx;
  const w = base.width;
  const elev = out.elevation;
  const cat = out.category;
  const s = Math.min(1, Math.max(0, strength));
  const changed = [];

  const inv2 = 1 / (radius * radius);
  for (const rect of dabRects(w, base.height, wraps, cx, cy, radius)) {
    const mean = brushId === 'smooth' ? localMean(out, rect, kernelFor(radius), wraps) : null;
    const rw = rect.x1 - rect.x0;
    // Squared east-west distance (in radii²) per column, wrap-aware.
    const dx2 = colDist(rw);
    for (let x = rect.x0; x < rect.x1; x++) {
      let dx = x + 0.5 - cx;
      if (wraps) dx -= w * Math.round(dx / w);
      dx2[x - rect.x0] = dx * dx * inv2;
    }
    let any = false;
    for (let ty = Math.floor(rect.y0 / TILE); ty * TILE < rect.y1; ty++) {
      for (let tx = Math.floor(rect.x0 / TILE); tx * TILE < rect.x1; tx++) {
        const key = ty * edits.tilesX + tx;
        let t = null;
        const yA = Math.max(rect.y0, ty * TILE);
        const yB = Math.min(rect.y1, (ty + 1) * TILE);
        const xA = Math.max(rect.x0, tx * TILE);
        const xB = Math.min(rect.x1, (tx + 1) * TILE);
        for (let y = yA; y < yB; y++) {
          const dy = y + 0.5 - cy;
          const dy2 = dy * dy * inv2;
          if (dy2 > 1) continue;
          for (let x = xA; x < xB; x++) {
            const d2 = dx2[x - rect.x0] + dy2;
            if (d2 > 1) continue;
            const f = FALLOFF[(d2 * FALLOFF_STEPS) | 0];
            const i = y * w + x;
            const c = cat[i];
            const e = elev[i];
            let ne = e;
            let ov;
            switch (brushId) {
              case 'raise':
                if (c === CATEGORY.LAKE || e >= BRUSH_MAX_M) continue;
                ne = Math.min(BRUSH_MAX_M, e + BRUSH_RAISE_M * s * f);
                break;
              case 'lower':
                if (c === CATEGORY.LAKE || e <= BRUSH_LOWER_FLOOR_M) continue;
                ne = Math.max(BRUSH_LOWER_FLOOR_M, e - BRUSH_RAISE_M * s * f);
                break;
              case 'carve-trench':
                if (!isOceanCategory(c) || e <= TRENCH_FLOOR_M) continue;
                ne = Math.max(TRENCH_FLOOR_M, e - BRUSH_CARVE_M * s * f * f);
                break;
              case 'smooth': {
                if (c === CATEGORY.LAKE) continue;
                const m = mean[(y - rect.y0) * rw + (x - rect.x0)];
                if (Number.isNaN(m)) continue;
                ne = e + (m - e) * s * f;
                // Never move a coast: ocean stays below sea level, land
                // that was above it stays above it.
                if (isOceanCategory(c)) ne = Math.min(ne, MIN_OCEAN_M);
                else if (e >= MIN_LAND_M) ne = Math.max(ne, MIN_LAND_M);
                break;
              }
              case 'draw-land':
                if (isLandCategory(c)) continue;
                ne = Math.max(e, DRAW_LAND_M);
                ov = CATEGORY.LAND;
                break;
              case 'erase':
                if (isOceanCategory(c)) continue;
                ne = Math.min(e, ERASE_OCEAN_M);
                ov = CATEGORY.OCEAN;
                break;
              default:
                return changed;
            }
            if (ov === undefined && ne === e) continue;
            t ??= touchTile(edits, key, journal);
            writeTilePixel(base, t, (y - ty * TILE) * TILE + (x - tx * TILE), i, out, ne, ov);
            any = true;
          }
        }
      }
    }
    if (any) changed.push(rect);
  }
  return changed;
}
