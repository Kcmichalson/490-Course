// File > Load Earth Map (your Session 10 extra; SPEC 13.1). Pure: the paths,
// the import prefill (the M6a checklist settings), and the Earth planet that
// importing it resets to. main.js fetches the files and opens the dialog.

import { createPlanet, ANNUAL } from '../sim/planet.js';

// Bundled public test maps: relative (the site lives under a subfolder on
// GitHub Pages) and lowercase (Pages is case-sensitive).
export const EARTH_MAP = Object.freeze({
  image: './test-maps/gebco_bathy_heightmap.jpg',
  mask: './test-maps/gebco_bathy_BW_heightmap.png',
  kind: 'heightmap',
  // Heightmap settings on top of the dialog defaults: sea level set by hand
  // (Auto off), as in the M6a checklist.
  settings: Object.freeze({ seaLevel: 128, maxHeight: 5000 }),
  extent: Object.freeze({ latTop: 90, latBottom: -90, lonWest: -180, lonSpan: 360, wraps: true, simWidth: 1024 }),
});

// Every Planet panel setting at its Earth value.
export const EARTH_PLANET = Object.freeze({
  planet: createPlanet({ rotationHours: 24, spin: 1, tiltDeg: 23.5, lunarPull: 1 }),
  season: ANNUAL,
  radiusKm: 6371,
});

// The import dialog's prefill: the dialog's own heightmap defaults with the
// Earth values on top; planetReset makes the import also reset the planet
// (one undo step with it).
export function earthPrefill(defaultHeightmap) {
  return {
    kind: EARTH_MAP.kind,
    storedSettings: { heightmap: { ...defaultHeightmap, ...EARTH_MAP.settings } },
    cfgValues: { ...EARTH_MAP.extent },
    radiusKm: EARTH_PLANET.radiusKm,
    planetReset: true,
  };
}
