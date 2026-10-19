// The edits layer and sculpt brushes (SPEC 2.1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORY, makeTerrain, isLand } from '../src/sim/terrain.js';
import {
  TILE, NO_OVERRIDE, EDIT_RELATIVE, EDIT_ABSOLUTE, createEdits, cloneEdits, composeAll, composeRect,
  writableTerrain, setPixel, touchTile, restoreTile, copyTile, editedRects, isEmptyEdits, addDirty,
} from '../src/sim/edits.js';
import { applyDab, dabRects, strokeDabs } from '../src/sim/brushes.js';
import {
  BRUSH_MAX_M, TRENCH_FLOOR_M, DRAW_LAND_M, ERASE_OCEAN_M, MIN_OCEAN_M, MIN_LAND_M,
} from '../src/sim/constants.js';

const { OCEAN, LAND, LAKE, LAND_ICE, SEA_ICE } = CATEGORY;

function terrainOf(w, h, elevFn, catFn) {
  const e = new Float32Array(w * h);
  const c = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      e[y * w + x] = elevFn(x, y);
      c[y * w + x] = catFn(x, y, e[y * w + x]);
    }
  }
  return makeTerrain(w, h, e, c);
}
const byElevation = (x, y, e) => (e > 0 ? LAND : OCEAN);

// A fresh editing context on a base terrain.
function ctxFor(base, wraps = false) {
  const edits = createEdits(base.width, base.height);
  return { base, edits, terrain: writableTerrain(composeAll(base, edits), base), wraps, journal: new Map() };
}

test('compose: no edits returns the base itself; writableTerrain copies it', () => {
  const base = terrainOf(8, 4, () => -100, byElevation);
  const edits = createEdits(8, 4);
  assert.equal(composeAll(base, edits), base);
  const w = writableTerrain(base, base);
  assert.notEqual(w.elevation, base.elevation);
  assert.deepEqual([...w.elevation], [...base.elevation]);
});

test('relative edits ride on a changed base; absolute edits win', () => {
  const base1 = terrainOf(4, 1, () => 500, byElevation);
  const edits = createEdits(4, 1);
  const t = writableTerrain(base1, base1);
  setPixel(base1, edits, t, 0, 0, 800, undefined); // relative: +300
  setPixel(base1, edits, t, 1, 0, 250, LAND); // absolute
  assert.equal(t.elevation[0], 800);
  const base2 = terrainOf(4, 1, () => 1000, byElevation); // a reload raised everything
  const re = composeAll(base2, edits);
  assert.equal(re.elevation[0], 1300, 'the +300 m amount rides on the new base');
  assert.equal(re.elevation[1], 250, 'the fixed value wins');
  assert.equal(re.elevation[2], 1000, 'unedited pixels follow the base');
});

test('relative raise of ocean becomes land; a deeper base sends it back to water', () => {
  const base1 = terrainOf(2, 1, () => -100, byElevation);
  const edits = createEdits(2, 1);
  const t = writableTerrain(base1, base1);
  setPixel(base1, edits, t, 0, 0, 200, undefined); // +300 m
  assert.equal(t.category[0], LAND, 'ocean raised above 0 m emerges as land');
  const tile = edits.tiles.get(0);
  assert.equal(tile.cat[0], NO_OVERRIDE, 'a relative brush stores no category');
  assert.equal(tile.abs[0], EDIT_RELATIVE);
  const deeper = terrainOf(2, 1, () => -1000, byElevation);
  const re = composeAll(deeper, edits);
  assert.equal(re.elevation[0], -700);
  assert.equal(re.category[0], OCEAN, 'back to water on a deeper base');
});

test('compose clamps ocean to −1 m, keeps land below sea level, ignores deltas on lakes', () => {
  const base = makeTerrain(3, 1, Float32Array.from([-100, 50, 300]), Uint8Array.from([OCEAN, LAND, LAKE]));
  const edits = createEdits(3, 1);
  const tile = touchTile(edits, 0);
  tile.abs[0] = EDIT_RELATIVE; tile.value[0] = 99.5; // ocean → −0.5 m
  tile.abs[1] = EDIT_RELATIVE; tile.value[1] = -120; // land → −70 m
  tile.abs[2] = EDIT_RELATIVE; tile.value[2] = 500; // lake: ignored
  const t = composeAll(base, edits);
  assert.equal(t.elevation[0], MIN_OCEAN_M);
  assert.equal(t.category[0], OCEAN);
  assert.equal(t.elevation[1], -70);
  assert.equal(t.category[1], LAND, 'a depression stays land');
  assert.equal(t.elevation[2], 300, 'lake surfaces ignore relative amounts');
});

test('clones are independent; tiles restore; edited rects cover the tiles', () => {
  const W = TILE + 20;
  const base = terrainOf(W, 10, () => -50, byElevation);
  const edits = createEdits(W, 10);
  const t = writableTerrain(base, base);
  const journal = new Map();
  setPixel(base, edits, t, TILE + 3, 2, 100, LAND, journal);
  assert.equal(journal.get(1), null, 'journal records that the tile did not exist');
  const copy = cloneEdits(edits);
  setPixel(base, edits, t, TILE + 4, 2, 100, LAND);
  assert.equal(copy.tiles.get(1).abs[2 * TILE + 4], 0, 'the clone did not change');
  assert.equal(edits.tiles.get(1).abs[2 * TILE + 4], EDIT_ABSOLUTE);
  assert.deepEqual(editedRects(edits), [{ x0: TILE, y0: 0, x1: W, y1: 10 }]);
  const saved = copyTile(edits.tiles.get(1));
  restoreTile(edits, 1, null);
  assert.ok(isEmptyEdits(edits));
  restoreTile(edits, 1, saved);
  saved.abs.fill(0);
  assert.equal(edits.tiles.get(1).abs[2 * TILE + 4], EDIT_ABSOLUTE, 'restore stores a copy');
  composeRect(base, edits, t, { x0: 0, y0: 0, x1: W, y1: 10 });
  assert.equal(t.elevation[2 * W + TILE + 3], 100);
});

test('dirty rects split at tile edges and merge', () => {
  const edits = createEdits(600, 300);
  const dirty = new Map();
  addDirty(edits, dirty, { x0: 250, y0: 10, x1: 260, y1: 20 });
  addDirty(edits, dirty, { x0: 200, y0: 5, x1: 210, y1: 8 });
  assert.deepEqual(dirty.get(0), { x0: 200, y0: 5, x1: 256, y1: 20 });
  assert.deepEqual(dirty.get(1), { x0: 256, y0: 10, x1: 260, y1: 20 });
});

test('dab rects clip on open maps and split at the date line on wrapping maps', () => {
  // Radius 5 at x = 2 reaches pixel 6 (center 6.5), so the rect ends at 7.
  assert.deepEqual(dabRects(100, 50, false, 2, 25, 5), [{ x0: 0, y0: 20, x1: 7, y1: 30 }]);
  assert.deepEqual(dabRects(100, 50, true, 2, 25, 5), [{ x0: 97, y0: 20, x1: 100, y1: 30 }, { x0: 0, y0: 20, x1: 7, y1: 30 }]);
  assert.deepEqual(dabRects(100, 50, true, 150, 25, 5), [{ x0: 45, y0: 20, x1: 55, y1: 30 }], 'unwrapped x from a second copy');
  const s = strokeDabs({ x: 0, y: 0 }, { x: 10, y: 0 }, 3);
  assert.deepEqual(s.points.map((p) => p.x), [3, 6, 9]);
  assert.equal(s.last.x, 9);
});

test('raise: cosine falloff, clamp at the max, no category override', () => {
  const base = terrainOf(64, 64, () => 100, byElevation);
  const ctx = ctxFor(base);
  const rects = applyDab(ctx, 'raise', 32, 32, { radius: 10, strength: 1 });
  assert.equal(rects.length, 1);
  const center = ctx.terrain.elevation[32 * 64 + 32];
  const side = ctx.terrain.elevation[32 * 64 + 38];
  assert.ok(center > side && side > 100, 'falls off from the center');
  assert.equal(ctx.terrain.elevation[32 * 64 + 50], 100, 'outside the radius is untouched');
  for (const t of ctx.edits.tiles.values()) assert.ok(t.cat.every((c) => c === NO_OVERRIDE));
  for (let k = 0; k < 100; k++) applyDab(ctx, 'raise', 32, 32, { radius: 10, strength: 1 });
  assert.equal(ctx.terrain.elevation[32 * 64 + 32], BRUSH_MAX_M);
  assert.ok(ctx.journal.has(0), 'the stroke journal saw the tile');
});

test('raise ocean above 0 makes land; lower land below 0 keeps it land; lakes are skipped', () => {
  const base = terrainOf(40, 20, (x) => (x < 20 ? -20 : 20), (x, y, e) => (x >= 30 ? LAKE : e > 0 ? LAND : OCEAN));
  const ctx = ctxFor(base);
  applyDab(ctx, 'raise', 10, 10, { radius: 4, strength: 1 });
  assert.equal(ctx.terrain.category[10 * 40 + 10], LAND);
  applyDab(ctx, 'lower', 25, 10, { radius: 4, strength: 1 });
  assert.ok(ctx.terrain.elevation[10 * 40 + 25] < 0);
  assert.equal(ctx.terrain.category[10 * 40 + 25], LAND, 'a depression');
  applyDab(ctx, 'raise', 34, 10, { radius: 4, strength: 1 });
  assert.equal(ctx.terrain.elevation[10 * 40 + 34], 20, 'lake surface unchanged');
});

test('draw land: ocean, sea ice, and lakes become land at max(current, 200 m); land untouched', () => {
  const elev = [-3000, -50, 900, 1500, 50];
  const cats = [OCEAN, SEA_ICE, LAKE, LAND, LAND];
  const base = terrainOf(5, 1, (x) => elev[x], (x) => cats[x]);
  const ctx = ctxFor(base);
  applyDab(ctx, 'draw-land', 2.5, 0.5, { radius: 3 });
  assert.deepEqual([...ctx.terrain.category], [LAND, LAND, LAND, LAND, LAND]);
  assert.deepEqual([...ctx.terrain.elevation], [DRAW_LAND_M, DRAW_LAND_M, 900, 1500, 50]);
  const tile = ctx.edits.tiles.get(0);
  assert.deepEqual([...tile.abs.slice(0, 5)], [EDIT_ABSOLUTE, EDIT_ABSOLUTE, EDIT_ABSOLUTE, 0, 0]);
});

test('erase: land, land ice, and lakes become ocean at min(current, −100 m); sea ice untouched', () => {
  const elev = [300, 1200, 400, -30, -4000];
  const cats = [LAND, LAND_ICE, LAKE, SEA_ICE, OCEAN];
  const base = terrainOf(5, 1, (x) => elev[x], (x) => cats[x]);
  const ctx = ctxFor(base);
  applyDab(ctx, 'erase', 2.5, 0.5, { radius: 3 });
  assert.deepEqual([...ctx.terrain.category], [OCEAN, OCEAN, OCEAN, SEA_ICE, OCEAN]);
  assert.deepEqual([...ctx.terrain.elevation], [ERASE_OCEAN_M, ERASE_OCEAN_M, ERASE_OCEAN_M, -30, -4000]);
});

test('carve trench: ocean and sea ice only, down to −10,000 m', () => {
  const base = terrainOf(30, 10, (x) => (x < 20 ? -4000 : 500), (x, y, e) => (x < 10 ? SEA_ICE : e > 0 ? LAND : OCEAN));
  const ctx = ctxFor(base);
  for (let k = 0; k < 20; k++) applyDab(ctx, 'carve-trench', 15, 5, { radius: 12, strength: 1 });
  assert.equal(ctx.terrain.elevation[5 * 30 + 15], TRENCH_FLOOR_M);
  assert.ok(ctx.terrain.elevation[5 * 30 + 9] < -4000, 'sea ice seafloor is carved');
  assert.equal(ctx.terrain.elevation[5 * 30 + 22], 500, 'land is skipped');
});

test('smooth: keeps the coast and land above sea level; skips lakes and leaves them out of the mean', () => {
  // Left: ocean at −2000; middle: land at 5 m; right: a lake at 800 m.
  const base = terrainOf(60, 20, (x) => (x < 20 ? -2000 : x < 40 ? 5 : 800), (x, y, e) => (x >= 40 ? LAKE : e > 0 ? LAND : OCEAN));
  const ctx = ctxFor(base);
  for (let k = 0; k < 10; k++) applyDab(ctx, 'smooth', 30, 10, { radius: 40, strength: 1 });
  for (let i = 0; i < 60 * 20; i++) {
    assert.equal(ctx.terrain.category[i], base.category[i], `category unchanged at ${i}`);
    if (base.category[i] === LAND) assert.ok(ctx.terrain.elevation[i] >= MIN_LAND_M);
    if (base.category[i] === OCEAN) assert.ok(ctx.terrain.elevation[i] <= MIN_OCEAN_M);
    if (base.category[i] === LAKE) assert.equal(ctx.terrain.elevation[i], 800);
  }
  assert.ok(ctx.terrain.elevation[10 * 60 + 39] < 50, 'shore land is not dragged up toward the lake');
  assert.ok(ctx.terrain.elevation[10 * 60 + 19] > -2000, 'ocean next to the coast shoals');
});

test('a dab across the date line edits both edges of a wrapping map', () => {
  const base = terrainOf(100, 20, () => 100, byElevation);
  const ctx = ctxFor(base, true);
  const rects = applyDab(ctx, 'raise', 1, 10, { radius: 5, strength: 1 });
  assert.equal(rects.length, 2);
  assert.ok(ctx.terrain.elevation[10 * 100 + 98] > 100, 'east edge raised');
  assert.ok(ctx.terrain.elevation[10 * 100 + 2] > 100, 'west edge raised');
  assert.ok(isLand(ctx.terrain, 10 * 100 + 98));
});

test('redraw merges overlapping dab rects into one box, keeps far-apart ones separate', async () => {
  const { mergeRects } = await import('../src/render/mapview.js');
  const a = { x0: 0, y0: 0, x1: 100, y1: 100 };
  const b = { x0: 25, y0: 0, x1: 125, y1: 100 };
  assert.deepEqual(mergeRects([a, b]), [{ x0: 0, y0: 0, x1: 125, y1: 100 }]);
  const west = { x0: 0, y0: 0, x1: 10, y1: 10 };
  const east = { x0: 990, y0: 0, x1: 1000, y1: 10 };
  assert.deepEqual(mergeRects([west, east]), [west, east], 'the two halves of a seam dab');
});

test('brush size is capped at radius 250 px (the 16 ms per-dab target)', async () => {
  const { BRUSH_MAX_RADIUS_PX } = await import('../src/sim/constants.js');
  const { BRUSH_SIZE } = await import('../src/ui/sculptpanel.js');
  assert.equal(BRUSH_MAX_RADIUS_PX, 250);
  assert.equal(BRUSH_SIZE.max, BRUSH_MAX_RADIUS_PX);
  assert.ok(BRUSH_SIZE.value <= BRUSH_SIZE.max);
});
