// Full-resolution temperature modes (M4), drawn in chunks so the UI never
// freezes (CLAUDE.md). A 5632×2048 map takes 0.2–0.4 s per mode to compute
// (Node, LOG M4), so the rows are computed in slices of ~10 ms between event
// loop turns, painted into an offscreen raster, and the map view redraws as
// they arrive. Until a new raster is finished, the previous one stays on
// screen (or gray the first time). A brush stroke recomputes just its
// rectangle, at once, with the new elevations.
//
// makeClimateRenderer(modeId, { colors, water, legend, context?, fill? })
// builds a mode renderer: colors[class] = [r, g, b]; water = the muted water
// color for land-only modes. Modes with WATER_FLAG classes draw water darker.
// context(map, terrain, climate) and fill(mode, ctx, y0, y1, out, x0, x1)
// replace the temperature ones for modes drawn from other layers (M5
// precipitation).

import { fillClasses, WATER, WATER_FLAG } from '../sim/climatefield.js';
import { seasonTables, monthlyTables, rowLats } from '../sim/temperature.js';
import { seasonKey } from '../sim/planet.js';

const PENDING = [70, 74, 80];
const WATER_DARKEN = 0.75; // water drawn 25% darker in Temperature and Range
const SLICE_MS = 10;

let onProgress = () => {};
export function setClimateRasterListener(fn) { onProgress = fn; }

// ---- Row tables (memoized: a few ms per build) ----

// A few slots, so the tooltip (monthly) and Temperature mode (season) don't
// keep rebuilding each other's tables.
const tableMemo = new Map();
export function tablesFor(kind, map, planet, season) {
  const key = `${kind}|${planet.tiltDeg}|${kind === 'season' ? seasonKey(season) : ''}|${map.sourceHeight}|${map.latTop}|${map.latBottom}`;
  const hit = tableMemo.get(key);
  if (hit) return hit;
  const lats = rowLats(map.latTop, map.latBottom, map.sourceHeight);
  const tables = kind === 'season' ? seasonTables(lats, planet.tiltDeg, season) : monthlyTables(lats, planet.tiltDeg);
  tableMemo.set(key, tables);
  while (tableMemo.size > 4) tableMemo.delete(tableMemo.keys().next().value);
  return tables;
}

// Context for climatefield.js from the current climate result, or null while
// no temperature has arrived. climate = store.climate.
export function climateCtx(kind, map, terrain, climate) {
  const th = climate?.thermal;
  if (!th || !climate.planet || terrain.width !== map.sourceWidth || terrain.height !== map.sourceHeight) return null;
  return {
    map, elevation: terrain.elevation, category: terrain.category, s: th.s, simW: climate.grid.width, simH: climate.grid.height,
    tables: tablesFor(kind, map, climate.planet, climate.season),
  };
}

// ---- The raster ----

const raster = { key: '', canvas: null, classes: null, next: 0, total: 0, version: 0, timer: 0, job: null, ms: 0 };
export const rasterVersion = () => raster.version;
export const rasterDone = () => raster.total > 0 && raster.next >= raster.total;

function lut(spec) {
  const out = new Uint8ClampedArray(256 * 3);
  for (let c = 0; c < 256; c++) {
    let rgb = PENDING;
    if (c === WATER) rgb = spec.water ?? PENDING;
    else if (c >= WATER_FLAG && spec.colors[c - WATER_FLAG]) rgb = spec.colors[c - WATER_FLAG].map((v) => v * WATER_DARKEN);
    else if (spec.colors[c]) rgb = spec.colors[c];
    out.set(rgb, c * 3);
  }
  return out;
}

// Paints classes of rect into the raster canvas.
function paint(job, x0, y0, x1, y1) {
  const W = job.ctx.map.sourceWidth;
  const w = x1 - x0;
  const img = new ImageData(w, y1 - y0);
  const d = img.data;
  const colors = job.lut;
  for (let y = y0, p = 0; y < y1; y++) {
    for (let x = x0, i = y * W + x0; x < x1; x++, i++, p += 4) {
      const c = raster.classes[i] * 3;
      d[p] = colors[c]; d[p + 1] = colors[c + 1]; d[p + 2] = colors[c + 2]; d[p + 3] = 255;
    }
  }
  raster.canvas.getContext('2d').putImageData(img, x0, y0);
}

function slice() {
  raster.timer = 0;
  const job = raster.job;
  if (!job) return;
  const H = job.ctx.map.sourceHeight;
  const W = job.ctx.map.sourceWidth;
  const t0 = performance.now();
  // Rows per step: about 1 ms of work, so a slice stays near SLICE_MS.
  const step = Math.max(1, Math.round(200000 / W));
  while (raster.next < H && performance.now() - t0 < SLICE_MS) {
    const y0 = raster.next;
    const y1 = Math.min(H, y0 + step);
    job.fill(job.mode, job.ctx, y0, y1, raster.classes);
    paint(job, 0, y0, W, y1);
    raster.next = y1;
  }
  raster.ms += performance.now() - t0;
  raster.version++;
  onProgress({ done: raster.next >= H, rows: raster.next, total: H, ms: raster.ms, mode: job.mode });
  if (raster.next < H) raster.timer = setTimeout(slice, 0);
}

// Starts (or keeps) the raster for a mode. key = everything it depends on.
function ensureRaster(mode, spec, args, key) {
  const { map } = args;
  if (!raster.canvas || raster.canvas.width !== map.sourceWidth || raster.canvas.height !== map.sourceHeight) {
    raster.canvas = document.createElement('canvas');
    raster.canvas.width = map.sourceWidth;
    raster.canvas.height = map.sourceHeight;
    const g = raster.canvas.getContext('2d');
    g.fillStyle = `rgb(${PENDING.join(', ')})`;
    g.fillRect(0, 0, map.sourceWidth, map.sourceHeight);
    raster.classes = new Uint8Array(map.sourceWidth * map.sourceHeight);
    raster.key = '';
  }
  if (raster.key === key) return true;
  const ctx = spec.context
    ? spec.context(map, args.terrain, args.climate)
    : climateCtx(mode === 'temperature' ? 'season' : 'monthly', map, args.terrain, args.climate);
  if (!ctx) return false;
  clearTimeout(raster.timer);
  raster.key = key;
  raster.job = { mode, ctx, lut: lut(spec), fill: spec.fill ?? fillClasses };
  raster.next = 0;
  raster.total = map.sourceHeight;
  raster.ms = 0;
  raster.timer = setTimeout(slice, 0);
  return true;
}

export function makeClimateRenderer(mode, spec) {
  function draw(g, args) {
    const { map, rect, climate } = args;
    const r = rect ?? { x0: 0, y0: 0, x1: map.sourceWidth, y1: map.sourceHeight };
    const w = r.x1 - r.x0;
    const h = r.y1 - r.y0;
    if (w <= 0 || h <= 0) return;
    const key = `${mode}|${climate?.version ?? 0}|${map.sourceWidth}x${map.sourceHeight}|${args.version}`;
    if (!ensureRaster(mode, spec, args, key)) {
      g.fillStyle = `rgb(${PENDING.join(', ')})`;
      g.fillRect(r.x0, r.y0, w, h);
      return;
    }
    // The first brush edit swaps in a copy of the terrain: always read the
    // current arrays.
    raster.job.ctx.elevation = args.terrain.elevation;
    raster.job.ctx.category = args.terrain.category;
    if (rect) {
      // A brush stroke: recompute this rectangle now, with the new elevations.
      raster.job.fill(mode, raster.job.ctx, r.y0, r.y1, raster.classes, r.x0, r.x1);
      paint(raster.job, r.x0, r.y0, r.x1, r.y1);
    }
    g.drawImage(raster.canvas, r.x0, r.y0, w, h, r.x0, r.y0, w, h);
  }
  draw.partial = true;
  // The base layer rebuilds when a new climate result arrives and as the
  // raster's rows come in.
  draw.dataKey = (store) => `clim${store.climate?.version ?? 0}|r${raster.version}`;
  const rgb = (c) => `rgb(${c.map(Math.round).join(', ')})`;
  draw.legend = {
    ...spec.legend,
    items: spec.legend.items.map(({ cls, label }) => ({ color: rgb(spec.colors[cls]), label })),
  };
  return draw;
}
