// Generated ocean depth (SPEC 2.7) for imports with no depth data:
// continental shelf, then the continental slope, then the abyssal plain.

import {
  SHELF_DEPTH_M, SHELF_WIDTH_KM, SLOPE_WIDTH_KM, ABYSS_DEPTH_M,
  BATHY_NOISE_M, BATHY_NOISE_FREQ, MIN_OCEAN_M,
} from './constants.js';
import { noiseField } from './noise.js';

const smoothstep = (t) => t * t * (3 - 2 * t);

// Depth (m, negative) at a given distance from land, before noise.
export function profileDepth(distKm) {
  if (!Number.isFinite(distKm)) return ABYSS_DEPTH_M;
  if (distKm <= 0) return 0; // the shoreline itself (avoids −0 from the shelf formula)
  // Shelf: shallow water sloping gently out to ~200 m.
  if (distKm <= SHELF_WIDTH_KM) return SHELF_DEPTH_M * (distKm / SHELF_WIDTH_KM);
  // Slope: drops steeply from the shelf edge to the abyssal plain.
  const t = Math.min(1, (distKm - SHELF_WIDTH_KM) / SLOPE_WIDTH_KM);
  return SHELF_DEPTH_M + (ABYSS_DEPTH_M - SHELF_DEPTH_M) * smoothstep(t);
}

// Fills `elevation` at every pixel where target[i] is set, using each
// pixel's distance to land (km). Noise fades in away from the coast so
// shorelines stay shallow.
export function fillBathymetry(elevation, target, toLandKm, cfg, seed = 1) {
  const noise = noiseField(cfg, seed + 7, BATHY_NOISE_FREQ, 4);
  for (let i = 0; i < elevation.length; i++) {
    if (!target[i]) continue;
    const d = toLandKm[i];
    const fade = Number.isFinite(d) ? Math.min(1, d / SHELF_WIDTH_KM) : 1;
    elevation[i] = Math.min(MIN_OCEAN_M, profileDepth(d) + noise[i] * BATHY_NOISE_M * fade);
  }
  return elevation;
}
