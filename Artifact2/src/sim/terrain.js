// The terrain container and the ONE answer to "is this land?".
//
// terrain = { width, height, elevation: Float32Array (m, ocean negative),
//             category: Uint8Array | null }
// The category layer (M2b) decides what each pixel is, which allows land
// below sea level (depressions) and lakes above it. Only a terrain without a
// category layer falls back to elevation > 0, and that fallback lives in
// isLand() alone. Every other module asks isLand()/isWater()/isOcean()/
// landMask() instead of testing elevation itself.

import { ABYSS_DEPTH_M } from './constants.js';

// Shelf is not a category: it is ocean less than 200 m deep (SPEC 2.8).
export const CATEGORY = Object.freeze({ OCEAN: 0, LAND: 1, LAKE: 2, LAND_ICE: 3, SEA_ICE: 4 });
export const CATEGORY_COUNT = 5;

export const CATEGORY_LABELS = Object.freeze(['Ocean', 'Land', 'Lake', 'Land ice', 'Sea ice']);

// The one list of land categories.
export function isLandCategory(c) {
  return c === CATEGORY.LAND || c === CATEGORY.LAND_ICE;
}

// Ocean = water that isn't a lake (OCEAN or SEA_ICE).
export function isOceanCategory(c) {
  return !isLandCategory(c) && c !== CATEGORY.LAKE;
}

export function makeTerrain(width, height, elevation, category = null) {
  return { width, height, elevation, category };
}

export function isLand(terrain, i) {
  return terrain.category
    ? isLandCategory(terrain.category[i])
    : terrain.elevation[i] > 0;
}

export function isWater(terrain, i) {
  return !isLand(terrain, i);
}

export function isOcean(terrain, i) {
  return isWater(terrain, i) && !(terrain.category && terrain.category[i] === CATEGORY.LAKE);
}

// 1 = land, 0 = water, for every pixel.
export function landMask(terrain) {
  const n = terrain.width * terrain.height;
  const mask = new Uint8Array(n);
  for (let i = 0; i < n; i++) mask[i] = isLand(terrain, i) ? 1 : 0;
  return mask;
}

// Category layer for imports that only know elevation (heightmap,
// silhouette): LAND where isLand's elevation rule says land, else OCEAN.
export function categoryFromElevation(width, height, elevation) {
  const land = landMask(makeTerrain(width, height, elevation));
  const category = new Uint8Array(land.length);
  for (let i = 0; i < land.length; i++) category[i] = land[i] ? CATEGORY.LAND : CATEGORY.OCEAN;
  return category;
}

// A new blank map is open ocean: abyssal plain everywhere.
export function blankTerrain(width, height) {
  const n = width * height;
  return makeTerrain(width, height, new Float32Array(n).fill(ABYSS_DEPTH_M), new Uint8Array(n).fill(CATEGORY.OCEAN));
}
