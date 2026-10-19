// Temperature Range (SPEC 13.3, M4): warmest minus coldest monthly mean,
// from the 12 monthly runs (independent of the selected season). Small over
// oceans and in the tropics, largest in continental interiors.

import { makeClimateRenderer } from '../climateraster.js';

// Data palette: classes by the edges 5, 10, 20, 30, 40, 50 °C.
const COLORS = [[250, 246, 220], [246, 226, 160], [232, 190, 110], [206, 140, 76], [168, 92, 70], [128, 58, 92], [84, 32, 100]];

export const drawTempRange = makeClimateRenderer('temp-range', {
  colors: COLORS,
  legend: {
    items: [
      { cls: 6, label: 'over 50 °C' }, { cls: 5, label: '40–50 °C' }, { cls: 4, label: '30–40 °C' }, { cls: 3, label: '20–30 °C' },
      { cls: 2, label: '10–20 °C' }, { cls: 1, label: '5–10 °C' }, { cls: 0, label: 'under 5 °C' },
    ],
    note: 'Warmest minus coldest month. Water drawn darker.',
  },
});
