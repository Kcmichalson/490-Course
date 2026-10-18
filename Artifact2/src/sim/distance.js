// Distance to the coast in km on an equirectangular grid.
//
// Exact Euclidean distance transform (Felzenszwalb & Huttenlocher), run as a
// vertical pass then a horizontal pass. North-south pixel spacing is uniform;
// east-west spacing shrinks with cos(latitude) of the target row (the local
// tangent-plane metric), so distances near the poles aren't inflated.
// Columns wrap on east-west wrapping maps.

const INF = 1e20;

function pixelKm(cfg, radiusKm) {
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
function dt1d(f, n, k, d, v, z) {
  const k2 = k * k;
  const cross = (q, r) => ((f[q] + k2 * q * q) - (f[r] + k2 * r * r)) / (2 * k2 * (q - r));
  let j = 0;
  v[0] = 0;
  z[0] = -Infinity;
  z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = cross(q, v[j]);
    while (s <= z[j]) {
      j--;
      s = cross(q, v[j]);
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
  }
}

// Distance (km) from every pixel to the nearest pixel where feature[i] = 1.
// Returns Infinity everywhere if there are no features.
export function distanceToFeatureKm(feature, cfg, radiusKm) {
  const w = cfg.sourceWidth;
  const h = cfg.sourceHeight;
  const { dyKm, dxKm } = pixelKm(cfg, radiusKm);
  const g = new Float32Array(w * h);

  // Vertical pass: squared north-south distance within each column.
  const maxN = Math.max(h, w * 3);
  const f = new Float64Array(maxN), d = new Float64Array(maxN), v = new Int32Array(maxN), z = new Float64Array(maxN + 1);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = feature[y * w + x] ? 0 : INF;
    dt1d(f, h, dyKm, d, v, z);
    for (let y = 0; y < h; y++) g[y * w + x] = d[y];
  }

  // Horizontal pass with this row's east-west spacing. Wrapping maps use a
  // row tripled side by side so the nearest feature may lie across the seam.
  const out = new Float32Array(w * h);
  const reps = cfg.wraps ? 3 : 1;
  const n = w * reps;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let i = 0; i < n; i++) {
      const gv = g[row + (i % w)];
      f[i] = gv >= INF / 10 ? INF : gv;
    }
    dt1d(f, n, dxKm[y], d, v, z);
    const off = cfg.wraps ? w : 0;
    for (let x = 0; x < w; x++) {
      const dv = d[off + x];
      out[row + x] = dv >= INF / 10 ? Infinity : Math.sqrt(dv);
    }
  }
  return out;
}

// For water pixels: km to the nearest land. For land pixels: km to the
// nearest water. (Both measured to pixel centers, so a pixel next to the
// coast is about one pixel away.)
export function coastDistancesKm(landMaskArr, cfg, radiusKm) {
  const n = landMaskArr.length;
  const water = new Uint8Array(n);
  for (let i = 0; i < n; i++) water[i] = landMaskArr[i] ? 0 : 1;
  return {
    toLand: distanceToFeatureKm(landMaskArr, cfg, radiusKm),
    toWater: distanceToFeatureKm(water, cfg, radiusKm),
  };
}
