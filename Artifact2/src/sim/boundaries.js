// Climate Boundaries (SPEC 13.4, M4): contour lines over land on the sim
// grid, from each cell's 12 monthly temperatures at its own elevation. Pure;
// the worker runs it with the temperature steps.
//   tree line       warmest month = 10 °C (trees need a 10 °C month; polar and alpine)
//   snowline        warmest month = 0 °C (above or beyond it snow never melts)
//   permafrost line mean annual = −2 °C (ground stays frozen below it)
// The predicted (sea-)ice edge needs SST and arrives in M7. Water cells are
// masked out, so lines stop at coasts. Lines follow the sim grid, so they
// don't exactly trace the full-resolution mode colors.

import { TREE_LINE_C, SNOWLINE_C, PERMAFROST_C } from './constants.js';
import { isLandCategory } from './terrain.js';
import { monthlyTables, rowLats, usesLandLag, surfaceOffset, swingTemp } from './temperature.js';
import { contourSegments } from './climatestats.js';

// → { treeLine, snowline, permafrost }: Float32Array segments [x0, y0, x1, y1, …]
//   in sim cell coordinates (cell centers at integers).
export function climateBoundaries(grid, tiltDeg, terrain, s) {
  const { width: W, height: H } = grid;
  const t = monthlyTables(rowLats(grid.latTop, grid.latBottom, H), tiltDeg);
  const warm = new Float32Array(W * H).fill(NaN);
  const mean = new Float32Array(W * H).fill(NaN);
  for (let j = 0; j < H; j++) {
    for (let i = 0, k = j * W; i < W; i++, k++) {
      const c = terrain.category[k];
      if (!isLandCategory(c)) continue;
      const lag = usesLandLag(c) ? t.land : t.ocean;
      const off = surfaceOffset(c, terrain.elevation[k]);
      let hi = -Infinity;
      let sum = 0;
      for (let m = 0; m < 12; m++) {
        const v = swingTemp(t.ann[j], lag[m][j], s[k], off);
        if (v > hi) hi = v;
        sum += v;
      }
      warm[k] = hi;
      mean[k] = sum / 12;
    }
  }
  const wraps = grid.wraps ?? true;
  return {
    treeLine: contourSegments(warm, W, H, TREE_LINE_C, wraps),
    snowline: contourSegments(warm, W, H, SNOWLINE_C, wraps),
    permafrost: contourSegments(mean, W, H, PERMAFROST_C, wraps),
  };
}
