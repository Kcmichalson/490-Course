// Owns the map canvas. Each map mode renders once into an offscreen canvas
// at source resolution (the base layer); every frame just blits it with the
// view transform (one blit per visible wrapped copy), then draws overlays in
// screen space. Pan and zoom never re-render the base layer.

import { visibleCopies } from './viewport.js';
import { simCellBounds, sourceToSimCell } from '../sim/coords.js';
import { drawGraticule } from './graticule.js';

const OVERLAY_DRAWERS = {
  graticule: drawGraticule,
};

// Shared placeholder until a mode's milestone provides a renderer.
const OCEAN = '#1d4b75';

function drawOceanPlaceholder(g, w, h) {
  g.fillStyle = OCEAN;
  g.fillRect(0, 0, w, h);
}

export class MapView {
  constructor(canvas, { onResize } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.onResize = onResize;
    this.base = null;
    this.baseKey = '';
    this.cssWidth = 0;
    this.cssHeight = 0;
    this.dpr = 1;
    this.background = getComputedStyle(canvas).getPropertyValue('--map-bg').trim() || '#14171c';
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

  // Rebuilds the base layer only when the map or the mode's renderer changes.
  ensureBase(map, mode) {
    const renderer = mode.drawBase ? mode.id : 'placeholder';
    const key = `${map.sourceWidth}x${map.sourceHeight}|${renderer}`;
    if (key === this.baseKey) return;
    const c = document.createElement('canvas');
    c.width = map.sourceWidth;
    c.height = map.sourceHeight;
    const g = c.getContext('2d', { alpha: false });
    (mode.drawBase ?? drawOceanPlaceholder)(g, map.sourceWidth, map.sourceHeight);
    this.base = c;
    this.baseKey = key;
  }

  draw({ map, view, mode, overlays, selected }) {
    const { ctx, dpr, cssWidth: viewW, cssHeight: viewH } = this;
    this.ensureBase(map, mode);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = this.background;
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
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!map.wraps) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(view.offsetX - 0.5, view.offsetY - 0.5, mapW + 1, mapH + 1);
    }

    const env = { map, view, viewW, viewH, dpr };
    for (const [id, drawOverlay] of Object.entries(OVERLAY_DRAWERS)) {
      if (overlays[id]) drawOverlay(ctx, env);
    }
    if (selected) this.drawSelection(env, selected);
  }

  // Outline of the selected sim cell, at least 10 px so it stays visible.
  drawSelection({ map, view, viewW }, selected) {
    const cell = sourceToSimCell(map, selected.x, selected.y);
    if (!cell) return;
    const b = simCellBounds(map, cell.i, cell.j);
    const { ctx } = this;
    const mapW = map.sourceWidth * view.scale;
    let w = (b.x1 - b.x0) * view.scale;
    let h = (b.y1 - b.y0) * view.scale;
    for (const k of visibleCopies(view, map.sourceWidth, viewW, map.wraps)) {
      let x = view.offsetX + k * mapW + b.x0 * view.scale;
      let y = view.offsetY + b.y0 * view.scale;
      if (w < 10) { x -= (10 - w) / 2; w = 10; }
      if (h < 10) { y -= (10 - h) / 2; h = 10; }
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.strokeRect(x, y, w, h);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#ffd34d';
      ctx.strokeRect(x, y, w, h);
    }
  }
}
