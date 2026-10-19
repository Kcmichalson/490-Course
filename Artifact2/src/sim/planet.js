// Planet parameters and the sun (SPEC 3, 4.2, M3). Pure functions.
//
// A planet is a plain frozen object, replaced wholesale:
// {
//   rotationHours  // length of a day (h); sets circulation cells
//   spin           // +1 prograde, −1 retrograde
//   tiltDeg        // axial tilt (°)
//   lunarPull      // 1 = Earth's Moon (tides, M9)
// }
// The radius lives in the map config (`radiusKm`), so it travels with undo.
//
// A season is { annual: true } or { day } with day 0–364 (1/365 of an orbit,
// not one rotation: there is no orbital-period setting, SPEC 3).

import {
  ROTATION_DEFAULT_H, ROTATION_MIN_H, ROTATION_MAX_H, TILT_DEFAULT_DEG, TILT_MAX_DEG,
  LUNAR_PULL_DEFAULT, LUNAR_PULL_MAX, YEAR_DAYS, EQUINOX_DAY, ITCZ_FACTOR, WIND_ANGLE_ANCHORS,
  CELLS_ONE_ABOVE_H, CELLS_THREE_FROM_H, CELLS_FIVE_FROM_H,
} from './constants.js';

const DEG = Math.PI / 180;

export const DEFAULT_PLANET = Object.freeze({
  rotationHours: ROTATION_DEFAULT_H,
  spin: 1,
  tiltDeg: TILT_DEFAULT_DEG,
  lunarPull: LUNAR_PULL_DEFAULT,
});

export const PLANET_RANGES = Object.freeze({
  rotationHours: { min: ROTATION_MIN_H, max: ROTATION_MAX_H },
  tiltDeg: { min: 0, max: TILT_MAX_DEG },
  lunarPull: { min: 0, max: LUNAR_PULL_MAX },
});

const clampNum = (v, { min, max }, fallback) => (Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Number(v))) : fallback);

// Builds a frozen, valid planet from partial (e.g. saved) options; bad values
// fall back to the defaults, out-of-range values are clamped.
export function createPlanet(opts = {}) {
  const o = opts && typeof opts === 'object' ? opts : {};
  return Object.freeze({
    rotationHours: clampNum(o.rotationHours, PLANET_RANGES.rotationHours, DEFAULT_PLANET.rotationHours),
    spin: o.spin === -1 ? -1 : 1,
    tiltDeg: clampNum(o.tiltDeg, PLANET_RANGES.tiltDeg, DEFAULT_PLANET.tiltDeg),
    lunarPull: clampNum(o.lunarPull, PLANET_RANGES.lunarPull, DEFAULT_PLANET.lunarPull),
  });
}

// ---- Seasons ----

export const ANNUAL = Object.freeze({ annual: true });

export const SEASON_PRESETS = Object.freeze([
  { id: 'annual', label: 'Annual Mean', season: ANNUAL },
  { id: 'nh-spring', label: 'Northern Spring Equinox', season: Object.freeze({ day: 80 }) },
  { id: 'nh-summer', label: 'Northern Summer Solstice', season: Object.freeze({ day: 172 }) },
  { id: 'autumn', label: 'Autumn Equinox', season: Object.freeze({ day: 266 }) },
  { id: 'sh-summer', label: 'Southern Summer Solstice', season: Object.freeze({ day: 355 }) },
]);

// Mid-month days (0-based) for the 12 monthly runs behind Annual Mean.
export const MONTH_MID_DAYS = Object.freeze(Array.from({ length: 12 }, (_, m) => Math.floor(((m + 0.5) * YEAR_DAYS) / 12)));

export function createSeason(s) {
  if (!s || typeof s !== 'object' || s.annual) return ANNUAL;
  const d = Math.round(Number(s.day));
  return Number.isFinite(d) ? Object.freeze({ day: Math.min(YEAR_DAYS - 1, Math.max(0, d)) }) : ANNUAL;
}

export const seasonKey = (s) => (s.annual ? 'annual' : `d${s.day}`);

// The preset matching a season, or null for a custom day.
export function seasonPreset(s) {
  return SEASON_PRESETS.find((p) => (s.annual ? p.season.annual : p.season.day === s.day)) ?? null;
}

// ---- Sun ----

// Solar declination (°) on a day of the year (SPEC 3): the subsolar latitude,
// which swings between ±tilt over the year.
export function declination(day, tiltDeg) {
  return tiltDeg * Math.sin((2 * Math.PI * (day - EQUINOX_DAY)) / YEAR_DAYS);
}

// ITCZ latitude (°) for a declination (SPEC 4.2): the rising branch of the
// Hadley cells follows the sun, damped by thermal lag.
export const itczLatitude = (decl) => ITCZ_FACTOR * decl;

// Annual-mean ITCZ: the mean over the 12 monthly runs (≈ 0°).
export function annualItcz(tiltDeg) {
  let sum = 0;
  for (const d of MONTH_MID_DAYS) sum += itczLatitude(declination(d, tiltDeg));
  return sum / MONTH_MID_DAYS.length;
}

// Northernmost / southernmost ITCZ over the year.
export const itczExtremes = (tiltDeg) => ({ north: ITCZ_FACTOR * tiltDeg, south: -ITCZ_FACTOR * tiltDeg });

// ITCZ for a season (annual: the annual mean).
export const seasonItcz = (season, tiltDeg) => (season.annual ? annualItcz(tiltDeg) : itczLatitude(declination(season.day, tiltDeg)));

// Effective latitude (SPEC 4.2): remaps so the ITCZ sits at 0 while the poles
// stay at ±90, so the circulation bands shift with the seasons.
export function latEff(lat, itcz) {
  return lat >= itcz ? (90 * (lat - itcz)) / (90 - itcz) : (-90 * (itcz - lat)) / (itcz + 90);
}

// Inverse of latEff: the real latitude of an effective latitude.
export function latFromEff(eff, itcz) {
  return eff >= 0 ? itcz + (eff * (90 - itcz)) / 90 : itcz + (eff * (itcz + 90)) / 90;
}

// ---- Circulation ----

// Circulation cells per hemisphere from the rotation period (SPEC 3):
// faster spin = stronger Coriolis = more, narrower bands.
export function cellsPerHemisphere(hours) {
  if (hours > CELLS_ONE_ABOVE_H) return 1;
  if (hours >= CELLS_THREE_FROM_H) return 3;
  if (hours >= CELLS_FIVE_FROM_H) return 5;
  return 7;
}

// Wind angle limits (° off due east/west) for a rotation period: linear in
// log(period) between the anchors, clamped outside them (SPEC 4.1).
export function angleLimits(hours, anchors = WIND_ANGLE_ANCHORS) {
  if (hours <= anchors[0].hours) return { min: anchors[0].min, max: anchors[0].max };
  const last = anchors[anchors.length - 1];
  if (hours >= last.hours) return { min: last.min, max: last.max };
  let i = 0;
  while (hours > anchors[i + 1].hours) i++;
  const a = anchors[i];
  const b = anchors[i + 1];
  const f = Math.log(hours / a.hours) / Math.log(b.hours / a.hours);
  return { min: a.min + (b.min - a.min) * f, max: a.max + (b.max - a.max) * f };
}

// ---- Day length ----

// Daylight at a latitude for a declination (sunrise hour angle,
// cos h0 = −tanφ tanδ; clamped for polar day and night). The rotation period
// is treated as the solar day. → { hours, polar: 'day' | 'night' | null }
export function dayLength(lat, decl, rotationHours) {
  const phi = Math.max(-89.999, Math.min(89.999, lat)) * DEG;
  const c = -Math.tan(phi) * Math.tan(decl * DEG);
  if (c >= 1) return { hours: 0, polar: 'night' };
  if (c <= -1) return { hours: rotationHours, polar: 'day' };
  return { hours: (rotationHours * Math.acos(c)) / Math.PI, polar: null };
}

export const dayLengthHours = (lat, decl, rotationHours) => dayLength(lat, decl, rotationHours).hours;

const fmtH = (h) => `${h >= 100 ? Math.round(h) : h.toFixed(1)} h`;

// Tooltip text for a latitude: one day, or the year's range for Annual Mean.
export function dayLengthText(lat, planet, season) {
  const { rotationHours: P, tiltDeg } = planet;
  if (season.annual) {
    const a = dayLength(lat, tiltDeg, P).hours;
    const b = dayLength(lat, -tiltDeg, P).hours;
    return `Day length ${fmtH(Math.min(a, b))}–${fmtH(Math.max(a, b))} over the year`;
  }
  const d = dayLength(lat, declination(season.day, tiltDeg), P);
  if (d.polar === 'night') return 'Polar night';
  if (d.polar === 'day') return `Polar day (${fmtH(d.hours)})`;
  return `Day length ${fmtH(d.hours)}`;
}
