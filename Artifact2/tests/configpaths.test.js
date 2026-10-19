// Regression (Session 5, M3 checklist): the Import, Map Settings, and New Map
// dialogs validated their own field values, which had no planet radius, so
// every one showed "Planet radius must be from 1000 to 20000 km" and stayed
// disabled. Each path now adds the current map's radius through one helper.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createMapConfig, validateMapConfig, extentValues, newMapValues, newMapConfig, importConfig, settingsConfig,
} from '../src/sim/mapconfig.js';

// What the extent fields hold (no radius: the Planet panel owns it).
const fieldsOf = (m) => ({ latTop: m.latTop, latBottom: m.latBottom, lonWest: m.lonWest, lonSpan: m.lonSpan, wraps: m.wraps, simWidth: m.simWidth });
// A saved import extent (fcm:importExtent) as the Import dialog stores it.
const savedImportExtent = { latTop: 80, latBottom: -60, lonWest: -180, lonSpan: 360, wraps: true, simWidth: 1024 };

for (const radiusKm of [6371, 3390]) {
  const current = createMapConfig({ sourceWidth: 2048, sourceHeight: 1024, radiusKm });

  test(`New Map gives a valid config on the same planet (radius ${radiusKm})`, () => {
    const fields = { sourceWidth: 5632, sourceHeight: 2048, ...fieldsOf(current) };
    const values = newMapValues(fields, current.radiusKm);
    assert.deepEqual(validateMapConfig(values), []);
    const cfg = newMapConfig(values, current);
    assert.equal(cfg.radiusKm, radiusKm);
    assert.equal(cfg.sourceWidth, 5632);
  });

  test(`Import gives a valid config with the current radius (radius ${radiusKm})`, () => {
    const mapSize = { width: 1024, height: 512 }; // continent_map_1.png
    for (const fields of [savedImportExtent, fieldsOf(current)]) {
      const values = extentValues(fields, mapSize, current.radiusKm);
      assert.deepEqual(validateMapConfig(values), [], 'the dialog enables Import');
      const cfg = importConfig(values, mapSize, current);
      assert.equal(cfg.radiusKm, radiusKm);
      assert.deepEqual([cfg.sourceWidth, cfg.sourceHeight], [1024, 512]);
    }
  });

  test(`Map Settings gives a valid config with the current radius and size (radius ${radiusKm})`, () => {
    const values = extentValues({ ...fieldsOf(current), latTop: 70 }, { width: current.sourceWidth, height: current.sourceHeight }, current.radiusKm);
    assert.deepEqual(validateMapConfig(values), [], 'the dialog enables Apply');
    const cfg = settingsConfig(values, current);
    assert.equal(cfg.radiusKm, radiusKm);
    assert.equal(cfg.latTop, 70);
    assert.deepEqual([cfg.sourceWidth, cfg.sourceHeight], [2048, 1024]);
  });

  test(`Reload keeps the radius: same size and size-changed (radius ${radiusKm})`, () => {
    // Same size: the current map config is reused as is.
    assert.deepEqual(validateMapConfig(current), []);
    assert.equal(createMapConfig({ ...current }).radiusKm, radiusKm);
    // Size changed: the Import dialog reopens prefilled with the current map.
    const newSize = { width: 4096, height: 2048 };
    const values = extentValues(fieldsOf({ ...current }), newSize, current.radiusKm);
    assert.deepEqual(validateMapConfig(values), []);
    const cfg = importConfig(values, newSize, current);
    assert.equal(cfg.radiusKm, radiusKm);
    assert.deepEqual([cfg.sourceWidth, cfg.sourceHeight], [4096, 2048]);
  });
}

test('dialog field values without a radius fail validation (why the helpers exist)', () => {
  const raw = { sourceWidth: 1024, sourceHeight: 512, ...savedImportExtent };
  assert.match(validateMapConfig(raw).join(' '), /Planet radius must be from 1000 to 20000 km/);
});

test('the dialogs and main.js build their values through the helpers', async () => {
  const src = (f) => readFile(new URL(`../src/${f}`, import.meta.url), 'utf8');
  const extent = await src('ui/extentfields.js');
  assert.match(extent, /radiusKm = values\.radiusKm;/, 'set() keeps the radius');
  assert.match(extent, /return extentValues\(\{/, 'get() adds it');
  const newMap = await src('ui/newmapdialog.js');
  assert.match(newMap, /const read = \(\) => newMapValues\(\{/);
  assert.match(newMap, /newMapConfig\(read\(\), currentMap\)/);
  assert.doesNotMatch(newMap, /createMapConfig\(/);
  const imp = await src('ui/importdialog.js');
  assert.match(imp, /extent\.set\(\{ \.\.\.cur, \.\.\.lastExtent, radiusKm: cur\.radiusKm \}/, 'Import (and size-changed Reload) use the current radius');
  const main = await src('main.js');
  assert.match(main, /newMapConfig\(cfg, state\.map\)/);
  assert.match(main, /importConfig\(payload\.cfgValues, mapSize, state\.map\)/);
  assert.match(main, /settingsConfig\(values, state\.map\)/);
});
