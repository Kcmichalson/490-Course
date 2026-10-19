// Undo/redo history (SPEC 2): region-based stroke entries and whole-state
// entries, with a memory budget. Pure (no DOM), so it runs in Node tests.
//
// An entry is { label, undo(), redo(), buffers, resources }:
//   buffers:   [{ ref, bytes }] memory the entry keeps alive. Counted once
//              per distinct ref across ALL entries, because entries share
//              references (the "after" state of one import is the "before"
//              of the next reload), so one Reload doesn't evict earlier
//              strokes.
//   resources: things that need disposing when nothing uses them any more
//              (ImageBitmaps). A resource is disposed only when no remaining
//              entry lists it and isLive(resource) is false (the current
//              state doesn't use it).
// When the total exceeds the budget, the oldest entries go first. The newest
// entry is always kept, so one undo always works.

export const UNDO_BUDGET_BYTES = 256 * 1024 * 1024;

export function createHistory({ budget = UNDO_BUDGET_BYTES, dispose = () => {}, isLive = () => false, onChange = () => {} } = {}) {
  let undoStack = [];
  let redoStack = [];

  const all = () => [...undoStack, ...redoStack];

  function totalBytes(entries = all()) {
    const seen = new Set();
    let total = 0;
    for (const e of entries) {
      for (const b of e.buffers ?? []) {
        if (!b.ref || seen.has(b.ref)) continue;
        seen.add(b.ref);
        total += b.bytes;
      }
    }
    return total;
  }

  // Disposes the resources of dropped entries that nothing else uses.
  function release(dropped) {
    if (!dropped.length) return;
    const kept = new Set();
    for (const e of all()) for (const r of e.resources ?? []) kept.add(r);
    const done = new Set();
    for (const e of dropped) {
      for (const r of e.resources ?? []) {
        if (kept.has(r) || done.has(r) || isLive(r)) continue;
        done.add(r);
        dispose(r);
      }
    }
  }

  function enforceBudget() {
    const dropped = [];
    while (undoStack.length + redoStack.length > 1 && totalBytes() > budget) {
      // Oldest first: the bottom of the undo stack, then the far end of redo.
      dropped.push(undoStack.length ? undoStack.shift() : redoStack.shift());
    }
    release(dropped);
  }

  return {
    push(entry) {
      const dropped = redoStack;
      redoStack = [];
      undoStack.push(entry);
      release(dropped);
      enforceBudget();
      onChange();
    },
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
    undoLabel: () => undoStack.at(-1)?.label ?? '',
    redoLabel: () => redoStack.at(-1)?.label ?? '',
    undo() {
      const e = undoStack.pop();
      if (!e) return false;
      e.undo();
      redoStack.push(e);
      onChange();
      return true;
    },
    redo() {
      const e = redoStack.pop();
      if (!e) return false;
      e.redo();
      undoStack.push(e);
      onChange();
      return true;
    },
    // Drops everything (disposing what the current state doesn't use).
    clear() {
      const dropped = all();
      undoStack = [];
      redoStack = [];
      release(dropped);
      onChange();
    },
    totalBytes: () => totalBytes(),
    size: () => ({ undo: undoStack.length, redo: redoStack.length }),
  };
}
