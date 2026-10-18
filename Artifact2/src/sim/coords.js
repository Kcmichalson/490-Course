// Pixel ↔ latitude/longitude for equirectangular maps. Pure functions.
//
// Coordinates are continuous source pixels: x in [0, W], y in [0, H].
// Pixel (i, j) covers [i, i+1) × [j, j+1); its center is (i + 0.5, j + 0.5).
// Cell-registered: y = 0 is the top EDGE of row 0 (latTop), y = H is the
// bottom edge of the last row (latBottom), and x = 0 is the left edge of
// column 0 (lonWest). Sim cells use the same rule on their own grid, so no
// cell center sits exactly on a pole.

import { simGridSize } from './mapconfig.js';

const EDGE_EPS = 1e-6; // source px

// Longitude into [-180, 180).
export function normalizeLon(lon) {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

// Wraps x into [0, W) on wrapping maps; returns x unchanged otherwise.
export function wrapX(cfg, x) {
  if (!cfg.wraps) return x;
  const w = cfg.sourceWidth;
  return ((x % w) + w) % w;
}

// Continuous source position → { lat, lon } (lon normalized), or null when
// the position is off the map (above/below it, or left/right of a
// non-wrapping map).
export function pixelToLatLon(cfg, x, y) {
  const { sourceWidth: w, sourceHeight: h } = cfg;
  // Tolerate float error from screen → source conversion at the exact edges.
  if (!(y >= -EDGE_EPS && y <= h + EDGE_EPS)) return null;
  y = Math.min(h, Math.max(0, y));
  if (cfg.wraps) x = wrapX(cfg, x);
  else if (!(x >= -EDGE_EPS && x <= w + EDGE_EPS)) return null;
  else x = Math.min(w, Math.max(0, x));
  return {
    lat: cfg.latTop - (y / h) * (cfg.latTop - cfg.latBottom),
    lon: normalizeLon(cfg.lonWest + (x / w) * cfg.lonSpan),
  };
}

// { lat, lon } → continuous source position. The result may lie off the map
// (callers check). For partial maps, longitudes just west of the map come out
// as small negative x rather than wrapping all the way around.
export function latLonToPixel(cfg, lat, lon) {
  const { sourceWidth: w, sourceHeight: h, lonSpan } = cfg;
  let dLon = (((lon - cfg.lonWest) % 360) + 360) % 360;
  if (dLon > lonSpan + (360 - lonSpan) / 2) dLon -= 360;
  return {
    x: (dLon / lonSpan) * w,
    y: ((cfg.latTop - lat) / (cfg.latTop - cfg.latBottom)) * h,
  };
}

// Integer source pixel under a continuous position, or null off-map.
export function sourcePixel(cfg, x, y) {
  if (!pixelToLatLon(cfg, x, y)) return null;
  const xw = wrapX(cfg, x);
  return {
    px: Math.min(cfg.sourceWidth - 1, Math.floor(xw)),
    py: Math.min(cfg.sourceHeight - 1, Math.floor(y)),
  };
}

// Sim cell under a continuous source position, or null off-map. Uses separate
// x and y scales because the sim height is rounded.
export function sourceToSimCell(cfg, x, y) {
  if (!pixelToLatLon(cfg, x, y)) return null;
  const { width, height } = simGridSize(cfg);
  const xw = wrapX(cfg, x);
  return {
    i: Math.min(width - 1, Math.floor((xw / cfg.sourceWidth) * width)),
    j: Math.min(height - 1, Math.floor((y / cfg.sourceHeight) * height)),
  };
}

// Source-pixel rectangle covered by sim cell (i, j).
export function simCellBounds(cfg, i, j) {
  const { width, height } = simGridSize(cfg);
  const sx = cfg.sourceWidth / width;
  const sy = cfg.sourceHeight / height;
  return { x0: i * sx, y0: j * sy, x1: (i + 1) * sx, y1: (j + 1) * sy };
}

// Latitude/longitude of a sim cell's center.
export function simCellCenterLatLon(cfg, i, j) {
  const { width, height } = simGridSize(cfg);
  return {
    lat: cfg.latTop - ((j + 0.5) / height) * (cfg.latTop - cfg.latBottom),
    lon: normalizeLon(cfg.lonWest + ((i + 0.5) / width) * cfg.lonSpan),
  };
}

function formatAxis(value, digits, pos, neg, edge) {
  const r = Number(Math.abs(value).toFixed(digits));
  const text = r.toFixed(digits);
  if (r === 0 || r === edge) return `${text}°`;
  return `${text}°${value > 0 ? pos : neg}`;
}

// { lat, lon } → "12.34°N 56.78°W". The equator, prime meridian, and 180th
// meridian have no hemisphere letter.
export function formatLatLon({ lat, lon }, digits = 2) {
  return `${formatAxis(lat, digits, 'N', 'S', -1)} ${formatAxis(lon, digits, 'E', 'W', 180)}`;
}

const TOKEN = /([+-]?\d+(?:\.\d+)?|[+-]?\.\d+)\s*°?\s*([NSEWnsew])?/g;

// Parses "45N 30W", "45.5°N, 30.25°E", "30W 45N", "45, -30", or "-12.5 100"
// into { lat, lon } (lon normalized). Returns null for anything else,
// including out-of-range latitudes.
export function parseLatLon(text) {
  if (typeof text !== 'string') return null;
  const tokens = [];
  const rest = text.replace(TOKEN, (_, num, hemi) => {
    tokens.push({ value: Number(num), hemi: hemi ? hemi.toUpperCase() : null, signed: /^[+-]/.test(num) });
    return ' ';
  });
  if (tokens.length !== 2 || !/^[\s,;/]*$/.test(rest)) return null;

  let lat = null;
  let lon = null;
  const unlabeled = [];
  for (const t of tokens) {
    if (!t.hemi) { unlabeled.push(t); continue; }
    if (t.signed) return null; // "-45N" is ambiguous
    if (t.hemi === 'N' || t.hemi === 'S') {
      if (lat !== null) return null;
      lat = t.hemi === 'S' ? -t.value : t.value;
    } else {
      if (lon !== null) return null;
      lon = t.hemi === 'W' ? -t.value : t.value;
    }
  }
  // Unlabeled numbers fill the remaining axes in order: latitude first.
  for (const t of unlabeled) {
    if (lat === null) lat = t.value;
    else if (lon === null) lon = t.value;
    else return null;
  }
  if (lat === null || lon === null) return null;
  if (lat < -90 || lat > 90 || lon < -360 || lon > 360) return null;
  return { lat, lon: normalizeLon(lon) };
}
