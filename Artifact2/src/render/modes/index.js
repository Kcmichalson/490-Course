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
import { drawPrecipitation } from './precipitation.js';
import { drawSeasonality } from './seasonality.js';
import { drawAridity } from './aridity.js';
import { drawCloudCover } from './cloudcover.js';
import { drawKoppen } from './koppen.js';

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
  precipitation: drawPrecipitation,
  'precip-seasonality': drawSeasonality,
  aridity: drawAridity,
  'cloud-cover': drawCloudCover,
  koppen: drawKoppen,
};

// Modes that need temperature results (M4).
export const TEMPERATURE_MODES = new Set(['temperature', 'temp-range', 'growing-season', 'frost', 'winter-severity']);

// Modes that need precipitation (M5, and Köppen from M6a; they run the
// temperature too).
export const PRECIP_MODES = new Set(['precipitation', 'precip-seasonality', 'aridity', 'cloud-cover', 'koppen']);
