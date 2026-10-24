# Plan: tick M6a, then File > Load Earth Map (Session 10, your extra)

Approved as written in Session 10, including resetting Season to Annual
Mean. Known behavior to record in LOG: hand-made planet changes still
aren't undoable, so undoing and redoing a Load Earth Map can overwrite
planet settings changed in between.

## Step 0: LOG only
- Tick M6a as "Köppen rules, display, and settings verified; SPEC Earth
  checks blocked by input temperature and rain" (not a full pass); record
  the 10 PASS steps.
- Record what the default Earth map shows, as open input problems to
  diagnose next (no code changes now): northern Europe and much of northern
  Asia ET; hot deserts BWk (northern Sahara, interior Australia, southern
  Africa, US Southwest); the US/Canadian interior Dsa/Dsb and the SE US Cs
  instead of Cfa; northeast Brazil and the East African coast Af while the
  Amazon and Congo interiors are Aw.

## What Load Earth Map does
Works like Load Sample Map (`src/main.js`): fetches
`./test-maps/gebco_bathy_heightmap.jpg` and
`./test-maps/gebco_bathy_BW_heightmap.png` (relative, lowercase; nothing from
test-maps/private), then opens the Import dialog prefilled: Heightmap, Sea
level Auto off at 128, Max height 5,000 m, the mask attached as the Land/sea
mask, extent at the defaults (90°N to 90°S, west edge −180°, span 360°) with
wrap on and Sim width 1024, everything else at the dialog defaults (saved
import settings ignored, as with any prefill). You click Import.

## Planet reset (Load Earth Map only)
Every Planet panel setting: radius 6,371 km, rotation 24 h, spin prograde,
axial tilt 23.5°, lunar pull 1, Season Annual Mean. Applied only when Import
is clicked; Load Sample Map, normal imports, and Reload never touch the
planet. Saved like any planet change (`fcm:planet`), so it survives F5.

## Single undo step
- `commitState` takes an optional `planet`: the before snapshot stores the
  current planet and season, the after snapshot the Earth values.
- `applySnapshot` applies them when a snapshot carries them (state, Planet
  panel, toolbar season, saved settings, climate rerun). Snapshots without
  them leave the planet alone.
- The import is built with radius 6,371 km, not the current map's radius.
- One Ctrl+Z restores the previous map, radius, rotation, spin, tilt, lunar
  pull, and season; Ctrl+Y redoes all of it.

## Cancel
Load Earth Map only fetches and opens the dialog. The reset lives in the
import commit, which runs only after Import succeeds, so Cancel changes
nothing.

## Reload map image after a fetched load (same as Load Sample Map)
No file handle, so Reload asks for the heightmap with the picker; on a
same-size reload the fetched mask is kept as is; Reload never resets the
planet.

## Size on the live site
Heightmap 888,347 bytes (≈ 0.85 MB) + mask 189,549 bytes (≈ 0.18 MB) ≈ 1.08
MB, fetched only on click (the sample map is 35,929 bytes). Both are
already committed public test maps.

## Files
- New `src/io/earthmap.js` (pure): `EARTH_MAP` (paths, kind, heightmap
  patch, extent), `EARTH_PLANET` (the values above),
  `earthPrefill(defaultHeightmap)` (the dialog prefill with a `planetReset`
  flag and radius 6,371).
- `src/ui/importdialog.js`: the prefill can carry a mask file and a radius
  (a decode helper shared with "Add mask image…"); `planetReset` passes
  through to the import.
- `src/main.js`: `loadEarthMap()` and File > "Load Earth Map" under Load
  Sample Map (milestone '2a'); `importMap` applies the Earth radius and
  planet when the import carries `planetReset`; the
  `commitState`/`applySnapshot` planet option.
- `src/sim/mapstate.js`: snapshots may carry `planet` (no buffers).

## Tests
- Paths (testmaps.test.js): relative, lowercase, directly in test-maps/, no
  leading underscore, exist with that exact casing.
- Prefill: kind heightmap, sea level 128 (Auto off), max height 5,000 m,
  the mask path, the extent (wrap on, sim 1024), other heightmap fields at
  defaults, `planetReset`, radius 6,371.
- `EARTH_PLANET` equals `createPlanet()` defaults plus Annual Mean and
  6,371 km.
- Undo: a `stateEntry` with snapshots carrying the old and the Earth
  planet; undo hands back the old map and planet, redo the Earth ones.
- Cancel: a source test that `loadEarthMap` changes no planet setting and
  the reset is only in `importMap`'s commit; clicking Cancel is in the
  by-eye check (the dialog is DOM code).

## Records and rules
SPEC §13.1 line (your Session 10 extra); LOG entry and Session 10 prompt
log. No git; Edit tool or Python only; one purpose per command; the tool
log after each sub-step.

## By-eye check
Server URL; set a non-Earth radius (e.g. 8,000) and tilt (30) first; File >
Load Earth Map; check the prefill; Cancel → nothing changed; Load Earth Map
→ Import → planet reset; Ctrl+Z → map and planet restored; F5 persistence.
Then a commit message.
