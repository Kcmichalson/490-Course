// Seeded value noise sampled on the unit sphere from latitude/longitude, so
// it is seamless across the date line and doesn't stretch near the poles.
// Pure and deterministic: the same seed always gives the same terrain.

function hash3(x, y, z, seed) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1440670441) ^ Math.imul(seed, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296; // [0, 1)
}

const smooth = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

// Trilinear value noise in [-1, 1].
export function valueNoise3(x, y, z, seed) {
  const x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z);
  const tx = smooth(x - x0), ty = smooth(y - y0), tz = smooth(z - z0);
  const c = (dx, dy, dz) => hash3(x0 + dx, y0 + dy, z0 + dz, seed);
  const v = lerp(
    lerp(lerp(c(0, 0, 0), c(1, 0, 0), tx), lerp(c(0, 1, 0), c(1, 1, 0), tx), ty),
    lerp(lerp(c(0, 0, 1), c(1, 0, 1), tx), lerp(c(0, 1, 1), c(1, 1, 1), tx), ty),
    tz,
  );
  return v * 2 - 1;
}

// Fractal sum of octaves, normalized to [-1, 1].
export function fbm3(x, y, z, seed, octaves = 4) {
  let sum = 0, amp = 1, norm = 0, f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise3(x * f, y * f, z * f, seed + o * 101);
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}

// Noise at a point on the planet. freq ≈ number of features around the globe / 2.
export function sphereNoise(latDeg, lonDeg, seed, freq = 2, octaves = 4) {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  const c = Math.cos(lat);
  return fbm3(c * Math.cos(lon) * freq, c * Math.sin(lon) * freq, Math.sin(lat) * freq, seed, octaves);
}

// Sphere noise for every pixel of a map, sampled every `step` pixels and
// bilinearly interpolated. The noise is low-frequency, so this matches
// per-pixel sampling closely at a fraction of the cost on large maps.
export function noiseField(cfg, seed, freq, octaves = 4, step = 4) {
  const w = cfg.sourceWidth;
  const h = cfg.sourceHeight;
  const gw = Math.ceil(w / step) + 1;
  const gh = Math.ceil(h / step) + 1;
  const grid = new Float32Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) {
    const y = Math.min(h, gy * step);
    const lat = cfg.latTop - (y / h) * (cfg.latTop - cfg.latBottom);
    for (let gx = 0; gx < gw; gx++) {
      const x = Math.min(w, gx * step);
      const lon = cfg.lonWest + (x / w) * cfg.lonSpan;
      grid[gy * gw + gx] = sphereNoise(lat, lon, seed, freq, octaves);
    }
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const fy = (y + 0.5) / step;
    const gy = Math.min(gh - 2, Math.floor(fy));
    const ty = Math.min(1, fy - gy);
    for (let x = 0; x < w; x++) {
      const fx = (x + 0.5) / step;
      const gx = Math.min(gw - 2, Math.floor(fx));
      const tx = Math.min(1, fx - gx);
      const a = grid[gy * gw + gx], b = grid[gy * gw + gx + 1];
      const c = grid[(gy + 1) * gw + gx], d = grid[(gy + 1) * gw + gx + 1];
      out[y * w + x] = lerp(lerp(a, b, tx), lerp(c, d, tx), ty);
    }
  }
  return out;
}
