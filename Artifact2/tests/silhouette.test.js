import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasTransparency, detectSilhouetteMode, silhouetteMask, guessImageKind, describeGuess } from '../src/sim/silhouette.js';
import { makeTerrain, isLand, landMask, CATEGORY, blankTerrain } from '../src/sim/terrain.js';

const rgba = (pixels) => Uint8ClampedArray.from(pixels.flat());

test('threshold mode: white land on black, invert flips it', () => {
  const img = rgba([[0, 0, 0, 255], [255, 255, 255, 255], [200, 200, 200, 255], [100, 100, 100, 255]]);
  assert.equal(detectSilhouetteMode(img), 'threshold');
  assert.deepEqual([...silhouetteMask(img, { mode: 'threshold', threshold: 128 })], [0, 1, 1, 0]);
  assert.deepEqual([...silhouetteMask(img, { mode: 'threshold', threshold: 128, invert: true })], [1, 0, 0, 1]);
});

test('alpha mode: opaque = land, transparent = ocean', () => {
  const img = rgba([[10, 10, 10, 255], [10, 10, 10, 0], [10, 10, 10, 200]]);
  assert.ok(hasTransparency(img));
  assert.equal(detectSilhouetteMode(img), 'alpha');
  assert.deepEqual([...silhouetteMask(img, { mode: 'alpha', threshold: 128 })], [1, 0, 1]);
});

test('guessImageKind: two-level opaque image → silhouette; gray ramp → heightmap; color flagged', () => {
  const bw = rgba(Array.from({ length: 100 }, (_, i) => (i % 3 ? [0, 0, 0, 255] : [255, 255, 255, 255])));
  assert.equal(guessImageKind(bw).kind, 'silhouette');
  const ramp = rgba(Array.from({ length: 256 }, (_, i) => [i, i, i, 255]));
  assert.equal(guessImageKind(ramp).kind, 'heightmap');
  const color = rgba(Array.from({ length: 100 }, () => [200, 40, 40, 255]));
  assert.equal(guessImageKind(color).isColor, true);
  // A downscaled black/white map has soft in-between grays along coasts: still a silhouette.
  const soft = rgba(Array.from({ length: 1000 }, (_, i) => (i < 10 ? [i * 25, i * 25, i * 25, 255] : i % 3 ? [0, 0, 0, 255] : [255, 255, 255, 255])));
  assert.equal(guessImageKind(soft).kind, 'silhouette');
});

// A two-tone map shrunk for the preview: black ocean, white land, and a band of
// blended grays along every coastline (about 2% of pixels, ~200 distinct grays).
function blendedTwoTone() {
  const W = 200, H = 100;
  const px = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d = x - 100; // coastline at x = 100
    let v = d < -1 ? 0 : d > 1 ? 255 : Math.round(((d + 2) / 4) * 255);
    if (Math.abs(d) <= 1) v = (v + y * 2) % 256; // vary the blend so many grays appear
    px.push([v, v, v, 255]);
  }
  return rgba(px);
}

test('two-tone image with blended edges: guessed AND described as a silhouette', () => {
  const guess = guessImageKind(blendedTwoTone());
  assert.ok(guess.levelCount > 2, 'blending created extra gray levels');
  assert.equal(guess.kind, 'silhouette');
  const note = describeGuess(guess);
  assert.match(note, /two tones \(\d+% of pixels\): looks like a silhouette/);
  assert.doesNotMatch(note, /heightmap/);
});

test('the note always names the same type as the guess', () => {
  const ramp = rgba(Array.from({ length: 256 }, (_, i) => [i, i, i, 255]));
  const alpha = rgba([[0, 0, 0, 0], [255, 255, 255, 255]]);
  const color = rgba(Array.from({ length: 100 }, () => [200, 40, 40, 255]));
  for (const img of [ramp, alpha, color, blendedTwoTone()]) {
    const g = guessImageKind(img);
    assert.match(describeGuess(g), new RegExp(g.kind), `note for a ${g.kind} guess`);
  }
});

test('isLand: elevation > 0 now; a category layer overrides it later', () => {
  const t = makeTerrain(4, 1, Float32Array.from([-10, 0, 1, 500]));
  assert.deepEqual([0, 1, 2, 3].map((i) => isLand(t, i)), [false, false, true, true]);
  assert.deepEqual([...landMask(t)], [0, 0, 1, 1]);
  const withCategory = makeTerrain(4, 1, t.elevation, Uint8Array.from([CATEGORY.LAND, 0, 0, 0]));
  assert.equal(isLand(withCategory, 0), true, 'land below sea level once the category layer decides');
  assert.equal(isLand(withCategory, 3), false);
});

test('blank terrain is all ocean', () => {
  assert.ok(landMask(blankTerrain(8, 4)).every((v) => v === 0));
});
