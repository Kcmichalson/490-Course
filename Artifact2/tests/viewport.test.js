import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sourceToScreen, screenToSource, fitView, scaleLimits, zoomAt, centerOn,
  clampView, visibleCopies, wheelZoomFactor, MAX_SCALE,
} from '../src/render/viewport.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `expected ${b}, got ${a}`);

test('screenToSource inverts sourceToScreen', () => {
  const view = { scale: 0.37, offsetX: -120.5, offsetY: 33 };
  for (const [x, y] of [[0, 0], [5632, 2048], [1234.5, 99.25]]) {
    const s = sourceToScreen(view, x, y);
    const back = screenToSource(view, s.x, s.y);
    close(back.x, x);
    close(back.y, y);
  }
});

test('fitView centers the whole map', () => {
  const v = fitView(5632, 2048, 1600, 900);
  const tl = sourceToScreen(v, 0, 0);
  const br = sourceToScreen(v, 5632, 2048);
  assert.ok(tl.x >= 0 && tl.y >= 0 && br.x <= 1600 && br.y <= 900);
  close((tl.x + br.x) / 2, 800);
  close((tl.y + br.y) / 2, 450);
});

test('zoomAt keeps the point under the cursor fixed and respects limits', () => {
  const limits = scaleLimits(5632, 2048, 1600, 900);
  const v0 = fitView(5632, 2048, 1600, 900);
  const cursor = [431, 287];
  const before = screenToSource(v0, ...cursor);
  const v1 = zoomAt(v0, 3.7, ...cursor, limits);
  const after = screenToSource(v1, ...cursor);
  close(after.x, before.x, 1e-6);
  close(after.y, before.y, 1e-6);

  assert.equal(zoomAt(v0, 1e6, 0, 0, limits).scale, MAX_SCALE);
  close(zoomAt(v0, 1e-6, 0, 0, limits).scale, limits.min);
});

test('centerOn puts a source point at the viewport center', () => {
  const v = centerOn({ scale: 2, offsetX: 0, offsetY: 0 }, 100, 50, 800, 600);
  const s = sourceToScreen(v, 100, 50);
  close(s.x, 400);
  close(s.y, 300);
});

test('clampView: wrap normalizes offsetX, vertical stays on screen', () => {
  const map = { width: 1000, height: 500, wraps: true };
  const v = clampView({ scale: 1, offsetX: 2350, offsetY: -9999 }, map, 800, 600);
  assert.ok(v.offsetX >= -1000 && v.offsetX < 0);
  close(((v.offsetX - 2350) % 1000 + 1000) % 1000, 0); // same picture, shifted whole copies
  // Map shorter than the viewport stays fully inside it.
  assert.ok(v.offsetY >= 0 && v.offsetY + 500 <= 600);

  const tall = clampView({ scale: 4, offsetX: 50, offsetY: 50 }, { width: 1000, height: 500, wraps: false }, 800, 600);
  assert.equal(tall.offsetY, 0, 'no empty space above a map taller than the viewport');
  assert.equal(tall.offsetX, 0, 'no empty space left of a non-wrapping map');
});

test('visibleCopies covers the viewport', () => {
  assert.deepEqual(visibleCopies({ scale: 1, offsetX: -300, offsetY: 0 }, 1000, 800, false), [0]);
  assert.deepEqual(visibleCopies({ scale: 1, offsetX: -100, offsetY: 0 }, 1000, 800, true), [0]);
  assert.deepEqual(visibleCopies({ scale: 1, offsetX: -300, offsetY: 0 }, 1000, 800, true), [0, 1]);
  assert.deepEqual(visibleCopies({ scale: 1, offsetX: -900, offsetY: 0 }, 1000, 800, true), [0, 1]);
  assert.deepEqual(visibleCopies({ scale: 0.3, offsetX: -100, offsetY: 0 }, 1000, 800, true), [0, 1, 2]);
});

test('wheelZoomFactor: scroll down zooms out, up zooms in, deltas clamped', () => {
  assert.ok(wheelZoomFactor(100) < 1);
  assert.ok(wheelZoomFactor(-100) > 1);
  close(wheelZoomFactor(3, 1), wheelZoomFactor(48, 0));
  close(wheelZoomFactor(10000), wheelZoomFactor(300));
  assert.ok(wheelZoomFactor(-5, 0, true) > wheelZoomFactor(-5, 0, false), 'pinch is more sensitive');
});
