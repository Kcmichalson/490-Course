// The category layer: isLand/isWater/isOcean, majority sim categories,
// region downsampling, and category-aware colors.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORY, makeTerrain, isLand, isWater, isOcean, landMask, categoryFromElevation, blankTerrain,
} from '../src/sim/terrain.js';
import { downsampleTerrain, downsampleRegion } from '../src/sim/downsample.js';
import { createMapConfig } from '../src/sim/mapconfig.js';
import { PHYSICAL_STOPS, ELEVATION_STOPS, CATEGORY_COLORS, buildLut, colorAt, terrainToRGBA } from '../src/render/colorramps.js';

const { OCEAN, LAND, LAKE, LAND_ICE, SEA_ICE } = CATEGORY;

test('isLand: land and land ice; lakes and sea ice are water; land below sea level stays land', () => {
  const cat = Uint8Array.from([OCEAN, LAND, LAKE, LAND_ICE, SEA_ICE, LAND]);
  const elev = Float32Array.from([-100, 50, 300, 900, -50, -50]);
  const t = makeTerrain(6, 1, elev, cat);
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((i) => isLand(t, i)), [false, true, false, true, false, true]);
  for (let i = 0; i < 6; i++) assert.equal(isWater(t, i), !isLand(t, i));
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((i) => isOcean(t, i)), [true, false, false, false, true, false]);
  assert.equal(isLand(t, 5), true, 'LAND at −50 m is a depression, not sea');
});

test('the elevation fallback applies only without a category layer', () => {
  const elev = Float32Array.from([-5, 5]);
  const bare = makeTerrain(2, 1, elev);
  assert.deepEqual([...landMask(bare)], [0, 1]);
  assert.equal(isOcean(bare, 0), true);
  const flipped = makeTerrain(2, 1, elev, Uint8Array.from([LAND, OCEAN]));
  assert.deepEqual([...landMask(flipped)], [1, 0], 'the category layer wins over elevation');
  assert.deepEqual([...categoryFromElevation(2, 1, elev)], [OCEAN, LAND]);
  const blank = blankTerrain(8, 4);
  assert.ok(blank.category.every((c) => c === OCEAN));
});

test('downsample: land cells take the majority land category, water cells the majority water category', () => {
  // 4 × 2 source → 2 × 1 grid.
  const cfg = { sourceWidth: 4, sourceHeight: 2, simWidth: 2 };
  const cat = Uint8Array.from([LAND_ICE, LAND_ICE, LAKE, LAKE, LAND, OCEAN, SEA_ICE, OCEAN]);
  const elev = Float32Array.from([900, 800, 200, 210, 100, -50, -20, -40]);
  const sim = downsampleTerrain(makeTerrain(4, 2, elev, cat), cfg);
  assert.equal(sim.landFraction[0], 0.75);
  assert.equal(sim.category[0], LAND_ICE, '2 land-ice pixels beat 1 land pixel');
  assert.equal(sim.landFraction[1], 0);
  assert.equal(sim.category[1], LAKE, '2 lake pixels beat 1 ocean and 1 sea-ice pixel');
  assert.equal(sim.meanOceanDepth[1], (200 + 210 - 20 - 40) / 4, 'lakes count as water');
});

test('region downsample after an edit matches a full downsample', () => {
  const cfg = createMapConfig({ sourceWidth: 200, sourceHeight: 100, simWidth: 200 });
  const W = 200;
  const H = 100;
  const elev = new Float32Array(W * H);
  for (let i = 0; i < elev.length; i++) elev[i] = Math.sin(i * 0.37) * 500;
  const t = makeTerrain(W, H, elev, categoryFromElevation(W, H, elev));
  const coarse = { ...cfg, simWidth: 200 };
  for (const sw of [200, 64, 37]) {
    const c = { ...coarse, simWidth: sw };
    const sim = downsampleTerrain(t, c);
    // Edit a rectangle: raise it to land, mark part of it as a lake.
    for (let y = 30; y < 47; y++) {
      for (let x = 120; x < 151; x++) {
        const i = y * W + x;
        t.elevation[i] += 800;
        t.category[i] = x < 130 ? LAKE : LAND;
      }
    }
    const cells = downsampleRegion(t, c, sim, { x0: 120, y0: 30, x1: 151, y1: 47 });
    assert.ok(cells.i1 > cells.i0 && cells.j1 > cells.j0);
    const full = downsampleTerrain(t, c);
    for (const k of ['landFraction', 'meanLandElev', 'maxElev', 'meanOceanDepth', 'category']) {
      assert.deepEqual([...sim[k]], [...full[k]], `${k} at sim width ${sw}`);
    }
  }
});

test('colors: land below sea level is green, lakes and ice use category colors', () => {
  const lut = buildLut(PHYSICAL_STOPS);
  const t = makeTerrain(4, 1, Float32Array.from([-50, -50, 400, -300]), Uint8Array.from([LAND, OCEAN, LAKE, SEA_ICE]));
  const rgba = terrainToRGBA(t, lut);
  assert.deepEqual([...rgba.slice(0, 3)], colorAt(lut, 0), 'depression draws as the lowest land');
  assert.deepEqual([...rgba.slice(4, 7)], colorAt(lut, -50), 'ocean at −50 m is still water');
  assert.deepEqual([...rgba.slice(8, 11)], CATEGORY_COLORS[LAKE]);
  assert.deepEqual([...rgba.slice(12, 15)], CATEGORY_COLORS[SEA_ICE]);
  const gray = buildLut(ELEVATION_STOPS);
  const plain = terrainToRGBA(t, gray, { x0: 2, y0: 0, x1: 4, y1: 1 }, { categoryColors: false });
  assert.equal(plain.length, 8, 'a rect returns only its own pixels');
  assert.deepEqual([...plain.slice(0, 3)], colorAt(gray, 400), 'Elevation mode follows elevation');
});
