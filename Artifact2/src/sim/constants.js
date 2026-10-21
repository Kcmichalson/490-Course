// Tunable simulation constants. Every "start" value from SPEC.md lives here,
// so calibration happens in one place. Each constant names the real-world
// effect it approximates.

// Planet radius in km (Earth). Converts grid cells to km; east-west cell
// width shrinks with cos(latitude). The default for the map config's
// `radiusKm` (the Planet panel slider, M3).
export const PLANET_RADIUS_KM = 6371;
export const PLANET_RADIUS_MIN_KM = 1000;
export const PLANET_RADIUS_MAX_KM = 20000;

// ---- Planet and seasons (SPEC 3) ----

// Rotation period (h): sets the number of circulation cells (Coriolis
// strength) and the length of a day. Earth = 24 h.
export const ROTATION_DEFAULT_H = 24;
export const ROTATION_MIN_H = 4;
export const ROTATION_MAX_H = 240;

// Axial tilt (°): sets the solar declination swing, so the seasons, the
// tropics, and the polar circles. Earth = 23.5°.
export const TILT_DEFAULT_DEG = 23.5;
export const TILT_MAX_DEG = 45;

// Lunar pull (1 = Earth's Moon): tidal range, used from M9.
export const LUNAR_PULL_DEFAULT = 1;
export const LUNAR_PULL_MAX = 3;

// Days in the year used by the declination formula (no orbital-period
// setting yet; SPEC 3), and the day of the northern spring equinox.
export const YEAR_DAYS = 365;
export const EQUINOX_DAY = 80;

// Rotation-period thresholds for circulation cells per hemisphere (SPEC 3):
// slower rotation = weaker Coriolis = fewer, wider cells.
//   > 40 h → 1; 14 ≤ P ≤ 40 → 3; 8 ≤ P < 14 → 5; < 8 → 7
export const CELLS_ONE_ABOVE_H = 40;
export const CELLS_THREE_FROM_H = 14;
export const CELLS_FIVE_FROM_H = 8;

// ---- Wind (SPEC 4.1–4.3) ----

// The ITCZ follows the sun at half its declination (thermal lag and ocean
// inertia keep it from tracking the sun fully).
export const ITCZ_FACTOR = 0.5;

// Wind angle limits (degrees off due east/west) by rotation period: fast
// rotation (strong Coriolis) turns the wind east-west; slow rotation lets air
// flow more directly north-south. Interpolated in log(period), clamped.
export const WIND_ANGLE_ANCHORS = Object.freeze([
  Object.freeze({ hours: 4, min: 5, max: 45 }),
  Object.freeze({ hours: 24, min: 15, max: 75 }),
  Object.freeze({ hours: 40, min: 50, max: 85 }),
]);

// Base wind speed over ocean (relative units, 1 = base ocean wind).
export const WIND_BASE_SPEED = 1.0;

// Calm belts at band edges (doldrums at the ITCZ, horse latitudes at the
// subtropical highs, calm polar highs): speed ramps down to CALM_FLOOR over
// the CALM_EDGE_FRACTION of each band nearest each edge.
export const CALM_FLOOR = 0.15;
export const CALM_EDGE_FRACTION = 0.25;

// ---- Terrain wind (SPEC 4.5, M4b) ----

// Surface friction: rough land slows the wind to ~60% of its speed over sea.
export const LAND_FRICTION = 0.6;
// Mountain deflection: air meeting high, steep terrain can't climb it all
// and flows around it instead. Blocking ramps in from DEFLECT_LOW_M to
// DEFLECT_HIGH_M of elevation and up to DEFLECT_SLOPE_M_PER_KM of slope;
// at most DEFLECT_MAX of the uphill component is removed, and
// DEFLECT_REDIRECT of what's removed flows along the contours instead.
export const DEFLECT_LOW_M = 500;          // lower ridges are crossed
export const DEFLECT_HIGH_M = 1500;
export const DEFLECT_SLOPE_M_PER_KM = 10;
export const DEFLECT_MAX = 0.8;
export const DEFLECT_REDIRECT = 0.7;

// ---- Temperature (SPEC 6, M4) ----

// Solar constant (W/m²): sunlight at the top of the atmosphere at Earth's
// distance. With the SPEC declination and 12 mid-month days it gives
// Tq ≈ 26.3 °C at the equator and −25.0 °C at the poles (LOG M4).
export const SOLAR_CONSTANT = 1361;

// Radiative temperature Tq = A·Q + B (°C from daily-mean insolation): a
// linear fit standing in for the greenhouse effect and heat transport.
export const TQ_SLOPE = 0.212;
export const TQ_OFFSET = -61.7;

// Seasonal swing: how much of the radiative seasonal cycle a surface
// feels. Water's heat capacity damps it (ocean); deep interiors feel half.
export const SWING_OCEAN = 0.15;
export const SWING_INTERIOR = 0.5;

// Seasonal lag (days): land warms and cools within weeks, the ocean's
// mixed layer takes over a month, so the warmest month comes after the
// solstice.
export const LAG_LAND_DAYS = 15;
export const LAG_OCEAN_DAYS = 45;

// Continentality: maritime air loses its ocean character over ~1,500 km of
// travel inland (tracer decay), and anywhere near a coast feels the sea
// (sea breezes, mixing) over ~300 km whichever way the wind blows.
export const MARITIME_DECAY_KM = 1500;
export const COAST_DECAY_KM = 300;
// Stop when no cell changes more than this in a sweep. At 1e-3 the tracer is
// within ~4e-3 of the converged answer, which moves s by ≤ 0.0015 (under
// 0.1 °C even for a 70 °C radiative swing); measured in M4 (LOG).
export const TRACER_TOLERANCE = 1e-3;
export const TRACER_MAX_SWEEPS = 200;
// Over-relaxation of the tracer's in-place sweeps (numerical, not physics:
// it only changes how fast the sweeps converge, not the answer).
export const TRACER_SOR = 1.0;

// Environmental lapse rate: air cools ~6.5 °C per km of height.
export const LAPSE_C_PER_M = -0.0065;

// Land ice reflects most sunlight (albedo), so ice sheets run colder.
export const LAND_ICE_C = -5;

// Mode thresholds (start values; SPEC 13.3 M4 definitions).
export const GROWING_THRESHOLD_C = 5;      // thermal growing season: daily mean ≥ 5 °C
export const TREE_LINE_C = 10;             // trees need a warmest month ≥ 10 °C
export const SNOWLINE_C = 0;               // warmest month < 0 °C: snow never melts
export const PERMAFROST_C = -2;            // mean annual ≤ −2 °C: discontinuous permafrost
export const PERMAFROST_CONTINUOUS_C = -8; // mean annual ≤ −8 °C: continuous permafrost
export const SNOW_COVER_C = -3;            // coldest month < −3 °C: lasting winter snow
export const FREQUENT_FROST_C = 3;         // coldest month < 3 °C: frequent frost
export const OCCASIONAL_FROST_C = 12;      // coldest month < 12 °C: occasional frost

// ---- Precipitation (SPEC 7, M5) ----
// Moisture q is in capacity units: air at 0 °C holds 1.

// Clausius–Clapeyron: warm air holds more water vapor, ~7% more per °C.
export const CAPACITY_PER_C = 0.07;
// Background rain-out: a base share of the moisture rains out as air
// travels (continental decay over land, SPEC 7: 2% per step at the default
// 1024 grid, whose step is ~39 km, so ~1,950 km per e-fold). Scaled by the
// step length, so every grid size gives the same answer.
export const RAINOUT_KM = 1950;
// Rain needs nearly saturated air: the background rain-out ramps in from
// this relative humidity (none below it) to full strength at saturation.
export const RAIN_RH_MIN = 0.3;
// Recycling: a share of the rain on land evaporates again (soil, plants),
// so large interiors don't go bone-dry (SPEC 7: 30–50%).
export const RECYCLE = 0.4;
// Evaporation over open water: sea air approaches saturation at the water's
// temperature within ~1,000 km of travel (about a day).
export const EVAP_KM = 1000;
// Orographic rain: air forced up a slope loses this share of its moisture
// per 1,000 m climbed (on top of the cooling-driven capacity drop), scaled
// by the humidity ramp (lifted dry air rains little; approved Session 8).
export const OROG_PER_KM = 0.3;
// The climb is measured on terrain smoothed over ±this many km (a box,
// east-west in km with cos latitude), so the small bumps of rough ground
// don't each wring out moisture: air rides over them, and only broad
// mountain slopes force real ascent (approved Session 8; LOG M5).
export const OROG_SMOOTH_KM = 120;
// Rain shadow: on a descending slope sinking air warms and dries, so the
// background rain-out falls off with the descent gradient (e-fold 5 m/km).
export const DESCENT_M_PER_KM = 5;
// Pressure belts: rising air at the lows (ITCZ, subpolar lows) rains ~2×,
// sinking air at the highs (subtropical, polar) ~0.3× (SPEC 7).
export const BELT_LOW_FACTOR = 2;
export const BELT_HIGH_FACTOR = 0.3;
// Off the map of a partial map: open ocean air at this relative humidity.
export const RH_EDGE = 0.8;
// Scale from moisture rained out per km of travel to mm/month (calibration):
// set so the area-weighted global mean on the GEBCO Earth map (Annual Mean,
// 1024) is 82 mm/month, Earth's ~990 mm/yr (LOG M5: 100,000 → 95,630 at
// first; 96,294 after the approved orographic changes, mean 81.435 → 82).
export const PRECIP_CAL = 96294;
// Numerical, not physics (SPEC 7, approved Session 8): a loop of cells
// (e.g. a latitude ring) stops when its estimated remaining error, the last
// change ÷ (1 − the contraction between successive passes), is below this
// share of each cell's capacity, or after 500 passes. (A "< 1% change per
// pass" stop measured ~20% off the converged answer at 1024; LOG M5.)
export const PRECIP_TOLERANCE = 0.01;
export const PRECIP_MAX_SWEEPS = 500;
// The pair and self-share solves inside one cell update stop at this.
export const PRECIP_LOCAL_TOLERANCE = 1e-6;

// Mode thresholds (SPEC 13.3 M5 definitions).
// Seasonality needs enough rain to mean anything: below this annual total
// the index is "too dry to tell".
export const SEASONALITY_MIN_MM_YR = 60;
// Thornthwaite PET: above this monthly mean the standard hot-month formula
// replaces the power law (evaporation stops rising steeply).
export const THORNTHWAITE_HOT_C = 26.5;
// Too cold to evaporate much: below this annual PET, aridity reads "cold".
export const ARIDITY_COLD_PET_MM_YR = 100;
// Clouds form as air nears saturation: none below this relative humidity,
// full cover at the second one.
export const CLOUD_RH_CLEAR = 0.3;
export const CLOUD_RH_OVERCAST = 0.95;
// Rising air (lows) builds deeper cloud than sinking air (highs): the share
// of cover that depends on lift.
export const CLOUD_LIFT_SHARE = 0.3;
// Raining air is cloudy whatever its humidity after the rain-out: rain adds
// cover 1 − exp(−P / this many mm/month) (approved Session 9, chosen on
// GEBCO: without it rainforests read 1–3% cloud; LOG M5).
export const CLOUD_RAIN_MM = 50;

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
