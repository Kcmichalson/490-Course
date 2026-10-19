// Generates test-maps/palette_map_1.png: a satellite-style color map for
// testing palette import (SPEC 2.5, M2b check). No dependencies; seeded, so
// every run writes the same image.
//
//   node test-maps/make-palette-map.js [--width 1024] [--height 512] [--out path]
//
// Contents: deep ocean, a shelf band along the coasts, three land greens
// (low → high), a lake, sea ice near the north edge, a land-ice cap in the
// south, softened (blended) color edges, ±noise on every pixel, and a cloud
// patch over a coast, so not every pixel matches a swatch exactly.

import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const W = Number(arg('width', 1024));
const H = Number(arg('height', 512));
const OUT = arg('out', fileURLToPath(new URL('./palette_map_1.png', import.meta.url)));

export const COLORS = {
  deep: [31, 78, 121],
  shelf: [79, 134, 184],
  low: [91, 140, 58],
  mid: [127, 174, 79],
  high: [181, 201, 106],
  lake: [63, 167, 214],
  seaIce: [214, 230, 242],
  landIce: [250, 251, 252],
  // A neutral mid-light gray that matches no feature color (not the ice
  // whites), so the cloud reads as unmatched and is filled on import.
  cloud: [168, 168, 168],
};

// Seeded PRNG (mulberry32).
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Value noise that wraps east-west, several octaves, in 0..1. Lattice sizes
// are in fractions of the map, so any output size gives the same layout.
function noiseField(seed) {
  const rand = rng(seed);
  const octaves = [4, 8, 16, 32].map((cells, k) => {
    const rows = cells / 2 + 1;
    const grid = new Float32Array(cells * rows).map(() => rand());
    return { cells, rows, grid, amp: 0.5 ** k };
  });
  const total = octaves.reduce((s, o) => s + o.amp, 0);
  const smooth = (t) => t * t * (3 - 2 * t);
  return (u, v) => {
    let sum = 0;
    for (const o of octaves) {
      const x = u * o.cells;
      const y = v * (o.rows - 1);
      const x0 = Math.floor(x), y0 = Math.min(o.rows - 2, Math.floor(y));
      const tx = smooth(x - x0), ty = smooth(y - y0);
      const at = (i, j) => o.grid[j * o.cells + (((i % o.cells) + o.cells) % o.cells)];
      const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx;
      const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx;
      sum += (a + (b - a) * ty) * o.amp;
    }
    return sum / total;
  };
}

function classify() {
  const height = noiseField(7);
  const cls = new Array(W * H);
  const h = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) h[y * W + x] = height((x + 0.5) / W, (y + 0.5) / H);
  for (let y = 0; y < H; y++) {
    const v = (y + 0.5) / H;
    for (let x = 0; x < W; x++) {
      const e = h[y * W + x];
      let c = e < 0.47 ? 'deep' : e < 0.5 ? 'shelf' : e < 0.56 ? 'low' : e < 0.62 ? 'mid' : 'high';
      if (v < 0.05 && (c === 'deep' || c === 'shelf')) c = 'seaIce';
      if (v > 0.93) c = 'landIce';
      cls[y * W + x] = c;
    }
  }
  // A lake: a disc around the highest point away from the poles.
  let best = -1, bx = 0, by = 0;
  for (let y = Math.floor(H * 0.25); y < H * 0.75; y++) for (let x = 0; x < W; x++) {
    if (h[y * W + x] > best) { best = h[y * W + x]; bx = x; by = y; }
  }
  const lr = Math.max(3, Math.round(W * 0.012));
  for (let y = by - lr; y <= by + lr; y++) for (let x = bx - lr; x <= bx + lr; x++) {
    if (y < 0 || y >= H || (x - bx) ** 2 + (y - by) ** 2 > lr * lr) continue;
    cls[y * W + ((x + W) % W)] = 'lake';
  }
  return cls;
}

function render(cls) {
  const rgb = new Float32Array(W * H * 3);
  for (let i = 0; i < W * H; i++) rgb.set(COLORS[cls[i]], i * 3);

  // Soften edges: a 3×3 blur only where a pixel touches another class, so
  // coasts get in-between colors (as in anti-aliased art) and flat areas stay flat.
  const soft = Float32Array.from(rgb);
  for (let y = 1; y < H - 1; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const nb = [i - W, i + W, y * W + ((x + 1) % W), y * W + ((x - 1 + W) % W)];
    if (nb.every((j) => cls[j] === cls[i])) continue;
    for (let k = 0; k < 3; k++) {
      let s = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += rgb[((y + dy) * W + ((x + dx + W) % W)) * 3 + k];
      soft[i * 3 + k] = s / 9;
    }
  }

  // A cloud patch over the first coast found along the middle row.
  const my = Math.floor(H / 2);
  let cx = Math.floor(W / 2);
  for (let x = 1; x < W; x++) {
    const land = (c) => c === 'low' || c === 'mid' || c === 'high';
    if (land(cls[my * W + x]) !== land(cls[my * W + x - 1])) { cx = x; break; }
  }
  const rx = Math.round(W * 0.03), ry = Math.round(H * 0.035);
  for (let y = my - ry; y <= my + ry; y++) for (let x = cx - rx; x <= cx + rx; x++) {
    const d = ((x - cx) / rx) ** 2 + ((y - my) / ry) ** 2;
    if (d > 1) continue;
    const a = 0.85 * (1 - d * d); // thick in the middle, wispy at the edge
    const i = (y * W + ((x + W) % W)) * 3;
    for (let k = 0; k < 3; k++) soft[i + k] = soft[i + k] * (1 - a) + COLORS.cloud[k] * a;
  }

  // ±4 noise per channel (scanner / compression speckle).
  const rand = rng(11);
  const out = new Uint8Array(W * H * 3);
  for (let i = 0; i < out.length; i++) out[i] = Math.max(0, Math.min(255, Math.round(soft[i] + (rand() * 8 - 4))));
  return out;
}

// Minimal PNG writer: 8-bit RGB, no filtering.
const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePng(rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) Buffer.from(rgb.buffer, y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

writeFileSync(OUT, encodePng(render(classify())));
console.log(`Wrote ${OUT} (${W} × ${H})`);
