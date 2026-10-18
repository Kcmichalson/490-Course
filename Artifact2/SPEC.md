# Fantasy Climate Mapper: Specification (v1)

The app starts as an open ocean. The user paints land or imports a map, sets
planetary parameters, and the app simulates winds, ocean currents,
temperature, precipitation, Köppen climates, and tides.

The goal is *plausible and explainable*, not research-grade. Every rule is a
simplification of a real effect. Numbers marked "start" are calibration
starting points: tune them in src/sim/constants.js until the milestone
verification checks pass.

---

## 1. Map setup and coordinates

- **New blank map** dialog with size presets: 2048×1024, 4096×2048,
  5632×2048 (Paradox-style), or custom. Max source size 8192×4096.
- **Latitude range:** top-edge and bottom-edge latitude (default 90°N / 90°S).
  Needed because many maps (e.g., Paradox) crop the poles and aren't 2:1.
- **Longitude span** (default 360°) and an **east-west wrap** toggle
  (default on). Non-wrapping maps treat the left/right edges as open boundaries.
- **Simulation resolution:** 512, 1024 (default), or 2048 cells wide. Height
  follows the source aspect ratio.
- Projection is equirectangular: latitude and longitude are linear in y and x.
- Cell size in km comes from the planet radius (section 3). East-west cell
  width shrinks with cos(latitude); anything distance-based (advection,
  decay lengths, search radii) must account for this.

## 2. Terrain input

### 2.1 Blank map and sculpting brushes
- Brushes: Draw Land, Erase to Ocean, Raise, Lower, Carve Trench, Smooth.
- Brush size and strength sliders.
- Brushes edit the full-resolution elevation layer. The simulation
  recomputes when a stroke ends (debounced), not during the stroke.

### 2.2 Supported formats
PNG, BMP, WEBP, JPG via the browser image decoder. SVG is rasterized at the
chosen map size. Browsers decode to 8-bit, so 16-bit PNG heightmaps need a
vendored decoder to keep their precision.

### 2.3 Silhouette import (land/ocean only)
- Land detection: opaque = land / transparent = ocean, or high-contrast
  black/white with a threshold slider and an invert toggle.
- **Auto-Generate Interior Elevation** toggle:
  - Off: all land is flat at 200 m (start), for testing pure
    coastal/continental effects.
  - On: elevation grows with distance from the coast plus low-frequency
    noise, creating gentle interior highlands and a few ridges so rain
    shadows can form.

### 2.4 Grayscale heightmap import
- Settings, auto-filled on import and adjustable with a live coastline preview:
  - **Sea level value:** gray value where land begins (auto: darkest
    value + 1 if a large flat region sits at the darkest value).
  - **Highest value:** auto-detected brightest value.
  - **Height of highest value in meters** (default 5,000 m).
  - **Curve (gamma)** slider, default 1.0 (linear).
- Mapping: sea level value → 0 m, highest value → max height.
- Values below sea level (if any) map linearly from 0 m down to a
  configurable max depth (default −6,000 m). If the ocean is one flat value,
  bathymetry is generated instead (2.7).
- A light smoothing pass (1–2 px blur, start) removes 8-bit terracing.
- Example: Paradox heightmaps range roughly 89 (#595959) to 203 (#CBCBCB).

### 2.5 Color palette import (stylized hand-drawn maps)
- On import, scan the image and show the most common colors as swatches.
  An eyedropper picks additional colors straight from the map.
- The user assigns each swatch a **category**:
  - Deep Ocean, Shallow Sea / Shelf, Lake (freshwater, no tides),
    Land, Land Ice, Sea Ice, **Ignore**.
  - Each Land swatch can carry an **elevation in meters**, so shades of green
    become elevation tiers.
  - Ignore is for labels, arrows, gridlines, and borders. Those pixels are
    filled in from their nearest non-ignored neighbors.
- Matching: each pixel takes the *nearest* palette color (perceptual
  distance, e.g., in Lab space) within a tolerance slider. Unmatched pixels
  are treated as Ignore and highlighted in the preview.
- Palettes are saved as named presets (localStorage) and can be exported
  and imported as JSON.

### 2.6 Separate land/sea mask (optional)
Any heightmap import can take a second image as the land/sea mask. Paradox
games define sea zones in separate files, so the heightmap alone may not show
the true coastline.

### 2.7 Bathymetry
- Used when the input has no depth data: continental shelf from 0 to −200 m
  within a shelf width of 100 km (start), sloping to −4,000 m abyssal plain
  over the next ~300 km. Low-frequency noise adds variety.
- The Carve Trench brush can go down to −10,000 m.
- Shallow Sea / Shelf palette color → −100 m; Deep Ocean → generated depth.

### 2.8 Downsampling to the simulation grid
- Each sim cell stores: land fraction, mean land elevation, max elevation,
  mean ocean depth, and its category (land if land fraction > 0.5).
- Islands smaller than a cell disappear from the simulation but stay
  visible in renders; their pixels take values from the nearest land cell.
- Upscaling for display: bilinear for continuous layers, nearest/majority
  for categorical layers (Köppen), then clipped to the full-resolution
  coastline.

### 2.9 Sea caves
Sea caves are far smaller than a grid cell, so they don't feed back into
climate or tides. They're generated as point markers after the tide model
runs, and the user can place their own. See section 9.1.

## 3. Planet parameters (global sliders)

| Parameter | Range | Default |
|---|---|---|
| Planet radius | 1,000–20,000 km | 6,371 km |
| Rotation period | 4–240 hours | 24 h |
| Spin direction | prograde / retrograde | prograde |
| Axial tilt | 0–45° | 23.5° |
| Season | day of year 0–364, presets, or Annual Mean | Annual Mean |
| Lunar pull strength | 0–3 (1 = Earth's Moon) | 1 |

**Circulation cells per hemisphere** (stylized rule, from rotation period):

| Rotation period | Cells per hemisphere | Result |
|---|---|---|
| > 40 h | 1 | one giant Hadley cell, mostly north-south flow |
| 14–40 h | 3 | Earth-like: trades, westerlies, polar easterlies |
| 8–14 h | 5 | narrower alternating bands |
| < 8 h | 7 | Jupiter-style banding |

Season presets: Northern Spring Equinox (day 80), Northern Summer Solstice
(day 172), Autumn Equinox (day 266), Southern Summer Solstice (day 355),
Annual Mean (average of 12 monthly runs).

Solar declination: `decl = tilt * sin(2π * (day − 80) / 365)`.

## 4. Wind

### 4.1 Circulation bands
Each cell's base wind depends only on its effective latitude (4.2):

```js
const n = cellsPerHemisphere;              // table in section 3
const bandWidth = 90 / n;
const a = Math.abs(latEff);
const k = Math.min(n - 1, Math.floor(a / bandWidth)); // band index from equator
const t = (a - k * bandWidth) / bandWidth;             // 0 = equator side, 1 = pole side
const direct = k % 2 === 0;               // trades and polar easterlies
const eastward = (direct ? -1 : 1) * spin;  // spin: +1 prograde, -1 retrograde
const poleward = direct ? -1 : 1;
const turn = direct ? t : 1 - t;          // 1 = air just left high pressure
const angle = deg2rad(minAngle + (maxAngle - minAngle) * turn);
const hemi = Math.sign(latEff) || 1;      // +1 north, -1 south
u = eastward * Math.cos(angle);           // + = toward east
v = poleward * hemi * Math.sin(angle);    // + = toward north
```

- Angle limits (degrees off due east/west) scale with rotation: 15°–75°
  at 24 h (start), shifting toward north-south flow for slow rotation
  (e.g., 50°–85° at 1 cell) and toward east-west flow for fast rotation.
- Base wind speed: 1.0 over ocean (start). Speed falls toward band edges
  where the wind is calm (doldrums, horse latitudes).
- Band names for the overlay: n = 3 → Trade Winds, Westerlies, Polar
  Easterlies. Other n → "Easterlies" / "Westerlies" by direction.

### 4.2 Seasonal ITCZ shift
- `itcz = itczFactor * decl`, itczFactor = 0.5 (start).
- Effective latitude remaps so the ITCZ sits at 0 while the poles stay fixed:
  - lat ≥ itcz: `latEff = 90 * (lat − itcz) / (90 − itcz)`
  - lat < itcz: `latEff = −90 * (itcz − lat) / (itcz + 90)`

### 4.3 Pressure belts
Band boundaries at `j * bandWidth` (in latEff): even j = low pressure
(ITCZ at 0°, subpolar low at 60° for n = 3), odd j = high pressure
(subtropical highs at 30°, polar highs at 90°). Used by the precipitation
model and the Pressure & ITCZ overlay.

### 4.4 Land-sea thermal effects (monsoons)
- After a first temperature pass, each land cell gets a pressure anomaly
  proportional to its temperature difference from the zonal-mean ocean
  temperature at its latitude (hot interior = thermal low, cold interior =
  thermal high), smoothed over ~1,000 km (start).
- Add a wind component down the pressure gradient, deflected 45° by Coriolis
  (right in the north, left in the south, reversed for retrograde), weaker
  near the equator.
- Result: summer winds blow onshore into hot continents (summer monsoon);
  winter winds blow offshore (winter monsoon).

### 4.5 Friction and mountain deflection
- Wind speed over land × 0.6 (start).
- Where wind blows up steep, high terrain (above ~1,500 m, start), reduce
  the uphill component and redirect part of it along the contours, then
  smooth. Air still crosses lower ridges, which is what produces rain shadows.

## 5. Ocean currents and upwelling

- **Wind-driven flow:** surface current starts as the wind rotated 45°
  (right in the north, left in the south; reversed for retrograde).
- **Coastal constraint:** iterative pressure projection (Jacobi, ~50
  iterations, start) makes the flow roughly divergence-free with no flow into
  land. Water deflects along coasts and forms gyres: clockwise in the
  northern hemisphere, counter-clockwise in the southern (prograde).
- Optional western boundary intensification: stronger currents along the
  western edges of ocean basins (Gulf Stream, Kuroshio).
- **Sea surface temperature (SST):** latitude base temperature, then advected
  along the currents for several steps, so poleward currents carry warm water
  and equatorward currents carry cold water. Clamp at −1.8 °C.
- **Warm/cold classification:** SST more than 1 °C above the zonal mean =
  warm (red arrows); more than 1 °C below = cold (blue arrows).
- **Upwelling:** coastal ocean cells where Ekman transport (wind rotated 90°,
  right in the north / left in the south) points away from the coast and the
  wind runs roughly parallel to it. Effects: SST −3 °C (start), reduced
  evaporation, flagged green as rich fishing waters.
- **Sea ice:** auto-computed where SST ≤ −1.8 °C; painted Sea Ice is
  permanent. Sea ice blocks evaporation.

## 6. Temperature

- **Insolation:** daily-mean top-of-atmosphere insolation Q from latitude and
  solar declination (standard formula with sunrise hour angle
  `cos h0 = −tanφ tanδ`, clamped for polar day/night).
- **Radiative temperature:** `Tq = 0.212 * Q − 61.7` (start; calibrated so an
  Earth-like annual mean gives ~27 °C at the equator and ~−25 °C at the poles).
- **Seasonal swing:** `T = Tannual + s * (Tq(season) − Tannual)`, with
  s = 0.5 for deep interiors and 0.15 for ocean (start).
- **Seasonal lag:** land uses the declination from 15 days earlier,
  ocean from 45 days earlier.
- **Continentality:** a maritime-influence tracer is carried inland along the
  wind (decay ~1,500 km, start) plus a distance-to-coast term (decay ~300 km).
  It blends s between the ocean and interior values. Coasts that face the
  prevailing wind stay mild far inland; interiors get extreme seasons.
- **Lapse rate:** −6.5 °C per 1,000 m of elevation above sea level.
- **Ocean currents:** coastal land within ~300 km takes on part of the
  adjacent SST anomaly (roughly +2 to +5 °C next to warm currents,
  −2 to −5 °C next to cold ones), fading inland.
- **Land ice:** −5 °C albedo modifier (start).

## 7. Precipitation and rain shadows

- Moisture is carried along the final wind field (semi-Lagrangian
  advection, east-west steps scaled by 1/cos(latitude)), iterated until the
  field changes by less than 1% or 500 steps (start).
- **Evaporation:** over open ocean, proportional to `exp(0.07 * SST)`;
  reduced over cold and upwelling water; none over sea ice.
- **Capacity:** air can hold moisture proportional to `exp(0.07 * Tair)`;
  excess above capacity rains out.
- **Continental decay:** over land, a base fraction rains out each step
  (2%, start), so interiors get drier the farther they are from the
  moisture source.
- **Recycling:** 30–50% of land rainfall re-evaporates into the air (start),
  so large forested interiors don't go bone-dry.
- **Orographic rain:** when wind climbs (Δh > 0 along the wind), extra rain
  proportional to the climb falls on the windward slope.
- **Rain shadow:** when wind descends (Δh < 0), descending air warms and
  its capacity rises, so almost no rain falls on the leeward side.
- **Pressure belts:** rain multiplier ~2× near low-pressure boundaries
  (ITCZ, subpolar lows) and ~0.3× near high-pressure boundaries (subtropical
  and polar highs), as smooth functions of latEff (start).
- Output in mm/month, scaled by a calibration constant (see M5 checks).

## 8. Köppen classification

Runs on 12 monthly snapshots (mid-month days). Computed lazily when the
Köppen map mode or Annual Mean is opened, cached until terrain or planet
settings change. Summer half = Apr–Sep in the north, Oct–Mar in the south.
T = monthly temperature, P = monthly precipitation, MAT/MAP = annual means.

Rules (Köppen–Geiger, applied in this order):

1. **E (polar):** warmest month < 10 °C. ET if warmest ≥ 0 °C, else EF.
2. **B (dry):** threshold `Pth = 20 * MAT + 280` if ≥ 70% of annual
   precipitation falls in the summer half; `20 * MAT + 140` if 30–70%;
   `20 * MAT` if < 30%. Annual precipitation (mm) < 0.5 × Pth → BW (desert);
   < Pth → BS (steppe). Third letter: h if MAT ≥ 18 °C, else k.
3. **A (tropical):** coldest month ≥ 18 °C. Af if driest month ≥ 60 mm;
   Am if driest ≥ `100 − annual/25`; otherwise Aw.
4. **C (temperate):** coldest month between the C/D boundary and 18 °C.
   **D (continental):** coldest month below the C/D boundary.
   C/D boundary is a setting: 0 °C (default) or −3 °C.
   - Second letter: s if driest summer month < 40 mm and < 1/3 of the
     wettest winter month; w if driest winter month < 1/10 of the wettest
     summer month; else f.
   - Third letter: a if warmest ≥ 22 °C; b if not a and ≥ 4 months ≥ 10 °C;
     c if not a/b; d (D only) if coldest < −38 °C.

Additions:
- **H (highland)** override toggle (default on): land above 2,500 m (start).
- Painted Land Ice is always EF.
- All Köppen–Geiger subtypes are classified (including Cfc, Cw*, Ds*, Dw*,
  Dfd). Must-haves for verification: Af, Am, Aw, BWh, BWk, BSh, BSk, Csa,
  Csb, Cfa, Cfb, Dfa, Dfb, Dfc, ET, EF, H.
- Colors follow the widely used standard Köppen–Geiger color scheme, with a
  legend.

## 9. Tides

- **Open-ocean tidal range:** 1.0 m × lunar pull strength (start).
- **Tidal period:** half a lunar day ≈ rotation period × 0.5175 (12.42 h for
  a 24 h day). Drives the scrubber animation length.
- Coastal ocean cells get `range = base × shelf × funnel × enclosure`:
  - **Shelf shoaling:** Green's law, amplitude ∝ depth^(−1/4), weighted by
    shelf width (wider shelves amplify more). Capped (start ×4).
  - **Funneling:** concave coasts score higher. Measure the fraction of
    directions that hit land within ~300 km (start), plus narrowing along
    the bay's axis. Factor 1–3 (start).
  - **Enclosure damping:** erode the water mask by increasing radii to find
    basins connected to the open ocean only through narrow straits. Narrower
    strait relative to basin size → stronger damping (factor 0.05–1). Lakes
    and water not connected to the ocean get zero tide.
- **Categories:** micro-tidal < 2 m, meso-tidal 2–4 m, macro-tidal > 4 m.
- **High/low tide scrubber:** a phase slider over one tidal cycle.
  - Real intertidal flats are much smaller than a grid cell (and smaller
    than one 8-bit heightmap step), so the scrubber shows a **stylized
    intertidal band** along the coast whose width scales with tidal range
    and coastal flatness, animated by the phase.
  - v1 uses the same tidal phase everywhere (no amphidromic systems).

### 9.1 Sea caves

Sea caves are point markers on the full-resolution coastline, not grid
cells. In reality, waves do most of the carving; tides control how wide a
band of cliff gets eroded and when a cave's entrance is above water. The
generator reflects that.

**Automatic generation**
- Candidate sites are sampled along the full-resolution coastline.
- Each site gets a cave-likelihood score (all factors start values):
  - **Cliff steepness:** how fast land rises from the shoreline, using the
    full-resolution elevation where available. Flat, low coasts (beaches,
    deltas, mudflats) score near zero.
  - **Wave exposure:** onshore component of the final wind × open-water
    fetch upwind of the site (capped at ~1,000 km). Exposed headlands facing
    the prevailing wind score highest; sheltered bays and enclosed seas score low.
  - **Rock susceptibility:** a seeded low-frequency noise field, so caves
    cluster along some stretches of coast and not others. Optional
    "Cave-Prone Rock" brush (soft rock / karst limestone) raises it locally.
  - **Tidal factor:** micro-tidal 0.8, meso-tidal 1.0, macro-tidal 1.3.
    Larger ranges spread erosion over a taller band of cliff.
  - No caves on lakes, ice-covered coasts, or coasts with zero tide.
- Sites above a threshold become caves, thinned by a **density** slider and
  a **minimum spacing** (20 km, start).
- **Seed** setting for reproducible results. Selection uses a stable hash of
  each coastline location, so small terrain edits don't reshuffle every cave.
- Auto caves regenerate whenever terrain, wind, or tides change.

**Cave types**
- **Sea cave:** entrance at or below the high-tide line; reachable by boat in calm seas.
- **Tidal cave:** on meso- and macro-tidal coasts, the entrance sits inside
  the tidal band. It opens at low tide and floods at high tide. Each gets an
  entrance height within the band, so the inspector can show roughly how many
  hours per tidal cycle it's accessible.
- The tide scrubber shows tidal caves switching between open and flooded.

**Manual caves (worldbuilding override)**
- Cave tool: click to place, drag to move, delete, and edit type, name, and notes.
- Placement snaps to the nearest coastline by default; holding a modifier
  key places it freely (e.g., a cave on a lake shore or an inland sea).
- Manual caves are **locked**: regeneration never moves or removes them.
- Any auto cave can be **pinned**, which converts it to a manual cave.
- Manual caves can ignore physics. The inspector shows the site's
  plausibility score as information only ("unlikely by physics"), and never
  blocks placement.

## 10. Simulation pipeline and performance

Order:

1. Downsample terrain to the sim grid
2. Base wind (bands + ITCZ shift)
3. Ocean currents, SST, upwelling, sea ice
4. Temperature, pass 1
5. Monsoon pressure correction, friction, mountain deflection → final wind
6. Temperature, pass 2 (continentality uses the final wind)
7. Precipitation
8. Köppen (12 monthly runs, lazy and cached)

Tides run separately and depend only on terrain and planet settings.
Sea cave generation runs after both tides and step 5 (it needs the final wind).
Before M8 exists, step 5 passes the base wind through unchanged.

Performance:
- Everything runs in a Web Worker with typed arrays. Show a progress
  indicator; the UI never freezes.
- Recompute when a slider is released or a brush stroke ends.
- Target: a single-season run at 1024 wide in a few seconds on a normal
  laptop. 2048 may be slower.
- Cache results per season; only recompute the steps downstream of what
  changed.

## 11. Visualization and UI

**Map modes** (pick one, Paradox-style button row):
- Original Art (the imported image, so overlays sit on the user's own map)
- Physical / Heightmap (bathymetry blues; land greens → browns → white)
- Köppen Climate & Biomes (with legend)
- Surface Temperature (blue → red, current season)
- Precipitation & Rain Shadows (tan → dark blue)
- Tidal Range & Coastal Dynamics (micro/meso/macro coast colors, intertidal band)

**Overlays** (checkboxes, stackable):
- Wind arrows (curved arrows or animated particles) with optional band labels
- Ocean current arrows (red = warm, blue = cold, green = upwelling)
- Sea caves (auto and manual markers drawn differently; tidal caves show
  open/flooded state from the tide scrubber)
- Pressure centers (H/L symbols) and the ITCZ line

**Tile inspector** (hover tooltip): latitude/longitude, elevation, summer and
winter temperature, annual precipitation, wind direction and speed, current
type, tidal range, Köppen code. Hovering a cave marker shows its type,
name, notes, whether it's auto or manual, plausibility score, and (for tidal
caves) hours accessible per tidal cycle.

**Navigation:** zoom and pan (needed for 5000+ px maps), fit-to-screen.

**Panels:** map setup, terrain tools, import dialogs (silhouette, heightmap,
palette, mask), planet sliders, season control, layer toggles, legend.

Last-used settings and palettes persist in localStorage.

## 12. Export, save, and load

- Export any map mode as PNG at the original source resolution (overlays
  optional), or at sim resolution.
- Save Project: downloads a .json with all settings, the palette, and the
  edited terrain embedded as a PNG with elevation packed into RGB channels
  (keeps full precision). Manual and pinned caves are saved; auto caves
  regenerate from the seed.
- Export the cave list as JSON or CSV (position in source pixels and
  lat/lon, type, name, notes).
- Load Project restores everything.

## 13. Out of scope for v1 (future ideas)

amphidromic tidal phase, storms and hurricanes, rivers and lakes from
runoff, deep ocean circulation and salinity, multiple moons, 3D globe view.

## 14. Milestones and verification checks

The app must run after every milestone. Test maps in test-maps/:
an Earth grayscale heightmap (public domain), an Earth silhouette, and my
own hand-drawn reference map.

**M1 — Shell and grid**
New-map dialog, open-ocean render, zoom/pan, map mode buttons
(placeholders), tile inspector with lat/lon.
- Inspector shows the top-edge latitude on row 0 and the midpoint latitude
  at the vertical center; longitude wraps when enabled.

**M2 — Terrain input**
Brushes, silhouette import with auto-relief, heightmap import, palette
editor, land/sea mask, bathymetry, downsampling, Physical and Original Art modes.
- Earth silhouette coastlines look right in Physical mode.
- Palette import of my reference map ignores the text and wind arrows.
- A Paradox heightmap's darkest land value maps to ~0 m and 203 to the max height.

**M3 — Planet sliders and wind**
All planet sliders, circulation bands, ITCZ shift, pressure belts, wind
arrow overlay with band labels.
- At default settings, the arrows match my hand-drawn reference map.
- 72 h rotation → 1 cell; 6 h → 7 bands. Retrograde flips east/west.
- At northern summer solstice the ITCZ sits north of the equator.
- Node tests cover wind direction signs in each band and hemisphere.

**M4 — Temperature**
- Earth annual mean: ~25–28 °C at the equator, below −15 °C near the poles.
- Interior Siberia/Canada winters far colder than coasts at the same latitude.
- Mountains are colder than surrounding lowlands.

**M5 — Precipitation and rain shadows**
- Sahara and Arabia < 10 mm/month; Amazon, Congo, and Indonesia
  ≥ 150 mm/month; Western Europe 50–100 mm/month.
- Dry lee sides behind the Andes and Rockies.
- My reference map: the western continent is dry west of its mountain spine
  in the northern tropics, with a wet east coast.

**M6 — Köppen**
- Earth broadly matches a real Köppen map: Af Amazon, BWh Sahara,
  Cfb Western Europe, Csa Mediterranean, Dfc Canada/Siberia, ET Arctic coasts.

**M7 — Ocean currents and upwelling**
- Clockwise gyres in the northern hemisphere, counter-clockwise in the south.
- Gulf Stream warm; California, Humboldt, and Benguela currents cold with
  upwelling.
- Northwest Europe warmer than eastern Canada at the same latitude;
  Atacama and Namib coasts drier.

**M8 — Monsoons, friction, deflection**
- Northern summer: onshore winds and heavy rain over India and Southeast
  Asia. Northern winter: offshore winds.
- Wind is visibly weaker over land.

**M9 — Tides and sea caves**
- Bay of Fundy, Severn Estuary, and northwest France macro-tidal.
- Mediterranean, Baltic, and Black Sea micro-tidal; lakes zero.
- Earth: caves cluster on steep, exposed coasts such as western Ireland,
  Cornwall, and the Algarve; few or none on low coasts like the
  Netherlands or Bangladesh, and none on lakes.
- Tidal caves appear only on meso- and macro-tidal coasts and open/flood
  with the scrubber.
- Same seed gives the same caves; a small brush edit only changes caves near it.
- Manual caves survive regeneration; pinning converts an auto cave to manual.

**M10 — Polish and export**
Animated wind particles, tide scrubber, PNG export, project save/load.
- An exported PNG matches the source map's dimensions exactly.
- A saved project reloads identically.