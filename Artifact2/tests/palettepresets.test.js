import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// A localStorage stand-in (storage.js reads the global).
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const {
  makePreset, listPresets, savePreset, deletePreset, presetToJson, presetFromJson,
} = await import('../src/io/palettepresets.js');

const swatches = [
  { hex: '#1F4E79', category: 'deep' },
  { hex: '#5b8c3a', category: 'land', elevation: 300 },
  { hex: '#3fa7d6', category: 'lake' },
];

beforeEach(() => store.clear());

test('presets save to fcm:palettes and load back; same name replaces', () => {
  savePreset(makePreset('Earthy', { swatches, tolerance: 10, smoothing: 1 }));
  assert.ok(store.has('fcm:palettes'));
  const [p] = listPresets();
  assert.equal(p.name, 'Earthy');
  assert.equal(p.swatches[0].hex, '#1f4e79', 'hex normalized');
  assert.equal(p.swatches[2].elevation, 0, 'missing lake elevation → default surface 0 m');
  assert.equal(p.tolerance, 10);
  savePreset(makePreset('Earthy', { swatches, tolerance: 20, smoothing: 1 }));
  assert.equal(listPresets().length, 1);
  assert.equal(listPresets()[0].tolerance, 20);
  deletePreset('Earthy');
  assert.equal(listPresets().length, 0);
});

test('JSON export/import round trip keeps the format tag', () => {
  const p = makePreset('Round trip', { swatches, tolerance: 12, smoothing: 2 });
  const text = presetToJson(p);
  assert.match(text, /"format": "fcm-palette"/);
  assert.deepEqual(presetFromJson(text), p);
});

test('malformed, untagged, or wrong-version files are rejected', () => {
  assert.throws(() => presetFromJson('{ not json'), /not valid JSON/);
  const good = JSON.parse(presetToJson(makePreset('X', { swatches, tolerance: 12, smoothing: 2 })));
  const { format, ...untagged } = good;
  assert.throws(() => presetFromJson(JSON.stringify(untagged)), /fcm-palette/);
  assert.throws(() => presetFromJson(JSON.stringify({ ...good, format: 'other' })), /fcm-palette/);
  assert.throws(() => presetFromJson(JSON.stringify({ ...good, version: 2 })), /version/);
  assert.throws(() => presetFromJson(JSON.stringify({ ...good, swatches: [{ hex: 'red', category: 'land' }] })), /valid color/);
  assert.throws(() => presetFromJson(JSON.stringify({ ...good, swatches: [{ hex: '#ffffff', category: 'lava' }] })), /unknown category/);
});

test('a damaged stored entry is skipped, not fatal', () => {
  store.set('fcm:palettes', JSON.stringify([{ name: 'broken' }, JSON.parse(presetToJson(makePreset('ok', { swatches, tolerance: 12, smoothing: 2 })))]));
  assert.deepEqual(listPresets().map((p) => p.name), ['ok']);
});
