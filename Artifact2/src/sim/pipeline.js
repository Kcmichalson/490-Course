// Simulation pipeline (SPEC 12). Pure; the worker runs it.
//
// So far:
//   1. Downsample terrain (the import pipeline / brushes; not repeated here)
//   2. Base wind (bands + ITCZ shift)            ← M3
//   3. Ocean currents, SST                        (M7)
//   4. Temperature, pass 1                        (M4)
//   5. Monsoons, friction, deflection → final wind (M8; passes through now)
//   6. Temperature, pass 2                        (M4)
//   7. Precipitation                              (M5)
//
// runClimate({ grid, planet, season })
//   grid   = { width, height, latTop, latBottom } (the sim grid)
//   planet = see planet.js; season = { annual: true } | { day }
// → { season, u, v, speed, pressure (Float32Array(width * height)), meta,
//     months?: [{ season, profile, meta }] }
// Annual Mean also returns its 12 monthly runs as row profiles (wind is zonal
// in M3), which the main thread caches and expands on demand.

import { windProfile, annualProfile, expandProfile, seasonMeta } from './wind.js';
import { createSeason } from './planet.js';

// Step 5 before M8: the final wind is the base wind, unchanged.
export const finalWind = (base) => base;

export function runClimate({ grid, planet, season }) {
  const s = createSeason(season);
  if (s.annual) {
    const { mean, months } = annualProfile(grid, planet);
    const wind = finalWind(expandProfile(mean, grid.width));
    return {
      season: s,
      ...wind,
      meta: seasonMeta(planet, s),
      months: months.map(({ day, profile }) => ({ season: { day }, profile: finalWind(profile), meta: seasonMeta(planet, { day }) })),
    };
  }
  const wind = finalWind(expandProfile(windProfile(grid, planet, s.day), grid.width));
  return { season: s, ...wind, meta: seasonMeta(planet, s) };
}

// Full result from a cached monthly profile.
export function resultFromProfile(entry, width) {
  return { season: entry.season, ...expandProfile(entry.profile, width), meta: entry.meta };
}
