// Elevation: grayscale, like a heightmap.

import { ELEVATION_STOPS, buildLut, elevationToRGBA } from '../colorramps.js';

let lut = null;

export function drawElevation(g, { map, terrain }) {
  lut ??= buildLut(ELEVATION_STOPS);
  const rgba = elevationToRGBA(terrain.elevation, lut);
  g.putImageData(new ImageData(rgba, map.sourceWidth, map.sourceHeight), 0, 0);
}
