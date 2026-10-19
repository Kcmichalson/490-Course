// Renderers for the map modes that exist so far, keyed by mode id. Modes
// without a renderer show the open-ocean placeholder.

import { drawOriginalArt } from './originalart.js';
import { drawPhysical } from './physical.js';
import { drawElevation } from './elevation.js';
import { drawSlope } from './slope.js';
import { drawCoastDistance } from './coastdistance.js';
import { drawWindPressure } from './windpressure.js';
import { drawTemperature } from './temperature.js';
import { drawTempRange } from './temprange.js';
import { drawGrowingSeason } from './growingseason.js';
import { drawFrost } from './frost.js';
import { drawWinterSeverity } from './wintersev.js';

export const RENDERERS = {
  'original-art': drawOriginalArt,
  physical: drawPhysical,
  elevation: drawElevation,
  slope: drawSlope,
  'coast-distance': drawCoastDistance,
  'wind-pressure': drawWindPressure,
  temperature: drawTemperature,
  'temp-range': drawTempRange,
  'growing-season': drawGrowingSeason,
  frost: drawFrost,
  'winter-severity': drawWinterSeverity,
};

// Modes that need temperature results (M4).
export const TEMPERATURE_MODES = new Set(['temperature', 'temp-range', 'growing-season', 'frost', 'winter-severity']);
