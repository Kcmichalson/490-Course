import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createPlanet, DEFAULT_PLANET, cellsPerHemisphere, angleLimits, declination, itczLatitude, annualItcz,
  latEff, latFromEff, dayLength, dayLengthText, MONTH_MID_DAYS, createSeason, seasonKey, seasonPreset, ANNUAL,
} from '../src/sim/planet.js';

const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ''} expected ${b} ± ${eps}, got ${a}`);

test('cells per hemisphere at and around each threshold (8, 14, 40 h)', () => {
  const cases = [
    [4, 7], [6, 7], [7.99, 7], [8, 5], [8.01, 5], [13.99, 5], [14, 3], [14.01, 3],
    [24, 3], [39.99, 3], [40, 3], [40.01, 1], [72, 1], [240, 1],
  ];
  for (const [h, n] of cases) assert.equal(cellsPerHemisphere(h), n, `${h} h`);
});

test('declination at the solstices and equinoxes', () => {
  const tilt = 23.5;
  near(declination(80, tilt), 0, 1e-9, 'day 80');
  near(declination(172, tilt), tilt, 0.01, 'day 172');
  near(declination(355, tilt), -tilt, 0.01, 'day 355');
  // The formula's zero is at day 262.5, so the calendar autumn equinox
  // preset (day 266) sits at about −1.4° (SPEC 3).
  near(declination(266, tilt), -1.41, 0.05, 'day 266');
  assert.ok(Math.abs(declination(266, tilt)) < 1.5);
  near(declination(172, 0), 0, 1e-12, 'no tilt');
});

test('ITCZ: north at the northern summer solstice, south in southern summer, 0 at the equinox', () => {
  const tilt = 23.5;
  const n = itczLatitude(declination(172, tilt));
  assert.ok(n > 0, 'north of the equator on day 172');
  near(n, 0.5 * tilt, 0.01);
  assert.ok(itczLatitude(declination(355, tilt)) < 0);
  near(itczLatitude(declination(80, tilt)), 0, 1e-9);
  near(annualItcz(tilt), 0, 0.5, 'annual mean ITCZ');
});

test('latEff keeps the poles fixed, maps the ITCZ to 0, and inverts', () => {
  for (const itcz of [-11.75, -5, 0, 5, 11.75, 22.5]) {
    near(latEff(90, itcz), 90, 1e-9, `N pole @${itcz}`);
    near(latEff(-90, itcz), -90, 1e-9, `S pole @${itcz}`);
    near(latEff(itcz, itcz), 0, 1e-9, `ITCZ @${itcz}`);
    let prev = -Infinity;
    for (let lat = -90; lat <= 90; lat += 0.5) {
      const e = latEff(lat, itcz);
      assert.ok(e > prev, 'monotonic');
      prev = e;
      near(latFromEff(e, itcz), lat, 1e-9, 'inverse');
    }
    // Continuous at the ITCZ
    near(latEff(itcz - 1e-9, itcz), latEff(itcz + 1e-9, itcz), 1e-6, 'continuous');
  }
});

test('angle limits hit the anchors, are monotonic, and clamp', () => {
  assert.deepEqual(angleLimits(24), { min: 15, max: 75 });
  assert.deepEqual(angleLimits(40), { min: 50, max: 85 });
  assert.deepEqual(angleLimits(4), { min: 5, max: 45 });
  assert.deepEqual(angleLimits(240), { min: 50, max: 85 }, 'every 1-cell planet gets 50°–85°');
  assert.deepEqual(angleLimits(41), { min: 50, max: 85 });
  let prev = angleLimits(4);
  for (let h = 4.5; h <= 60; h += 0.5) {
    const l = angleLimits(h);
    assert.ok(l.min >= prev.min && l.max >= prev.max, `monotonic at ${h}`);
    assert.ok(l.min < l.max);
    prev = l;
  }
});

test('day length: equator ~12 h at 24 h rotation, polar day and night', () => {
  const tilt = 23.5;
  for (const day of [0, 80, 172, 266, 355]) near(dayLength(0, declination(day, tilt), 24).hours, 12, 1e-9, `equator day ${day}`);
  for (let lat = -85; lat <= 85; lat += 5) near(dayLength(lat, declination(80, tilt), 24).hours, 12, 1e-9, `equinox ${lat}`);
  const summer = dayLength(80, declination(172, tilt), 24);
  assert.equal(summer.polar, 'day');
  assert.equal(summer.hours, 24);
  const winter = dayLength(80, declination(355, tilt), 24);
  assert.equal(winter.polar, 'night');
  assert.equal(winter.hours, 0);
  // Southern mirror
  assert.equal(dayLength(-80, declination(355, tilt), 24).polar, 'day');
  assert.equal(dayLength(-80, declination(172, tilt), 24).polar, 'night');
  near(dayLength(45, declination(172, tilt), 24).hours, 24 - dayLength(-45, declination(172, tilt), 24).hours, 1e-9);
  // Rotation scales it; no tilt = equal day and night everywhere
  near(dayLength(0, declination(172, tilt), 10).hours, 5, 1e-9, '10 h rotation');
  for (let lat = -85; lat <= 85; lat += 5) near(dayLength(lat, declination(172, 0), 24).hours, 12, 1e-9, 'tilt 0');
  // Longer days in summer at mid-latitudes
  assert.ok(dayLength(50, declination(172, tilt), 24).hours > 15);
});

test('day length text: polar day reports the rotation period', () => {
  const p10 = createPlanet({ rotationHours: 10 });
  assert.equal(dayLengthText(85, p10, { day: 172 }), 'Polar day (10.0 h)');
  assert.equal(dayLengthText(85, createPlanet(), { day: 172 }), 'Polar day (24.0 h)');
  assert.equal(dayLengthText(85, createPlanet(), { day: 355 }), 'Polar night');
  assert.equal(dayLengthText(0, createPlanet(), { day: 172 }), 'Day length 12.0 h');
  assert.match(dayLengthText(50, createPlanet(), ANNUAL), /^Day length \d+\.\d h–\d+\.\d h over the year$/);
});

test('planet: defaults, clamping, spin', () => {
  assert.deepEqual({ ...createPlanet() }, { ...DEFAULT_PLANET });
  const p = createPlanet({ rotationHours: 1000, tiltDeg: -5, lunarPull: 'x', spin: -1 });
  assert.equal(p.rotationHours, 240);
  assert.equal(p.tiltDeg, 0);
  assert.equal(p.lunarPull, 1);
  assert.equal(p.spin, -1);
  assert.equal(createPlanet({ spin: 'retro' }).spin, 1);
  assert.ok(Object.isFrozen(p));
});

test('seasons: mid-month days, keys, presets', () => {
  assert.equal(MONTH_MID_DAYS.length, 12);
  assert.equal(MONTH_MID_DAYS[0], 15);
  assert.equal(MONTH_MID_DAYS[11], 349);
  assert.equal(createSeason({ day: 400 }).day, 364);
  assert.equal(createSeason(null), ANNUAL);
  assert.equal(seasonKey(ANNUAL), 'annual');
  assert.equal(seasonKey({ day: 172 }), 'd172');
  assert.equal(seasonPreset({ day: 172 }).id, 'nh-summer');
  assert.equal(seasonPreset({ day: 100 }), null);
});
