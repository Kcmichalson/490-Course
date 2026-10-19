// Winter Severity (SPEC 13.3, M4): freezing degree-days, the yearly sum of
// the daily mean's frost (Σ max(0, −T), °C·days), a classic measure of how
// long and how hard winters are. Land only.

import { makeClimateRenderer } from '../climateraster.js';

// Data palette: classes by 0, 100, 500, 1,500, 3,000, 5,000 °C·days.
const COLORS = [[244, 240, 228], [214, 232, 240], [168, 208, 232], [116, 170, 216], [70, 120, 190], [44, 74, 150], [26, 36, 96]];
const WATER = [96, 118, 140];

export const drawWinterSeverity = makeClimateRenderer('winter-severity', {
  colors: COLORS,
  water: WATER,
  legend: {
    items: [
      { cls: 6, label: 'over 5,000 (extreme)' }, { cls: 5, label: '3,000–5,000' }, { cls: 4, label: '1,500–3,000' },
      { cls: 3, label: '500–1,500' }, { cls: 2, label: '100–500' }, { cls: 1, label: 'under 100' }, { cls: 0, label: 'no frost' },
    ],
    note: 'Freezing degree-days (°C·days per year).',
  },
});
