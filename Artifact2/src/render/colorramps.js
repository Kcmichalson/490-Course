// Color ramps for elevation-based map modes. These are map-mode data
// palettes (they describe terrain, not the UI), so per CLAUDE.md they live
// with the renderers rather than in style.css. Pure: no DOM.

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

export function colorAt(lut, elevationM) {
  const idx = Math.min(lut.length / 3 - 1, Math.max(0, Math.round(elevationM) - LUT_MIN));
  return [lut[idx * 3], lut[idx * 3 + 1], lut[idx * 3 + 2]];
}
