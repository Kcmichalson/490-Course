import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyKoppen, halfStats, bThreshold, isSummerMonth, KOPPEN_CODES, KOPPEN_NAMES } from '../src/sim/koppen.js';

const fill = (v) => new Array(12).fill(v);
// Code of one place: 12 temperatures, 12 monthly totals (mm), north or south.
const code = (t, p, opts = {}, north = true) => KOPPEN_CODES[classifyKoppen(t, halfStats(p, north), opts)];
const shift6 = (a) => a.map((_, m) => a[(m + 6) % 12]);

// Temperature curves (°C, Jan–Dec, northern hemisphere).
const T = {
  equatorial: fill(27),
  savanna: fill(26),
  hotDesert: [20, 22, 25, 29, 33, 35, 35, 34, 32, 28, 24, 21],          // MAT 28.2
  coldDesert: [-5, -2, 4, 11, 17, 22, 25, 23, 17, 10, 2, -3],            // MAT 10.1
  rome: [8, 9, 11, 14, 18, 22, 25, 25, 21, 17, 12, 9],                   // warmest 25, coldest 8
  coolMed: [9, 9, 10, 11, 13, 15, 17, 17, 16, 14, 11, 9],                // warmest 17
  subtropical: [5, 7, 11, 16, 21, 25, 27, 27, 23, 17, 11, 6],
  paris: [4, 5, 8, 11, 15, 18, 20, 20, 16, 12, 7, 5],
  subpolarOcean: [1, 1, 2, 4, 7, 10, 12, 11, 9, 6, 3, 2],               // 3 months ≥ 10
  hotContinental: [-8, -5, 2, 10, 17, 23, 26, 24, 19, 12, 3, -5],
  moscow: [-9, -8, -2, 6, 13, 17, 19, 17, 11, 5, -1, -6],
  subarctic: [-25, -22, -14, -3, 6, 13, 16, 13, 6, -3, -15, -22],
  yakutsk: [-45, -42, -30, -12, 3, 13, 16, 12, 3, -12, -32, -43],
  tundra: [-20, -20, -18, -12, -3, 3, 6, 5, 0, -8, -15, -18],
  iceCap: [-30, -30, -28, -20, -10, -4, -2, -3, -10, -20, -26, -30],
};
// Rome's rain: wet winters, dry summers (summer share 0.29).
const MED_P = [80, 70, 60, 60, 40, 20, 10, 20, 60, 110, 110, 90];

test('the SPEC 8 must-haves, one synthetic place each', () => {
  assert.equal(code(T.equatorial, fill(200)), 'Af');
  // 3 dry months of 40 mm in a 2,820 mm year: 40 ≥ 100 − 2820/25.
  assert.equal(code(T.equatorial, [40, 40, 40, ...new Array(9).fill(300)]), 'Am');
  assert.equal(code(T.savanna, [5, 5, 5, 5, 200, 200, 200, 200, 200, 200, 5, 5]), 'Aw');
  assert.equal(code(T.hotDesert, fill(2)), 'BWh');
  assert.equal(code(T.coldDesert, fill(10)), 'BWk');
  assert.equal(code(T.hotDesert, fill(40)), 'BSh');
  assert.equal(code(T.coldDesert, fill(20)), 'BSk');
  assert.equal(code(T.rome, MED_P), 'Csa');
  assert.equal(code(T.coolMed, MED_P), 'Csb');
  assert.equal(code(T.subtropical, fill(100)), 'Cfa');
  assert.equal(code(T.paris, fill(55)), 'Cfb');
  assert.equal(code(T.hotContinental, fill(70)), 'Dfa');
  assert.equal(code(T.moscow, fill(55)), 'Dfb');
  assert.equal(code(T.subarctic, fill(30)), 'Dfc');
  assert.equal(code(T.tundra, fill(30)), 'ET');
  assert.equal(code(T.iceCap, fill(10)), 'EF');
  assert.equal(code(T.paris, fill(55), { elevation: 2600 }), 'H');
});

test('other subtypes: Cfc, Cwa, Dsb, Dwb, Dfd', () => {
  assert.equal(code(T.subpolarOcean, fill(100)), 'Cfc');
  const summer = (s, w) => [w, w, w, s, s, s, s, s, s, w, w, w];
  assert.equal(code(T.subtropical, summer(200, 5)), 'Cwa');
  assert.equal(code(T.moscow, summer(15, 80)), 'Dsb');
  assert.equal(code(T.moscow, summer(100, 3)), 'Dwb');
  assert.equal(code(T.yakutsk, fill(20)), 'Dfd');
});

test('southern hemisphere: the same climate six months later gets the same code', () => {
  assert.equal(code(shift6(T.rome), shift6(MED_P), {}, false), 'Csa');
  assert.equal(code(shift6(T.moscow), shift6([15, 15, 15, 80, 80, 80, 80, 80, 80, 15, 15, 15].map((v, m) => (isSummerMonth(m, true) ? 15 : 80))), {}, false), 'Dsb');
  // Read with the wrong hemisphere, Rome's dry season would be its winter.
  assert.notEqual(code(T.rome, MED_P, {}, false), 'Csa');
});

test('summer half: Apr–Sep north, Oct–Mar south; halfStats sums and extremes', () => {
  assert.deepEqual([...Array(12).keys()].filter((m) => isSummerMonth(m, true)), [3, 4, 5, 6, 7, 8]);
  assert.deepEqual([...Array(12).keys()].filter((m) => isSummerMonth(m, false)), [0, 1, 2, 9, 10, 11]);
  const h = halfStats(MED_P, true);
  assert.equal(h.annual, 730);
  assert.equal(h.driest, 10);
  assert.equal(h.summerDry, 10);
  assert.equal(h.summerWet, 60);
  assert.equal(h.winterDry, 60);
  assert.equal(h.winterWet, 110);
  assert.ok(Math.abs(h.summerShare - 210 / 730) < 1e-12);
});

test('B threshold: 20·MAT + 280 / + 140 / + 0 by the summer share (≥ 70%, 30–70%, < 30%)', () => {
  assert.equal(bThreshold(10, 0.8), 480);
  assert.equal(bThreshold(10, 0.7), 480);
  assert.equal(bThreshold(10, 0.5), 340);
  assert.equal(bThreshold(10, 0.3), 340);
  assert.equal(bThreshold(10, 0.1), 200);
  // BW below half the threshold, BS below it, humid at or above it (MAT 10.1, even rain: 341.7 mm).
  assert.equal(code(T.coldDesert, fill(170 / 12)), 'BWk');
  assert.equal(code(T.coldDesert, fill(172 / 12)), 'BSk');
  assert.equal(code(T.coldDesert, fill(343 / 12)), 'Dfa', 'humid: coldest −5 °C, warmest 25 °C');
});

test('order: E before B (a cold, dry place is polar, not desert)', () => {
  assert.equal(code(T.tundra, fill(1)), 'ET');
  assert.equal(code(T.iceCap, fill(0)), 'EF');
});

test('C/D boundary: 0 °C by default, −3 °C as the setting', () => {
  const mild = [-2, -1, 3, 8, 13, 17, 19, 18, 14, 9, 3, 0];
  assert.equal(code(mild, fill(60)), 'Dfb');
  assert.equal(code(mild, fill(60), { cdBoundary: -3 }), 'Cfb');
  // The coldest month exactly at the boundary is D (C needs it above).
  assert.equal(code([0, 1, 3, 8, 13, 17, 19, 18, 14, 9, 3, 1], fill(60)), 'Dfb');
});

test('highland override: above 2,500 m when on; off → the climate class; land ice is always EF', () => {
  assert.equal(code(T.paris, fill(55), { elevation: 2600 }), 'H');
  assert.equal(code(T.paris, fill(55), { elevation: 2500 }), 'Cfb');
  assert.equal(code(T.paris, fill(55), { elevation: 2600, highland: false }), 'Cfb');
  assert.equal(code(T.equatorial, fill(200), { landIce: true }), 'EF');
  assert.equal(code(T.equatorial, fill(200), { landIce: true, elevation: 4000 }), 'EF');
});

test('second letter: s is checked before w when both hold (SPEC 8 order)', () => {
  // Summer: one 300 mm month, the rest 10 (driest 10 < 40 and < 200/3);
  // winter: one 200 mm month, the rest 5 (5 < 300/10).
  const p = [5, 5, 5, 300, 10, 10, 10, 10, 10, 200, 5, 5];
  const h = halfStats(p, true);
  assert.ok(h.summerDry < 40 && h.summerDry < h.winterWet / 3, 's holds');
  assert.ok(h.winterDry < h.summerWet / 10, 'w holds too');
  assert.equal(code(T.paris, p), 'Csb');
});

test('A: Af / Am / Aw at the driest-month limits', () => {
  const p = (driest, annual) => ({ annual, driest, summerShare: 0.5, summerDry: driest, summerWet: 300, winterDry: driest, winterWet: 300 });
  const c = (pr) => KOPPEN_CODES[classifyKoppen(T.equatorial, pr)];
  assert.equal(c(p(60, 1500)), 'Af');
  assert.equal(c(p(40, 1500)), 'Am', '100 − 1500/25 = 40');
  assert.equal(c(p(39.9, 1500)), 'Aw');
});

test('nearest land cell: land is its own, ocean takes the nearest land (wrapping, km metric), no land → −1', async () => {
  const { nearestLandCells } = await import('../src/sim/koppen.js');
  const { CATEGORY } = await import('../src/sim/terrain.js');
  const grid = { width: 8, height: 4, latTop: 40, latBottom: -40, lonSpan: 360, wraps: true, radiusKm: 6371 };
  const cat = new Uint8Array(32);
  cat[1 * 8 + 1] = CATEGORY.LAND;
  cat[2 * 8 + 6] = CATEGORY.LAND_ICE;
  cat[2 * 8 + 3] = CATEGORY.LAKE; // a lake is not land
  const near = nearestLandCells(grid, cat);
  assert.equal(near[1 * 8 + 1], 1 * 8 + 1);
  assert.equal(near[2 * 8 + 6], 2 * 8 + 6);
  assert.equal(near[1 * 8 + 2], 1 * 8 + 1, 'east neighbor');
  assert.equal(near[2 * 8 + 7], 2 * 8 + 6, 'west neighbor');
  assert.equal(near[2 * 8 + 3] === 1 * 8 + 1 || near[2 * 8 + 3] === 2 * 8 + 6, true, 'the lake takes a land cell');
  // Land in columns 0 and 4 of one row: column 7 is 1 cell from column 0
  // across the seam when the map wraps, else 3 cells from column 4.
  const seam = new Uint8Array(32);
  seam[2 * 8 + 0] = CATEGORY.LAND;
  seam[2 * 8 + 4] = CATEGORY.LAND;
  assert.equal(nearestLandCells(grid, seam)[2 * 8 + 7], 2 * 8 + 0, 'across the wrap seam');
  assert.equal(nearestLandCells({ ...grid, wraps: false }, seam)[2 * 8 + 7], 2 * 8 + 4, 'no wrap');
  assert.ok(nearestLandCells(grid, new Uint8Array(32)).every((v) => v === -1));
});

// Pixel context: sim cells [land, ocean, ocean] in one row; 6 × 1 source
// pixels (2 per cell); 45°–55°N. Cell 0 rains 100 mm every month, the ocean
// cells 10.
async function pixelCtx({ category = [1, 1, 1, 1, 1, 1], elevation = [0, 0, 0, 0, 0, 0], highland = true } = {}) {
  const { monthlyTables, rowLats } = await import('../src/sim/temperature.js');
  const map = { sourceWidth: 6, sourceHeight: 1, latTop: 55, latBottom: 45, wraps: false };
  const one = (a, b) => Float32Array.from([a, b, b]);
  const stats = {
    nearestLand: Int32Array.from([0, 0, 0]), dryMm: one(100, 10), summerShare: one(0.5, 0.5),
    summerDryMm: one(100, 10), summerWetMm: one(100, 10), winterDryMm: one(100, 10), winterWetMm: one(100, 10),
  };
  return {
    map, simW: 3, simH: 1, s: Float32Array.from([0.3, 0.3, 0.3]), tables: monthlyTables(rowLats(55, 45, 1), 23.5),
    category: Uint8Array.from(category), elevation: Float32Array.from(elevation),
    annual: one(100, 10), stats, cdBoundary: 0, highland,
  };
}

test('pixels: rainfall from land cells only, with the nearest land cell as the fallback', async () => {
  const { pixelKoppenPrecip } = await import('../src/sim/koppenfield.js');
  const ctx = await pixelCtx();
  // Pixel 2 sits between cell 0 (land) and cell 1 (ocean): plain bilinear
  // would mix in ocean rain; land-only gives cell 0's.
  assert.equal(pixelKoppenPrecip(ctx, 2, 0).annual, 1200);
  // Pixel 5's corners are both ocean cells: the nearest land cell's rain.
  assert.equal(pixelKoppenPrecip(ctx, 5, 0).annual, 1200);
  assert.equal(pixelKoppenPrecip(ctx, 5, 0).driest, 100);
});

test('pixels: water is skipped; a mountain pixel is colder than the lowland beside it', async () => {
  const { fillKoppenClasses, koppenAt } = await import('../src/sim/koppenfield.js');
  const { WATER } = await import('../src/sim/climatefield.js');
  const ctx = await pixelCtx({ category: [1, 1, 0, 2, 4, 3], elevation: [100, 3000, -50, 0, -10, 100], highland: false });
  const out = fillKoppenClasses('koppen', ctx, 0, 1, new Uint8Array(6));
  assert.deepEqual([out[2], out[3], out[4]], [WATER, WATER, WATER], 'ocean, lake, sea ice');
  assert.equal(KOPPEN_CODES[out[5]], 'EF', 'painted land ice');
  const low = koppenAt(ctx, 0, 0);
  const high = koppenAt(ctx, 1, 0);
  assert.ok(Math.abs(low.warmest - high.warmest - 2900 * 0.0065) < 0.05, 'lapse rate between the two pixels');
  assert.notEqual(KOPPEN_CODES[low.cls], KOPPEN_CODES[high.cls]);
  assert.equal(KOPPEN_CODES[high.cls][0], 'E', `mountain ${KOPPEN_CODES[high.cls]}`);
  ctx.highland = true;
  assert.equal(KOPPEN_CODES[koppenAt(ctx, 1, 0).cls], 'H');
});

test('every class has a name; codes are unique', () => {
  assert.equal(new Set(KOPPEN_CODES).size, KOPPEN_CODES.length);
  assert.equal(KOPPEN_CODES.length, 31);
  for (const c of KOPPEN_CODES) assert.ok(KOPPEN_NAMES[c], c);
});
