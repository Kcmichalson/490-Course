// Companion chat places (step D): read the places in a reply and work out
// how to show them on the map. Pure, no DOM. Display only: nothing here
// touches the sim, map data, undo history, or saved settings.
//
// A reply is normal text plus, when places come up, a fenced ```json list
// of { name, lat, lon, radius_km } (radius_km 25–1,000).

import { latLonToPixel } from '../sim/coords.js';

export const RADIUS_MIN_KM = 25;
export const RADIUS_MAX_KM = 1000;
const FILL_FRACTION = 0.4; // a chip zooms so the circle fills about this much of the view

const FENCE = /```json[ \t]*\r?\n([\s\S]*?)```/g;

// { text (the reply without its JSON blocks), places: [{ name, lat, lon,
//   radius_km, issues: [] }], error } — a place with a bad field is kept
// with an issue (shown flagged, never hidden) unless it has no position.
export function parsePlaces(reply) {
  const places = [];
  let error = null;
  for (const m of reply.matchAll(FENCE)) {
    let list;
    try {
      list = JSON.parse(m[1]);
    } catch (e) {
      error = `The places list doesn't parse: ${e.message}`;
      continue;
    }
    if (!Array.isArray(list)) {
      error = 'The places block is not a list.';
      continue;
    }
    for (const p of list) {
      if (!p || typeof p !== 'object') continue;
      const lat = Number(p.lat);
      const lon = Number(p.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90) {
        error = `A place has no usable lat/lon: ${JSON.stringify(p).slice(0, 80)}`;
        continue;
      }
      const issues = [];
      let radius = Number(p.radius_km);
      if (!Number.isFinite(radius) || radius < RADIUS_MIN_KM || radius > RADIUS_MAX_KM) {
        issues.push(`radius_km must be ${RADIUS_MIN_KM}–${RADIUS_MAX_KM.toLocaleString('en-US')}`);
        radius = Math.min(RADIUS_MAX_KM, Math.max(RADIUS_MIN_KM, Number.isFinite(radius) ? radius : RADIUS_MIN_KM));
      }
      places.push({ name: typeof p.name === 'string' && p.name.trim() ? p.name.trim() : 'Unnamed place', lat, lon, radius_km: radius, issues });
    }
  }
  const text = reply.replace(FENCE, '').replace(/\n{3,}/g, '\n\n').trim();
  return { text, places, error };
}

// The highlight circle of a place in source px: { x, y, rx, ry }. A true
// circle on the globe is an ellipse on an equirectangular map, wider
// east-west by 1 / cos(lat).
export function placeEllipse(map, place) {
  const kmPerDeg = (2 * Math.PI * map.radiusKm) / 360;
  const pxPerDegLat = map.sourceHeight / (map.latTop - map.latBottom);
  const pxPerDegLon = map.sourceWidth / map.lonSpan;
  const cos = Math.max(0.05, Math.cos((place.lat * Math.PI) / 180));
  const { x, y } = latLonToPixel(map, place.lat, place.lon);
  return {
    x, y,
    rx: (place.radius_km / (kmPerDeg * cos)) * pxPerDegLon,
    ry: (place.radius_km / kmPerDeg) * pxPerDegLat,
  };
}

// The view scale at which the circle fills about 40% of the view,
// within the map's zoom limits.
export function placeScale(ellipse, viewW, viewH, limits) {
  const s = FILL_FRACTION * Math.min(viewW / (2 * ellipse.rx), viewH / (2 * ellipse.ry));
  return Math.min(limits.max, Math.max(limits.min, s));
}
