// The terrain container and the ONE answer to "is this land?".
//
// terrain = { width, height, elevation: Float32Array (m, ocean negative),
//             category?: Uint8Array }
// In M2a land means elevation > 0. M2b adds a category layer (lake, ice,
// shelf); when present it decides, which allows land below sea level. Every
// other module asks isLand()/landMask() instead of testing elevation itself.

import { ABYSS_DEPTH_M } from './constants.js';

export const CATEGORY = Object.freeze({ OCEAN: 0, LAND: 1 });

export function makeTerrain(width, height, elevation, category = null) {
  return { width, height, elevation, category };
}

export function isLand(terrain, i) {
  return terrain.category
    ? terrain.category[i] === CATEGORY.LAND
    : terrain.elevation[i] > 0;
}

// 1 = land, 0 = water, for every pixel.
export function landMask(terrain) {
  const n = terrain.width * terrain.height;
  const mask = new Uint8Array(n);
  for (let i = 0; i < n; i++) mask[i] = isLand(terrain, i) ? 1 : 0;
  return mask;
}

// A new blank map is open ocean: abyssal plain everywhere.
export function blankTerrain(width, height) {
  return makeTerrain(width, height, new Float32Array(width * height).fill(ABYSS_DEPTH_M));
}
