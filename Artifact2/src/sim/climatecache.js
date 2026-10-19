// Per-season cache of climate results (SPEC 12: "cache results per season;
// only recompute the steps downstream of what changed"). Pure, no DOM.
//
// The key holds everything the wind depends on in M3: rotation, spin, tilt,
// the season, and the sim grid's size and latitude range. Radius, lunar pull,
// longitude, and terrain don't affect the M3 wind (terrain joins from M4).
//
// Entries are full results or row profiles (the free monthly runs from an
// Annual Mean job), expanded on demand. Least recently used entries are
// dropped first once the byte budget is exceeded; the newest always stays.

import { seasonKey } from './planet.js';
import { resultFromProfile } from './pipeline.js';

export const CLIMATE_CACHE_BUDGET_BYTES = 128 * 1024 * 1024;

export function climateKey(grid, planet, season) {
  return [planet.rotationHours, planet.spin, planet.tiltDeg, seasonKey(season),
    `${grid.width}x${grid.height}`, grid.latTop, grid.latBottom].join('|');
}

const FIELDS = ['u', 'v', 'speed', 'pressure'];
const bytesOf = (e) => FIELDS.reduce((sum, f) => sum + (e.result ? e.result[f].byteLength : e.profile[f].byteLength), 0);

export function createClimateCache(budget = CLIMATE_CACHE_BUDGET_BYTES) {
  const entries = new Map(); // key → { result } | { profile, season, meta, width }

  function trim() {
    let total = 0;
    for (const e of entries.values()) total += bytesOf(e);
    for (const [key, e] of entries) {
      if (total <= budget || entries.size <= 1) break;
      total -= bytesOf(e);
      entries.delete(key);
    }
  }

  function touch(key, e) {
    entries.delete(key);
    entries.set(key, e);
  }

  return {
    get(key) {
      const e = entries.get(key);
      if (!e) return null;
      if (!e.result) {
        // Expand a monthly profile into full layers the first time it is used.
        e.result = resultFromProfile(e, e.width);
        delete e.profile;
      }
      touch(key, e);
      trim();
      return e.result;
    },
    has: (key) => entries.has(key),
    // Stores a worker result; an Annual Mean result's months are stored as
    // profiles under their own keys (unless already cached).
    put(grid, planet, result) {
      const { months, ...main } = result;
      for (const m of months ?? []) {
        const k = climateKey(grid, planet, m.season);
        if (!entries.has(k)) entries.set(k, { profile: m.profile, season: m.season, meta: m.meta, width: grid.width });
      }
      touch(climateKey(grid, planet, main.season), { result: main });
      trim();
      return main;
    },
    clear: () => entries.clear(),
    get size() { return entries.size; },
    get bytes() { let t = 0; for (const e of entries.values()) t += bytesOf(e); return t; },
  };
}
