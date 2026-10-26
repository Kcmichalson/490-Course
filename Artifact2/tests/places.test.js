// Companion chat places (step D1): reply parsing and the place display math.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePlaces, placeEllipse, placeScale } from '../src/ui/places.js';
import { createMapConfig } from '../src/sim/mapconfig.js';

const REPLY = `Paris sits in a mild river basin.

\`\`\`json
[{"name": "Paris", "lat": 48.86, "lon": 2.35, "radius_km": 100},
 {"name": "Too big", "lat": 0, "lon": 0, "radius_km": 5000}]
\`\`\`

More text after.`;

test('parsePlaces: places, text without the JSON, radius kept but flagged', () => {
  const { text, places, error } = parsePlaces(REPLY);
  assert.equal(error, null);
  assert.equal(text, 'Paris sits in a mild river basin.\n\nMore text after.');
  assert.deepEqual(places[0], { name: 'Paris', lat: 48.86, lon: 2.35, radius_km: 100, issues: [] });
  assert.equal(places[1].radius_km, 1000);
  assert.deepEqual(places[1].issues, ['radius_km must be 25–1,000']);
});

test('parsePlaces: no block, a broken block, a place without a position', () => {
  assert.deepEqual(parsePlaces('Just words.'), { text: 'Just words.', places: [], error: null });
  assert.match(parsePlaces('```json\n[{"name": "x",,}]\n```').error, /doesn't parse/);
  const r = parsePlaces('```json\n[{"name": "x", "lat": "north"}, {"lat": 10, "lon": 20, "radius_km": 50}]\n```');
  assert.match(r.error, /no usable lat\/lon/);
  assert.deepEqual(r.places, [{ name: 'Unnamed place', lat: 10, lon: 20, radius_km: 50, issues: [] }]);
});

test('placeEllipse: km to source px, wider east-west away from the equator', () => {
  const map = createMapConfig({ sourceWidth: 3600, sourceHeight: 1800 }); // 10 px per degree, Earth radius
  const kmPerDeg = (2 * Math.PI * map.radiusKm) / 360; // ≈ 111.2
  const eq = placeEllipse(map, { lat: 0.05, lon: 0.05, radius_km: kmPerDeg });
  assert.ok(Math.abs(eq.ry - 10) < 1e-9);
  assert.ok(Math.abs(eq.rx - 10) < 0.001);
  assert.ok(Math.abs(eq.x - 1800.5) < 1e-6 && Math.abs(eq.y - 899.5) < 1e-6);
  const north = placeEllipse(map, { lat: 60, lon: 0, radius_km: kmPerDeg });
  assert.ok(Math.abs(north.rx - 20) < 1e-6); // 1 / cos 60° = 2
  assert.ok(Math.abs(north.ry - 10) < 1e-9);
});

test('placeScale: the circle fills about 40% of the view, within the zoom limits', () => {
  const e = { rx: 50, ry: 25 };
  assert.equal(placeScale(e, 1000, 800, { min: 0.01, max: 32 }), 4); // 0.4 · min(1000 / 100, 800 / 50)
  assert.equal(placeScale(e, 1000, 800, { min: 0.01, max: 2 }), 2);
  assert.equal(placeScale({ rx: 1e6, ry: 1e6 }, 1000, 800, { min: 0.1, max: 32 }), 0.1);
});
