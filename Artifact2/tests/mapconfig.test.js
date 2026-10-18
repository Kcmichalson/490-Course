import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_MAP, allowedSimWidths, createMapConfig, validateMapConfig, simGridSize, squarePixelLatSpan,
} from '../src/sim/mapconfig.js';

test('allowedSimWidths', () => {
  assert.deepEqual(allowedSimWidths(300), [300]);
  assert.deepEqual(allowedSimWidths(511), [511]);
  assert.deepEqual(allowedSimWidths(512), [512]);
  assert.deepEqual(allowedSimWidths(800), [512]);
  assert.deepEqual(allowedSimWidths(2048), [512, 1024, 2048]);
  assert.deepEqual(allowedSimWidths(5632), [512, 1024, 2048]);
});

test('simGridSize follows the source aspect ratio', () => {
  assert.deepEqual(simGridSize(createMapConfig({ sourceWidth: 5632, sourceHeight: 2048 })), { width: 1024, height: 372 });
  assert.deepEqual(simGridSize(createMapConfig({ sourceWidth: 2048, sourceHeight: 1024, simWidth: 512 })), { width: 512, height: 256 });
  assert.deepEqual(simGridSize(createMapConfig({ sourceWidth: 8192, sourceHeight: 16, simWidth: 2048 })), { width: 2048, height: 4 });
  assert.equal(simGridSize({ sourceWidth: 8192, sourceHeight: 1, simWidth: 512 }).height, 1);
});

test('createMapConfig defaults, freezing, and coercions', () => {
  const cfg = createMapConfig();
  assert.deepEqual({ ...cfg }, { ...DEFAULT_MAP });
  assert.ok(Object.isFrozen(cfg));

  const small = createMapConfig({ sourceWidth: 300, sourceHeight: 150 });
  assert.equal(small.simWidth, 300, 'sim width equals source width below 512 px');

  assert.equal(createMapConfig({ sourceWidth: 800, sourceHeight: 400, simWidth: 2048 }).simWidth, 512);
  assert.equal(createMapConfig({ lonSpan: 90, wraps: true }).wraps, false, 'partial span cannot wrap');
  assert.equal(createMapConfig({ sourceWidth: '4096', sourceHeight: '2048' }).sourceWidth, 4096);
});

test('createMapConfig throws on invalid latitudes', () => {
  assert.throws(() => createMapConfig({ latTop: -10, latBottom: 10 }));
  assert.throws(() => createMapConfig({ latTop: 95 }));
});

test('validateMapConfig rejections', () => {
  const ok = { ...DEFAULT_MAP };
  assert.deepEqual(validateMapConfig(ok), []);
  const cases = [
    { latTop: 10, latBottom: 10 },
    { latTop: 0, latBottom: 20 },
    { sourceWidth: 8193 },
    { sourceHeight: 4097 },
    { sourceWidth: 15 },
    { sourceWidth: 2048.5 },
    { lonSpan: 0 },
    { lonSpan: 361 },
    { lonSpan: 180, wraps: true },
    { sourceWidth: 800, simWidth: 1024 },
    { sourceWidth: 300, simWidth: 512 },
    { latTop: Number.NaN },
  ];
  for (const patch of cases) {
    assert.ok(validateMapConfig({ ...ok, ...patch }).length > 0, `should reject ${JSON.stringify(patch)}`);
  }
  assert.deepEqual(validateMapConfig({ ...ok, sourceWidth: 300, simWidth: 300 }), []);
  assert.deepEqual(validateMapConfig({ ...ok, lonSpan: 180, wraps: false }), []);
});

test('squarePixelLatSpan', () => {
  assert.ok(Math.abs(squarePixelLatSpan(5632, 2048, 360) - 130.909) < 0.001);
  assert.equal(squarePixelLatSpan(2048, 1024, 360), 180);
});
