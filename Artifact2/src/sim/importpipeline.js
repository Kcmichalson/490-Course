// Import pipeline (SPEC 2.3–2.8): image pixels + settings → full-resolution
// terrain + sim grid. Pure and deterministic for a given seed, so the worker,
// Reload, and Map settings all produce identical results.
//
// buildTerrain({ kind, rgba, maskRgba?, settings, cfg, radiusKm? })
//   kind: 'heightmap' | 'silhouette'
//   rgba / maskRgba: Uint8ClampedArray, cfg.sourceWidth × cfg.sourceHeight
//   heightmap settings: { seaLevel, highest, maxHeight, gamma, depthMode,
//                         maxDepth, smoothing, mask: { mode, threshold, invert } }
//   silhouette settings: { mode, threshold, invert, autoRelief, seed }

import { PLANET_RADIUS_KM, MIN_LAND_M, MIN_OCEAN_M } from './constants.js';
import { luminance, grayHistogram, detectLevels, grayToElevation } from './heightmap.js';
import { silhouetteMask } from './silhouette.js';
import { coastDistancesKm, distanceToFeatureKm } from './distance.js';
import { boxBlur } from './blur.js';
import { fillBathymetry } from './bathymetry.js';
import { fillRelief } from './relief.js';
import { makeTerrain, landMask } from './terrain.js';
import { downsampleTerrain } from './downsample.js';

// Resolves Auto fields against what the image contains.
export function resolveHeightmapSettings(levels, s) {
  const seaLevel = s.seaLevel === 'auto' || s.seaLevel == null ? levels.seaLevel : s.seaLevel;
  const highest = s.highest === 'auto' || s.highest == null ? levels.highest : s.highest;
  const depthMode = s.depthMode === 'auto' || s.depthMode == null
    ? (levels.flatOcean ? 'generate' : 'linear')
    : s.depthMode;
  return { ...s, seaLevel, highest, depthMode, darkest: levels.darkest };
}

function heightmapElevation({ rgba, maskRgba, settings, cfg, radiusKm }) {
  const gray = luminance(rgba);
  const levels = detectLevels(grayHistogram(gray));
  const s = resolveHeightmapSettings(levels, settings);
  if (s.seaLevel == null) throw new Error('Set the sea level value: this image has no flat ocean to detect it from.');
  const elev = grayToElevation(gray, s);
  const n = elev.length;

  // The land/sea mask wins over the heightmap (SPEC 2.6): mask land at or
  // below sea level becomes just above it; mask ocean above sea level gets
  // generated depth.
  let land;
  if (maskRgba) {
    land = silhouetteMask(maskRgba, settings.mask ?? {});
    for (let i = 0; i < n; i++) {
      if (land[i] && !(elev[i] > 0)) elev[i] = MIN_LAND_M;
      else if (!land[i] && elev[i] > 0) elev[i] = NaN;
    }
  } else {
    land = landMask(makeTerrain(cfg.sourceWidth, cfg.sourceHeight, elev));
  }

  // Smooth 8-bit terracing, then restore the coastline so blurring never
  // moves it: land stays above sea level, water stays below.
  if (s.smoothing > 0) {
    const pending = new Uint8Array(n);
    const filled = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pending[i] = Number.isNaN(elev[i]) ? 1 : 0;
      filled[i] = pending[i] ? 0 : elev[i];
    }
    const blurred = boxBlur(filled, cfg.sourceWidth, cfg.sourceHeight, s.smoothing, cfg.wraps);
    for (let i = 0; i < n; i++) {
      if (pending[i]) continue;
      elev[i] = land[i] ? Math.max(MIN_LAND_M, blurred[i]) : Math.min(MIN_OCEAN_M, blurred[i]);
    }
  }

  // Generated bathymetry for water with no depth data.
  const pending = new Uint8Array(n);
  let any = false;
  for (let i = 0; i < n; i++) if (Number.isNaN(elev[i])) { pending[i] = 1; any = true; }
  if (any) fillBathymetry(elev, pending, distanceToFeatureKm(land, cfg, radiusKm), cfg, settings.seed ?? 1);
  return { elev, info: { levels, resolved: s } };
}

function silhouetteElevation({ rgba, settings, cfg, radiusKm }) {
  const land = silhouetteMask(rgba, settings);
  const n = land.length;
  const elev = new Float32Array(n);
  const water = new Uint8Array(n);
  for (let i = 0; i < n; i++) water[i] = land[i] ? 0 : 1;
  const { toLand, toWater } = coastDistancesKm(land, cfg, radiusKm);
  fillRelief(elev, land, toWater, cfg, { autoRelief: settings.autoRelief !== false, seed: settings.seed ?? 1 });
  fillBathymetry(elev, water, toLand, cfg, settings.seed ?? 1);
  return { elev, info: {} };
}

export function buildTerrain({ kind, rgba, maskRgba = null, settings, cfg, radiusKm = PLANET_RADIUS_KM }) {
  const args = { rgba, maskRgba, settings, cfg, radiusKm };
  const { elev, info } = kind === 'heightmap' ? heightmapElevation(args) : silhouetteElevation(args);
  const terrain = makeTerrain(cfg.sourceWidth, cfg.sourceHeight, elev);
  const sim = downsampleTerrain(terrain, cfg);
  const land = landMask(terrain);
  let landPixels = 0;
  for (let i = 0; i < land.length; i++) landPixels += land[i];
  return { terrain, sim, info: { ...info, landFraction: landPixels / land.length } };
}
