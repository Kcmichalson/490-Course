import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maritimeTracer, continentality, seaDistanceKm } from '../src/sim/continentality.js';
import { temperatureSteps, finalWind, runClimate } from '../src/sim/pipeline.js';
import { seasonTemperature } from '../src/sim/temperature.js';
import { windProfile } from '../src/sim/wind.js';
import { createPlanet, MONTH_MID_DAYS } from '../src/sim/planet.js';
import { CATEGORY } from '../src/sim/terrain.js';

const R = 6371;
const planet = createPlanet();

// 1° cells; land where inLand(lon, lat). Longitudes from −180.
function world(inLand, { W = 360, H = 180, wraps = true, lonSpan = 360, latTop = 90, latBottom = -90 } = {}) {
  const grid = { width: W, height: H, latTop, latBottom, lonSpan, wraps, radiusKm: R };
  const category = new Uint8Array(W * H);
  const ocean = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) {
    const lat = latTop - ((j + 0.5) / H) * (latTop - latBottom);
    for (let i = 0; i < W; i++) {
      const lon = -180 + ((i + 0.5) / W) * lonSpan;
      const land = inLand(lon, lat);
      category[j * W + i] = land ? CATEGORY.LAND : CATEGORY.OCEAN;
      ocean[j * W + i] = land ? 0 : 1;
    }
  }
  return { grid, category, ocean, elevation: new Float32Array(W * H) };
}

const westerly = (H) => ({ u: new Float32Array(H).fill(1), v: new Float32Array(H) });
const cellAt = (grid, lon, lat) => {
  const i = Math.floor(((lon + 180) / grid.lonSpan) * grid.width);
  const j = Math.floor(((grid.latTop - lat) / (grid.latTop - grid.latBottom)) * grid.height);
  return j * grid.width + i;
};

test('the maritime tracer decays inland along the wind, about exp(−km / 1,500)', () => {
  const w = world((lon, lat) => lon >= 0 && lon < 120 && lat > 20 && lat < 70);
  const { m } = maritimeTracer(w.grid, w.ocean, westerly(w.grid.height), R, { tolerance: 1e-7 });
  const kmPerDeg = (Math.PI / 180) * R * Math.cos((45.5 * Math.PI) / 180);
  let prev = 1;
  for (const deg of [5, 10, 20, 30, 45, 60]) {
    const v = m[cellAt(w.grid, deg + 0.5, 45.5)];
    const expect = Math.exp(-(deg + 0.5) * kmPerDeg / 1500);
    assert.ok(Math.abs(v - expect) < 0.03, `${deg}° inland: ${v} vs ${expect}`);
    assert.ok(v < prev, 'decreasing downwind');
    prev = v;
  }
});

test('a windward coast stays milder than a leeward one at the same latitude and distance', () => {
  // A continent 40–60°N, 0–70°E under the real January winds (westerlies).
  const w = world((lon, lat) => lon >= 0 && lon < 70 && lat > 40 && lat < 60);
  const months = MONTH_MID_DAYS.map((d) => windProfile(w.grid, planet, d));
  const c = continentality(w.grid, w.category, months, R);
  const west = cellAt(w.grid, 4.5, 50.5);  // ~320 km in from the west (windward) coast
  const east = cellAt(w.grid, 65.5, 50.5); // ~320 km in from the east (leeward) coast
  assert.ok(c.s[west] < c.s[east], `s windward ${c.s[west]} < leeward ${c.s[east]}`);
  const t = seasonTemperature(w.grid, planet.tiltDeg, { day: 15 }, w, c.s);
  assert.ok(t[west] > t[east] + 3, `January windward ${t[west]} °C vs leeward ${t[east]} °C`);
  const interior = cellAt(w.grid, 35.5, 50.5);
  assert.ok(c.s[interior] > c.s[west], 'the interior is more continental than the windward coast');
});

test('wrap: a continent across the date line gives the same answer as the same continent moved half a world', () => {
  const across = world((lon, lat) => (lon >= 160 || lon < -150) && lat > 30 && lat < 60);
  const moved = world((lon, lat) => lon >= -20 && lon < 30 && lat > 30 && lat < 60);
  const wind = windProfile(across.grid, planet, 15);
  const a = maritimeTracer(across.grid, across.ocean, wind, R, { tolerance: 1e-7 }).m;
  const b = maritimeTracer(moved.grid, moved.ocean, wind, R, { tolerance: 1e-7 }).m;
  const da = seaDistanceKm(across.grid, across.ocean, R);
  const db = seaDistanceKm(moved.grid, moved.ocean, R);
  const W = across.grid.width;
  let worst = 0;
  let worstD = 0;
  for (let j = 0; j < across.grid.height; j++) {
    for (let i = 0; i < W; i++) {
      const k = j * W + i;
      const kb = j * W + ((i + W / 2) % W);
      worst = Math.max(worst, Math.abs(a[k] - b[kb]));
      if (Number.isFinite(da[k])) worstD = Math.max(worstD, Math.abs(da[k] - db[kb]));
    }
  }
  assert.ok(worst < 1e-5, `tracer ${worst}`);
  assert.ok(worstD < 1e-3, `distance ${worstD} km`);
});

test('non-wrapping partial map: off the map counts as open ocean', () => {
  // A 90°-wide map that is all land: the west edge is fed by the open ocean beyond it.
  const w = world(() => true, { W: 90, H: 60, wraps: false, lonSpan: 90, latTop: 70, latBottom: 10 });
  const { m } = maritimeTracer(w.grid, w.ocean, westerly(w.grid.height), R, { tolerance: 1e-7 });
  const row = 30 * 90;
  // The upwind point is one full step (dy = 1° ≈ 111 km) back, mostly off the
  // map, so the edge cell decays by at most one step: exp(−111 / 1,500) ≈ 0.929.
  const oneStep = Math.exp(-((Math.PI / 180) * R) / 1500);
  assert.ok(m[row] > oneStep - 0.01, `west edge ${m[row]} vs one step ${oneStep}`);
  assert.ok(m[row + 89] < m[row + 10] && m[row + 10] < m[row], 'decays eastward');
  const d = seaDistanceKm(w.grid, w.ocean, R);
  assert.ok(Number.isFinite(d[row + 45]), 'distance to the map edge');
});

// Until M4b (Session 6) the second half checked that pass 2 equaled pass 1,
// true only while step 5 passed the base wind through. Now pass 2 must use
// the final (friction + deflection) wind.
test('determinism, and pass 2 follows the final wind', () => {
  const w = world((lon, lat) => lon >= 0 && lon < 70 && lat > 40 && lat < 60, { W: 120, H: 60 });
  const terrain = { category: w.category, elevation: w.elevation };
  const one = runClimate({ grid: w.grid, planet, season: { day: 15 }, terrain });
  const two = runClimate({ grid: w.grid, planet, season: { day: 15 }, terrain });
  assert.deepEqual(one.temperature, two.temperature);
  assert.deepEqual(one.continentality.s, two.continentality.s);
  // Pass 2 = continentality on the 12 monthly final winds.
  const steps = temperatureSteps({ grid: w.grid, planet, season: { day: 15 }, terrain });
  const finalMonths = MONTH_MID_DAYS.map((d) => finalWind(windProfile(w.grid, planet, d), w.grid, terrain));
  const pass2 = continentality(w.grid, w.category, finalMonths, R);
  assert.deepEqual(pass2.s, steps.continentality.s);
  const onBase = continentality(w.grid, w.category, MONTH_MID_DAYS.map((d) => windProfile(w.grid, planet, d)), R);
  assert.notDeepEqual(onBase.s, steps.continentality.s, 'friction changes the tracer');
});

test('lakes count as land (no maritime source)', () => {
  const w = world((lon, lat) => lon >= 0 && lon < 40 && lat > 30 && lat < 60, { W: 120, H: 60 });
  const lake = cellAt(w.grid, 21, 45);
  w.category[lake] = CATEGORY.LAKE;
  const months = MONTH_MID_DAYS.map((d) => windProfile(w.grid, planet, d));
  const c = continentality(w.grid, w.category, months, R);
  assert.ok(c.maritime[lake] < 0.99, `lake is not a source: ${c.maritime[lake]}`);
});
