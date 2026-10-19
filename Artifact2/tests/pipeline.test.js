import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runClimate, finalWind, resultFromProfile } from '../src/sim/pipeline.js';
import { createPlanet, ANNUAL } from '../src/sim/planet.js';
import { rowLat } from '../src/sim/wind.js';

const grid = { width: 64, height: 181, latTop: 90, latBottom: -90 };
const planet = createPlanet();

// Row index whose center is closest to a latitude.
const rowAt = (lat) => {
  let best = 0;
  for (let j = 1; j < grid.height; j++) if (Math.abs(rowLat(grid, j) - lat) < Math.abs(rowLat(grid, best) - lat)) best = j;
  return best;
};

test('single season: layers sized width × height, constant along each row (zonal in M3)', () => {
  const r = runClimate({ grid, planet, season: { day: 172 } });
  for (const f of ['u', 'v', 'speed', 'pressure']) {
    assert.ok(r[f] instanceof Float32Array, f);
    assert.equal(r[f].length, grid.width * grid.height, f);
    for (let j = 0; j < grid.height; j += 17) {
      const row = r[f].subarray(j * grid.width, (j + 1) * grid.width);
      assert.ok(row.every((x) => x === row[0]), `${f} row ${j}`);
    }
  }
  assert.ok(r.meta.itcz > 0, 'ITCZ north on day 172');
  assert.equal(r.months, undefined);
});

test('step 5 passes the base wind through unchanged before M8', () => {
  const base = { u: new Float32Array(2), v: new Float32Array(2) };
  assert.equal(finalWind(base), base);
});

test('Annual Mean at defaults: easterly at the equator, cancels where band edges sweep (≈30°, 60°)', () => {
  const r = runClimate({ grid, planet, season: ANNUAL });
  const at = (lat) => {
    const i = rowAt(lat) * grid.width;
    return { u: r.u[i], mag: Math.hypot(r.u[i], r.v[i]), speed: r.speed[i] };
  };
  for (let i = 0; i < r.u.length; i += grid.width) {
    assert.ok(r.speed[i] + 1e-6 >= Math.hypot(r.u[i], r.v[i]), `speed ≥ |(u,v)| at row ${i / grid.width}`);
  }
  const eq = at(0);
  assert.ok(eq.u < 0 && eq.mag > 0.6, `equator stays easterly (only v cancels): ${eq.mag}`);
  assert.ok(r.meta.annual && r.meta.itczRange.north > 0);

  // The cancellation minimum is narrow (about 1° wide), so it is located on a
  // 0.1° grid: the smallest |(u,v)| within 1° of each latitude.
  const fine = { width: 1, height: 1800, latTop: 90, latBottom: -90 };
  const f = runClimate({ grid: fine, planet, season: ANNUAL });
  const minNear = (lat) => {
    let best = null;
    for (let j = 0; j < fine.height; j++) {
      if (Math.abs(rowLat(fine, j) - lat) > 1) continue;
      const mag = Math.hypot(f.u[j], f.v[j]);
      if (!best || mag < best.mag) best = { mag, speed: f.speed[j] };
    }
    return best;
  };
  for (const [lat, max] of [[30, 0.05], [-30, 0.05], [60, 0.1], [-60, 0.1]]) {
    const a = minNear(lat);
    assert.ok(a.mag < max, `${lat}: |(u,v)| ${a.mag}`);
    assert.ok(a.speed >= 0.3, `${lat}: mean speed ${a.speed}`);
  }
});

test('Annual Mean returns its 12 months, each equal to a single-day run', () => {
  const r = runClimate({ grid, planet, season: ANNUAL });
  assert.equal(r.months.length, 12);
  for (const m of [r.months[0], r.months[6]]) {
    const full = resultFromProfile(m, grid.width);
    const direct = runClimate({ grid, planet, season: m.season });
    for (const f of ['u', 'v', 'speed', 'pressure']) assert.deepEqual(full[f], direct[f], `${f} day ${m.season.day}`);
    assert.deepEqual(full.meta, direct.meta);
  }
});

test('72 h gives one band per hemisphere, 6 h gives seven; retrograde flips u', () => {
  assert.equal(runClimate({ grid, planet: createPlanet({ rotationHours: 72 }), season: { day: 80 } }).meta.n, 1);
  assert.equal(runClimate({ grid, planet: createPlanet({ rotationHours: 6 }), season: { day: 80 } }).meta.n, 7);
  const p = runClimate({ grid, planet, season: { day: 80 } });
  const r = runClimate({ grid, planet: createPlanet({ spin: -1 }), season: { day: 80 } });
  for (let i = 0; i < p.u.length; i += 97) {
    assert.equal(r.u[i], -p.u[i]);
    assert.equal(r.v[i], p.v[i]);
  }
});
