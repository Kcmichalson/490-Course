// Regression (Session 7): at the class demo, the live site showed the base
// wind (1.00) over land with no Summer/Winter line, and strokes didn't
// change the arrows. The cause was stale cached worker code (confirmed in an
// incognito window), not main.js, but these tests pin the path: a wind-only
// view sends the terrain, so land gets friction, and a stroke's sim rebuild
// changes the request and the wind.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { climateRequestFor } from '../src/sim/climatecache.js';
import { runClimate } from '../src/sim/pipeline.js';
import { createPlanet } from '../src/sim/planet.js';
import { createMapConfig, simGridSize } from '../src/sim/mapconfig.js';
import { blankTerrain, CATEGORY } from '../src/sim/terrain.js';
import { createEdits, writableTerrain } from '../src/sim/edits.js';
import { applyDab } from '../src/sim/brushes.js';
import { downsampleTerrain, downsampleRegion, cloneSim } from '../src/sim/downsample.js';
import { liveState } from '../src/sim/mapstate.js';
import { simSurfaceElevation } from '../src/sim/temperature.js';
import { LAND_FRICTION } from '../src/sim/constants.js';

const planet = createPlanet();
const season = { day: 15 }; // January: westerlies at 45°N
const WIND_ONLY = { wind: true, temperature: false }; // e.g. Physical + Wind Arrows, tooltip off

// A 360×180 blank map (1° pixels and 1° sim cells), as main.js holds it.
function blankMap() {
  const map = createMapConfig({ sourceWidth: 360, sourceHeight: 180 });
  const base = blankTerrain(360, 180);
  const live = liveState({ map, source: null, base, baseSim: downsampleTerrain(base, map), edits: createEdits(360, 180) });
  live.terrain = writableTerrain(live.terrain, base);
  live.sim = cloneSim(live.sim);
  const grid = { ...simGridSize(map), latTop: map.latTop, latBottom: map.latBottom, lonSpan: map.lonSpan, wraps: map.wraps, radiusKm: map.radiusKm };
  return { map, base, live, grid };
}

// What ensureClimate sends: the terrain only when the request says so.
const run = (req, sim) => runClimate({
  grid: req.grid, planet: req.planet, season: req.season,
  terrain: req.temp ? { category: sim.category.slice(), elevation: simSurfaceElevation(sim) } : null,
});

// Paints a Draw Land blob centered on 0°E 44.5°N and rebuilds its sim cells,
// as a stroke's end does (rebuildSim).
function drawLand({ base, live, map }) {
  const rects = applyDab({ base, edits: live.edits, terrain: live.terrain, wraps: map.wraps }, 'draw-land', 180.5, 45.5, { radius: 15 });
  for (const r of rects) downsampleRegion(live.terrain, map, live.sim, r);
}
const CELL = 45 * 360 + 180; // the blob's center cell (0.5°E, 44.5°N)

test('a wind-only view sends the terrain; over land the speed is friction-reduced', () => {
  const m = blankMap();
  drawLand(m);
  assert.equal(m.live.sim.category[CELL], CATEGORY.LAND);
  const req = climateRequestFor(m.grid, planet, season, WIND_ONLY, 1, 1);
  assert.equal(req.temp, true, 'wind-only views need the terrain (M4b)');
  const withLand = run(req, m.live.sim);
  const ocean = run(req, blankMap().live.sim);
  assert.ok(ocean.speed[CELL] > 0.1, `a real wind there (${ocean.speed[CELL]})`);
  assert.ok(Math.abs(withLand.speed[CELL] / ocean.speed[CELL] - LAND_FRICTION) < 1e-5,
    `speed ${withLand.speed[CELL]} vs ${LAND_FRICTION} × ${ocean.speed[CELL]}`);
  // With no climate view at all, nothing needs the terrain.
  assert.equal(climateRequestFor(m.grid, planet, season, { wind: false, temperature: false }, 1, 1).temp, false);
});

test('a Draw Land stroke changes the request and the wind after it ends', () => {
  const m = blankMap();
  const before = climateRequestFor(m.grid, planet, season, WIND_ONLY, 1, 1);
  const windBefore = run(before, m.live.sim);
  drawLand(m);
  // rebuildSim: every rebuild bumps simVersion; a category change bumps landVersion.
  const after = climateRequestFor(m.grid, planet, season, WIND_ONLY, 2, 2);
  assert.notEqual(after.key, before.key, 'a new climate job runs');
  assert.notEqual(after.thermalKey, before.thermalKey, 'and the tracer reruns');
  const windAfter = run(after, m.live.sim);
  assert.ok(Math.abs(windAfter.speed[CELL] - LAND_FRICTION * windBefore.speed[CELL]) < 1e-5,
    `speed ${windBefore.speed[CELL]} → ${windAfter.speed[CELL]}`);
  // An elevation-only stroke (Raise) bumps only simVersion: still a new key.
  const raised = climateRequestFor(m.grid, planet, season, WIND_ONLY, 2, 3);
  assert.notEqual(raised.key, after.key);
  assert.notEqual(raised.thermalKey, after.thermalKey, 'elevations steer the final wind the tracer follows');
});

test('main.js builds its request through climateRequestFor and sends the terrain when asked', async () => {
  const src = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(src, /climateRequestFor\(climateGrid\(state\.map\)/);
  assert.match(src, /wind: windViewShown\(\)/);
  assert.match(src, /if \(req\.temp\) \{\s*const terrain = \{ category: store\.sim\.category/);
});

// M5 (Session 8): a precipitation mode asks for step 7 under its own key
// (so a temperature-only result is never taken for one with rain); the
// 12-month set shares the thermal key; other views are unchanged.
test('a precipitation view adds step 7 under its own key; other views are unchanged', () => {
  const m = blankMap();
  const temp = climateRequestFor(m.grid, planet, season, { wind: false, temperature: true }, 1, 1);
  const precip = climateRequestFor(m.grid, planet, season, { wind: false, temperature: true, precipitation: true }, 1, 1);
  assert.equal(temp.precip, undefined);
  assert.equal(precip.precip, true);
  assert.equal(precip.temp, true);
  assert.equal(precip.key, `${temp.key}|precip`);
  assert.equal(precip.hydroKey, temp.thermalKey);
  const onlyPrecip = climateRequestFor(m.grid, planet, season, { wind: false, temperature: false, precipitation: true }, 1, 1);
  assert.equal(onlyPrecip.temp, true, 'precipitation sends the terrain');
  const stroke = climateRequestFor(m.grid, planet, season, { wind: false, temperature: true, precipitation: true }, 1, 2);
  assert.notEqual(stroke.hydroKey, precip.hydroKey, 'a stroke reruns the 12 months');
});
