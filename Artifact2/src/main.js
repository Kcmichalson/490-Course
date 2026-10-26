// App entry: state, wiring, and the render loop.

import {
  DEFAULT_MAP, createMapConfig, simGridSize, newMapConfig, importConfig, settingsConfig,
} from './sim/mapconfig.js';
import { blankTerrain, makeTerrain, isOceanCategory, isLand, CATEGORY_LABELS } from './sim/terrain.js';
import { ruggednessAt } from './sim/slope.js';
import { downsampleTerrain, downsampleRegion, cloneSim } from './sim/downsample.js';
import { createEdits, cloneEdits, writableTerrain, composeRect, addDirty, isEmptyEdits } from './sim/edits.js';
import { applyDab, strokeDabs, BRUSH_IDS } from './sim/brushes.js';
import { liveState, snapshotOf, stateEntry, strokeEntry, bitmapsOf, hasImport, withArt } from './sim/mapstate.js';
import { createPlanet, createSeason, dayLengthText } from './sim/planet.js';
import { createClimateCache, climateRequestFor } from './sim/climatecache.js';
import { simSurfaceElevation } from './sim/temperature.js';
import { pixelTemperature, pixelMonths } from './sim/climatefield.js';
import {
  curveStats, growingDays, freezingDegreeDays, frostClass, FROST_LABELS, MONTH_NAMES,
} from './sim/climatestats.js';
import {
  pixelToLatLon, latLonToPixel, sourcePixel, sourceToSimCell, formatLatLon, parseLatLon, wrapX, simCellBounds,
} from './sim/coords.js';
import {
  fitView, scaleLimits, zoomAt, zoomToScale, panBy, centerOn, clampView, screenToSource, zoomPercent,
} from './render/viewport.js';
import { MapView } from './render/mapview.js';
import { CATEGORIES, getMode, modesInCategory } from './render/modes.js';
import { OVERLAYS, defaultOverlayState } from './render/overlays.js';
import { renderLegend } from './render/legend.js';
import { TEMPERATURE_MODES, PRECIP_MODES } from './render/modes/index.js';
import { precipCtx, hydroCtx } from './render/modes/precipitation.js';
import { pixelPrecip, pixelAnnualMm, seasonalityClassAt, aridityAt } from './sim/precipfield.js';
import { SEASONALITY_LABELS, SEASONALITY_TOO_DRY, ARIDITY_LABELS, ARIDITY_COLD } from './sim/hydrostats.js';
import { koppenCtx, setKoppenSettings, onKoppenSettings } from './render/modes/koppen.js';
import { koppenAt, landWeights } from './sim/koppenfield.js';
import { KOPPEN_CODES, KOPPEN_NAMES } from './sim/koppen.js';
import { setClimateRasterListener, climateCtx } from './render/climateraster.js';
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
import { createImportDialog, artAspectNotice, DEFAULT_SETTINGS } from './ui/importdialog.js';
import { EARTH_MAP, EARTH_PLANET, earthPrefill } from './io/earthmap.js';
import { createMapSettingsDialog } from './ui/mapsettingsdialog.js';
import { formatMeters } from './ui/statusbar.js';
import { createHistory } from './ui/history.js';
import { createSculptPanel, BRUSH_SIZE, BRUSH_STRENGTH } from './ui/sculptpanel.js';
import { createConfirmDialog } from './ui/confirmdialog.js';
import { createPlanetPanel } from './ui/planetpanel.js';
import { latestOnly } from './ui/debounce.js';
import { sampleWind } from './render/windarrows.js';
import { tileSummary, summaryFileName } from './io/tilesummary.js';
import { encodeMapData, mapDataFileName, MAP_DATA_LAYERS, KOPPEN_WATER } from './io/mapdata.js';
import { createChatPanel } from './ui/chatpanel.js';
import { placeEllipse, placeScale } from './ui/places.js';
import {
  createBridgeClient, errorText, isCompanionOrigin, recentHistory, LOCAL_ONLY_NOTE,
} from './ui/chatclient.js';

const $ = (id) => document.getElementById(id);

// ---------- State ----------

// Planet settings (SPEC 3) persist in fcm:planet. The radius belongs to the
// map config; the saved radius only seeds the startup map.
const savedPlanet = load('planet', null) ?? {};

function initialMap() {
  const saved = load('newMap', DEFAULT_MAP) ?? DEFAULT_MAP;
  for (const opts of [{ ...saved, radiusKm: savedPlanet.radiusKm ?? saved.radiusKm }, saved, {}]) {
    try {
      return createMapConfig(opts);
    } catch { /* try the next fallback */ }
  }
  return createMapConfig();
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
  planet: createPlanet(savedPlanet),
  season: createSeason(savedPlanet.season),
  tiltPreview: null, // axial tilt while its slider is being dragged (tropics follow live)
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
// `simVersion` changes whenever the sim grid changes (cell elevations), and
// `landVersion` only when a sim cell's category changes (the land/sea
// layout the continentality tracer follows, M4).
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
  simVersion: 1,
  landVersion: 1,
  coast: null, // Distance from Coast result: { data, width, height, version, mask }
  // climate result on show: { result, grid, key, version, planet, season,
  // thermal (continentality { s, maritime, coast } when temperature ran) }
  climate: null,
};

function savePrefs() {
  const { modeId, categoryId, overlays, tooltipOn, legendOn, brush } = state;
  save('ui', { modeId, categoryId, overlays, tooltipOn, legendOn, brush });
}

function savePlanet() {
  save('planet', { ...state.planet, season: state.season, radiusKm: state.map.radiusKm });
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
  return [$('overlay-control'), $('legend'), $('chat-panel')]
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
    planet: state.tiltPreview == null ? state.planet : { ...state.planet, tiltDeg: state.tiltPreview },
    places: chatPlace ? [{ ...placeEllipse(state.map, chatPlace), name: chatPlace.name, flagged: chatPlace.flagged }] : [],
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
    statusbar.setClimate(null);
    inspector.hide();
    return;
  }
  const src = screenToSource(state.view, hover.x, hover.y);
  const ll = pixelToLatLon(state.map, src.x, src.y);
  if (!ll) {
    statusbar.setCursor(null, true);
    statusbar.setElevation(null);
    statusbar.setClimate(null);
    inspector.hide();
    return;
  }
  const text = formatLatLon(ll);
  if (state.toolId === 'sculpt') sculptPanel.setKm(brushKmText(ll.lat));
  const px = sourcePixel(state.map, src.x, src.y);
  const meters = store.terrain.elevation[px.py * store.terrain.width + px.px];
  const kp = koppenAtPixel(px);
  statusbar.setCursor(text);
  statusbar.setElevation(meters);
  statusbar.setClimate(kp ? KOPPEN_CODES[kp.cls] : null);
  if (!state.tooltipOn || hover.dragging) {
    inspector.hide();
    return;
  }
  const cell = sourceToSimCell(state.map, src.x, src.y);
  inspector.show(hover.x, hover.y, {
    latLon: text,
    elevation: formatMeters(meters),
    lines: [
      dayLengthText(ll.lat, state.planet, state.season), temperatureReadout(px), precipitationReadout(px), koppenReadout(kp), windReadout(src),
      modeReadout(px, cell, kp),
    ],
    ...px,
    ...cell,
  });
}

// The current climate result, if it matches the map, planet, season, and
// terrain (else null: e.g. no climate view is on, or a new run hasn't
// arrived yet).
function currentClimate() {
  const c = store.climate;
  return c && c.key === climateRequest().key ? c : null;
}

const fmtC = (t) => `${t < 0 ? '−' : ''}${Math.abs(t).toFixed(1)} °C`;

// "Summer 18.2 °C (Jul) · Winter −31.5 °C (Jan)" (SPEC 13.5): the warmest
// and coldest month at this pixel's own elevation. '' until temperature runs.
// While a stroke's sim update is pending it still shows the last result.
function temperatureReadout(px) {
  const c = store.climate;
  const ctx = c?.thermal ? climateCtx('monthly', state.map, store.terrain, c) : null;
  if (!ctx) return '';
  const st = curveStats(pixelMonths(ctx, px.px, px.py));
  return `Summer ${fmtC(st.warmest)} (${MONTH_NAMES[st.warmMonth]}) · Winter ${fmtC(st.coldest)} (${MONTH_NAMES[st.coldMonth]})`;
}

// "Precipitation 1,234 mm/yr" (SPEC 13.5): the 12 monthly means summed at
// this pixel. Shown only when the 12-month set for the current terrain and
// planet is already computed (a precipitation mode ran it); the tooltip
// never starts a precipitation run itself (Session 8, A8).
function precipitationReadout(px) {
  const c = store.climate;
  const req = climateRequest();
  const hydro = req.thermalKey ? hydros.get(req.thermalKey) : null;
  const ctx = hydro && c ? precipCtx(state.map, store.terrain, c, hydro.annual) : null;
  if (!ctx) return '';
  return `Precipitation ${Math.round(12 * pixelPrecip(ctx, px.px, px.py)).toLocaleString('en-US')} mm/yr`;
}

// Köppen at a pixel (SPEC 8, M6a): { cls, warmest, coldest, mat, precip,
// pth }, or null on water or while the 12-month precipitation set for the
// current terrain and planet hasn't been computed (a precipitation or Köppen
// mode runs it; the tooltip and status bar never start a run, as A8).
function koppenAtPixel(px) {
  const c = store.climate;
  if (!c?.thermal || !isLand(store.terrain, px.py * store.terrain.width + px.px)) return null;
  const req = climateRequest();
  const hydro = req.thermalKey ? hydros.get(req.thermalKey) : null;
  const ctx = hydro ? koppenCtx(state.map, store.terrain, { ...c, hydro }) : null;
  return ctx ? koppenAt(ctx, px.px, px.py) : null;
}

// "Köppen Cfb (temperate oceanic)" (SPEC 13.5).
function koppenReadout(kp) {
  if (!kp) return '';
  const code = KOPPEN_CODES[kp.cls];
  return `Köppen ${code} (${KOPPEN_NAMES[code]})`;
}

// Köppen mode: what decided the class.
function koppenModeReadout(kp) {
  if (!kp) return '';
  return `Warmest ${fmtC(kp.warmest)} · coldest ${fmtC(kp.coldest)} · P ${fmtMm(kp.precip.annual)} mm/yr (dry below ${fmtMm(Math.max(0, kp.pth))})`;
}

// The temperature modes' own readouts.
function temperatureModeReadout({ px, py }) {
  const c = store.climate;
  if (!c?.thermal) return '';
  if (state.modeId === 'temperature') {
    const ctx = climateCtx('season', state.map, store.terrain, c);
    return ctx ? `Temperature ${fmtC(pixelTemperature(ctx, px, py))} (${c.season.annual ? 'Annual Mean' : `day ${c.season.day}`})` : '';
  }
  const ctx = climateCtx('monthly', state.map, store.terrain, c);
  if (!ctx) return '';
  const i = py * store.terrain.width + px;
  const water = !isLand(store.terrain, i);
  const t = pixelMonths(ctx, px, py);
  const st = curveStats(t);
  if (state.modeId === 'temp-range') return `Range ${(st.warmest - st.coldest).toFixed(1)} °C (warmest − coldest month)`;
  if (water) return '';
  if (state.modeId === 'growing-season') return `Growing season ${Math.round(growingDays(t))} days (mean ≥ 5 °C)`;
  if (state.modeId === 'winter-severity') return `Winter: ${Math.round(freezingDegreeDays(t)).toLocaleString('en-US')} freezing degree-days`;
  if (state.modeId === 'frost') return `${FROST_LABELS[frostClass(st.warmest, st.coldest, st.mean)]} (mean annual ${fmtC(st.mean)})`;
  return '';
}

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

// The wind at a source point: { fromDeg, compass, speed, season } (the
// direction it blows from; in Annual Mean, the prevailing wind), or
// { variable, meanSpeed, season } when the Annual Mean is near calm; null
// while no wind data is loaded.
function windAt(src) {
  const c = currentClimate();
  if (!c) return null;
  const w = sampleWind(c, state.map, wrapX(state.map, src.x), src.y);
  const mag = Math.hypot(w.u, w.v);
  const season = c.result.meta.annual ? 'Annual Mean' : `day ${c.season.day}`;
  if (c.result.meta.annual && mag < 0.05) return { variable: true, meanSpeed: w.speed, season };
  const from = ((Math.atan2(-w.u, -w.v) * 180) / Math.PI + 360) % 360;
  return { fromDeg: Math.round(from) % 360, compass: COMPASS[Math.round(from / 22.5) % 16], speed: mag, season };
}

// "Wind from ENE (68°) · 0.82" (SPEC 13.5). '' while no wind data is loaded.
function windReadout(src) {
  const w = windAt(src);
  if (!w) return '';
  if (w.variable) return `Wind variable (mean speed ${w.meanSpeed.toFixed(2)})`;
  return `Wind from ${w.compass} (${w.fromDeg}°) · ${w.speed.toFixed(2)}`;
}

// An extra tooltip line for the current mode, or ''.
function modeReadout({ px, py }, cell, kp) {
  if (state.modeId === 'koppen') return koppenModeReadout(kp);
  if (state.modeId === 'wind-pressure') {
    const c = currentClimate();
    if (!c || !cell) return '';
    const p = c.result.pressure[cell.j * c.grid.width + cell.i];
    return `Pressure: ${p >= 0 ? 'high' : 'low'} (${p >= 0 ? '+' : '−'}${Math.abs(p).toFixed(2)})`;
  }
  if (TEMPERATURE_MODES.has(state.modeId)) return temperatureModeReadout({ px, py });
  if (state.modeId === 'precipitation') {
    const c = currentClimate();
    const ctx = c ? precipCtx(state.map, store.terrain, c) : null;
    if (!ctx) return '';
    const mm = pixelPrecip(ctx, px, py);
    return `Precipitation ${mm < 10 ? mm.toFixed(1) : Math.round(mm)} mm/month (${c.season.annual ? 'Annual Mean' : `day ${c.season.day}`})`;
  }
  if (PRECIP_MODES.has(state.modeId)) return weatherModeReadout({ px, py }, cell);
  if (state.modeId !== 'slope') return '';
  const i = py * store.terrain.width + px;
  if (!isLand(store.terrain, i)) return 'Ruggedness (TRI): water';
  return `Ruggedness (TRI): ${Math.round(ruggednessAt(store.terrain, state.map.wraps, px, py)).toLocaleString('en-US')} m`;
}

const fmtMm = (mm) => (mm < 10 ? mm.toFixed(1) : Math.round(mm).toLocaleString('en-US'));

// Seasonality, Aridity, and Cloud Cover readouts (SPEC 13.3 M5). The wettest
// and driest month come from the nearest sim cell (a month can't be
// interpolated); the index and totals are bilinear, like the mode colors.
function weatherModeReadout({ px, py }, cell) {
  const c = currentClimate();
  const ctx = c ? hydroCtx(state.map, store.terrain, c) : null;
  if (!ctx) return '';
  if (state.modeId === 'cloud-cover') return `Cloud cover ${Math.round(100 * pixelPrecip(ctx, px, py, ctx.cloud))}%`;
  if (!isLand(store.terrain, py * store.terrain.width + px)) return '';
  if (state.modeId === 'aridity') {
    const a = aridityAt(ctx, px, py);
    const totals = `P ${fmtMm(a.p)} / PET ${fmtMm(a.pet)} mm/yr`;
    return a.cls === ARIDITY_COLD ? `Aridity: cold (PET under 100 mm/yr) · ${totals}` : `Aridity ${a.ai.toFixed(2)} (${ARIDITY_LABELS[a.cls]}) · ${totals}`;
  }
  if (!cell) return '';
  const k = cell.j * c.grid.width + cell.i;
  const s = ctx.stats;
  const months = `wettest ${MONTH_NAMES[s.wetMonth[k]]} ${fmtMm(s.wetMm[k])} · driest ${MONTH_NAMES[s.dryMonth[k]]} ${fmtMm(s.dryMm[k])} mm`;
  const cls = seasonalityClassAt(ctx, px, py);
  if (cls === SEASONALITY_TOO_DRY) return `Seasonality: too dry to tell (${fmtMm(pixelAnnualMm(ctx, px, py))} mm/yr) · ${months}`;
  return `Seasonality ${pixelPrecip(ctx, px, py, s.seasonality).toFixed(2)} (${SEASONALITY_LABELS[cls]}) · ${months}`;
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
  const kmPerPx = ((state.map.lonSpan / state.map.sourceWidth) * Math.PI / 180) * state.map.radiusKm * Math.cos((lat * Math.PI) / 180);
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

// Export climate summary (Artifact 3): the selected land tile's climate as a
// small JSON download for tools/companion.py. Reads only what the sim has
// already computed (no new sim logic): the Köppen class and monthly
// temperatures at the pixel, the worker's cached monthly rain (Köppen's
// land-only weights), the tooltip's wind, and the Distance from Coast job.
async function exportClimateSummary() {
  const sel = state.selected;
  if (!sel || !worker) return;
  const px = sourcePixel(state.map, sel.x, sel.y);
  const i = px.py * store.terrain.width + px.px;
  if (!isLand(store.terrain, i)) {
    contextbar.flash('Climate summary is for land tiles.');
    return;
  }
  const c = store.climate;
  const req = climateRequest();
  const hydro = c?.thermal && req.thermalKey ? hydros.get(req.thermalKey) : null;
  const ctx = hydro ? koppenCtx(state.map, store.terrain, { ...c, hydro }) : null;
  if (!ctx) {
    contextbar.flash('Open Köppen mode (Q) once to compute rainfall, then export again.', 6000);
    return;
  }
  const ll = pixelToLatLon(state.map, sel.x, sel.y);
  const kp = koppenAt(ctx, px.px, px.py);
  const code = KOPPEN_CODES[kp.cls];
  const temps = Array.from(pixelMonths(ctx, px.px, px.py));
  const wind = windAt(sel);
  const idx = new Int32Array(4);
  const w = new Float64Array(4);
  landWeights(ctx, px.px, px.py, idx, w);
  const { monthly } = await worker.request('tileRain', { hydroKey: req.thermalKey, idx: Array.from(idx), w: Array.from(w) });
  const coast = await currentCoast();
  const summary = tileSummary({
    lat: ll.lat,
    lon: ll.lon,
    elevationM: store.terrain.elevation[i],
    category: CATEGORY_LABELS[store.terrain.category[i]],
    koppenCode: code,
    koppenName: KOPPEN_NAMES[code],
    temps,
    rain: monthly,
    wind,
    coastKm: coast.data[i],
  });
  const name = summaryFileName(ll.lat, ll.lon);
  const url = URL.createObjectURL(new Blob([`${JSON.stringify(summary, null, 2)}\n`], { type: 'application/json' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: name });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  contextbar.flash(`Exported ${name}`);
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), { href: url, download: name }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Export Map Data (map-wide companion): every sim cell's climate as one
// gzip file for tools/mapquery.py. Each cell is sampled at its center
// source pixel with the tile export's functions (pixelMonths, koppenAt,
// Köppen's land-only rain weights, the current wind). No new sim logic.
async function exportMapData() {
  if (!worker) return;
  if (!mapDataReady()) {
    contextbar.flash('Open Köppen mode (Q) once to compute rainfall, then export again.', 6000);
    return;
  }
  contextbar.flash('Exporting map data…', 60000);
  const { gz, name } = await buildMapData();
  downloadBlob(gz, name);
  contextbar.flash(`Exported ${name} (${(gz.size / 1e6).toFixed(1)} MB)`);
}

// Export Map Data's inputs exist: the 12-month rain for the current
// terrain and planet (a Köppen or precipitation mode ran it).
function mapDataKoppenCtx() {
  const c = store.climate;
  const req = climateRequest();
  const hydro = c?.thermal && req.thermalKey ? hydros.get(req.thermalKey) : null;
  return hydro ? koppenCtx(state.map, store.terrain, { ...c, hydro }) : null;
}
const mapDataReady = () => Boolean(worker && mapDataKoppenCtx());
// Changes whenever the map data would (terrain, planet, grid).
const mapDataKey = () => `${store.version}|${climateRequest().thermalKey}`;

// The Export Map Data file as a gzip Blob: { gz, name }. Callers check
// mapDataReady() first.
async function buildMapData() {
  const ctx = mapDataKoppenCtx();
  const req = climateRequest();
  const { months } = await worker.request('rainMonths', { hydroKey: req.thermalKey });
  await new Promise((r) => setTimeout(r, 30)); // let the message paint
  const map = state.map;
  const terrain = store.terrain;
  const { width: W, height: H } = simGridSize(map);
  const values = Object.fromEntries(MAP_DATA_LAYERS.map((l) => [l.name, new Float32Array(W * H)]));
  const temps = MAP_DATA_LAYERS.filter((l) => l.name.startsWith('temp_')).map((l) => values[l.name]);
  const rains = MAP_DATA_LAYERS.filter((l) => l.name.startsWith('rain_')).map((l) => values[l.name]);
  const windClimate = currentClimate();
  const idx = new Int32Array(4);
  const w = new Float64Array(4);
  const t = new Float64Array(12);
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const b = simCellBounds(map, i, j);
      const px = Math.min(terrain.width - 1, Math.floor((b.x0 + b.x1) / 2));
      const py = Math.min(terrain.height - 1, Math.floor((b.y0 + b.y1) / 2));
      const k = j * W + i;
      const p = py * terrain.width + px;
      values.elevation[k] = terrain.elevation[p];
      values.category[k] = terrain.category[p];
      pixelMonths(ctx, px, py, t);
      for (let m = 0; m < 12; m++) temps[m][k] = t[m];
      if (isLand(terrain, p)) {
        values.koppen[k] = koppenAt(ctx, px, py).cls;
        landWeights(ctx, px, py, idx, w);
        for (let m = 0; m < 12; m++) rains[m][k] = w[0] * months[m][idx[0]] + w[1] * months[m][idx[1]] + w[2] * months[m][idx[2]] + w[3] * months[m][idx[3]];
      } else {
        values.koppen[k] = KOPPEN_WATER;
        for (let m = 0; m < 12; m++) rains[m][k] = months[m][k];
      }
      if (windClimate) {
        const wind = sampleWind(windClimate, map, px + 0.5, py + 0.5);
        values.wind_u[k] = wind.u;
        values.wind_v[k] = wind.v;
      }
    }
  }
  const header = {
    width: W,
    height: H,
    source_width: map.sourceWidth,
    source_height: map.sourceHeight,
    lat_top: map.latTop,
    lat_bottom: map.latBottom,
    lon_west: map.lonWest,
    lon_span: map.lonSpan,
    wraps: map.wraps,
    radius_km: map.radiusKm,
    cell_sample: 'center source pixel of each cell',
    wind_season: windClimate ? (windClimate.result.meta.annual ? 'Annual Mean' : `day ${windClimate.season.day}`) : null,
    categories: CATEGORY_LABELS,
    koppen_codes: KOPPEN_CODES,
    koppen_names: KOPPEN_NAMES,
    months: MONTH_NAMES,
  };
  const bytes = encodeMapData(header, values);
  const gz = await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).blob();
  return { gz, name: mapDataFileName(W, H) };
}

// Export Map Picture: the current mode at up to 2048 px wide, with the
// graticule and latitude labels, as a PNG.
const PICTURE_WIDTH = 2048;
async function exportMapPicture() {
  const canvas = mapView.picture(Math.min(PICTURE_WIDTH, state.map.sourceWidth), {
    map: state.map, mode: getMode(state.modeId), store, overlays: state.overlays, planet: state.planet,
  });
  if (!canvas) return;
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  const name = `fcm-map-${state.modeId}.png`;
  downloadBlob(blob, name);
  contextbar.flash(`Exported ${name} (${canvas.width} × ${canvas.height})`);
}

// The Distance from Coast layer for the current land/sea layout: the mode's
// result when it is current, else the same worker job run now (not kept).
async function currentCoast() {
  const cur = store.coast;
  if (cur && !coastJob.stale && !coastJob.pending && cur.width === state.map.sourceWidth && cur.height === state.map.sourceHeight) return cur;
  contextbar.flash('Measuring distance from the coast…');
  const category = store.terrain.category.slice();
  return worker.request('coastDistance', { category, cfg: { ...state.map } }, [category.buffer]);
}

// ---------- Actions ----------

function refreshUI() {
  toolbar.update(state);
  overlayPanel.update(state.overlays);
  contextbar.setTool(state.toolId, state.toolId === 'sculpt' ? sculptPanel.element : null);
  const legend = $('legend');
  renderLegend(legend, getMode(state.modeId), state.overlays);
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
  ensureClimate();
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
  ensureClimate();
  requestDraw();
}

function setTooltip(on) {
  state.tooltipOn = on;
  savePrefs();
  ensureClimate(); // the tooltip shows summer and winter temperature
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
  // Load Earth Map's entry also carries the planet settings (one undo step
  // with the map); other snapshots leave the planet alone.
  if (snap.planet) {
    state.planet = createPlanet(snap.planet.planet);
    state.season = createSeason(snap.planet.season);
    state.tiltPreview = null;
    planetPanel?.setPlanet(state.planet);
    planetPanel?.setSeason(state.season);
    toolbar?.setSeason(state.season);
  }
  Object.assign(store, {
    base: live.base, baseSim: live.baseSim, edits: live.edits, terrain: live.terrain, sim: live.sim, source: live.source,
  });
  store.version++;
  store.simVersion++;
  store.landVersion++;
  markCoastStale();
  // A wind result for another sim grid or latitude range can't be drawn here.
  if (store.climate && climateGridKey(store.climate.grid) !== climateGridKey(climateGrid(state.map))) store.climate = null;
  ensureClimate();
  // The radius lives in the map: undo/redo and every map change move the
  // Planet panel's radius slider, and the saved radius follows.
  planetPanel?.setRadius(state.map.radiusKm);
  savePlanet();
  statusbar.setMap(state.map);
  clearSelection();
  if (keepView && sameSize) setView(state.view);
  else fit();
}

// A wholesale change (New Map, Import, Reload, Map settings), undoable.
// opts.planet ({ planet, season }; Load Earth Map) makes the planet settings
// part of the same undo step: before keeps the current ones.
function commitState(label, after, opts = {}) {
  const before = snapshotOf(currentState());
  if (opts.planet) {
    before.planet = { planet: state.planet, season: state.season };
    after = { ...after, planet: { planet: opts.planet.planet, season: opts.planet.season } };
  }
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
  cfg = newMapConfig(cfg, state.map); // New Map keeps the planet's radius
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
  const before = store.sim.category.slice();
  let landChanged = false;
  for (const r of rects) {
    const cells = downsampleRegion(store.terrain, state.map, store.sim, r);
    if (!cells || landChanged) continue;
    for (let j = cells.j0; j < cells.j1 && !landChanged; j++) {
      for (let i = cells.i0; i < cells.i1; i++) {
        const k = j * store.sim.width + i;
        if (before[k] !== store.sim.category[k]) { landChanged = true; break; }
      }
    }
  }
  store.simVersion++;
  if (landChanged) store.landVersion++; // the tracer reruns over the whole map
  ensureClimate();
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

// ---- Climate (SPEC 4, 6, 12): a worker job per season, cached per season.
// Wind alone runs while a wind view is showing (M3). Temperature (M4) runs
// while a temperature mode, Climate Boundaries, or the hover tooltip (summer
// and winter temperature) is on, and then the wind runs with it, since
// temperature follows the wind. Temperature keys add the terrain (sim and
// land versions) and the km grid. Until a new result arrives the views show
// the previous one. One job runs at a time; when it ends, the latest
// settings are requested next (so a burst of strokes doesn't queue up whole
// tracer runs). ----

const climateCache = createClimateCache();
const climateJob = { busy: false };

// Continentality layers by thermal key (the slow part; season-independent).
// A few are kept, so switching back and forth doesn't rerun the tracer.
const thermals = new Map();
function rememberThermal(key, value) {
  thermals.delete(key);
  thermals.set(key, value);
  while (thermals.size > 3) thermals.delete(thermals.keys().next().value);
}

// The 12-month precipitation set (M5; main keeps only its annual mean and
// the weather modes' statistics, the worker the monthly layers), by the same
// thermal key. Two are kept.
const hydros = new Map();
function rememberHydro(key, value) {
  hydros.delete(key);
  hydros.set(key, value);
  while (hydros.size > 2) hydros.delete(hydros.keys().next().value);
}

// The sim grid the climate runs on, with its km size (radius, span, wrap).
function climateGrid(map) {
  return {
    ...simGridSize(map), latTop: map.latTop, latBottom: map.latBottom, lonSpan: map.lonSpan, wraps: map.wraps, radiusKm: map.radiusKm,
  };
}
const climateGridKey = (g) => `${g.width}x${g.height}|${g.latTop}|${g.latBottom}`;

const windViewShown = () => state.modeId === 'wind-pressure' || Boolean(state.overlays['wind-arrows'] || state.overlays['pressure-itcz']);
const temperatureViewShown = () => TEMPERATURE_MODES.has(state.modeId) || Boolean(state.overlays['climate-boundaries']);
// Precipitation (M5) runs only while a precipitation mode is shown; it needs
// the temperature, so that runs with it.
const precipViewShown = () => PRECIP_MODES.has(state.modeId);
const temperatureNeeded = () => temperatureViewShown() || state.tooltipOn || precipViewShown();

// What the current settings need: { grid, planet, season, key, temp, thermalKey?,
// boundaryKey?, precip?, hydroKey? }. Every climate view sends the terrain
// from M4b (see climateRequestFor).
function climateRequest() {
  const views = { wind: windViewShown(), temperature: temperatureNeeded(), precipitation: precipViewShown() };
  return climateRequestFor(climateGrid(state.map), state.planet, state.season, views, store.landVersion, store.simVersion);
}

function showClimate(result, req) {
  store.climate = {
    result, grid: req.grid, key: req.key, planet: req.planet, season: req.season,
    thermal: req.temp ? thermals.get(req.thermalKey) ?? null : null,
    hydro: req.precip ? hydros.get(req.hydroKey) ?? null : null,
    version: (store.climate?.version ?? 0) + 1,
  };
  requestDraw();
  updateHover();
}

const simWhat = (req) => (req.precip ? 'wind + temperature + precipitation' : req.temp ? 'wind + temperature' : 'wind');

function simText(result, req) {
  if (!req.temp) return `Sim: wind ${result.ms} ms`;
  const c = result.timing?.continentality;
  const p = result.timing?.precipitation;
  const precip = !req.precip ? '' : p === 'cached' ? ', precipitation reused'
    : `, precipitation ${p} ms${result.timing.precipitationReused ? ' (12 months reused, this day solved)' : ''}`;
  return `Sim: ${simWhat(req)} ${Math.round(result.ms)} ms (continentality ${c === 'cached' ? 'reused' : `${c} ms`}${precip})`;
}

function ensureClimate() {
  if (!worker || (!temperatureNeeded() && !windViewShown())) return;
  const req = climateRequest();
  if (store.climate?.key === req.key) return;
  const cached = climateCache.get(req.key);
  if (cached && (!req.temp || thermals.has(req.thermalKey)) && (!req.precip || hydros.has(req.hydroKey))) {
    statusbar.setSim(`Sim: ${simWhat(req)} (cached)`);
    showClimate(cached, req);
    return;
  }
  if (climateJob.busy) return; // the running job asks again when it ends
  climateJob.busy = true;
  statusbar.setSim(`Sim: computing ${simWhat(req)}…`);
  const msg = { grid: req.grid, planet: { ...req.planet }, season: { ...req.season } };
  const transfer = [];
  if (req.temp) {
    const terrain = { category: store.sim.category.slice(), elevation: simSurfaceElevation(store.sim) };
    Object.assign(msg, {
      terrain, thermalKey: req.thermalKey, boundaryKey: req.boundaryKey, needContinentality: !thermals.has(req.thermalKey),
    });
    if (req.precip) Object.assign(msg, { precip: true, hydroKey: req.hydroKey, needHydro: !hydros.has(req.hydroKey) });
    transfer.push(terrain.category.buffer, terrain.elevation.buffer);
  }
  worker.request('climate', msg, transfer)
    .then((result) => {
      if (result.continentality) rememberThermal(req.thermalKey, result.continentality);
      if (result.hydro) rememberHydro(req.hydroKey, result.hydro);
      const main = climateCache.put(req.grid, req.planet, result, req.key);
      statusbar.setSim(simText(result, req));
      if (climateRequest().key === req.key) showClimate(main, req);
    })
    .catch((err) => {
      statusbar.setSim('Sim: climate failed');
      contextbar.flash(`Climate simulation failed: ${err.message}`, 8000);
    })
    .finally(() => {
      climateJob.busy = false;
      ensureClimate(); // settings changed while this one ran
    });
}

// Köppen settings (SPEC 8: the C/D boundary and the Highland override),
// set in the Köppen legend. They change the classes only, not the sim: a
// change redraws the raster and the readouts.
setKoppenSettings(load('koppen', {}), false);
onKoppenSettings((s) => {
  save('koppen', s);
  requestDraw();
  updateHover();
});

// The chunked temperature raster reports its rows as they arrive.
setClimateRasterListener(({ done, ms, mode }) => {
  requestDraw();
  if (done) statusbar.setSim(`Sim: ${mode} drawn in ${Math.round(ms)} ms (in slices)`);
});

// ---- Planet settings (SPEC 3). Rotation, spin, tilt, lunar pull, and the
// season are settings (persisted, not undoable). The radius is part of the
// map: releasing its slider is an undoable "Planet Radius" change that
// rebuilds the km-based terrain (generated depths, relief, distances). ----

function setPlanet(patch) {
  state.planet = createPlanet({ ...state.planet, ...patch });
  state.tiltPreview = null;
  savePlanet();
  ensureClimate();
  requestDraw();
  updateHover();
}

function setSeason(season) {
  state.season = createSeason(season);
  toolbar.setSeason(state.season);
  planetPanel.setSeason(state.season);
  savePlanet();
  ensureClimate();
  requestDraw();
  updateHover();
}

// One rebuild per settled radius: while one runs, only the latest waits.
const applyRadius = latestOnly(async (km) => {
  if (km === state.map.radiusKm) return;
  if (busy || stroke) {
    contextbar.flash('Another map update is still running; the radius was not changed.');
    planetPanel.setRadius(state.map.radiusKm);
    return;
  }
  try {
    const cfg = createMapConfig({ ...state.map, radiusKm: km });
    if (!hasImport(store.source)) {
      // Blank map: nothing generated from km yet, so only the config changes.
      commitState('Planet Radius', { ...currentState(), map: cfg, edits: cloneEdits(store.edits) }, { keepView: true });
      contextbar.flash(`Planet radius ${km.toLocaleString('en-US')} km (Ctrl+Z reverts it).`);
      return;
    }
    contextbar.flash(`Rebuilding the terrain for a ${km.toLocaleString('en-US')} km radius…`);
    const built = await whileBusy(() => buildFromSource(store.source, cfg));
    commitState('Planet Radius', {
      map: cfg, source: built.source, base: built.base, baseSim: built.baseSim, edits: cloneEdits(store.edits),
    }, { keepView: true });
    contextbar.flash(`Planet radius ${km.toLocaleString('en-US')} km: terrain rebuilt in ${(built.ms / 1000).toFixed(1)} s (Ctrl+Z reverts it).`);
  } catch (err) {
    contextbar.flash(`Radius change failed: ${err.message}`, 8000);
    planetPanel.setRadius(state.map.radiusKm);
  }
});

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
  // Load Earth Map: the import is built on Earth's radius, and the planet
  // settings reset with it (one undo step).
  const earth = Boolean(payload.planetReset);
  let cfg = importConfig(payload.cfgValues, mapSize, state.map);
  if (earth) cfg = createMapConfig({ ...cfg, radiusKm: EARTH_PLANET.radiusKm });
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
  }, earth ? { planet: EARTH_PLANET } : {});
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
  if (earth) note += ' Planet reset to Earth (Ctrl+Z restores the previous map and planet).';
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
  const cfg = settingsConfig(values, state.map);
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

// File > Load Sample Map: opens the import dialog with a bundled test map
// (relative path, so it works locally and on GitHub Pages). Without a file
// handle, Reload falls back to the file picker.
const SAMPLE_MAP = './test-maps/continent_map_2.png';
async function loadSampleMap() {
  await importDialog.open({ file: await fetchTestMap(SAMPLE_MAP) });
}

// A bundled test map as a File (named like the file, no handle).
async function fetchTestMap(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} (${res.status})`);
  const blob = await res.blob();
  const name = path.split('/').pop();
  return new File([blob], name, { type: blob.type || (name.endsWith('.jpg') ? 'image/jpeg' : 'image/png') });
}

// File > Load Earth Map (your Session 10 extra): the GEBCO heightmap and its
// land/sea mask, fetched like Load Sample Map, in the import dialog
// prefilled with the M6a checklist settings. Only the import itself (Import,
// importMap) resets the planet to Earth, as one undo step with the map;
// Cancel changes nothing.
async function loadEarthMap() {
  const [image, mask] = await Promise.all([fetchTestMap(EARTH_MAP.image), fetchTestMap(EARTH_MAP.mask)]);
  await importDialog.open({ file: image, prefill: { ...earthPrefill(DEFAULT_SETTINGS.heightmap), mask: { file: mask } } });
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

// ---- Companion chat (step D): display only. The highlighted place is
// view state like the selection: not saved, not undoable, and never in
// Export Map Picture. ----
let chatPlace = null;

function showPlace(place) {
  const e = placeEllipse(state.map, place);
  if (!pixelToLatLon(state.map, e.x, e.y)) {
    contextbar.flash(`${place.name} (${place.lat}, ${place.lon}) is outside this map.`);
    return;
  }
  chatPlace = place;
  userMoved = true;
  const zoomed = zoomToScale(state.view, placeScale(e, viewW, viewH, limits()), viewW / 2, viewH / 2, limits());
  setView(centerOn(zoomed, e.x, e.y, viewW, viewH));
}

const chatPanel = createChatPanel($('chat-panel'), {
  onShowPlace: showPlace,
  onClearPlace: () => { chatPlace = null; requestDraw(); },
});
// Sending (D3): only from http://127.0.0.1:8000, where serve.py's bridge
// lives. The map goes up with the first message, and again only when it
// changed; the last 6 exchanges are resent each turn.
const chatHistory = [];
const bridgeClient = createBridgeClient();
let uploadedMapKey = null;
let chatAbort = null;
if (!isCompanionOrigin(location.origin)) chatPanel.disable(LOCAL_ONLY_NOTE);

async function sendChat(text) {
  chatPanel.addMessage('user', text);
  chatHistory.push({ role: 'user', text });
  chatPanel.setSending(true);
  chatAbort = new AbortController();
  const signal = chatAbort.signal;
  const ensureMap = async () => {
    if (uploadedMapKey === mapDataKey()) return;
    if (!mapDataReady()) throw { code: 'no_map_data' };
    chatPanel.setThinking(true, 'Sending the map…');
    const key = mapDataKey();
    const { gz } = await buildMapData();
    await bridgeClient.post('/companion/map', gz, signal);
    uploadedMapKey = key;
  };
  const ask = () => {
    chatPanel.setThinking(true, 'Thinking…');
    return bridgeClient.post('/companion/chat', JSON.stringify({ messages: recentHistory(chatHistory) }), signal);
  };
  try {
    await ensureMap();
    let r;
    try {
      r = await ask();
    } catch (err) {
      if (err?.code !== 'no_map') throw err;
      uploadedMapKey = null; // the server restarted and lost the map: send it once more
      await ensureMap();
      r = await ask();
    }
    chatHistory.push({ role: 'assistant', text: r.reply });
    chatPanel.addReply(r.reply, { places: r.places, toolCalls: r.tool_calls });
  } catch (err) {
    chatHistory.pop(); // an unanswered message isn't resent
    chatPanel.addError(errorText(err?.code, err?.message));
  } finally {
    chatAbort = null;
    chatPanel.setThinking(false);
    chatPanel.setSending(false);
    chatPanel.input.focus();
  }
}

chatPanel.form.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = chatPanel.input.value.trim();
  if (!text || chatAbort || !isCompanionOrigin(location.origin)) return;
  chatPanel.input.value = '';
  sendChat(text);
});
chatPanel.cancel.addEventListener('click', () => {
  bridgeClient.post('/companion/cancel', '{}').catch(() => {});
  chatAbort?.abort();
});

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
      { label: 'Load Sample Map', milestone: '2a', action: () => loadSampleMap().catch((err) => contextbar.flash(`Sample map failed: ${err.message}`, 8000)) },
      { label: 'Load Earth Map', milestone: '2a', action: () => loadEarthMap().catch((err) => contextbar.flash(`Earth map failed: ${err.message}`, 8000)) },
      { label: 'Reload Map Image', shortcut: 'Ctrl+Shift+R', milestone: '2a', action: reloadMap },
      { label: 'Art Image…', milestone: '2b', action: () => setArtImage().catch((err) => contextbar.flash(`Art image failed: ${err.message}`, 8000)) },
      { label: 'Remove Art Image', milestone: '2b', disabled: !store.source?.art, action: removeArtImage },
      { separator: true },
      { label: 'Save Project…', milestone: 11 },
      { label: 'Load Project…', milestone: 11 },
      { separator: true },
      { label: 'Export PNG…', milestone: 11 },
      { label: 'Export Map Data', action: () => exportMapData().catch((err) => contextbar.flash(`Map data export failed: ${err.message}`, 8000)) },
      { label: 'Export Map Picture', action: () => exportMapPicture().catch((err) => contextbar.flash(`Map picture export failed: ${err.message}`, 8000)) },
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
  onSeason: setSeason,
  customDay: () => (state.season.annual ? 172 : state.season.day),
});
toolbar.setSeason(state.season);

const planetPanel = createPlanetPanel($('planet-body'), {
  planet: state.planet,
  season: state.season,
  radiusKm: state.map.radiusKm,
  onPlanet: setPlanet,
  onSeason: setSeason,
  onRadius: applyRadius,
  onTiltInput: (tilt) => { state.tiltPreview = tilt; requestDraw(); },
});

const overlayPanel = createOverlayPanel($('overlay-control'), { onToggle: setOverlay });

const contextbar = createContextBar($('contextbar'), {
  planetPanel: $('planet-panel'),
  planetClose: $('planet-close'),
  onClearSelection: clearSelection,
  onExportSummary: () => exportClimateSummary().catch((err) => contextbar.flash(`Export failed: ${err.message}`, 8000)),
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
      console.error(`Simulation worker error: ${e.message || 'no message'} (${e.filename || '?'}:${e.lineno || '?'})`);
    });
    worker = createWorkerClient(w);
    worker.request('ping').then(() => { statusbar.setWorker('ready'); ensureCoast(); ensureClimate(); });
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
