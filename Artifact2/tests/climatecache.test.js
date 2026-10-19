import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClimateCache, climateKey } from '../src/sim/climatecache.js';
import { runClimate } from '../src/sim/pipeline.js';
import { createPlanet, ANNUAL } from '../src/sim/planet.js';
import { debounceCommit, latestOnly } from '../src/ui/debounce.js';

const grid = { width: 32, height: 16, latTop: 90, latBottom: -90 };
const planet = createPlanet();

test('cache keys: rotation, spin, tilt, season, and grid matter; lunar pull does not', () => {
  const k = climateKey(grid, planet, { day: 80 });
  assert.notEqual(k, climateKey(grid, createPlanet({ rotationHours: 30 }), { day: 80 }));
  assert.notEqual(k, climateKey(grid, createPlanet({ spin: -1 }), { day: 80 }));
  assert.notEqual(k, climateKey(grid, createPlanet({ tiltDeg: 10 }), { day: 80 }));
  assert.notEqual(k, climateKey(grid, planet, { day: 81 }));
  assert.notEqual(k, climateKey({ ...grid, latTop: 80 }, planet, { day: 80 }));
  assert.equal(k, climateKey(grid, createPlanet({ lunarPull: 2 }), { day: 80 }));
});

test('an Annual Mean result fills the cache with its 12 months for free', () => {
  const cache = createClimateCache();
  cache.put(grid, planet, runClimate({ grid, planet, season: ANNUAL }));
  assert.equal(cache.size, 13);
  const july = cache.get(climateKey(grid, planet, { day: 197 }));
  assert.ok(july, 'mid-July is cached');
  assert.deepEqual(july.u, runClimate({ grid, planet, season: { day: 197 } }).u);
});

test('the byte budget drops the least recently used entries first, keeping the newest', () => {
  const one = runClimate({ grid, planet, season: { day: 80 } });
  const bytes = 4 * one.u.byteLength;
  const cache = createClimateCache(bytes * 2);
  for (const day of [80, 172, 266]) cache.put(grid, planet, runClimate({ grid, planet, season: { day } }));
  assert.equal(cache.size, 2);
  assert.ok(!cache.has(climateKey(grid, planet, { day: 80 })));
  const tiny = createClimateCache(1);
  tiny.put(grid, planet, one);
  assert.equal(tiny.size, 1, 'the newest always stays');
});

test('commit debounce: several commits within the delay give one, with the last value', () => {
  let now = 0;
  const timers = new Map();
  let nextId = 1;
  const fake = {
    setTimeout: (fn, ms) => { const id = nextId++; timers.set(id, { fn, at: now + ms }); return id; },
    clearTimeout: (id) => timers.delete(id),
  };
  const advance = (ms) => {
    now += ms;
    for (const [id, t] of [...timers]) if (t.at <= now) { timers.delete(id); t.fn(); }
  };
  const calls = [];
  const commit = debounceCommit((v) => calls.push(v), 400, fake);
  for (const v of [6371, 6372, 6373, 6374]) { commit(v); advance(100); }
  assert.deepEqual(calls, []);
  advance(400);
  assert.deepEqual(calls, [6374]);
  commit(7000);
  commit.flush();
  assert.deepEqual(calls, [6374, 7000]);
});

// Regression (Session 5): browsers throw "Illegal invocation" when setTimeout
// is called as a method of another object; Node doesn't, so emulate it.
test('commit debounce calls the real timers unbound (browser rule)', async () => {
  const realSet = globalThis.setTimeout;
  const realClear = globalThis.clearTimeout;
  const strict = (f) => function (...args) {
    if (this !== undefined && this !== globalThis) throw new TypeError('Illegal invocation');
    return f(...args);
  };
  globalThis.setTimeout = strict(realSet);
  globalThis.clearTimeout = strict(realClear);
  try {
    const calls = [];
    const commit = debounceCommit((v) => calls.push(v), 5);
    commit(1);
    commit(2);
    await new Promise((r) => realSet(r, 30));
    assert.deepEqual(calls, [2]);
  } finally {
    globalThis.setTimeout = realSet;
    globalThis.clearTimeout = realClear;
  }
});

test('latestOnly: one job at a time, only the latest waiting value runs next', async () => {
  const ran = [];
  let release;
  const run = latestOnly(async (v) => { ran.push(v); await new Promise((r) => { release = r; }); });
  run(1);
  run(2);
  run(3);
  assert.deepEqual(ran, [1]);
  release();
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(ran, [1, 3], 'value 2 was replaced by 3 while 1 ran');
  release();
});
