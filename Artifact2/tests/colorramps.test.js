import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHYSICAL_STOPS, ELEVATION_STOPS, buildLut, elevationToRGBA, colorAt } from '../src/render/colorramps.js';

test('ramps hit their stop colors exactly', () => {
  const lut = buildLut(PHYSICAL_STOPS);
  for (const [e, c] of PHYSICAL_STOPS) assert.deepEqual(colorAt(lut, e), c, `stop ${e} m`);
});

test('coast reads as a clear jump from water to land', () => {
  const lut = buildLut(PHYSICAL_STOPS);
  const water = colorAt(lut, -1);
  const land = colorAt(lut, 1);
  assert.ok(water[2] > water[1] && land[1] > land[2], 'water is blue, land is green');
  const gray = buildLut(ELEVATION_STOPS);
  assert.ok(colorAt(gray, 0)[0] - colorAt(gray, -1)[0] >= 20);
});

test('elevationToRGBA: opaque, clamps out-of-range values, NaN as deepest', () => {
  const lut = buildLut(ELEVATION_STOPS);
  const out = elevationToRGBA(Float32Array.from([-20000, 0, 6000, 99999, NaN]), lut);
  assert.equal(out.length, 20);
  assert.deepEqual([...out.slice(0, 4)], [0, 0, 0, 255]);
  assert.deepEqual([...out.slice(8, 12)], [255, 255, 255, 255]);
  assert.deepEqual([...out.slice(12, 16)], [255, 255, 255, 255]);
  assert.deepEqual([...out.slice(16, 20)], [0, 0, 0, 255]);
});
