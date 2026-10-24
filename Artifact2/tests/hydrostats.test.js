import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  seasonalityIndex, thornthwaite, monthlyDayHours, hydroStats, cloudCover, cloudLayer, MONTH_DAYS,
} from '../src/sim/hydrostats.js';
import { createPlanet, MONTH_MID_DAYS } from '../src/sim/planet.js';
import { windProfile } from '../src/sim/wind.js';
import { CATEGORY } from '../src/sim/terrain.js';

const fill = (v) => new Array(12).fill(v);
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);
const planet = createPlanet();

test('Walsh–Lawler seasonality: uniform rain → 0, all rain in one month → 11/6 ≈ 1.83, no rain → 0', () => {
  assert.equal(seasonalityIndex(fill(50)), 0);
  const one = fill(0);
  one[6] = 600;
  near(seasonalityIndex(one), 11 / 6, 1e-12);
  assert.equal(seasonalityIndex(fill(0)), 0);
  // Half the year wet, half dry: (6·R/12 + 6·R/12)/R = 1.
  near(seasonalityIndex([0, 0, 0, 0, 0, 0, 100, 100, 100, 100, 100, 100]), 1, 1e-12);
});

test('Thornthwaite PET at known temperatures (12 h days, 30-day months)', () => {
  const L = fill(12);
  // 20 °C every month: I = 12·4^1.514 ≈ 97.88, a ≈ 2.141, PET = 16·(200/I)^a ≈ 73.9 mm/month.
  const warm = thornthwaite(fill(20), L, 30);
  near(warm.heatIndex, 12 * 4 ** 1.514, 1e-9);
  near(warm.months[0], 73.87, 0.01);
  // ≥ 26.5 °C: the hot-month formula, −415.85 + 32.24·30 − 0.43·30² = 164.35 mm/month.
  near(thornthwaite(fill(30), L, 30).months[0], 164.35, 1e-9);
  // At or below 0 °C nothing evaporates.
  assert.equal(thornthwaite(fill(-5), L, 30).total, 0);
  // Daylight and month length scale it linearly: 16 h days → × 16/12.
  near(thornthwaite(fill(20), fill(16), 30).months[0], (73.868 * 16) / 12, 0.01);
  near(thornthwaite(fill(20), L).months[0], (73.868 * MONTH_DAYS) / 30, 0.01);
});

test('day length for PET: 24 h clock, scaled from the rotation period', () => {
  const grid = { width: 4, height: 2, latTop: 90, latBottom: -90 };
  // A 48 h rotation gives the same daylight FRACTION, so the same 24 h-clock hours.
  const a = monthlyDayHours(grid, planet);
  const b = monthlyDayHours(grid, createPlanet({ rotationHours: 48 }));
  for (let m = 0; m < 12; m++) for (let j = 0; j < 2; j++) near(a[m][j], b[m][j], 1e-9);
  // Northern summer: the north row has longer days than the south row.
  assert.ok(a[6][0] > a[6][1]);
  // No tilt: 12 h everywhere.
  const flat = monthlyDayHours(grid, createPlanet({ tiltDeg: 0 }));
  for (let m = 0; m < 12; m++) near(flat[m][0], 12, 1e-9);
});

test('hydroStats per cell: seasonality, wettest and driest month, PET', () => {
  const grid = { width: 2, height: 1, latTop: 1, latBottom: -1 };
  const months = Array.from({ length: 12 }, (_, m) => Float32Array.from([50, m === 6 ? 120 : 10]));
  const temps = Array.from({ length: 12 }, () => Float32Array.from([20, -5]));
  const st = hydroStats(grid, createPlanet({ tiltDeg: 0 }), months, temps);
  near(st.seasonality[0], 0, 1e-6);
  near(st.seasonality[1], seasonalityIndex(months.map((a) => a[1])), 1e-6);
  assert.equal(st.wetMonth[1], 6);
  near(st.wetMm[1], 120, 1e-6);
  near(st.dryMm[1], 10, 1e-6);
  near(st.pet[0], 12 * 73.868 * (MONTH_DAYS / 30), 0.2, 'equator, 12 h days');
  assert.equal(st.pet[1], 0, 'frozen all year');
});

// M6a (Session 10): Köppen's summer/winter split, by each row's hemisphere.
test('hydroStats per cell: Köppen summer and winter halves, north and south rows', () => {
  const grid = { width: 1, height: 2, latTop: 10, latBottom: -10 };
  const months = Array.from({ length: 12 }, (_, m) => Float32Array.from([m + 1, m + 1])); // Jan 1 … Dec 12 mm
  const temps = Array.from({ length: 12 }, () => Float32Array.from([20, 20]));
  const st = hydroStats(grid, createPlanet(), months, temps);
  // North (row 0): summer Apr–Sep = 4…9 mm (39 of 78).
  near(st.summerShare[0], 0.5, 1e-6);
  assert.deepEqual([st.summerDryMm[0], st.summerWetMm[0], st.winterDryMm[0], st.winterWetMm[0]], [4, 9, 1, 12]);
  // South (row 1): summer Oct–Mar = 10, 11, 12, 1, 2, 3 mm.
  near(st.summerShare[1], 0.5, 1e-6);
  assert.deepEqual([st.summerDryMm[1], st.summerWetMm[1], st.winterDryMm[1], st.winterWetMm[1]], [1, 12, 4, 9]);
});

test('cloud cover: none in dry air, overcast in saturated rising air, less under the highs', () => {
  assert.equal(cloudCover(0.2, -1), 0);
  near(cloudCover(1, -1), 1, 1e-12);
  near(cloudCover(1, 1), 0.7, 1e-12);
  const mid = cloudCover(0.625, 0);
  near(mid, 0.5 * 0.85, 1e-12, 'smoothstep midpoint × (0.7 + 0.3·0.5)');
  const grid = { width: 3, height: 2 };
  const layer = cloudLayer(grid, Float32Array.from([1, 1, 1, 0.2, 0.2, 0.2]), [-1, 1], new Float32Array(6));
  assert.deepEqual(Array.from(layer), [1, 1, 1, 0, 0, 0]);
});

// Session 9: without a rain term, rainforest air (RH 0.1–0.5 after its
// rain-out) read 1–3% cloud on GEBCO.
test('cloud cover: raining air is cloudy even when dry after the rain-out', () => {
  near(cloudCover(0.2, -1, 50), 1 - Math.exp(-1), 1e-12, 'dry air, 50 mm/month, at the lows');
  near(cloudCover(0.2, 1, 50), 0.7 * (1 - Math.exp(-1)), 1e-12, 'the same under the highs');
  assert.ok(cloudCover(0.2, -1, 150) > 0.9);
  // Rain and humidity combine: 1 − (1 − h)·exp(−P/50).
  near(cloudCover(0.625, -1, 50), 1 - 0.5 * Math.exp(-1), 1e-12);
  const layer = cloudLayer({ width: 2, height: 1 }, Float32Array.from([0.2, 0.2]), [-1], Float32Array.from([0, 100]));
  assert.equal(layer[0], 0);
  near(layer[1], 1 - Math.exp(-2), 1e-6);
});

test('pipeline step 7 adds the weather-mode layers: stats once per 12-month set, cloud per season', async () => {
  const { runClimate, precipitationSteps } = await import('../src/sim/pipeline.js');
  const W = 90;
  const H = 45;
  const grid = { width: W, height: H, latTop: 90, latBottom: -90, lonSpan: 360, wraps: true, radiusKm: 6371 };
  const category = new Uint8Array(W * H);
  const elevation = new Float32Array(W * H);
  for (let k = 0; k < W * H; k++) if (k % W > 10 && k % W < 30) { category[k] = CATEGORY.LAND; elevation[k] = 300; }
  const terrain = { category, elevation };
  const annual = runClimate({ grid, planet, season: { annual: true }, terrain, precipitation: true });
  assert.equal(annual.cloud, annual.hydro.cloud);
  assert.ok(annual.hydro.stats.seasonality instanceof Float32Array);
  // Annual Mean cloud = the mean of the 12 monthly cloud layers.
  for (const k of [0, 5 * W + 20, 22 * W + 15, 40 * W + 50]) {
    let sum = 0;
    MONTH_MID_DAYS.forEach((d, m) => {
      sum += cloudCover(annual.hydro.rh[m][k], windProfile(grid, planet, d).pressure[Math.floor(k / W)], annual.hydro.months[m][k]);
    });
    near(annual.cloud[k], sum / 12, 1e-5, `cell ${k}`);
  }
  // A day reuses the set (stats unchanged) and gets its own cloud layer.
  const stats = annual.hydro.stats;
  const day = precipitationSteps({ grid, planet, season: { day: 172 }, terrain, s: annual.continentality.s, hydro: annual.hydro });
  assert.equal(day.hydro.stats, stats);
  assert.notEqual(day.cloud, annual.cloud);
  for (const c of day.cloud) assert.ok(c >= 0 && c <= 1);
});
