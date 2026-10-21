// Simulation pipeline (SPEC 12). Pure; the worker runs it.
//
// So far:
//   1. Downsample terrain (the import pipeline / brushes; not repeated here)
//   2. Base wind (bands + ITCZ shift)            ← M3
//   3. Ocean currents, SST                        (M7)
//   4. Temperature, pass 1                        (feeds monsoons, M8; skipped until then)
//   5. Final wind: friction, mountain deflection  ← M4b; monsoons join in M8
//   6. Temperature, pass 2                        ← M4 (on the final wind from M4b)
//   7. Precipitation                              ← M5 (on the final wind and step 6)
//
// runClimate({ grid, planet, season, terrain?, continentality?, precipitation?, hydro? })
//   grid    = { width, height, latTop, latBottom, lonSpan?, wraps?, radiusKm? }
//   planet  = see planet.js; season = { annual: true } | { day }
//   terrain = { category, elevation } on the sim grid (cell surface
//             elevation, see temperature.js); without it only the base
//             wind runs (zonal, as in M3)
//   continentality = a previous result for the same terrain and planet
//             (the slow part; it doesn't depend on the season), reused as is
//   precipitation = true to run step 7 (needs terrain); hydro = a previous
//             12-month precipitation result for the same terrain and planet
// → { season, u, v, speed, pressure (Float32Array(width * height)), meta,
//     months?: [{ season, profile, meta }],
//     temperature?: Float32Array, continentality?: { s, maritime, coast, sweeps },
//     precipitation?: Float32Array (mm/month, this season), cloud?: Float32Array (0–1, this season),
//     hydro?: { months, rh, annual, sweeps, stats, cloud } }
// Without terrain, Annual Mean also returns its 12 monthly wind runs as row
// profiles (the base wind is zonal), which the main thread caches. With
// terrain the final wind varies by cell, so those aren't returned.

import { windProfile, annualProfile, expandProfile, seasonMeta } from './wind.js';
import { createSeason, MONTH_MID_DAYS } from './planet.js';
import { continentality } from './continentality.js';
import { seasonTemperature } from './temperature.js';
import { terrainWind } from './terrainwind.js';
import { precipitationMonths, precipitationDay } from './precipitation.js';
import { hydroStats, cloudLayer } from './hydrostats.js';
import { PLANET_RADIUS_KM } from './constants.js';

// Step 5: friction and mountain deflection over the terrain (M4b). Without
// a terrain the base wind passes through unchanged.
export const finalWind = (base, grid = null, terrain = null) => (terrain ? terrainWind(base, grid, terrain) : base);

// The final wind of one mid-month day.
const finalMonth = (grid, planet, terrain, day) => finalWind(windProfile(grid, planet, day), grid, terrain);

// Step 6: temperature on the final wind. Continentality follows the 12
// monthly final winds (it is annual, SPEC 6). Step 4 (pass 1, on the base
// wind) only feeds the monsoon pressure, so it is skipped until M8.
export function temperatureSteps({ grid, planet, season, terrain, continentality: cached = null }) {
  const radius = grid.radiusKm ?? PLANET_RADIUS_KM;
  const months = MONTH_MID_DAYS.map((d) => () => finalMonth(grid, planet, terrain, d));
  const c = cached ?? continentality(grid, terrain.category, months, radius);
  return { temperature: seasonTemperature(grid, planet.tiltDeg, season, terrain, c.s), continentality: c };
}

// Step 7: precipitation on the final wind and the step-6 temperatures (s =
// the seasonal swing from continentality). The 12 monthly runs (hydro) don't
// depend on the season and can be reused; Annual Mean is their mean, a
// single day is its own run. The M5 weather modes' statistics (seasonality,
// PET, wettest and driest month) and the 12-month mean cloud cover are added
// to the set once (hydroStats, cloudLayer); a single day's cloud cover comes
// from its own run.
// → { precipitation (mm/month, this season), cloud (0–1, this season),
//     hydro: { months, rh, annual, sweeps, stats, cloud } }
export function precipitationSteps({ grid, planet, season, terrain, s, hydro: cached = null }) {
  const windFor = (day, profile) => finalWind(profile ?? windProfile(grid, planet, day), grid, terrain);
  const hydro = cached ?? precipitationMonths(grid, planet, terrain, s, windFor);
  if (!hydro.stats) {
    const temps = MONTH_MID_DAYS.map((d) => seasonTemperature(grid, planet.tiltDeg, { day: d }, terrain, s));
    hydro.stats = hydroStats(grid, planet, hydro.months, temps);
    const n = grid.width * grid.height;
    hydro.cloud = new Float32Array(n);
    MONTH_MID_DAYS.forEach((d, m) => {
      const c = cloudLayer(grid, hydro.rh[m], windProfile(grid, planet, d).pressure, hydro.months[m]);
      for (let k = 0; k < n; k++) hydro.cloud[k] += c[k] / 12;
    });
  }
  if (season.annual) return { precipitation: hydro.annual, cloud: hydro.cloud, hydro };
  const day = precipitationDay(grid, planet, terrain, s, season.day, windFor);
  return { precipitation: day.precip, cloud: cloudLayer(grid, day.rh, windProfile(grid, planet, season.day).pressure, day.precip), hydro };
}

// Annual Mean of the final wind (SPEC 4.1): u, v = vector mean of the 12
// monthly final winds, speed = mean of their speeds, pressure = mean index.
function annualFinal(grid, planet, terrain) {
  const n = grid.width * grid.height;
  const out = { u: new Float32Array(n), v: new Float32Array(n), speed: new Float32Array(n) };
  for (const d of MONTH_MID_DAYS) {
    const w = finalMonth(grid, planet, terrain, d);
    for (let k = 0; k < n; k++) { out.u[k] += w.u[k]; out.v[k] += w.v[k]; out.speed[k] += w.speed[k]; }
  }
  for (let k = 0; k < n; k++) { out.u[k] /= 12; out.v[k] /= 12; out.speed[k] /= 12; }
  return out;
}

export function runClimate({
  grid, planet, season, terrain = null, continentality: cached = null, precipitation = false, hydro = null,
}) {
  const s = createSeason(season);
  let out;
  if (s.annual) {
    const { mean, months } = annualProfile(grid, planet);
    const base = expandProfile(mean, grid.width);
    if (terrain) out = { season: s, ...base, ...annualFinal(grid, planet, terrain), meta: seasonMeta(planet, s) };
    else {
      out = {
        season: s,
        ...base,
        meta: seasonMeta(planet, s),
        months: months.map(({ day, profile }) => ({ season: { day }, profile, meta: seasonMeta(planet, { day }) })),
      };
    }
  } else {
    const profile = windProfile(grid, planet, s.day);
    const base = expandProfile(profile, grid.width);
    out = { season: s, ...base, ...(terrain ? finalWind(profile, grid, terrain) : {}), meta: seasonMeta(planet, s) };
  }
  if (terrain) Object.assign(out, temperatureSteps({ grid, planet, season: s, terrain, continentality: cached }));
  if (terrain && precipitation) {
    Object.assign(out, precipitationSteps({ grid, planet, season: s, terrain, s: out.continentality.s, hydro }));
  }
  return out;
}

// Full result from a cached monthly profile.
export function resultFromProfile(entry, width) {
  return { season: entry.season, ...expandProfile(entry.profile, width), meta: entry.meta };
}
