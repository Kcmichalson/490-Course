// Renderers for the map modes that exist so far, keyed by mode id. Modes
// without a renderer show the open-ocean placeholder.

import { drawOriginalArt } from './originalart.js';
import { drawPhysical } from './physical.js';
import { drawElevation } from './elevation.js';
import { drawSlope } from './slope.js';
import { drawCoastDistance } from './coastdistance.js';
import { drawWindPressure } from './windpressure.js';

export const RENDERERS = {
  'original-art': drawOriginalArt,
  physical: drawPhysical,
  elevation: drawElevation,
  slope: drawSlope,
  'coast-distance': drawCoastDistance,
  'wind-pressure': drawWindPressure,
};
