// Pointer and wheel input on the map canvas: zoom at the cursor, drag to pan
// (Navigate tool), Space+drag and middle-drag to pan in every tool, and a
// click (movement under 4 px) to inspect.

import { wheelZoomFactor } from '../render/viewport.js';
import { isTypingTarget } from './shortcuts.js';

const CLICK_SLOP_PX = 4;

// handlers: { getTool(), onPan(dx, dy), onZoom(factor, x, y),
//             onHover(point | null, dragging), onClick(x, y) }
export function attachNavigation(canvas, handlers) {
  let drag = null;
  let spaceHeld = false;

  const pos = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const updateCursor = () => {
    const panning = drag && drag.pan && drag.moved;
    canvas.classList.toggle('is-panning', Boolean(panning));
    canvas.style.cursor = panning ? '' : spaceHeld || handlers.getTool() === 'navigate' ? 'grab' : 'crosshair';
  };

  canvas.addEventListener('pointerdown', (e) => {
    if (drag) return;
    const navigate = handlers.getTool() === 'navigate';
    const pan = e.button === 1 || (e.button === 0 && (spaceHeld || navigate));
    const inspect = e.button === 0 && navigate && !spaceHeld;
    if (!pan && !inspect) return;
    e.preventDefault(); // no middle-click autoscroll, no text selection
    try { canvas.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
    const p = pos(e);
    drag = { id: e.pointerId, start: p, last: p, moved: false, pan, inspect };
  });

  canvas.addEventListener('pointermove', (e) => {
    const p = pos(e);
    if (drag && e.pointerId === drag.id) {
      if (!drag.moved && Math.hypot(p.x - drag.start.x, p.y - drag.start.y) > CLICK_SLOP_PX) {
        drag.moved = true;
        updateCursor();
      }
      if (drag.moved && drag.pan) handlers.onPan(p.x - drag.last.x, p.y - drag.last.y);
      drag.last = p;
    }
    handlers.onHover(p, Boolean(drag?.moved));
  });

  const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const wasClick = !drag.moved && drag.inspect && e.type === 'pointerup';
    drag = null;
    updateCursor();
    const p = pos(e);
    if (wasClick) handlers.onClick(p.x, p.y);
    handlers.onHover(p, false);
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('pointerleave', () => { if (!drag) handlers.onHover(null, false); });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const p = pos(e);
    handlers.onZoom(wheelZoomFactor(e.deltaY, e.deltaMode, e.ctrlKey), p.x, p.y);
  }, { passive: false });

  // Space held = temporary pan in any tool.
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || isTypingTarget(e.target) || document.querySelector('dialog[open]')) return;
    e.preventDefault();
    if (!spaceHeld) { spaceHeld = true; updateCursor(); }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code !== 'Space' || !spaceHeld) return;
    e.preventDefault();
    spaceHeld = false;
    updateCursor();
  });
  window.addEventListener('blur', () => { spaceHeld = false; updateCursor(); });

  updateCursor();
  return { updateCursor };
}
