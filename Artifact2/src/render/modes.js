// Map mode registry (SPEC 13.3). Pure data: each milestone fills in a mode's
// renderer and legend when its data exists. Until then the map view falls
// back to the open-ocean placeholder.
//
// Mode entry: { id, label, category, icon, milestone, blurb }
// Hotkeys come from position: category key 1–5, then Q W E R T Y U.

export const CATEGORIES = [
  { id: 'terrain', label: 'Terrain', icon: 'cat-terrain' },
  { id: 'climate', label: 'Climate', icon: 'cat-climate' },
  { id: 'weather', label: 'Weather', icon: 'cat-weather' },
  { id: 'ocean', label: 'Ocean', icon: 'cat-ocean' },
  { id: 'life', label: 'Life', icon: 'cat-life' },
];

export const MODES = [
  // Terrain
  { id: 'original-art', label: 'Original Art', category: 'terrain', milestone: '2a', blurb: 'The imported image, so overlays sit on your own map.' },
  { id: 'physical', label: 'Physical', category: 'terrain', milestone: '2a', blurb: 'Bathymetry blues; land greens → browns → white.' },
  { id: 'elevation', label: 'Elevation', category: 'terrain', milestone: '2a', blurb: 'Grayscale elevation.' },
  { id: 'slope', label: 'Slope & Ruggedness', category: 'terrain', milestone: '2b', blurb: 'How steep and broken the land is.' },
  { id: 'coast-distance', label: 'Distance from Coast', category: 'terrain', milestone: '2b', blurb: 'Distance to the nearest coastline in km.' },
  { id: 'art-check', label: 'Art Check', category: 'terrain', milestone: 6, blurb: 'Where the hand-drawn map disagrees with the simulation.' },
  // Climate
  { id: 'koppen', label: 'Köppen', category: 'climate', milestone: 6, blurb: 'Köppen–Geiger climate classes with legend.' },
  { id: 'biomes', label: 'Biomes', category: 'climate', milestone: 6, blurb: 'Natural, painterly biome colors; exportable as base art.' },
  { id: 'temperature', label: 'Temperature', category: 'climate', milestone: 4, blurb: 'Surface temperature, blue → red, current season.' },
  { id: 'temp-range', label: 'Temperature Range', category: 'climate', milestone: 4, blurb: 'Warmest minus coldest month.' },
  { id: 'growing-season', label: 'Growing Season', category: 'climate', milestone: 4, blurb: 'Length of the growing season.' },
  { id: 'frost', label: 'Frost/Snow/Permafrost', category: 'climate', milestone: 4, blurb: 'Frost, snow cover, and permafrost.' },
  { id: 'winter-severity', label: 'Winter Severity', category: 'climate', milestone: 4, blurb: 'How harsh the winters are.' },
  // Weather
  { id: 'precipitation', label: 'Precipitation', category: 'weather', milestone: 5, blurb: 'Rainfall and rain shadows, tan → dark blue.' },
  { id: 'precip-seasonality', label: 'Precipitation Seasonality', category: 'weather', milestone: 5, blurb: 'When in the year the rain falls.' },
  { id: 'aridity', label: 'Aridity', category: 'weather', milestone: 5, blurb: 'Dryness: rainfall against evaporation.' },
  { id: 'cloud-cover', label: 'Cloud Cover', category: 'weather', milestone: 5, blurb: 'Typical cloudiness.' },
  { id: 'wind-pressure', label: 'Wind Speed & Pressure', category: 'weather', milestone: 3, blurb: 'Calm zones, pressure belts, later monsoon highs and lows.' },
  { id: 'air-masses', label: 'Air Masses', category: 'weather', milestone: 8, blurb: 'Source regions of the dominant air masses.' },
  // Ocean
  { id: 'sst', label: 'Sea Surface Temperature', category: 'ocean', milestone: 7, blurb: 'Ocean temperature; warm and cold currents at a glance.' },
  { id: 'water-bodies', label: 'Water Bodies', category: 'ocean', milestone: 9, blurb: 'Oceans, seas, gulfs, bays, straits, and lakes.' },
  { id: 'tidal-range', label: 'Tidal Range', category: 'ocean', milestone: 9, blurb: 'Micro/meso/macro-tidal coasts and the intertidal band.' },
  { id: 'marine-productivity', label: 'Marine Productivity', category: 'ocean', milestone: 7, blurb: 'Rich fishing waters: upwelling, shelves, cold water.' },
  { id: 'sailing-time', label: 'Sailing Time', category: 'ocean', milestone: 10, blurb: 'Travel time from a clicked port to every ocean cell.' },
  // Life
  { id: 'vegetation', label: 'Vegetation Density', category: 'life', milestone: 6, blurb: 'How thickly the land is vegetated.' },
  { id: 'agriculture', label: 'Agricultural Potential', category: 'life', milestone: 6, blurb: 'How well the land could be farmed.' },
  { id: 'travel-difficulty', label: 'Travel Difficulty', category: 'life', milestone: 8, blurb: 'How hard the land is to cross on foot.' },
  { id: 'hazards', label: 'Natural Hazards', category: 'life', milestone: 8, blurb: 'Storms, floods, and other climate hazards.' },
  { id: 'wildfire', label: 'Wildfire Risk', category: 'life', milestone: 6, blurb: 'Where dry seasons and fuel make fires likely.' },
].map((m) => ({ ...m, icon: m.id }));

export const DEFAULT_MODE_ID = 'physical';

export function getMode(id) {
  return MODES.find((m) => m.id === id) ?? MODES.find((m) => m.id === DEFAULT_MODE_ID);
}

export function modesInCategory(categoryId) {
  return MODES.filter((m) => m.category === categoryId);
}

export function categoryIndex(categoryId) {
  return CATEGORIES.findIndex((c) => c.id === categoryId);
}
