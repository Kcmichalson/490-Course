// Precipitation Seasonality (SPEC 13.3, M5): the Walsh–Lawler index of the
// 12 monthly totals (ignores the selected season), land only, read
// bilinearly from the sim grid. Too little rain → "too dry to tell".

import { makeClimateRenderer } from '../climateraster.js';
import { fillSeasonalityClasses } from '../../sim/precipfield.js';
import { SEASONALITY_LABELS, SEASONALITY_TOO_DRY } from '../../sim/hydrostats.js';
import { hydroCtx } from './precipitation.js';

// Data palette (with the renderer, per CLAUDE.md): pale green → yellow →
// orange → red → purple; index 7 = too dry to tell (pale gray).
const COLORS = [
  [204, 232, 186], [234, 236, 150], [250, 212, 108], [244, 160, 70], [222, 96, 56], [176, 40, 64], [112, 32, 112], [214, 214, 210],
];
const WATER = [96, 118, 140];

const EDGE_TEXT = ['under 0.20', '0.20–0.40', '0.40–0.60', '0.60–0.80', '0.80–1.00', '1.00–1.20', '1.20+'];

export const drawSeasonality = makeClimateRenderer('precip-seasonality', {
  colors: COLORS,
  water: WATER,
  context: hydroCtx,
  fill: fillSeasonalityClasses,
  legend: {
    items: [
      ...[6, 5, 4, 3, 2, 1, 0].map((cls) => ({ cls, label: `${EDGE_TEXT[cls]} ${SEASONALITY_LABELS[cls]}` })),
      { cls: SEASONALITY_TOO_DRY, label: 'too dry to tell (under 60 mm/yr)' },
    ],
    note: 'Walsh–Lawler index of the 12 monthly means (0 = the same rain every month, 1.83 = all in one month); ignores the selected season. Land only. No monsoons yet (M8).',
  },
});
