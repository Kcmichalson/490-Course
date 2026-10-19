// Simulation worker. Runs the heavy, pure sim steps off the main thread
// (SPEC 12), so the UI never freezes.
//
// Messages in:  { type: 'ping', id }
//               { type: 'build', id, kind, rgba, maskRgba?, settings, cfg }
//               { type: 'coastDistance', id, category, cfg }
// Messages out: { type: 'pong', id }
//               { type: 'done', id, result } | { type: 'error', id, message }

import { buildTerrain } from './sim/importpipeline.js';
import { signedCoastDistanceKm } from './sim/distance.js';
import { PLANET_RADIUS_KM } from './sim/constants.js';

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
  if (msg.type === 'coastDistance') {
    try {
      const started = performance.now();
      const data = signedCoastDistanceKm(msg.category, msg.cfg, PLANET_RADIUS_KM);
      const result = { data, width: msg.cfg.sourceWidth, height: msg.cfg.sourceHeight, ms: Math.round(performance.now() - started) };
      self.postMessage({ type: 'done', id: msg.id, result }, [data.buffer]);
    } catch (err) {
      self.postMessage({ type: 'error', id: msg.id, message: err.message || String(err) });
    }
  }
});
