// Grayscale heightmap import (SPEC 2.4): gray value → meters.
// Pure functions on RGBA / gray byte arrays.

import { FLAT_OCEAN_FRACTION, MIN_LAND_M, MIN_OCEAN_M } from './constants.js';

// Perceived brightness (Rec. 709 weights); exact for gray images (R = G = B).
export function luminance(rgba) {
  const n = rgba.length >> 2;
  const gray = new Uint8Array(n);
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    gray[i] = Math.round(0.2126 * rgba[p] + 0.7152 * rgba[p + 1] + 0.0722 * rgba[p + 2]);
  }
  return gray;
}

export function grayHistogram(gray) {
  const hist = new Uint32Array(256);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
  return hist;
}

// Auto-detected levels. Sea level is only auto-set when a large flat region
// sits at the darkest value (an ocean with no depth data); otherwise it is
// null and the user sets it. The auto sea level is the first gray actually
// used above the ocean plateau, skipping empty levels, so maps with a gap
// between ocean and lowest land (e.g. Paradox heightmaps) put the lowest
// land at ~0 m instead of lifting every coast.
export function detectLevels(hist) {
  let total = 0;
  for (let v = 0; v < 256; v++) total += hist[v];
  let darkest = 0;
  while (darkest < 255 && hist[darkest] === 0) darkest++;
  let highest = 255;
  while (highest > 0 && hist[highest] === 0) highest--;
  const flatOcean = total > 0 && hist[darkest] / total >= FLAT_OCEAN_FRACTION && darkest < highest;
  let firstLand = darkest + 1;
  while (firstLand < highest && hist[firstLand] === 0) firstLand++;
  return { darkest, highest, flatOcean, seaLevel: flatOcean ? firstLand : null };
}

// settings: { seaLevel, highest, maxHeight, gamma, depthMode: 'linear' | 'generate',
//             maxDepth, darkest }
// Land (gray ≥ sea level) runs from ~0 m at the sea-level value to maxHeight
// at `highest`, shaped by the curve (gamma). Below sea level, depths are
// either mapped linearly down to maxDepth at the darkest value, or left as
// NaN for generated bathymetry to fill in.
export function grayToElevation(gray, settings) {
  const { seaLevel, highest, maxHeight, gamma = 1, depthMode = 'linear', maxDepth, darkest = 0 } = settings;
  const landSpan = Math.max(1, highest - seaLevel);
  const seaSpan = Math.max(1, seaLevel - darkest);
  const out = new Float32Array(gray.length);
  for (let i = 0; i < gray.length; i++) {
    const v = gray[i];
    if (v >= seaLevel) {
      const t = Math.min(1, (v - seaLevel) / landSpan);
      out[i] = Math.max(MIN_LAND_M, maxHeight * t ** gamma);
    } else if (depthMode === 'generate') {
      out[i] = NaN;
    } else {
      const t = Math.min(1, (seaLevel - v) / seaSpan);
      out[i] = Math.min(MIN_OCEAN_M, maxDepth * t);
    }
  }
  return out;
}
