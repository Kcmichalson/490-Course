// Temperature (SPEC 13.3, M4): the selected season's temperature (Annual
// Mean = the 12-month mean) at each pixel's own elevation, in 5 °C bands
// from ≤ −40 to ≥ +40 °C on a fixed diverging scale. Water uses the same
// colors, drawn darker, so coasts stay readable.

import { makeClimateRenderer } from '../climateraster.js';

// Data palette (with the renderer, per CLAUDE.md): class k covers
// [−45 + 5k, −40 + 5k) °C; class 0 is below −40, class 17 is 40 and above.
export const TEMPERATURE_COLORS = [
  [48, 18, 84], [72, 34, 128], [86, 58, 166], [70, 92, 196], [56, 124, 214], [72, 156, 226],
  [108, 186, 234], [150, 210, 240], [196, 230, 246], [246, 244, 214], [248, 228, 160], [250, 204, 110],
  [246, 174, 76], [238, 138, 56], [224, 98, 48], [196, 60, 44], [156, 30, 40], [110, 14, 34],
];

export const drawTemperature = makeClimateRenderer('temperature', {
  colors: TEMPERATURE_COLORS,
  legend: {
    items: [
      { cls: 17, label: '40 °C and above' }, { cls: 15, label: '30 to 35 °C' }, { cls: 13, label: '20 to 25 °C' },
      { cls: 11, label: '10 to 15 °C' }, { cls: 9, label: '0 to 5 °C' }, { cls: 7, label: '−10 to −5 °C' },
      { cls: 5, label: '−20 to −15 °C' }, { cls: 3, label: '−30 to −25 °C' }, { cls: 0, label: 'below −40 °C' },
    ],
    note: 'Current season, 5 °C bands (every other band shown). Land at its own elevation (−6.5 °C per km). Water drawn darker; it is air over the sea, not SST (M7), so cold-current and Gulf Stream coasts are not yet right.',
  },
});
