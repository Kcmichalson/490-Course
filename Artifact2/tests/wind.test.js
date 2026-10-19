import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bandWind, pressureIndex, calmFactor, bandName, circulationMeta } from '../src/sim/wind.js';
import { angleLimits } from '../src/sim/planet.js';
import { CALM_FLOOR } from '../src/sim/constants.js';

const limits = angleLimits(24);
const mid = (n, k) => (k + 0.5) * (90 / n); // center of band k (effective latitude)

test('wind direction signs in every band, both hemispheres, prograde and retrograde (n = 1, 3, 5, 7)', () => {
  for (const n of [1, 3, 5, 7]) {
    for (let k = 0; k < n; k++) {
      for (const hemi of [1, -1]) {
        for (const spin of [1, -1]) {
          const w = bandWind(hemi * mid(n, k), n, spin, limits);
          const direct = k % 2 === 0;
          const label = `n=${n} k=${k} hemi=${hemi} spin=${spin}`;
          assert.equal(w.band, k, label);
          // Direct bands blow toward the west (prograde); indirect toward the east.
          assert.equal(Math.sign(w.u), (direct ? -1 : 1) * spin, `${label} u`);
          // Direct bands blow equatorward, indirect poleward; retrograde doesn't change v.
          const poleward = Math.sign(w.v) === hemi;
          assert.equal(poleward, !direct, `${label} v`);
        }
      }
    }
  }
});

test('n = 3 named cases: NE trades, SW westerlies, NE polar easterlies; SE/NW/SE in the south', () => {
  const dirs = (eff) => {
    const w = bandWind(eff, 3, 1, limits);
    return `${w.v > 0 ? 'toN' : 'toS'}-${w.u > 0 ? 'toE' : 'toW'}`;
  };
  // A wind "from NE" blows toward the SW.
  assert.equal(dirs(15), 'toS-toW', 'NE trades');
  assert.equal(dirs(45), 'toN-toE', 'SW westerlies');
  assert.equal(dirs(75), 'toS-toW', 'NE polar easterlies');
  assert.equal(dirs(-15), 'toN-toW', 'SE trades');
  assert.equal(dirs(-45), 'toS-toE', 'NW westerlies');
  assert.equal(dirs(-75), 'toN-toW', 'SE polar easterlies');
});

test('retrograde flips east/west only', () => {
  for (const eff of [-80, -45, -10, 10, 45, 80]) {
    const p = bandWind(eff, 3, 1, limits);
    const r = bandWind(eff, 3, -1, limits);
    assert.ok(Math.abs(p.u + r.u) < 1e-12 && Math.abs(p.v - r.v) < 1e-12 && p.speed === r.speed, `${eff}`);
  }
});

test('angle runs from min near the band side the air enters to max where it leaves high pressure', () => {
  // Trades just equatorward of 30° (just left the subtropical high): mostly north-south.
  const nearHigh = bandWind(29, 3, 1, limits);
  const nearItcz = bandWind(1, 3, 1, limits);
  assert.ok(Math.abs(nearHigh.v) / Math.abs(nearHigh.u) > Math.abs(nearItcz.v) / Math.abs(nearItcz.u));
});

test('calm at band edges: floor at the edges, full in the band core', () => {
  assert.ok(Math.abs(calmFactor(0) - CALM_FLOOR) < 1e-12);
  assert.ok(Math.abs(calmFactor(1) - CALM_FLOOR) < 1e-12);
  assert.equal(calmFactor(0.5), 1);
  assert.equal(calmFactor(0.3), 1);
  assert.ok(calmFactor(0.1) > CALM_FLOOR && calmFactor(0.1) < 1);
  // Doldrums and horse latitudes are calmer than the trade-wind core.
  const core = bandWind(15, 3, 1, limits).speed;
  assert.ok(bandWind(0.5, 3, 1, limits).speed < 0.3 * core);
  assert.ok(bandWind(29.5, 3, 1, limits).speed < 0.3 * core);
  assert.ok(bandWind(89.9, 3, 1, limits).speed < 0.3 * core, 'polar high');
});

test('pressure: low at even boundaries, high at odd ones, pole always high', () => {
  for (const n of [1, 3, 5, 7]) {
    const bw = 90 / n;
    for (let j = 0; j <= n; j++) {
      for (const hemi of [1, -1]) {
        const p = pressureIndex(hemi * j * bw, n);
        assert.ok(Math.abs(p - (j % 2 === 0 ? -1 : 1)) < 1e-9, `n=${n} j=${j}`);
      }
    }
    assert.ok(Math.abs(pressureIndex(90, n) - 1) < 1e-9, `pole high n=${n}`);
  }
});

test('band names: Earth names for 3 prograde cells, otherwise by direction', () => {
  assert.deepEqual([0, 1, 2].map((k) => bandName(k, 3, 1)), ['Trade Winds', 'Westerlies', 'Polar Easterlies']);
  assert.deepEqual([0, 1, 2].map((k) => bandName(k, 3, -1)), ['Westerlies', 'Easterlies', 'Westerlies']);
  assert.deepEqual([0, 1, 2, 3, 4].map((k) => bandName(k, 5, 1)), ['Easterlies', 'Westerlies', 'Easterlies', 'Westerlies', 'Easterlies']);
  assert.equal(bandName(0, 1, 1), 'Easterlies');
});

test('circulation meta: belts and bands land on real latitudes around a shifted ITCZ', () => {
  const m = circulationMeta(3, 1, 10);
  assert.equal(m.bands.length, 6);
  assert.equal(m.belts.length, 7); // ITCZ once, 3 per hemisphere
  const itcz = m.belts.find((b) => b.j === 0);
  assert.equal(itcz.lat, 10);
  assert.equal(itcz.kind, 'low');
  const poleN = m.belts.find((b) => b.j === 3 && b.hemi === 1);
  assert.equal(poleN.lat, 90);
  assert.equal(poleN.kind, 'high');
  const subtropN = m.belts.find((b) => b.j === 1 && b.hemi === 1);
  assert.ok(subtropN.lat > 30, 'northern subtropical high shifted north with the ITCZ');
});
