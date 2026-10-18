// Full-resolution terrain → simulation grid (SPEC 2.8). Each sim cell
// stores land fraction, mean land elevation, max elevation, mean ocean
// depth, and its category (land if more than half the cell is land).
// Separate x and y scales, because the sim height is rounded.

import { simGridSize } from './mapconfig.js';
import { CATEGORY, landMask } from './terrain.js';

export function downsampleTerrain(terrain, cfg) {
  const { width: sw, height: sh } = simGridSize(cfg);
  const w = terrain.width;
  const h = terrain.height;
  const n = sw * sh;
  const count = new Uint32Array(n);
  const landCount = new Uint32Array(n);
  const landSum = new Float64Array(n);
  const oceanSum = new Float64Array(n);
  const maxElev = new Float32Array(n).fill(-Infinity);
  const land = landMask(terrain);
  const elev = terrain.elevation;

  // Each source pixel goes to the cell containing its center.
  const colCell = new Int32Array(w);
  for (let x = 0; x < w; x++) colCell[x] = Math.min(sw - 1, Math.floor(((x + 0.5) * sw) / w));
  for (let y = 0; y < h; y++) {
    const rowCell = Math.min(sh - 1, Math.floor(((y + 0.5) * sh) / h)) * sw;
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const c = rowCell + colCell[x];
      const e = elev[i];
      count[c]++;
      if (e > maxElev[c]) maxElev[c] = e;
      if (land[i]) { landCount[c]++; landSum[c] += e; } else oceanSum[c] += e;
    }
  }

  const landFraction = new Float32Array(n);
  const meanLandElev = new Float32Array(n);
  const meanOceanDepth = new Float32Array(n);
  const category = new Uint8Array(n);
  for (let c = 0; c < n; c++) {
    const total = count[c];
    const lc = landCount[c];
    landFraction[c] = total ? lc / total : 0;
    meanLandElev[c] = lc ? landSum[c] / lc : 0;
    meanOceanDepth[c] = total - lc ? oceanSum[c] / (total - lc) : 0;
    category[c] = landFraction[c] > 0.5 ? CATEGORY.LAND : CATEGORY.OCEAN;
    if (!total) maxElev[c] = 0;
  }
  return { width: sw, height: sh, landFraction, meanLandElev, maxElev, meanOceanDepth, category };
}
