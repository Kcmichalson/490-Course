// Base wind from circulation bands (SPEC 4.1–4.3, pipeline step 2). Pure.
//
// Vectors: u > 0 = toward east, v > 0 = toward north. Speeds are relative
// (1 = base ocean wind). In M3 the wind depends only on latitude, so a grid
// is computed one row at a time and filled across; the layers are still
// Float32Array(width * height) so later steps (monsoons, friction, M8) can
// vary them per cell.

import { WIND_BASE_SPEED, CALM_FLOOR, CALM_EDGE_FRACTION } from './constants.js';
import {
  cellsPerHemisphere, angleLimits, declination, itczLatitude, latEff, latFromEff, MONTH_MID_DAYS,
  annualItcz, itczExtremes,
} from './planet.js';

const DEG = Math.PI / 180;

const smoothstep = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// Calm toward band edges (doldrums at the ITCZ, horse latitudes under the
// subtropical highs, calm polar highs): a steady band core that ramps down to
// CALM_FLOOR near each edge. t = position across the band (0 … 1).
export function calmFactor(t) {
  return CALM_FLOOR + (1 - CALM_FLOOR) * smoothstep(0, CALM_EDGE_FRACTION, Math.min(t, 1 - t));
}

// Wind at an effective latitude (SPEC 4.1). Direct (thermally driven) bands
// — trades, polar easterlies — blow equatorward and are turned westward by
// Coriolis; indirect bands (westerlies) blow poleward and are turned eastward.
// spin: +1 prograde, −1 retrograde (Coriolis reverses). limits: { min, max }.
export function bandWind(eff, n, spin, limits) {
  const bandWidth = 90 / n;
  const a = Math.min(90, Math.abs(eff));
  const k = Math.min(n - 1, Math.floor(a / bandWidth)); // band index from equator
  const t = (a - k * bandWidth) / bandWidth;             // 0 = equator side, 1 = pole side
  const direct = k % 2 === 0;
  const eastward = (direct ? -1 : 1) * spin;
  const poleward = direct ? -1 : 1;
  const turn = direct ? t : 1 - t;                       // 1 = air just left high pressure
  const angle = (limits.min + (limits.max - limits.min) * turn) * DEG;
  const hemi = Math.sign(eff) || 1;                      // +1 north, −1 south
  const speed = WIND_BASE_SPEED * calmFactor(t);
  return {
    u: eastward * Math.cos(angle) * speed,
    v: poleward * hemi * Math.sin(angle) * speed,
    speed,
    band: k,
    t,
  };
}

// Pressure index at an effective latitude (SPEC 4.3): −1 at the lows (ITCZ,
// subpolar lows: rising air), +1 at the highs (subtropical and polar highs:
// sinking air). n is odd, so the pole is always a high.
export function pressureIndex(eff, n) {
  return -Math.cos((Math.PI * Math.min(90, Math.abs(eff))) / (90 / n));
}

// Band name for the overlay (SPEC 4.1): Earth names only for 3 prograde cells,
// otherwise by direction. eastward > 0 = blowing toward east = westerlies.
export function bandName(k, n, spin) {
  if (n === 3 && spin === 1) return ['Trade Winds', 'Westerlies', 'Polar Easterlies'][k];
  const eastward = (k % 2 === 0 ? -1 : 1) * spin;
  return eastward > 0 ? 'Westerlies' : 'Easterlies';
}

// Pressure belt name: the ITCZ, the Earth names for 3 cells, else High/Low.
export function beltName(j, n) {
  if (j === 0) return 'ITCZ';
  if (n === 3) return ['ITCZ', 'Subtropical high', 'Subpolar low', 'Polar high'][j];
  return j % 2 === 0 ? 'Low' : 'High';
}

// Bands and belts as real latitudes, for labels and lines.
// → { n, bandWidth, itcz, bands: [{ lat0, lat1, latCenter, name, hemi }],
//     belts: [{ lat, kind: 'low' | 'high', name }] }
export function circulationMeta(n, spin, itcz) {
  const bandWidth = 90 / n;
  const bands = [];
  const belts = [];
  for (const hemi of [1, -1]) {
    for (let k = 0; k < n; k++) {
      const e0 = hemi * k * bandWidth;
      const e1 = hemi * (k + 1) * bandWidth;
      bands.push({
        lat0: latFromEff(e0, itcz), lat1: latFromEff(e1, itcz), latCenter: latFromEff((e0 + e1) / 2, itcz), name: bandName(k, n, spin), hemi,
      });
    }
    for (let j = hemi === 1 ? 0 : 1; j <= n; j++) {
      belts.push({ lat: latFromEff(hemi * j * bandWidth, itcz), kind: j % 2 === 0 ? 'low' : 'high', name: beltName(j, n), j, hemi });
    }
  }
  return { n, bandWidth, itcz, bands, belts };
}

// Latitude of sim row j's center (cell-registered, SPEC 1).
export const rowLat = (grid, j) => grid.latTop - ((j + 0.5) / grid.height) * (grid.latTop - grid.latBottom);

// One row profile per field for a day: { u, v, speed, pressure } (length = rows).
export function windProfile(grid, planet, day) {
  return profileForItcz(grid, planet, itczLatitude(declination(day, planet.tiltDeg)));
}

function profileForItcz(grid, planet, itcz) {
  const n = cellsPerHemisphere(planet.rotationHours);
  const limits = angleLimits(planet.rotationHours);
  const H = grid.height;
  const p = { u: new Float32Array(H), v: new Float32Array(H), speed: new Float32Array(H), pressure: new Float32Array(H) };
  for (let j = 0; j < H; j++) {
    const eff = latEff(rowLat(grid, j), itcz);
    const w = bandWind(eff, n, planet.spin, limits);
    p.u[j] = w.u;
    p.v[j] = w.v;
    p.speed[j] = w.speed;
    p.pressure[j] = pressureIndex(eff, n);
  }
  return p;
}

// Annual Mean profile (SPEC 4.1): u, v = vector mean of the 12 monthly
// fields (the prevailing wind; it nearly cancels where band edges sweep back
// and forth), speed = mean scalar speed, pressure = mean index.
// → { mean, months: [{ day, profile }] }
export function annualProfile(grid, planet) {
  const H = grid.height;
  const mean = { u: new Float32Array(H), v: new Float32Array(H), speed: new Float32Array(H), pressure: new Float32Array(H) };
  const months = MONTH_MID_DAYS.map((day) => ({ day, profile: windProfile(grid, planet, day) }));
  for (const { profile } of months) {
    for (const f of ['u', 'v', 'speed', 'pressure']) for (let j = 0; j < H; j++) mean[f][j] += profile[f][j];
  }
  for (const f of ['u', 'v', 'speed', 'pressure']) for (let j = 0; j < H; j++) mean[f][j] /= months.length;
  return { mean, months };
}

// Fills full grid layers from a row profile.
export function expandProfile(profile, width) {
  const H = profile.u.length;
  const out = {};
  for (const f of ['u', 'v', 'speed', 'pressure']) {
    const layer = new Float32Array(width * H);
    const src = profile[f];
    for (let j = 0; j < H; j++) layer.fill(src[j], j * width, (j + 1) * width);
    out[f] = layer;
  }
  return out;
}

// Circulation metadata for a season (annual: belts at the mean ITCZ, plus
// the ITCZ's yearly extremes).
export function seasonMeta(planet, season) {
  const n = cellsPerHemisphere(planet.rotationHours);
  if (season.annual) {
    return { ...circulationMeta(n, planet.spin, annualItcz(planet.tiltDeg)), annual: true, itczRange: itczExtremes(planet.tiltDeg) };
  }
  return { ...circulationMeta(n, planet.spin, itczLatitude(declination(season.day, planet.tiltDeg))), annual: false, day: season.day };
}
