import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMapConfig } from '../src/sim/mapconfig.js';
import { buildTerrain } from '../src/sim/importpipeline.js';
import { landMask } from '../src/sim/terrain.js';

const W = 96;
const H = 48;
const cfg = createMapConfig({ sourceWidth: W, sourceHeight: H, simWidth: W });

// White disc of land on black ocean.
function discRgba(cx = 48, cy = 24, r = 12, land = 255, ocean = 0) {
  const out = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = (x - cx) ** 2 + (y - cy) ** 2 <= r * r ? land : ocean;
    out.set([v, v, v, 255], (y * W + x) * 4);
  }
  return out;
}

const silhouette = { mode: 'threshold', threshold: 128, invert: false, autoRelief: true, seed: 4 };

test('silhouette import: land matches the image; ocean gets generated depth', () => {
  const rgba = discRgba();
  const { terrain, sim } = buildTerrain({ kind: 'silhouette', rgba, settings: silhouette, cfg });
  const land = landMask(terrain);
  for (let i = 0; i < W * H; i++) assert.equal(land[i], rgba[i * 4] > 128 ? 1 : 0);
  assert.ok(terrain.elevation[0] < 0);
  assert.equal(sim.width, W);
});

test('same input and seed → identical terrain', () => {
  const a = buildTerrain({ kind: 'silhouette', rgba: discRgba(), settings: silhouette, cfg });
  const b = buildTerrain({ kind: 'silhouette', rgba: discRgba(), settings: silhouette, cfg });
  assert.deepEqual(a.terrain.elevation, b.terrain.elevation);
});

test('heightmap import with a flat ocean: auto sea level, generated depth', () => {
  // Ocean = 30 (flat), land = 160 with one peak pixel at 200 (a gap from 31 to 159).
  const rgba = discRgba(48, 24, 12, 160, 30);
  rgba.set([200, 200, 200, 255], (24 * W + 48) * 4);
  const { terrain, info } = buildTerrain({
    kind: 'heightmap', rgba, cfg,
    settings: { seaLevel: 'auto', highest: 'auto', maxHeight: 5000, gamma: 1, depthMode: 'auto', maxDepth: -6000, smoothing: 0 },
  });
  assert.equal(info.resolved.seaLevel, 160, 'lowest land gray, not darkest + 1');
  assert.equal(info.resolved.depthMode, 'generate');
  assert.equal(terrain.elevation[24 * W + 48], 5000);
  assert.ok(terrain.elevation[24 * W + 40] <= 1, 'ordinary land at the lowest land gray reads ~0 m');
  assert.ok(terrain.elevation[0] < -1000, 'far from land the generated ocean is deep');
});

test('heightmap without a flat ocean needs a sea level', () => {
  const rgba = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) { const v = i % 200; rgba.set([v, v, v, 255], i * 4); }
  assert.throws(() => buildTerrain({ kind: 'heightmap', rgba, cfg, settings: { seaLevel: 'auto', highest: 'auto', maxHeight: 5000, depthMode: 'auto', maxDepth: -6000 } }), /sea level/);
});

test('the mask wins over the heightmap, and smoothing never moves the coast', () => {
  const rgba = discRgba(48, 24, 12, 200, 30);        // heightmap disc r = 12
  const maskRgba = discRgba(48, 24, 16, 255, 0);    // mask disc r = 16 (wider)
  const { terrain } = buildTerrain({
    kind: 'heightmap', rgba, maskRgba, cfg,
    settings: { seaLevel: 31, highest: 200, maxHeight: 5000, gamma: 1, depthMode: 'generate', maxDepth: -6000, smoothing: 2, mask: { mode: 'threshold', threshold: 128 } },
  });
  const land = landMask(terrain);
  for (let i = 0; i < W * H; i++) assert.equal(land[i], maskRgba[i * 4] > 128 ? 1 : 0, `pixel ${i}`);
  // Ring between r = 12 and r = 16 was ocean in the heightmap but land in the mask → small positive.
  assert.ok(terrain.elevation[24 * W + 48 + 14] > 0);
});
