// File > Load Earth Map (your Session 10 extra): the paths, the import
// prefill, the planet reset, and the single undo step.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { EARTH_MAP, EARTH_PLANET, earthPrefill } from '../src/io/earthmap.js';
import { DEFAULT_SETTINGS } from '../src/ui/importdialog.js';
import { createPlanet, DEFAULT_PLANET, ANNUAL } from '../src/sim/planet.js';
import { PLANET_RADIUS_KM } from '../src/sim/constants.js';
import { stateEntry } from '../src/sim/mapstate.js';
import { makeTerrain } from '../src/sim/terrain.js';
import { downsampleTerrain } from '../src/sim/downsample.js';
import { createEdits } from '../src/sim/edits.js';
import { createMapConfig } from '../src/sim/mapconfig.js';

const mainSrc = () => readFile(new URL('../src/main.js', import.meta.url), 'utf8');

// Same rules as Load Sample Map: relative (the site lives under
// /490-Course/Artifact2/), lowercase (Pages is case-sensitive), no leading
// underscore (Jekyll), present with that exact casing, never private.
// The one documented exception to lowercase (your decision, Session 10):
// the mask keeps its committed name, because a case-only rename on Windows
// may not register in git, and GitHub Pages is case-sensitive, so the live
// site could break. The exact-casing existence check below still applies.
const CASE_EXCEPTIONS = new Set(['gebco_bathy_BW_heightmap.png']);

test('Load Earth Map fetches relative, lowercase paths to public test maps', async () => {
  const files = await readdir(new URL('../test-maps/', import.meta.url));
  for (const path of [EARTH_MAP.image, EARTH_MAP.mask]) {
    assert.match(path, /^\.\/test-maps\/[^/]+$/, `${path}: relative, directly in test-maps/ (not private/)`);
    if (!CASE_EXCEPTIONS.has(path.split('/').pop())) assert.equal(path, path.toLowerCase());
    const name = path.split('/').pop();
    assert.ok(!name.startsWith('_'));
    assert.ok(files.includes(name), `${name} exists with this exact casing`);
  }
  assert.equal(EARTH_MAP.image, './test-maps/gebco_bathy_heightmap.jpg');
  assert.equal(EARTH_MAP.mask, './test-maps/gebco_bathy_BW_heightmap.png');
});

test('the prefill: the M6a checklist settings over the dialog defaults', () => {
  const p = earthPrefill(DEFAULT_SETTINGS.heightmap);
  assert.equal(p.kind, 'heightmap');
  const hm = p.storedSettings.heightmap;
  assert.equal(hm.seaLevel, 128, 'Auto off, 128');
  assert.equal(hm.maxHeight, 5000);
  for (const k of ['highest', 'gamma', 'depthMode', 'maxDepth', 'smoothing', 'seed']) assert.deepEqual(hm[k], DEFAULT_SETTINGS.heightmap[k], `${k} at its default`);
  assert.deepEqual(hm.mask, DEFAULT_SETTINGS.heightmap.mask, 'mask threshold and invert at their defaults');
  assert.deepEqual(p.cfgValues, { latTop: 90, latBottom: -90, lonWest: -180, lonSpan: 360, wraps: true, simWidth: 1024 });
  assert.equal(p.radiusKm, 6371);
  assert.equal(p.planetReset, true);
  // The dialog's defaults themselves are untouched.
  assert.equal(DEFAULT_SETTINGS.heightmap.seaLevel, 'auto');
});

test('the planet reset: every Planet panel setting at its Earth value', () => {
  assert.deepEqual({ ...EARTH_PLANET.planet }, { ...createPlanet() });
  assert.deepEqual({ ...EARTH_PLANET.planet }, { rotationHours: 24, spin: 1, tiltDeg: 23.5, lunarPull: 1 });
  assert.deepEqual({ ...EARTH_PLANET.planet }, { ...DEFAULT_PLANET });
  assert.equal(EARTH_PLANET.season, ANNUAL);
  assert.equal(EARTH_PLANET.radiusKm, PLANET_RADIUS_KM);
});

test('one undo step: undo hands back the old map and planet, redo the Earth ones', () => {
  const snap = (radiusKm, planet) => {
    const map = createMapConfig({ sourceWidth: 64, sourceHeight: 32, simWidth: 64, radiusKm });
    const base = makeTerrain(64, 32, new Float32Array(64 * 32).fill(-100));
    return { map, source: null, base, baseSim: downsampleTerrain(base, map), edits: createEdits(64, 32), ...(planet && { planet }) };
  };
  const oldPlanet = { planet: createPlanet({ rotationHours: 30, spin: -1, tiltDeg: 40, lunarPull: 2 }), season: { day: 172 } };
  const before = snap(8000, oldPlanet);
  const after = snap(6371, { planet: EARTH_PLANET.planet, season: EARTH_PLANET.season });
  const applied = [];
  const entry = stateEntry('Import gebco_bathy_heightmap.jpg', before, after, (s) => applied.push(s));
  entry.undo();
  entry.redo();
  assert.equal(applied.length, 2, 'one entry, one step each way');
  assert.equal(applied[0].map.radiusKm, 8000);
  assert.deepEqual(applied[0].planet, oldPlanet);
  assert.equal(applied[1].map.radiusKm, 6371);
  assert.deepEqual({ ...applied[1].planet.planet }, { rotationHours: 24, spin: 1, tiltDeg: 23.5, lunarPull: 1 });
  assert.equal(applied[1].planet.season, ANNUAL);
});

// The dialog is DOM code, so Cancel itself is in the by-eye check. What is
// checked here: opening the dialog changes no planet setting, and the reset
// lives only in the import commit (which Cancel never reaches).
test('Cancel changes nothing: only the import commit resets the planet', async () => {
  const src = await mainSrc();
  const body = (name) => {
    const start = src.indexOf(`async function ${name}(`);
    assert.ok(start >= 0, `${name} exists`);
    const end = src.slice(start).search(/\r?\n\}\r?\n/); // main.js may have CRLF line endings
    assert.ok(end > 0, `${name} ends`);
    return src.slice(start, start + end);
  };
  const load = body('loadEarthMap');
  assert.doesNotMatch(load, /setPlanet|setSeason|savePlanet|state\.planet|state\.season|commitState|importMap/, 'opening changes nothing');
  assert.match(load, /importDialog\.open\(/);
  const imp = body('importMap');
  assert.match(imp, /earth \? \{ planet: EARTH_PLANET \} : \{\}/, 'the reset rides on the import commit, only for Load Earth Map');
  assert.match(imp, /payload\.planetReset/);
  // Nothing else passes the Earth planet to a commit.
  assert.equal(src.match(/planet: EARTH_PLANET/g).length, 1);
  // The menu item sits right under Load Sample Map.
  assert.match(src, /label: 'Load Sample Map'[^\n]*\n\s*\{ label: 'Load Earth Map'/);
});
