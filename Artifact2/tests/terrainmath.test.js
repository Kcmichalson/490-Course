// Distance, noise, blur, bathymetry, relief, and downsampling.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMapConfig } from '../src/sim/mapconfig.js';
import { distanceToFeatureKm } from '../src/sim/distance.js';
import { sphereNoise, noiseField } from '../src/sim/noise.js';
import { boxBlur } from '../src/sim/blur.js';
import { profileDepth, fillBathymetry } from '../src/sim/bathymetry.js';
import { fillRelief } from '../src/sim/relief.js';
import { downsampleTerrain } from '../src/sim/downsample.js';
import { makeTerrain, CATEGORY } from '../src/sim/terrain.js';
import { SHELF_DEPTH_M, SHELF_WIDTH_KM, ABYSS_DEPTH_M, FLAT_LAND_M } from '../src/sim/constants.js';

const R = 6371;
const kmPerDeg = (Math.PI / 180) * R;

test('distance: a straight coast gives distances that grow linearly', () => {
  // 360 × 4 equatorial strip (lat ±2°), 1° per pixel; land in column 0.
  const cfg = createMapConfig({ sourceWidth: 360, sourceHeight: 16, latTop: 2, latBottom: -2, wraps: false, simWidth: 360 });
  const f = new Uint8Array(360 * 16);
  for (let y = 0; y < 16; y++) f[y * 360] = 1;
  const d = distanceToFeatureKm(f, cfg, R);
  const row = 8 * 360;
  const cos = Math.cos((0.125 * Math.PI) / 180);
  for (const x of [1, 10, 100]) assert.ok(Math.abs(d[row + x] - x * kmPerDeg * cos) < 1, `x=${x}`);
  assert.equal(d[row], 0);
});

test('distance wraps across the date line on wrapping maps', () => {
  const base = { sourceWidth: 360, sourceHeight: 16, latTop: 2, latBottom: -2, simWidth: 360 };
  const f = new Uint8Array(360 * 16);
  for (let y = 0; y < 16; y++) f[y * 360] = 1;
  const wrapped = distanceToFeatureKm(f, createMapConfig({ ...base, wraps: true }), R);
  const open = distanceToFeatureKm(f, createMapConfig({ ...base, lonSpan: 359, wraps: false }), R);
  const row = 8 * 360;
  assert.ok(wrapped[row + 359] < 1.5 * kmPerDeg, 'last column is one pixel from the first');
  assert.ok(open[row + 359] > 300 * kmPerDeg * 0.99);
});

test('distance: east-west km shrink toward the poles; no features → Infinity', () => {
  const cfg = createMapConfig({ sourceWidth: 360, sourceHeight: 180, wraps: true, simWidth: 360 });
  const f = new Uint8Array(360 * 180);
  for (let y = 0; y < 180; y++) f[y * 360] = 1;
  const d = distanceToFeatureKm(f, cfg, R);
  const eq = d[90 * 360 + 10];
  const high = d[10 * 360 + 10];
  assert.ok(high < eq * 0.25, 'at ~80° latitude, 10° of longitude is much shorter');
  const none = distanceToFeatureKm(new Uint8Array(360 * 180), cfg, R);
  assert.equal(none[5000], Infinity);
});

test('noise: deterministic, seed-dependent, seamless at the date line, in range', () => {
  assert.equal(sphereNoise(10, 20, 5), sphereNoise(10, 20, 5));
  assert.notEqual(sphereNoise(10, 20, 5), sphereNoise(10, 20, 6));
  assert.ok(Math.abs(sphereNoise(33, -180, 3) - sphereNoise(33, 180, 3)) < 1e-9);
  for (let i = 0; i < 200; i++) {
    const v = sphereNoise(i * 0.9 - 90, i * 1.7, 1, 3);
    assert.ok(v >= -1 && v <= 1);
  }
  const cfg = createMapConfig({ sourceWidth: 1024, sourceHeight: 512, simWidth: 1024 });
  const field = noiseField(cfg, 2, 2, 4, 4);
  for (const [x, y] of [[6, 5], [500, 200], [1023, 511]]) {
    const direct = sphereNoise(90 - ((y + 0.5) / 512) * 180, -180 + ((x + 0.5) / 1024) * 360, 2, 2, 4);
    assert.ok(Math.abs(field[y * 1024 + x] - direct) < 0.03, `interpolated field tracks direct samples at ${x},${y}`);
  }
});

test('blur: constant in = constant out; values wrap across columns', () => {
  const flat = boxBlur(new Float32Array(50).fill(7), 10, 5, 2, true);
  assert.ok(flat.every((v) => Math.abs(v - 7) < 1e-5));
  const spike = new Float32Array(10 * 3);
  spike[10 + 0] = 9; // row 1, column 0
  const out = boxBlur(spike, 10, 3, 1, true, 1);
  assert.ok(out[10 + 9] > 0, 'spike at column 0 spreads to column 9 when wrapping');
  const open = boxBlur(spike, 10, 3, 1, false, 1);
  assert.equal(open[10 + 9], 0);
});

test('bathymetry profile: shelf to −200 m, then down to the abyss', () => {
  assert.equal(profileDepth(0), 0); // strict: +0, not −0
  assert.ok(Object.is(profileDepth(0), 0));
  assert.equal(profileDepth(SHELF_WIDTH_KM), SHELF_DEPTH_M);
  assert.equal(profileDepth(5000), ABYSS_DEPTH_M);
  assert.equal(profileDepth(Infinity), ABYSS_DEPTH_M);
  let prev = 1;
  for (let d = 0; d <= 600; d += 25) { assert.ok(profileDepth(d) <= prev); prev = profileDepth(d); }
});

test('bathymetry and relief only touch their own pixels; ocean stays below 0, land above', () => {
  const cfg = createMapConfig({ sourceWidth: 64, sourceHeight: 32, simWidth: 64 });
  const n = 64 * 32;
  const mask = new Uint8Array(n);
  for (let i = 0; i < n; i++) mask[i] = i % 64 < 20 ? 1 : 0;
  const water = mask.map((v) => 1 - v);
  const dist = new Float32Array(n).fill(150);
  const elev = new Float32Array(n);
  fillRelief(elev, mask, dist, cfg, { autoRelief: true, seed: 3 });
  for (let i = 0; i < n; i++) if (!mask[i]) assert.equal(elev[i], 0);
  fillBathymetry(elev, water, dist, cfg, 3);
  for (let i = 0; i < n; i++) assert.ok(mask[i] ? elev[i] > 0 : elev[i] < 0, `pixel ${i}`);
  const flat = new Float32Array(n);
  fillRelief(flat, mask, dist, cfg, { autoRelief: false });
  assert.equal(flat[0], FLAT_LAND_M);
});

test('downsample: land fraction, mean elevations, majority category', () => {
  // 4 × 2 source → 2 × 1 grid: left cell 3/4 land, right cell 1/4 land.
  const cfg = { sourceWidth: 4, sourceHeight: 2, simWidth: 2 }; // below the UI's minimum size, so a plain object
  const e = Float32Array.from([100, 300, -50, -50, 200, -100, 400, -150]);
  const sim = downsampleTerrain(makeTerrain(4, 2, e), cfg);
  assert.equal(sim.width, 2);
  assert.equal(sim.height, 1);
  assert.equal(sim.landFraction[0], 0.75);
  assert.equal(sim.meanLandElev[0], 200);
  assert.equal(sim.meanOceanDepth[0], -100);
  assert.equal(sim.maxElev[0], 300);
  assert.equal(sim.category[0], CATEGORY.LAND);
  assert.equal(sim.landFraction[1], 0.25);
  assert.equal(sim.category[1], CATEGORY.OCEAN);
});

test('downsample: rounded sim height still maps every row (no rows lost near the poles)', () => {
  const cfg = createMapConfig({ sourceWidth: 1000, sourceHeight: 371, simWidth: 512 });
  const e = new Float32Array(1000 * 371).fill(-1);
  for (let x = 0; x < 1000; x++) { e[x] = 10; e[370 * 1000 + x] = 10; } // land on the top and bottom rows
  const sim = downsampleTerrain(makeTerrain(1000, 371, e), cfg);
  const last = (sim.height - 1) * sim.width;
  assert.ok(sim.landFraction[0] > 0 && sim.landFraction[last] > 0);
});
