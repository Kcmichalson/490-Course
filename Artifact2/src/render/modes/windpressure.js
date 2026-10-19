// Wind Speed & Pressure (SPEC 13.3, M3): relative wind speed as a fill (calm
// zones dark, strong winds bright), with the pressure belts drawn as lines in
// screen space (drawScreen; lows solid, highs dashed, the ITCZ in its own
// color). Land is shaded darker so the continents stay readable. The speed
// field is drawn at sim resolution and upscaled bilinearly (SPEC 2.8). Gray
// until the first wind result arrives.

import { isLand } from '../../sim/terrain.js';
import { drawBeltLines } from '../pressure.js';

// Data palette (with the renderer, per CLAUDE.md): a viridis-like ramp,
// perceptually even and colorblind-safe. Speed 0 → 1 (relative).
const RAMP = [[68, 1, 84], [59, 82, 139], [33, 145, 140], [94, 201, 98], [253, 231, 37]];
const PENDING = [70, 74, 80];
const LAND_SHADE = 0.3; // land drawn 30% darker

export function speedColor(speed) {
  const t = Math.min(1, Math.max(0, speed)) * (RAMP.length - 1);
  const k = Math.min(RAMP.length - 2, Math.floor(t));
  const f = t - k;
  return RAMP[k].map((c, i) => Math.round(c + (RAMP[k + 1][i] - c) * f));
}

let simCache = { result: null, canvas: null };

function speedCanvas(climate) {
  if (simCache.result === climate.result) return simCache.canvas;
  const { width: W, height: H } = climate.grid;
  const img = new ImageData(W, H);
  const speed = climate.result.speed;
  for (let i = 0, p = 0; i < W * H; i++, p += 4) {
    const c = speedColor(speed[i]);
    img.data[p] = c[0]; img.data[p + 1] = c[1]; img.data[p + 2] = c[2]; img.data[p + 3] = 255;
  }
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  canvas.getContext('2d').putImageData(img, 0, 0);
  simCache = { result: climate.result, canvas };
  return canvas;
}

export function drawWindPressure(g, { map, terrain, climate, rect }) {
  const r = rect ?? { x0: 0, y0: 0, x1: map.sourceWidth, y1: map.sourceHeight };
  const w = r.x1 - r.x0;
  const h = r.y1 - r.y0;
  if (w <= 0 || h <= 0) return;
  const ready = climate?.result && climate.grid;
  if (!ready) {
    g.fillStyle = `rgb(${PENDING.join(', ')})`;
    g.fillRect(r.x0, r.y0, w, h);
  } else {
    const sim = speedCanvas(climate);
    const sx = sim.width / map.sourceWidth;
    const sy = sim.height / map.sourceHeight;
    g.save();
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.beginPath();
    g.rect(r.x0, r.y0, w, h);
    g.clip();
    // A one-cell margin keeps bilinear edges right inside partial rects.
    const cx0 = Math.max(0, Math.floor(r.x0 * sx) - 1);
    const cy0 = Math.max(0, Math.floor(r.y0 * sy) - 1);
    const cx1 = Math.min(sim.width, Math.ceil(r.x1 * sx) + 1);
    const cy1 = Math.min(sim.height, Math.ceil(r.y1 * sy) + 1);
    g.drawImage(sim, cx0, cy0, cx1 - cx0, cy1 - cy0, cx0 / sx, cy0 / sy, (cx1 - cx0) / sx, (cy1 - cy0) / sy);
    g.restore();
  }
  // Land shading from the full-resolution terrain.
  const shade = g.getImageData(r.x0, r.y0, w, h);
  const d = shade.data;
  const tw = terrain.width;
  for (let y = 0; y < h; y++) {
    let p = y * w * 4;
    let i = (r.y0 + y) * tw + r.x0;
    for (let x = 0; x < w; x++, p += 4, i++) {
      if (!isLand(terrain, i)) continue;
      d[p] *= 1 - LAND_SHADE; d[p + 1] *= 1 - LAND_SHADE; d[p + 2] *= 1 - LAND_SHADE;
    }
  }
  g.putImageData(shade, r.x0, r.y0);
}
drawWindPressure.partial = true;
// The base layer rebuilds when a new wind result arrives.
drawWindPressure.dataKey = (store) => `wind${store.climate?.version ?? 0}`;
// Pressure belts as screen-space lines, drawn after the base layer each frame.
drawWindPressure.drawScreen = drawBeltLines;

const rgb = (c) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
drawWindPressure.legend = {
  items: [0, 0.25, 0.5, 0.75, 1].map((s) => ({ color: rgb(speedColor(s)), label: s === 0 ? '0 (calm)' : s === 1 ? '1.0 (base ocean wind)' : String(s) })),
  note: 'Relative wind speed. Lines: solid = low pressure (ITCZ, subpolar lows), dashed = high pressure. Land shaded darker. Monsoon highs and lows arrive in M8.',
};
