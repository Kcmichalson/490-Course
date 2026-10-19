// Palette import (SPEC 2.5): Lab/ΔE76, swatch scan, classification, the
// nearest-pixel fill, coast-keeping smoothing, and the palette pipeline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  srgbToLab, deltaE76, scanSwatches, createClassifier, classifyPixels, paletteReady, rgbToHex, hexToRgb, UNMATCHED,
  clampMergeDE, rescanSwatches,
} from '../src/sim/palette.js';
import { nearestFeatureIndex } from '../src/sim/distance.js';
import { boxBlur, smoothKeepingCoast } from '../src/sim/blur.js';
import { buildTerrain } from '../src/sim/importpipeline.js';
import { createMapConfig } from '../src/sim/mapconfig.js';
import { CATEGORY, isLand } from '../src/sim/terrain.js';
import { SHALLOW_SEA_M, DEEP_OCEAN_MAX_M, MIN_LAND_M, MIN_OCEAN_M, PALETTE_MERGE_DE, PALETTE_MERGE_MAX_DE } from '../src/sim/constants.js';

const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ''} ${a} vs ${b}`);

test('sRGB → Lab reference values', () => {
  const white = srgbToLab(255, 255, 255);
  near(white[0], 100, 0.01, 'white L');
  near(white[1], 0, 0.01, 'white a');
  near(white[2], 0, 0.01, 'white b');
  assert.deepEqual(srgbToLab(0, 0, 0).map((v) => Math.round(v * 100) / 100), [0, 0, 0]);
  const red = srgbToLab(255, 0, 0);
  near(red[0], 53.24, 0.02, 'red L');
  near(red[1], 80.09, 0.02, 'red a');
  near(red[2], 67.20, 0.02, 'red b');
  near(deltaE76([50, 0, 0], [53, 4, 0]), 5, 1e-9, 'ΔE76 is Euclidean');
});

test('hex helpers round-trip', () => {
  assert.equal(rgbToHex(31, 78, 121), '#1f4e79');
  assert.deepEqual(hexToRgb('#1F4E79'), [31, 78, 121]);
  assert.equal(hexToRgb('nope'), null);
});

const img = (pixels) => Uint8ClampedArray.from(pixels.flatMap(([r, g, b]) => [r, g, b, 255]));

test('scan: most common colors first, near-duplicates merged', () => {
  const pixels = [
    ...Array(50).fill([31, 78, 121]),
    ...Array(30).fill([91, 140, 58]),
    ...Array(5).fill([92, 140, 58]), // ΔE < 1 from the green: merged into it
    ...Array(10).fill([250, 250, 250]),
  ];
  const sw = scanSwatches(img(pixels));
  assert.deepEqual(sw.map((s) => s.hex), ['#1f4e79', '#5b8c3a', '#fafafa']);
  assert.equal(sw[1].count, 35);
  near(sw[0].share, 50 / 95, 1e-9);
  assert.equal(scanSwatches(img(pixels), { max: 2 }).length, 2);
});

test('classify: nearest swatch within the tolerance, else unmatched; the memo agrees', () => {
  const swatches = [{ hex: '#1f4e79' }, { hex: '#5b8c3a' }];
  const direct = createClassifier(swatches, 12);
  const table = createClassifier(swatches, 12, { table: true });
  assert.equal(direct(31, 78, 121), 0);
  assert.equal(direct(95, 143, 60), 1, 'slightly off green still matches');
  assert.equal(direct(255, 0, 255), UNMATCHED);
  for (const c of [[31, 78, 121], [95, 143, 60], [255, 0, 255], [60, 110, 90], [0, 0, 0]]) {
    assert.equal(table(...c), direct(...c), `table vs direct for ${c}`);
    assert.equal(table(...c), direct(...c), 'second (memoized) lookup');
  }
  const { index, unmatched } = classifyPixels(img([[31, 78, 121], [255, 0, 255], [91, 140, 58]]), swatches, 12);
  assert.deepEqual([...index], [0, UNMATCHED, 1]);
  assert.equal(unmatched, 1);
});

test('paletteReady needs one land swatch and one water swatch', () => {
  assert.equal(paletteReady([{ category: 'land' }]), false);
  assert.equal(paletteReady([{ category: 'deep' }, { category: 'ignore' }]), false);
  assert.equal(paletteReady([{ category: 'land-ice' }, { category: 'lake' }]), true);
  assert.equal(paletteReady([{ category: 'land' }, { category: 'sea-ice' }]), true);
});

// ---- nearestFeatureIndex ----

function bruteNearestKm(feature, cfg, R, i) {
  const { sourceWidth: w, sourceHeight: h } = cfg;
  const x = i % w, y = Math.floor(i / w);
  const dy = ((cfg.latTop - cfg.latBottom) / h) * (Math.PI / 180) * R;
  const lat = cfg.latTop - ((y + 0.5) / h) * (cfg.latTop - cfg.latBottom);
  const dx = (cfg.lonSpan / w) * (Math.PI / 180) * R * Math.cos((lat * Math.PI) / 180);
  let best = Infinity;
  for (let j = 0; j < w * h; j++) {
    if (!feature[j]) continue;
    let ddx = Math.abs((j % w) - x);
    if (cfg.wraps) ddx = Math.min(ddx, w - ddx);
    const ddy = Math.floor(j / w) - y;
    best = Math.min(best, Math.hypot(ddx * dx, ddy * dy));
  }
  return best;
}

test('nearestFeatureIndex matches brute force (latitude metric, wrap and no wrap)', () => {
  const R = 6371;
  let seed = 3;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (const wraps of [true, false]) {
    const cfg = createMapConfig({ sourceWidth: 40, sourceHeight: 20, latTop: 80, latBottom: -80, lonSpan: wraps ? 360 : 300, wraps, simWidth: 40 });
    for (let trial = 0; trial < 4; trial++) {
      const feature = new Uint8Array(800).map(() => (rand() < 0.04 ? 1 : 0));
      feature[trial * 37] = 1;
      const idx = nearestFeatureIndex(feature, cfg, R);
      for (let i = 0; i < 800; i++) {
        assert.equal(feature[idx[i]], 1, 'points at a feature');
        const w = 40, x = i % w, y = Math.floor(i / w);
        const lat = cfg.latTop - ((y + 0.5) / 20) * 160;
        const dx = (cfg.lonSpan / w) * (Math.PI / 180) * R * Math.cos((lat * Math.PI) / 180);
        const dyKm = (160 / 20) * (Math.PI / 180) * R;
        let ddx = Math.abs((idx[i] % w) - x);
        if (wraps) ddx = Math.min(ddx, w - ddx);
        const got = Math.hypot(ddx * dx, (Math.floor(idx[i] / w) - y) * dyKm);
        near(got, bruteNearestKm(feature, cfg, R, i), 1e-6, `pixel ${i} (wraps ${wraps})`);
      }
    }
  }
  const none = nearestFeatureIndex(new Uint8Array(800), createMapConfig({ sourceWidth: 40, sourceHeight: 20, simWidth: 40 }), R);
  assert.ok(none.every((v) => v === -1));
});

// ---- smoothKeepingCoast ----

test('heightmap smoothing reproduces the M2a code exactly', () => {
  // The M2a inline block, kept here as the reference.
  const w = 30, h = 20, n = w * h;
  const elev = new Float32Array(n);
  const land = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const x = i % w, y = Math.floor(i / w);
    land[i] = (x - 15) ** 2 + (y - 10) ** 2 < 49 ? 1 : 0;
    elev[i] = land[i] ? 100 + ((x * 37 + y * 11) % 400) : (x + y) % 5 === 0 ? NaN : -50 - x * 3;
  }
  const ref = Float32Array.from(elev);
  const pending = new Uint8Array(n);
  const filled = new Float32Array(n);
  for (let i = 0; i < n; i++) { pending[i] = Number.isNaN(ref[i]) ? 1 : 0; filled[i] = pending[i] ? 0 : ref[i]; }
  const blurred = boxBlur(filled, w, h, 2, true);
  for (let i = 0; i < n; i++) if (!pending[i]) ref[i] = land[i] ? Math.max(MIN_LAND_M, blurred[i]) : Math.min(MIN_OCEAN_M, blurred[i]);

  const got = Float32Array.from(elev);
  smoothKeepingCoast(got, w, h, 2, true, { land, skip: pending, skippedAsZero: true, minLand: MIN_LAND_M, maxWater: MIN_OCEAN_M });
  assert.deepEqual(got, ref);
});

test('palette smoothing: lakes untouched, coast kept, depressions not clamped', () => {
  const w = 20, h = 10, n = w * h;
  const elev = new Float32Array(n);
  const land = new Uint8Array(n);
  const skip = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const x = i % w;
    if (x < 6) { elev[i] = -100; } // water
    else if (x < 12) { land[i] = 1; elev[i] = 200; } // land tier
    else if (x < 15) { land[i] = 1; elev[i] = -30; } // land below sea level
    else { elev[i] = 50; skip[i] = 1; } // lake (surface 50 m)
  }
  const out = smoothKeepingCoast(Float32Array.from(elev), w, h, 2, false, { land, skip });
  for (let i = 0; i < n; i++) {
    const x = i % w;
    if (skip[i]) assert.equal(out[i], 50, 'lake surface unchanged');
    else if (!land[i]) assert.ok(out[i] <= -1, 'water stays below sea level');
    else if (elev[i] >= 1) assert.ok(out[i] >= 1, 'land above sea level stays above');
  }
  assert.ok(out[5 * w + 13] < 200 && out[5 * w + 13] > -30, 'the depression blends with its neighbors');
  assert.ok(out[5 * w + 14] < 50, 'the lake is left out of the land average');
});

// ---- Palette pipeline ----

const W = 80;
const H = 40;
const COL = { deep: [31, 78, 121], shelf: [79, 134, 184], low: [91, 140, 58], high: [181, 201, 106], lake: [63, 167, 214], cloud: [235, 235, 235], dip: [120, 100, 60] };
const SWATCHES = [
  { hex: rgbToHex(...COL.deep), category: 'deep' },
  { hex: rgbToHex(...COL.shelf), category: 'shallow' },
  { hex: rgbToHex(...COL.low), category: 'land', elevation: 200 },
  { hex: rgbToHex(...COL.high), category: 'land', elevation: 900 },
  { hex: rgbToHex(...COL.lake), category: 'lake', elevation: 0 },
  { hex: rgbToHex(...COL.cloud), category: 'ignore' },
  { hex: rgbToHex(...COL.dip), category: 'land', elevation: -30 },
];

// Ocean west of x = 30 (shelf from 26), land east of it; a high tier, a
// lake, a depression, a cloud straddling the coast, and one magenta
// (unmatched) pixel.
function paletteImage() {
  const out = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let c = x < 26 ? COL.deep : x < 30 ? COL.shelf : COL.low;
    if (x >= 50 && x < 60) c = COL.high;
    if ((x - 70) ** 2 + (y - 20) ** 2 < 16) c = COL.lake;
    if (x >= 40 && x < 44 && y >= 30 && y < 34) c = COL.dip;
    if (x >= 24 && x < 36 && y >= 10 && y < 18) c = COL.cloud; // cloud over the coast at x = 30
    out.set([...c, 255], (y * W + x) * 4);
  }
  out.set([255, 0, 255, 255], (2 * W + 45) * 4);
  return out;
}

const cfgOpen = createMapConfig({ sourceWidth: W, sourceHeight: H, lonSpan: 300, wraps: false, simWidth: W });
const settings = { swatches: SWATCHES, tolerance: 12, smoothing: 0, seed: 1 };

test('palette import: categories, elevations by category, cloud filled with the coast at the midline', () => {
  const { terrain, info } = buildTerrain({ kind: 'palette', rgba: paletteImage(), settings, cfg: cfgOpen });
  const at = (x, y) => y * W + x;
  // The cloud spans x 24..35 over a coast at x = 30: filled from the nearest
  // classified pixel, so the coast stays at x = 30 under it.
  for (let x = 24; x < 36; x++) assert.equal(isLand(terrain, at(x, 14)), x >= 30, `x=${x} under the cloud`);
  assert.equal(terrain.elevation[at(40, 5)], 200, 'low land tier');
  assert.equal(terrain.elevation[at(55, 5)], 900, 'high land tier');
  assert.equal(terrain.category[at(70, 20)], CATEGORY.LAKE);
  assert.equal(terrain.elevation[at(70, 20)], 0, 'lake keeps its surface');
  assert.equal(terrain.category[at(41, 31)], CATEGORY.LAND);
  assert.equal(terrain.elevation[at(41, 31)], -30, 'land below sea level stays land');
  assert.equal(terrain.elevation[at(28, 5)], SHALLOW_SEA_M, 'shelf');
  assert.ok(terrain.elevation[at(5, 5)] <= DEEP_OCEAN_MAX_M, 'deep ocean is off the shelf');
  assert.ok(isLand(terrain, at(45, 2)), 'the unmatched pixel takes its land neighbors');
  near(info.unmatchedFraction, 1 / (W * H), 1e-12);
  near(info.ignoredFraction, (12 * 8) / (W * H), 1e-12);
});

test('palette import with smoothing: tiers soften, the coast and lake stay put', () => {
  const plain = buildTerrain({ kind: 'palette', rgba: paletteImage(), settings, cfg: cfgOpen }).terrain;
  const smooth = buildTerrain({ kind: 'palette', rgba: paletteImage(), settings: { ...settings, smoothing: 2 }, cfg: cfgOpen }).terrain;
  for (let i = 0; i < W * H; i++) assert.equal(isLand(smooth, i), isLand(plain, i), `pixel ${i} kept its side of the coast`);
  const edge = 5 * W + 50; // first pixel of the high tier
  assert.ok(smooth.elevation[edge] > 200 && smooth.elevation[edge] < 900, 'the tier step is softened');
  assert.equal(smooth.elevation[20 * W + 70], 0, 'lake surface untouched');
});

test('palette fill wraps across the date line; same input → identical output', () => {
  const cfgWrap = createMapConfig({ sourceWidth: W, sourceHeight: H, simWidth: W });
  const rgba = paletteImage();
  // Column 0 becomes cloud; on a wrapping map its nearest neighbor may be
  // column 79 (land) or column 1 (deep): equally far, so check it's filled
  // from one of the two and not left unknown.
  for (let y = 0; y < H; y++) rgba.set([...COL.cloud, 255], (y * W) * 4);
  for (let y = 0; y < H; y++) rgba.set([...COL.cloud, 255], (y * W + 1) * 4);
  const a = buildTerrain({ kind: 'palette', rgba, settings, cfg: cfgWrap }).terrain;
  // Column 1's nearest classified pixel is column 2 (deep) at 1 px; column 0
  // is 1 px from column 79 (land) across the seam.
  assert.ok(isLand(a, 5 * W), 'column 0 filled from across the seam');
  assert.ok(!isLand(a, 5 * W + 1));
  const b = buildTerrain({ kind: 'palette', rgba, settings, cfg: cfgWrap }).terrain;
  assert.deepEqual(a.elevation, b.elevation);
  assert.deepEqual(a.category, b.category);
});

test('palette import refuses a palette without land and water swatches', () => {
  assert.throws(() => buildTerrain({
    kind: 'palette', rgba: paletteImage(), cfg: cfgOpen,
    settings: { swatches: SWATCHES.map((s) => ({ ...s, category: s.category === 'land' ? 'ignore' : s.category })), tolerance: 12 },
  }), /land swatch and one water swatch/);
});

test('scan merge ΔE: larger values fold noisy variants into one swatch; out-of-range values are clamped', () => {
  const pixels = [];
  for (let k = 0; k < 60; k++) pixels.push([31 + (k % 5), 78 + ((k * 3) % 5), 121]); // a noisy blue
  for (let k = 0; k < 40; k++) pixels.push([91 + (k % 5), 140, 58 + ((k * 2) % 5)]); // a noisy green
  const fine = scanSwatches(img(pixels), { mergeDE: 0 });
  const coarse = scanSwatches(img(pixels), { mergeDE: 8 });
  assert.ok(fine.length > 2, `ΔE 0 keeps variants apart (${fine.length})`);
  assert.equal(coarse.length, 2, 'ΔE 8 merges them into one blue and one green');
  near(coarse[0].share, 0.6, 1e-9);
  assert.equal(clampMergeDE(99), PALETTE_MERGE_MAX_DE);
  assert.equal(clampMergeDE(-1), 0);
  assert.equal(clampMergeDE('x'), PALETTE_MERGE_DE);
});

test('rescan keeps assignments and eyedropper swatches', () => {
  const previous = [
    { hex: '#1f4e79', category: 'deep', elevation: 200 },
    { hex: '#3fa7d6', category: 'lake', elevation: 0 }, // picked with the eyedropper
    { hex: '#808080', category: 'ignore', elevation: 200 },
  ];
  const scanned = [{ hex: '#1f4e79' }, { hex: '#5b8c3a' }];
  const out = rescanSwatches(scanned, previous, 2);
  assert.deepEqual(out.map((s) => [s.hex, s.category]), [['#1f4e79', 'deep'], ['#5b8c3a', 'ignore'], ['#3fa7d6', 'lake']]);
});
