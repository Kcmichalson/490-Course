// Physical: bathymetry blues; land greens → browns → white peaks.

import { PHYSICAL_STOPS, buildLut, elevationToRGBA } from '../colorramps.js';

let lut = null;

export function drawPhysical(g, { map, terrain }) {
  lut ??= buildLut(PHYSICAL_STOPS);
  const rgba = elevationToRGBA(terrain.elevation, lut);
  g.putImageData(new ImageData(rgba, map.sourceWidth, map.sourceHeight), 0, 0);
}
