// Cloud Cover (SPEC 13.3, M5): the selected season's cloud cover (Annual
// Mean = the mean of the 12 monthly runs), from the moisture solve's
// relative humidity and rain and the pressure belts, read bilinearly from the sim
// grid. Water uses the same colors, darker.

import { makeClimateRenderer } from '../climateraster.js';
import { fillCloudClasses } from '../../sim/precipfield.js';
import { hydroCtx } from './precipitation.js';

// Data palette (with the renderer, per CLAUDE.md): 10% bands, dark slate
// (clear) → white (overcast).
const COLORS = Array.from({ length: 10 }, (_, c) => {
  const f = c / 9;
  return [44 + f * (250 - 44), 56 + f * (252 - 56), 72 + f * (255 - 72)].map(Math.round);
});

export const drawCloudCover = makeClimateRenderer('cloud-cover', {
  colors: COLORS,
  context: hydroCtx,
  fill: fillCloudClasses,
  legend: {
    items: [9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map((cls) => ({ cls, label: cls === 9 ? '90–100% (overcast)' : cls === 0 ? '0–10% (clear)' : `${cls * 10}–${cls * 10 + 10}%` })),
    note: 'Current season (Annual Mean = mean of the 12 months): humid or raining air makes cloud, rising air (lows) more than sinking air (highs). Water drawn darker.',
  },
});
