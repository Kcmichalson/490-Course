// Renderers for the map modes that exist so far, keyed by mode id. Modes
// without a renderer show the open-ocean placeholder.

import { drawOriginalArt } from './originalart.js';
import { drawPhysical } from './physical.js';
import { drawElevation } from './elevation.js';

export const RENDERERS = {
  'original-art': drawOriginalArt,
  physical: drawPhysical,
  elevation: drawElevation,
};
