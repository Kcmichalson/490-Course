import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyInsolation, tqTable, monthlyTables, seasonTemperature, rowLats, simSurfaceElevation,
} from '../src/sim/temperature.js';
import { runClimate } from '../src/sim/pipeline.js';
import { createPlanet, declination, MONTH_MID_DAYS, ANNUAL } from '../src/sim/planet.js';
import { CATEGORY } from '../src/sim/terrain.js';
import { SOLAR_CONSTANT } from '../src/sim/constants.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

test('insolation: equator at the equinox = S0/π, polar night = 0, summer pole above the equator', () => {
  close(dailyInsolation(0, 0), SOLAR_CONSTANT / Math.PI, 1e-6, 'equinox equator');
  close(SOLAR_CONSTANT / Math.PI, 433.2, 0.05, 'S0/π');
  const dec = declination(172, 23.5);
  assert.equal(dailyInsolation(-80, dec), 0, 'polar night at 80°S on day 172');
  const pole = dailyInsolation(89.9, dec);
  const eq = dailyInsolation(0, dec);
  assert.ok(pole > eq, `summer pole ${pole} > equator ${eq}`);
  close(pole, 542.7, 0.5, 'summer pole');
  close(eq, 397.3, 0.5, 'equator on day 172');
});

// Session 10 (Climate inputs, approved): with heat transport and ice-albedo
// the pole rows moved from −25.0 to ≈ −18 °C (Earth's Arctic ≈ −18); the
// equator stays 26.3 °C.
test('Tq calibration (SPEC 6): ~26.3 °C at the equator and −18.0 °C at the poles in Annual Mean', () => {
  const [eq, pole, south] = tqTable([0.18, 89.82, -89.82], 23.5, MONTH_MID_DAYS);
  close(eq, 26.3, 0.1, 'equator');
  close(pole, -18.0, 0.1, 'north pole row');
  close(south, -18.0, 0.1, 'south pole row');
  assert.ok(eq >= 25 && eq <= 28, 'SPEC M4 check: 25–28 °C');
  assert.ok(pole < -15, 'SPEC M4 check: below −15 °C');
});

test('seasonal lag moves the warmest month: June with no lag, July on land, August on the ocean (62°N)', () => {
  const argmax = (a) => a.indexOf(Math.max(...a));
  const noLag = MONTH_MID_DAYS.map((d) => tqTable([62], 23.5, [d])[0]);
  const t = monthlyTables([62], 23.5);
  assert.equal(argmax(noLag), 5);
  assert.equal(argmax(t.land.map((x) => x[0])), 6);
  assert.equal(argmax(t.ocean.map((x) => x[0])), 7);
});

// A small water planet with one block continent (land at 1,000 m).
function blockWorld(W = 72, H = 36) {
  const n = W * H;
  const category = new Uint8Array(n).fill(CATEGORY.OCEAN);
  const meanLandElev = new Float32Array(n);
  const meanOceanDepth = new Float32Array(n).fill(-4000);
  for (let j = 6; j < 14; j++) for (let i = 10; i < 30; i++) { category[j * W + i] = CATEGORY.LAND; meanLandElev[j * W + i] = 1000; }
  const sim = { category, meanLandElev, meanOceanDepth };
  return {
    grid: { width: W, height: H, latTop: 90, latBottom: -90, lonSpan: 360, wraps: true, radiusKm: 6371 },
    terrain: { category, elevation: simSurfaceElevation(sim) },
  };
}

test('Annual Mean equals the mean of the 12 monthly runs, cell by cell', () => {
  const { grid, terrain } = blockWorld();
  const planet = createPlanet();
  const annual = runClimate({ grid, planet, season: ANNUAL, terrain });
  const sum = new Float64Array(annual.temperature.length);
  for (const day of MONTH_MID_DAYS) {
    const r = runClimate({ grid, planet, season: { day }, terrain, continentality: annual.continentality });
    for (let k = 0; k < sum.length; k++) sum[k] += r.temperature[k];
  }
  let worst = 0;
  for (let k = 0; k < sum.length; k++) worst = Math.max(worst, Math.abs(sum[k] / 12 - annual.temperature[k]));
  assert.ok(worst < 1e-4, `max difference ${worst}`);
});

test('lapse rate −6.5 °C per 1,000 m (linear below sea level too); land ice −5 °C', () => {
  const grid = { width: 4, height: 1, latTop: 50, latBottom: 40 };
  const category = Uint8Array.from([CATEGORY.LAND, CATEGORY.LAND, CATEGORY.LAND, CATEGORY.LAND_ICE]);
  const elevation = Float32Array.from([0, 1000, -400, 0]);
  const s = new Float32Array(4).fill(0.3);
  const t = seasonTemperature(grid, 23.5, { day: 15 }, { category, elevation }, s);
  close(t[1] - t[0], -6.5, 1e-4, '1,000 m');
  close(t[2] - t[0], 2.6, 1e-4, '−400 m');
  close(t[3] - t[0], -5, 1e-4, 'land ice');
});

test('surface elevation: land = mean land elevation, lakes = surface, ocean and sea ice = 0 m', () => {
  const sim = {
    category: Uint8Array.from([CATEGORY.LAND, CATEGORY.LAKE, CATEGORY.OCEAN, CATEGORY.SEA_ICE, CATEGORY.LAND_ICE]),
    meanLandElev: Float32Array.from([800, 0, 0, 0, 2500]),
    meanOceanDepth: Float32Array.from([-50, 350, -3000, -200, 0]),
  };
  assert.deepEqual([...simSurfaceElevation(sim)], [800, 350, 0, 0, 2500]);
});

test('row latitudes are cell centers (no row on a pole)', () => {
  const lats = rowLats(90, -90, 4);
  assert.deepEqual([...lats], [67.5, 22.5, -22.5, -67.5]);
});
