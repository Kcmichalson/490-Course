// Color palette import (SPEC 2.5): satellite-style color maps, where each
// flat color stands for a category (ocean, shelf, land tiers, lakes, ice).
// Pure: colors in, swatches and per-pixel classes out.
//
// Colors are compared in CIE Lab with ΔE76 (Euclidean distance), which
// roughly matches how different two colors look. Each pixel takes the
// nearest swatch within the tolerance; anything farther is "unmatched".

import { PALETTE_MERGE_DE, PALETTE_MERGE_MAX_DE, PALETTE_MAX_SWATCHES, PALETTE_LAND_M, PALETTE_LAKE_M } from './constants.js';

// Swatch categories. `elevation` marks the ones that carry a height in
// meters (land tiers, land ice, lake surface).
export const PALETTE_CATEGORIES = Object.freeze([
  { id: 'ignore', label: 'Ignore' },
  { id: 'deep', label: 'Deep Ocean', water: true },
  { id: 'shallow', label: 'Shallow Sea / Shelf', water: true },
  { id: 'lake', label: 'Lake', water: true, elevation: true },
  { id: 'land', label: 'Land', land: true, elevation: true },
  { id: 'land-ice', label: 'Land Ice', land: true, elevation: true },
  { id: 'sea-ice', label: 'Sea Ice', water: true },
]);

export function paletteCategory(id) {
  return PALETTE_CATEGORIES.find((c) => c.id === id) ?? PALETTE_CATEGORIES[0];
}

export function defaultElevation(categoryId) {
  return categoryId === 'lake' ? PALETTE_LAKE_M : PALETTE_LAND_M;
}

// Import needs at least one land swatch and one water swatch (SPEC 2.5).
export function paletteReady(swatches) {
  const cats = swatches.map((s) => paletteCategory(s.category));
  return cats.some((c) => c.land) && cats.some((c) => c.water);
}

// Code for pixels whose color is farther than the tolerance from every swatch.
export const UNMATCHED = 254;

export function rgbToHex(r, g, b) {
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return null;
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

// sRGB (D65) → CIE Lab.
const lin = (c) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const D = 6 / 29;
const f = (t) => (t > D * D * D ? Math.cbrt(t) : t / (3 * D * D) + 4 / 29);

export function srgbToLab(r, g, b) {
  const R = lin(r), G = lin(g), B = lin(b);
  const x = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047;
  const y = 0.2126729 * R + 0.7151522 * G + 0.0721750 * B;
  const z = (0.0193339 * R + 0.1191920 * G + 0.9503041 * B) / 1.08883;
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function deltaE76(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

// The scan's merge distance, kept within the slider's range.
export function clampMergeDE(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(PALETTE_MERGE_MAX_DE, Math.max(0, n)) : PALETTE_MERGE_DE;
}

// The most common colors, as swatch suggestions sorted by pixel count.
// Colors within mergeDE of an earlier (more common) swatch are merged into
// it (a larger mergeDE folds noise and anti-aliasing into fewer swatches).
// Returns [{ hex, count, share }].
export function scanSwatches(rgba, { max = PALETTE_MAX_SWATCHES, mergeDE = PALETTE_MERGE_DE } = {}) {
  mergeDE = clampMergeDE(mergeDE);
  const counts = new Map();
  const n = rgba.length >> 2;
  for (let p = 0; p < rgba.length; p += 4) {
    const key = (rgba[p] << 16) | (rgba[p + 1] << 8) | rgba[p + 2];
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const colors = [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  const swatches = [];
  for (const [key, count] of colors) {
    const lab = srgbToLab((key >> 16) & 255, (key >> 8) & 255, key & 255);
    const near = swatches.find((s) => deltaE76(s.lab, lab) <= mergeDE);
    if (near) near.count += count;
    else if (swatches.length < max) swatches.push({ key, lab, count });
  }
  return swatches
    .sort((a, b) => b.count - a.count || a.key - b.key)
    .map((s) => ({ hex: rgbToHex((s.key >> 16) & 255, (s.key >> 8) & 255, s.key & 255), count: s.count, share: s.count / n }));
}

// Swatches for a new scan, keeping the work already done: a scanned color
// with the same hex as an earlier swatch keeps its category and elevation,
// and earlier assigned swatches the new scan has no close color for (e.g.
// eyedropper picks) are kept at the end.
export function rescanSwatches(scanned, previous, mergeDE = PALETTE_MERGE_DE) {
  const byHex = new Map(previous.map((s) => [s.hex, s]));
  const out = scanned.map((s) => {
    const old = byHex.get(s.hex);
    return old ? { ...old } : { hex: s.hex, category: 'ignore', elevation: defaultElevation('land') };
  });
  const labs = out.map((s) => srgbToLab(...hexToRgb(s.hex)));
  for (const s of previous) {
    if (s.category === 'ignore' || out.some((o) => o.hex === s.hex)) continue;
    const lab = srgbToLab(...hexToRgb(s.hex));
    if (!labs.some((l) => deltaE76(l, lab) <= clampMergeDE(mergeDE))) out.push({ ...s });
  }
  return out;
}

// classify(r, g, b) → index of the nearest swatch within the tolerance, or
// UNMATCHED. Results are memoized per color: a 16.7 M-entry table for big
// images (16 MB, one Lab conversion per distinct color even with JPEG
// noise), a Map for small ones (previews).
export function createClassifier(swatches, tolerance, { table = false } = {}) {
  const labs = swatches.map((s) => {
    const rgb = hexToRgb(s.hex);
    return rgb ? srgbToLab(...rgb) : [Infinity, 0, 0];
  });
  const direct = (r, g, b) => {
    const lab = srgbToLab(r, g, b);
    let best = UNMATCHED;
    let bestD = tolerance;
    for (let k = 0; k < labs.length; k++) {
      const d = deltaE76(lab, labs[k]);
      if (d <= bestD) { bestD = d; best = k; }
    }
    return best;
  };
  if (table) {
    const memo = new Uint8Array(1 << 24); // 0 = not computed, else code + 1
    return (r, g, b) => {
      const key = (r << 16) | (g << 8) | b;
      let v = memo[key];
      if (v === 0) { v = direct(r, g, b) + 1; memo[key] = v; }
      return v - 1;
    };
  }
  const memo = new Map();
  return (r, g, b) => {
    const key = (r << 16) | (g << 8) | b;
    let v = memo.get(key);
    if (v === undefined) { v = direct(r, g, b); memo.set(key, v); }
    return v;
  };
}

// Per-pixel swatch index (or UNMATCHED) for a whole image, plus counts.
export function classifyPixels(rgba, swatches, tolerance) {
  const n = rgba.length >> 2;
  const classify = createClassifier(swatches, tolerance, { table: n >= 1 << 20 });
  const index = new Uint8Array(n);
  let unmatched = 0;
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const k = classify(rgba[p], rgba[p + 1], rgba[p + 2]);
    index[i] = k;
    if (k === UNMATCHED) unmatched++;
  }
  return { index, unmatched };
}
