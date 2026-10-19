// Full-resolution terrain → simulation grid (SPEC 2.8). Each sim cell
// stores land fraction, mean land elevation, max elevation, mean ocean
// depth, and its category: land if more than half the cell is land, then
// the most common land category (land / land ice) or water category
// (ocean / lake / sea ice) among its pixels. Separate x and y scales,
// because the sim height is rounded.
//
// downsampleTerrain builds the whole grid; downsampleRegion rebuilds only the
// cells a source-pixel rectangle touches (brush strokes, undo), in place.
// Both share downsampleCells, so they agree exactly.

import { simGridSize } from './mapconfig.js';
import { CATEGORY, CATEGORY_COUNT, isLand, isLandCategory } from './terrain.js';

// Each source pixel goes to the cell containing its center. cellOf[x] is a
// pixel's cell; start[c] is the first pixel of cell c (start[cells] = n).
function axisCells(n, cells) {
  const cellOf = new Int32Array(n);
  const start = new Int32Array(cells + 1).fill(n);
  for (let x = 0; x < n; x++) cellOf[x] = Math.min(cells - 1, Math.floor(((x + 0.5) * cells) / n));
  for (let x = n - 1; x >= 0; x--) start[cellOf[x]] = x;
  for (let c = cells - 1; c >= 0; c--) if (start[c] > start[c + 1]) start[c] = start[c + 1];
  return { cellOf, start };
}

function emptySim(width, height) {
  const n = width * height;
  return {
    width,
    height,
    landFraction: new Float32Array(n),
    meanLandElev: new Float32Array(n),
    maxElev: new Float32Array(n),
    meanOceanDepth: new Float32Array(n),
    category: new Uint8Array(n),
  };
}

// Recomputes sim cells [i0, i1) × [j0, j1) from the terrain, in place.
function downsampleCells(terrain, sim, cols, rows, i0, i1, j0, j1) {
  const w = terrain.width;
  const elev = terrain.elevation;
  const cat = terrain.category;
  const span = i1 - i0;
  const count = new Uint32Array(span);
  const landCount = new Uint32Array(span);
  const landSum = new Float64Array(span);
  const oceanSum = new Float64Array(span);
  const maxElev = new Float32Array(span);
  const catCount = new Uint32Array(span * CATEGORY_COUNT);
  const x0 = cols.start[i0];
  const x1 = cols.start[i1];

  for (let j = j0; j < j1; j++) {
    count.fill(0); landCount.fill(0); landSum.fill(0); oceanSum.fill(0); catCount.fill(0);
    maxElev.fill(-Infinity);
    for (let y = rows.start[j]; y < rows.start[j + 1]; y++) {
      const row = y * w;
      for (let x = x0; x < x1; x++) {
        const i = row + x;
        const c = cols.cellOf[x] - i0;
        const e = elev[i];
        count[c]++;
        if (e > maxElev[c]) maxElev[c] = e;
        if (isLand(terrain, i)) { landCount[c]++; landSum[c] += e; } else oceanSum[c] += e;
        if (cat) catCount[c * CATEGORY_COUNT + cat[i]]++;
      }
    }
    for (let c = 0; c < span; c++) {
      const k = j * sim.width + i0 + c;
      const total = count[c];
      const lc = landCount[c];
      sim.landFraction[k] = total ? lc / total : 0;
      sim.meanLandElev[k] = lc ? landSum[c] / lc : 0;
      sim.meanOceanDepth[k] = total - lc ? oceanSum[c] / (total - lc) : 0;
      sim.maxElev[k] = total ? maxElev[c] : 0;
      const land = sim.landFraction[k] > 0.5;
      let best = land ? CATEGORY.LAND : CATEGORY.OCEAN;
      if (cat) {
        // Majority within the cell's side of the coast; ties go to the
        // lower id (LAND before LAND_ICE, OCEAN before LAKE and SEA_ICE).
        let bestCount = -1;
        for (let t = 0; t < CATEGORY_COUNT; t++) {
          if (isLandCategory(t) !== land) continue;
          const v = catCount[c * CATEGORY_COUNT + t];
          if (v > bestCount) { bestCount = v; best = t; }
        }
      }
      sim.category[k] = best;
    }
  }
}

export function downsampleTerrain(terrain, cfg) {
  const { width: sw, height: sh } = simGridSize(cfg);
  const sim = emptySim(sw, sh);
  const cols = axisCells(terrain.width, sw);
  const rows = axisCells(terrain.height, sh);
  downsampleCells(terrain, sim, cols, rows, 0, sw, 0, sh);
  return sim;
}

// Rebuilds, in place, every sim cell that a source rectangle
// { x0, y0, x1, y1 } (exclusive ends, within the map) touches.
// Returns the cell rectangle { i0, j0, i1, j1 } it rebuilt.
export function downsampleRegion(terrain, cfg, sim, rect) {
  const cols = axisCells(terrain.width, sim.width);
  const rows = axisCells(terrain.height, sim.height);
  const x0 = Math.max(0, Math.floor(rect.x0));
  const y0 = Math.max(0, Math.floor(rect.y0));
  const x1 = Math.min(terrain.width, Math.ceil(rect.x1));
  const y1 = Math.min(terrain.height, Math.ceil(rect.y1));
  if (x1 <= x0 || y1 <= y0) return null;
  const cells = {
    i0: cols.cellOf[x0], i1: cols.cellOf[x1 - 1] + 1,
    j0: rows.cellOf[y0], j1: rows.cellOf[y1 - 1] + 1,
  };
  downsampleCells(terrain, sim, cols, rows, cells.i0, cells.i1, cells.j0, cells.j1);
  return cells;
}

// A copy of a sim grid (so the immutable base grid can seed an editable one).
export function cloneSim(sim) {
  return {
    width: sim.width,
    height: sim.height,
    landFraction: sim.landFraction.slice(),
    meanLandElev: sim.meanLandElev.slice(),
    maxElev: sim.maxElev.slice(),
    meanOceanDepth: sim.meanOceanDepth.slice(),
    category: sim.category.slice(),
  };
}
