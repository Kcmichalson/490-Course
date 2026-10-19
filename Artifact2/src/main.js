// App entry: state, wiring, and the render loop.

import { DEFAULT_MAP, createMapConfig } from './sim/mapconfig.js';
import { blankTerrain, makeTerrain, isOceanCategory, isLand } from './sim/terrain.js';
import { ruggednessAt } from './sim/slope.js';
import { downsampleTerrain, downsampleRegion, cloneSim } from './sim/downsample.js';
import { createEdits, cloneEdits, writableTerrain, composeRect, addDirty, isEmptyEdits } from './sim/edits.js';
import { applyDab, strokeDabs, BRUSH_IDS } from './sim/brushes.js';
import { liveState, snapshotOf, stateEntry, strokeEntry, bitmapsOf, hasImport, withArt } from './sim/mapstate.js';
import { PLANET_RADIUS_KM } from './sim/constants.js';
import {
  pixelToLatLon, latLonToPixel, sourcePixel, sourceToSimCell, formatLatLon, parseLatLon, wrapX,
} from './sim/coords.js';
import {
  fitView, scaleLimits, zoomAt, zoomToScale, panBy, centerOn, clampView, screenToSource, zoomPercent,
} from './render/viewport.js';
import { MapView } from './render/mapview.js';
import { CATEGORIES, getMode, modesInCategory } from './render/modes.js';
import { OVERLAYS, defaultOverlayState } from './render/overlays.js';
import { renderLegend } from './render/legend.js';
import { TOOLS, getTool, DEFAULT_TOOL_ID, getBrush, DEFAULT_BRUSH_ID } from './ui/tools.js';
import { isAvailable } from './ui/comingsoon.js';
import {
  CATEGORY_KEYS, MODE_KEYS, KEYS, SHORTCUT_ROWS, shouldIgnoreHotkey, isTypingTarget, undoAction, isReloadKey,
} from './ui/shortcuts.js';
import { createMenuBar } from './ui/menubar.js';
import { closeMenus, isMenuOpen } from './ui/menu.js';
import { createToolbar } from './ui/toolbar.js';
import { createOverlayPanel } from './ui/overlaypanel.js';
import { createContextBar } from './ui/contextbar.js';
import { createStatusBar } from './ui/statusbar.js';
import { createInspector } from './ui/inspector.js';
import { createNewMapDialog } from './ui/newmapdialog.js';
import { attachNavigation } from './ui/navigation.js';
import { load, save } from './io/storage.js';
import { createWorkerClient } from './io/workerclient.js';
import { pickImageFile, imageSize, fitWithinMax, decodeImage, readPixels } from './io/imagefile.js';
import { createImportDialog, artAspectNotice } from './ui/importdialog.js';
import { createMapSettingsDialog } from './ui/mapsettingsdialog.js';
import { formatMeters } from './ui/statusbar.js';
import { createHistory } from './ui/history.js';
import { createSculptPanel, BRUSH_SIZE, BRUSH_STRENGTH } from './ui/sculptpanel.js';
import { createConfirmDialog } from './ui/confirmdialog.js';

const $ = (id) => document.getElementById(id);

// ---------- State ----------

function initialMap() {
  try {
    return createMapConfig(load('newMap', DEFAULT_MAP) ?? DEFAULT_MAP);
  } catch {
    return createMapConfig();
  }
}

// Saved overlay choices only apply to overlays that exist in this milestone.
function restoreOverlays(saved) {
  const overlays = defaultOverlayState();
  if (saved && typeof saved === 'object') {
    for (const o of OVERLAYS) {
      if (isAvailable(o.milestone) && typeof saved[o.id] === 'boolean') overlays[o.id] = saved[o.id];
    }
  }
  return overlays;
}

const prefs = load('ui', null) ?? {};
const startMode = getMode(prefs.modeId);
const clampTo = (v, { min, max, value }) => (Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : value);
const state = {
  map: initialMap(),
  view: { scale: 1, offsetX: 0, offsetY: 0 },
  modeId: startMode.id,
  categoryId: CATEGORIES.some((c) => c.id === prefs.categoryId) ? prefs.categoryId : startMode.category,
  toolId: DEFAULT_TOOL_ID,
  overlays: restoreOverlays(prefs.overlays),
  tooltipOn: prefs.tooltipOn ?? true,
  legendOn: prefs.legendOn ?? true,
  selected: null, // continuous source position of the inspected tile
  brush: {
    brushId: BRUSH_IDS.includes(prefs.brush?.brushId) ? prefs.brush.brushId : DEFAULT_BRUSH_ID,
    size: clampTo(prefs.brush?.size, BRUSH_SIZE),
    strength: clampTo(prefs.brush?.strength, BRUSH_STRENGTH),
  },
};

// Terrain store (SPEC 2.1, 2.8). Layers:
//   base     terrain from the import pipeline (or blank); never mutated
//   baseSim  the sim grid of base; never mutated
//   edits    brush edits, a layer re-applied on top of base
//   terrain  base + edits at full resolution (what renderers read); it is
//            base itself until the first brush edit, then a copy
//   sim      terrain downsampled to the sim grid; brush strokes rebuild only
//            the cells they touched
//   source   the imported image(s) and settings, for Reload and Map settings
// `version` changes on every wholesale change, so cached base layers know
// they are stale; strokes redraw just their dirty rectangles instead.
const startBase = blankTerrain(state.map.sourceWidth, state.map.sourceHeight);
const startSim = downsampleTerrain(startBase, state.map);
const store = {
  base: startBase,
  baseSim: startSim,
  edits: createEdits(state.map.sourceWidth, state.map.sourceHeight),
  terrain: startBase,
  sim: startSim,
  source: null,
  version: 1,
  coast: null, // Distance from Coast result: { data, width, height, version, mask }
};

function savePrefs() {
  const { modeId, categoryId, overlays, tooltipOn, legendOn, brush } = state;
  save('ui', { modeId, categoryId, overlays, tooltipOn, legendOn, brush });
}

// ---------- Viewport ----------

let viewW = 0;
let viewH = 0;
let userMoved = false; // until the user pans/zooms, resizes keep the map fitted
let drawPending = false; // declared before MapView, whose constructor reports the first size

const mapDims = () => ({ width: state.map.sourceWidth, height: state.map.sourceHeight, wraps: state.map.wraps });
const limits = () => scaleLimits(state.map.sourceWidth, state.map.sourceHeight, viewW, viewH);

function setView(view) {
  state.view = clampView(view, mapDims(), viewW, viewH);
  requestDraw();
}

function fit() {
  userMoved = false;
  setView(fitView(state.map.sourceWidth, state.map.sourceHeight, viewW, viewH));
}

function zoomBy(factor, sx = viewW / 2, sy = viewH / 2) {
  userMoved = true;
  setView(zoomAt(state.view, factor, sx, sy, limits()));
}

function zoomToPercent(percent) {
  userMoved = true;
  setView(zoomToScale(state.view, percent / 100, viewW / 2, viewH / 2, limits()));
}

function handleResize(w, h) {
  viewW = w;
  viewH = h;
  if (!userMoved) fit();
  else setView(state.view);
}

const canvas = $('map-canvas');
const mapView = new MapView(canvas, { onResize: handleResize });

// ---------- Render loop ----------

function requestDraw() {
  if (drawPending) return;
  drawPending = true;
  requestAnimationFrame(frame);
}

// Screen rects of controls that sit on the map, so overlay labels avoid them.
function reservedRects() {
  const c = canvas.getBoundingClientRect();
  return [$('overlay-control'), $('legend')]
    .filter((el) => el && !el.hidden)
    .map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left - c.left, y: r.top - c.top, w: r.width, h: r.height };
    })
    .filter((r) => r.w > 0 && r.h > 0);
}

function frame() {
  drawPending = false;
  mapView.draw({
    map: state.map,
    view: state.view,
    mode: getMode(state.modeId),
    store,
    overlays: state.overlays,
    selected: state.selected,
    reserved: reservedRects(),
    brush: brushCursor(),
  });
  toolbar.setZoom(zoomPercent(state.view));
  updateHover();
}

// ---------- Hover and selection ----------

let hover = null; // { x, y, dragging } in canvas CSS px
let hoverPending = false;

function onHover(point, dragging) {
  hover = point ? { ...point, dragging } : null;
  if (state.toolId === 'sculpt') { requestDraw(); return; } // the brush circle follows the cursor
  if (hoverPending) return;
  hoverPending = true;
  requestAnimationFrame(() => {
    hoverPending = false;
    updateHover();
  });
}

function updateHover() {
  if (!hover) {
    statusbar.setCursor(null);
    statusbar.setElevation(null);
    inspector.hide();
    return;
  }
  const src = screenToSource(state.view, hover.x, hover.y);
  const ll = pixelToLatLon(state.map, src.x, src.y);
  if (!ll) {
    statusbar.setCursor(null, true);
    statusbar.setElevation(null);
    inspector.hide();
    return;
  }
  const text = formatLatLon(ll);
  if (state.toolId === 'sculpt') sculptPanel.setKm(brushKmText(ll.lat));
  const px = sourcePixel(state.map, src.x, src.y);
  const meters = store.terrain.elevation[px.py * store.terrain.width + px.px];
  statusbar.setCursor(text);
  statusbar.setElevation(meters);
  if (!state.tooltipOn || hover.dragging) {
    inspector.hide();
    return;
  }
  inspector.show(hover.x, hover.y, {
    latLon: text,
    elevation: formatMeters(meters),
    extra: modeReadout(px),
    ...px,
    ...sourceToSimCell(state.map, src.x, src.y),
  });
}

// An extra tooltip line for the current mode, or ''.
function modeReadout({ px, py }) {
  if (state.modeId !== 'slope') return '';
  const i = py * store.terrain.width + px;
  if (!isLand(store.terrain, i)) return 'Ruggedness (TRI): water';
  return `Ruggedness (TRI): ${Math.round(ruggednessAt(store.terrain, state.map.wraps, px, py)).toLocaleString('en-US')} m`;
}

// Sculpt cursor: the brush footprint under the pointer, in source px.
function brushCursor() {
  if (state.toolId !== 'sculpt' || !hover || hover.dragging) return null;
  const src = screenToSource(state.view, hover.x, hover.y);
  if (!pixelToLatLon(state.map, src.x, src.y)) return null;
  return { x: wrapX(state.map, src.x), y: src.y, radius: state.brush.size };
}

// East-west width of the brush in km at a latitude.
function brushKmText(lat) {
  const kmPerPx = ((state.map.lonSpan / state.map.sourceWidth) * Math.PI / 180) * PLANET_RADIUS_KM * Math.cos((lat * Math.PI) / 180);
  const km = 2 * state.brush.size * kmPerPx;
  return `≈ ${km >= 10 ? Math.round(km).toLocaleString() : km.toFixed(1)} km across here`;
}

function selectAt(x, y) {
  const ll = pixelToLatLon(state.map, x, y);
  if (!ll) {
    clearSelection();
    return;
  }
  state.selected = { x: wrapX(state.map, x), y };
  contextbar.setSelection({ latLon: formatLatLon(ll), ...sourceToSimCell(state.map, x, y) });
  requestDraw();
}

function clearSelection() {
  state.selected = null;
  contextbar.setSelection(null);
  requestDraw();
}

// ---------- Actions ----------

function refreshUI() {
  toolbar.update(state);
  overlayPanel.update(state.overlays);
  contextbar.setTool(state.toolId, state.toolId === 'sculpt' ? sculptPanel.element : null);
  const legend = $('legend');
  renderLegend(legend, getMode(state.modeId));
  legend.hidden = !state.legendOn;
  navigation.updateCursor();
}

function setMode(id) {
  const mode = getMode(id);
  state.modeId = mode.id;
  state.categoryId = mode.category;
  savePrefs();
  refreshUI();
  ensureCoast();
  requestDraw();
}

function setCategory(id) {
  state.categoryId = id;
  savePrefs();
  refreshUI();
}

function setTool(id) {
  const tool = getTool(id);
  if (!isAvailable(tool.milestone)) return;
  state.toolId = tool.id;
  refreshUI();
  requestDraw(); // show or hide the brush circle
}

function selectBrush(brushId) {
  state.brush = { ...state.brush, brushId: getBrush(brushId).id };
  sculptPanel.set(state.brush);
  savePrefs();
  setTool('sculpt');
}

function setOverlay(id, on) {
  const o = OVERLAYS.find((x) => x.id === id);
  if (!o || !isAvailable(o.milestone)) return;
  state.overlays = { ...state.overlays, [id]: on };
  savePrefs();
  refreshUI();
  requestDraw();
}

function setTooltip(on) {
  state.tooltipOn = on;
  savePrefs();
  updateHover();
}

function setLegend(on) {
  state.legendOn = on;
  savePrefs();
  refreshUI();
  requestDraw(); // graticule labels re-check what the legend covers
}

// ---------- Map state, brush strokes, and undo (SPEC 2, 2.1) ----------

let worker = null;
let busy = false; // an import, reload, or map-settings build is running

const history = createHistory({
  dispose: (bitmap) => bitmap.close?.(),
  isLive: (bitmap) => bitmapsOf(store.source).includes(bitmap),
});

const hasTerrain = () => Boolean(store.source) || !isEmptyEdits(store.edits);

const currentState = () => ({
  map: state.map, source: store.source, base: store.base, baseSim: store.baseSim, edits: store.edits,
});

// Makes a snapshot the current state (composing its edits over its base).
function applySnapshot(snap, { keepView = false } = {}) {
  const live = liveState(snap);
  const sameSize = live.map.sourceWidth === state.map.sourceWidth && live.map.sourceHeight === state.map.sourceHeight;
  pendingSim.clear();
  state.map = live.map;
  Object.assign(store, {
    base: live.base, baseSim: live.baseSim, edits: live.edits, terrain: live.terrain, sim: live.sim, source: live.source,
  });
  store.version++;
  markCoastStale();
  statusbar.setMap(state.map);
  clearSelection();
  if (keepView && sameSize) setView(state.view);
  else fit();
}

// A wholesale change (New Map, Import, Reload, Map settings), undoable.
function commitState(label, after, opts = {}) {
  const before = snapshotOf(currentState());
  applySnapshot(after, opts);
  history.push(stateEntry(label, before, after, (snap) => applySnapshot(snap, { keepView: true })));
}

async function newMap(cfg) {
  if (busy) return;
  if (hasTerrain()) {
    const ok = await confirmDialog.ask({
      title: 'Discard the current map?',
      message: 'New Map replaces the imported terrain and brush edits with open ocean. Edit > Undo (Ctrl+Z) brings them back.',
      confirmLabel: 'Discard and create',
    });
    if (!ok) return;
  }
  const base = blankTerrain(cfg.sourceWidth, cfg.sourceHeight);
  commitState('New Map', {
    map: cfg, source: null, base, baseSim: downsampleTerrain(base, cfg), edits: createEdits(cfg.sourceWidth, cfg.sourceHeight),
  });
}

// ---- Brush strokes ----

let stroke = null; // { journal, dirty, last, brushId, radius, strength }
const pendingSim = new Map(); // tile key → source rect whose sim cells are stale
let simTimer = 0;

// Rebuilds the sim cells under the given rects now (copying the immutable
// base grid on the first edit).
function rebuildSim(rects) {
  if (store.sim === store.baseSim) store.sim = cloneSim(store.baseSim);
  for (const r of rects) downsampleRegion(store.terrain, state.map, store.sim, r);
}

// The sim recomputes when a stroke ends (debounced), not during it.
function flushSim() {
  clearTimeout(simTimer);
  if (!pendingSim.size) return;
  rebuildSim(pendingSim.values());
  pendingSim.clear();
}

function dabAt(p) {
  const ctx = { base: store.base, edits: store.edits, terrain: store.terrain, wraps: state.map.wraps, journal: stroke.journal };
  const rects = applyDab(ctx, stroke.brushId, p.x, p.y, { radius: stroke.radius, strength: stroke.strength });
  for (const r of rects) {
    addDirty(store.edits, stroke.dirty, r);
    mapView.invalidate(r);
  }
  if (rects.length) requestDraw();
}

function strokeStart(sx, sy) {
  if (busy) return;
  store.terrain = writableTerrain(store.terrain, store.base); // copy on the first edit
  const p = screenToSource(state.view, sx, sy);
  const { brushId, size, strength } = state.brush;
  stroke = { journal: new Map(), dirty: new Map(), last: p, brushId, radius: size, strength: strength / 100 };
  dabAt(p);
}

function strokeMove(sx, sy) {
  if (!stroke) return;
  const { points, last } = strokeDabs(stroke.last, screenToSource(state.view, sx, sy), Math.max(1, stroke.radius / 4));
  for (const p of points) dabAt(p);
  stroke.last = last;
}

// Recomposes, redraws, and re-downsamples rects after an undo/redo swap.
function refreshRects(rects) {
  store.terrain = writableTerrain(store.terrain, store.base);
  for (const r of rects) {
    composeRect(store.base, store.edits, store.terrain, r);
    mapView.invalidate(r);
  }
  rebuildSim(rects);
  if (coastChangedIn(rects)) markCoastStale();
  requestDraw();
}

function strokeEnd() {
  if (!stroke) return;
  const s = stroke;
  stroke = null;
  if (!s.dirty.size) return;
  history.push(strokeEntry(getBrush(s.brushId).label, store.edits, s.journal, s.dirty, {
    getEdits: () => store.edits,
    refresh: refreshRects,
  }));
  for (const [key, r] of s.dirty) {
    const old = pendingSim.get(key);
    pendingSim.set(key, old
      ? { x0: Math.min(old.x0, r.x0), y0: Math.min(old.y0, r.y0), x1: Math.max(old.x1, r.x1), y1: Math.max(old.y1, r.y1) }
      : r);
  }
  clearTimeout(simTimer);
  simTimer = setTimeout(flushSim, 250);
  if (coastChangedIn(s.dirty.values())) markCoastStale();
}

// ---- Distance from Coast (SPEC 13.3): a worker job, run only while the
// mode is shown and the land/sea layout has changed since the last run.
// Until a new result arrives the mode shows the previous one. ----

const coastJob = { stale: true, pending: false };

// 1 = land or lake (not ocean), the layout the distances are measured from.
function coastMask(terrain, rect = null) {
  const { width: w, category: cat } = terrain;
  const r = rect ?? { x0: 0, y0: 0, x1: w, y1: terrain.height };
  const out = new Uint8Array((r.x1 - r.x0) * (r.y1 - r.y0));
  let k = 0;
  for (let y = r.y0; y < r.y1; y++) for (let x = r.x0; x < r.x1; x++) out[k++] = isOceanCategory(cat[y * w + x]) ? 0 : 1;
  return out;
}

// Did land/sea change inside these source rects since the last distance run?
function coastChangedIn(rects) {
  const mask = store.coast?.mask;
  if (!mask || store.coast.width !== state.map.sourceWidth || store.coast.height !== state.map.sourceHeight) return true;
  const { width: w, category: cat } = store.terrain;
  for (const r of rects) {
    for (let y = r.y0; y < r.y1; y++) {
      for (let x = r.x0; x < r.x1; x++) {
        const i = y * w + x;
        if ((isOceanCategory(cat[i]) ? 0 : 1) !== mask[i]) return true;
      }
    }
  }
  return false;
}

function markCoastStale() {
  coastJob.stale = true;
  ensureCoast();
}

function ensureCoast() {
  if (state.modeId !== 'coast-distance' || !worker || coastJob.pending || !coastJob.stale) return;
  coastJob.pending = true;
  coastJob.stale = false;
  const map = state.map;
  const mask = coastMask(store.terrain);
  const category = store.terrain.category.slice();
  if (!store.coast) contextbar.flash('Measuring distance from the coast…');
  worker.request('coastDistance', { category, cfg: { ...map } }, [category.buffer])
    .then((result) => {
      if (result.width !== state.map.sourceWidth || result.height !== state.map.sourceHeight) return;
      store.coast = { ...result, mask, version: (store.coast?.version ?? 0) + 1 };
      requestDraw();
    })
    .catch((err) => contextbar.flash(`Distance from coast failed: ${err.message}`, 8000))
    .finally(() => {
      coastJob.pending = false;
      ensureCoast(); // the layout changed again while this one ran
    });
}

function undo() {
  if (busy || stroke) return;
  flushSim();
  const label = history.undoLabel();
  contextbar.flash(history.undo() ? `Undid ${label}.` : 'Nothing to undo.', 2500);
}

function redo() {
  if (busy || stroke) return;
  flushSim();
  const label = history.redoLabel();
  contextbar.flash(history.redo() ? `Redid ${label}.` : 'Nothing to redo.', 2500);
}

// ---------- Imports, Reload, Map settings ----------

async function whileBusy(fn) {
  busy = true;
  try {
    return await fn();
  } finally {
    busy = false;
  }
}

// Decodes an art image at map size (stretched to fit). `art` = { file,
// handle?, natural?, bitmap? }: an existing bitmap of the right size is kept
// unless `reread` (Reload re-reads the file through its handle).
async function loadArt(art, cfg, { reread = false } = {}) {
  if (!art) return null;
  if (!reread && art.bitmap && art.bitmap.width === cfg.sourceWidth && art.bitmap.height === cfg.sourceHeight) return art;
  const natural = art.natural ?? await imageSize(art.file);
  const bitmap = await decodeImage(art.file, cfg.sourceWidth, cfg.sourceHeight);
  return { file: art.file, handle: art.handle ?? null, natural, bitmap };
}

// Decodes the image(s) at map size and builds the base terrain in the worker.
// Old bitmaps are not closed here: undo may bring them back (the history
// closes them once nothing uses them). Palette images decode nearest-neighbor
// so every pixel keeps a color that is really in the file.
async function buildFromSource(source, cfg, { rereadArt = false } = {}) {
  const quality = source.kind === 'palette' ? 'pixelated' : 'high';
  const bitmap = await decodeImage(source.file, cfg.sourceWidth, cfg.sourceHeight, quality);
  const rgba = readPixels(bitmap);
  let maskRgba = null;
  if (source.mask) {
    const maskBitmap = await decodeImage(source.mask.file, cfg.sourceWidth, cfg.sourceHeight, 'pixelated');
    maskRgba = readPixels(maskBitmap);
    maskBitmap.close();
  }
  const transfer = [rgba.buffer];
  if (maskRgba) transfer.push(maskRgba.buffer);
  const result = await worker.request('build', { kind: source.kind, rgba, maskRgba, settings: source.settings, cfg: { ...cfg } }, transfer);
  const base = makeTerrain(cfg.sourceWidth, cfg.sourceHeight, result.elevation, result.category);
  const art = await loadArt(source.art, cfg, { reread: rereadArt });
  return { base, baseSim: result.sim, source: { ...source, bitmap, art }, info: result.info, ms: result.ms };
}

// " · 1.2% unmatched" for palette builds, else "".
function unmatchedNote(info) {
  return info?.unmatchedFraction != null ? ` ${(info.unmatchedFraction * 100).toFixed(1)}% of pixels unmatched (filled from the nearest match).` : '';
}

async function importMap(payload) {
  if (!worker) throw new Error('The simulation worker is not running.');
  if (busy) throw new Error('Another map update is still running.');
  const mapSize = fitWithinMax(payload.natural.width, payload.natural.height);
  const cfg = createMapConfig({ ...payload.cfgValues, sourceWidth: mapSize.width, sourceHeight: mapSize.height });
  const source = {
    kind: payload.kind,
    file: payload.file,
    handle: payload.handle,
    natural: payload.natural,
    settings: payload.settings,
    storedSettings: payload.storedSettings,
    mask: payload.mask,
    art: payload.art ?? null,
  };
  // Brush edits are in source pixels, so they can only be kept at the same size.
  const sameSize = cfg.sourceWidth === state.map.sourceWidth && cfg.sourceHeight === state.map.sourceHeight;
  const hadEdits = !isEmptyEdits(store.edits);
  const keep = Boolean(payload.keepEdits) && sameSize && hadEdits;
  const built = await whileBusy(() => buildFromSource(source, cfg));
  commitState(`Import ${payload.file.name}`, {
    map: cfg, source: built.source, base: built.base, baseSim: built.baseSim,
    edits: keep ? cloneEdits(store.edits) : createEdits(cfg.sourceWidth, cfg.sourceHeight),
  });
  let note = '';
  if (keep) note = ' Brush edits kept.';
  else if (hadEdits) {
    note = sameSize
      ? ' Brush edits were not kept; Ctrl+Z brings them back.'
      : ' Brush edits were dropped because the image size changed; Ctrl+Z brings them back.';
  }
  const artNote = artAspectNotice(built.source.art, cfg.sourceWidth, cfg.sourceHeight);
  if (artNote) note += ` ${artNote}`;
  note = unmatchedNote(built.info) + note;
  contextbar.flash(`Imported ${payload.file.name} (${cfg.sourceWidth} × ${cfg.sourceHeight}) in ${(built.ms / 1000).toFixed(1)} s.${note}`, note ? 8000 : 4000);
}

async function reloadMap() {
  const src = store.source;
  if (busy || stroke) return;
  if (!hasImport(src)) {
    contextbar.flash('Nothing to reload yet: import a map image first (File > Import Map Image…).');
    return;
  }
  try {
    let file = src.file;
    let handle = src.handle;
    if (handle) file = await handle.getFile();
    else {
      const picked = await pickImageFile();
      if (!picked) return;
      ({ file, handle } = picked);
    }
    const natural = await imageSize(file);
    if (natural.width !== src.natural.width || natural.height !== src.natural.height) {
      // A different size: reopen the import dialog, prefilled. Brush edits
      // can't follow (they are in source pixels); importing drops them.
      await importDialog.open({
        file, handle,
        prefill: { kind: src.kind, storedSettings: src.storedSettings, cfgValues: state.map, art: src.art ? { file: src.art.file, handle: src.art.handle, natural: src.art.natural } : null },
      });
      return;
    }

    // Check for active edits and prompt the user (defaulting to not keeping them unless confirmed)
    let keepEdits = false;
    const hadEdits = !isEmptyEdits(store.edits);
    if (hadEdits) {
      const choice = await confirmDialog.ask({
        title: 'Keep current brush edits?',
        message: 'You have active brush edits on this map. Do you want to keep them on top of the reloaded image?',
        confirmLabel: 'Yes',
        noLabel: 'No',           // Renders the "No" button
        cancelLabel: 'Cancel',   // Renders the "Cancel" button
      });
      
      // choice returns: true (Yes), false (No), or null/undefined (Cancel)
      if (choice === null || choice === undefined) return; // Abort reload on Cancel
      keepEdits = choice; // true = keep edits, false = discard edits
    }

    const mask = src.mask?.handle ? { ...src.mask, file: await src.mask.handle.getFile() } : src.mask;
    // The art image is re-read only through its file handle; without one
    // (no File System Access API) the current art is kept.
    const art = src.art?.handle ? { ...src.art, file: await src.art.handle.getFile(), natural: null } : src.art;
    contextbar.flash(`Reloading ${file.name}…`);
    const built = await whileBusy(() => buildFromSource({ ...src, file, handle, mask, art }, state.map, { rereadArt: Boolean(src.art?.handle) }));
    
    // Same size: apply edits conditionally based on the prompt result
    commitState(`Reload ${file.name}`, {
      map: state.map, 
      source: built.source, 
      base: built.base, 
      baseSim: built.baseSim, 
      edits: keepEdits ? cloneEdits(store.edits) : createEdits(state.map.sourceWidth, state.map.sourceHeight),
    }, { keepView: true });
    
    const unmatched = unmatchedNote(built.info);
    contextbar.flash(`Reloaded ${file.name}.${unmatched}${keepEdits ? ' Brush edits kept.' : hadEdits ? ' Brush edits discarded (Ctrl+Z brings them back).' : ''}`, hadEdits || unmatched ? 6000 : 4000);
  } catch (err) {
    contextbar.flash(`Reload failed: ${err.message}`, 8000);
  }
}

async function applyMapSettings(values) {
  if (busy) throw new Error('Another map update is still running.');
  const cfg = createMapConfig({ ...values, sourceWidth: state.map.sourceWidth, sourceHeight: state.map.sourceHeight });
  if (!hasImport(store.source)) {
    // Blank map: the same base (and art) with the new extent (and maybe sim width).
    commitState('Map Settings', {
      map: cfg, source: store.source, base: store.base, baseSim: downsampleTerrain(store.base, cfg), edits: cloneEdits(store.edits),
    }, { keepView: true });
    return;
  }
  // Same pixel size, so the brush edits stay put and are re-applied.
  const built = await whileBusy(() => buildFromSource(store.source, cfg));
  commitState('Map Settings', {
    map: cfg, source: built.source, base: built.base, baseSim: built.baseSim, edits: cloneEdits(store.edits),
  }, { keepView: true });
}

// File > Art Image…: a separate image for Original Art (SPEC 2.5.1),
// stretched to the map size. Works on blank maps too; undoable.
async function setArtImage() {
  if (busy || stroke) return;
  const picked = await pickImageFile();
  if (!picked) return;
  const art = await loadArt({ file: picked.file, handle: picked.handle }, state.map);
  commitState('Art Image', { ...currentState(), source: withArt(store.source, art) }, { keepView: true });
  const note = artAspectNotice(art, state.map.sourceWidth, state.map.sourceHeight);
  contextbar.flash(`Art image: ${picked.file.name}. Original Art (1, Q) shows it.${note ? ` ${note}` : ''}`, note ? 8000 : 4000);
}

function removeArtImage() {
  if (busy || stroke || !store.source?.art) return;
  commitState('Remove Art Image', { ...currentState(), source: withArt(store.source, null) }, { keepView: true });
  contextbar.flash('Art image removed (Ctrl+Z brings it back).');
}

function goTo(text) {
  const ll = parseLatLon(text);
  if (!ll) {
    contextbar.flash(`Couldn't read "${text.trim()}". Try 45N 30W or 45, -30.`);
    return false;
  }
  const p = latLonToPixel(state.map, ll.lat, ll.lon);
  if (!pixelToLatLon(state.map, p.x, p.y)) {
    contextbar.flash(`${formatLatLon(ll)} is outside this map.`);
    return false;
  }
  userMoved = true;
  setView(centerOn(state.view, p.x, p.y, viewW, viewH));
  selectAt(p.x, p.y);
  return true;
}

// Center of the screen as a bookmark-able view.
function currentView() {
  const c = screenToSource(state.view, viewW / 2, viewH / 2);
  const x = state.map.wraps ? c.x : Math.min(state.map.sourceWidth, Math.max(0, c.x));
  const y = Math.min(state.map.sourceHeight, Math.max(0, c.y));
  const ll = pixelToLatLon(state.map, x, y);
  if (!ll) return null;
  const round = (v) => Math.round(v * 1e4) / 1e4;
  return { lat: round(ll.lat), lon: round(ll.lon), zoom: Math.round(zoomPercent(state.view) * 10) / 10 };
}

function goToBookmark(b) {
  userMoved = true;
  const zoomed = zoomToScale(state.view, b.zoom / 100, viewW / 2, viewH / 2, limits());
  const p = latLonToPixel(state.map, b.lat, b.lon);
  setView(centerOn(zoomed, p.x, p.y, viewW, viewH));
}

function panByKeys(dx, dy) {
  userMoved = true;
  setView(panBy(state.view, dx, dy));
}

const shortcutsDialog = $('shortcuts-dialog');
$('shortcut-rows').innerHTML = SHORTCUT_ROWS
  .map(([keys, action]) => `<tr><td>${keys}</td><td>${action}</td></tr>`).join('');
const openShortcuts = () => shortcutsDialog.showModal();

// ---------- UI ----------

const toolMenuItems = () => TOOLS.map((t) => (t.children
  ? {
    label: t.label,
    milestone: t.milestone,
    submenu: t.children.map((c) => ({
      label: c.label,
      milestone: c.milestone,
      radio: true,
      checked: state.toolId === t.id && state.brush.brushId === c.id,
      action: () => selectBrush(c.id),
    })),
  }
  : {
    label: t.label,
    milestone: t.milestone,
    radio: true,
    checked: state.toolId === t.id,
    shortcut: t.id === 'navigate' ? 'Esc' : '',
    action: () => setTool(t.id),
  }));

const overlayMenuItems = () => OVERLAYS.map((o) => ({
  label: o.label,
  milestone: o.milestone,
  checked: () => Boolean(state.overlays[o.id]),
  action: () => setOverlay(o.id, !state.overlays[o.id]),
}));

const newMapDialog = createNewMapDialog($('newmap-dialog'), { onCreate: newMap });
const importDialog = createImportDialog($('import-dialog'), {
  worker: { request: (...args) => worker.request(...args) },
  getCurrentMap: () => state.map,
  getEditCount: () => store.edits.tiles.size,
  onImport: importMap,
});
const confirmDialog = createConfirmDialog($('confirm-dialog'));
const sculptPanel = createSculptPanel({
  brushes: TOOLS.find((t) => t.id === 'sculpt').children,
  value: state.brush,
  onChange: (v) => { state.brush = v; savePrefs(); requestDraw(); },
});
const mapSettingsDialog = createMapSettingsDialog($('mapsettings-dialog'), { onApply: applyMapSettings });

createMenuBar($('menubar'), [
  {
    label: 'File',
    items: () => [
      { label: 'New Map…', action: () => newMapDialog.open(state.map) },
      { separator: true },
      { label: 'Import Map Image…', milestone: '2a', action: () => importDialog.openFromPicker().catch((err) => contextbar.flash(err.message, 8000)) },
      { label: 'Reload Map Image', shortcut: 'Ctrl+Shift+R', milestone: '2a', action: reloadMap },
      { label: 'Art Image…', milestone: '2b', action: () => setArtImage().catch((err) => contextbar.flash(`Art image failed: ${err.message}`, 8000)) },
      { label: 'Remove Art Image', milestone: '2b', disabled: !store.source?.art, action: removeArtImage },
      { separator: true },
      { label: 'Save Project…', milestone: 11 },
      { label: 'Load Project…', milestone: 11 },
      { separator: true },
      { label: 'Export PNG…', milestone: 11 },
    ],
  },
  {
    label: 'Edit',
    items: () => [
      { label: history.canUndo() ? `Undo ${history.undoLabel()}` : 'Undo', shortcut: 'Ctrl+Z', milestone: '2b', disabled: !history.canUndo(), action: undo },
      { label: history.canRedo() ? `Redo ${history.redoLabel()}` : 'Redo', shortcut: 'Ctrl+Y', milestone: '2b', disabled: !history.canRedo(), action: redo },
      { separator: true },
      { label: 'Map Settings…', milestone: '2a', action: () => mapSettingsDialog.open(state.map, hasImport(store.source)) },
    ],
  },
  {
    label: 'View',
    items: () => [
      { label: 'Overlays', submenu: overlayMenuItems },
      { label: 'Hover Tooltip', checked: state.tooltipOn, action: () => setTooltip(!state.tooltipOn) },
      { label: 'Tool Palette', milestone: 11 },
      { separator: true },
      { label: 'Zoom In', shortcut: '+', action: () => zoomBy(1.25) },
      { label: 'Zoom Out', shortcut: '−', action: () => zoomBy(0.8) },
      { label: 'Fit to Screen', shortcut: '0', action: fit },
      { separator: true },
      { label: 'Go to Lat/Lon…', shortcut: 'G', action: () => toolbar.focusGoTo() },
    ],
  },
  { label: 'Tools', items: toolMenuItems },
  {
    label: 'Help',
    items: () => [
      { label: 'Legend', checked: state.legendOn, action: () => setLegend(!state.legendOn) },
      { label: 'Keyboard Shortcuts…', shortcut: '?', action: openShortcuts },
    ],
  },
]);

const toolbar = createToolbar($('toolbar'), {
  toolMenuItems,
  onCategory: setCategory,
  onMode: setMode,
  onZoomIn: () => zoomBy(1.25),
  onZoomOut: () => zoomBy(0.8),
  onZoomInput: zoomToPercent,
  onGoTo: goTo,
  bookmarks: { getCurrent: currentView, onGo: goToBookmark },
});

const overlayPanel = createOverlayPanel($('overlay-control'), { onToggle: setOverlay });

const contextbar = createContextBar($('contextbar'), {
  planetPanel: $('planet-panel'),
  planetClose: $('planet-close'),
  onClearSelection: clearSelection,
});

const statusbar = createStatusBar($('statusbar'));
const inspector = createInspector($('tooltip'), $('map-area'));

const navigation = attachNavigation(canvas, {
  getTool: () => state.toolId,
  onPan: (dx, dy) => { userMoved = true; setView(panBy(state.view, dx, dy)); },
  onZoom: zoomBy,
  onHover,
  onClick: (x, y) => {
    const src = screenToSource(state.view, x, y);
    selectAt(src.x, src.y);
  },
  onStrokeStart: strokeStart,
  onStrokeMove: strokeMove,
  onStrokeEnd: strokeEnd,
});

// ---------- Keyboard ----------

window.addEventListener('keydown', (e) => {
  if (e.defaultPrevented) return; // a menu, tab list, or field already handled it
  const dialogOpen = Boolean(document.querySelector('dialog[open]'));
  if (isReloadKey(e)) {
    // Ctrl+Shift+R is the app's Reload Map Image. Always claim it, even in a
    // dialog or text field, so the browser's hard refresh (which would lose
    // unsaved work) never runs on this page.
    e.preventDefault();
    if (!dialogOpen && !isMenuOpen() && !isTypingTarget(e.target) && isAvailable('2a')) reloadMap();
    return;
  }
  if (e.key === 'Escape') {
    if (dialogOpen) return; // the dialog closes itself
    if (isMenuOpen()) { closeMenus({ returnFocus: true }); return; }
    if (isTypingTarget(e.target)) { e.target.blur(); return; }
    if (contextbar.isPlanetOpen()) contextbar.closePlanet();
    setTool('navigate');
    return;
  }
  if (isMenuOpen()) return;
  const undoKey = undoAction({
    key: e.key, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey, altKey: e.altKey, target: e.target, dialogOpen,
  });
  if (undoKey) {
    e.preventDefault();
    if (undoKey === 'undo') undo(); else redo();
    return;
  }
  if (shouldIgnoreHotkey({
    target: e.target, dialogOpen, ctrlKey: e.ctrlKey, altKey: e.altKey, metaKey: e.metaKey, shiftKey: e.shiftKey, code: e.code,
  })) return;

  const k =e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const ci = CATEGORY_KEYS.indexOf(k);
  const mi = MODE_KEYS.indexOf(k);
  const step = 0.1 * Math.min(viewW, viewH);
  let handled = true;
  if (ci !== -1) setCategory(CATEGORIES[ci].id);
  else if (mi !== -1) {
    const mode = modesInCategory(state.categoryId)[mi];
    if (mode) setMode(mode.id);
    else handled = false;
  } else if (k === KEYS.fit) fit();
  else if (KEYS.zoomIn.includes(k)) zoomBy(1.25);
  else if (KEYS.zoomOut.includes(k)) zoomBy(0.8);
  else if (k === KEYS.goTo) toolbar.focusGoTo();
  else if (k === KEYS.shortcuts) openShortcuts();
  else if (k === 'ArrowLeft') panByKeys(step, 0);
  else if (k === 'ArrowRight') panByKeys(-step, 0);
  else if (k === 'ArrowUp') panByKeys(0, step);
  else if (k === 'ArrowDown') panByKeys(0, -step);
  else handled = false;
  if (handled) e.preventDefault();
});

// ---------- Worker ----------

function startWorker() {
  try {
    const w = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    w.addEventListener('error', (e) => {
      statusbar.setWorker('error');
      console.error('Simulation worker failed to start:', e.message || e);
    });
    worker = createWorkerClient(w);
    worker.request('ping').then(() => { statusbar.setWorker('ready'); ensureCoast(); });
  } catch (err) {
    statusbar.setWorker('error');
    console.error('Simulation worker failed to start:', err);
  }
}

// ---------- Start ----------

statusbar.setMap(state.map);
refreshUI();
startWorker();
requestDraw();
