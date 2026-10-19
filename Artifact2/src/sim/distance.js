// Distance to the coast in km on an equirectangular grid.
//
// Exact Euclidean distance transform (Felzenszwalb & Huttenlocher), run as a
// vertical pass then a horizontal pass. North-south pixel spacing is uniform;
// east-west spacing shrinks with cos(latitude) of the target row (the local
// tangent-plane metric), so distances near the poles aren't inflated.
// Columns wrap on east-west wrapping maps.

import { isOceanCategory } from './terrain.js';

const INF = 1e20;

// Pixel spacing in km: { dyKm (north-south, uniform), dxKm[y] (east-west,
// per row) }. Also used by slope and hillshade.
export function pixelKm(cfg, radiusKm) {
  const degToKm = (Math.PI / 180) * radiusKm;
  const dyKm = ((cfg.latTop - cfg.latBottom) / cfg.sourceHeight) * degToKm;
  const dxEq = (cfg.lonSpan / cfg.sourceWidth) * degToKm;
  const dxKm = new Float64Array(cfg.sourceHeight);
  for (let y = 0; y < cfg.sourceHeight; y++) {
    const lat = cfg.latTop - ((y + 0.5) / cfg.sourceHeight) * (cfg.latTop - cfg.latBottom);
    dxKm[y] = dxEq * Math.cos((lat * Math.PI) / 180);
  }
  return { dyKm, dxKm };
}

// 1-D squared distance transform of f with spacing k:
// d[p] = min_q f[q] + (k(p-q))², via the lower envelope of parabolas.
// Empty cells hold the large finite INF, which the textbook algorithm handles.
// arg (optional) receives the minimizing q for each p.
function dt1d(f, n, k, d, v, z, arg = null) {
  const k2 = k * k;
  let j = 0;
  v[0] = 0;
  z[0] = -Infinity;
  z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    // Where parabola q crosses parabola r (computed once per q for speed).
    const fq = f[q] + k2 * q * q;
    let r = v[j];
    let s = (fq - (f[r] + k2 * r * r)) / (2 * k2 * (q - r));
    while (s <= z[j]) {
      j--;
      r = v[j];
      s = (fq - (f[r] + k2 * r * r)) / (2 * k2 * (q - r));
    }
    j++;
    v[j] = q;
    z[j] = s;
    z[j + 1] = Infinity;
  }
  j = 0;
  for (let p = 0; p < n; p++) {
    while (z[j + 1] < p) j++;
    const r = v[j];
    d[p] = f[r] + k2 * (p - r) * (p - r);
    if (arg) arg[p] = r;
  }
}

// Distance (km) from every pixel to the nearest pixel where feature[i] = 1.
// Returns Infinity everywhere if there are no features.
// halfPad: on wrapping maps, pad each row by half a width on each side
// instead of a whole copy (the nearest feature across the seam is never
// more than half a width away), which is faster. Distances agree up to
// floating-point ties. Imports keep the full copies, so imported terrain
// stays exactly as in M2a; the Distance from Coast mode uses halfPad.
export function distanceToFeatureKm(feature, cfg, radiusKm, { halfPad = false } = {}) {
  const w = cfg.sourceWidth;
  const h = cfg.sourceHeight;
  const { dyKm, dxKm } = pixelKm(cfg, radiusKm);
  const g = new Float32Array(w * h);
  const pad = cfg.wraps ? (halfPad ? Math.ceil(w / 2) : w) : 0;
  const n = w + 2 * pad;

  // Vertical pass: squared north-south distance within each column.
  const maxN = Math.max(h, n);
  const f = new Float64Array(maxN), d = new Float64Array(maxN), v = new Int32Array(maxN), z = new Float64Array(maxN + 1);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = feature[y * w + x] ? 0 : INF;
    dt1d(f, h, dyKm, d, v, z);
    for (let y = 0; y < h; y++) g[y * w + x] = d[y];
  }

  // Horizontal pass with this row's east-west spacing. Wrapping maps pad the
  // row with wrapped copies so the nearest feature may lie across the seam.
  const out = new Float32Array(w * h);
  const off = pad;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let i = 0; i < n; i++) {
      let xx = i - pad;
      if (xx < 0) xx += w;
      else if (xx >= w) xx -= w;
      const gv = g[row + xx];
      f[i] = gv >= INF / 10 ? INF : gv;
    }
    dt1d(f, n, dxKm[y], d, v, z);
    for (let x = 0; x < w; x++) {
      const dv = d[off + x];
      out[row + x] = dv >= INF / 10 ? Infinity : Math.sqrt(dv);
    }
  }
  return out;
}

// Index of the nearest pixel where feature[i] = 1, for every pixel (the same
// km metric and wrap as distanceToFeatureKm; ties may go either way).
// Returns −1 everywhere if there are no features. Used to fill pixels from
// their nearest classified neighbor (palette Ignore / unmatched).
export function nearestFeatureIndex(feature, cfg, radiusKm) {
  const w = cfg.sourceWidth;
  const h = cfg.sourceHeight;
  const { dyKm, dxKm } = pixelKm(cfg, radiusKm);
  const g = new Float64Array(w * h);
  const ny = new Int32Array(w * h); // nearest feature row within the column

  const maxN = Math.max(h, w * 3);
  const f = new Float64Array(maxN), d = new Float64Array(maxN), v = new Int32Array(maxN), z = new Float64Array(maxN + 1);
  const arg = new Int32Array(maxN);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = feature[y * w + x] ? 0 : INF;
    dt1d(f, h, dyKm, d, v, z, arg);
    for (let y = 0; y < h; y++) {
      g[y * w + x] = d[y];
      ny[y * w + x] = arg[y];
    }
  }

  const out = new Int32Array(w * h).fill(-1);
  const reps = cfg.wraps ? 3 : 1;
  const n = w * reps;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let i = 0; i < n; i++) {
      const gv = g[row + (i % w)];
      f[i] = gv >= INF / 10 ? INF : gv;
    }
    dt1d(f, n, dxKm[y], d, v, z, arg);
    const off = cfg.wraps ? w : 0;
    for (let x = 0; x < w; x++) {
      if (d[off + x] >= INF / 10) continue;
      const nx = arg[off + x] % w;
      out[row + x] = ny[row + nx] * w + nx;
    }
  }
  return out;
}

// Distance from Coast mode (SPEC 13.3): one signed layer from a category
// layer, km inland (positive) or offshore (negative). Lakes count as land, so
// the coast is the sea's edge.
export function signedCoastDistanceKm(category, cfg, radiusKm) {
  const n = category.length;
  const land = new Uint8Array(n);
  for (let i = 0; i < n; i++) land[i] = isOceanCategory(category[i]) ? 0 : 1;
  const { toLand, toWater } = coastDistancesKm(land, cfg, radiusKm, { halfPad: true });
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = land[i] ? toWater[i] : -toLand[i];
  return out;
}

// For water pixels: km to the nearest land. For land pixels: km to the
// nearest water. (Both measured to pixel centers, so a pixel next to the
// coast is about one pixel away.)
export function coastDistancesKm(landMaskArr, cfg, radiusKm, opts = {}) {
  const n = landMaskArr.length;
  const water = new Uint8Array(n);
  for (let i = 0; i < n; i++) water[i] = landMaskArr[i] ? 0 : 1;
  return {
    toLand: distanceToFeatureKm(landMaskArr, cfg, radiusKm, opts),
    toWater: distanceToFeatureKm(water, cfg, radiusKm, opts),
  };
}
