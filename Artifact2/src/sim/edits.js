// The edits layer (SPEC 2.1): brush edits kept separately from the imported
// terrain, at source resolution, so they can be re-applied after Reload and
// Map settings rebuild the base terrain.
//
// Stored as sparse 256 × 256 tiles. Per pixel:
//   abs:   EDIT_NONE, EDIT_RELATIVE (value = meters added to the base), or
//          EDIT_ABSOLUTE (value = the final elevation)
//   value: Float32 meters
//   cat:   a category override, or NO_OVERRIDE. Only Draw Land and Erase
//          write overrides (always together with an absolute value).
//
// Compose rule (one pixel):
//   1. c = override ?? base category
//   2. e = absolute value, or base + delta (deltas don't apply to lakes),
//      or base
//   3. ocean (OCEAN/SEA_ICE) that ends above 0 m becomes LAND: an island
//      emerges. Other ocean stays at or below MIN_OCEAN_M. Land is never
//      clamped, so land below sea level is possible.

import { CATEGORY, isOceanCategory, makeTerrain } from './terrain.js';
import { MIN_OCEAN_M } from './constants.js';

export const TILE = 256;
export const EDIT_NONE = 0;
export const EDIT_RELATIVE = 1;
export const EDIT_ABSOLUTE = 2;
export const NO_OVERRIDE = 255;

const TILE_PIXELS = TILE * TILE;
const TILE_BYTES = TILE_PIXELS * 6; // abs (1) + value (4) + cat (1)

export function createEdits(width, height) {
  return { width, height, tilesX: Math.ceil(width / TILE), tilesY: Math.ceil(height / TILE), tiles: new Map() };
}

function newTile() {
  return { abs: new Uint8Array(TILE_PIXELS), value: new Float32Array(TILE_PIXELS), cat: new Uint8Array(TILE_PIXELS).fill(NO_OVERRIDE) };
}

export function copyTile(t) {
  return t ? { abs: t.abs.slice(), value: t.value.slice(), cat: t.cat.slice() } : null;
}

export function tileKey(edits, tx, ty) {
  return ty * edits.tilesX + tx;
}

// Source-pixel rectangle of a tile, clipped to the map.
export function tileRect(edits, key) {
  const tx = key % edits.tilesX;
  const ty = Math.floor(key / edits.tilesX);
  return {
    x0: tx * TILE, y0: ty * TILE,
    x1: Math.min(edits.width, (tx + 1) * TILE), y1: Math.min(edits.height, (ty + 1) * TILE),
  };
}

export function isEmptyEdits(edits) {
  return edits.tiles.size === 0;
}

export function editsBytes(edits) {
  return edits.tiles.size * TILE_BYTES;
}

export function tileBytes(tile) {
  return tile ? TILE_BYTES : 0;
}

export function cloneEdits(edits) {
  const out = { ...edits, tiles: new Map() };
  for (const [k, t] of edits.tiles) out.tiles.set(k, copyTile(t));
  return out;
}

export function editedRects(edits) {
  return [...edits.tiles.keys()].map((k) => tileRect(edits, k));
}

// The tile for a key, created on first touch. journal (optional Map) records
// each tile's state before its first change, for undo.
export function touchTile(edits, key, journal = null) {
  let t = edits.tiles.get(key);
  if (journal && !journal.has(key)) journal.set(key, copyTile(t ?? null));
  if (!t) {
    t = newTile();
    edits.tiles.set(key, t);
  }
  return t;
}

// Puts a saved tile state back (a copy, so the saved one stays pristine).
export function restoreTile(edits, key, saved) {
  if (saved) edits.tiles.set(key, copyTile(saved));
  else edits.tiles.delete(key);
}

// Composes one pixel i (at offset k in tile t, or no tile) into out.
function composePixel(base, t, k, i, out) {
  let c = base.category[i];
  let e = base.elevation[i];
  if (t) {
    const mode = t.abs[k];
    if (t.cat[k] !== NO_OVERRIDE) c = t.cat[k];
    if (mode === EDIT_ABSOLUTE) e = t.value[k];
    else if (mode === EDIT_RELATIVE && c !== CATEGORY.LAKE) e += t.value[k];
  }
  if (isOceanCategory(c)) {
    if (e > 0) c = CATEGORY.LAND;
    else if (e > MIN_OCEAN_M) e = MIN_OCEAN_M;
  }
  out.elevation[i] = e;
  out.category[i] = c;
}

// Recomposes the rectangle { x0, y0, x1, y1 } of `out` from base + edits.
export function composeRect(base, edits, out, rect) {
  const w = base.width;
  for (let ty = Math.floor(rect.y0 / TILE); ty * TILE < rect.y1; ty++) {
    for (let tx = Math.floor(rect.x0 / TILE); tx * TILE < rect.x1; tx++) {
      const t = edits.tiles.get(tileKey(edits, tx, ty)) ?? null;
      const y0 = Math.max(rect.y0, ty * TILE);
      const y1 = Math.min(rect.y1, (ty + 1) * TILE);
      const x0 = Math.max(rect.x0, tx * TILE);
      const x1 = Math.min(rect.x1, (tx + 1) * TILE);
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          composePixel(base, t, (y - ty * TILE) * TILE + (x - tx * TILE), y * w + x, out);
        }
      }
    }
  }
}

// base + edits → a terrain. With no edits this is the base itself (shared,
// so callers must copy before writing: see writableTerrain).
export function composeAll(base, edits) {
  if (isEmptyEdits(edits)) return base;
  const out = makeTerrain(base.width, base.height, base.elevation.slice(), base.category.slice());
  for (const key of edits.tiles.keys()) composeRect(base, edits, out, tileRect(edits, key));
  return out;
}

// A terrain safe to write into: the composed one, or a copy if it is still
// the shared base.
export function writableTerrain(terrain, base) {
  if (terrain.elevation !== base.elevation) return terrain;
  return makeTerrain(base.width, base.height, base.elevation.slice(), base.category.slice());
}

// Writes the new final value of pixel (x, y) into the edits layer and
// recomposes it. override: a category (Draw Land / Erase) or undefined
// (relative brushes, which never store a category).
export function setPixel(base, edits, out, x, y, elevationM, override, journal) {
  const tx = (x / TILE) | 0;
  const ty = (y / TILE) | 0;
  const t = touchTile(edits, ty * edits.tilesX + tx, journal);
  writeTilePixel(base, t, (y - ty * TILE) * TILE + (x - tx * TILE), y * base.width + x, out, elevationM, override);
}

// The same write for callers that already hold the tile (brush loops):
// k = offset in the tile, i = index in the map.
export function writeTilePixel(base, t, k, i, out, elevationM, override) {
  if (override !== undefined) {
    t.cat[k] = override;
    t.abs[k] = EDIT_ABSOLUTE;
    t.value[k] = elevationM;
  } else if (t.abs[k] === EDIT_ABSOLUTE) {
    t.value[k] = elevationM;
  } else {
    t.abs[k] = EDIT_RELATIVE;
    t.value[k] = elevationM - base.elevation[i];
  }
  composePixel(base, t, k, i, out);
}

// Adds a rectangle to a per-tile dirty map (key → rect), split at tile
// edges, so later rebuilds only cover what changed.
export function addDirty(edits, dirty, rect) {
  for (let ty = Math.floor(rect.y0 / TILE); ty * TILE < rect.y1; ty++) {
    for (let tx = Math.floor(rect.x0 / TILE); tx * TILE < rect.x1; tx++) {
      const r = {
        x0: Math.max(rect.x0, tx * TILE), y0: Math.max(rect.y0, ty * TILE),
        x1: Math.min(rect.x1, (tx + 1) * TILE), y1: Math.min(rect.y1, (ty + 1) * TILE),
      };
      const key = tileKey(edits, tx, ty);
      const old = dirty.get(key);
      dirty.set(key, old
        ? { x0: Math.min(old.x0, r.x0), y0: Math.min(old.y0, r.y0), x1: Math.max(old.x1, r.x1), y1: Math.max(old.y1, r.y1) }
        : r);
    }
  }
}
