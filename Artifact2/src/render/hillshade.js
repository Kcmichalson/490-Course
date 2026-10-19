// Shaded Relief (SPEC 13.3): a grayscale hillshade lit from the northwest,
// blended over any map mode with `overlay` at 60%. Flat ground is mid-gray,
// which `overlay` leaves unchanged; slopes facing the light brighten and
// slopes facing away darken. Lakes are flat water. Rendered at source size
// into its own cached layer; brush strokes redraw just their rectangles.

import { spacingM, gradientInto } from '../sim/slope.js';
import { PLANET_RADIUS_KM } from '../sim/constants.js';

export const RELIEF_AZIMUTH_DEG = 315;   // light from the northwest (cartographic convention)
export const RELIEF_ALTITUDE_DEG = 45;   // sun 45° above the horizon
export const RELIEF_EXAGGERATION = 20;   // map-scale relief is too gentle to see unexaggerated
export const RELIEF_ALPHA = 0.6;

const AZ = (RELIEF_AZIMUTH_DEG * Math.PI) / 180;
const ZEN = ((90 - RELIEF_ALTITUDE_DEG) * Math.PI) / 180;
// Unit vector toward the light, in (east, north, up) components.
const LX = Math.sin(AZ) * Math.sin(ZEN);
const LY = Math.cos(AZ) * Math.sin(ZEN);
const LZ = Math.cos(ZEN);

// Lambertian shading of a surface with the given gradient (m per m), scaled
// so flat ground gives 128.
export function shadeValue(east, north, exaggeration = RELIEF_EXAGGERATION) {
  const gx = east * exaggeration;
  const gy = north * exaggeration;
  // Surface normal (−gx, −gy, 1), normalized, dotted with the light.
  const lambert = (-gx * LX - gy * LY + LZ) / Math.sqrt(gx * gx + gy * gy + 1);
  return Math.max(0, Math.min(255, Math.round((128 * Math.max(0, lambert)) / LZ)));
}

let cache = { cfg: null, spacing: null };

export function drawHillshade(g, { map, terrain, rect = null }) {
  if (cache.cfg !== map) cache = { cfg: map, spacing: spacingM(map, PLANET_RADIUS_KM) };
  const r = rect
    ? { x0: Math.max(0, rect.x0 - 1), y0: Math.max(0, rect.y0 - 1), x1: Math.min(map.sourceWidth, rect.x1 + 1), y1: Math.min(map.sourceHeight, rect.y1 + 1) }
    : { x0: 0, y0: 0, x1: map.sourceWidth, y1: map.sourceHeight };
  const w = r.x1 - r.x0;
  const out = new Uint8ClampedArray(w * (r.y1 - r.y0) * 4);
  const grad = [0, 0];
  let p = 0;
  for (let y = r.y0; y < r.y1; y++) {
    for (let x = r.x0; x < r.x1; x++, p += 4) {
      gradientInto(terrain, cache.spacing, map.wraps, x, y, grad);
      const v = shadeValue(grad[0], grad[1]);
      out[p] = v; out[p + 1] = v; out[p + 2] = v; out[p + 3] = 255;
    }
  }
  g.putImageData(new ImageData(out, w, r.y1 - r.y0), r.x0, r.y0);
}
