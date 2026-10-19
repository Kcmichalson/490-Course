// Climate Boundaries toggle (SPEC 13.4, M4): tree line, snowline, and
// permafrost line as screen-space lines (crisp at any zoom), from the
// contours the worker computes on the sim grid (src/sim/boundaries.js).
// The predicted ice edge needs SST and arrives in M7.

import { visibleCopies } from './viewport.js';

export const BOUNDARY_LINES = [
  { id: 'treeLine', label: 'Tree line (warmest month 10 °C)', color: 'boundaryTree', cssVar: '--boundary-tree', dash: [] },
  { id: 'snowline', label: 'Snowline (warmest month 0 °C)', color: 'boundarySnow', cssVar: '--boundary-snow', dash: [7, 4] },
  { id: 'permafrost', label: 'Permafrost line (mean annual −2 °C)', color: 'boundaryPermafrost', cssVar: '--boundary-permafrost', dash: [2, 3] },
];

// Paths in source pixels, built once per climate result.
let cache = { result: null, paths: null };

function pathsFor(climate, map) {
  if (cache.result === climate.result) return cache.paths;
  const sx = map.sourceWidth / climate.grid.width;
  const sy = map.sourceHeight / climate.grid.height;
  const paths = {};
  for (const line of BOUNDARY_LINES) {
    const seg = climate.result.boundaries?.[line.id];
    const p = new Path2D();
    if (seg) {
      for (let k = 0; k < seg.length; k += 4) {
        // Cell centers sit at (i + 0.5) cells in source pixels.
        p.moveTo((seg[k] + 0.5) * sx, (seg[k + 1] + 0.5) * sy);
        p.lineTo((seg[k + 2] + 0.5) * sx, (seg[k + 3] + 0.5) * sy);
      }
    }
    paths[line.id] = p;
  }
  cache = { result: climate.result, paths };
  return paths;
}

// env: { map, view, viewW, dpr, theme, climate }
export function drawClimateBoundaries(ctx, { map, view, viewW, dpr, theme, climate }) {
  if (!climate?.result?.boundaries || !climate.grid) return;
  const paths = pathsFor(climate, map);
  const s = view.scale;
  const mapW = map.sourceWidth * s;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const k of visibleCopies(view, map.sourceWidth, viewW, map.wraps)) {
    // Source px → CSS px for this copy; line widths and dashes stay in CSS px.
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * (view.offsetX + k * mapW), dpr * view.offsetY);
    for (const line of BOUNDARY_LINES) {
      ctx.setLineDash([]);
      ctx.strokeStyle = theme.boundaryHalo;
      ctx.lineWidth = 3.5 / s;
      ctx.stroke(paths[line.id]);
      ctx.setLineDash(line.dash.map((d) => d / s));
      ctx.strokeStyle = theme[line.color];
      ctx.lineWidth = 1.6 / s;
      ctx.stroke(paths[line.id]);
    }
  }
  ctx.restore();
}
