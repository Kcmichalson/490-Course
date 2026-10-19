// Original inline SVG glyphs (24×24, stroked with currentColor) for map-mode
// categories, modes, and tools. No external assets or copied game art.

const WAVE = (y) => `M2 ${y}c2.5-2 5 2 7.5 0s5-2 7.5 0 3.5 1 5 0`;
const CLOUD = (dy = 0) => `M7 ${18 + dy}a4 4 0 0 1-.5-8 6 6 0 0 1 11.5 1.5A3.5 3.5 0 0 1 17.5 ${18 + dy}z`;
const LEAF_PAIR = (y) => `M12 ${y}c-2-1-3-3-3-5 2 1 3 3 3 5zM12 ${y}c2-1 3-3 3-5-2 1-3 3-3 5z`;

const PATHS = {
  // Categories
  'cat-terrain': '<path d="M2 20l7-12 4 6 3-4 6 10z"/>',
  'cat-climate': '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M5 7h14M5 17h14"/>',
  'cat-weather': `<path d="${CLOUD(-4)}"/><path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3"/>`,
  'cat-ocean': `<path d="${WAVE(8)}"/><path d="${WAVE(13)}"/><path d="${WAVE(18)}"/>`,
  'cat-life': '<path d="M5 19C5 10 10 5 20 4c0 10-5 15-14 15z"/><path d="M5 19l9-9"/>',

  // Terrain
  'original-art': '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 16l5-5 4 4 3-3 6 6"/><circle cx="16" cy="9" r="1.5"/>',
  physical: '<path d="M2 18l6-9 4 5 3-4 7 8z"/><path d="M2 21h20"/>',
  elevation: '<path d="M4 20v-6M9 20V9M14 20V4M19 20v-8"/>',
  slope: '<path d="M3 20L21 6M3 20h18"/><path d="M15 20a6 6 0 0 0-1.4-3.8"/>',
  'coast-distance': '<path d="M3 3c3 4 3 14 0 18"/><path d="M8 5c2 3 2 11 0 14M13 7c1.5 2.5 1.5 7.5 0 10M18 9c1 2 1 4 0 6"/>',
  'art-check': '<path d="M4 20c2 0 3-1 3-3l8-8 2 2-8 8"/><path d="M14 4l2 2"/><path d="M14 19l2 2 4-5"/>',

  // Climate
  koppen: '<rect x="3" y="3" width="8" height="8"/><rect x="13" y="3" width="8" height="8"/><rect x="3" y="13" width="8" height="8"/><path d="M13 17h8M17 13v8"/>',
  biomes: '<path d="M12 3l6 8h-3.5l4.5 7H5l4.5-7H6z"/><path d="M12 18v3"/>',
  temperature: '<path d="M10 4a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0z"/><path d="M12 9v7"/>',
  'temp-range': '<path d="M7 5a2 2 0 0 1 4 0v8a4 4 0 1 1-4 0z"/><path d="M18 4v16M15 7l3-3 3 3M15 17l3 3 3-3"/>',
  'growing-season': '<path d="M12 21v-9"/><path d="M12 12c0-4-3-6-7-6 0 4 3 6 7 6zM12 14c0-4 3-6 7-6 0 4-3 6-7 6z"/>',
  frost: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7"/><path d="M9 4l3 2 3-2M9 20l3-2 3 2"/>',
  'winter-severity': '<path d="M12 2v9M8.5 4.5L12 7l3.5-2.5M8.5 9.5L12 7"/><path d="M3 15c3-2 6 2 9 0s6-2 9 0M3 20c3-2 6 2 9 0s6-2 9 0"/>',

  // Weather
  precipitation: '<path d="M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z"/>',
  'precip-seasonality': '<path d="M4 20v-4M8 20v-8M12 20v-3M16 20V8M20 20v-6"/>',
  aridity: '<circle cx="12" cy="9" r="4"/><path d="M12 2v1.5M4.5 9H3M21 9h-1.5M6.6 3.6l1 1M17.4 3.6l-1 1"/><path d="M3 19h18M8 19l2-3M15 19l-1-2"/>',
  'cloud-cover': `<path d="${CLOUD()}"/>`,
  'wind-pressure': '<path d="M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h7"/>',
  'air-masses': '<path d="M2 15h20"/><path d="M5 15l2.5-4 2.5 4z"/><path d="M14 15a2.5 2.5 0 0 1 5 0"/>',

  // Ocean
  sst: `<path d="${WAVE(18)}"/><path d="M13 4a2 2 0 0 1 4 0v6a3 3 0 1 1-4 0z"/>`,
  'water-bodies': '<path d="M5 8c2-4 8-5 11-2s5 3 4 7-6 7-10 6-7-6-5-11z"/><path d="M9 12h6"/>',
  'tidal-range': `<path d="${WAVE(16)}"/><path d="${WAVE(20)}"/><path d="M12 3v9M9 6l3-3 3 3M9 9l3 3 3-3"/>`,
  'marine-productivity': '<path d="M3 12c3-4 8-5 12-2l5-3v10l-5-3c-4 3-9 2-12-2z"/><circle cx="8" cy="11.5" r=".8"/>',
  'sailing-time': '<path d="M12 3v13M12 4l6 10h-6M12 6l-5 8h5"/><path d="M4 17h16l-2 3H6z"/>',

  // Life
  vegetation: '<path d="M7 20v-4M17 20v-4M12 20v-6"/><circle cx="7" cy="12.5" r="3.5"/><circle cx="17" cy="12.5" r="3.5"/><circle cx="12" cy="8" r="4"/>',
  agriculture: `<path d="M12 21V6"/><path d="${LEAF_PAIR(9)}"/><path d="${LEAF_PAIR(14)}"/><path d="${LEAF_PAIR(19)}"/>`,
  'travel-difficulty': '<path d="M4 20c4-2 2-6 6-8s6-3 8-8" stroke-dasharray="2 2.5"/><path d="M18 4V1.5l3 1.2-3 1.3"/><path d="M2 20h4"/>',
  hazards: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',
  wildfire: '<path d="M12 21c-4 0-7-3-7-7 0-4 4-6 4-10 3 2 4 4 4 6 1-1 2-2 2-4 3 2 4 5 4 8 0 4-3 7-7 7z"/>',

  // Tools
  'tool-navigate': '<path d="M12 2v20M2 12h20M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3"/>',
  'tool-sculpt': '<path d="M14 4l6 6-9 9H5v-6z"/><path d="M12 6l6 6"/>',
  'tool-route': '<circle cx="5" cy="18" r="2"/><circle cx="19" cy="6" r="2"/><path d="M7 18c6 0 4-12 10-12" stroke-dasharray="2 2"/>',

  // Small UI glyphs
  caret: '<path d="M7 10l5 5 5-5"/>',
  play: '<path d="M8 5v14l11-7z"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  planet: '<circle cx="12" cy="12" r="6"/><path d="M3 15c-1.5 2 2 3 9 1s11-5.5 9.5-7.5c-.7-1-3-1-6 0"/>',
};

export function icon(name, size = 20) {
  const body = PATHS[name] ?? '<circle cx="12" cy="12" r="8"/>';
  return `<svg class="icon" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}
