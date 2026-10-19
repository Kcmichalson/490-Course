// Silhouette import (SPEC 2.3): land/ocean only. Also guesses what kind of
// image was imported, so the import dialog can pre-select the type.

import { luminance } from './heightmap.js';
import { COLORFUL_SPREAD, COLORFUL_SHARE } from './constants.js';

export function hasTransparency(rgba) {
  for (let p = 3; p < rgba.length; p += 4) if (rgba[p] < 255) return true;
  return false;
}

// Transparent images use alpha (opaque = land); others use a brightness
// threshold (bright = land).
export function detectSilhouetteMode(rgba) {
  return hasTransparency(rgba) ? 'alpha' : 'threshold';
}

// 1 = land, 0 = ocean.
export function silhouetteMask(rgba, { mode = 'threshold', threshold = 128, invert = false } = {}) {
  const n = rgba.length >> 2;
  const mask = new Uint8Array(n);
  if (mode === 'alpha') {
    for (let i = 0; i < n; i++) mask[i] = (rgba[i * 4 + 3] >= threshold) !== invert ? 1 : 0;
  } else {
    const gray = luminance(rgba);
    for (let i = 0; i < n; i++) mask[i] = (gray[i] >= threshold) !== invert ? 1 : 0;
  }
  return mask;
}

// Guess the import type. Gray means R, G, B within a small tolerance (JPEG
// adds speckle). A gray image with nearly all pixels on its two most common
// tones (downscaling softens edges into in-between grays), or any
// transparency, reads as a silhouette; color images (without transparency)
// read as palette maps; other gray images read as heightmaps.
export function guessImageKind(rgba, tolerance = COLORFUL_SPREAD) {
  return guessFromStats(imageStats(rgba, tolerance));
}

// The pixel statistics the guess is made from (also recorded for the test
// maps, so the guess rules can be checked against real browser decodes).
export function imageStats(rgba, tolerance = COLORFUL_SPREAD) {
  const counts = new Uint32Array(256);
  let colorful = 0;
  const n = rgba.length >> 2;
  for (let p = 0; p < rgba.length; p += 4) {
    const r = rgba[p], g = rgba[p + 1], b = rgba[p + 2];
    if (Math.max(r, g, b) - Math.min(r, g, b) > tolerance) colorful++;
    else counts[Math.round((r + g + b) / 3)]++;
  }
  let levelCount = 0;
  let first = 0, second = 0;
  for (let v = 0; v < 256; v++) {
    const c = counts[v];
    if (c) levelCount++;
    if (c > first) { second = first; first = c; } else if (c > second) second = c;
  }
  return {
    transparent: hasTransparency(rgba),
    levelCount,
    twoToneShare: n ? (first + second) / n : 0,
    colorfulShare: n ? colorful / n : 0,
  };
}

export function guessFromStats({ transparent, levelCount, twoToneShare, colorfulShare }) {
  const isColor = colorfulShare > COLORFUL_SHARE;
  let kind = 'heightmap';
  if (transparent || (!isColor && twoToneShare >= 0.97)) kind = 'silhouette';
  else if (isColor) kind = 'palette';
  return { kind, isColor, transparent, levelCount, twoToneShare, colorfulShare };
}

// The import dialog's note for a guess. Built from the same fields that chose
// `kind`, so the note and the pre-selected type can never disagree.
export function describeGuess(guess) {
  if (guess.transparent) return 'Has transparency: looks like a silhouette.';
  if (guess.kind === 'silhouette') {
    const pct = Math.floor(guess.twoToneShare * 100);
    return `Mostly two tones (${pct}% of pixels): looks like a silhouette.`;
  }
  if (guess.kind === 'palette') {
    const pct = Math.max(1, Math.round(guess.colorfulShare * 100));
    return `Color image (${pct}% colorful pixels): looks like a color palette map.`;
  }
  return `${guess.levelCount} gray levels: looks like a heightmap.`;
}
