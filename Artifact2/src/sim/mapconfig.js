// Map configuration: the size and geographic extent of a map.
// Pure data and functions (no DOM), shared by the UI, the worker, and tests.
//
// A map config is a plain object that is replaced wholesale, never mutated:
// {
//   sourceWidth, sourceHeight  // px, the original map size
//   latTop, latBottom          // deg, top EDGE of row 0 / bottom EDGE of last row
//   lonWest, lonSpan           // deg, left EDGE of column 0 / total width
//   wraps                      // east-west wrap, only valid when lonSpan is 360
//   simWidth                   // simulation grid width in cells
//   radiusKm                   // planet radius (M3); every km conversion reads it
// }

import { PLANET_RADIUS_KM, PLANET_RADIUS_MIN_KM, PLANET_RADIUS_MAX_KM } from './constants.js';

export const MIN_SOURCE_SIZE = 16;
export const MAX_SOURCE_WIDTH = 8192;
export const MAX_SOURCE_HEIGHT = 4096;
export const SIM_WIDTHS = [512, 1024, 2048];

export const SIZE_PRESETS = [
  { id: '2048x1024', label: '2048 × 1024', width: 2048, height: 1024 },
  { id: '4096x2048', label: '4096 × 2048', width: 4096, height: 2048 },
  { id: '5632x2048', label: '5632 × 2048 (Paradox-style)', width: 5632, height: 2048 },
];

export const DEFAULT_MAP = Object.freeze({
  sourceWidth: 2048,
  sourceHeight: 1024,
  latTop: 90,
  latBottom: -90,
  lonWest: -180,
  lonSpan: 360,
  wraps: true,
  simWidth: 1024,
  radiusKm: PLANET_RADIUS_KM,
});

const EPS = 1e-9;

export function isFullSpan(lonSpan) {
  return Math.abs(lonSpan - 360) < EPS;
}

// Sim widths offered for a source width: the standard widths that fit, or the
// source width itself when the source is narrower than the smallest one.
export function allowedSimWidths(sourceWidth) {
  const w = Math.floor(sourceWidth);
  if (w < SIM_WIDTHS[0]) return [w];
  return SIM_WIDTHS.filter((s) => s <= w);
}

// Returns a list of human-readable problems; empty means valid.
export function validateMapConfig(cfg) {
  const errors = [];
  const num = (v) => typeof v === 'number' && Number.isFinite(v);

  const { sourceWidth: w, sourceHeight: h } = cfg;
  if (!Number.isInteger(w) || w < MIN_SOURCE_SIZE || w > MAX_SOURCE_WIDTH) {
    errors.push(`Width must be a whole number from ${MIN_SOURCE_SIZE} to ${MAX_SOURCE_WIDTH} px.`);
  }
  if (!Number.isInteger(h) || h < MIN_SOURCE_SIZE || h > MAX_SOURCE_HEIGHT) {
    errors.push(`Height must be a whole number from ${MIN_SOURCE_SIZE} to ${MAX_SOURCE_HEIGHT} px.`);
  }

  if (!num(cfg.latTop) || !num(cfg.latBottom)) {
    errors.push('Latitudes must be numbers.');
  } else {
    if (cfg.latTop > 90 || cfg.latTop < -90 || cfg.latBottom > 90 || cfg.latBottom < -90) {
      errors.push('Latitudes must be between 90°S (−90) and 90°N (90).');
    }
    if (cfg.latTop <= cfg.latBottom) {
      errors.push('The top-edge latitude must be north of the bottom-edge latitude.');
    }
  }

  if (!num(cfg.lonWest) || cfg.lonWest < -360 || cfg.lonWest > 360) {
    errors.push('West-edge longitude must be a number from −360 to 360.');
  }
  if (!num(cfg.lonSpan) || cfg.lonSpan <= 0 || cfg.lonSpan > 360 + EPS) {
    errors.push('Longitude span must be greater than 0° and at most 360°.');
  }
  if (cfg.wraps && !isFullSpan(cfg.lonSpan)) {
    errors.push('East-west wrap needs a 360° longitude span.');
  }

  if (!num(cfg.radiusKm) || cfg.radiusKm < PLANET_RADIUS_MIN_KM || cfg.radiusKm > PLANET_RADIUS_MAX_KM) {
    errors.push(`Planet radius must be from ${PLANET_RADIUS_MIN_KM} to ${PLANET_RADIUS_MAX_KM} km.`);
  }
  if (Number.isInteger(w) && !allowedSimWidths(w).includes(cfg.simWidth)) {
    errors.push(`Simulation width must be one of: ${allowedSimWidths(w).join(', ')}.`);
  }
  return errors;
}

// Builds a frozen, valid config from partial options. Sizes are rounded,
// wrap is switched off for partial spans, and an unavailable sim width falls
// back to the largest allowed width not above it (or the smallest allowed).
// Throws if the result is still invalid (e.g. bad latitudes).
export function createMapConfig(opts = {}) {
  const cfg = { ...DEFAULT_MAP, ...opts };
  cfg.sourceWidth = Math.round(Number(cfg.sourceWidth));
  cfg.sourceHeight = Math.round(Number(cfg.sourceHeight));
  for (const k of ['latTop', 'latBottom', 'lonWest', 'lonSpan', 'simWidth', 'radiusKm']) cfg[k] = Number(cfg[k]);
  cfg.wraps = Boolean(cfg.wraps) && isFullSpan(cfg.lonSpan);
  if (isFullSpan(cfg.lonSpan)) cfg.lonSpan = 360;

  if (Number.isInteger(cfg.sourceWidth) && cfg.sourceWidth >= MIN_SOURCE_SIZE) {
    const allowed = allowedSimWidths(cfg.sourceWidth);
    if (!allowed.includes(cfg.simWidth)) {
      const below = allowed.filter((s) => s <= cfg.simWidth);
      cfg.simWidth = below.length ? below[below.length - 1] : allowed[0];
    }
  }

  const errors = validateMapConfig(cfg);
  if (errors.length) throw new Error(errors.join(' '));
  return Object.freeze(cfg);
}

// ---- Config paths (M3) ----
// The dialogs edit the extent fields but not the planet radius (it belongs to
// the Planet panel), yet every config must carry one. These helpers are the
// one place each path adds the current map's radius, both to the values a
// dialog validates and to the config it builds. Dialog fields are
// { latTop, latBottom, lonWest, lonSpan, wraps, simWidth } (New Map also
// has sourceWidth, sourceHeight).

// Extent-field values for a fixed pixel size (Import, Map Settings, and the
// size-changed Reload, which reopens Import), ready to validate.
export function extentValues(fields, size, radiusKm) {
  return { ...fields, sourceWidth: size.width, sourceHeight: size.height, radiusKm };
}

// New Map dialog values, ready to validate.
export function newMapValues(fields, radiusKm) {
  return { ...fields, radiusKm };
}

// New Map: a new size and extent on the same planet.
export function newMapConfig(values, currentMap) {
  return createMapConfig({ ...values, radiusKm: currentMap.radiusKm });
}

// Import (and size-changed Reload): the image's size, the dialog's extent.
export function importConfig(values, mapSize, currentMap) {
  return createMapConfig({ ...values, sourceWidth: mapSize.width, sourceHeight: mapSize.height, radiusKm: currentMap.radiusKm });
}

// Map Settings: the current pixel size, the dialog's extent.
export function settingsConfig(values, currentMap) {
  return createMapConfig({
    ...values, sourceWidth: currentMap.sourceWidth, sourceHeight: currentMap.sourceHeight, radiusKm: currentMap.radiusKm,
  });
}

// Sim grid size: the configured width, height from the source aspect ratio.
export function simGridSize(cfg) {
  return {
    width: cfg.simWidth,
    height: Math.max(1, Math.round((cfg.simWidth * cfg.sourceHeight) / cfg.sourceWidth)),
  };
}

// Latitude span that would make source pixels square in degrees, for the
// New Map dialog hint (e.g. 5632×2048 at 360° → 130.9°, i.e. ±65.45°).
export function squarePixelLatSpan(sourceWidth, sourceHeight, lonSpan) {
  return (lonSpan * sourceHeight) / sourceWidth;
}
