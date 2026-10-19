// Import pipeline (SPEC 2.3–2.8): image pixels + settings → full-resolution
// terrain + sim grid. Pure and deterministic for a given seed, so the worker,
// Reload, and Map settings all produce identical results.
//
// buildTerrain({ kind, rgba, maskRgba?, settings, cfg, radiusKm? })
//   kind: 'heightmap' | 'silhouette' | 'palette'
//   rgba / maskRgba: Uint8ClampedArray, cfg.sourceWidth × cfg.sourceHeight
//   heightmap settings: { seaLevel, highest, maxHeight, gamma, depthMode,
//                         maxDepth, smoothing, mask: { mode, threshold, invert } }
//   silhouette settings: { mode, threshold, invert, autoRelief, seed }
//   palette settings: { swatches: [{ hex, category, elevation }], tolerance,
//                       smoothing, seed }

import {
  PLANET_RADIUS_KM, MIN_LAND_M, MIN_OCEAN_M, PALETTE_TOLERANCE_DE, SHALLOW_SEA_M, DEEP_OCEAN_MAX_M,
} from './constants.js';
import { luminance, grayHistogram, detectLevels, grayToElevation } from './heightmap.js';
import { silhouetteMask } from './silhouette.js';
import { coastDistancesKm, distanceToFeatureKm, nearestFeatureIndex } from './distance.js';
import { smoothKeepingCoast } from './blur.js';
import { fillBathymetry } from './bathymetry.js';
import { fillRelief } from './relief.js';
import { CATEGORY, makeTerrain, landMask, categoryFromElevation, isLandCategory } from './terrain.js';
import { classifyPixels, paletteReady, defaultElevation, UNMATCHED } from './palette.js';
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
    for (let i = 0; i < n; i++) pending[i] = Number.isNaN(elev[i]) ? 1 : 0;
    smoothKeepingCoast(elev, cfg.sourceWidth, cfg.sourceHeight, s.smoothing, cfg.wraps, {
      land, skip: pending, skippedAsZero: true, minLand: MIN_LAND_M, maxWater: MIN_OCEAN_M,
    });
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

// Terrain category for each palette swatch category.
const PALETTE_TO_CATEGORY = {
  deep: CATEGORY.OCEAN, shallow: CATEGORY.OCEAN, 'sea-ice': CATEGORY.SEA_ICE,
  lake: CATEGORY.LAKE, land: CATEGORY.LAND, 'land-ice': CATEGORY.LAND_ICE,
};

// Color palette (SPEC 2.5): each pixel takes its swatch's category and
// elevation. Ignored and unmatched pixels (clouds, anti-aliased edges, JPEG
// noise) copy the nearest classified pixel, so a cloud over a coast splits
// at the midline. Deep ocean and sea ice get generated depth.
function paletteElevation({ rgba, settings, cfg, radiusKm }) {
  const { swatches = [], tolerance = PALETTE_TOLERANCE_DE, smoothing = 0 } = settings;
  if (!paletteReady(swatches)) throw new Error('Assign at least one land swatch and one water swatch.');
  const w = cfg.sourceWidth;
  const h = cfg.sourceHeight;
  const { index, unmatched } = classifyPixels(rgba, swatches, tolerance);
  const n = index.length;
  const usable = swatches.map((s) => s.category in PALETTE_TO_CATEGORY);
  const known = new Uint8Array(n);
  let ignored = 0;
  for (let i = 0; i < n; i++) {
    const k = index[i];
    if (k !== UNMATCHED && usable[k]) known[i] = 1;
    else if (k !== UNMATCHED) ignored++;
  }
  const nearest = nearestFeatureIndex(known, cfg, radiusKm);

  const category = new Uint8Array(n);
  const elev = new Float32Array(n);
  const pending = new Uint8Array(n); // depth still to generate
  const notOcean = new Uint8Array(n); // land and lakes: what ocean depth is measured from
  const skip = new Uint8Array(n); // lakes and pending depths stay out of the smoothing
  for (let i = 0; i < n; i++) {
    const s = swatches[index[known[i] ? i : nearest[i]]];
    const c = PALETTE_TO_CATEGORY[s.category];
    category[i] = c;
    if (s.category === 'deep' || s.category === 'sea-ice') {
      elev[i] = NaN;
      pending[i] = 1;
      skip[i] = 1;
    } else if (s.category === 'shallow') {
      elev[i] = SHALLOW_SEA_M;
    } else {
      const e = Number(s.elevation);
      elev[i] = Number.isFinite(e) ? e : defaultElevation(s.category);
      notOcean[i] = 1;
      if (s.category === 'lake') skip[i] = 1;
    }
  }
  const land = new Uint8Array(n);
  for (let i = 0; i < n; i++) land[i] = isLandCategory(category[i]) ? 1 : 0;
  if (smoothing > 0) smoothKeepingCoast(elev, w, h, smoothing, cfg.wraps, { land, skip, minLand: MIN_LAND_M, maxWater: MIN_OCEAN_M });

  if (pending.some((p) => p)) {
    fillBathymetry(elev, pending, distanceToFeatureKm(notOcean, cfg, radiusKm), cfg, settings.seed ?? 1);
    for (let i = 0; i < n; i++) if (pending[i]) elev[i] = Math.min(DEEP_OCEAN_MAX_M, elev[i]);
  }
  return { elev, category, info: { unmatchedFraction: unmatched / n, ignoredFraction: ignored / n } };
}

export function buildTerrain({ kind, rgba, maskRgba = null, settings, cfg, radiusKm = PLANET_RADIUS_KM }) {
  const args = { rgba, maskRgba, settings, cfg, radiusKm };
  let built;
  if (kind === 'palette') built = paletteElevation(args);
  else built = kind === 'heightmap' ? heightmapElevation(args) : silhouetteElevation(args);
  const { elev, info } = built;
  const terrain = makeTerrain(cfg.sourceWidth, cfg.sourceHeight, elev,
    built.category ?? categoryFromElevation(cfg.sourceWidth, cfg.sourceHeight, elev));
  const sim = downsampleTerrain(terrain, cfg);
  const land = landMask(terrain);
  let landPixels = 0;
  for (let i = 0; i < land.length; i++) landPixels += land[i];
  return { terrain, sim, info: { ...info, landFraction: landPixels / land.length } };
}
