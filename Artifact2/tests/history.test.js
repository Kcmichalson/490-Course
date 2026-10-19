// Undo/redo: the history stack, its memory budget and disposal, and
// whole-state / stroke entries (SPEC 2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHistory } from '../src/ui/history.js';
import { liveState, snapshotOf, stateEntry, strokeEntry, snapshotBuffers } from '../src/sim/mapstate.js';
import { createEdits, writableTerrain, composeRect } from '../src/sim/edits.js';
import { applyDab } from '../src/sim/brushes.js';
import { addDirty } from '../src/sim/edits.js';
import { downsampleTerrain, downsampleRegion } from '../src/sim/downsample.js';
import { blankTerrain, CATEGORY } from '../src/sim/terrain.js';

const MB = 1024 * 1024;
const entry = (label, bytes, log, extra = {}) => ({
  label,
  undo: () => log.push(`undo ${label}`),
  redo: () => log.push(`redo ${label}`),
  buffers: bytes ? [{ ref: { label }, bytes }] : [],
  resources: [],
  ...extra,
});

test('undo/redo order; a new push clears redo', () => {
  const log = [];
  const h = createHistory();
  h.push(entry('a', 1, log));
  h.push(entry('b', 1, log));
  assert.equal(h.undo(), true);
  assert.equal(h.undo(), true);
  assert.equal(h.undo(), false, 'nothing left to undo');
  assert.equal(h.redo(), true);
  assert.deepEqual(log, ['undo b', 'undo a', 'redo a']);
  h.push(entry('c', 1, log));
  assert.equal(h.canRedo(), false, 'redo cleared by a new action');
  assert.equal(h.undoLabel(), 'c');
});

test('budget evicts the oldest entries; the newest is always kept', () => {
  const log = [];
  const h = createHistory({ budget: 10 * MB });
  h.push(entry('a', 4 * MB, log));
  h.push(entry('b', 4 * MB, log));
  h.push(entry('c', 4 * MB, log));
  assert.deepEqual(h.size(), { undo: 2, redo: 0 }, 'a was dropped');
  h.push(entry('huge', 50 * MB, log));
  assert.deepEqual(h.size(), { undo: 1, redo: 0 }, 'an over-budget entry stays so one undo works');
  assert.equal(h.undoLabel(), 'huge');
});

test('shared buffers are counted once, so a reload next to many strokes evicts nothing', () => {
  const log = [];
  const h = createHistory({ budget: 120 * MB });
  const base1 = { id: 'base1' };
  const base2 = { id: 'base2' };
  const base3 = { id: 'base3' };
  const state = (label, before, after) => entry(label, 0, log, {
    buffers: [{ ref: before, bytes: 50 * MB }, { ref: after, bytes: 50 * MB }],
  });
  h.push(state('import', base1, base2)); // 100 MB, both sides distinct
  for (let k = 0; k < 10; k++) h.push(entry(`stroke ${k}`, MB / 4, log));
  h.push(state('reload', base2, base3)); // shares base2: only +50 MB → 152.5 MB
  // Counted per side this would be 202.5 MB. Deduped it is 152.5 MB, so
  // only the import (which alone holds base1) has to go.
  assert.deepEqual(h.size(), { undo: 11, redo: 0 }, 'all strokes and the reload survive');
  assert.equal(h.totalBytes(), 100 * MB + 10 * (MB / 4));
});

test('evicting the oldest entry never closes a bitmap a later entry or the current state uses', () => {
  const log = [];
  const disposed = [];
  const bmpA = { name: 'A', width: 1000, height: 1000 };
  const bmpB = { name: 'B', width: 1000, height: 1000 };
  const bmpC = { name: 'C', width: 1000, height: 1000 };
  let live = bmpB;
  const h = createHistory({ budget: 9 * MB, dispose: (b) => disposed.push(b.name), isLive: (b) => b === live });
  const state = (label, before, after) => entry(label, 0, log, {
    buffers: [{ ref: before, bytes: 4 * MB }, { ref: after, bytes: 4 * MB }],
    resources: [before, after],
  });
  h.push(state('import B', bmpA, bmpB)); // 8 MB
  live = bmpC;
  h.push(state('reload C', bmpB, bmpC)); // 12 MB → evict the import
  assert.deepEqual(disposed, ['A'], 'B is still used by the reload entry; A by nothing');
  live = bmpB;
  h.undo(); // back to B: C is now only in the redo entry
  h.push(entry('stroke', 1, log)); // clears redo; C is not live → closed
  assert.deepEqual(disposed, ['A', 'C']);
  assert.ok(!disposed.includes('B'), 'the current state still shows B');
});

test('whole-state undo/redo restores the map, base, and edits', () => {
  const map1 = { sourceWidth: 64, sourceHeight: 32, simWidth: 32, wraps: false, id: 1 };
  const map2 = { ...map1, id: 2 };
  const base1 = blankTerrain(64, 32);
  const base2 = blankTerrain(64, 32);
  base2.elevation.fill(-1000);
  const snap1 = { map: map1, source: null, base: base1, baseSim: downsampleTerrain(base1, map1), edits: createEdits(64, 32) };
  let live = liveState(snap1);
  // Paint on state 1.
  live.terrain = writableTerrain(live.terrain, live.base);
  applyDab({ base: live.base, edits: live.edits, terrain: live.terrain, wraps: false }, 'draw-land', 20, 16, { radius: 5 });
  const before = snapshotOf(live);
  const after = { map: map2, source: { bitmap: { width: 64, height: 32 } }, base: base2, baseSim: downsampleTerrain(base2, map2), edits: createEdits(64, 32) };
  const apply = (snap) => { live = liveState(snap); };
  const h = createHistory();
  apply(after);
  h.push(stateEntry('Import', before, after, apply));
  assert.equal(live.map.id, 2);
  assert.equal(live.terrain.elevation[16 * 64 + 20], -1000);
  h.undo();
  assert.equal(live.map.id, 1);
  assert.equal(live.base, base1);
  assert.equal(live.terrain.category[16 * 64 + 20], CATEGORY.LAND, 'the painted land is back');
  assert.ok(live.sim.landFraction.some((v) => v > 0), 'and its sim cells');
  // Changing the live edits must not change the stored snapshot.
  live.edits.tiles.clear();
  h.redo();
  h.undo();
  assert.equal(live.terrain.category[16 * 64 + 20], CATEGORY.LAND, 'the snapshot kept its own copy');
  assert.ok(snapshotBuffers(after).some((b) => b.ref === after.source.bitmap), 'bitmaps count toward the budget');
});

test('stroke undo/redo swaps only the touched tiles', () => {
  const map = { sourceWidth: 600, sourceHeight: 300, simWidth: 300, wraps: false };
  const base = blankTerrain(600, 300);
  const live = liveState({ map, source: null, base, baseSim: downsampleTerrain(base, map), edits: createEdits(600, 300) });
  live.terrain = writableTerrain(live.terrain, base);
  const journal = new Map();
  const dirty = new Map();
  for (const r of applyDab({ base, edits: live.edits, terrain: live.terrain, wraps: false, journal }, 'draw-land', 250, 100, { radius: 20 })) addDirty(live.edits, dirty, r);
  const refresh = (rects) => {
    for (const r of rects) { composeRect(base, live.edits, live.terrain, r); downsampleRegion(live.terrain, map, live.sim, r); }
  };
  const e = strokeEntry('Draw Land', live.edits, journal, dirty, { getEdits: () => live.edits, refresh });
  assert.equal(journal.size, 2, 'the dab crossed into a second tile');
  const i = 100 * 600 + 250;
  assert.equal(live.terrain.category[i], CATEGORY.LAND);
  e.undo();
  assert.equal(live.terrain.category[i], CATEGORY.OCEAN);
  assert.equal(live.edits.tiles.size, 0, 'tiles that did not exist are removed again');
  e.redo();
  assert.equal(live.terrain.category[i], CATEGORY.LAND);
});
