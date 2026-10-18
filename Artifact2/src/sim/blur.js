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
