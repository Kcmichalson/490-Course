// Tunable simulation constants. Every "start" value from SPEC.md lives here,
// so calibration happens in one place. Each constant names the real-world
// effect it approximates.

// Planet radius in km (Earth). Converts grid cells to km; east-west cell
// width shrinks with cos(latitude). Becomes a planet slider in M3.
export const PLANET_RADIUS_KM = 6371;

// ---- Terrain import (SPEC 2.3–2.7) ----

// Silhouette land with auto-relief off: a low, flat plain, for testing pure
// coastal/continental effects without mountains.
export const FLAT_LAND_M = 200;

// Lowest elevation a land pixel can have. Keeps "land" strictly above sea
// level when the mask says land but the heightmap says sea level or below.
export const MIN_LAND_M = 1;

// Shallowest depth an ocean pixel can have (just below sea level).
export const MIN_OCEAN_M = -1;

// Heightmap defaults: brightest gray → highest peak; darkest gray below sea
// level → deepest ocean (when depths are mapped linearly).
export const DEFAULT_MAX_HEIGHT_M = 5000;
export const DEFAULT_MAX_DEPTH_M = -6000;

// A darkest gray covering at least this share of the image counts as a flat
// ocean (no depth data), so sea level is auto-set to darkest + 1 and depths
// are generated.
export const FLAT_OCEAN_FRACTION = 0.2;

// Light blur that removes 8-bit terracing (staircase slopes) from heightmaps.
export const SMOOTH_RADIUS_PX = 1;

// Generated bathymetry: continental shelf, continental slope, abyssal plain.
export const SHELF_DEPTH_M = -200;   // shelf edge depth
export const SHELF_WIDTH_KM = 100;   // shelf width from the coast
export const SLOPE_WIDTH_KM = 300;   // slope from shelf edge down to the abyss
export const ABYSS_DEPTH_M = -4000;  // abyssal plain depth
export const BATHY_NOISE_M = 400;    // seafloor variety (ridges, basins)
export const BATHY_NOISE_FREQ = 3;   // low frequency: features thousands of km wide

// Auto-relief: interiors rise away from the coast (continental uplift), with
// low-frequency highlands and a few ridged mountain chains so rain shadows
// can form.
export const RELIEF_COAST_M = 20;       // coastal lowlands
export const RELIEF_INTERIOR_M = 700;   // extra height deep inland
export const RELIEF_SCALE_KM = 500;     // how fast land rises inland
export const RELIEF_NOISE_M = 500;      // broad highlands and basins
export const RELIEF_NOISE_FREQ = 2.5;
export const RELIEF_RIDGE_M = 1800;     // mountain ridges
export const RELIEF_RIDGE_FREQ = 4;
