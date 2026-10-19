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
  5632×2048 (Paradox-style), or custom. Max source size 8192×4096; an
  imported image larger than that gets an offer to downscale it, with a
  notice saying so.
- **Latitude range:** top-edge and bottom-edge latitude (default 90°N / 90°S).
  Needed because many maps (e.g., Paradox) crop the poles and aren't 2:1.
- **West-edge longitude** (default −180°, so the map is centered on 0°),
  **longitude span** (default 360°), and an **east-west wrap** toggle
  (default on). Wrap is only allowed when the span is 360°: a map covering
  part of the globe can't honestly wrap. Non-wrapping maps treat the
  left/right edges as open boundaries.
- **Beyond the edges** (future setting, used from M5 onward): for partial
  maps, what lies past the map edges: open ocean (default) or "continues
  like the edge."
- **Simulation resolution:** 512, 1024 (default), or 2048 cells wide, never
  wider than the source. If the source is narrower than 512 px, the sim width
  equals the source width. Height follows the source aspect ratio.
- Projection is equirectangular: latitude and longitude are linear in y and x.
- Rows and columns are cell-registered: the top edge of row 0 is the
  top-edge latitude and the left edge of column 0 is the west-edge longitude.
  Cell centers sit half a cell inside, so no sim cell sits exactly on a pole.
  The inspector reads the continuous cursor position, so the top edge of the
  map reads exactly the top-edge latitude.
- Cell size in km comes from the planet radius (section 3). East-west cell
  width shrinks with cos(latitude); anything distance-based (advection,
  decay lengths, search radii) must account for this.

## 2. Terrain input

Importing a map drawn in an outside editor (paint.net, GIMP) is the primary
workflow; painting in-app is secondary.

- **Reload map image** (toolbar button + Ctrl+Shift+R; it was Shift+R until
  M2b, which was too easy to hit by accident): re-reads the last imported
  file and re-runs the import with the same settings. Same image size →
  silent reload, unless there are brush edits (then it asks first, see
  2.1); different size → the import dialog reopens prefilled. The app
  always claims Ctrl+Shift+R, so the browser's own hard refresh (which
  would lose unsaved work) never runs on this page; Ctrl+R and F5 still
  reload the page.
  Fields left on Auto are re-detected; values I typed are kept. Uses the File System
  Access API in Chrome/Edge (keeps a file handle, no picker needed), falling
  back to the file picker in other browsers.
- **Undo/redo** (Ctrl+Z / Ctrl+Y or Ctrl+Shift+Z) covers brush strokes,
  imports, reloads, map settings changes, New Map, and Planet Radius
  changes (M3; radius rebuilds the km-based terrain). Other planet
  settings are not undo entries. Undo is
  region-based: a stroke entry stores before/after copies of only the edit
  tiles it touched, so undoing it rebuilds just that region. Imports,
  reloads, map settings, Planet Radius, and New Map store whole-state entries (map config,
  source, imported terrain, and a copy of the edits layer), which hold
  references to existing arrays instead of copies. The undo history has a
  memory budget (256 MB, start) that counts each distinct buffer once;
  the oldest entries are dropped first, and the newest is always kept.
  Undo keys are ignored while typing in a field (the field's own text undo
  runs instead).
- **New Map confirmation:** New Map asks before discarding painted or
  imported terrain.
- **Edit > Map settings** dialog: change the latitude range, west-edge
  longitude, span, wrap, and sim resolution of an existing map without
  re-importing (e.g., to fix the latitude range after importing a Paradox map).

### 2.1 Blank map and sculpting brushes
- Brushes: Draw Land, Erase to Ocean, Raise, Lower, Carve Trench, Smooth.
- Brush size and strength sliders. Size is the brush radius in source
  pixels, 1–250 px. The cap keeps every brush under 16 ms per dab (brush
  math plus redraw) on a 5632×2048 map; at radius 500, Raise/Lower took
  ~33 ms and Smooth ~49 ms per dab.
- Brushes edit the full-resolution terrain. The simulation recomputes when
  a stroke ends (debounced), and only the sim cells the stroke touched are
  rebuilt (dirty rectangles), not during the stroke.
- **Edits layer.** Brush edits are kept in a separate layer on top of the
  imported terrain, so they survive Reload and Map settings:
  - Raise, Lower, Smooth, and Carve Trench store *amounts* (relative
    changes), so they ride on whatever the reloaded image says underneath.
  - Draw Land and Erase store *fixed values* (elevation plus a category),
    so they win where they overlap the image. A later relative brush on such
    a pixel changes its fixed value.
  - After Map settings, the import pipeline rebuilds the terrain and the
    edits layer is re-applied on top. A same-size Reload with brush edits
    first asks "Keep current brush edits?": **Cancel** stops the reload,
    **No** reloads without the edits (undo brings them back), **Yes**
    reloads and re-applies them on top.
  - Importing a different file clears the edits (undo restores them). A
    same-size re-import offers "Keep brush edits" (on by default). A Reload
    whose image changed size drops the edits with a notice (undo restores
    them).
- **Categories at compose time.** Only Draw Land and Erase set a category.
  For everything else the category comes from the result: an ocean or
  sea-ice pixel that ends above 0 m becomes land (an island emerges);
  otherwise ocean and sea ice stay at or below −1 m. Land is never clamped,
  so lowering land below 0 m makes a depression that stays land; Erase is
  how you flood it. (Land that exists only because a relative brush raised
  ocean above 0 m is still ocean underneath, so lowering it below 0 m again
  returns it to ocean.) Relative amounts don't apply to lake pixels.
- **Brush rules** (start values in src/sim/constants.js):
  - Raise / Lower: up to ±200 m per dab, clamped to 9,000 m / −6,000 m.
    Lakes are skipped; sea ice behaves like ocean seafloor.
  - Carve Trench: ocean and sea ice only, sharper falloff, up to 1,000 m
    per dab, down to −10,000 m. Land and lakes are skipped.
  - Smooth: blends toward the local mean and never changes a category.
    Lake pixels are skipped and left out of the averages, so lake surfaces
    stay flat and shore land isn't dragged toward the lake. Ocean and sea
    ice stay at or below −1 m; land that was above sea level stays at or
    above +1 m, so smoothing never moves a coast.
  - Draw Land: any water (ocean, sea ice, lake) becomes land at
    max(current elevation, 200 m), so a lake becomes land at max(its
    surface, 200 m). Land is untouched.
  - Erase (to ocean): land, land ice, and lakes become ocean at
    min(current elevation, −100 m). Sea ice is untouched (already ocean).
  - Draw Land and Erase ignore strength.

### 2.2 Supported formats
PNG, BMP, WEBP, JPG via the browser image decoder. SVG is rasterized at the
chosen map size. Browsers decode to 8-bit, so 16-bit PNG heightmaps need a
vendored decoder to keep their precision. **16-bit PNG support is deferred**
(not in M2); 16-bit files import as 8-bit for now.

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
  - **Sea level value:** gray value where land begins. Auto only works when
    a large flat region sits at the darkest value (a flat ocean plateau):
    it picks the first gray value actually used above that plateau,
    skipping empty levels (Paradox maps have a gap between the ocean gray
    and the lowest land gray). Otherwise I set it by hand.
  - **Highest value:** auto-detected brightest value.
  - **Height of highest value in meters** (default 5,000 m).
  - **Curve (gamma)** slider, default 1.0 (linear).
- Mapping: sea level value → 0 m, highest value → max height.
- Values below sea level (if any) map linearly from 0 m down to a
  configurable max depth (default −6,000 m). If the ocean is one flat value,
  bathymetry is generated instead (2.7).
- A light smoothing pass (1–2 px blur, start) removes 8-bit terracing.
  After blurring, the coastline is restored (from the mask if there is one),
  so smoothing never moves the coast.
- Example: Paradox heightmaps range roughly 89 (#595959) to 203 (#CBCBCB).

### 2.5 Color palette import (satellite-style color maps)
Expected inputs are satellite-style color images (flat colors for ocean,
shelf, land tiers, lakes, and ice), alongside the black-and-white
silhouettes and heightmaps of 2.3–2.4.
- On import, scan the image and show the most common colors as swatches.
  An eyedropper picks additional colors straight from the map.
- The user assigns each swatch a **category**:
  - Deep Ocean, Shallow Sea / Shelf, Lake (freshwater, no tides),
    Land, Land Ice, Sea Ice, **Ignore**.
  - Each Land swatch can carry an **elevation in meters**, so shades of green
    become elevation tiers.
  - Ignore is for clouds, anti-aliased edges, and compression noise. Those
    pixels are filled in from their nearest non-ignored neighbors.
- Matching: each pixel takes the *nearest* palette color (perceptual
  distance: CIE Lab, ΔE76) within a tolerance slider (default ΔE 12).
  Unmatched pixels are treated as Ignore and highlighted in magenta in the
  preview.
- Palette images are decoded nearest-neighbor (no resampling blend), so
  every pixel keeps a color that is really in the file. The eyedropper
  samples the preview, which holds real source colors.
- The scan offers up to 16 swatches. Colors closer than the **Scan merge**
  distance are merged into one swatch: a slider (with a number input) from
  0 to 12 ΔE, default 2, remembered between imports (`fcm:paletteScan`).
  Noisy or anti-aliased images need ~6–8. Changing it rescans and keeps the
  categories already assigned (and assigned eyedropper swatches). Every
  swatch starts as Ignore (auto-guessing categories is a §16 idea). Import
  is enabled once at least one land swatch (Land / Land Ice) and one water
  swatch (Deep Ocean, Shallow Sea, Lake, Sea Ice) are set.
- Ignored and unmatched pixels copy their category and elevation from the
  nearest classified pixel (km metric, wraps), so a cloud over a coast
  splits at the midline.
- Elevation by category: Land / Land Ice = the swatch elevation (default
  200 m); Lake = the swatch surface (default 0 m); Shallow Sea = −100 m;
  Deep Ocean / Sea Ice = generated depth (2.7), never shallower than
  −200 m. A tier-smoothing slider (default 2 px) blends land tiers: lakes
  and not-yet-generated pixels are left out of the averages, water stays
  ≤ −1 m, land that was ≥ 1 m stays ≥ 1 m, and land below 0 m is not
  clamped. (Heightmap smoothing, 2.4, keeps its M2a behavior.)
- Color images (without transparency) pre-select Color palette on import.
- Palettes are saved as named presets (localStorage `fcm:palettes`) and can
  be exported and imported as JSON:
  `{ "format": "fcm-palette", "version": 1, name, tolerance, smoothing,
  swatches: [{ hex, category, elevation }] }`. Files without the format tag
  are rejected.
- Reload re-applies the swatches and reports the unmatched share.

### 2.5.1 Art image (optional)
A separate image shown by Original Art in place of the imported terrain
image (e.g., a painted map over a heightmap import). Set from the import
dialog or File > Art Image… (Remove Art Image takes it off); works on blank
maps too. Stretched to the map size, with a notice when its aspect ratio
differs. Setting and removing it are undoable. Reload re-reads it through
its file handle (browsers without the File System Access API keep the
current art).

### 2.6 Separate land/sea mask (optional)
Any heightmap import can take a second image as the land/sea mask. Paradox
games define sea zones in separate files, so the heightmap alone may not show
the true coastline. **The mask wins:** mask-land pixels at or below sea level
become +1 m, and mask-ocean pixels above it get generated depth (2.7).

### 2.7 Bathymetry
- Used when the input has no depth data: continental shelf from 0 to −200 m
  within a shelf width of 100 km (start), sloping to −4,000 m abyssal plain
  over the next ~300 km. Low-frequency noise adds variety.
- The Carve Trench brush can go down to −10,000 m.
- Shallow Sea / Shelf palette color → −100 m; Deep Ocean → generated depth.

### 2.8 Downsampling to the simulation grid
- Each sim cell stores: land fraction, mean land elevation, max elevation,
  mean ocean depth, and its category: land if land fraction > 0.5, and then
  the most common category among its land pixels (land or land ice) or its
  water pixels (ocean, lake, or sea ice).
- **Category layer** (M2b): every full-resolution pixel has a category:
  ocean, land, lake, land ice, or sea ice. Shallow sea / shelf is not a
  separate category; it is ocean less than 200 m deep (elevation above
  −200 m).
- "Is this land?" is answered by one function everywhere (`isLand`): land
  or land ice. Water is everything else, and ocean is water that isn't a
  lake. Only terrain with no category layer falls back to elevation > 0.
  This allows land below sea level.
- Islands smaller than a cell disappear from the simulation but stay
  visible in renders; their pixels take values from the nearest land cell.
- Upscaling for display: bilinear for continuous layers, nearest/majority
  for categorical layers (Köppen), then clipped to the full-resolution
  coastline.

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

Boundaries (M3): exactly 40 h and 14 h give 3 cells, exactly 8 h gives 5
(> 40 → 1; 14 ≤ P ≤ 40 → 3; 8 ≤ P < 14 → 5; < 8 → 7).

Season presets: Northern Spring Equinox (day 80), Northern Summer Solstice
(day 172), Autumn Equinox (day 266), Southern Summer Solstice (day 355),
Annual Mean (average of 12 monthly runs, mid-month days
`floor((m + 0.5) · 365 / 12)`).

Solar declination: `decl = tilt * sin(2π * (day − 80) / 365)`. With this
formula the declination crosses zero at day 262.5, so the Autumn Equinox
preset (day 266, the real calendar date) has δ ≈ −1.4° at 23.5° tilt; the
preset stays at 266.

- **Planet radius** is stored in the map config (M3), so it travels with
  undo and the worker; releasing the slider rebuilds the km-based terrain
  (generated bathymetry, auto-relief, distances) as an undoable change.
- **Year length:** there is no orbital-period setting. "Day of year" means
  1/365 of an orbit (a calendar fraction), not one rotation, so a slowly or
  quickly rotating planet still has days 0–364 and the same seasons.
- **Day length:** `cos h0 = −tanφ tanδ` (clamped: polar night 0 h, polar
  day = the whole rotation period), `dayLength = rotationPeriod · h0 / π`.
  The rotation period is treated as the solar day (the sidereal/solar
  difference and spin direction are ignored).
- Planet settings (except radius, which lives in the map) persist in
  localStorage `fcm:planet`.

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
  Rule (M3, start values): linear in log(rotation period) between anchors
  4 h → 5°–45°, 24 h → 15°–75°, 40 h → 50°–85°, clamped outside them, so
  every 1-cell planet gets 50°–85° and dragging rotation never makes the
  angles jump.
- Base wind speed: 1.0 over ocean (start). Speed falls toward band edges
  where the wind is calm (doldrums, horse latitudes). Rule (M3, start):
  `speed = base · (floor + (1 − floor) · smoothstep(0, edge, min(t, 1 − t)))`
  with floor 0.15 and edge 0.25 of the band, so each band has a steady core
  and calm edges. Every band edge is calm in M3, including the subpolar low
  (its storminess comes with Polar Front & Storm Tracks, M8). Speeds are
  relative (1.0 = base ocean wind), not m/s.
- Band names for the overlay: n = 3 prograde → Trade Winds, Westerlies,
  Polar Easterlies. Other n, and retrograde at any n → "Easterlies" /
  "Westerlies" by direction.
- **Annual Mean wind:** u, v are the vector mean of the 12 monthly fields
  (the prevailing wind); speed is the mean of the monthly scalar speeds;
  pressure is the mean of the monthly pressure index. Where the band edges
  sweep back and forth (≈ 30° and 60° at defaults) the vector mean nearly
  cancels, so Annual Mean arrows vanish there and a "variable winds"
  marker is drawn instead; at the equator both trades are easterly, so
  only v cancels. The ITCZ line in Annual Mean sits at the mean ITCZ
  latitude, with dashed lines at its northernmost and southernmost
  positions.

### 4.2 Seasonal ITCZ shift
- `itcz = itczFactor * decl`, itczFactor = 0.5 (start).
- Effective latitude remaps so the ITCZ sits at 0 while the poles stay fixed:
  - lat ≥ itcz: `latEff = 90 * (lat − itcz) / (90 − itcz)`
  - lat < itcz: `latEff = −90 * (itcz − lat) / (itcz + 90)`

### 4.3 Pressure belts
Band boundaries at `j * bandWidth` (in latEff): even j = low pressure
(ITCZ at 0°, subpolar low at 60° for n = 3), odd j = high pressure
(subtropical highs at 30°, polar highs at 90°). Used by the precipitation
model and the Pressure & ITCZ overlay. Pressure index (M3): `p = −cos(π ·
|latEff| / bandWidth)`, −1 at lows and +1 at highs (unitless; hPa only
after calibration).

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

### 4.5 Friction and mountain deflection (M4b; moved from M8)
- Wind speed over land × 0.6 (start).
- Where wind blows up steep, high terrain (above ~1,500 m, start), reduce
  the uphill component and redirect part of it along the contours, then
  smooth. Air still crosses lower ridges, which is what produces rain shadows.
- M4b rule (start values): per land cell, the gradient of cell surface
  elevation (central differences, km spacing with cos latitude, wraps)
  gives the uphill direction n. If w·n > 0, a share
  `block = 0.8 · smoothstep(500, 1500 m, elevation) · smoothstep(0, 10 m/km, slope)`
  of the uphill component is removed, and 70% of it is added along the
  contour, in the direction the wind already leans. Friction applies per
  cell; the deflection is smoothed with one 3×3 pass, so open ocean away
  from mountains is untouched. Speed =
  |final (u, v)|. Annual Mean = the vector mean of the 12 monthly final
  winds, with the mean of their speeds.

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

**M4 decisions** (recorded in LOG.md before implementing):
- Q uses S0 = 1361 W/m² (no eccentricity). With the SPEC declination and
  the 12 mid-month days, Tq = 26.3 °C at the equator and −25.0 °C at the
  top row center (89.82°), so the Tq start values stand.
- Tannual is the mean of the 12 monthly Tq values (unlagged). Land, land
  ice, and lakes lag 15 days; ocean and sea ice 45 days. Annual Mean is the
  mean of the 12 monthly temperatures, cell by cell.
- Continentality is annual: the maritime tracer M is the mean of 12 monthly
  tracers, each carried along that month's wind (direction only) in
  semi-Lagrangian steps of one north-south cell, iterated to a change under
  1e-4. Ocean and sea-ice cells are sources (M = 1); off the map of a
  partial map counts as ocean. Distance term D = exp(−d / 300 km).
  m = 1 − (1 − M)(1 − D), s = 0.15 + (0.5 − 0.15)(1 − m).
- Lakes count as land for continentality; painted sea ice counts as ocean
  (no modifier until M7). Lapse is linear below 0 m too. Sim cells use mean
  land elevation (land), the lake surface (lakes), or 0 m (ocean); the
  display and tooltip use each pixel's own elevation and category.
- Until M7, ocean cells use the same model (air over the sea, s = 0.15),
  not SST, and the ocean-current term is off.

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

## 10. Water bodies

Named, classified bodies of water, shared by tides, ocean currents, the Water
Bodies map mode, and the Water Body Labels toggle (M9).

- **Lakes vs. ocean:** a flood fill from the world ocean separates connected
  ocean water from enclosed lakes. Palette "Lake" pixels are always lakes.
- **Splitting at straits:** a distance-from-land watershed splits connected
  water where it narrows. A sensitivity slider sets how narrow a neck must be
  (relative to the basins on either side) to count as a split. Where no neck
  exists, fall back to the shortest land-to-land line across the opening.
- **Classification:** ocean / sea / gulf / bay / fjord / strait / lake, by
  size, enclosure, and mouth width, nested in a hierarchy (a bay inside a
  gulf inside a sea inside an ocean).
- **Labels:** each body is labeled at its point farthest from land.
- **Editing:** the user can merge, split, rename, and lock bodies. Locked
  bodies survive regeneration and are saved with the project.

## 11. Sailing routes and travel time

Route finding for ships, using the simulated winds and currents (M10).

- **Ship presets**, each with a max speed and a table of speed by angle to
  the wind:
  - Galley: oars, slow, nearly wind-independent, prefers coasts
  - Ancient square-rigger: no progress closer than ~70° to the wind
  - Lateen / medieval: ~55°
  - Age-of-sail full-rigger: ~60°, faster
  - Custom
- **Speed on a heading** = max speed × table(angle to wind) × wind strength,
  plus the ocean current's component along the heading.
- **Coastal breezes:** within ~20 km of land (start), allow slow upwind
  progress, so ships can work along coasts against the prevailing wind
  (land and sea breezes).
- **Pathfinding:** Dijkstra / A* over ocean cells with 16 directions;
  cost = km / speed, so A→B and B→A differ. Tacking emerges from zig-zags.
  East-west steps use the cos(latitude) cell width.
- Uses the selected month's winds and currents; the route panel also shows
  the best and worst months.
- **UI:** with the Route tool, click two ports to get a route line (Sailing
  Routes toggle), distance, and days. **Sailing Time** mode: travel time from
  a clicked port to every ocean cell.

## 12. Simulation pipeline and performance

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
Water bodies (section 10) depend only on terrain; once they exist (M9), tides
and currents read them.
Sailing routes and travel time run on demand from the final wind and currents
for the selected month.
Before M4b, step 5 passed the base wind through unchanged. From M4b it
applies friction and mountain deflection (4.5); monsoons (4.4) join it in
M8. Step 4 (temperature pass 1) only feeds the monsoon pressure, so it is
skipped until M8; step 6 is the temperature.

Performance:
- Everything runs in a Web Worker with typed arrays. Show a progress
  indicator; the UI never freezes.
- Recompute when a slider is released or a brush stroke ends.
- Target: a single-season run at 1024 wide in a few seconds on a normal
  laptop. 2048 may be slower.
- Cache results per season; only recompute the steps downstream of what
  changed.

## 13. Visualization and UI

### 13.1 Layout (modeled on old desktop map editors)
From top to bottom:
1. **Menu bar:** File (New Map, Import, Reload map image, Save/Load Project,
   Export), Edit (Undo, Redo, Map settings), View (overlay toggles, hover
   tooltip, tool palette, zoom in/out, fit, go to lat/lon), Tools (Navigate,
   Sculpt, Route tool), Help (legend, keyboard shortcuts).
2. **Toolbar:** tool dropdown (far left, shows the current tool),
   "View: <mode name>" label, the 5 map-mode category tabs and the active
   category's mode icons, season selector with play button, zoom
   percentage, Go to lat/lon, Bookmarks (saved camera views).
3. **Map canvas** fills all remaining space. The toggles panel is a dropdown
   at the map's top-right corner.
4. **Context bar:** hint text plus controls for the active tool or selection
   (e.g., brush size/strength, the climate chart for the selected tile). A
   **Planet** button opens the planet panel, which slides up from this bar.
   Startup hint: "Import a map or paint land to begin."
5. **Status bar** (very bottom): cursor lat/lon, elevation, and climate code.

Large tasks (New Map, palette editor, map settings) open as dialogs. Every
slider has a number input beside it for exact values. Menu items, tools,
modes, and toggles that don't exist yet are shown disabled with
"coming in M#".

### 13.2 Tools
- One **tool dropdown** at the left of the toolbar instead of always-visible
  tool buttons: **Navigate** (default; drag pans, click inspects), **Sculpt**
  submenu (Draw Land, Raise, Lower, Carve Trench, Smooth, Erase; M2b),
  **Route tool** (M10). (The Cave tool and Cave-Prone Rock brush belong to
  the sea caves reach goal, section 18.)
- Esc returns to Navigate. Space+drag and middle-drag pan in every tool.
- **View > Tool palette** (M11): optional floating GIMP-style palette,
  hidden by default.

### 13.3 Map modes (EU4-style mode bar)
Category tabs, each with a grid of icon buttons. Each button's tooltip shows
the mode name, the milestone it arrives in, and its hotkey. Icons are simple
original inline SVGs (no copied game art, no external assets). Hotkeys:
1–5 pick a category, Q W E R T Y U pick the nth mode in it. Hotkeys never fire
while focus is in a text or number field or while a dialog is open.
Each mode's exact colors and formula are defined when its milestone is planned.

| Category | Mode (milestone) |
|---|---|
| Terrain | Original Art (M2): the imported image, so overlays sit on the user's own map · Physical (M2): bathymetry blues, land greens → browns → white · Elevation (M2): grayscale · Slope & Ruggedness (M2) · Distance from Coast (M2) · Art Check (M6): hand-drawn vs. simulated |
| Climate | Köppen (M6, with legend) · Biomes (M6): natural, painterly colors for desert, grassland, forest, rainforest, tundra, ice; exportable as base art · Temperature (M4): blue → red, current season · Temperature Range (M4) · Growing Season (M4) · Frost/Snow/Permafrost (M4) · Winter Severity (M4) |
| Weather | Precipitation (M5): tan → dark blue · Precipitation Seasonality (M5) · Aridity (M5) · Cloud Cover (M5) · Wind Speed & Pressure (M3): calm zones, pressure belts, later monsoon highs/lows · Air Masses (M8) |
| Ocean | Sea Surface Temperature (M7) · Water Bodies (M9) · Tidal Range (M9): micro/meso/macro coast colors, intertidal band · Marine Productivity (M7) · Sailing Time (M10) |
| Life | Vegetation Density (M6) · Agricultural Potential (M6) · Travel Difficulty (M8) · Natural Hazards (M8) · Wildfire Risk (M6) |

Terrain mode definitions (M2b):
- **Slope & Ruggedness:** slope in degrees from elevation differences over
  km spacing (east-west spacing × cos latitude), in five classes: < 0.5°,
  0.5–2°, 2–5°, 5–10°, > 10° (dark plains → bright ridges). Land only;
  lakes and ocean draw one muted water color. The tooltip adds the terrain
  ruggedness index (TRI: mean absolute height difference to the 8
  neighbors, m). Updates after brush strokes.
- **Distance from Coast:** distance in km to the nearest coast at full
  resolution (computed in the worker), with an inland ramp on land and an
  offshore ramp on water, and a km legend. Lakes count as land. Reruns
  after imports, reloads, map settings, undo/redo, and strokes that change
  land/water.
Climate mode definitions (M4; start values). All use full-resolution
elevation. Modes 2–5 come from the 12 monthly means and ignore the
selected season. Daily values are linear between mid-month means.
- **Temperature:** the selected season (Annual Mean = 12-month mean),
  5 °C bands from ≤ −40 to ≥ 40 °C, purple → blue → pale → yellow → red;
  water drawn darker.
- **Temperature Range:** warmest minus coldest month: 0–5, 5–10, 10–20,
  20–30, 30–40, 40–50, > 50 °C.
- **Growing Season:** days with a daily mean ≥ 5 °C: none, 1–60, …, 300–364,
  all year. Land only.
- **Frost/Snow/Permafrost** (land, first match): ice-cap climate (warmest
  month < 0 °C), continuous permafrost (MAAT ≤ −8 °C), discontinuous
  permafrost (MAAT ≤ −2 °C), lasting snow cover (coldest month < −3 °C;
  assumes enough precipitation), frequent frost (coldest < 3 °C),
  occasional frost (coldest < 12 °C), frost-free.
- **Winter Severity:** freezing degree-days, Σ max(0, −T) over the days of
  the year: 0, < 100, 100–500, 500–1,500, 1,500–3,000, 3,000–5,000,
  > 5,000 °C·days. Land only.

- **Shaded Relief** (toggle): light from the northwest, ×20 vertical
  exaggeration, blended with `overlay` at 60% over any mode (Original Art
  included). Land and seafloor are shaded; lakes stay flat.

### 13.4 Toggles (stackable overlays)
A checkbox panel in the map's top-right dropdown, grouped below. Toggles are
drawn as lines, symbols, hatching, or transparency so several stay readable
together.
- **Reference:** Graticule (M1; tropics and polar circles from axial tilt
  join in M3), Shaded Relief (M2, blended over the mode), Water Body Labels (M9)
- **Atmosphere:** Wind Arrows (M3; curved arrows, animated particles in M11,
  optional band labels), Pressure & ITCZ (M3; H/L symbols and the ITCZ line),
  Polar Front & Storm Tracks (M8), Climate Boundaries (M4; snowline, tree
  line, permafrost line, predicted ice edge), Hurricane Zones (M7),
  Coastal Fog (M7)
- **Climate Boundaries (M4):** contour lines over land from the sim grid
  (cell elevation), so they don't exactly trace the full-resolution mode
  colors: tree line = warmest month 10 °C, snowline = warmest month 0 °C
  (permanent snow; M5 may raise it in dry regions), permafrost line = mean
  annual −2 °C. The predicted (sea-)ice edge needs SST and arrives in M7.
  The legend shows a key while the toggle is on.
- **Ocean:** Ocean Currents (M7; red = warm, blue = cold, green = upwelling),
  Seasonal Sea-Ice Edges (M7), Sailing Routes (M10)
- **Coast:** Coastline Type (M9), Wave Exposure (M9), Harbor Suitability (M9).
  (Sea Caves belongs to the reach goal, section 18.)

### 13.5 Lookups and controls
- **Tile inspector** (hover tooltip, optional via View menu): latitude/
  longitude, elevation, summer and winter temperature (M4: the warmest and
  coldest month at the pixel's elevation), annual precipitation,
  wind direction and speed, current type, tidal range, Köppen code, day
  length (M3), and a real-world climate analog from a small built-in table
  of real cities (M6).
- **Click a tile** (without dragging) in Navigate: the context bar shows a
  monthly temperature and precipitation chart (M6).
- **Season selector** (M3) with a **play button** that animates the year (M11).
- **Navigation:** zoom at cursor and pan (needed for 5000+ px maps),
  fit-to-screen, zoom percentage, Go to lat/lon, Bookmarks.

Last-used settings, bookmarks, and palettes persist in localStorage.

## 14. Export, save, and load

- Export any map mode as PNG at the original source resolution (overlays
  optional), or at sim resolution.
- Save Project: downloads a .json with all settings, the palette, bookmarks,
  water body edits, and the edited terrain embedded as a PNG with elevation
  packed into RGB channels (keeps full precision).
- Load Project restores everything.

## 15. Running locally and online

- One codebase, two ways to run: locally through a simple static server
  (`py serve.py`: standard library only, bound to 127.0.0.1, with
  `Cache-Control: no-store`), and online as a GitHub Pages site deployed
  from the main branch (the app lives in the repo's Artifact2/ folder). No
  build step either way.
- No file or folder names start with an underscore (GitHub's Jekyll
  processing would skip them).
- Fully client-side: no backend, no accounts, no uploads. Imported maps stay
  on the user's machine in both versions.
- The app works offline once loaded locally (no CDN or network dependencies).
- Pushing to main redeploys the site, so only push when the app runs.

## 16. Out of scope for v1 (future ideas)

amphidromic tidal phase, simulating individual storms and hurricanes (v1
only maps hurricane zones and storm tracks as climate overlays), deep ocean
circulation and salinity, multiple moons, 3D globe view, a single-file build
that opens by double-clicking (no server), an installable offline
version of the online site (PWA), an orbital-period (year length) setting
(raised in M3 planning: day of year is fixed at 0–364 with 365 in the
declination formula, so a real orbital period would change how many
rotations a year has and how long seasons last), and non-equirectangular maps: Mercator,
and custom latitude control points ("this row is 36°N") for distorted maps
such as Paradox's, whose far south stays squashed even after setting the
latitude range.

Small ideas raised in M2b planning (not built yet): a tooltip line for the
surface type (land / lake / sea ice / land ice / ocean); auto-guessing
palette swatch categories from hue and lightness; preview zoom or a
magnifier for the palette eyedropper; `[` / `]` to resize the brush and
hotkeys to switch brushes; Edit > Clear Brush Edits; hovering a palette
swatch highlights its pixels in the preview; and for heightmap + mask
imports, mask-land below sea level keeping its real negative elevation
instead of +1 m (section 2.6), now that categories allow it.

**Moonshot** (optional, after M9): rivers, drainage basins, and lakes from runoff.

**Not planned:**
- Habitability: a worldbuilding judgment, not a climate output.
- Model confidence: every result here is a rough guide by default, and its
  accuracy can't be measured meaningfully.
- Compare-settings view: make a change, then undo/redo to compare.

## 17. Milestones and verification checks

The app must run after every milestone. Test maps in test-maps/ (see its
README for credits): a GEBCO Earth heightmap with ocean depth, an Earth
silhouette thresholded from it, and generated black/white archipelago and
continent maps (1024×512), plus a script-generated color map for palette
import (`palette_map_1.png`, M2b). In the git-ignored test-maps/private/
(never committed): a Paradox heightmap (game content) and the reference map
(`drawn_sample_map.webp`, a third-party hand-drawn map). The reference map
is a personal by-eye reference for how winds and rain should look: the app
never opens it, and no test, fixture, preset, or checklist step imports it.
Checks that mention it are side-by-side comparisons in my own image viewer.

Each new map mode and toggle lands with the milestone that produces its data.

**M1 — Shell and grid**
App layout (section 13.1), New Map dialog, open-ocean render, zoom/pan,
tool dropdown (Navigate only), placeholder mode bar with all 29 modes,
toggles dropdown listing every toggle (Graticule live), tile inspector and
status bar with lat/lon, Go to lat/lon, Bookmarks.
- Inspector shows the top-edge latitude at the top edge of row 0 and the
  midpoint latitude at the vertical center; longitude wraps when enabled.
- Hotkeys don't fire while typing in a text/number field or while a dialog
  is open.
- The app loads with no console errors both locally and from the GitHub
  Pages URL.

**M2a — Terrain imports** (imports first; the main workflow)
Grayscale heightmap import (auto sea level and max values, max height in
meters, curve, smoothing, optional land/sea mask), silhouette import with the
auto-relief toggle, generated bathymetry, downsampling to the sim grid,
Edit > Map settings, Reload map image (Ctrl+Shift+R since M2b), elevation in the status bar
and tooltip. Modes: Original Art, Physical, Elevation.
- Earth silhouette coastlines look right in Physical mode.
- A Paradox heightmap's darkest land value maps to ~0 m and 203 to the max height.

**M2b — Painting and editing**
Palette editor, sculpt brushes, region-based undo/redo, New Map
confirmation, the category layer (ocean, land, lake, land ice, sea ice;
shelf comes from depth), an optional separate art image for Original Art.
Modes: Slope & Ruggedness, Distance from Coast. Toggle: Shaded Relief.
Brush edits live in a separate edits layer re-applied after the import
pipeline, so they survive Reload and Map settings (section 2.1).
- Palette import of a color test map (`palette_map_1.png`) gives continuous
  coastlines with little unmatched area.

**M3 — Planet sliders and wind**
All planet sliders, season selector, circulation bands, ITCZ shift,
pressure belts, wind arrow overlay with band labels, Pressure & ITCZ toggle,
tropics and polar circles on the graticule, day length in the inspector.
Mode: Wind Speed & Pressure.
- At default settings with the season set to the Northern Spring Equinox
  (day 80), the wind arrows match the reference map, compared side by side
  with it open in my own image viewer (not imported). (Not Annual Mean:
  its vector-mean arrows vanish near 30° and 60° by design, §4.1.)
- 72 h rotation → 1 cell; 6 h → 7 bands. Retrograde flips east/west.
- At northern summer solstice the ITCZ sits north of the equator.
- Node tests cover wind direction signs in each band and hemisphere.

**M4 — Temperature**
Modes: Temperature, Temperature Range, Growing Season, Frost/Snow/Permafrost,
Winter Severity. Toggle: Climate Boundaries.
- Earth annual mean: ~25–28 °C at the equator, below −15 °C near the poles.
- Interior Siberia/Canada winters far colder than coasts at the same latitude.
- Mountains are colder than surrounding lowlands.

**M4b — Terrain wind** (moved out of M8 in Session 6, for a class demo)
Friction over land and mountain deflection (4.5) in step 5; temperature
pass 2 uses the final wind; arrows, Wind Speed & Pressure, and the tooltip
show the final wind.
- Wind is visibly weaker over land (moved here from M8).
- Arrows bend along the Himalayas and the Andes; low ridges are crossed.

**M5 — Precipitation and rain shadows**
Modes: Precipitation, Precipitation Seasonality, Aridity, Cloud Cover.
- Sahara and Arabia < 10 mm/month; Amazon, Congo, and Indonesia
  ≥ 150 mm/month; Western Europe 50–100 mm/month.
- Dry lee sides behind the Andes and Rockies.
- Compared side by side with the reference map open in my own image viewer
  (not imported): the western continent is dry west of its mountain spine
  in the northern tropics, with a wet east coast.

**M6 — Köppen and biomes**
Modes: Köppen, Biomes, Vegetation Density, Agricultural Potential, Wildfire
Risk, Art Check. Click-a-tile climate chart, real-world climate analog.
- Earth broadly matches a real Köppen map: Af Amazon, BWh Sahara,
  Cfb Western Europe, Csa Mediterranean, Dfc Canada/Siberia, ET Arctic coasts.

**M7 — Ocean currents and upwelling**
Modes: Sea Surface Temperature, Marine Productivity. Toggles: Ocean
Currents, Seasonal Sea-Ice Edges, Coastal Fog, Hurricane Zones.
- Clockwise gyres in the northern hemisphere, counter-clockwise in the south.
- Gulf Stream warm; California, Humboldt, and Benguela currents cold with
  upwelling.
- Northwest Europe warmer than eastern Canada at the same latitude;
  Atacama and Namib coasts drier.

**M8 — Monsoons** (friction and deflection moved to M4b)
Modes: Air Masses, Travel Difficulty, Natural Hazards. Toggle: Polar Front &
Storm Tracks.
- Northern summer: onshore winds and heavy rain over India and Southeast
  Asia. Northern winter: offshore winds.

**M9 — Tides and water bodies**
Tides, water bodies (section 10). Modes: Tidal Range, Water Bodies.
Toggles: Water Body Labels, Coastline Type, Wave Exposure, Harbor
Suitability. (Sea caves moved to the reach goal, section 18.)
- Earth: the Mediterranean, Black Sea, Baltic, Red Sea, Persian Gulf, and
  Hudson Bay come out as separate bodies; the Caspian is a lake; each label
  sits in open water.
- Bay of Fundy, Severn Estuary, and northwest France macro-tidal.
- Mediterranean, Baltic, and Black Sea micro-tidal; lakes zero.

**M10 — Sailing routes and travel time**
Section 11: ship presets, Route tool, Sailing Routes toggle, Sailing Time mode.
- Earth heightmap, Atlantic: outbound Europe → Caribbean runs via the
  Canaries in the trades; the return goes north through the westerlies
  (volta do mar).
- The Indian Ocean crossing is fast with the summer monsoon and the return
  is fast in winter.
- Stretch check, only if M8 reproduces the Etesian winds: in summer,
  Rome → Alexandria is several times faster than the return, and the return
  hugs the Levant, Anatolia, and Greece.

**M11 — Polish and export**
Animated wind particles, tide scrubber, season playback, PNG export,
project save/load. Themes: dark (default), light, parchment (each overrides
the UI color variables in style.css). A collapsible legend (at narrow widths
it covers a large part of the map). View > Tool palette (section 13.2).
- An exported PNG matches the source map's dimensions exactly.
- A saved project reloads identically.

**Moonshot** (optional, after M9): rivers, drainage basins, lakes.

**Reach goal** (after M11): sea caves, section 18.

## 18. Reach goal (after M11): Sea caves

Moved out of M9 during M2b planning; a reach goal after M11. Sea caves are
far smaller than a grid cell, so they don't feed back into climate or tides.
Everything cave-related lives in this section: generation, the Cave tool,
the Cave-Prone Rock brush, the Sea Caves toggle, the inspector readout,
saving, and export. None of it appears in the menus or registries until
this goal is started.

**Pipeline:** cave generation runs after both tides and pipeline step 5 (it
needs the final wind).

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

**UI, saving, and export**
- Tools: a **Cave tool** in the tool dropdown, and a **Cave-Prone Rock**
  brush in the Sculpt submenu (raises rock susceptibility locally).
- Toggle: **Sea Caves** in the Coast group (auto and manual markers drawn
  differently; tidal caves show open/flooded state from the tide scrubber).
- Inspector: hovering a cave marker shows its type, name, notes, whether
  it's auto or manual, plausibility score, and (for tidal caves) hours
  accessible per tidal cycle.
- Save Project stores manual and pinned caves; auto caves regenerate from
  the seed.
- Export the cave list as JSON or CSV (position in source pixels and
  lat/lon, type, name, notes).

**Checks**
- Earth: caves cluster on steep, exposed coasts such as western Ireland,
  Cornwall, and the Algarve; few or none on low coasts like the
  Netherlands or Bangladesh, and none on lakes.
- Tidal caves appear only on meso- and macro-tidal coasts and open/flood
  with the scrubber.
- Same seed gives the same caves; a small brush edit only changes caves near it.
- Manual caves survive regeneration; pinning converts an auto cave to manual.
