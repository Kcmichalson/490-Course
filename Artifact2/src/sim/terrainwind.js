// Friction and mountain deflection (SPEC 4.5, pipeline step 5, M4b). Pure.
//
// terrainWind(base, grid, terrain) → { u, v, speed } full layers.
//   base    = { u, v } as row profiles (length H) or full layers (W·H)
//   terrain = { category, elevation } on the sim grid (cell surface elevation)
// 1. Friction: land and land-ice cells keep 60% of the wind (rough ground).
// 2. Deflection: where the wind blows uphill on high, steep land, part of
//    the uphill component is removed and most of that is turned along the
//    contours (air flows around mountains instead of over them). Ridges
//    under ~500 m are crossed freely, which is what lets rain shadows form.
// 3. The deflection (not the friction) is smoothed with one 3×3 pass, so
//    the open ocean away from mountains is left exactly as it was.

import {
  LAND_FRICTION, DEFLECT_LOW_M, DEFLECT_HIGH_M, DEFLECT_SLOPE_M_PER_KM, DEFLECT_MAX, DEFLECT_REDIRECT, PLANET_RADIUS_KM,
} from './constants.js';
import { isLandCategory } from './terrain.js';

const DEG = Math.PI / 180;

const smoothstep = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

export function terrainWind(base, grid, terrain) {
  const W = grid.width;
  const H = grid.height;
  const n = W * H;
  const wraps = grid.wraps ?? true;
  const radius = grid.radiusKm ?? PLANET_RADIUS_KM;
  const rowWind = base.u.length === H;
  const dyKm = ((grid.latTop - grid.latBottom) / H) * DEG * radius;
  const dxEq = ((grid.lonSpan ?? 360) / W) * DEG * radius;
  const elev = terrain.elevation;
  const du = new Float32Array(n);
  const dv = new Float32Array(n);

  const col = (i) => (wraps ? (i + W) % W : Math.min(W - 1, Math.max(0, i)));
  for (let j = 0; j < H; j++) {
    const lat = grid.latTop - ((j + 0.5) / H) * (grid.latTop - grid.latBottom);
    const dxKm = Math.max(1e-3, dxEq * Math.cos(lat * DEG));
    const jn = Math.max(0, j - 1);
    const js = Math.min(H - 1, j + 1);
    for (let i = 0; i < W; i++) {
      const k = j * W + i;
      if (!isLandCategory(terrain.category[k])) continue;
      // Friction (applied per cell below); deflection works on the slowed wind.
      const u0 = (rowWind ? base.u[j] : base.u[k]) * LAND_FRICTION;
      const v0 = (rowWind ? base.v[j] : base.v[k]) * LAND_FRICTION;
      let u = u0;
      let v = v0;
      // Uphill direction from the terrain gradient (m per km; +y is north).
      const span = wraps ? 2 : col(i + 1) - col(i - 1); // cells between the two samples
      const gx = span ? (elev[j * W + col(i + 1)] - elev[j * W + col(i - 1)]) / (span * dxKm) : 0;
      const gy = (elev[jn * W + i] - elev[js * W + i]) / (Math.max(1, js - jn) * dyKm);
      const slope = Math.hypot(gx, gy);
      if (slope > 0) {
        const nx = gx / slope;
        const ny = gy / slope;
        const up = u * nx + v * ny;
        const block = DEFLECT_MAX * smoothstep(DEFLECT_LOW_M, DEFLECT_HIGH_M, elev[k]) * smoothstep(0, DEFLECT_SLOPE_M_PER_KM, slope);
        if (up > 0 && block > 0) {
          const removed = block * up;
          // Along the contour, in the direction the wind already leans.
          let tx = -ny;
          let ty = nx;
          if (u * tx + v * ty < 0) { tx = -tx; ty = -ty; }
          u += -removed * nx + DEFLECT_REDIRECT * removed * tx;
          v += -removed * ny + DEFLECT_REDIRECT * removed * ty;
        }
      }
      du[k] = u - u0;
      dv[k] = v - v0;
    }
  }

  // Smooth the deflection once (3×3 box), then add it to the base wind
  // (slowed by friction on land).
  const out = { u: new Float32Array(n), v: new Float32Array(n), speed: new Float32Array(n) };
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      let su = 0;
      let sv = 0;
      let c = 0;
      for (let dj = -1; dj <= 1; dj++) {
        const jj = j + dj;
        if (jj < 0 || jj >= H) continue;
        for (let di = -1; di <= 1; di++) {
          const ii = i + di;
          if (!wraps && (ii < 0 || ii >= W)) continue;
          const kk = jj * W + ((ii + W) % W);
          su += du[kk];
          sv += dv[kk];
          c++;
        }
      }
      const k = j * W + i;
      const b = rowWind ? j : k;
      const land = isLandCategory(terrain.category[k]);
      if (su === 0 && sv === 0 && !land) {
        // Untouched (open ocean away from mountains): exactly the base wind.
        out.u[k] = base.u[b];
        out.v[k] = base.v[b];
        out.speed[k] = base.speed ? base.speed[b] : Math.hypot(base.u[b], base.v[b]);
        continue;
      }
      const f = land ? LAND_FRICTION : 1;
      const u = base.u[b] * f + su / c;
      const v = base.v[b] * f + sv / c;
      out.u[k] = u;
      out.v[k] = v;
      out.speed[k] = Math.hypot(u, v);
    }
  }
  return out;
}
