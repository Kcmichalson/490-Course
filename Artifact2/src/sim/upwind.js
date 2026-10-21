// Upwind stencils for semi-Lagrangian transport along the wind (SPEC 6
// continentality tracer, M4; SPEC 7 moisture, M5). Pure.
//
// Air reaching a cell left the upwind point one north-south cell (dy km)
// earlier, back along the wind direction (the speed is not used). East-west
// the step is dy / dx(lat) cells, so it crosses more cells near the poles,
// where cells are narrow (SPEC 1: distances shrink with cos latitude). The
// upwind point is read bilinearly from its 4 corner cells.
//
// Edge rules: east-west wraps on wrapping maps; past a pole, the edge row;
// off a partial map, the off-map share (open ocean, SPEC 1 "beyond the
// edges" default), which each caller fills with its own value.

const DEG = Math.PI / 180;

// Cell size in km: dy (north-south, one value) and dx per row (east-west,
// shrinking with cos latitude).
export function cellKm(grid, radiusKm) {
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

// The upwind stencil of every cell with include(k) true (all cells when
// include is null), in row order. wind = { u, v }: row profiles (length H) or
// full layers (W·H).
// → { L, cell, rowStart, corners, weights, self, off, dy, dx }
//   corners/weights: 4 per listed cell (bilinear). A corner on the cell
//   itself or off the map is moved into self[p] / off[p] (its weight set to 0
//   and its index to the cell itself), so callers can solve the self share
//   exactly and fill the off-map share with a constant. Weights are Float64.
export function upwindStencil(grid, wind, radiusKm, include = null) {
  const W = grid.width;
  const H = grid.height;
  const wraps = grid.wraps ?? true;
  const { dy, dx } = cellKm(grid, radiusKm);
  const poleTop = grid.latTop >= 90;
  const poleBottom = grid.latBottom <= -90;
  const rowWind = wind.u.length === H;

  // Index of an integer cell with the edge rules (wrap, pole), or −1 when it
  // lies off a partial map.
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
    if (mag < 1e-9) continue; // no direction: the upwind point is the cell itself
    offX[k] = (-u / mag) * (dy / dx[j]); // upwind = opposite the wind; east is +x
    offY[k] = v / mag; // screen y points down: air blowing north came from +y
  }

  let L = 0;
  if (include) { for (let k = 0; k < W * H; k++) if (include(k)) L++; } else L = W * H;
  const cell = new Int32Array(L);
  const rowStart = new Int32Array(H + 1);
  const corners = new Int32Array(4 * L);
  const weights = new Float64Array(4 * L);
  const self = new Float64Array(L);
  const off = new Float64Array(L);
  let p = 0;
  for (let j = 0; j < H; j++) {
    rowStart[j] = p;
    for (let i = 0; i < W; i++) {
      const k = j * W + i;
      if (include && !include(k)) continue;
      const o = rowWind ? j : k;
      const x = i + offX[o];
      const y = j + offY[o];
      const x0 = Math.floor(x);
      const y0 = Math.floor(y);
      const fx = x - x0;
      const fy = y - y0;
      const ws = [(1 - fx) * (1 - fy), fx * (1 - fy), (1 - fx) * fy, fx * fy];
      const cs = [at(x0, y0), at(x0 + 1, y0), at(x0, y0 + 1), at(x0 + 1, y0 + 1)];
      let s = 0;
      let f = 0;
      for (let q = 0; q < 4; q++) {
        let c = cs[q];
        let w = ws[q];
        if (c === k) { s += w; w = 0; c = k; } else if (c < 0) { f += w; w = 0; c = k; }
        corners[4 * p + q] = c;
        weights[4 * p + q] = w;
      }
      cell[p] = k;
      self[p] = s;
      off[p] = f;
      p++;
    }
  }
  rowStart[H] = p;
  return { L, cell, rowStart, corners, weights, self, off, dy, dx };
}
