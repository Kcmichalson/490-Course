// Temperature (SPEC 6, pipeline steps 4 and 6). Pure functions.
//
// T(cell, day) = TqAnn + s·(Tq(lat, δ(day − lag)) − TqAnn) + lapse·elev + ice
//   Tq     radiative temperature from daily-mean insolation, plus the
//          latitude's annual heat-transport and ice-albedo change
//          (heattransport.js; the same every day, so only TqAnn moves)
//   TqAnn  mean of Tq over the 12 mid-month days (unlagged)
//   s      seasonal swing, 0.15 (ocean) … 0.5 (deep interior), from the
//          continentality tracer (continentality.js)
//   lag    15 days on land and lakes, 45 days on the ocean
// Annual Mean = the mean of the 12 monthly temperatures. T is linear in the
// Tq term, so averaging the lagged Tq over the months gives exactly that.
//
// Row tables (one value per row latitude) hold every Tq term, so a cell or a
// display pixel only adds s, its elevation, and its category. The display
// uses each source pixel's own elevation (mountains show full detail).

import {
  SOLAR_CONSTANT, TQ_SLOPE, TQ_OFFSET, LAG_LAND_DAYS, LAG_OCEAN_DAYS, LAPSE_C_PER_M, LAND_ICE_C, YEAR_DAYS, HEAT_TRANSPORT_CELLS,
} from './constants.js';
import { declination, MONTH_MID_DAYS } from './planet.js';
import { equalAreaLats, transportProfile } from './heattransport.js';
import { CATEGORY, isLandCategory } from './terrain.js';

const DEG = Math.PI / 180;

// Daily-mean top-of-atmosphere insolation (W/m²) at a latitude for a solar
// declination: the standard formula with the sunrise hour angle
// cos h0 = −tanφ tanδ, clamped for polar night (h0 = 0) and day (h0 = π).
export function dailyInsolation(latDeg, declDeg, s0 = SOLAR_CONSTANT) {
  const phi = Math.max(-90, Math.min(90, latDeg)) * DEG;
  const dec = declDeg * DEG;
  const c = -Math.tan(phi) * Math.tan(dec);
  const h0 = c >= 1 ? 0 : c <= -1 ? Math.PI : Math.acos(c);
  const q = (s0 / Math.PI) * (h0 * Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.sin(h0));
  return Math.max(0, q);
}

// Radiative temperature (°C) for an insolation (SPEC 6, start values): a
// linear stand-in for the greenhouse effect and poleward heat transport.
export const radiativeTemp = (q) => TQ_SLOPE * q + TQ_OFFSET;

// Tq at a latitude on a day of the year (day may run past 0–364; it wraps).
export const tqAt = (lat, day, tiltDeg) => radiativeTemp(dailyInsolation(lat, declination(((day % YEAR_DAYS) + YEAR_DAYS) % YEAR_DAYS, tiltDeg)));

// Annual mean insolation at a latitude (W/m²): the 12 mid-month days.
const annualInsolation = (lat, tiltDeg) => MONTH_MID_DAYS.reduce((s, d) => s + dailyInsolation(lat, declination(d, tiltDeg)), 0) / MONTH_MID_DAYS.length;

// Heat transport and ice-albedo (heattransport.js; Climate inputs): each
// equal-area cell's annual mean for a tilt. Computed once per tilt (a few
// ms) and kept.
const transportMemo = new Map();
function transportTemps(tiltDeg) {
  let hit = transportMemo.get(tiltDeg);
  if (hit) return hit;
  const insol = equalAreaLats(HEAT_TRANSPORT_CELLS).map((lat) => annualInsolation(lat, tiltDeg));
  hit = transportProfile(insol.map(radiativeTemp), insol).temperature;
  transportMemo.set(tiltDeg, hit);
  while (transportMemo.size > 8) transportMemo.delete(transportMemo.keys().next().value);
  return hit;
}

// The annual-mean change at a latitude (°C): the model's annual mean there
// (linear in x = sin(latitude) between cells) minus the radiative one.
export function transportOffset(lat, tiltDeg) {
  const t = transportTemps(tiltDeg);
  const n = t.length;
  const f = ((Math.sin(Math.max(-90, Math.min(90, lat)) * DEG) + 1) * n) / 2 - 0.5;
  const i = Math.max(0, Math.min(n - 2, Math.floor(f)));
  const w = Math.min(1, Math.max(0, f - i));
  return t[i] + (t[i + 1] - t[i]) * w - radiativeTemp(annualInsolation(lat, tiltDeg));
}

// Mean Tq over a set of days, each shifted back by `lag` days, per latitude,
// plus the latitude's heat-transport change (the same every day, so it
// moves the annual mean and leaves the seasonal swing as it was).
export function tqTable(lats, tiltDeg, days, lag = 0) {
  const out = new Float32Array(lats.length);
  for (let j = 0; j < lats.length; j++) {
    let sum = 0;
    for (const d of days) sum += tqAt(lats[j], d - lag, tiltDeg);
    out[j] = sum / days.length + transportOffset(lats[j], tiltDeg);
  }
  return out;
}

// The days a season averages over: the 12 mid-months for Annual Mean.
export const seasonDays = (season) => (season.annual ? MONTH_MID_DAYS : [season.day]);

// Tables for one season: { ann, land, ocean } (Float32Array per latitude).
export function seasonTables(lats, tiltDeg, season) {
  const days = seasonDays(season);
  return {
    ann: tqTable(lats, tiltDeg, MONTH_MID_DAYS),
    land: tqTable(lats, tiltDeg, days, LAG_LAND_DAYS),
    ocean: tqTable(lats, tiltDeg, days, LAG_OCEAN_DAYS),
  };
}

// Tables for the 12 months: { ann, land: [12], ocean: [12] }.
export function monthlyTables(lats, tiltDeg) {
  return {
    ann: tqTable(lats, tiltDeg, MONTH_MID_DAYS),
    land: MONTH_MID_DAYS.map((d) => tqTable(lats, tiltDeg, [d], LAG_LAND_DAYS)),
    ocean: MONTH_MID_DAYS.map((d) => tqTable(lats, tiltDeg, [d], LAG_OCEAN_DAYS)),
  };
}

// Row-center latitudes of an n-row grid (cell-registered, SPEC 1).
export function rowLats(latTop, latBottom, n) {
  const out = new Float64Array(n);
  for (let j = 0; j < n; j++) out[j] = latTop - ((j + 0.5) / n) * (latTop - latBottom);
  return out;
}

// Land, land ice, and lakes warm and cool fast (land lag); the ocean and sea
// ice lag like the ocean mixed layer.
export const usesLandLag = (category) => isLandCategory(category) || category === CATEGORY.LAKE;

// Lapse rate: air cools 6.5 °C per km of height (linear below sea level
// too, so land below sea level is warmer).
export const lapse = (elevM) => LAPSE_C_PER_M * elevM;

// Land ice albedo: −5 °C.
export const iceOffset = (category) => (category === CATEGORY.LAND_ICE ? LAND_ICE_C : 0);

// The height the air sits at: water surface 0 m for the ocean and sea ice,
// otherwise the ground (or lake surface) itself.
export const surfaceElevation = (category, elevM) => (usesLandLag(category) ? elevM : 0);

// Everything that doesn't depend on the season: lapse + ice.
export const surfaceOffset = (category, elevM) => lapse(surfaceElevation(category, elevM)) + iceOffset(category);

// One temperature from the Tq terms (SPEC 6 seasonal swing).
export const swingTemp = (tqAnn, tqSeason, s, offset) => tqAnn + s * (tqSeason - tqAnn) + offset;

// Cell surface elevation of a sim grid: mean land elevation for land and
// land-ice cells, the lake surface (mean water elevation) for lakes, 0 m for
// the ocean and sea ice.
export function simSurfaceElevation(sim) {
  const n = sim.category.length;
  const out = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const c = sim.category[k];
    out[k] = isLandCategory(c) ? sim.meanLandElev[k] : c === CATEGORY.LAKE ? sim.meanOceanDepth[k] : 0;
  }
  return out;
}

// Cell temperatures for a season (step 4 / 6): Float32Array(width·height).
// terrain = { category, elevation } on the sim grid; s = seasonal swing.
export function seasonTemperature(grid, tiltDeg, season, terrain, s) {
  const { width: W, height: H } = grid;
  const t = seasonTables(rowLats(grid.latTop, grid.latBottom, H), tiltDeg, season);
  const out = new Float32Array(W * H);
  for (let j = 0; j < H; j++) {
    for (let i = 0, k = j * W; i < W; i++, k++) {
      const c = terrain.category[k];
      const tq = usesLandLag(c) ? t.land[j] : t.ocean[j];
      out[k] = swingTemp(t.ann[j], tq, s[k], surfaceOffset(c, terrain.elevation[k]));
    }
  }
  return out;
}

// Bilinear sample of a sim-grid layer at continuous cell coordinates (cell
// centers at integers). x wraps on wrapping maps, else clamps; y clamps.
export function bilinear(layer, W, H, cx, cy, wraps) {
  let x0 = Math.floor(cx);
  const fx = cx - x0;
  let y0 = Math.floor(cy);
  let fy = cy - y0;
  let x1 = x0 + 1;
  if (wraps) {
    x0 = ((x0 % W) + W) % W;
    x1 = ((x1 % W) + W) % W;
  } else {
    x0 = Math.min(W - 1, Math.max(0, x0));
    x1 = Math.min(W - 1, Math.max(0, x1));
  }
  if (y0 < 0) { y0 = 0; fy = 0; }
  const y1 = Math.min(H - 1, y0 + 1);
  if (y0 > H - 1) y0 = H - 1;
  const a = layer[y0 * W + x0] + (layer[y0 * W + x1] - layer[y0 * W + x0]) * fx;
  const b = layer[y1 * W + x0] + (layer[y1 * W + x1] - layer[y1 * W + x0]) * fx;
  return a + (b - a) * fy;
}
