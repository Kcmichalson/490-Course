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
// ocean (no depth data), so Auto sea level is the first gray actually used
// above it, and depths are generated.
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

// ---- Sculpt brushes (SPEC 2.1) ----
// Brushes are editing tools, not physics; these are their start values.

// Raise / Lower: meters added or removed per dab at the brush center at
// 100% strength (builds mountains or basins gradually, like uplift and
// erosion compressed into strokes). Clamped to a plausible height range.
export const BRUSH_RAISE_M = 200;
export const BRUSH_MAX_M = 9000;     // a little above Everest
export const BRUSH_LOWER_FLOOR_M = -6000; // Lower stops at the deep abyssal plain

// Carve Trench: deep, narrow ocean trenches (subduction zones), down to
// about the depth of the Mariana Trench.
export const BRUSH_CARVE_M = 1000;
export const TRENCH_FLOOR_M = -10000;

// Draw Land: new land starts as a low plain (same as flat silhouette land).
export const DRAW_LAND_M = FLAT_LAND_M;

// Erase: new ocean starts as a shallow shelf sea (the Shallow Sea palette
// depth), so erased coasts don't drop straight into the abyss.
export const ERASE_OCEAN_M = -100;

// Largest brush radius (source px). Keeps every brush under 16 ms per dab
// (brush math plus redraw) on a 5632×2048 map; radius 500 measured ~30–50 ms.
export const BRUSH_MAX_RADIUS_PX = 250;

// Smooth: largest box radius (px) used for the local mean, so one dab of a
// big brush stays fast; repeated dabs smooth further.
export const SMOOTH_MAX_KERNEL_PX = 6;

// ---- Image type guess (SPEC 2.3–2.5) ----

// A pixel is "colorful" when its R, G, B spread more than this (gray images
// and JPEG chroma speckle stay below it). An image is a color image when
// more than COLORFUL_SHARE of its pixels are colorful.
export const COLORFUL_SPREAD = 8;
export const COLORFUL_SHARE = 0.01;

// ---- Color palette import (SPEC 2.5) ----
// Palette maps are drawn art, not physics; these are their start values.

export const PALETTE_TOLERANCE_DE = 12;  // ΔE76: how far a pixel may be from a swatch
export const PALETTE_MERGE_DE = 2;       // scan: colors this close become one swatch (default)
export const PALETTE_MERGE_MAX_DE = 12;  // scan merge slider maximum (noisy images need ~6–8)
export const PALETTE_MAX_SWATCHES = 16;
export const PALETTE_SMOOTH_PX = 2;      // tier smoothing: softens steps between land tiers
export const PALETTE_LAND_M = FLAT_LAND_M; // default Land / Land Ice swatch elevation
export const PALETTE_LAKE_M = 0;         // default lake surface
export const SHALLOW_SEA_M = -100;       // Shallow Sea / Shelf swatches: mid-shelf depth
// Deep Ocean / Sea Ice get generated depth, but never shallower than the
// shelf edge, so "deep" water reads as off the continental shelf.
export const DEEP_OCEAN_MAX_M = SHELF_DEPTH_M;
