// Overlay toggle registry (SPEC 13.4). Pure data; the map view maps ids to
// draw functions. Toggles from later milestones are listed disabled.

export const OVERLAY_GROUPS = [
  { id: 'reference', label: 'Reference' },
  { id: 'atmosphere', label: 'Atmosphere' },
  { id: 'ocean', label: 'Ocean' },
  { id: 'coast', label: 'Coast' },
];

export const OVERLAYS = [
  { id: 'graticule', label: 'Graticule', group: 'reference', milestone: 1, defaultOn: true },
  { id: 'shaded-relief', label: 'Shaded Relief', group: 'reference', milestone: '2b' },
  { id: 'water-body-labels', label: 'Water Body Labels', group: 'reference', milestone: 9 },
  { id: 'wind-arrows', label: 'Wind Arrows', group: 'atmosphere', milestone: 3 },
  { id: 'pressure-itcz', label: 'Pressure & ITCZ', group: 'atmosphere', milestone: 3 },
  { id: 'polar-front', label: 'Polar Front & Storm Tracks', group: 'atmosphere', milestone: 8 },
  { id: 'climate-boundaries', label: 'Climate Boundaries', group: 'atmosphere', milestone: 4 },
  { id: 'hurricane-zones', label: 'Hurricane Zones', group: 'atmosphere', milestone: 7 },
  { id: 'coastal-fog', label: 'Coastal Fog', group: 'atmosphere', milestone: 7 },
  { id: 'ocean-currents', label: 'Ocean Currents', group: 'ocean', milestone: 7 },
  { id: 'sea-ice-edges', label: 'Seasonal Sea-Ice Edges', group: 'ocean', milestone: 7 },
  { id: 'sailing-routes', label: 'Sailing Routes', group: 'ocean', milestone: 10 },
  { id: 'coastline-type', label: 'Coastline Type', group: 'coast', milestone: 9 },
  { id: 'wave-exposure', label: 'Wave Exposure', group: 'coast', milestone: 9 },
  { id: 'harbor-suitability', label: 'Harbor Suitability', group: 'coast', milestone: 9 },
];

export function defaultOverlayState() {
  return Object.fromEntries(OVERLAYS.map((o) => [o.id, Boolean(o.defaultOn)]));
}
