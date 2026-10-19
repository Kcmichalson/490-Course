// Temperature at full resolution (SPEC 6, M4 display). Pure, no DOM, so it
// can run on the main thread or in the worker.
//
// Each source pixel uses the sim grid's seasonal swing s (bilinear), the Tq
// row tables of its own latitude, and its OWN elevation and category (lapse
// rate, land ice, land or ocean lag), so mountains show source-pixel detail.
//
// ctx = { map, elevation, category (full resolution), s, simW, simH, tables }
//   tables: from seasonTables (Temperature) or monthlyTables (the others),
//   built for the source rows (rowLats(latTop, latBottom, sourceHeight)).

import { isLandCategory } from './terrain.js';
import { usesLandLag, surfaceOffset, swingTemp, bilinear } from './temperature.js';
import { growingDays, freezingDegreeDays, curveStats, frostClass } from './climatestats.js';

// Class codes per pixel (Uint8): the renderer maps them to colors.
export const WATER = 255;          // land-only modes: water drawn muted
export const WATER_FLAG = 32;      // Temperature / Range: water class = class + 32 (drawn darker)

export const TEMP_MIN_C = -40;     // Temperature mode: 5 °C bands, ≤ −40 … ≥ 40
export const TEMP_STEP_C = 5;
export const TEMP_CLASSES = 18;
export const RANGE_EDGES = [5, 10, 20, 30, 40, 50];
export const GROWING_EDGES = [0.5, 60, 120, 180, 240, 300, 364.5];
export const FDD_EDGES = [0.5, 100, 500, 1500, 3000, 5000];

export const tempClass = (t) => Math.max(0, Math.min(TEMP_CLASSES - 1, Math.floor((t - TEMP_MIN_C) / TEMP_STEP_C) + 1));

export function classOf(value, edges) {
  let k = 0;
  while (k < edges.length && value >= edges[k]) k++;
  return k;
}

// Sim-cell coordinate (cell centers at integers) of a source pixel center.
const cellX = (ctx, x) => ((x + 0.5) * ctx.simW) / ctx.map.sourceWidth - 0.5;
const cellY = (ctx, y) => ((y + 0.5) * ctx.simH) / ctx.map.sourceHeight - 0.5;

// s at a source pixel.
export const pixelSwing = (ctx, x, y) => bilinear(ctx.s, ctx.simW, ctx.simH, cellX(ctx, x), cellY(ctx, y), ctx.map.wraps);

// Temperature of a pixel for the season tables' season.
export function pixelTemperature(ctx, x, y) {
  const i = y * ctx.map.sourceWidth + x;
  const c = ctx.category[i];
  const t = ctx.tables;
  return swingTemp(t.ann[y], usesLandLag(c) ? t.land[y] : t.ocean[y], pixelSwing(ctx, x, y), surfaceOffset(c, ctx.elevation[i]));
}

// The 12 monthly means of a pixel (monthly tables) into out.
export function pixelMonths(ctx, x, y, out = new Float64Array(12)) {
  const i = y * ctx.map.sourceWidth + x;
  const c = ctx.category[i];
  const t = ctx.tables;
  const lag = usesLandLag(c) ? t.land : t.ocean;
  const s = pixelSwing(ctx, x, y);
  const off = surfaceOffset(c, ctx.elevation[i]);
  for (let m = 0; m < 12; m++) out[m] = swingTemp(t.ann[y], lag[m][y], s, off);
  return out;
}

// Per-pixel class codes for a mode over source rows [y0, y1) and columns
// [x0, x1), written into out (Uint8Array(sourceWidth · sourceHeight)).
export function fillClasses(mode, ctx, y0, y1, out, x0 = 0, x1 = ctx.map.sourceWidth) {
  const { map, elevation, category, s, simW, simH } = ctx;
  const W = map.sourceWidth;
  const wraps = map.wraps;
  const t = ctx.tables;
  // Column → sim x (bilinear corners and weight), shared by every row.
  const cx0 = new Int32Array(W);
  const cx1 = new Int32Array(W);
  const cfx = new Float32Array(W);
  for (let x = x0; x < x1; x++) {
    const cx = cellX(ctx, x);
    let a = Math.floor(cx);
    cfx[x] = cx - a;
    let b = a + 1;
    if (wraps) { a = ((a % simW) + simW) % simW; b = ((b % simW) + simW) % simW; } else { a = Math.min(simW - 1, Math.max(0, a)); b = Math.min(simW - 1, Math.max(0, b)); }
    cx0[x] = a;
    cx1[x] = b;
  }
  const monthly = mode !== 'temperature';
  const land12 = new Float64Array(12);
  const ocean12 = new Float64Array(12);
  const curve = new Float64Array(12);
  for (let y = y0; y < y1; y++) {
    const cy = cellY(ctx, y);
    let r0 = Math.floor(cy);
    let fy = cy - r0;
    if (r0 < 0) { r0 = 0; fy = 0; }
    if (r0 > simH - 1) { r0 = simH - 1; fy = 0; }
    const r1 = Math.min(simH - 1, r0 + 1);
    const row0 = r0 * simW;
    const row1 = r1 * simW;
    const ann = t.ann[y];
    if (monthly) for (let m = 0; m < 12; m++) { land12[m] = t.land[m][y]; ocean12[m] = t.ocean[m][y]; }
    for (let x = x0, i = y * W + x0; x < x1; x++, i++) {
      const c = category[i];
      const water = !isLandCategory(c);
      if (water && (mode === 'growing-season' || mode === 'frost' || mode === 'winter-severity')) { out[i] = WATER; continue; }
      const fx = cfx[x];
      const a = s[row0 + cx0[x]] + (s[row0 + cx1[x]] - s[row0 + cx0[x]]) * fx;
      const b = s[row1 + cx0[x]] + (s[row1 + cx1[x]] - s[row1 + cx0[x]]) * fx;
      const sw = a + (b - a) * fy;
      const off = surfaceOffset(c, elevation[i]);
      const landLag = usesLandLag(c);
      if (!monthly) {
        out[i] = tempClass(swingTemp(ann, landLag ? t.land[y] : t.ocean[y], sw, off)) + (water ? WATER_FLAG : 0);
        continue;
      }
      const lag = landLag ? land12 : ocean12;
      for (let m = 0; m < 12; m++) curve[m] = ann + sw * (lag[m] - ann) + off;
      if (mode === 'temp-range') {
        let lo = curve[0];
        let hi = curve[0];
        for (let m = 1; m < 12; m++) { if (curve[m] < lo) lo = curve[m]; if (curve[m] > hi) hi = curve[m]; }
        out[i] = classOf(hi - lo, RANGE_EDGES) + (water ? WATER_FLAG : 0);
      } else if (mode === 'growing-season') {
        out[i] = classOf(growingDays(curve), GROWING_EDGES);
      } else if (mode === 'winter-severity') {
        out[i] = classOf(freezingDegreeDays(curve), FDD_EDGES);
      } else {
        const st = curveStats(curve);
        out[i] = frostClass(st.warmest, st.coldest, st.mean);
      }
    }
  }
  return out;
}
