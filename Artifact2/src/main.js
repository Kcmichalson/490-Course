// App entry: state, wiring, and the render loop.

import { DEFAULT_MAP, createMapConfig } from './sim/mapconfig.js';
import { blankTerrain, makeTerrain } from './sim/terrain.js';
import { downsampleTerrain } from './sim/downsample.js';
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
import { TOOLS, getTool, DEFAULT_TOOL_ID } from './ui/tools.js';
import { isAvailable } from './ui/comingsoon.js';
import {
  CATEGORY_KEYS, MODE_KEYS, KEYS, SHORTCUT_ROWS, shouldIgnoreHotkey, isTypingTarget,
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
import { createImportDialog } from './ui/importdialog.js';
import { createMapSettingsDialog } from './ui/mapsettingsdialog.js';
import { formatMeters } from './ui/statusbar.js';

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
};

// Terrain store. Full-resolution elevation is the source of truth; the sim
// grid is always derived from it. `version` changes on every terrain change,
// so cached base layers and sim results know they are stale.
// source: the imported image(s) and settings, kept for Reload and Map settings.
const store = {
  terrain: blankTerrain(state.map.sourceWidth, state.map.sourceHeight),
  sim: null,
  source: null,
  version: 1,
};

function setTerrain(terrain, sim, source) {
  store.terrain = terrain;
  store.sim = sim;
  store.source = source;
  store.version++;
}

function savePrefs() {
  const { modeId, categoryId, overlays, tooltipOn, legendOn } = state;
  save('ui', { modeId, categoryId, overlays, tooltipOn, legendOn });
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
  });
  toolbar.setZoom(zoomPercent(state.view));
  updateHover();
}

// ---------- Hover and selection ----------

let hover = null; // { x, y, dragging } in canvas CSS px
let hoverPending = false;

function onHover(point, dragging) {
  hover = point ? { ...point, dragging } : null;
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
    ...px,
    ...sourceToSimCell(state.map, src.x, src.y),
  });
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
  contextbar.setTool(state.toolId);
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

// New Map: a blank, open-ocean map.
function setMap(cfg) {
  const terrain = blankTerrain(cfg.sourceWidth, cfg.sourceHeight);
  applyMap(cfg, terrain, downsampleTerrain(terrain, cfg), null);
}

function applyMap(cfg, terrain, sim, source, { keepView = false } = {}) {
  const sameSize = cfg.sourceWidth === state.map.sourceWidth && cfg.sourceHeight === state.map.sourceHeight;
  state.map = cfg;
  setTerrain(terrain, sim, source);
  statusbar.setMap(cfg);
  clearSelection();
  if (keepView && sameSize) setView(state.view);
  else fit();
}

// ---------- Imports, Reload, Map settings ----------

let worker = null;

// Decodes the image(s) at map size and builds terrain in the worker.
async function buildFromSource(source, cfg) {
  const bitmap = await decodeImage(source.file, cfg.sourceWidth, cfg.sourceHeight);
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
  if (source.bitmap && source.bitmap !== bitmap) source.bitmap.close();
  const terrain = makeTerrain(cfg.sourceWidth, cfg.sourceHeight, result.elevation);
  return { terrain, sim: result.sim, source: { ...source, bitmap }, info: result.info, ms: result.ms };
}

async function importMap(payload) {
  if (!worker) throw new Error('The simulation worker is not running.');
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
  };
  const built = await buildFromSource(source, cfg);
  applyMap(cfg, built.terrain, built.sim, built.source);
  contextbar.flash(`Imported ${payload.file.name} (${cfg.sourceWidth} × ${cfg.sourceHeight}) in ${(built.ms / 1000).toFixed(1)} s.`);
}

async function reloadMap() {
  const src = store.source;
  if (!src) {
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
      // A different size: reopen the import dialog, prefilled.
      await importDialog.open({ file, handle, prefill: { kind: src.kind, storedSettings: src.storedSettings, cfgValues: state.map } });
      return;
    }
    const mask = src.mask?.handle ? { ...src.mask, file: await src.mask.handle.getFile() } : src.mask;
    contextbar.flash(`Reloading ${file.name}…`);
    const built = await buildFromSource({ ...src, file, handle, mask }, state.map);
    applyMap(state.map, built.terrain, built.sim, built.source, { keepView: true });
    contextbar.flash(`Reloaded ${file.name}.`);
  } catch (err) {
    contextbar.flash(`Reload failed: ${err.message}`, 8000);
  }
}

async function applyMapSettings(values) {
  const cfg = createMapConfig({ ...values, sourceWidth: state.map.sourceWidth, sourceHeight: state.map.sourceHeight });
  if (!store.source) {
    // Blank map: just apply the new extent.
    applyMap(cfg, store.terrain, downsampleTerrain(store.terrain, cfg), null, { keepView: true });
    return;
  }
  const built = await buildFromSource(store.source, cfg);
  applyMap(cfg, built.terrain, built.sim, built.source, { keepView: true });
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
    submenu: t.children.map((c) => ({ label: c.label, milestone: c.milestone, action: () => setTool(t.id) })),
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

const newMapDialog = createNewMapDialog($('newmap-dialog'), { onCreate: setMap });
const importDialog = createImportDialog($('import-dialog'), {
  worker: { request: (...args) => worker.request(...args) },
  getCurrentMap: () => state.map,
  onImport: importMap,
});
const mapSettingsDialog = createMapSettingsDialog($('mapsettings-dialog'), { onApply: applyMapSettings });

createMenuBar($('menubar'), [
  {
    label: 'File',
    items: () => [
      { label: 'New Map…', action: () => newMapDialog.open(state.map) },
      { separator: true },
      { label: 'Import Map Image…', milestone: '2a', action: () => importDialog.openFromPicker().catch((err) => contextbar.flash(err.message, 8000)) },
      { label: 'Reload Map Image', shortcut: 'Shift+R', milestone: '2a', action: reloadMap },
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
      { label: 'Undo', shortcut: 'Ctrl+Z', milestone: '2b' },
      { label: 'Redo', shortcut: 'Ctrl+Y', milestone: '2b' },
      { separator: true },
      { label: 'Map Settings…', milestone: '2a', action: () => mapSettingsDialog.open(state.map, Boolean(store.source)) },
    ],
  },
  {
    label: 'View',
    items: () => [
      { label: 'Overlays', submenu: overlayMenuItems },
      { label: 'Hover Tooltip', checked: state.tooltipOn, action: () => setTooltip(!state.tooltipOn) },
      { label: 'Tool Palette', milestone: '2b' },
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
});

// ---------- Keyboard ----------

window.addEventListener('keydown', (e) => {
  if (e.defaultPrevented) return; // a menu, tab list, or field already handled it
  const dialogOpen = Boolean(document.querySelector('dialog[open]'));
  if (e.key === 'Escape') {
    if (dialogOpen) return; // the dialog closes itself
    if (isMenuOpen()) { closeMenus({ returnFocus: true }); return; }
    if (isTypingTarget(e.target)) { e.target.blur(); return; }
    if (contextbar.isPlanetOpen()) contextbar.closePlanet();
    setTool('navigate');
    return;
  }
  if (isMenuOpen()) return;
  if (shouldIgnoreHotkey({ target: e.target, dialogOpen, ctrlKey: e.ctrlKey, altKey: e.altKey, metaKey: e.metaKey })) return;

  if (e.shiftKey && e.key === KEYS.reload) {
    e.preventDefault();
    if (isAvailable('2a')) reloadMap();
    return;
  }
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
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
    worker.request('ping').then(() => statusbar.setWorker('ready'));
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
