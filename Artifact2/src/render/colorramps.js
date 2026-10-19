// Color ramps for elevation-based map modes. These are map-mode data
// palettes (they describe terrain, not the UI), so per CLAUDE.md they live
// with the renderers rather than in style.css. Pure: no DOM.

import { CATEGORY, isLandCategory } from '../sim/terrain.js';

// Physical: bathymetry blues, then land greens → browns → white peaks.
export const PHYSICAL_STOPS = [
  [-11000, [5, 18, 40]],
  [-6000, [10, 34, 72]],
  [-4000, [22, 64, 118]],
  [-2000, [40, 96, 160]],
  [-200, [96, 160, 214]],
  [-1, [150, 200, 236]],
  [0, [92, 140, 78]],
  [300, [126, 168, 92]],
  [800, [196, 190, 120]],
  [1500, [176, 136, 88]],
  [2500, [140, 104, 76]],
  [4000, [222, 216, 208]],
  [9000, [255, 255, 255]],
];

// Elevation: grayscale like a heightmap. Dark water, then a jump at the
// coast so shorelines read clearly, brightening with height.
export const ELEVATION_STOPS = [
  [-11000, [0, 0, 0]],
  [-1, [40, 40, 40]],
  [0, [70, 70, 70]],
  [6000, [255, 255, 255]],
  [9000, [255, 255, 255]],
];

// Physical mode colors for categories that aren't drawn by elevation.
// Lakes draw as fresh water whatever their surface height; ice as ice.
export const CATEGORY_COLORS = {
  [CATEGORY.LAKE]: [82, 150, 200],
  [CATEGORY.LAND_ICE]: [236, 242, 246],
  [CATEGORY.SEA_ICE]: [204, 224, 238],
};

const LUT_MIN = -11000;
const LUT_MAX = 9000;

// One RGB entry per meter from LUT_MIN to LUT_MAX.
export function buildLut(stops) {
  const n = LUT_MAX - LUT_MIN + 1;
  const lut = new Uint8ClampedArray(n * 3);
  let s = 0;
  for (let i = 0; i < n; i++) {
    const e = LUT_MIN + i;
    while (s < stops.length - 2 && e > stops[s + 1][0]) s++;
    const [e0, c0] = stops[s];
    const [e1, c1] = stops[s + 1];
    const t = e1 === e0 ? 0 : Math.min(1, Math.max(0, (e - e0) / (e1 - e0)));
    for (let k = 0; k < 3; k++) lut[i * 3 + k] = Math.round(c0[k] + (c1[k] - c0[k]) * t);
  }
  return lut;
}

// Elevation (m) → RGBA bytes via a LUT. NaN draws as the deepest color.
export function elevationToRGBA(elevation, lut, out = new Uint8ClampedArray(elevation.length * 4)) {
  const last = lut.length / 3 - 1;
  for (let i = 0, p = 0; i < elevation.length; i++, p += 4) {
    const e = elevation[i];
    const idx = Number.isNaN(e) ? 0 : Math.min(last, Math.max(0, Math.round(e) - LUT_MIN));
    out[p] = lut[idx * 3];
    out[p + 1] = lut[idx * 3 + 1];
    out[p + 2] = lut[idx * 3 + 2];
    out[p + 3] = 255;
  }
  return out;
}

// Terrain → RGBA bytes for the rectangle { x0, y0, x1, y1 } (exclusive ends;
// whole map when rect is null). Land below sea level draws as the lowest land
// color, so depressions still read as land. With categoryColors, lakes and
// ice use CATEGORY_COLORS (Physical); without, everything follows elevation
// (Elevation mode).
export function terrainToRGBA(terrain, lut, rect = null, { categoryColors = true } = {}) {
  const { width: w, elevation: elev, category: cat } = terrain;
  const x0 = rect ? rect.x0 : 0;
  const y0 = rect ? rect.y0 : 0;
  const x1 = rect ? rect.x1 : w;
  const y1 = rect ? rect.y1 : terrain.height;
  const out = new Uint8ClampedArray((x1 - x0) * (y1 - y0) * 4);
  const last = lut.length / 3 - 1;
  const landFloor = -LUT_MIN; // LUT index of 0 m
  let p = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++, p += 4) {
      const i = y * w + x;
      const c = cat ? cat[i] : -1;
      const special = categoryColors && c >= 0 ? CATEGORY_COLORS[c] : null;
      if (special) {
        out[p] = special[0]; out[p + 1] = special[1]; out[p + 2] = special[2]; out[p + 3] = 255;
        continue;
      }
      const e = elev[i];
      let idx = Number.isNaN(e) ? 0 : Math.min(last, Math.max(0, Math.round(e) - LUT_MIN));
      if (c >= 0 && isLandCategory(c) && idx < landFloor) idx = landFloor;
      out[p] = lut[idx * 3];
      out[p + 1] = lut[idx * 3 + 1];
      out[p + 2] = lut[idx * 3 + 2];
      out[p + 3] = 255;
    }
  }
  return out;
}

export function colorAt(lut, elevationM) {
  const idx = Math.min(lut.length / 3 - 1, Math.max(0, Math.round(elevationM) - LUT_MIN));
  return [lut[idx * 3], lut[idx * 3 + 1], lut[idx * 3 + 2]];
}
