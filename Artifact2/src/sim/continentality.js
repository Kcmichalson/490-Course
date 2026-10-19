// Continentality (SPEC 6): how maritime each cell's climate is, which sets
// the seasonal swing s. Pure.
//
// Maritime tracer M (0 … 1): ocean air (M = 1) is carried inland along the
// wind and loses its ocean character with distance travelled
// (exp(−km / 1,500)), so coasts facing the prevailing wind stay mild far
// inland while lee coasts and interiors get extreme seasons.
// Distance term D = exp(−km to the sea / 300): any coast feels the sea a
// little (sea breezes, mixing), whichever way the wind blows.
// m = 1 − (1 − M)(1 − D);  s = sOcean + (sInterior − sOcean)·(1 − m).
//
// Continentality is annual: M is the mean of the 12 monthly tracers, each
// carried along that month's wind, and the same s serves every season.
//
// Tracer method: semi-Lagrangian steps of one north-south cell (dy km). The
// upwind point lies one step back along the wind direction (the speed is not
// used); east-west the step is dy / dx(lat) cells, so it crosses more cells
// near the poles, where cells are narrow. Values are updated in place
// (Gauss–Seidel), cycling through the four sweep orders so they flow
// downwind within a sweep, until no cell changes by more than the tolerance.
// Lakes count as land (no maritime source). Off the map of a partial map is
// open ocean (SPEC 1 "beyond the edges" default); past a pole, the edge row.

import {
  MARITIME_DECAY_KM, COAST_DECAY_KM, TRACER_TOLERANCE, TRACER_MAX_SWEEPS, TRACER_SOR, SWING_OCEAN, SWING_INTERIOR,
} from './constants.js';
import { isOceanCategory } from './terrain.js';
import { distanceToFeatureKm } from './distance.js';

const DEG = Math.PI / 180;

// Sim grid as a config for the km helpers in distance.js.
export function simCfg(grid) {
  return {
    sourceWidth: grid.width, sourceHeight: grid.height, latTop: grid.latTop, latBottom: grid.latBottom,
    lonSpan: grid.lonSpan ?? 360, wraps: grid.wraps ?? true,
  };
}

function cellKm(grid, radiusKm) {
  const degToKm = DEG * radiusKm;
  const dy = ((grid.latTop - grid.latBottom) / grid.height) * degToKm;
  const dxEq = ((grid.lonSpan ?? 360) / grid.width) * degToKm;
  const dx = new Float64Array(grid.height);
  for (let j = 0; j < grid.height; j++) {
    const lat = grid.latTop - ((j + 0.5) / grid.height) * (grid.latTop - grid.latBottom);
    dx[j] = Math.max(1e-6, dxEq * Math.cos(lat * DEG));
  }
  return { dy, dx };
}

// One month's maritime tracer. wind = { u, v }: row profiles (length H) or
// full layers (W·H). ocean: Uint8Array, 1 = source cell.
// → { m: Float32Array, sweeps }
// start: a previous answer to begin from (warm start); tolerance: stop when
// no cell changes by more than this in a sweep.
export function maritimeTracer(grid, ocean, wind, radiusKm, { start = null, tolerance = TRACER_TOLERANCE } = {}) {
  const W = grid.width;
  const H = grid.height;
  const wraps = grid.wraps ?? true;
  const { dy, dx } = cellKm(grid, radiusKm);
  const decay = Math.exp(-dy / MARITIME_DECAY_KM);
  const poleTop = grid.latTop >= 90;
  const poleBottom = grid.latBottom <= -90;
  const rowWind = wind.u.length === H;
  const m = new Float32Array(W * H);
  for (let k = 0; k < m.length; k++) m[k] = ocean[k] ? 1 : start ? start[k] : 0;

  // Index of an integer cell with the edge rules (wrap, pole), or −1 when it
  // lies off a partial map (open ocean, M = 1).
  const at = (i, j) => {
    if (j < 0) { if (!poleTop) return -1; j = 0; }
    else if (j >= H) { if (!poleBottom) return -1; j = H - 1; }
    if (i < 0 || i >= W) {
      if (!wraps) return -1;
      i = ((i % W) + W) % W;
    }
    return j * W + i;
  };

  // Upwind offsets (cells) per row or per cell.
  const offX = new Float32Array(rowWind ? H : W * H);
  const offY = new Float32Array(rowWind ? H : W * H);
  for (let k = 0; k < offX.length; k++) {
    const j = rowWind ? k : Math.floor(k / W);
    const u = wind.u[k];
    const v = wind.v[k];
    const mag = Math.hypot(u, v);
    if (mag < 1e-9) continue; // no direction: the cell only decays its own value
    offX[k] = (-u / mag) * (dy / dx[j]); // upwind = opposite the wind; east is +x
    offY[k] = v / mag; // screen y points down: air blowing north came from +y
  }

  // The upwind stencil of every land cell, built once (it doesn't change
  // between sweeps): 4 bilinear corners and weights. An upwind point less than
  // a cell away lands partly on the cell itself; that share is solved exactly
  // (m = (decay·Σ w·m + offMap) / (1 − decay·wSelf)). Off-map corners are
  // open ocean, a constant.
  let L = 0;
  for (let k = 0; k < W * H; k++) if (!ocean[k]) L++;
  const cell = new Int32Array(L);
  const rowStart = new Int32Array(H + 1);
  const corners = new Int32Array(4 * L);
  const weights = new Float32Array(4 * L);
  const constant = new Float32Array(L);
  const scale = new Float32Array(L);
  let p = 0;
  for (let j = 0; j < H; j++) {
    rowStart[j] = p;
    for (let i = 0; i < W; i++) {
      const k = j * W + i;
      if (ocean[k]) continue;
      const o = rowWind ? j : k;
      const x = i + offX[o];
      const y = j + offY[o];
      const x0 = Math.floor(x);
      const y0 = Math.floor(y);
      const fx = x - x0;
      const fy = y - y0;
      const ws = [(1 - fx) * (1 - fy), fx * (1 - fy), (1 - fx) * fy, fx * fy];
      const cs = [at(x0, y0), at(x0 + 1, y0), at(x0, y0 + 1), at(x0 + 1, y0 + 1)];
      let self = 0;
      let off = 0;
      for (let q = 0; q < 4; q++) {
        let c = cs[q];
        let w = ws[q];
        if (c === k) { self += w; w = 0; c = k; } else if (c < 0) { off += w; w = 0; c = k; }
        corners[4 * p + q] = c;
        weights[4 * p + q] = decay * w;
      }
      cell[p] = k;
      constant[p] = decay * off;
      scale[p] = 1 / (1 - decay * self);
      p++;
    }
  }
  rowStart[H] = p;

  // Cells under a pressure high draw their air from each other (each one's
  // upwind point lies on the other), which plain sweeps resolve only slowly.
  // back[r] = the weight of this cell in corner r's own stencil, so such a
  // pair is solved exactly in one update (a two-cell lookahead).
  const pos = new Int32Array(W * H).fill(-1);
  for (let q = 0; q < L; q++) pos[cell[q]] = q;
  const back = new Float32Array(4 * L);
  for (let q = 0; q < L; q++) {
    const k = cell[q];
    for (let r = 0; r < 4; r++) {
      const c = corners[4 * q + r];
      if (weights[4 * q + r] === 0 || c === k || ocean[c]) continue;
      const pc = pos[c];
      let wb = 0;
      for (let r2 = 0; r2 < 4; r2++) if (corners[4 * pc + r2] === k) wb += weights[4 * pc + r2];
      back[4 * q + r] = wb;
    }
  }

  // Stencil sum of list cell q with the current values.
  const sumOf = (q) => {
    const c = 4 * q;
    return constant[q] + weights[c] * m[corners[c]] + weights[c + 1] * m[corners[c + 1]]
      + weights[c + 2] * m[corners[c + 2]] + weights[c + 3] * m[corners[c + 3]];
  };

  // Gauss–Seidel in place, cycling through the four sweep orders so values
  // flow downwind within a sweep. Values stay within 0 … 1.
  let sweeps = 0;
  for (; sweeps < TRACER_MAX_SWEEPS; sweeps++) {
    const order = sweeps % 4;
    const jDown = order < 2;
    const iRight = order % 2 === 0;
    let maxChange = 0;
    for (let jj = 0; jj < H; jj++) {
      const j = jDown ? jj : H - 1 - jj;
      const a = rowStart[j];
      const b = rowStart[j + 1];
      for (let t = 0; t < b - a; t++) {
        const q = iRight ? a + t : b - 1 - t;
        const k = cell[q];
        const old = m[k];
        let sum = constant[q];
        let loop = 0;
        for (let r = 4 * q; r < 4 * q + 4; r++) {
          const w = weights[r];
          if (w === 0) continue;
          const c = corners[r];
          const wb = back[r];
          if (wb === 0) { sum += w * m[c]; continue; }
          // Corner c depends on this cell: substitute c's own equation,
          // m_c = scale_c·(R_c + wb·m_k), and solve for m_k.
          const pc = pos[c];
          sum += w * scale[pc] * (sumOf(pc) - wb * old);
          loop += w * scale[pc] * wb;
        }
        const target = (sum * scale[q]) / (1 - scale[q] * loop);
        const next = Math.min(1, Math.max(0, old + TRACER_SOR * (target - old)));
        const change = Math.abs(next - old);
        if (change > maxChange) maxChange = change;
        m[k] = next;
      }
    }
    if (maxChange < tolerance) { sweeps++; break; }
  }
  return { m, sweeps };
}

// km from each land cell to the nearest ocean cell, or to the edge of a
// partial map (off-map counts as ocean).
export function seaDistanceKm(grid, ocean, radiusKm) {
  const W = grid.width;
  const H = grid.height;
  const cfg = simCfg(grid);
  const d = distanceToFeatureKm(ocean, cfg, radiusKm, { halfPad: true });
  const { dy, dx } = cellKm(grid, radiusKm);
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const k = j * W + i;
      let e = d[k];
      if (!cfg.wraps) e = Math.min(e, (i + 0.5) * dx[j], (W - i - 0.5) * dx[j]);
      if (grid.latTop < 90) e = Math.min(e, (j + 0.5) * dy);
      if (grid.latBottom > -90) e = Math.min(e, (H - j - 0.5) * dy);
      d[k] = e;
    }
  }
  return d;
}

// Seasonal swing s per cell from the monthly winds (each { u, v }, or a
// function returning one, so 12 full layers needn't exist at once).
// → { s, maritime (mean tracer M), coast (D), sweeps: [per month] }
export function continentality(grid, category, monthlyWinds, radiusKm) {
  const n = grid.width * grid.height;
  const ocean = new Uint8Array(n);
  for (let k = 0; k < n; k++) ocean[k] = isOceanCategory(category[k]) ? 1 : 0;
  const maritime = new Float32Array(n);
  const sweeps = [];
  // Each month starts cold (land at 0): starting from the previous month's
  // answer was measured slower, because the divergence lines move.
  for (const month of monthlyWinds) {
    const wind = typeof month === 'function' ? month() : month;
    const t = maritimeTracer(grid, ocean, wind, radiusKm);
    for (let k = 0; k < n; k++) maritime[k] += t.m[k];
    sweeps.push(t.sweeps);
  }
  for (let k = 0; k < n; k++) maritime[k] /= monthlyWinds.length;
  const dist = seaDistanceKm(grid, ocean, radiusKm);
  const coast = new Float32Array(n);
  const s = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    if (ocean[k]) { coast[k] = 1; s[k] = SWING_OCEAN; continue; }
    const D = Number.isFinite(dist[k]) ? Math.exp(-dist[k] / COAST_DECAY_KM) : 0;
    coast[k] = D;
    const mix = 1 - (1 - maritime[k]) * (1 - D);
    s[k] = SWING_OCEAN + (SWING_INTERIOR - SWING_OCEAN) * (1 - mix);
  }
  return { s, maritime, coast, sweeps };
}
