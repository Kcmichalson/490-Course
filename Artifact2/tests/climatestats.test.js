import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SEGMENT_DAYS, growingDays, freezingDegreeDays, curveStats, frostClass, FROST, contourSegments,
} from '../src/sim/climatestats.js';
import { thermalKey, temperatureKey } from '../src/sim/climatecache.js';
import { createPlanet } from '../src/sim/planet.js';

const fill = (v) => new Array(12).fill(v);

test('mid-month segments cover the year', () => {
  assert.equal(SEGMENT_DAYS.reduce((a, b) => a + b, 0), 365);
});

test('growing season days (≥ 5 °C): all year, none, and a half-year step', () => {
  assert.equal(growingDays(fill(10)), 365);
  assert.equal(growingDays(fill(0)), 0);
  const step = [10, 10, 10, 10, 10, 10, 0, 0, 0, 0, 0, 0];
  const expect = SEGMENT_DAYS.slice(0, 5).reduce((a, b) => a + b, 0) + SEGMENT_DAYS[5] / 2 + SEGMENT_DAYS[11] / 2;
  assert.ok(Math.abs(growingDays(step) - expect) < 1e-9);
});

test('freezing degree-days', () => {
  assert.ok(Math.abs(freezingDegreeDays(fill(-10)) - 3650) < 1e-9);
  assert.equal(freezingDegreeDays(fill(5)), 0);
  // −10 then +10 across one segment: a triangle of frost over half of it.
  const t = fill(10);
  t[0] = -10;
  const expect = (SEGMENT_DAYS[11] * 10) / 4 + (SEGMENT_DAYS[0] * 10) / 4;
  assert.ok(Math.abs(freezingDegreeDays(t) - expect) < 1e-9);
});

test('curve statistics', () => {
  const t = [-30, -25, -15, -2, 8, 15, 18, 14, 6, -5, -20, -28];
  const s = curveStats(t);
  assert.equal(s.warmest, 18);
  assert.equal(s.warmMonth, 6);
  assert.equal(s.coldest, -30);
  assert.equal(s.coldMonth, 0);
  assert.ok(Math.abs(s.mean - t.reduce((a, b) => a + b, 0) / 12) < 1e-12);
});

test('frost classes, first match wins', () => {
  assert.equal(frostClass(-1, -40, -30), FROST.ICE_CAP);
  assert.equal(frostClass(15, -40, -10), FROST.CONTINUOUS);
  assert.equal(frostClass(15, -30, -5), FROST.PERMAFROST);
  assert.equal(frostClass(20, -10, 2), FROST.SNOW_COVER);
  assert.equal(frostClass(22, 0, 10), FROST.FREQUENT);
  assert.equal(frostClass(25, 8, 15), FROST.OCCASIONAL);
  assert.equal(frostClass(28, 20, 25), FROST.FROST_FREE);
});

test('marching squares: a peak gives a closed ring; masked cells give nothing; wrap joins the seam', () => {
  const peak = Float32Array.from([0, 0, 0, 0, 10, 0, 0, 0, 0]);
  const seg = contourSegments(peak, 3, 3, 5);
  assert.equal(seg.length, 4 * 4, 'four segments around the peak');
  for (let k = 0; k < seg.length; k += 2) {
    assert.ok(Math.abs(Math.hypot(seg[k] - 1, seg[k + 1] - 1) - 0.5) < 0.2, 'ring around the center');
  }
  const masked = Float32Array.from([0, NaN, 0, 0, 10, 0, 0, 0, 0]);
  assert.ok(contourSegments(masked, 3, 3, 5).length < seg.length);
  // A field high only in the last column: with wrap the seam square crosses too.
  const edge = Float32Array.from([0, 0, 10, 0, 0, 10]);
  assert.equal(contourSegments(edge, 3, 2, 5, false).length, 4);
  assert.equal(contourSegments(edge, 3, 2, 5, true).length, 8);
});

test('continentality key: land layout, radius, and wrap matter; the season does not', () => {
  const grid = { width: 64, height: 32, latTop: 90, latBottom: -90, lonSpan: 360, wraps: true, radiusKm: 6371 };
  const planet = createPlanet();
  const k = thermalKey(grid, planet, 1);
  assert.notEqual(k, thermalKey(grid, planet, 2));
  assert.notEqual(k, thermalKey({ ...grid, radiusKm: 3390 }, planet, 1));
  assert.notEqual(k, thermalKey({ ...grid, wraps: false }, planet, 1));
  assert.notEqual(k, thermalKey(grid, createPlanet({ tiltDeg: 10 }), 1));
  assert.ok(temperatureKey(grid, planet, { day: 80 }, 1, 5).startsWith(k));
  assert.notEqual(temperatureKey(grid, planet, { day: 80 }, 1, 5), temperatureKey(grid, planet, { day: 81 }, 1, 5));
  assert.notEqual(temperatureKey(grid, planet, { day: 80 }, 1, 5), temperatureKey(grid, planet, { day: 80 }, 1, 6));
});
