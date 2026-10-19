// Pressure belts and the ITCZ in screen space (SPEC 4.3, 13.4, M3).
//
// drawBeltLines: the belt latitudes as lines (lows solid, highs dashed, the
//   ITCZ in its own color), named at the left. Used by the Wind Speed &
//   Pressure mode.
// drawPressureItcz: the Pressure & ITCZ toggle over any mode: H/L symbols
//   along the belts and the ITCZ line (Annual Mean: plus dashed lines at its
//   yearly extremes). With the mode showing, it skips the lines the mode
//   already draws (skipLines), so nothing is drawn twice.

import { visibleCopies } from './viewport.js';

const SYMBOL_EVERY_PX = 260;
const LABEL_LEFT_PX = 60;

const yOfLat = (map, view, lat) => view.offsetY + ((map.latTop - lat) / (map.latTop - map.latBottom)) * map.sourceHeight * view.scale;

// Horizontal extent of the map on screen.
function span(map, view, viewW) {
  const mapW = map.sourceWidth * view.scale;
  return map.wraps ? [0, viewW] : [Math.max(0, view.offsetX), Math.min(viewW, view.offsetX + mapW)];
}

const onMap = (map, lat) => lat < map.latTop && lat > map.latBottom;

function hline(ctx, x0, x1, y, { color, width, dash = [] }) {
  ctx.setLineDash(dash);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x1, y);
  ctx.stroke();
}

function haloText(ctx, theme, text, x, y, color) {
  ctx.lineWidth = 3;
  ctx.strokeStyle = theme.labelHalo;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

const beltStyle = (theme, b) => (b.j === 0
  ? { color: theme.itczLine, width: 2 }
  : b.kind === 'low' ? { color: theme.pressureLow, width: 1.5 } : { color: theme.pressureHigh, width: 1.5, dash: [6, 4] });

// env: { map, view, viewW, theme, climate: { result } }
export function drawBeltLines(ctx, { map, view, viewW, theme, climate }) {
  const meta = climate?.result?.meta;
  if (!meta) return;
  const [x0, x1] = span(map, view, viewW);
  if (x1 <= x0) return;
  ctx.save();
  ctx.font = '11px system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.textBaseline = 'bottom';
  for (const b of meta.belts) {
    if (!onMap(map, b.lat)) continue;
    const y = yOfLat(map, view, b.lat);
    const style = beltStyle(theme, b);
    ctx.setLineDash([]);
    hline(ctx, x0, x1, y, { ...style, color: theme.labelHalo, width: style.width + 2 });
    hline(ctx, x0, x1, y, style);
    ctx.setLineDash([]);
    haloText(ctx, theme, b.name, x0 + LABEL_LEFT_PX, y - 3, style.color);
  }
  ctx.restore();
}

// env: { map, view, viewW, theme, climate: { result }, skipLines }
export function drawPressureItcz(ctx, { map, view, viewW, theme, climate, skipLines = false }) {
  const meta = climate?.result?.meta;
  if (!meta) return;
  const [x0, x1] = span(map, view, viewW);
  if (x1 <= x0) return;
  ctx.save();

  // The ITCZ line (the mode draws the solid one itself).
  const itcz = meta.belts.find((b) => b.j === 0);
  if (!skipLines && itcz && onMap(map, itcz.lat)) {
    const y = yOfLat(map, view, itcz.lat);
    hline(ctx, x0, x1, y, { color: theme.labelHalo, width: 4 });
    hline(ctx, x0, x1, y, { color: theme.itczLine, width: 2 });
  }
  if (meta.annual && meta.itczRange) {
    for (const lat of [meta.itczRange.north, meta.itczRange.south]) {
      if (!onMap(map, lat) || Math.abs(lat - (itcz?.lat ?? 0)) < 0.05) continue;
      hline(ctx, x0, x1, yOfLat(map, view, lat), { color: theme.itczLine, width: 1.25, dash: [3, 5] });
    }
  }
  ctx.setLineDash([]);
  if (itcz && onMap(map, itcz.lat)) {
    ctx.font = '600 11px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.textBaseline = 'top';
    if (!skipLines) haloText(ctx, theme, 'ITCZ', x0 + LABEL_LEFT_PX, yOfLat(map, view, itcz.lat) + 3, theme.itczLine);
  }

  // H / L symbols along each belt; polar highs sit just inside the map edge.
  ctx.font = 'bold 15px system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const mapW = map.sourceWidth * view.scale;
  for (const b of meta.belts) {
    let y;
    if (onMap(map, b.lat)) y = yOfLat(map, view, b.lat);
    else if (Math.abs(b.lat) >= 90 && (b.lat > 0 ? map.latTop : map.latBottom) === b.lat) y = yOfLat(map, view, b.lat) + Math.sign(b.lat) * 12;
    else continue;
    const letter = b.kind === 'high' ? 'H' : 'L';
    const color = b.kind === 'high' ? theme.pressureHigh : theme.pressureLow;
    // Anchor to the map so symbols don't swim while panning.
    const copies = map.wraps ? visibleCopies(view, map.sourceWidth, viewW, true) : [0];
    for (const k of copies) {
      const copyX = view.offsetX + k * mapW;
      const n = Math.max(1, Math.round(mapW / SYMBOL_EVERY_PX));
      for (let s = 0; s < n; s++) {
        const x = copyX + ((s + 0.5) / n) * mapW + (b.j % 2) * (mapW / n / 2);
        if (x < x0 - 10 || x > x1 + 10) continue;
        haloText(ctx, theme, letter, x, y, color);
      }
    }
  }
  ctx.restore();
}
