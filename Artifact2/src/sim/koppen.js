// Köppen–Geiger classification (SPEC 8, M6a decisions). Pure, no DOM.
//
// Input: 12 monthly mean temperatures (°C) of one place and its precipitation
// summary (mm), from the 12 mid-month model months. The summer half is
// Apr–Sep in the north and Oct–Mar in the south.

import { KOPPEN_HIGHLAND_M, KOPPEN_CD_BOUNDARY_C, PLANET_RADIUS_KM } from './constants.js';
import { isLandCategory } from './terrain.js';
import { nearestFeatureIndex } from './distance.js';

// Classes, in legend order. The index is the class code drawn per pixel.
export const KOPPEN_CODES = Object.freeze([
  'Af', 'Am', 'Aw',
  'BWh', 'BWk', 'BSh', 'BSk',
  'Csa', 'Csb', 'Csc', 'Cwa', 'Cwb', 'Cwc', 'Cfa', 'Cfb', 'Cfc',
  'Dsa', 'Dsb', 'Dsc', 'Dsd', 'Dwa', 'Dwb', 'Dwc', 'Dwd', 'Dfa', 'Dfb', 'Dfc', 'Dfd',
  'ET', 'EF',
  'H',
]);
export const KOPPEN = Object.freeze(Object.fromEntries(KOPPEN_CODES.map((c, i) => [c, i])));

export const KOPPEN_NAMES = Object.freeze({
  Af: 'tropical rainforest', Am: 'tropical monsoon', Aw: 'tropical savanna',
  BWh: 'hot desert', BWk: 'cold desert', BSh: 'hot steppe', BSk: 'cold steppe',
  Csa: 'hot-summer Mediterranean', Csb: 'warm-summer Mediterranean', Csc: 'cold-summer Mediterranean',
  Cwa: 'dry-winter humid subtropical', Cwb: 'dry-winter subtropical highland', Cwc: 'dry-winter cold subtropical highland',
  Cfa: 'humid subtropical', Cfb: 'temperate oceanic', Cfc: 'subpolar oceanic',
  Dsa: 'dry-summer hot continental', Dsb: 'dry-summer warm continental', Dsc: 'dry-summer subarctic', Dsd: 'dry-summer extremely cold subarctic',
  Dwa: 'dry-winter hot continental', Dwb: 'dry-winter warm continental', Dwc: 'dry-winter subarctic', Dwd: 'dry-winter extremely cold subarctic',
  Dfa: 'hot-summer humid continental', Dfb: 'warm-summer humid continental', Dfc: 'subarctic', Dfd: 'extremely cold subarctic',
  ET: 'tundra', EF: 'ice cap', H: 'highland',
});

// Köppen–Geiger definitions (SPEC 8; fixed by the classification, not tunable).
const POLAR_WARMEST_C = 10;      // E: warmest month below this (too cold for trees)
const ICE_CAP_WARMEST_C = 0;     // EF: warmest month below freezing
const TROPICAL_COLDEST_C = 18;   // A: coldest month at least this (no winter)
const HOT_DRY_MAT_C = 18;        // B third letter: h (hot) at or above this annual mean
const B_SLOPE = 20;              // B threshold: 20 · MAT + offset (mm/yr); warmer air evaporates more
const B_OFFSET_SUMMER = 280;     // ≥ 70% of rain in summer (most of it evaporates)
const B_OFFSET_EVEN = 140;       // 30–70%
const B_SUMMER_HEAVY = 0.7;
const B_WINTER_HEAVY = 0.3;
const DESERT_SHARE = 0.5;        // BW below half the threshold, BS below the threshold
const AF_DRIEST_MM = 60;         // Af: even the driest month is wet
const AM_BASE_MM = 100;          // Am: driest ≥ 100 − annual / 25 (a short dry season
const AM_DIVISOR = 25;           //     made up for by a very wet year)
const S_DRY_SUMMER_MM = 40;      // s: dry summer (Mediterranean)
const S_RATIO = 1 / 3;
const W_RATIO = 1 / 10;          // w: dry winter (monsoon)
const A_WARMEST_C = 22;          // third letter a: hot summer
const B_MONTH_C = 10;            // third letter b: at least 4 months at or above 10 °C
const B_MONTHS = 4;
const D_COLDEST_C = -38;         // third letter d: extremely cold winter

// Months of the summer half (0 = Jan): Apr–Sep north, Oct–Mar south.
const NORTH_SUMMER = [false, false, false, true, true, true, true, true, true, false, false, false];
export const isSummerMonth = (m, north) => NORTH_SUMMER[m] === north;

// Precipitation summary of 12 monthly totals (mm) for one place:
// { annual, driest, summerShare, summerDry, summerWet, winterDry, winterWet }.
// out is reused when given (the per-cell loop).
export function halfStats(p, north, out = {}) {
  let annual = 0;
  let summer = 0;
  let driest = Infinity;
  let sDry = Infinity;
  let sWet = -Infinity;
  let wDry = Infinity;
  let wWet = -Infinity;
  for (let m = 0; m < 12; m++) {
    const v = p[m];
    annual += v;
    if (v < driest) driest = v;
    if (isSummerMonth(m, north)) {
      summer += v;
      if (v < sDry) sDry = v;
      if (v > sWet) sWet = v;
    } else {
      if (v < wDry) wDry = v;
      if (v > wWet) wWet = v;
    }
  }
  out.annual = annual;
  out.driest = driest;
  out.summerShare = annual > 0 ? summer / annual : 0;
  out.summerDry = sDry;
  out.summerWet = sWet;
  out.winterDry = wDry;
  out.winterWet = wWet;
  return out;
}

// Nearest land sim cell (km metric, wraps) of every sim cell; a land cell is
// its own. −1 everywhere on a map without land. Köppen reads rainfall from
// land cells only (M6a), so a coastal pixel never takes on ocean statistics.
// → Int32Array(width · height)
export function nearestLandCells(grid, category) {
  const land = new Uint8Array(category.length);
  for (let k = 0; k < land.length; k++) land[k] = isLandCategory(category[k]) ? 1 : 0;
  const cfg = {
    sourceWidth: grid.width, sourceHeight: grid.height, latTop: grid.latTop, latBottom: grid.latBottom,
    lonSpan: grid.lonSpan ?? 360, wraps: Boolean(grid.wraps),
  };
  return nearestFeatureIndex(land, cfg, grid.radiusKm ?? PLANET_RADIUS_KM);
}

// B (dry) threshold in mm/yr: more of the rain falling in summer, when it
// evaporates fastest, needs a higher total to count as humid.
export function bThreshold(mat, summerShare) {
  const offset = summerShare >= B_SUMMER_HEAVY ? B_OFFSET_SUMMER : summerShare >= B_WINTER_HEAVY ? B_OFFSET_EVEN : 0;
  return B_SLOPE * mat + offset;
}

// Class code (index into KOPPEN_CODES) of one place.
// temps: 12 monthly means (°C); precip: halfStats(); opts: { elevation (m),
// landIce, cdBoundary (°C), highland (on/off), highlandM }.
export function classifyKoppen(temps, precip, {
  elevation = 0, landIce = false, cdBoundary = KOPPEN_CD_BOUNDARY_C, highland = true, highlandM = KOPPEN_HIGHLAND_M,
} = {}) {
  // Painted land ice is a permanent ice sheet.
  if (landIce) return KOPPEN.EF;
  // Highland: mountain climates vary over short distances, so high ground
  // gets one class of its own (toggle).
  if (highland && elevation > highlandM) return KOPPEN.H;
  let warmest = -Infinity;
  let coldest = Infinity;
  let sum = 0;
  let warmMonths = 0;
  for (let m = 0; m < 12; m++) {
    const t = temps[m];
    if (t > warmest) warmest = t;
    if (t < coldest) coldest = t;
    if (t >= B_MONTH_C) warmMonths++;
    sum += t;
  }
  const mat = sum / 12;
  // 1. E (polar): no month warm enough for trees.
  if (warmest < POLAR_WARMEST_C) return warmest >= ICE_CAP_WARMEST_C ? KOPPEN.ET : KOPPEN.EF;
  // 2. B (dry): evaporation outpaces precipitation.
  const pth = bThreshold(mat, precip.summerShare);
  if (precip.annual < pth) {
    const hot = mat >= HOT_DRY_MAT_C;
    if (precip.annual < DESERT_SHARE * pth) return hot ? KOPPEN.BWh : KOPPEN.BWk;
    return hot ? KOPPEN.BSh : KOPPEN.BSk;
  }
  // 3. A (tropical): no winter.
  if (coldest >= TROPICAL_COLDEST_C) {
    if (precip.driest >= AF_DRIEST_MM) return KOPPEN.Af;
    if (precip.driest >= AM_BASE_MM - precip.annual / AM_DIVISOR) return KOPPEN.Am;
    return KOPPEN.Aw;
  }
  // 4. C (temperate) or D (continental) by the coldest month.
  const group = coldest > cdBoundary ? 'C' : 'D';
  // Second letter, in SPEC 8's order: s (dry summer), w (dry winter), f.
  let second = 'f';
  if (precip.summerDry < S_DRY_SUMMER_MM && precip.summerDry < S_RATIO * precip.winterWet) second = 's';
  else if (precip.winterDry < W_RATIO * precip.summerWet) second = 'w';
  // Third letter: summer heat, or (D only) an extremely cold winter.
  let third = 'c';
  if (warmest >= A_WARMEST_C) third = 'a';
  else if (warmMonths >= B_MONTHS) third = 'b';
  else if (group === 'D' && coldest < D_COLDEST_C) third = 'd';
  return KOPPEN[group + second + third];
}
