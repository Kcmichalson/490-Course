// Aridity (SPEC 13.3, M5): the UNEP aridity index, annual precipitation over
// Thornthwaite potential evapotranspiration (PET), land only, read
// bilinearly from the sim grid. Too cold to evaporate much → "cold".

import { makeClimateRenderer } from '../climateraster.js';
import { fillAridityClasses } from '../../sim/precipfield.js';
import { ARIDITY_LABELS, ARIDITY_COLD } from '../../sim/hydrostats.js';
import { hydroCtx } from './precipitation.js';

// Data palette (with the renderer, per CLAUDE.md): dark red-brown → orange →
// sand → light green → green → teal → blue-green; index 7 = cold (pale
// gray-blue).
const COLORS = [
  [120, 44, 28], [214, 112, 48], [228, 196, 140], [184, 214, 140], [96, 168, 88], [40, 140, 136], [24, 104, 120], [196, 208, 222],
];
const WATER = [96, 118, 140];

const EDGE_TEXT = ['under 0.05', '0.05–0.20', '0.20–0.50', '0.50–0.65', '0.65–1.0', '1–2', '2+'];

export const drawAridity = makeClimateRenderer('aridity', {
  colors: COLORS,
  water: WATER,
  context: hydroCtx,
  fill: fillAridityClasses,
  legend: {
    items: [
      ...[6, 5, 4, 3, 2, 1, 0].map((cls) => ({ cls, label: `${EDGE_TEXT[cls]} ${ARIDITY_LABELS[cls]}` })),
      { cls: ARIDITY_COLD, label: 'cold (PET under 100 mm/yr)' },
    ],
    note: 'Annual precipitation ÷ potential evaporation (Thornthwaite, from the 12 monthly temperatures and day length); ignores the selected season. Land only.',
  },
});
