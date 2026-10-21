// Precipitation (SPEC 13.3, M5): the selected season's precipitation in
// mm/month (Annual Mean = the mean of the 12 monthly runs), tan → dark blue,
// read bilinearly from the sim grid. Water uses the same colors, darker.

import { makeClimateRenderer } from '../climateraster.js';
import { fillPrecipClasses } from '../../sim/precipfield.js';

// Data palette (with the renderer, per CLAUDE.md): classes by the edges
// 10, 25, 50, 100, 150, 200, 300 mm/month.
export const PRECIP_COLORS = [
  [222, 196, 148], [214, 206, 150], [190, 210, 160], [140, 196, 170], [90, 170, 190], [56, 130, 190], [36, 88, 168], [20, 48, 120],
];

// Context for precipfield.js from the current climate result, or null while
// no precipitation has arrived for this map.
export function precipCtx(map, terrain, climate, layer = climate?.result?.precipitation) {
  if (!layer || !climate.grid || terrain.width !== map.sourceWidth || terrain.height !== map.sourceHeight) return null;
  return { map, category: terrain.category, layer, simW: climate.grid.width, simH: climate.grid.height };
}

export const drawPrecipitation = makeClimateRenderer('precipitation', {
  colors: PRECIP_COLORS,
  context: precipCtx,
  fill: fillPrecipClasses,
  legend: {
    items: [
      { cls: 7, label: '300+ mm/month (3,600+ mm/yr)' }, { cls: 6, label: '200–300 mm/month' }, { cls: 5, label: '150–200 mm/month' },
      { cls: 4, label: '100–150 mm/month' }, { cls: 3, label: '50–100 mm/month' }, { cls: 2, label: '25–50 mm/month' },
      { cls: 1, label: '10–25 mm/month' }, { cls: 0, label: 'under 10 mm/month (120 mm/yr)' },
    ],
    note: 'Current season (Annual Mean = mean of the 12 months), on the sim grid. Water drawn darker. No SST or ocean currents (M7) or monsoons (M8) yet: cold-current deserts, NW Europe, and monsoon rain are not right yet.',
  },
});
