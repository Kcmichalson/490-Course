// Precipitation statistics for the M5 weather modes (SPEC 13.3 M5
// definitions). Pure, no DOM.
//   - Seasonality: Walsh–Lawler index of the 12 monthly totals
//   - Aridity: UNEP aridity index, rain over Thornthwaite potential
//     evapotranspiration (PET)
//   - Cloud cover: from the moisture solve's relative humidity and the
//     pressure belts

import {
  SEASONALITY_MIN_MM_YR, THORNTHWAITE_HOT_C, ARIDITY_COLD_PET_MM_YR, CLOUD_RH_CLEAR, CLOUD_RH_OVERCAST, CLOUD_LIFT_SHARE, CLOUD_RAIN_MM,
  YEAR_DAYS,
} from './constants.js';
import { rowLats } from './temperature.js';
import { declination, dayLength, MONTH_MID_DAYS } from './planet.js';
import { halfStats } from './koppen.js';

// Days in a month: the year split into 12 equal months (the model's months
// are the 12 mid-month runs; there are no calendar month lengths).
export const MONTH_DAYS = YEAR_DAYS / 12;

// ---- Seasonality ----

// Walsh–Lawler seasonality index: SI = (1/R) Σ |P_m − R/12|, 0 for the same
// rain every month, 1.83 when all of it falls in one month. R = 0 → 0.
// months = 12 monthly totals (any unit).
export function seasonalityIndex(months) {
  let r = 0;
  for (let m = 0; m < 12; m++) r += months[m];
  if (!(r > 0)) return 0;
  let s = 0;
  for (let m = 0; m < 12; m++) s += Math.abs(months[m] - r / 12);
  return s / r;
}

export const SEASONALITY_EDGES = [0.2, 0.4, 0.6, 0.8, 1.0, 1.2];
export const SEASONALITY_LABELS = Object.freeze([
  'very equable', 'equable, a definite wetter season', 'rather seasonal', 'seasonal', 'markedly seasonal, long dry season',
  'most rain in ≤ 3 months', 'extreme',
]);
// Class code for "too dry to tell" (after the 7 index classes).
export const SEASONALITY_TOO_DRY = 7;
export const isTooDryForSeasonality = (annualMm) => annualMm < SEASONALITY_MIN_MM_YR;

// ---- Thornthwaite PET ----

// Thornthwaite (1948) potential evapotranspiration, mm per month, for 12
// monthly mean temperatures (°C) and day lengths (h of daylight on a 24 h
// clock). Warm months evaporate more, as a power law of temperature scaled
// by the year's heat index I; above 26.5 °C the standard hot-month formula
// (evaporation flattens off); at or below 0 °C none. Each month is scaled by
// its daylight (L/12) and length (N/30).
// → { months: Float64Array(12), total, heatIndex }
export function thornthwaite(temps, dayHours, days = MONTH_DAYS) {
  let heat = 0;
  for (let m = 0; m < 12; m++) if (temps[m] > 0) heat += (temps[m] / 5) ** 1.514;
  const a = 6.75e-7 * heat ** 3 - 7.71e-5 * heat ** 2 + 1.792e-2 * heat + 0.49239;
  const months = new Float64Array(12);
  let total = 0;
  for (let m = 0; m < 12; m++) {
    const t = temps[m];
    let pet = 0;
    if (t >= THORNTHWAITE_HOT_C) pet = -415.85 + 32.24 * t - 0.43 * t * t;
    else if (t > 0 && heat > 0) pet = 16 * ((10 * t) / heat) ** a;
    pet *= (dayHours[m] / 12) * (days / 30);
    months[m] = pet;
    total += pet;
  }
  return { months, total, heatIndex: heat };
}

// Mid-month daylight per sim row, as hours on a 24 h clock: the daylight
// fraction of the rotation period × 24 (Thornthwaite's L is in Earth hours).
// → [Float64Array(H)] × 12
export function monthlyDayHours(grid, planet) {
  const lats = rowLats(grid.latTop, grid.latBottom, grid.height);
  const P = planet.rotationHours;
  return MONTH_MID_DAYS.map((d) => {
    const decl = declination(d, planet.tiltDeg);
    return lats.map((lat) => (24 * dayLength(lat, decl, P).hours) / P);
  });
}

// UNEP aridity index classes (AI = P / PET).
export const ARIDITY_EDGES = [0.05, 0.2, 0.5, 0.65, 1, 2];
export const ARIDITY_LABELS = Object.freeze([
  'hyper-arid', 'arid', 'semi-arid', 'dry sub-humid', 'humid', 'very humid', 'extremely humid',
]);
// Class code for "cold (PET < 100 mm/yr)" (after the 7 index classes).
export const ARIDITY_COLD = 7;
export const isColdForAridity = (petMmYr) => petMmYr < ARIDITY_COLD_PET_MM_YR;

// ---- Per-cell statistics of the 12 months ----

// From the 12 monthly precipitation layers (mm/month) and the 12 monthly cell
// temperatures (°C), on the sim grid:
// → { seasonality (SI), pet (mm/yr), wetMonth, dryMonth (Uint8, 0 = Jan),
//     wetMm, dryMm (mm/month),
//     Köppen's summer/winter split (M6a; the summer half by the row's
//     hemisphere): summerShare (of the annual total), summerDryMm,
//     summerWetMm, winterDryMm, winterWetMm (mm/month) }
export function hydroStats(grid, planet, months, temps) {
  const W = grid.width;
  const H = grid.height;
  const n = W * H;
  const hours = monthlyDayHours(grid, planet);
  const lats = rowLats(grid.latTop, grid.latBottom, H);
  const out = {
    seasonality: new Float32Array(n), pet: new Float32Array(n),
    wetMonth: new Uint8Array(n), dryMonth: new Uint8Array(n), wetMm: new Float32Array(n), dryMm: new Float32Array(n),
    summerShare: new Float32Array(n), summerDryMm: new Float32Array(n), summerWetMm: new Float32Array(n),
    winterDryMm: new Float32Array(n), winterWetMm: new Float32Array(n),
  };
  const p = new Float64Array(12);
  const t = new Float64Array(12);
  const l = new Float64Array(12);
  const half = {};
  for (let j = 0; j < H; j++) {
    for (let m = 0; m < 12; m++) l[m] = hours[m][j];
    const north = lats[j] >= 0;
    for (let i = 0, k = j * W; i < W; i++, k++) {
      let wet = 0;
      let dry = 0;
      for (let m = 0; m < 12; m++) {
        p[m] = months[m][k];
        t[m] = temps[m][k];
        if (p[m] > p[wet]) wet = m;
        if (p[m] < p[dry]) dry = m;
      }
      out.seasonality[k] = seasonalityIndex(p);
      out.pet[k] = thornthwaite(t, l).total;
      out.wetMonth[k] = wet;
      out.dryMonth[k] = dry;
      out.wetMm[k] = p[wet];
      out.dryMm[k] = p[dry];
      halfStats(p, north, half);
      out.summerShare[k] = half.summerShare;
      out.summerDryMm[k] = half.summerDry;
      out.summerWetMm[k] = half.summerWet;
      out.winterDryMm[k] = half.winterDry;
      out.winterWetMm[k] = half.winterWet;
    }
  }
  return out;
}

// ---- Cloud cover ----

const smoothstep = (e0, e1, x) => {
  const u = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return u * u * (3 - 2 * u);
};

// Cloud cover (0–1): clouds form as air nears saturation, and where it rains
// (rain falls from cloud even when the air left behind is dry, as in warm
// rainforest air that rains under the rising branch of the ITCZ); rising air
// (lows, lift 1) builds more of them than sinking air (highs, lift 0).
//   C = (0.7 + 0.3·lift) · (1 − (1 − smoothstep(0.3, 0.95, RH)) · exp(−P / 50))
// rh = relative humidity after the cell's update; p = pressure index;
// precipMm = the same run's precipitation (mm/month).
export function cloudCover(rh, p, precipMm = 0) {
  const lift = Math.min(1, Math.max(0, (1 - p) / 2));
  const humid = smoothstep(CLOUD_RH_CLEAR, CLOUD_RH_OVERCAST, rh);
  const cover = 1 - (1 - humid) * Math.exp(-Math.max(0, precipMm) / CLOUD_RAIN_MM);
  return cover * (1 - CLOUD_LIFT_SHARE + CLOUD_LIFT_SHARE * lift);
}

// Cloud cover of one run on the sim grid: rh and precipitation per cell,
// pressure per row.
export function cloudLayer(grid, rh, pressure, precip) {
  const W = grid.width;
  const out = new Float32Array(W * grid.height);
  for (let j = 0; j < grid.height; j++) {
    for (let i = 0, k = j * W; i < W; i++, k++) out[k] = cloudCover(rh[k], pressure[j], precip[k]);
  }
  return out;
}

// 10% bands, 0–10% … 90–100%.
export const CLOUD_EDGES = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
