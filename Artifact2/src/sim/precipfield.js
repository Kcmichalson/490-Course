// Precipitation at full resolution (SPEC 7, M5 display). Pure, no DOM.
//
// Precipitation lives on the sim grid (rain depends on the air's path, not
// on one pixel), so each source pixel reads it bilinearly (SPEC 2.8:
// continuous layers upscale bilinearly). The pixel's own category decides
// whether it is drawn as land or (darker) water.
//
// ctx = { map, category (full resolution), layer (sim grid, mm/month), simW, simH }

import { isLandCategory } from './terrain.js';
import { bilinear } from './temperature.js';
import { WATER, WATER_FLAG, classOf } from './climatefield.js';
import {
  SEASONALITY_EDGES, SEASONALITY_TOO_DRY, isTooDryForSeasonality, ARIDITY_EDGES, ARIDITY_COLD, isColdForAridity, CLOUD_EDGES,
} from './hydrostats.js';

// Precipitation mode classes (mm/month): < 10, 10–25, 25–50, 50–100,
// 100–150, 150–200, 200–300, ≥ 300. The edges line up with the SPEC M5
// checks (10, 50, 100, 150).
export const PRECIP_EDGES = [10, 25, 50, 100, 150, 200, 300];

// Sim-cell coordinate (cell centers at integers) of a source pixel center.
const cellX = (ctx, x) => ((x + 0.5) * ctx.simW) / ctx.map.sourceWidth - 0.5;
const cellY = (ctx, y) => ((y + 0.5) * ctx.simH) / ctx.map.sourceHeight - 0.5;

// mm/month of a sim layer at a source pixel.
export const pixelPrecip = (ctx, x, y, layer = ctx.layer) => bilinear(layer, ctx.simW, ctx.simH, cellX(ctx, x), cellY(ctx, y), ctx.map.wraps);

// Per-pixel class codes over source rows [y0, y1) and columns [x0, x1),
// written into out (Uint8Array(sourceWidth · sourceHeight)). Water pixels get
// class + WATER_FLAG (drawn darker).
export function fillPrecipClasses(mode, ctx, y0, y1, out, x0 = 0, x1 = ctx.map.sourceWidth) {
  const W = ctx.map.sourceWidth;
  for (let y = y0; y < y1; y++) {
    for (let x = x0, i = y * W + x0; x < x1; x++, i++) {
      const water = !isLandCategory(ctx.category[i]);
      out[i] = classOf(pixelPrecip(ctx, x, y), PRECIP_EDGES) + (water ? WATER_FLAG : 0);
    }
  }
  return out;
}

// ---- Seasonality, Aridity, Cloud Cover (SPEC 13.3 M5) ----
// ctx = { map, category, layer (annual mean, mm/month), stats (hydroStats),
//         cloud (this season, 0–1), simW, simH }

// Annual precipitation (mm/yr) at a pixel.
export const pixelAnnualMm = (ctx, x, y) => 12 * pixelPrecip(ctx, x, y);

// Seasonality class: the index, or "too dry to tell" when the annual total
// is too small for the index to mean anything.
export function seasonalityClassAt(ctx, x, y) {
  if (isTooDryForSeasonality(pixelAnnualMm(ctx, x, y))) return SEASONALITY_TOO_DRY;
  return classOf(pixelPrecip(ctx, x, y, ctx.stats.seasonality), SEASONALITY_EDGES);
}

// Aridity at a pixel: { p, pet (mm/yr), ai, cls }; cls = ARIDITY_COLD when
// too cold to evaporate much.
export function aridityAt(ctx, x, y) {
  const p = pixelAnnualMm(ctx, x, y);
  const pet = pixelPrecip(ctx, x, y, ctx.stats.pet);
  const ai = pet > 0 ? p / pet : Infinity;
  return { p, pet, ai, cls: isColdForAridity(pet) ? ARIDITY_COLD : classOf(ai, ARIDITY_EDGES) };
}

// Land-only modes: water pixels get WATER (drawn muted).
export function fillSeasonalityClasses(mode, ctx, y0, y1, out, x0 = 0, x1 = ctx.map.sourceWidth) {
  const W = ctx.map.sourceWidth;
  for (let y = y0; y < y1; y++) {
    for (let x = x0, i = y * W + x0; x < x1; x++, i++) out[i] = isLandCategory(ctx.category[i]) ? seasonalityClassAt(ctx, x, y) : WATER;
  }
  return out;
}

export function fillAridityClasses(mode, ctx, y0, y1, out, x0 = 0, x1 = ctx.map.sourceWidth) {
  const W = ctx.map.sourceWidth;
  for (let y = y0; y < y1; y++) {
    for (let x = x0, i = y * W + x0; x < x1; x++, i++) out[i] = isLandCategory(ctx.category[i]) ? aridityAt(ctx, x, y).cls : WATER;
  }
  return out;
}

// Cloud cover: land and water, water drawn darker.
export function fillCloudClasses(mode, ctx, y0, y1, out, x0 = 0, x1 = ctx.map.sourceWidth) {
  const W = ctx.map.sourceWidth;
  for (let y = y0; y < y1; y++) {
    for (let x = x0, i = y * W + x0; x < x1; x++, i++) {
      const water = !isLandCategory(ctx.category[i]);
      out[i] = classOf(pixelPrecip(ctx, x, y, ctx.cloud), CLOUD_EDGES) + (water ? WATER_FLAG : 0);
    }
  }
  return out;
}
