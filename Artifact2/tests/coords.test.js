import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMapConfig } from '../src/sim/mapconfig.js';
import {
  normalizeLon, wrapX, pixelToLatLon, latLonToPixel, sourcePixel,
  sourceToSimCell, simCellBounds, simCellCenterLatLon, formatLatLon, parseLatLon,
} from '../src/sim/coords.js';

const close = (actual, expected, eps = 1e-9, msg) =>
  assert.ok(Math.abs(actual - expected) <= eps, msg ?? `expected ${expected}, got ${actual}`);

const earth = createMapConfig({ sourceWidth: 2048, sourceHeight: 1024 });
const paradox = createMapConfig({ sourceWidth: 5632, sourceHeight: 2048, latTop: 80, latBottom: -60 });
const partial = createMapConfig({ sourceWidth: 1000, sourceHeight: 500, lonWest: 170, lonSpan: 40, wraps: false });

test('top edge, bottom edge, and vertical center latitudes', () => {
  for (const cfg of [earth, paradox]) {
    close(pixelToLatLon(cfg, 10, 0).lat, cfg.latTop);
    close(pixelToLatLon(cfg, 10, cfg.sourceHeight).lat, cfg.latBottom);
    close(pixelToLatLon(cfg, 10, cfg.sourceHeight / 2).lat, (cfg.latTop + cfg.latBottom) / 2);
  }
  close(pixelToLatLon(paradox, 0, 1024).lat, 10);
  // Float error from screen math at the exact edges still counts as on-map.
  close(pixelToLatLon(earth, 10, 1024 + 1e-9).lat, -90);
  close(pixelToLatLon(partial, 1000 + 1e-9, 10).lon, -150);
});

test('row 0 center is half a row below the top edge (cell-registered)', () => {
  const rowHeightDeg = 180 / earth.sourceHeight;
  close(pixelToLatLon(earth, 0, 0.5).lat, 90 - rowHeightDeg / 2);
});

test('left edge and horizontal center longitudes', () => {
  close(pixelToLatLon(earth, 0, 10).lon, -180);
  close(pixelToLatLon(earth, 1024, 10).lon, 0);
  close(pixelToLatLon(partial, 0, 10).lon, 170);
  close(pixelToLatLon(partial, 500, 10).lon, -170); // 190° normalized
});

test('longitude wraps on wrapping maps', () => {
  assert.deepEqual(pixelToLatLon(earth, 2048 + 10, 100), pixelToLatLon(earth, 10, 100));
  const justWest = pixelToLatLon(earth, -1, 100).lon;
  assert.ok(justWest > 179.8 && justWest < 180, `got ${justWest}`);
  close(wrapX(earth, -1), 2047);
  close(wrapX(earth, 4096 + 3), 3);
});

test('off-map positions return null', () => {
  assert.equal(pixelToLatLon(partial, -1, 10), null);
  assert.equal(pixelToLatLon(partial, 1001, 10), null);
  assert.equal(pixelToLatLon(earth, 10, -0.001), null);
  assert.equal(pixelToLatLon(earth, 10, 1024.001), null);
  assert.equal(sourcePixel(earth, 10, -1), null);
  assert.equal(sourceToSimCell(partial, -5, 10), null);
});

test('normalizeLon edge cases', () => {
  close(normalizeLon(180), -180);
  close(normalizeLon(-180), -180);
  close(normalizeLon(540), -180);
  close(normalizeLon(-540), -180);
  close(normalizeLon(190), -170);
  close(normalizeLon(-190), 170);
  close(normalizeLon(45), 45);
});

test('latLonToPixel inverts pixelToLatLon', () => {
  for (const cfg of [earth, paradox, partial]) {
    for (const [x, y] of [[1, 1], [123.25, 77.5], [cfg.sourceWidth - 3, cfg.sourceHeight - 2], [cfg.sourceWidth / 2, cfg.sourceHeight / 3]]) {
      const ll = pixelToLatLon(cfg, x, y);
      const p = latLonToPixel(cfg, ll.lat, ll.lon);
      close(p.x, x, 1e-6, `x round trip ${x}`);
      close(p.y, y, 1e-6, `y round trip ${y}`);
    }
  }
  // Just west of a partial map comes back as negative x, not far east.
  assert.ok(latLonToPixel(partial, 0, 169).x < 0);
});

test('source pixel and sim cell lookups', () => {
  assert.deepEqual(sourcePixel(earth, 10.7, 20.2), { px: 10, py: 20 });
  assert.deepEqual(sourcePixel(earth, 2048, 1024), { px: 0, py: 1023 }); // x wraps, y clamps
  // 5632×2048 @1024 → 1024×372; separate x/y scales.
  assert.deepEqual(sourceToSimCell(paradox, 0, 0), { i: 0, j: 0 });
  assert.deepEqual(sourceToSimCell(paradox, 5631.9, 2048), { i: 1023, j: 371 });
  const b = simCellBounds(paradox, 1023, 371);
  close(b.x1, 5632);
  close(b.y1, 2048);
});

test('sim cell centers sit half a cell inside the edges', () => {
  const top = simCellCenterLatLon(earth, 0, 0);
  const rows = 512; // 1024 × 512 grid
  close(top.lat, 90 - 180 / rows / 2);
  const bottom = simCellCenterLatLon(earth, 0, rows - 1);
  close(bottom.lat, -top.lat);
  close(top.lon, -180 + 360 / 1024 / 2);
});

test('formatLatLon', () => {
  assert.equal(formatLatLon({ lat: 12.345, lon: -56.789 }), '12.35°N 56.79°W');
  assert.equal(formatLatLon({ lat: -0.001, lon: 0.001 }), '0.00° 0.00°');
  assert.equal(formatLatLon({ lat: -45, lon: -180 }), '45.00°S 180.00°');
  assert.equal(formatLatLon({ lat: 90, lon: 30 }, 1), '90.0°N 30.0°E');
});

test('parseLatLon accepts common formats', () => {
  assert.deepEqual(parseLatLon('45N 30W'), { lat: 45, lon: -30 });
  assert.deepEqual(parseLatLon('45.5°N, 30.25°E'), { lat: 45.5, lon: 30.25 });
  assert.deepEqual(parseLatLon('30W 45N'), { lat: 45, lon: -30 });
  assert.deepEqual(parseLatLon('12s 100e'), { lat: -12, lon: 100 });
  assert.deepEqual(parseLatLon('45, -30'), { lat: 45, lon: -30 });
  assert.deepEqual(parseLatLon('-12.5 100'), { lat: -12.5, lon: 100 });
  assert.deepEqual(parseLatLon('  10 ; 190 '), { lat: 10, lon: -170 });
});

test('parseLatLon rejects garbage and out-of-range values', () => {
  for (const bad of ['', 'hello', '45', '45 30 10', '45N 30N', '30E 40W', '-45N 30W', '95 10', '45 400', '45x 30', null]) {
    assert.equal(parseLatLon(bad), null, `should reject ${JSON.stringify(bad)}`);
  }
});
