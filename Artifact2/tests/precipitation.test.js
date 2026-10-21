import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  precipitationDay, precipitationMonths, moistureSolve, capacity, beltFactor, descentFactor, humidityGate,
} from '../src/sim/precipitation.js';
import { finalWind } from '../src/sim/pipeline.js';
import { windProfile } from '../src/sim/wind.js';
import { createPlanet, MONTH_MID_DAYS } from '../src/sim/planet.js';
import { CATEGORY } from '../src/sim/terrain.js';

const R = 6371;
const planet = createPlanet();

// 1° cells; elevation(lon, lat) in m where land (null = ocean).
function world(landAt, { W = 360, H = 180 } = {}) {
  const grid = { width: W, height: H, latTop: 90, latBottom: -90, lonSpan: 360, wraps: true, radiusKm: R };
  const category = new Uint8Array(W * H);
  const elevation = new Float32Array(W * H);
  for (let j = 0; j < H; j++) {
    const lat = 90 - ((j + 0.5) * 180) / H;
    for (let i = 0; i < W; i++) {
      const lon = -180 + ((i + 0.5) * 360) / W;
      const e = landAt(lon, lat);
      if (e != null) { category[j * W + i] = CATEGORY.LAND; elevation[j * W + i] = e; }
    }
  }
  return { grid, terrain: { category, elevation } };
}
const cellAt = (grid, lon, lat) => Math.floor(((90 - lat) / 180) * grid.height) * grid.width + Math.floor(((lon + 180) / 360) * grid.width);
const swing = (grid, value = 0.3) => new Float32Array(grid.width * grid.height).fill(value);
const fwFor = (grid, terrain) => (day, profile) => finalWind(profile ?? windProfile(grid, planet, day), grid, terrain);

// Session 8 bug: the equatorial interior of a wide continent read exactly
// 0 mm/month. Its air arrives on the NE trades after crossing land from the
// north and warms on the way, so its relative humidity fell below the
// rain-out threshold; the threshold then stopped all rain for good (even at
// the ITCZ), and recycling had nothing to return.
test('a wide equatorial continent under the trades gets real rain deep inland (not 0)', () => {
  const { grid, terrain } = world((lon, lat) => (lon > 0 && lon < 80 && lat > -10 && lat < 40 ? 200 : null));
  const r = precipitationDay(grid, planet, terrain, swing(grid), 80, fwFor(grid, terrain));
  const coast = r.precip[cellAt(grid, 75.5, 0.5)];
  for (const lon of [60.5, 40.5, 20.5]) {
    const v = r.precip[cellAt(grid, lon, 0.5)];
    assert.ok(v > 5, `interior ${lon}°E: ${v} mm/month`);
    assert.ok(v > 0.05 * coast, `interior ${lon}°E: ${v} vs coast ${coast}`);
  }
});

// ---- Controlled worlds: the solver alone, with a given wind, temperature,
// and pressure, so one effect is tested at a time. ----

// Uniform wind (u, v), temperature T °C, and pressure index p everywhere.
function solve({ grid, terrain }, { u = 1, v = 0, T = 15, p = 0, ...opts } = {}) {
  const n = grid.width * grid.height;
  return moistureSolve(grid, {
    wind: { u: new Float32Array(grid.height).fill(u), v: new Float32Array(grid.height).fill(v) },
    temperature: new Float32Array(n).fill(T),
    pressure: new Float32Array(grid.height).fill(p),
    terrain,
  }, opts);
}
const rainAt = (r, w, lon, lat) => r.precip[cellAt(w.grid, lon, lat)];

test('rain decays inland along the wind over a flat continent', () => {
  const w = world((lon, lat) => (lon > 0 && lon < 120 && lat > 20 && lat < 70 ? 0 : null));
  const r = solve(w);
  let prev = Infinity;
  for (const lon of [0.5, 10.5, 30.5, 60.5, 90.5, 119.5]) {
    const v = rainAt(r, w, lon, 45.5);
    assert.ok(v > 0 && v < prev, `${lon}°E: ${v} (upwind ${prev})`);
    prev = v;
  }
});

// A north–south ridge at 60°E (crest in m, 6° half-width) in a westerly.
const ridgeWorld = (crest) => world((lon, lat) => {
  if (!(lon > 0 && lon < 120 && lat > 20 && lat < 70)) return null;
  return crest * Math.max(0, 1 - Math.abs(lon - 60) / 6);
});

test('a ridge: much more rain on the windward slope than on the lee', () => {
  const w = ridgeWorld(2000);
  const r = solve(w);
  for (const d of [1.5, 3.5]) {
    const windward = rainAt(r, w, 60 - d, 45.5);
    const lee = rainAt(r, w, 60 + d, 45.5);
    assert.ok(windward > 2 * lee, `${d}° from the crest: windward ${windward} vs lee ${lee}`);
  }
  const flat = solve(ridgeWorld(0));
  assert.ok(rainAt(r, w, 57.5, 45.5) > rainAt(flat, w, 57.5, 45.5), 'the climb adds rain');
});

test('descending air rains less: a lee slope vs a plateau with the same air coming in', () => {
  // The same climb to 2,000 m at 50–60°E; then a steep lee slope back to 0 m
  // over 2° (≈ 13 m/km, a mountain lee), or a plateau. (Session 8: this test
  // first used a 10° slope, ≈ 2.6 m/km, where the rule keeps ~60% of the rain
  // by design, so its "< 0.5" expectation didn't fit that geometry.)
  const inLand = (lon, lat) => lon > 0 && lon < 120 && lat > 20 && lat < 70;
  const slope = world((lon, lat) => (inLand(lon, lat) ? 2000 * Math.max(0, Math.min((lon - 50) / 10, 1 - (lon - 60) / 2, 1)) : null));
  const plateau = world((lon, lat) => (inLand(lon, lat) ? 2000 * Math.max(0, Math.min((lon - 50) / 10, 1)) : null));
  // Uniform temperature: only the descent factor differs (no lapse warming).
  // Terrain smoothing is off here (smoothKm 0), so the two maps really are the
  // same up to the crest; smoothing has its own test below (Session 8).
  const rs = solve(slope, { smoothKm: 0 });
  const rp = solve(plateau, { smoothKm: 0 });
  const crestS = rainAt(rs, slope, 58.5, 45.5);
  const crestP = rainAt(rp, plateau, 58.5, 45.5);
  assert.ok(Math.abs(crestS - crestP) < 0.02 * crestP, `same air up to the crest: ${crestS} vs ${crestP}`);
  for (const lon of [60.5, 61.5]) {
    assert.ok(rainAt(rs, slope, lon, 45.5) < 0.5 * rainAt(rp, plateau, lon, 45.5), `lee slope much drier at ${lon}°E`);
  }
  assert.ok(descentFactor(0) === 1 && descentFactor(2) > descentFactor(10) && descentFactor(10) > descentFactor(40));
});

// Session 8 (approved change a): orographic rain scales with the humidity
// ramp, so dry air lifted over a ridge rains little.
test('dry air lifted over a ridge rains little; humid air over the same ridge rains a lot', () => {
  // A 2,000 m ridge at 80°E, 6° half-width, in a westerly at 30 °C.
  // Humid: the ridge stands right at the west coast (warm sea air). Dry: the
  // land starts at 0°E and the air warms from 0 °C there to 30 °C by 70°E,
  // so its capacity rises ~8× and it arrives at the ridge with low RH.
  const ridgeAt = (lonStart) => world((lon, lat) => (lon > lonStart && lon < 120 && lat > 20 && lat < 70
    ? 2000 * Math.max(0, 1 - Math.abs(lon - 80) / 6) : null));
  const run = (w, tempAt) => {
    const { grid } = w;
    const temperature = new Float32Array(grid.width * grid.height);
    for (let k = 0; k < temperature.length; k++) temperature[k] = tempAt(-180 + (k % grid.width) + 0.5);
    return moistureSolve(grid, {
      wind: { u: new Float32Array(grid.height).fill(1), v: new Float32Array(grid.height) },
      temperature, pressure: new Float32Array(grid.height).fill(1), terrain: w.terrain,
    });
  };
  const humid = ridgeAt(73);
  const dry = ridgeAt(0);
  const rh = run(humid, () => 30);
  const rd = run(dry, (lon) => (lon < 0 || lon > 70 ? 30 : (30 * lon) / 70));
  const windwardH = rainAt(rh, humid, 77.5, 45.5);
  const windwardD = rainAt(rd, dry, 77.5, 45.5);
  assert.ok(rd.rh[cellAt(dry.grid, 70.5, 45.5)] < 0.35, `dry air before the ridge: RH ${rd.rh[cellAt(dry.grid, 70.5, 45.5)]}`);
  assert.ok(windwardD < 0.1 * windwardH, `windward rain: dry air ${windwardD} vs humid air ${windwardH}`);
});

// Session 8 (approved change b): the climb is measured on smoothed terrain,
// so rough ground with no net climb doesn't wring the air dry.
test('rough ground with no net climb keeps nearly the rain of flat ground (terrain smoothing)', () => {
  const inLand = (lon, lat) => lon > 0 && lon < 120 && lat > 20 && lat < 70;
  const flat = world((lon, lat) => (inLand(lon, lat) ? 300 : null));
  // Bumps of 0 / 600 m alternating every 1° cell: a mean of 300 m.
  const rough = world((lon, lat) => (inLand(lon, lat) ? (Math.floor(lon) % 2 === 0 ? 0 : 600) : null));
  const far = (r, w) => rainAt(r, w, 60.5, 45.5) + rainAt(r, w, 61.5, 45.5);
  const rf = far(solve(flat), flat);
  const rs = far(solve(rough), rough);
  const rn = far(solve(rough, { smoothKm: 0 }), rough);
  assert.ok(rs > 0.75 * rf, `rough (smoothed) ${rs} vs flat ${rf}`);
  assert.ok(rn < rs, `without smoothing the bumps dry the air: ${rn} vs ${rs}`);
});

test('capacity rises with temperature (~7% per °C); a warm ocean world rains more than a cold one', () => {
  assert.ok(Math.abs(capacity(21) / capacity(20) - Math.exp(0.07)) < 1e-12);
  assert.equal(capacity(0), 1);
  const ocean = world(() => null, { W: 90, H: 45 });
  const mean = (r) => r.precip.reduce((a, b) => a + b, 0) / r.precip.length;
  const warm = mean(solve(ocean, { T: 25 }));
  const cold = mean(solve(ocean, { T: 5 }));
  assert.ok(warm > 3 * cold, `warm ${warm} vs cold ${cold}`);
});

test("recycling keeps a long continent's interior from going dry", () => {
  // 8,000 km of flat land along 45°N (1° ≈ 78.6 km there): 0–102°E.
  const w = world((lon, lat) => (lon > 0 && lon < 102 && lat > 20 && lat < 70 ? 0 : null));
  const coast = (r) => rainAt(r, w, 0.5, 45.5);
  const mid = (r) => rainAt(r, w, 50.5, 45.5);
  const withR = solve(w);
  const without = solve(w, { recycle: 0 });
  assert.ok(mid(withR) > 0.2 * coast(withR), `interior ${mid(withR)} vs coast ${coast(withR)}`);
  assert.ok(mid(withR) > mid(without), `with recycling ${mid(withR)} vs without ${mid(without)}`);
});

test('pressure belts: 2× at the lows, 0.3× at the highs; the ITCZ ocean is wetter than the subtropics', () => {
  assert.ok(Math.abs(beltFactor(-1) - 2) < 1e-12 && Math.abs(beltFactor(1) - 0.3) < 1e-12);
  for (let p = -1; p < 1; p += 0.25) assert.ok(beltFactor(p) > beltFactor(p + 0.25), `monotone at ${p}`);
  assert.ok(humidityGate(0.1, -1) === 1 && humidityGate(0.1, 1) === 0, 'the humidity gate acts only in sinking air');
  // An all-ocean planet with the real winds and temperatures (equinox).
  const w = world(() => null, { W: 180, H: 90 });
  const r = precipitationDay(w.grid, planet, w.terrain, swing(w.grid, 0.15), 80, fwFor(w.grid, w.terrain));
  const zonal = (lat) => { const j = Math.floor((90 - lat) / 2); let s = 0; for (let i = 0; i < 180; i++) s += r.precip[j * 180 + i]; return s / 180; };
  assert.ok(zonal(0.5) > 2 * zonal(29.5), `ITCZ ${zonal(0.5)} vs 30°N ${zonal(29.5)}`);
  assert.ok(zonal(0.5) > 2 * zonal(-29.5), `ITCZ ${zonal(0.5)} vs 30°S ${zonal(-29.5)}`);
});

test('Annual Mean equals the mean of the 12 monthly runs', () => {
  const w = world((lon, lat) => (lon > 0 && lon < 60 && lat > -20 && lat < 50 ? 300 : null), { W: 90, H: 45 });
  const r = precipitationMonths(w.grid, planet, w.terrain, swing(w.grid), fwFor(w.grid, w.terrain));
  assert.equal(r.months.length, MONTH_MID_DAYS.length);
  let worst = 0;
  for (let k = 0; k < r.annual.length; k++) {
    let s = 0;
    for (const m of r.months) s += m[k];
    worst = Math.max(worst, Math.abs(r.annual[k] - s / 12));
  }
  assert.ok(worst < 1e-4, `max difference ${worst} mm/month`);
});

test('wrap: a ridge across the date line equals the same ridge moved half a world', () => {
  const ridge = (lonC) => (lon, lat) => {
    if (!(lat > 20 && lat < 70)) return null;
    const d = Math.abs(((lon - lonC + 540) % 360) - 180);
    return d < 30 ? 2500 * Math.max(0, 1 - d / 8) : null;
  };
  const across = world(ridge(180));
  const moved = world(ridge(0));
  // Sweeps start at column 0, so the two converge along different paths:
  // compare tight solves.
  const a = solve(across, { tolerance: 1e-7 });
  const m = solve(moved, { tolerance: 1e-7 });
  const W = across.grid.width;
  let worst = 0;
  let peak = 0;
  for (let k = 0; k < a.precip.length; k++) {
    const kb = Math.floor(k / W) * W + (((k % W) + W / 2) % W);
    worst = Math.max(worst, Math.abs(a.precip[k] - m.precip[kb]));
    peak = Math.max(peak, a.precip[k]);
  }
  assert.ok(worst < 1e-3 * peak, `max difference ${worst} (peak ${peak})`);
});

test('determinism: two runs are identical', () => {
  const w = world((lon, lat) => (lon > 0 && lon < 60 && lat > -20 && lat < 50 ? 300 + 1500 * Math.max(0, 1 - Math.abs(lon - 30) / 5) : null), { W: 180, H: 90 });
  const r1 = precipitationDay(w.grid, planet, w.terrain, swing(w.grid), 172, fwFor(w.grid, w.terrain));
  const r2 = precipitationDay(w.grid, planet, w.terrain, swing(w.grid), 172, fwFor(w.grid, w.terrain));
  assert.deepEqual(r1.precip, r2.precip);
  assert.equal(r1.sweeps, r2.sweeps);
});

test('convergence: well under 500 sweeps, and close to a tight solve', () => {
  const w = ridgeWorld(2000);
  const loose = solve(w);
  const tight = solve(w, { tolerance: 1e-7 });
  assert.ok(loose.sweeps < 500 && loose.maxChange < 0.01, `sweeps ${loose.sweeps}`);
  let peak = 0;
  let worst = 0;
  for (let k = 0; k < tight.precip.length; k++) {
    peak = Math.max(peak, tight.precip[k]);
    worst = Math.max(worst, Math.abs(loose.precip[k] - tight.precip[k]));
  }
  assert.ok(worst < 0.05 * peak, `max error ${worst} vs peak ${peak}`);
});

test('a partial map: air from beyond the edges is ocean air', () => {
  // A non-wrapping 60° map that is all land: the westerly brings ocean air in
  // from off the map, so the west edge rains and the east is drier.
  const grid = { width: 60, height: 50, latTop: 70, latBottom: 20, lonSpan: 60, wraps: false, radiusKm: R };
  const n = 60 * 50;
  const terrain = { category: new Uint8Array(n).fill(CATEGORY.LAND), elevation: new Float32Array(n) };
  const r = solve({ grid, terrain });
  const row = 25 * 60;
  assert.ok(r.precip[row] > 0, 'west edge rains');
  assert.ok(r.precip[row] > r.precip[row + 59], 'drier downwind');
});

test('painted sea ice adds no moisture', () => {
  const landAt = (lon, lat) => (lon > 0 && lon < 40 && lat > 20 && lat < 70 ? 0 : null);
  const openSea = world(landAt);
  const iced = world(landAt);
  const cat = iced.terrain.category;
  for (let k = 0; k < cat.length; k++) if (cat[k] === CATEGORY.OCEAN) cat[k] = CATEGORY.SEA_ICE;
  const a = solve(openSea);
  const b = solve(iced);
  assert.ok(rainAt(b, iced, 10.5, 45.5) < 0.5 * rainAt(a, openSea, 10.5, 45.5), 'land downwind of ice is drier');
});

test('grid independence: 1° and 0.5° grids give about the same rain', () => {
  const landAt = (lon, lat) => (lon > 0 && lon < 100 && lat > 30 && lat < 60 ? 1500 * Math.max(0, 1 - Math.abs(lon - 40) / 10) : null);
  const coarse = world(landAt);
  const fine = world(landAt, { W: 720, H: 360 });
  const rc = solve(coarse);
  const rf = solve(fine);
  for (const lon of [5, 35, 45, 80]) {
    // A 1° cell against the mean of its four 0.5° cells.
    const c = rainAt(rc, coarse, lon + 0.5, 45.5);
    let f = 0;
    for (const dx of [0.25, 0.75]) for (const dy of [0.25, 0.75]) f += rainAt(rf, fine, lon + dx, 45 + dy) / 4;
    assert.ok(Math.abs(c - f) < 0.1 * Math.max(c, f), `${lon}°E: 1° ${c} vs 0.5° ${f}`);
  }
});

test('pipeline step 7: runClimate gives the season precipitation; Annual Mean is the 12-month mean', async () => {
  const { runClimate, precipitationSteps } = await import('../src/sim/pipeline.js');
  const w = world((lon, lat) => (lon > 0 && lon < 60 && lat > -20 && lat < 50 ? 300 : null), { W: 90, H: 45 });
  const annual = runClimate({ grid: w.grid, planet, season: { annual: true }, terrain: w.terrain, precipitation: true });
  assert.equal(annual.precipitation, annual.hydro.annual);
  const day = runClimate({ grid: w.grid, planet, season: { day: 172 }, terrain: w.terrain, precipitation: true });
  const direct = precipitationDay(w.grid, planet, w.terrain, day.continentality.s, 172, fwFor(w.grid, w.terrain));
  assert.deepEqual(day.precipitation, direct.precip);
  const reused = precipitationSteps({ grid: w.grid, planet, season: { annual: true }, terrain: w.terrain, s: day.continentality.s, hydro: day.hydro });
  assert.equal(reused.hydro, day.hydro, 'a cached 12-month set is reused as is');
  const none = runClimate({ grid: w.grid, planet, season: { day: 172 }, terrain: w.terrain });
  assert.equal(none.precipitation, undefined, 'step 7 runs only when asked');
});
