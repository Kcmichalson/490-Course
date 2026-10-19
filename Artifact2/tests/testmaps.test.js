// Every test map in test-maps/ keeps its import-type guess (SPEC 2.3–2.5,
// D2 in the M2b log). Node has no JPEG decoder and can't reproduce the
// browser's preview downscale, so these are the guess statistics recorded
// in the browser (Session 4) from the exact decode the import dialog uses:
// createImageBitmap without color conversion, resized to ≤ 1024 px wide
// with 'high' quality. The test checks the guess rules (and the "colorful"
// thresholds in constants.js) against them. Re-record if the decode changes.
// Git-ignored files in test-maps/private/ are not included.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guessFromStats } from '../src/sim/silhouette.js';
import { COLORFUL_SHARE } from '../src/sim/constants.js';

const twoTone = { transparent: false, levelCount: 2, twoToneShare: 1, colorfulShare: 0 };
const RECORDED = {
  'gebco_bathy_heightmap.jpg': { expect: 'heightmap', stats: { transparent: false, levelCount: 194, twoToneShare: 0.07812118530273438, colorfulShare: 0 } },
  'gebco_bathy_BW_heightmap.png': { expect: 'silhouette', stats: { transparent: false, levelCount: 256, twoToneShare: 0.9856204986572266, colorfulShare: 0 } },
  'archipeligo_map_1.png': { expect: 'silhouette', stats: twoTone },
  'archipeligo_map_2.png': { expect: 'silhouette', stats: twoTone },
  'continent_map_1.png': { expect: 'silhouette', stats: twoTone },
  'continent_map_2.png': { expect: 'silhouette', stats: twoTone },
  'continent_map_3.png': { expect: 'silhouette', stats: twoTone },
  'continent_map_4.png': { expect: 'silhouette', stats: twoTone },
  'continent_map_5.png': { expect: 'silhouette', stats: twoTone },
  'palette_map_1.png': { expect: 'palette', stats: { transparent: false, levelCount: 17, twoToneShare: 0.033802032470703125, colorfulShare: 0.9325828552246094 } }, // re-recorded after the gray cloud fix
};

test('every public test map keeps its guess (the GEBCO JPG stays a heightmap)', async () => {
  const { readdir } = await import('node:fs/promises');
  const images = (await readdir(new URL('../test-maps/', import.meta.url))).filter((f) => /\.(png|jpe?g|bmp|webp|svg)$/i.test(f));
  assert.deepEqual(images.sort(), Object.keys(RECORDED).sort(), 'stats are recorded for every test map (re-record for new ones)');
  for (const [file, { expect, stats }] of Object.entries(RECORDED)) {
    assert.equal(guessFromStats(stats).kind, expect, file);
  }
});

test('JPEG chroma speckle on the GEBCO heightmap stays far below the colorful threshold', () => {
  assert.ok(RECORDED['gebco_bathy_heightmap.jpg'].stats.colorfulShare < COLORFUL_SHARE / 10);
});
