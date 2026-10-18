import { test } from 'node:test';
import assert from 'node:assert/strict';
import { luminance, grayHistogram, detectLevels, grayToElevation } from '../src/sim/heightmap.js';

const grayRgba = (values) => {
  const out = new Uint8ClampedArray(values.length * 4);
  values.forEach((v, i) => { out.set([v, v, v, 255], i * 4); });
  return out;
};

test('luminance is exact for gray pixels', () => {
  assert.deepEqual([...luminance(grayRgba([0, 89, 203, 255]))], [0, 89, 203, 255]);
});

test('a large flat darkest region auto-sets sea level to darkest + 1', () => {
  const values = [...Array(60).fill(40), ...Array(40).fill(0).map((_, i) => 41 + i)];
  const lv = detectLevels(grayHistogram(Uint8Array.from(values)));
  assert.equal(lv.darkest, 40);
  assert.equal(lv.flatOcean, true);
  assert.equal(lv.seaLevel, 41);
  assert.equal(lv.highest, 80);
});

test('a gap between the ocean plateau and the lowest land: auto sea level skips empty grays', () => {
  // Paradox-style: flat ocean at 40, nothing from 41 to 93, land from 94 to 203.
  const values = [...Array(600).fill(40), ...Array.from({ length: 400 }, (_, i) => 94 + (i % 110))];
  const lv = detectLevels(grayHistogram(Uint8Array.from(values)));
  assert.equal(lv.flatOcean, true);
  assert.equal(lv.seaLevel, 94, 'first gray actually used above the ocean');
  const elev = grayToElevation(Uint8Array.from([94, 203]), { seaLevel: lv.seaLevel, highest: lv.highest, maxHeight: 5000, gamma: 1 });
  assert.ok(elev[0] > 0 && elev[0] <= 1, `lowest land reads ~0 m, got ${elev[0]}`);
  assert.equal(elev[1], 5000);
});

test('ocean with depth data (no flat region) leaves sea level for the user', () => {
  const values = Array.from({ length: 200 }, (_, i) => i);
  const lv = detectLevels(grayHistogram(Uint8Array.from(values)));
  assert.equal(lv.flatOcean, false);
  assert.equal(lv.seaLevel, null);
});

test('Paradox-style range: sea level → ~0 m, 203 → max height, curve keeps endpoints', () => {
  const gray = Uint8Array.from([89, 146, 203]);
  const lin = grayToElevation(gray, { seaLevel: 89, highest: 203, maxHeight: 5000, gamma: 1 });
  assert.ok(lin[0] > 0 && lin[0] <= 1, `sea-level value reads ~0 m, got ${lin[0]}`);
  assert.ok(Math.abs(lin[1] - 2500) < 25);
  assert.equal(lin[2], 5000);
  const curved = grayToElevation(gray, { seaLevel: 89, highest: 203, maxHeight: 5000, gamma: 2 });
  assert.equal(curved[2], 5000);
  assert.ok(curved[1] < lin[1], 'gamma > 1 lowers the midrange');
});

test('below sea level: linear to max depth, or NaN for generated depth', () => {
  const gray = Uint8Array.from([0, 50, 99, 100]);
  const lin = grayToElevation(gray, { seaLevel: 100, highest: 200, maxHeight: 5000, maxDepth: -6000, darkest: 0, depthMode: 'linear' });
  assert.equal(lin[0], -6000);
  assert.ok(Math.abs(lin[1] - -3000) < 1);
  assert.ok(lin[2] < 0 && lin[2] >= -61);
  assert.ok(lin[3] > 0);
  const gen = grayToElevation(gray, { seaLevel: 100, highest: 200, maxHeight: 5000, depthMode: 'generate' });
  assert.ok(Number.isNaN(gen[0]) && Number.isNaN(gen[2]));
  assert.ok(gen[3] > 0);
});
