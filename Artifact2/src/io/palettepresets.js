// Named palette presets (SPEC 2.5): kept in localStorage as `fcm:palettes`,
// and exported/imported as JSON files tagged "format": "fcm-palette".

import { load, save } from './storage.js';
import { PALETTE_CATEGORIES, hexToRgb, rgbToHex, defaultElevation } from '../sim/palette.js';
import { PALETTE_TOLERANCE_DE, PALETTE_SMOOTH_PX } from '../sim/constants.js';

const KEY = 'palettes';
export const PRESET_FORMAT = 'fcm-palette';
export const PRESET_VERSION = 1;

// A clean preset object, or throws an Error saying what's wrong.
export function normalizePreset(p) {
  if (!p || typeof p !== 'object') throw new Error('Not a palette preset.');
  if (p.format !== PRESET_FORMAT) throw new Error('Not a palette preset file (missing "format": "fcm-palette").');
  if (p.version !== PRESET_VERSION) throw new Error(`Unsupported palette preset version ${p.version}.`);
  const name = String(p.name ?? '').trim();
  if (!name) throw new Error('The preset has no name.');
  if (!Array.isArray(p.swatches) || !p.swatches.length) throw new Error('The preset has no swatches.');
  const ids = new Set(PALETTE_CATEGORIES.map((c) => c.id));
  const swatches = p.swatches.map((s, i) => {
    const rgb = hexToRgb(s?.hex);
    if (!rgb) throw new Error(`Swatch ${i + 1} has no valid color.`);
    if (!ids.has(s.category)) throw new Error(`Swatch ${i + 1} has an unknown category "${s.category}".`);
    const e = Number(s.elevation);
    return { hex: rgbToHex(...rgb), category: s.category, elevation: Number.isFinite(e) ? e : defaultElevation(s.category) };
  });
  const num = (v, fallback, min, max) => (Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Number(v))) : fallback);
  return {
    format: PRESET_FORMAT,
    version: PRESET_VERSION,
    name,
    tolerance: num(p.tolerance, PALETTE_TOLERANCE_DE, 1, 50),
    smoothing: num(p.smoothing, PALETTE_SMOOTH_PX, 0, 4),
    swatches,
  };
}

export function makePreset(name, { swatches, tolerance, smoothing }) {
  return normalizePreset({ format: PRESET_FORMAT, version: PRESET_VERSION, name, tolerance, smoothing, swatches });
}

// Saved presets, skipping any that no longer validate.
export function listPresets() {
  const raw = load(KEY, []);
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const p of raw) {
    try { out.push(normalizePreset(p)); } catch { /* skip a damaged entry */ }
  }
  return out;
}

// Saves (or replaces, by name) a preset. Returns false if storage failed.
export function savePreset(preset) {
  const p = normalizePreset(preset);
  return save(KEY, [...listPresets().filter((x) => x.name !== p.name), p]);
}

export function deletePreset(name) {
  return save(KEY, listPresets().filter((x) => x.name !== name));
}

export function presetToJson(preset) {
  return JSON.stringify(normalizePreset(preset), null, 2);
}

export function presetFromJson(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('The file is not valid JSON.');
  }
  return normalizePreset(data);
}
