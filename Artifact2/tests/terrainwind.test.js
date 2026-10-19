import { test } from 'node:test';
import assert from 'node:assert/strict';
import { terrainWind } from '../src/sim/terrainwind.js';
import { runClimate } from '../src/sim/pipeline.js';
import { windProfile } from '../src/sim/wind.js';
import { createPlanet } from '../src/sim/planet.js';
import { CATEGORY } from '../src/sim/terrain.js';
import { LAND_FRICTION } from '../src/sim/constants.js';

const planet = createPlanet();

// 1° cells; elevation(lon, lat) in m where land, else ocean.
function world(landAt, { W = 360, H = 180 } = {}) {
  const grid = { width: W, height: H, latTop: 90, latBottom: -90, lonSpan: 360, wraps: true, radiusKm: 6371 };
  const category = new Uint8Array(W * H);
  const elevation = new Float32Array(W * H);
  for (let j = 0; j < H; j++) {
    const lat = 90 - (j + 0.5);
    for (let i = 0; i < W; i++) {
      const lon = -180 + i + 0.5;
      const e = landAt(lon, lat);
      if (e != null) { category[j * W + i] = CATEGORY.LAND; elevation[j * W + i] = e; }
    }
  }
  return { grid, terrain: { category, elevation } };
}
const idx = (grid, lon, lat) => Math.floor(90 - lat) * grid.width + Math.floor(lon + 180);
const base = (grid) => windProfile(grid, planet, 15); // January

test('friction: flat land keeps 60% of the wind (inside a wide plain, away from the smoothed edge)', () => {
  const { grid, terrain } = world((lon, lat) => (lon > -40 && lon < 40 && lat > 30 && lat < 60 ? 100 : null));
  const b = base(grid);
  const f = terrainWind(b, grid, terrain);
  const k = idx(grid, 0, 45);
  const j = Math.floor(k / grid.width);
  assert.ok(Math.abs(f.u[k] - LAND_FRICTION * b.u[j]) < 1e-6, `u ${f.u[k]} vs ${LAND_FRICTION * b.u[j]}`);
  assert.ok(Math.abs(f.v[k] - LAND_FRICTION * b.v[j]) < 1e-6);
  assert.ok(Math.abs(f.speed[k] / b.speed[j] - LAND_FRICTION) < 1e-5, 'speed ratio');
});

test('ocean far from land is unchanged, exactly', () => {
  const { grid, terrain } = world((lon, lat) => (lon > -40 && lon < 40 && lat > 30 && lat < 60 ? 3000 : null));
  const b = base(grid);
  const f = terrainWind(b, grid, terrain);
  for (const [lon, lat] of [[-120, 45], [150, 0], [100, -45]]) {
    const k = idx(grid, lon, lat);
    const j = Math.floor(k / grid.width);
    assert.equal(f.u[k], b.u[j]);
    assert.equal(f.v[k], b.v[j]);
    assert.equal(f.speed[k], b.speed[j]);
  }
});

// A north–south ridge at 10–14°E, 30–60°N, rising from the west; the
// January westerlies at 45°N blow up its west slope.
const ridge = (peak) => (lon, lat) => {
  if (lat <= 30 || lat >= 60 || lon <= -30 || lon >= 30) return null;
  const d = Math.abs(lon - 12);
  return d < 6 ? 200 + peak * (1 - d / 6) : 200;
};

test('a high ridge deflects the wind: less uphill (eastward) flow, more along the ridge', () => {
  const plain = world(ridge(0));
  const high = world(ridge(4000));
  const b = base(plain.grid);
  const fp = terrainWind(b, plain.grid, plain.terrain);
  const fh = terrainWind(b, high.grid, high.terrain);
  const k = idx(high.grid, 9, 45); // west slope
  assert.ok(fp.u[k] > 0, 'westerly at 45°N');
  assert.ok(fh.u[k] < 0.7 * fp.u[k], `uphill u ${fh.u[k]} vs plain ${fp.u[k]}`);
  assert.ok(Math.abs(fh.v[k]) > Math.abs(fp.v[k]) + 0.02, `along-ridge |v| ${fh.v[k]} vs ${fp.v[k]}`);
});

test('a low ridge (300 m) still lets the air cross: no deflection, friction only', () => {
  const plain = world(ridge(0));
  const low = world(ridge(100)); // 200 m plain + 100 m = 300 m crest
  const b = base(plain.grid);
  const fp = terrainWind(b, plain.grid, plain.terrain);
  const fl = terrainWind(b, low.grid, low.terrain);
  const k = idx(low.grid, 9, 45);
  assert.ok(Math.abs(fl.u[k] - fp.u[k]) < 1e-9 && Math.abs(fl.v[k] - fp.v[k]) < 1e-9);
});

test('wrap: a ridge across the date line equals the same ridge moved half a world', () => {
  const across = world((lon, lat) => (lat > 30 && lat < 60 && (lon > 160 || lon < -160) ? 3000 * (1 - Math.min(20, Math.abs(((lon + 360) % 360) - 180)) / 20) + 200 : null));
  const moved = world((lon, lat) => (lat > 30 && lat < 60 && lon > -20 && lon < 20 ? 3000 * (1 - Math.min(20, Math.abs(lon)) / 20) + 200 : null));
  const b = base(across.grid);
  const a = terrainWind(b, across.grid, across.terrain);
  const m = terrainWind(b, moved.grid, moved.terrain);
  const W = across.grid.width;
  let worst = 0;
  for (let k = 0; k < a.u.length; k++) {
    const j = Math.floor(k / W);
    const kb = j * W + (((k % W) + W / 2) % W);
    worst = Math.max(worst, Math.abs(a.u[k] - m.u[kb]), Math.abs(a.v[k] - m.v[kb]));
  }
  assert.ok(worst < 1e-5, `max difference ${worst}`);
});

test('determinism; arrows and the speed mode get the final wind from runClimate', () => {
  const { grid, terrain } = world(ridge(4000), { W: 180, H: 90 });
  const r1 = runClimate({ grid, planet, season: { day: 15 }, terrain });
  const r2 = runClimate({ grid, planet, season: { day: 15 }, terrain });
  assert.deepEqual(r1.u, r2.u);
  assert.deepEqual(r1.temperature, r2.temperature);
  const direct = terrainWind(windProfile(grid, planet, 15), grid, terrain);
  assert.deepEqual(r1.u, direct.u);
  assert.deepEqual(r1.speed, direct.speed);
  const annual = runClimate({ grid, planet, season: { annual: true }, terrain });
  assert.equal(annual.months, undefined, 'no zonal monthly profiles once the wind follows terrain');
});
