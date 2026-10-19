// Frost/Snow/Permafrost (SPEC 13.3, M4): temperature classes over land, first
// match wins: ice-cap climate (warmest month < 0 °C), continuous permafrost
// (mean annual ≤ −8 °C), discontinuous permafrost (≤ −2 °C), lasting snow
// cover (coldest month < −3 °C), frequent frost (< 3 °C), occasional frost
// (< 12 °C), frost-free.

import { makeClimateRenderer } from '../climateraster.js';
import { FROST, FROST_LABELS } from '../../sim/climatestats.js';

// Data palette, indexed by FROST class.
const COLORS = [[236, 196, 130], [244, 228, 170], [214, 224, 226], [160, 200, 236], [150, 120, 200], [96, 64, 150], [250, 252, 255]];
const WATER = [96, 118, 140];

const order = [FROST.ICE_CAP, FROST.CONTINUOUS, FROST.PERMAFROST, FROST.SNOW_COVER, FROST.FREQUENT, FROST.OCCASIONAL, FROST.FROST_FREE];

export const drawFrost = makeClimateRenderer('frost', {
  colors: COLORS,
  water: WATER,
  legend: {
    items: order.map((cls) => ({ cls, label: FROST_LABELS[cls] })),
    note: 'From monthly mean temperatures. Snow cover assumes enough precipitation (M5).',
  },
});
