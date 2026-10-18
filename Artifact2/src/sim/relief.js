// Auto-relief for silhouette imports (SPEC 2.3): interiors rise away from the
// coast (continental uplift) with low-frequency highlands and a few ridged
// mountain chains, so rain shadows can form. Off: flat lowland plains.

import {
  FLAT_LAND_M, MIN_LAND_M, RELIEF_COAST_M, RELIEF_INTERIOR_M, RELIEF_SCALE_KM,
  RELIEF_NOISE_M, RELIEF_NOISE_FREQ, RELIEF_RIDGE_M, RELIEF_RIDGE_FREQ,
} from './constants.js';
import { noiseField } from './noise.js';

// Fills `elevation` at land pixels (mask = 1) from each pixel's distance to
// water (km).
export function fillRelief(elevation, mask, toWaterKm, cfg, { autoRelief = true, seed = 1 } = {}) {
  if (!autoRelief) {
    for (let i = 0; i < elevation.length; i++) if (mask[i]) elevation[i] = FLAT_LAND_M;
    return elevation;
  }
  const highlands = noiseField(cfg, seed, RELIEF_NOISE_FREQ, 4);
  const ridgeNoise = noiseField(cfg, seed + 13, RELIEF_RIDGE_FREQ, 3);
  for (let i = 0; i < elevation.length; i++) {
    if (!mask[i]) continue;
    const d = Number.isFinite(toWaterKm[i]) ? toWaterKm[i] : RELIEF_SCALE_KM * 4;
    const inland = 1 - Math.exp(-d / RELIEF_SCALE_KM); // 0 at the coast → 1 deep inland
    const ridges = (1 - Math.abs(ridgeNoise[i])) ** 6 * RELIEF_RIDGE_M;
    const e = RELIEF_COAST_M + inland * (RELIEF_INTERIOR_M + highlands[i] * RELIEF_NOISE_M + ridges);
    elevation[i] = Math.max(MIN_LAND_M, e);
  }
  return elevation;
}
