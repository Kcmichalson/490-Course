// Simulation pipeline (SPEC 12). Pure; the worker runs it.
//
// So far:
//   1. Downsample terrain (the import pipeline / brushes; not repeated here)
//   2. Base wind (bands + ITCZ shift)            ← M3
//   3. Ocean currents, SST                        (M7)
//   4. Temperature, pass 1                        ← M4
//   5. Monsoons, friction, deflection → final wind (M8; passes through now)
//   6. Temperature, pass 2                        ← M4 (= pass 1 until M8)
//   7. Precipitation                              (M5)
//
// runClimate({ grid, planet, season, terrain?, continentality? })
//   grid    = { width, height, latTop, latBottom, lonSpan?, wraps?, radiusKm? }
//   planet  = see planet.js; season = { annual: true } | { day }
//   terrain = { category, elevation } on the sim grid (cell surface
//             elevation, see temperature.js); without it only the wind runs
//   continentality = a previous result for the same terrain and planet
//             (the slow part; it doesn't depend on the season), reused as is
// → { season, u, v, speed, pressure (Float32Array(width * height)), meta,
//     months?: [{ season, profile, meta }],
//     temperature?: Float32Array, continentality?: { s, maritime, coast, sweeps } }
// Annual Mean also returns its 12 monthly wind runs as row profiles (wind is
// zonal so far), which the main thread caches and expands on demand.

import { windProfile, annualProfile, expandProfile, seasonMeta } from './wind.js';
import { createSeason, MONTH_MID_DAYS } from './planet.js';
import { continentality } from './continentality.js';
import { seasonTemperature } from './temperature.js';
import { PLANET_RADIUS_KM } from './constants.js';

// Step 5 before M8: the final wind is the base wind, unchanged.
export const finalWind = (base) => base;

// Steps 4–6: temperature on the base wind, then again on the final wind.
// Continentality follows the 12 monthly winds (it is annual, SPEC 6).
export function temperatureSteps({ grid, planet, season, terrain, continentality: cached = null }) {
  const radius = grid.radiusKm ?? PLANET_RADIUS_KM;
  const baseMonths = MONTH_MID_DAYS.map((d) => windProfile(grid, planet, d));
  // Step 4: pass 1 on the base wind.
  const pass1 = cached ?? continentality(grid, terrain.category, baseMonths, radius);
  const t1 = seasonTemperature(grid, planet.tiltDeg, season, terrain, pass1.s);
  // Step 5 → step 6: pass 2 on the final wind. Until M8 the final wind is the
  // base wind itself, so pass 2 would repeat pass 1 exactly: reuse it.
  const finalMonths = baseMonths.map(finalWind);
  if (finalMonths.every((w, m) => w === baseMonths[m])) return { temperature: t1, continentality: pass1 };
  const pass2 = continentality(grid, terrain.category, finalMonths, radius);
  return { temperature: seasonTemperature(grid, planet.tiltDeg, season, terrain, pass2.s), continentality: pass2 };
}

export function runClimate({ grid, planet, season, terrain = null, continentality: cached = null }) {
  const s = createSeason(season);
  let out;
  if (s.annual) {
    const { mean, months } = annualProfile(grid, planet);
    const wind = finalWind(expandProfile(mean, grid.width));
    out = {
      season: s,
      ...wind,
      meta: seasonMeta(planet, s),
      months: months.map(({ day, profile }) => ({ season: { day }, profile: finalWind(profile), meta: seasonMeta(planet, { day }) })),
    };
  } else {
    const wind = finalWind(expandProfile(windProfile(grid, planet, s.day), grid.width));
    out = { season: s, ...wind, meta: seasonMeta(planet, s) };
  }
  if (terrain) Object.assign(out, temperatureSteps({ grid, planet, season: s, terrain, continentality: cached }));
  return out;
}

// Full result from a cached monthly profile.
export function resultFromProfile(entry, width) {
  return { season: entry.season, ...expandProfile(entry.profile, width), meta: entry.meta };
}
