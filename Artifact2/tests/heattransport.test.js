// Heat transport and ice-albedo (SPEC 6, Climate inputs; Session 10).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { equalAreaLats, iceShare, transportProfile } from '../src/sim/heattransport.js';
import { tqTable, tqAt, dailyInsolation, radiativeTemp } from '../src/sim/temperature.js';
import { MONTH_MID_DAYS, declination } from '../src/sim/planet.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);
const annual = (lats, tilt) => tqTable(lats, tilt, MONTH_MID_DAYS);

test('Earth profile meets the targets: equator 26.3, 30° ≈ 20, 45° ≈ 10, 60° ≈ −1, pole below −15 (SPEC 17)', () => {
  const [eq, l30, l45, l60, pole] = annual([0.18, 30, 45, 60, 89.82], 23.5);
  close(eq, 26.3, 0.1, 'equator');
  close(l30, 20, 1.5, '30°');
  close(l45, 10, 0.2, '45°');
  close(l60, -1, 1, '60°');
  assert.ok(pole < -15, `pole ${pole}`);
});

test('transport only moves heat between latitudes: the global mean is the radiative mean minus the ice', () => {
  const lats = equalAreaLats(360);
  // Tilt 45°: no ice anywhere, so the global mean is exactly the radiative one.
  const insol = lats.map((lat) => MONTH_MID_DAYS.reduce((s, d) => s + dailyInsolation(lat, declination(d, 45)), 0) / 12);
  const trad = insol.map(radiativeTemp);
  const { temperature } = transportProfile(trad, insol);
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  assert.ok(temperature.every((t) => iceShare(t) === 0), 'no ice at tilt 45°');
  close(mean(temperature), mean(trad), 1e-4, 'global mean');
  // k = 1 is no transport: the radiative profile itself.
  const none = transportProfile(trad, insol, 1).temperature;
  for (let i = 0; i < 360; i += 37) close(none[i], trad[i], 1e-4, `cell ${i}`);
});

test('ice ramps in linearly from 0 °C (none) to −20 °C (full)', () => {
  assert.equal(iceShare(0), 0);
  assert.equal(iceShare(5), 0);
  close(iceShare(-10), 0.5, 1e-12, 'ice line');
  assert.equal(iceShare(-20), 1);
  assert.equal(iceShare(-30), 1);
});

test('tilt 0–45° in 1° steps: temperatures change smoothly, with no jump at the ice edge', () => {
  let prev = null;
  for (let tilt = 0; tilt <= 45; tilt++) {
    const t = annual([0.18, 45, 60, 70, 89.82], tilt);
    if (prev) {
      for (let i = 0; i < t.length; i++) assert.ok(Math.abs(t[i] - prev[i]) < 3, `tilt ${tilt}: ${prev[i]} → ${t[i]}`);
      assert.ok(t[4] > prev[4], `the pole warms as tilt grows (tilt ${tilt})`);
    }
    prev = t;
  }
});

// Your request (Session 10): the profile depends on no planet setting but
// tilt. Rotation still reaches temperatures through the continentality
// swing s (the winds), so s is held fixed here; then radius, rotation, spin,
// and lunar pull must change nothing.
test('the transport profile depends only on tilt (not radius, rotation, spin, or lunar pull)', async () => {
  const { runClimate } = await import('../src/sim/pipeline.js');
  const { createPlanet } = await import('../src/sim/planet.js');
  const { CATEGORY } = await import('../src/sim/terrain.js');
  const W = 36;
  const H = 18;
  const category = new Uint8Array(W * H);
  const elevation = new Float32Array(W * H);
  for (let k = 0; k < W * H; k++) if (k % W > 5 && k % W < 15) { category[k] = CATEGORY.LAND; elevation[k] = 300; }
  const terrain = { category, elevation };
  const grid = (radiusKm) => ({ width: W, height: H, latTop: 90, latBottom: -90, lonSpan: 360, wraps: true, radiusKm });
  const base = runClimate({ grid: grid(6371), planet: createPlanet(), season: { annual: true }, terrain });
  const fixed = base.continentality; // the same swing s for every run
  const variants = [
    ['radius 3,000 km', grid(3000), createPlanet()],
    ['rotation 8 h', grid(6371), createPlanet({ rotationHours: 8 })],
    ['rotation 72 h', grid(6371), createPlanet({ rotationHours: 72 })],
    ['retrograde spin', grid(6371), createPlanet({ spin: -1 })],
    ['lunar pull 3', grid(6371), createPlanet({ lunarPull: 3 })],
  ];
  for (const [name, g, planet] of variants) {
    for (const season of [{ annual: true }, { day: 172 }]) {
      const r = runClimate({ grid: g, planet, season, terrain, continentality: fixed });
      const ref = season.annual ? base : runClimate({ grid: grid(6371), planet: createPlanet(), season, terrain, continentality: fixed });
      assert.deepEqual([...r.temperature], [...ref.temperature], `${name}, ${season.annual ? 'Annual Mean' : 'day 172'}`);
    }
  }
  // And tilt does change it.
  const tilted = runClimate({ grid: grid(6371), planet: createPlanet({ tiltDeg: 40 }), season: { annual: true }, terrain, continentality: fixed });
  assert.notDeepEqual([...tilted.temperature], [...base.temperature]);
});

test('the seasonal swing is unchanged: only the annual mean moves', () => {
  for (const lat of [10, 45, 70]) {
    const ann = annual([lat], 23.5)[0];
    const jul = tqTable([lat], 23.5, [MONTH_MID_DAYS[6]])[0];
    const radAnn = MONTH_MID_DAYS.reduce((s, d) => s + tqAt(lat, d, 23.5), 0) / 12;
    close(jul - ann, tqAt(lat, MONTH_MID_DAYS[6], 23.5) - radAnn, 1e-3, `July anomaly at ${lat}°`);
  }
});
