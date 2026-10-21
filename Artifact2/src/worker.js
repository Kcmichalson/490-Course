// Simulation worker. Runs the heavy, pure sim steps off the main thread
// (SPEC 12), so the UI never freezes.
//
// Messages in:  { type: 'ping', id }
//               { type: 'build', id, kind, rgba, maskRgba?, settings, cfg }
//               { type: 'coastDistance', id, category, cfg }
//               { type: 'climate', id, grid, planet, season }  (M3 wind)
//                 + M4 temperature: terrain { category, elevation } (sim
//                 cells), thermalKey, boundaryKey, needContinentality
//                 + M5 precipitation: precip, hydroKey, needHydro
// Messages out: { type: 'pong', id }
//               { type: 'done', id, result } | { type: 'error', id, message }

import { buildTerrain } from './sim/importpipeline.js';
import { signedCoastDistanceKm } from './sim/distance.js';
import { PLANET_RADIUS_KM } from './sim/constants.js';
import { runClimate, precipitationSteps } from './sim/pipeline.js';
import { climateBoundaries } from './sim/boundaries.js';

// The last continentality (the slow part of temperature), boundary lines,
// and 12-month precipitation (M5; the monthly layers stay here, M6 Köppen
// will read them), by key, so season changes reuse them.
let lastThermal = { key: null, value: null };
let lastBounds = { key: null, value: null };
let lastHydro = { key: null, value: null };

self.addEventListener('message', (e) => {
  const msg = e.data;
  if (!msg) return;
  if (msg.type === 'ping') {
    self.postMessage({ type: 'pong', id: msg.id });
    return;
  }
  if (msg.type === 'build') {
    try {
      const started = performance.now();
      const { terrain, sim, info } = buildTerrain({
        kind: msg.kind,
        rgba: msg.rgba,
        maskRgba: msg.maskRgba ?? null,
        settings: msg.settings,
        cfg: msg.cfg,
      });
      const result = { elevation: terrain.elevation, category: terrain.category, sim, info, ms: Math.round(performance.now() - started) };
      const transfer = [terrain.elevation.buffer, terrain.category.buffer, sim.landFraction.buffer, sim.meanLandElev.buffer,
        sim.maxElev.buffer, sim.meanOceanDepth.buffer, sim.category.buffer];
      self.postMessage({ type: 'done', id: msg.id, result }, transfer);
    } catch (err) {
      self.postMessage({ type: 'error', id: msg.id, message: err.message || String(err) });
    }
    return;
  }
  if (msg.type === 'climate') {
    try {
      const started = performance.now();
      // Temperature (M4) reuses the last continentality and boundaries when
      // their keys match: a season change doesn't rerun the tracer.
      const terrain = msg.terrain ?? null;
      const reuse = terrain && lastThermal.key === msg.thermalKey ? lastThermal.value : null;
      const result = runClimate({ grid: msg.grid, planet: msg.planet, season: msg.season, terrain, continentality: reuse });
      const timing = { continentality: null, boundaries: null, precipitation: null };
      if (terrain) {
        timing.continentality = reuse ? 'cached' : Math.round(performance.now() - started);
        lastThermal = { key: msg.thermalKey, value: result.continentality };
        if (msg.precip) {
          // Step 7 (M5): the 12 monthly runs are reused by key; a single day
          // is one more run, Annual Mean their mean.
          const t0 = performance.now();
          const hydroReuse = lastHydro.key === msg.hydroKey ? lastHydro.value : null;
          const p = precipitationSteps({
            grid: msg.grid, planet: msg.planet, season: result.season, terrain, s: result.continentality.s, hydro: hydroReuse,
          });
          lastHydro = { key: msg.hydroKey, value: p.hydro };
          timing.precipitation = hydroReuse && result.season.annual ? 'cached' : Math.round(performance.now() - t0);
          timing.precipitationReused = Boolean(hydroReuse);
          // Copies: the worker keeps its own layers for reuse.
          result.precipitation = p.precipitation === p.hydro.annual ? p.precipitation.slice() : p.precipitation;
          result.cloud = p.cloud === p.hydro.cloud ? p.cloud.slice() : p.cloud;
          if (msg.needHydro) {
            const stats = Object.fromEntries(Object.entries(p.hydro.stats).map(([k, a]) => [k, a.slice()]));
            result.hydro = { annual: p.hydro.annual.slice(), sweeps: p.hydro.sweeps, stats };
          }
        }
        if (lastBounds.key !== msg.boundaryKey) {
          const t0 = performance.now();
          lastBounds = { key: msg.boundaryKey, value: climateBoundaries(msg.grid, msg.planet.tiltDeg, terrain, result.continentality.s) };
          timing.boundaries = Math.round(performance.now() - t0);
        } else timing.boundaries = 'cached';
        result.boundaries = lastBounds.value; // copied, not transferred: kept for reuse
        if (!msg.needContinentality) delete result.continentality;
      }
      result.ms = Math.round((performance.now() - started) * 10) / 10;
      result.timing = timing;
      const transfer = [result.u.buffer, result.v.buffer, result.speed.buffer, result.pressure.buffer];
      if (result.temperature) transfer.push(result.temperature.buffer);
      if (result.precipitation) transfer.push(result.precipitation.buffer);
      if (result.cloud) transfer.push(result.cloud.buffer);
      if (result.hydro) {
        transfer.push(result.hydro.annual.buffer);
        for (const a of Object.values(result.hydro.stats)) transfer.push(a.buffer);
      }
      for (const m of result.months ?? []) for (const f of ['u', 'v', 'speed', 'pressure']) transfer.push(m.profile[f].buffer);
      self.postMessage({ type: 'done', id: msg.id, result }, transfer);
    } catch (err) {
      self.postMessage({ type: 'error', id: msg.id, message: err.message || String(err) });
    }
    return;
  }
  if (msg.type === 'coastDistance') {
    try {
      const started = performance.now();
      const data = signedCoastDistanceKm(msg.category, msg.cfg, msg.cfg.radiusKm ?? PLANET_RADIUS_KM);
      const result = { data, width: msg.cfg.sourceWidth, height: msg.cfg.sourceHeight, ms: Math.round(performance.now() - started) };
      self.postMessage({ type: 'done', id: msg.id, result }, [data.buffer]);
    } catch (err) {
      self.postMessage({ type: 'error', id: msg.id, message: err.message || String(err) });
    }
  }
});
