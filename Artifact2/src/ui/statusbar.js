// Status bar: cursor lat/lon, elevation (M2), climate code (M6), map info,
// and the simulation worker's status.

import { simGridSize } from '../sim/mapconfig.js';

export function createStatusBar(root) {
  root.innerHTML = `
    <span class="sb-cursor">—</span>
    <span class="sb-elev" title="Elevation arrives in M2">Elevation: —</span>
    <span class="sb-climate" title="Climate code arrives in M6">Climate: —</span>
    <span class="sb-spacer"></span>
    <span class="sb-map"></span>
    <span class="sb-worker">Worker: starting…</span>`;
  const cursor = root.querySelector('.sb-cursor');
  const mapInfo = root.querySelector('.sb-map');
  const worker = root.querySelector('.sb-worker');

  return {
    // text: formatted lat/lon, or null when the cursor is off the map/canvas
    setCursor(text, offMap = false) {
      cursor.textContent = text ?? (offMap ? 'Off map' : '—');
    },
    setMap(map) {
      const sim = simGridSize(map);
      const lat = `${map.latTop}° to ${map.latBottom}°`;
      mapInfo.textContent = `${map.sourceWidth} × ${map.sourceHeight} px · lat ${lat} · lon ${map.lonWest}° + ${map.lonSpan}°${map.wraps ? ' · wraps' : ''} · sim ${sim.width} × ${sim.height}`;
    },
    setWorker(status) {
      worker.textContent = status === 'ready' ? 'Worker: ready' : status === 'error' ? 'Worker: failed' : 'Worker: starting…';
      worker.className = `sb-worker ${status === 'ready' ? 'sb-ok' : status === 'error' ? 'sb-error' : ''}`;
    },
  };
}
