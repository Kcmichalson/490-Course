// Separable box blur on a Float32Array grid. Two passes approximate a
// gaussian. Columns wrap on east-west wrapping maps; rows clamp at the
// top and bottom edges. Used to remove 8-bit terracing from heightmaps.

function blurRows(src, dst, w, h, r, wrap) {
  const win = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    const at = (x) => src[row + (wrap ? ((x % w) + w) % w : Math.min(w - 1, Math.max(0, x)))];
    let sum = 0;
    for (let x = -r; x <= r; x++) sum += at(x);
    for (let x = 0; x < w; x++) {
      dst[row + x] = sum / win;
      sum += at(x + r + 1) - at(x - r);
    }
  }
}

function blurCols(src, dst, w, h, r) {
  const win = 2 * r + 1;
  for (let x = 0; x < w; x++) {
    const at = (y) => src[Math.min(h - 1, Math.max(0, y)) * w + x];
    let sum = 0;
    for (let y = -r; y <= r; y++) sum += at(y);
    for (let y = 0; y < h; y++) {
      dst[y * w + x] = sum / win;
      sum += at(y + r + 1) - at(y - r);
    }
  }
}

export function boxBlur(src, w, h, radius, wrapX = false, passes = 2) {
  const r = Math.max(0, Math.round(radius));
  if (r === 0) return Float32Array.from(src);
  let a = Float32Array.from(src);
  let b = new Float32Array(src.length);
  for (let p = 0; p < passes; p++) {
    blurRows(a, b, w, h, r, wrapX);
    blurCols(b, a, w, h, r);
  }
  return a;
}

// Smooths elevation in place without moving the coast: water stays at or
// below −1 m and land stays on its side of sea level. Removes terracing
// (8-bit heightmaps) and the steps between flat palette tiers.
//   land[i]  1 = land, 0 = water (the coast to keep)
//   skip[i]  1 = leave this pixel alone (lakes, depths not generated yet)
// Two averaging rules:
//   skippedAsZero: true  — heightmap import, exactly as in M2a: skipped
//     pixels count as 0 m in the blur, and all land is clamped to ≥ 1 m.
//   default — palette import: skipped pixels are left out of the averages,
//     and only land that was already ≥ 1 m is held there (land below sea
//     level, a depression, is not clamped).
export function smoothKeepingCoast(elev, w, h, radius, wrapX, { land, skip, skippedAsZero = false, minLand = 1, maxWater = -1 }) {
  const n = elev.length;
  if (!(radius > 0)) return elev;
  const val = new Float32Array(n);
  for (let i = 0; i < n; i++) val[i] = skip[i] ? 0 : elev[i];
  const blurred = boxBlur(val, w, h, radius, wrapX);
  if (skippedAsZero) {
    for (let i = 0; i < n; i++) {
      if (skip[i]) continue;
      elev[i] = land[i] ? Math.max(minLand, blurred[i]) : Math.min(maxWater, blurred[i]);
    }
    return elev;
  }
  const cnt = new Float32Array(n);
  for (let i = 0; i < n; i++) cnt[i] = skip[i] ? 0 : 1;
  const weight = boxBlur(cnt, w, h, radius, wrapX);
  for (let i = 0; i < n; i++) {
    if (skip[i] || !(weight[i] > 0)) continue;
    const mean = blurred[i] / weight[i];
    if (land[i]) elev[i] = elev[i] >= minLand ? Math.max(minLand, mean) : mean;
    else elev[i] = Math.min(maxWater, mean);
  }
  return elev;
}
