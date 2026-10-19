// Owns the map canvas. Each map mode renders once into an offscreen canvas
// at source resolution (the base layer); every frame just blits it with the
// view transform (one blit per visible wrapped copy), then draws overlays in
// screen space. Pan and zoom never re-render the base layer. Brush strokes
// re-render only their dirty rectangles (renderers marked `partial`).

import { visibleCopies } from './viewport.js';
import { simCellBounds, sourceToSimCell } from '../sim/coords.js';
import { drawGraticule } from './graticule.js';
import { readTheme } from './theme.js';
import { RENDERERS } from './modes/index.js';
import { drawHillshade, RELIEF_ALPHA } from './hillshade.js';
import { drawWindArrows } from './windarrows.js';
import { drawPressureItcz } from './pressure.js';

// Screen-space overlays, drawn in this order (lines under symbols).
const OVERLAY_DRAWERS = {
  graticule: drawGraticule,
  'pressure-itcz': drawPressureItcz,
  'wind-arrows': drawWindArrows,
};

// Shared placeholder until a mode's milestone provides a renderer.
function drawOceanPlaceholder(g, { map, theme }) {
  g.fillStyle = theme.placeholderOcean;
  g.fillRect(0, 0, map.sourceWidth, map.sourceHeight);
}

// Consecutive dabs overlap heavily, so one frame's dirty rects are drawn as
// their bounding box when that box is no bigger than the rects combined;
// otherwise (e.g. the two halves of a dab across the date line) separately.
export function mergeRects(rects) {
  if (rects.length < 2) return rects;
  const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  let sum = 0;
  for (const r of rects) {
    box.x0 = Math.min(box.x0, r.x0); box.y0 = Math.min(box.y0, r.y0);
    box.x1 = Math.max(box.x1, r.x1); box.y1 = Math.max(box.y1, r.y1);
    sum += (r.x1 - r.x0) * (r.y1 - r.y0);
  }
  return (box.x1 - box.x0) * (box.y1 - box.y0) <= sum ? [box] : rects;
}

export class MapView {
  constructor(canvas, { onResize } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.onResize = onResize;
    this.base = null;
    this.baseKey = '';
    this.relief = null; // Shaded Relief layer (grayscale hillshade)
    this.reliefKey = '';
    this.dirty = []; // source rects to re-render before the next blit
    this.cssWidth = 0;
    this.cssHeight = 0;
    this.dpr = 1;
    this.theme = readTheme();
    new ResizeObserver(() => this.measure()).observe(canvas.parentElement);
    this.measure();
  }

  measure() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    // Keep fractional CSS sizes so screen math matches pointer positions
    // (measured against the same unrounded rectangle).
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    if (w === this.cssWidth && h === this.cssHeight && dpr === this.dpr) return;
    this.cssWidth = w;
    this.cssHeight = h;
    this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.onResize?.(w, h);
  }

  // Marks a source rectangle { x0, y0, x1, y1 } as changed by a brush.
  invalidate(rect) {
    this.dirty.push(rect);
  }

  // Rebuilds the base layer only when the map, the terrain (version), the
  // mode's renderer, or the renderer's extra data (dataKey, e.g. a worker
  // result) changes; otherwise re-renders just the dirty rectangles.
  // The Shaded Relief layer follows the same rules when it is on.
  // store = { terrain, source, version, coast }.
  ensureBase(map, mode, store, reliefOn) {
    const draw = RENDERERS[mode.id] ?? drawOceanPlaceholder;
    const renderer = RENDERERS[mode.id] ? mode.id : 'placeholder';
    const key = `${map.sourceWidth}x${map.sourceHeight}|${renderer}|${store.version}|${draw.dataKey?.(store) ?? ''}`;
    if (store.terrain.width !== map.sourceWidth || store.terrain.height !== map.sourceHeight) return; // mid-update
    const args = { map, terrain: store.terrain, source: store.source, coast: store.coast, climate: store.climate, theme: this.theme };
    const dirty = mergeRects(this.dirty);
    this.dirty = [];
    this.base = this.layer(this.base, map);
    if (key === this.baseKey) {
      if (dirty.length && draw.partial) {
        const g = this.base.getContext('2d', { alpha: false });
        for (const rect of dirty) draw(g, { ...args, rect });
      }
    } else {
      draw(this.base.getContext('2d', { alpha: false }), args);
      this.baseKey = key;
    }

    // Shaded Relief: rebuilt when the map or terrain changes, else patched.
    if (!reliefOn) {
      if (dirty.length) this.reliefKey = ''; // edited while hidden: rebuild when shown
      return;
    }
    const reliefKey = `${map.sourceWidth}x${map.sourceHeight}|${store.version}`;
    this.relief = this.layer(this.relief, map);
    const rg = this.relief.getContext('2d', { alpha: false });
    if (reliefKey !== this.reliefKey) {
      drawHillshade(rg, args);
      this.reliefKey = reliefKey;
    } else {
      for (const rect of dirty) drawHillshade(rg, { ...args, rect });
    }
  }

  // A source-size offscreen canvas for map, reusing `canvas` if it fits.
  layer(canvas, map) {
    if (canvas && canvas.width === map.sourceWidth && canvas.height === map.sourceHeight) return canvas;
    const c = document.createElement('canvas');
    c.width = map.sourceWidth;
    c.height = map.sourceHeight;
    if (canvas === this.base) this.baseKey = '';
    if (canvas === this.relief) this.reliefKey = '';
    return c;
  }

  // Re-reads the CSS color variables (for theme switching in M11).
  refreshTheme() {
    this.theme = readTheme();
    this.baseKey = '';
    this.reliefKey = '';
  }

  // reserved: screen rects (canvas CSS px) covered by on-map controls, which
  // overlay labels avoid.
  // brush: { x, y, radius } in source px (Sculpt tool cursor), or null.
  // planet: the planet settings (tropics/polar circles follow the tilt).
  draw({ map, view, mode, store, overlays, selected, reserved = [], brush = null, planet = null }) {
    const { ctx, dpr, theme, cssWidth: viewW, cssHeight: viewH } = this;
    const reliefOn = Boolean(overlays['shaded-relief']);
    this.ensureBase(map, mode, store, reliefOn);
    if (!this.base) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = theme.mapBg;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Crisp source pixels when zoomed in, smooth downscaling when zoomed out.
    ctx.imageSmoothingEnabled = view.scale < 1;
    ctx.imageSmoothingQuality = 'high';

    const mapW = map.sourceWidth * view.scale;
    const mapH = map.sourceHeight * view.scale;
    // Round copy edges in device pixels so adjacent copies meet without seams.
    const dy0 = Math.round(dpr * view.offsetY);
    const dy1 = Math.round(dpr * (view.offsetY + mapH));
    for (const k of visibleCopies(view, map.sourceWidth, viewW, map.wraps)) {
      const dx0 = Math.round(dpr * (view.offsetX + k * mapW));
      const dx1 = Math.round(dpr * (view.offsetX + (k + 1) * mapW));
      ctx.drawImage(this.base, 0, 0, map.sourceWidth, map.sourceHeight, dx0, dy0, dx1 - dx0, dy1 - dy0);
      if (reliefOn && this.relief) {
        ctx.globalCompositeOperation = 'overlay';
        ctx.globalAlpha = RELIEF_ALPHA;
        ctx.drawImage(this.relief, 0, 0, map.sourceWidth, map.sourceHeight, dx0, dy0, dx1 - dx0, dy1 - dy0);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
      }
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!map.wraps) {
      ctx.strokeStyle = theme.mapBorder;
      ctx.lineWidth = 1;
      ctx.strokeRect(view.offsetX - 0.5, view.offsetY - 0.5, mapW + 1, mapH + 1);
    }

    const renderer = RENDERERS[mode.id];
    const env = {
      map, view, viewW, viewH, dpr, theme, reserved, planet, climate: store.climate,
      labels: Boolean(overlays['wind-band-labels']),
      skipLines: Boolean(renderer?.drawScreen), // the mode already draws the belt lines
    };
    // A mode's own screen-space drawing (e.g. pressure belt lines), which
    // stays crisp at any zoom.
    if (renderer?.drawScreen) renderer.drawScreen(ctx, env);
    for (const [id, drawOverlay] of Object.entries(OVERLAY_DRAWERS)) {
      if (overlays[id]) drawOverlay(ctx, env);
    }
    if (selected) this.drawSelection(env, selected);
    if (brush) this.drawBrush(env, brush);
  }

  // The brush footprint, on every visible wrapped copy.
  drawBrush({ map, view, viewW, theme }, brush) {
    const { ctx } = this;
    const mapW = map.sourceWidth * view.scale;
    const r = Math.max(2, brush.radius * view.scale);
    const y = view.offsetY + brush.y * view.scale;
    for (const k of visibleCopies(view, map.sourceWidth, viewW, map.wraps)) {
      const x = view.offsetX + k * mapW + brush.x * view.scale;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.lineWidth = 3;
      ctx.strokeStyle = theme.brushHalo;
      ctx.stroke();
      ctx.lineWidth = 1.25;
      ctx.strokeStyle = theme.brushOutline;
      ctx.stroke();
    }
  }

  // Outline of the selected sim cell, at least 10 px so it stays visible.
  drawSelection({ map, view, viewW, theme }, selected) {
    const cell = sourceToSimCell(map, selected.x, selected.y);
    if (!cell) return;
    const b = simCellBounds(map, cell.i, cell.j);
    const { ctx } = this;
    const mapW = map.sourceWidth * view.scale;
    const cellW = (b.x1 - b.x0) * view.scale;
    const cellH = (b.y1 - b.y0) * view.scale;
    const w = Math.max(10, cellW);
    const h = Math.max(10, cellH);
    const y = view.offsetY + b.y0 * view.scale - (h - cellH) / 2;
    for (const k of visibleCopies(view, map.sourceWidth, viewW, map.wraps)) {
      const x = view.offsetX + k * mapW + b.x0 * view.scale - (w - cellW) / 2;
      ctx.lineWidth = 3;
      ctx.strokeStyle = theme.selectionHalo;
      ctx.strokeRect(x, y, w, h);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = theme.selection;
      ctx.strokeRect(x, y, w, h);
    }
  }
}
