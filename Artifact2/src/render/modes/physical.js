// Physical: bathymetry blues; land greens → browns → white peaks. Lakes and
// ice in their category colors; land below sea level stays green.
// Supports redrawing just a rectangle (brush strokes).

import { PHYSICAL_STOPS, buildLut, terrainToRGBA } from '../colorramps.js';

let lut = null;

export function drawPhysical(g, { map, terrain, rect = null }) {
  lut ??= buildLut(PHYSICAL_STOPS);
  const r = rect ?? { x0: 0, y0: 0, x1: map.sourceWidth, y1: map.sourceHeight };
  const rgba = terrainToRGBA(terrain, lut, r);
  g.putImageData(new ImageData(rgba, r.x1 - r.x0, r.y1 - r.y0), r.x0, r.y0);
}
drawPhysical.partial = true;
