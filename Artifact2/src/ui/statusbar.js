// Status bar: cursor lat/lon, elevation (M2a), climate code (M6), map info,
// the simulation progress, and the simulation worker's status.

import { simGridSize } from '../sim/mapconfig.js';

export function formatMeters(m) {
  const v = Math.round(m);
  return `${v < 0 ? '−' : ''}${Math.abs(v).toLocaleString('en-US')} m`;
}

export function createStatusBar(root) {
  root.innerHTML = `
    <span class="sb-cursor">—</span>
    <span class="sb-elev" title="Elevation arrives in M2a">Elevation: —</span>
    <span class="sb-climate" title="Climate code arrives in M6">Climate: —</span>
    <span class="sb-spacer"></span>
    <span class="sb-map"></span>
    <span class="sb-sim" hidden></span>
    <span class="sb-worker">Worker: starting…</span>`;
  const cursor = root.querySelector('.sb-cursor');
  const mapInfo = root.querySelector('.sb-map');
  const worker = root.querySelector('.sb-worker');
  const simStatus = root.querySelector('.sb-sim');
  const elev = root.querySelector('.sb-elev');
  elev.removeAttribute('title');

  return {
    // text: formatted lat/lon, or null when the cursor is off the map/canvas
    setCursor(text, offMap = false) {
      cursor.textContent = text ?? (offMap ? 'Off map' : '—');
    },
    // meters, or null when the cursor is off the map
    setElevation(meters) {
      elev.textContent = `Elevation: ${meters == null ? '—' : formatMeters(meters)}`;
    },
    setMap(map) {
      const sim = simGridSize(map);
      const lat = `${map.latTop}° to ${map.latBottom}°`;
      mapInfo.textContent = `${map.sourceWidth} × ${map.sourceHeight} px · lat ${lat} · lon ${map.lonWest}° + ${map.lonSpan}°${map.wraps ? ' · wraps' : ''} · sim ${sim.width} × ${sim.height}`;
    },
    // Simulation progress (SPEC 12): text such as "Sim: computing wind…", or null to hide.
    setSim(text) {
      simStatus.hidden = !text;
      simStatus.textContent = text ?? '';
    },
    setWorker(status) {
      worker.textContent = status === 'ready' ? 'Worker: ready' : status === 'error' ? 'Worker: failed' : 'Worker: starting…';
      worker.className = `sb-worker ${status === 'ready' ? 'sb-ok' : status === 'error' ? 'sb-error' : ''}`;
    },
  };
}
