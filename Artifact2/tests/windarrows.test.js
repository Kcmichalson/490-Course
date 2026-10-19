import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arrowStride, screenDirection, wrapCol, streamline, sampleWind } from '../src/render/windarrows.js';
import { runClimate } from '../src/sim/pipeline.js';
import { createPlanet } from '../src/sim/planet.js';
import { createMapConfig, simGridSize } from '../src/sim/mapconfig.js';

test('arrow stride: smallest power of two with at least 36 px spacing', () => {
  // 5632×2048 at 1024 wide: a cell is 5.5 source px.
  assert.equal(arrowStride(5.5 * 0.227), 32, 'fit at ~1280 px');
  assert.equal(arrowStride(5.5 * 1), 8, '100%');
  assert.equal(arrowStride(5.5 * 8), 1, '800%');
  assert.equal(arrowStride(36), 1);
  assert.equal(arrowStride(35.9), 2);
});

test('screen direction: v is flipped for screen y; east is +x', () => {
  const n = screenDirection(0, 1, 0, 1, 1);
  assert.ok(Math.abs(n.dx) < 1e-12 && n.dy < 0, 'northward wind points up the screen');
  const e = screenDirection(1, 0, 0, 1, 1);
  assert.ok(e.dx > 0 && Math.abs(e.dy) < 1e-12);
  const sw = screenDirection(-1, -1, 0, 1, 1);
  assert.ok(sw.dx < 0 && sw.dy > 0, 'SW-bound wind points down-left');
  // Projection: the same NE-bound wind looks flatter at 60° (east-west distances shrink).
  const eq = screenDirection(1, 1, 0, 1, 1);
  const hi = screenDirection(1, 1, 60, 1, 1);
  assert.ok(Math.abs(hi.dy / hi.dx) < Math.abs(eq.dy / eq.dx));
  for (const d of [n, e, sw, eq, hi]) assert.ok(Math.abs(Math.hypot(d.dx, d.dy) - 1) < 1e-12, 'unit length');
});

test('wrapped column indices', () => {
  assert.equal(wrapCol(-1, 1024, true), 1023);
  assert.equal(wrapCol(1024, 1024, true), 0);
  assert.equal(wrapCol(-1, 1024, false), 0);
  assert.equal(wrapCol(1030, 1024, false), 1023);
});

test('streamline steps have the same screen length at 0° and at 80° (direction changes, length does not)', () => {
  const map = createMapConfig({ sourceWidth: 5632, sourceHeight: 2048 });
  const grid = { ...simGridSize(map), latTop: map.latTop, latBottom: map.latBottom };
  const climate = { grid, result: runClimate({ grid, planet: createPlanet(), season: { day: 80 } }) };
  const scale = 0.5;
  const yOf = (lat) => ((map.latTop - lat) / 180) * map.sourceHeight;
  for (const lat of [0.5, 15, 45, 80]) {
    const pts = streamline(climate, map, 1000, yOf(lat), 30, scale);
    for (let k = 1; k < pts.length; k++) {
      const step = Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y) * scale;
      assert.ok(Math.abs(step - 7.5) < 1e-6, `${lat}°: step ${step}`);
    }
  }
  // Sampling wraps across the date line.
  const w = sampleWind(climate, map, map.sourceWidth - 0.1, yOf(15));
  assert.ok(Number.isFinite(w.u) && w.u < 0);
});
