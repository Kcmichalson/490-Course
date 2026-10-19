// Slope and ruggedness of the terrain (SPEC 13.3, Slope & Ruggedness mode;
// also the gradient behind Shaded Relief). Pure.
//
// Gradients use central differences over real distances: north-south pixel
// spacing is uniform, east-west spacing shrinks with cos(latitude) (from
// distance.pixelKm), so a slope reads the same anywhere on the map. Columns
// wrap on east-west wrapping maps; rows clamp at the top and bottom edges.

import { pixelKm } from './distance.js';
import { CATEGORY } from './terrain.js';

// Spacing in meters for a map: { dyM, dxM: Float64Array(height) }.
export function spacingM(cfg, radiusKm) {
  const { dyKm, dxKm } = pixelKm(cfg, radiusKm);
  return { dyM: dyKm * 1000, dxM: dxKm.map((v) => v * 1000) };
}

// Elevation gradient at pixel (x, y): { east, north } in m per m (rise over
// run). Lakes are flat water surfaces, so a lake pixel has no gradient and
// lake pixels don't feed their neighbors' gradients either.
export function gradientAt(terrain, spacing, wraps, x, y) {
  const out = [0, 0];
  gradientInto(terrain, spacing, wraps, x, y, out);
  return { east: out[0], north: out[1] };
}

// The same, written into out[0] (east) and out[1] (north) with no
// allocation, for whole-map loops.
export function gradientInto(terrain, spacing, wraps, x, y, out) {
  const { width: w, height: h, elevation: e, category: cat } = terrain;
  const i = y * w + x;
  if (cat && cat[i] === CATEGORY.LAKE) { out[0] = 0; out[1] = 0; return; }
  const xl = x > 0 ? x - 1 : wraps ? w - 1 : x;
  const xr = x < w - 1 ? x + 1 : wraps ? 0 : x;
  const yu = y > 0 ? y - 1 : y;
  const yd = y < h - 1 ? y + 1 : y;
  const val = (j) => (cat && cat[j] === CATEGORY.LAKE ? e[i] : e[j]);
  // Steps between the two samples (one-sided at an open edge).
  const nx = (xl === x ? 0 : 1) + (xr === x ? 0 : 1);
  const ny = (yu === y ? 0 : 1) + (yd === y ? 0 : 1);
  out[0] = nx ? (val(y * w + xr) - val(y * w + xl)) / (nx * spacing.dxM[y]) : 0;
  out[1] = ny ? (val(yu * w + x) - val(yd * w + x)) / (ny * spacing.dyM) : 0; // row 0 is north
}

// Slope in degrees at a pixel.
export function slopeDegrees(terrain, spacing, wraps, x, y) {
  const g = gradientAt(terrain, spacing, wraps, x, y);
  return (Math.atan(Math.hypot(g.east, g.north)) * 180) / Math.PI;
}

// Terrain ruggedness index: the mean absolute height difference (m) between
// a pixel and its 8 neighbors (Riley et al. 1999, averaged rather than summed
// so it doesn't depend on how many neighbors exist at the map edge).
export function ruggednessAt(terrain, wraps, x, y) {
  const { width: w, height: h, elevation: e } = terrain;
  const c = e[y * w + x];
  let sum = 0;
  let n = 0;
  for (let dy = -1; dy <= 1; dy++) {
    const yy = y + dy;
    if (yy < 0 || yy >= h) continue;
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      let xx = x + dx;
      if (xx < 0 || xx >= w) {
        if (!wraps) continue;
        xx = (xx + w) % w;
      }
      sum += Math.abs(e[yy * w + xx] - c);
      n++;
    }
  }
  return n ? sum / n : 0;
}

// Slope classes for the map mode (degrees, upper bounds): < 0.5°, 0.5–2°,
// 2–5°, 5–10°, > 10°.
export const SLOPE_CLASS_LIMITS = [0.5, 2, 5, 10];

export function slopeClass(deg) {
  let k = 0;
  while (k < SLOPE_CLASS_LIMITS.length && deg >= SLOPE_CLASS_LIMITS[k]) k++;
  return k;
}
