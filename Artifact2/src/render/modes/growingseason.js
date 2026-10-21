// Growing Season (SPEC 13.3, M4): days per year with a daily mean of at
// least 5 °C (the thermal growing season), with daily values linear between
// the 12 mid-month means. Land only.

import { makeClimateRenderer } from '../climateraster.js';

// Data palette: none, 1–60, 60–120, 120–180, 180–240, 240–300, 300–364, all year.
const COLORS = [[236, 236, 232], [222, 234, 196], [192, 222, 152], [150, 200, 110], [104, 172, 78], [64, 140, 58], [36, 108, 46], [18, 74, 36]];
const WATER = [96, 118, 140];

export const drawGrowingSeason = makeClimateRenderer('growing-season', {
  colors: COLORS,
  water: WATER,
  legend: {
    items: [
      { cls: 7, label: 'all year' }, { cls: 6, label: '300–364 days' }, { cls: 5, label: '240–300 days' }, { cls: 4, label: '180–240 days' },
      { cls: 3, label: '120–180 days' }, { cls: 2, label: '60–120 days' }, { cls: 1, label: '1–60 days' }, { cls: 0, label: 'none' },
    ],
    note: 'Days with a mean temperature of 5 °C or more. Temperature only; precipitation isn\'t considered yet, so dry regions may grow less.',
  },
});
