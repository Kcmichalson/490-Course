// Slope & Ruggedness (SPEC 13.3): land slope in five classes, dark plains to
// bright ridges; lakes and ocean in one muted water color. Ruggedness (TRI)
// is shown in the hover tooltip. Supports redrawing a rectangle (strokes).

import { spacingM, gradientInto, slopeClass, SLOPE_CLASS_LIMITS } from '../../sim/slope.js';
import { isLandCategory } from '../../sim/terrain.js';
import { PLANET_RADIUS_KM } from '../../sim/constants.js';

// Data palette for the classes (with the renderer, per CLAUDE.md).
export const SLOPE_COLORS = [
  [40, 44, 40],
  [78, 92, 66],
  [132, 142, 84],
  [200, 184, 104],
  [252, 238, 192],
];
const WATER = [42, 58, 76];

let cache = { cfg: null, spacing: null };

export function drawSlope(g, { map, terrain, rect = null }) {
  if (cache.cfg !== map) cache = { cfg: map, spacing: spacingM(map, PLANET_RADIUS_KM) };
  const { spacing } = cache;
  // A stroke changes the slope one pixel beyond its rectangle too.
  const r = rect
    ? { x0: Math.max(0, rect.x0 - 1), y0: Math.max(0, rect.y0 - 1), x1: Math.min(map.sourceWidth, rect.x1 + 1), y1: Math.min(map.sourceHeight, rect.y1 + 1) }
    : { x0: 0, y0: 0, x1: map.sourceWidth, y1: map.sourceHeight };
  const w = r.x1 - r.x0;
  const out = new Uint8ClampedArray(w * (r.y1 - r.y0) * 4);
  const grad = [0, 0];
  const deg = 180 / Math.PI;
  const { width: tw, category: cat, elevation: elev } = terrain;
  let p = 0;
  for (let y = r.y0; y < r.y1; y++) {
    for (let x = r.x0; x < r.x1; x++, p += 4) {
      const i = y * tw + x;
      const land = cat ? isLandCategory(cat[i]) : elev[i] > 0;
      let c = WATER;
      if (land) {
        gradientInto(terrain, spacing, map.wraps, x, y, grad);
        c = SLOPE_COLORS[slopeClass(Math.atan(Math.hypot(grad[0], grad[1])) * deg)];
      }
      out[p] = c[0]; out[p + 1] = c[1]; out[p + 2] = c[2]; out[p + 3] = 255;
    }
  }
  g.putImageData(new ImageData(out, w, r.y1 - r.y0), r.x0, r.y0);
}
drawSlope.partial = true;

const rgb = (c) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
const L = SLOPE_CLASS_LIMITS;
drawSlope.legend = {
  items: [
    ...SLOPE_COLORS.map((c, k) => ({
      color: rgb(c),
      label: k === 0 ? `< ${L[0]}°` : k === L.length ? `> ${L[L.length - 1]}°` : `${L[k - 1]}–${L[k]}°`,
    })),
    { color: rgb(WATER), label: 'Water' },
  ],
  note: 'Slope of the land. Hover for ruggedness (TRI).',
};
