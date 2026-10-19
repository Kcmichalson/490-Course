// Slope, ruggedness, hillshade, and the signed coast distance (SPEC 13.3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMapConfig } from '../src/sim/mapconfig.js';
import { spacingM, gradientAt, slopeDegrees, ruggednessAt, slopeClass } from '../src/sim/slope.js';
import { signedCoastDistanceKm } from '../src/sim/distance.js';
import { shadeValue } from '../src/render/hillshade.js';
import { makeTerrain, CATEGORY } from '../src/sim/terrain.js';

const R = 6371;
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ''} ${a} vs ${b}`);

// 360 × 180 map: 1° per pixel.
const cfg = createMapConfig({ sourceWidth: 360, sourceHeight: 180, simWidth: 360 });
const spacing = spacingM(cfg, R);
const W = 360, H = 180;
const terrainOf = (fn, cat = null) => {
  const e = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) e[y * W + x] = fn(x, y);
  return makeTerrain(W, H, e, cat ?? new Uint8Array(W * H).fill(CATEGORY.LAND));
};

test('flat ground has zero slope; a known ramp gives atan(rise / run) over km spacing', () => {
  assert.equal(slopeDegrees(terrainOf(() => 500), spacing, true, 100, 90), 0);
  // Rising 1,000 m per pixel northward (row 0 is north, so elevation falls with y).
  const ramp = terrainOf((x, y) => -1000 * y);
  const run = spacing.dyM;
  near(slopeDegrees(ramp, spacing, true, 100, 90), (Math.atan(1000 / run) * 180) / Math.PI, 1e-9, 'north ramp');
  assert.ok(gradientAt(ramp, spacing, true, 100, 90).north > 0, 'rises toward the north');
});

test('east-west spacing shrinks with latitude, so the same step is steeper near the poles', () => {
  const eastRamp = terrainOf((x) => 100 * x);
  const atEquator = slopeDegrees(eastRamp, spacing, false, 100, 90);
  const at60 = slopeDegrees(eastRamp, spacing, false, 100, 30); // row 30 ≈ 59.5°N
  near(Math.tan((at60 * Math.PI) / 180) / Math.tan((atEquator * Math.PI) / 180), Math.cos((0.5 * Math.PI) / 180) / Math.cos((59.5 * Math.PI) / 180), 1e-6);
});

test('wraps at the date line; open maps use one-sided differences', () => {
  const t = terrainOf((x) => (x === 0 ? 1000 : 0));
  assert.ok(Math.abs(gradientAt(t, spacing, true, 359, 90).east) > 0, 'column 359 sees column 0 across the seam');
  assert.equal(gradientAt(t, spacing, false, 358, 90).east, 0, 'no wrap: far from column 0');
});

test('lakes are flat and do not tilt their neighbors', () => {
  const cat = new Uint8Array(W * H).fill(CATEGORY.LAND);
  cat[90 * W + 101] = CATEGORY.LAKE;
  const t = terrainOf((x, y) => (x === 101 && y === 90 ? 3000 : 200), cat);
  assert.equal(slopeDegrees(t, spacing, true, 101, 90), 0);
  assert.equal(slopeDegrees(t, spacing, true, 100, 90), 0);
});

test('TRI: mean absolute difference to the 8 neighbors', () => {
  const t = terrainOf((x, y) => (x === 50 && y === 50 ? 80 : 0));
  assert.equal(ruggednessAt(t, true, 50, 50), 80);
  near(ruggednessAt(t, true, 51, 50), 80 / 8, 1e-9);
  assert.equal(ruggednessAt(terrainOf(() => 300), true, 0, 0), 0);
});

test('slope classes: < 0.5°, 0.5–2°, 2–5°, 5–10°, > 10°', () => {
  assert.deepEqual([0, 0.49, 0.5, 1.9, 2, 4.9, 5, 9.9, 10, 45].map(slopeClass), [0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
});

test('hillshade: flat is mid-gray; slopes facing the northwest light are brighter than the southeast ones', () => {
  assert.equal(shadeValue(0, 0), 128);
  const facingNW = shadeValue(0.01, -0.01); // rises to the southeast, so it faces northwest
  const facingSE = shadeValue(-0.01, 0.01);
  assert.ok(facingNW > 128 && facingSE < 128, `${facingNW} / ${facingSE}`);
});

test('signed coast distance: positive inland, negative offshore; lakes count as land', () => {
  const small = createMapConfig({ sourceWidth: 40, sourceHeight: 20, latTop: 2, latBottom: -2, lonSpan: 8, wraps: false, simWidth: 40 });
  const cat = new Uint8Array(800).fill(CATEGORY.OCEAN);
  for (let y = 0; y < 20; y++) for (let x = 20; x < 40; x++) cat[y * 40 + x] = CATEGORY.LAND;
  cat[10 * 40 + 30] = CATEGORY.LAKE;
  const d = signedCoastDistanceKm(cat, small, R);
  assert.ok(d[10 * 40 + 35] > 0 && d[10 * 40 + 5] < 0);
  assert.ok(d[10 * 40 + 30] > 0, 'a lake reads as inland, not as a coast');
  assert.ok(d[10 * 40 + 35] > d[10 * 40 + 25], 'grows inland');
  assert.ok(d[10 * 40 + 5] < d[10 * 40 + 15], 'grows offshore');
});

test('coast distance: half-width wrap padding gives the same distances as full copies', async () => {
  const { distanceToFeatureKm } = await import('../src/sim/distance.js');
  const c = createMapConfig({ sourceWidth: 61, sourceHeight: 30, simWidth: 61 });
  let seed = 9;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let t = 0; t < 5; t++) {
    const f = new Uint8Array(61 * 30).map(() => (rand() < 0.02 ? 1 : 0));
    f[t * 7] = 1;
    const full = distanceToFeatureKm(f, c, R);
    const half = distanceToFeatureKm(f, c, R, { halfPad: true });
    for (let i = 0; i < f.length; i++) near(half[i], full[i], 1e-3, `pixel ${i}`);
  }
});
