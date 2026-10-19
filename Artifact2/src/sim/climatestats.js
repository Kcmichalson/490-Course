// Climate statistics from the 12 monthly mean temperatures (SPEC 13.3 M4
// mode definitions, 13.4 Climate Boundaries). Pure.
//
// Daily values are linear between the mid-month days (cyclic over the year),
// so day counts and degree-days have closed forms per segment (no daily loop).

import { MONTH_MID_DAYS } from './planet.js';
import { YEAR_DAYS } from './constants.js';
import {
  GROWING_THRESHOLD_C, PERMAFROST_C, PERMAFROST_CONTINUOUS_C, SNOW_COVER_C, FREQUENT_FROST_C, OCCASIONAL_FROST_C, SNOWLINE_C,
} from './constants.js';

// Days from each mid-month to the next (the last wraps into January).
export const SEGMENT_DAYS = Object.freeze(MONTH_MID_DAYS.map((d, m) => (m < 11 ? MONTH_MID_DAYS[m + 1] - d : YEAR_DAYS - d + MONTH_MID_DAYS[0])));

export const MONTH_NAMES = Object.freeze(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']);

// Days per year with a daily mean ≥ threshold (the thermal growing season).
export function growingDays(t, threshold = GROWING_THRESHOLD_C) {
  let days = 0;
  for (let m = 0; m < 12; m++) {
    const a = t[m] - threshold;
    const b = t[(m + 1) % 12] - threshold;
    const L = SEGMENT_DAYS[m];
    if (a >= 0 && b >= 0) days += L;
    else if (a >= 0 || b >= 0) days += (L * Math.max(a, b)) / (Math.abs(a) + Math.abs(b));
  }
  return days;
}

// Freezing degree-days (°C·days): the yearly sum of the daily mean's frost,
// Σ max(0, −T). A classic winter-severity index.
export function freezingDegreeDays(t) {
  let sum = 0;
  for (let m = 0; m < 12; m++) {
    const a = -t[m];
    const b = -t[(m + 1) % 12];
    const L = SEGMENT_DAYS[m];
    if (a >= 0 && b >= 0) sum += (L * (a + b)) / 2;
    else if (a > 0 || b > 0) {
      const p = Math.max(a, b);
      sum += (L * p * p) / (2 * (Math.abs(a) + Math.abs(b)));
    }
  }
  return sum;
}

// Warmest and coldest month, and the annual mean.
export function curveStats(t) {
  let warm = 0;
  let cold = 0;
  let sum = 0;
  for (let m = 0; m < 12; m++) {
    if (t[m] > t[warm]) warm = m;
    if (t[m] < t[cold]) cold = m;
    sum += t[m];
  }
  return { warmest: t[warm], warmMonth: warm, coldest: t[cold], coldMonth: cold, mean: sum / 12 };
}

// Frost/Snow/Permafrost classes, first match wins (temperature only; snow
// cover assumes enough precipitation, which arrives in M5).
export const FROST = Object.freeze({
  FROST_FREE: 0, OCCASIONAL: 1, FREQUENT: 2, SNOW_COVER: 3, PERMAFROST: 4, CONTINUOUS: 5, ICE_CAP: 6,
});
export const FROST_LABELS = Object.freeze([
  'Frost-free', 'Occasional frost', 'Frequent frost', 'Lasting snow cover', 'Discontinuous permafrost',
  'Continuous permafrost', 'Ice-cap climate',
]);

export function frostClass(warmest, coldest, mean) {
  if (warmest < SNOWLINE_C) return FROST.ICE_CAP;
  if (mean <= PERMAFROST_CONTINUOUS_C) return FROST.CONTINUOUS;
  if (mean <= PERMAFROST_C) return FROST.PERMAFROST;
  if (coldest < SNOW_COVER_C) return FROST.SNOW_COVER;
  if (coldest < FREQUENT_FROST_C) return FROST.FREQUENT;
  if (coldest < OCCASIONAL_FROST_C) return FROST.OCCASIONAL;
  return FROST.FROST_FREE;
}

// Marching squares: line segments where `field` crosses `level`, in cell
// coordinates (cell centers at integers). NaN cells are masked out (no line
// through a square touching one). On wrapping maps the last column joins the
// first. → Float32Array [x0, y0, x1, y1, …]
export function contourSegments(field, W, H, level, wraps = false) {
  const out = [];
  const cols = wraps ? W : W - 1;
  const edge = (xa, ya, va, xb, yb, vb) => {
    const f = (level - va) / (vb - va);
    return [xa + (xb - xa) * f, ya + (yb - ya) * f];
  };
  for (let j = 0; j < H - 1; j++) {
    for (let i = 0; i < cols; i++) {
      const i1 = i + 1 === W ? 0 : i + 1;
      const a = field[j * W + i];          // top-left
      const b = field[j * W + i1];         // top-right
      const c = field[(j + 1) * W + i1];   // bottom-right
      const d = field[(j + 1) * W + i];    // bottom-left
      if (Number.isNaN(a) || Number.isNaN(b) || Number.isNaN(c) || Number.isNaN(d)) continue;
      const code = (a >= level ? 8 : 0) | (b >= level ? 4 : 0) | (c >= level ? 2 : 0) | (d >= level ? 1 : 0);
      if (code === 0 || code === 15) continue;
      const x1 = i + 1;
      const top = () => edge(i, j, a, x1, j, b);
      const right = () => edge(x1, j, b, x1, j + 1, c);
      const bottom = () => edge(i, j + 1, d, x1, j + 1, c);
      const left = () => edge(i, j, a, i, j + 1, d);
      const seg = (p, q) => out.push(p[0], p[1], q[0], q[1]);
      switch (code) {
        case 1: case 14: seg(left(), bottom()); break;
        case 2: case 13: seg(bottom(), right()); break;
        case 3: case 12: seg(left(), right()); break;
        case 4: case 11: seg(top(), right()); break;
        case 6: case 9: seg(top(), bottom()); break;
        case 7: case 8: seg(left(), top()); break;
        case 5: case 10: {
          // Saddle: the square's mean decides which corners connect.
          const high = (a + b + c + d) / 4 >= level;
          if ((code === 5) === high) { seg(left(), top()); seg(bottom(), right()); } else { seg(left(), bottom()); seg(top(), right()); }
          break;
        }
        default: break;
      }
    }
  }
  return Float32Array.from(out);
}
