// Map state for editing and undo (SPEC 2, 2.1). Pure: no DOM. Bitmaps are
// opaque objects with width/height (ImageBitmaps in the app).
//
// A snapshot is { map, source, base, baseSim, edits }:
//   map      the map config (frozen)
//   source   the imported image(s) and settings, or null (blank map)
//   base     terrain from the import pipeline; never mutated
//   baseSim  the sim grid of base; never mutated
//   edits    the brush edits layer (a private copy in snapshots)
//   planet   optional { planet, season }: only Load Earth Map's entry
//            carries it, so undo restores the planet settings with the map
// A live state adds terrain (base + edits) and sim (baseSim + edited cells).

import { cloneEdits, composeAll, editedRects, isEmptyEdits, tileBytes, restoreTile } from './edits.js';
import { cloneSim, downsampleRegion } from './downsample.js';

// Snapshot → live state. The snapshot's edits are copied, so the snapshot
// stays as it was for redo.
export function liveState(snap) {
  const edits = cloneEdits(snap.edits);
  const terrain = composeAll(snap.base, edits);
  let sim = snap.baseSim;
  if (!isEmptyEdits(edits)) {
    sim = cloneSim(snap.baseSim);
    for (const r of editedRects(edits)) downsampleRegion(terrain, snap.map, sim, r);
  }
  return { map: snap.map, source: snap.source, base: snap.base, baseSim: snap.baseSim, edits, terrain, sim };
}

export function snapshotOf(live) {
  return { map: live.map, source: live.source, base: live.base, baseSim: live.baseSim, edits: cloneEdits(live.edits) };
}

export function bitmapsOf(source) {
  return [source?.bitmap, source?.art?.bitmap].filter(Boolean);
}

// Is there an imported terrain image (as opposed to a blank map, which may
// still carry an art image: source = { kind: 'blank', art })?
export function hasImport(source) {
  return Boolean(source?.file);
}

// The source with a different art image (or none). A blank map's source is
// null without art.
export function withArt(source, art) {
  if (hasImport(source)) return { ...source, art: art ?? null };
  return art ? { kind: 'blank', art } : null;
}

function simBytes(sim) {
  return sim ? sim.landFraction.byteLength * 4 + sim.category.byteLength : 0;
}

// Memory a snapshot keeps alive, as { ref, bytes } (the history counts each
// ref once across entries).
export function snapshotBuffers(snap) {
  const out = [
    { ref: snap.base.elevation, bytes: snap.base.elevation.byteLength },
    { ref: snap.base.category, bytes: snap.base.category?.byteLength ?? 0 },
    { ref: snap.baseSim, bytes: simBytes(snap.baseSim) },
  ];
  for (const b of bitmapsOf(snap.source)) out.push({ ref: b, bytes: b.width * b.height * 4 });
  for (const t of snap.edits.tiles.values()) out.push({ ref: t, bytes: tileBytes(t) });
  return out;
}

// A whole-state entry (Import, Reload, Map settings, New Map).
// apply(snapshot) makes a snapshot the current state.
export function stateEntry(label, before, after, apply) {
  return {
    label,
    undo: () => apply(before),
    redo: () => apply(after),
    buffers: [...snapshotBuffers(before), ...snapshotBuffers(after)],
    resources: [...bitmapsOf(before.source), ...bitmapsOf(after.source)],
  };
}

// A stroke entry: before/after copies of only the tiles the stroke touched.
// journal: Map key → tile copy (or null) from before the stroke.
// dirty: Map key → rect that changed. getEdits() returns the current edits
// layer (whole-state undo replaces it with a copy); refresh(rects)
// recomposes, redraws, and re-downsamples those rects after a swap.
export function strokeEntry(label, edits, journal, dirty, { getEdits, refresh }) {
  const before = new Map(journal);
  const after = new Map();
  for (const key of journal.keys()) {
    const t = edits.tiles.get(key);
    after.set(key, t ? { abs: t.abs.slice(), value: t.value.slice(), cat: t.cat.slice() } : null);
  }
  const rects = [...dirty.values()];
  const swap = (tiles) => () => {
    const live = getEdits();
    for (const [key, t] of tiles) restoreTile(live, key, t);
    refresh(rects);
  };
  const buffers = [];
  for (const t of [...before.values(), ...after.values()]) if (t) buffers.push({ ref: t, bytes: tileBytes(t) });
  return { label, undo: swap(before), redo: swap(after), buffers, resources: [] };
}
