// Export climate summary (Artifact 3): the JSON shape tools/companion.py
// reads, its rounding, and the file name.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { tileSummary, summaryFileName, SUMMARY_FORMAT } from '../src/io/tilesummary.js';

const FIELDS = {
  lat: 48.8612, lon: 2.3456, elevationM: 20.4, category: 'Land', koppenCode: 'Dfb', koppenName: 'warm-summer humid continental',
  temps: [-0.54, 1.1, 4.5, 8.7, 12.6, 15.1, 15.44, 13.5, 9.9, 5.6, 1.8, -0.2],
  rain: [55.5, 53.6, 51.7, 49.4, 50.3, 30.5, 56.3, 71.2, 81.2, 83.4, 74.6, 62.34],
  wind: { fromDeg: 232, compass: 'SW', speed: 0.5912, season: 'Annual Mean' },
  coastKm: 126.4,
};

test('summary rounds the values and derives warmest, coldest, mean, annual', () => {
  const s = tileSummary(FIELDS);
  assert.equal(s.format, SUMMARY_FORMAT);
  assert.equal(s.lat, 48.86);
  assert.equal(s.lon, 2.35);
  assert.equal(s.elevation_m, 20);
  assert.deepEqual(s.koppen, { code: 'Dfb', name: 'warm-summer humid continental' });
  assert.equal(s.months.length, 12);
  assert.equal(s.temperature_c.monthly.length, 12);
  assert.equal(s.temperature_c.monthly[0], -0.5);
  assert.equal(s.temperature_c.warmest, 15.4);
  assert.equal(s.temperature_c.coldest, -0.5);
  assert.equal(s.temperature_c.annual_mean, 7.3);
  assert.equal(s.precipitation_mm.monthly.length, 12);
  assert.equal(s.precipitation_mm.annual, 720);
  assert.deepEqual(s.wind, { from_deg: 232, from_compass: 'SW', speed: 0.59, season: 'Annual Mean' });
  assert.equal(s.distance_to_coast_km, 126);
});

test('summary holds only the tile: small, flat numbers, no map layers', () => {
  const s = tileSummary(FIELDS);
  const text = JSON.stringify(s);
  assert.ok(text.length < 2000, `${text.length} chars`);
  const arrays = [];
  JSON.stringify(s, (k, v) => { if (Array.isArray(v)) arrays.push(v.length); return v; });
  assert.ok(arrays.every((n) => n === 12), `array lengths ${arrays}`);
});

test('calm Annual Mean wind and missing wind', () => {
  assert.deepEqual(tileSummary({ ...FIELDS, wind: { variable: true, meanSpeed: 0.123, season: 'Annual Mean' } }).wind,
    { variable: true, mean_speed: 0.12, season: 'Annual Mean' });
  assert.equal(tileSummary({ ...FIELDS, wind: null }).wind, null);
});

test('no −0 in the JSON', () => {
  const s = tileSummary({ ...FIELDS, temps: FIELDS.temps.map((t, m) => (m === 0 ? -0.01 : t)) });
  assert.ok(Object.is(s.temperature_c.monthly[0], 0));
});

test('file name: hemispheres, two decimals, lowercase prefix', () => {
  assert.equal(summaryFileName(48.8612, 2.3456), 'fcm-tile-48.86N_2.35E.json');
  assert.equal(summaryFileName(-23.7, -133.9), 'fcm-tile-23.70S_133.90W.json');
  assert.equal(summaryFileName(-0.001, -0.001), 'fcm-tile-0.00N_0.00E.json');
});

test('the committed example matches the format companion.py checks', async () => {
  const s = JSON.parse(await readFile(new URL('../tools/examples/fcm-tile-48.86N_2.35E.json', import.meta.url), 'utf8'));
  assert.equal(s.format, SUMMARY_FORMAT);
  assert.deepEqual(Object.keys(s), Object.keys(tileSummary(FIELDS)));
});
