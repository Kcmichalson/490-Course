// Elevation: grayscale, like a heightmap. Land below sea level reads as the
// 0 m land gray, so coasts stay visible. Supports redrawing a rectangle.

import { ELEVATION_STOPS, buildLut, terrainToRGBA } from '../colorramps.js';

let lut = null;

export function drawElevation(g, { map, terrain, rect = null }) {
  lut ??= buildLut(ELEVATION_STOPS);
  const r = rect ?? { x0: 0, y0: 0, x1: map.sourceWidth, y1: map.sourceHeight };
  const rgba = terrainToRGBA(terrain, lut, r, { categoryColors: false });
  g.putImageData(new ImageData(rgba, r.x1 - r.x0, r.y1 - r.y0), r.x0, r.y0);
}
drawElevation.partial = true;
