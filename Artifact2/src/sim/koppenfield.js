// Köppen at full resolution (SPEC 8, M6a decisions). Pure, no DOM.
//
// Each source pixel is classified from its own 12 monthly temperatures (its
// own elevation and category, as in the M4 modes: climatefield.js) and the
// precipitation statistics of the sim grid. Rain belongs to the air's path,
// not one pixel, so it is interpolated, but from LAND cells only: bilinear
// over the land corners, re-weighted, and the nearest land cell when no
// corner is land. A coastal pixel never takes on ocean statistics.
//
// ctx = climateCtx('monthly') fields { map, elevation, category, s, simW,
//   simH, tables } + { annual (sim, mm/month), stats (hydroStats, with
//   nearestLand), cdBoundary, highland }

import { CATEGORY, isLandCategory } from './terrain.js';
import { WATER, pixelMonths } from './climatefield.js';
import { classifyKoppen, bThreshold } from './koppen.js';

// Sim-cell coordinate (cell centers at integers) of a source pixel center.
const cellX = (ctx, x) => ((x + 0.5) * ctx.simW) / ctx.map.sourceWidth - 0.5;
const cellY = (ctx, y) => ((y + 0.5) * ctx.simH) / ctx.map.sourceHeight - 0.5;

// The four bilinear corner cells of a pixel (into idx) and their weights,
// with ocean corners dropped and the rest re-weighted (into w). No land
// corner → the nearest land cell of the closest corner. A map with no land
// at all keeps the plain bilinear weights.
export function landWeights(ctx, x, y, idx, w) {
  const W = ctx.simW;
  const H = ctx.simH;
  const cx = cellX(ctx, x);
  const cy = cellY(ctx, y);
  let x0 = Math.floor(cx);
  const fx = cx - x0;
  let y0 = Math.floor(cy);
  let fy = cy - y0;
  let x1 = x0 + 1;
  if (ctx.map.wraps) {
    x0 = ((x0 % W) + W) % W;
    x1 = ((x1 % W) + W) % W;
  } else {
    x0 = Math.min(W - 1, Math.max(0, x0));
    x1 = Math.min(W - 1, Math.max(0, x1));
  }
  if (y0 < 0) { y0 = 0; fy = 0; }
  const y1 = Math.min(H - 1, y0 + 1);
  if (y0 > H - 1) y0 = H - 1;
  idx[0] = y0 * W + x0; w[0] = (1 - fx) * (1 - fy);
  idx[1] = y0 * W + x1; w[1] = fx * (1 - fy);
  idx[2] = y1 * W + x0; w[2] = (1 - fx) * fy;
  idx[3] = y1 * W + x1; w[3] = fx * fy;
  const near = ctx.stats.nearestLand;
  let closest = 0;
  let sum = 0;
  for (let c = 0; c < 4; c++) {
    if (w[c] > w[closest]) closest = c;
    if (near[idx[c]] === idx[c]) sum += w[c];
  }
  if (sum > 0) {
    for (let c = 0; c < 4; c++) w[c] = near[idx[c]] === idx[c] ? w[c] / sum : 0;
    return;
  }
  const k = near[idx[closest]];
  if (k < 0) return;
  idx[0] = k; w[0] = 1;
  w[1] = 0; w[2] = 0; w[3] = 0;
}

// Precipitation summary of a pixel (classifyKoppen's input): annual (mm/yr),
// driest month, summer share, and the summer and winter extremes (mm).
export function pixelKoppenPrecip(ctx, x, y, out = {}, idx = new Int32Array(4), w = new Float64Array(4)) {
  landWeights(ctx, x, y, idx, w);
  const s = ctx.stats;
  const at = (layer) => w[0] * layer[idx[0]] + w[1] * layer[idx[1]] + w[2] * layer[idx[2]] + w[3] * layer[idx[3]];
  out.annual = 12 * at(ctx.annual);
  out.driest = at(s.dryMm);
  out.summerShare = at(s.summerShare);
  out.summerDry = at(s.summerDryMm);
  out.summerWet = at(s.summerWetMm);
  out.winterDry = at(s.winterDryMm);
  out.winterWet = at(s.winterWetMm);
  return out;
}

const classOpts = (ctx, i) => ({
  elevation: ctx.elevation[i], landIce: ctx.category[i] === CATEGORY.LAND_ICE, cdBoundary: ctx.cdBoundary, highland: ctx.highland,
});

// Köppen at one land pixel, with what decided it (for the readouts):
// { cls, warmest, coldest, mat, precip, pth (B threshold, mm/yr) }.
export function koppenAt(ctx, x, y) {
  const i = y * ctx.map.sourceWidth + x;
  const t = pixelMonths(ctx, x, y);
  const precip = pixelKoppenPrecip(ctx, x, y);
  let warmest = -Infinity;
  let coldest = Infinity;
  let sum = 0;
  for (let m = 0; m < 12; m++) {
    warmest = Math.max(warmest, t[m]);
    coldest = Math.min(coldest, t[m]);
    sum += t[m];
  }
  const mat = sum / 12;
  return { cls: classifyKoppen(t, precip, classOpts(ctx, i)), warmest, coldest, mat, precip, pth: bThreshold(mat, precip.summerShare) };
}

// Per-pixel class codes over source rows [y0, y1) and columns [x0, x1),
// written into out (Uint8Array(sourceWidth · sourceHeight)). Water pixels
// (ocean, sea ice, lakes) get WATER (drawn muted).
export function fillKoppenClasses(mode, ctx, y0, y1, out, x0 = 0, x1 = ctx.map.sourceWidth) {
  const W = ctx.map.sourceWidth;
  const t = new Float64Array(12);
  const precip = {};
  const idx = new Int32Array(4);
  const w = new Float64Array(4);
  const opts = classOpts(ctx, 0);
  for (let y = y0; y < y1; y++) {
    for (let x = x0, i = y * W + x0; x < x1; x++, i++) {
      const c = ctx.category[i];
      if (!isLandCategory(c)) { out[i] = WATER; continue; }
      pixelMonths(ctx, x, y, t);
      pixelKoppenPrecip(ctx, x, y, precip, idx, w);
      opts.elevation = ctx.elevation[i];
      opts.landIce = c === CATEGORY.LAND_ICE;
      out[i] = classifyKoppen(t, precip, opts);
    }
  }
  return out;
}
