// Köppen (SPEC 8 and 13.3, M6a): Köppen–Geiger classes per land pixel, from
// the pixel's own 12 monthly temperatures and the sim grid's precipitation
// statistics (land cells only). Ignores the selected season. Water muted.
// The C/D boundary and the Highland override are set in the legend.

import { makeClimateRenderer, climateCtx } from '../climateraster.js';
import { fillKoppenClasses } from '../../sim/koppenfield.js';
import { KOPPEN, KOPPEN_CODES } from '../../sim/koppen.js';
import { KOPPEN_CD_BOUNDARY_C, KOPPEN_HIGHLAND_M } from '../../sim/constants.js';

// Data palette (with the renderer, per CLAUDE.md): the standard Köppen–Geiger
// colors of Beck et al. (2018), in KOPPEN_CODES order; H is brown.
const COLORS = [
  [0, 0, 255], [0, 120, 255], [70, 170, 250],
  [255, 0, 0], [255, 150, 150], [245, 165, 0], [255, 220, 100],
  [255, 255, 0], [200, 200, 0], [150, 150, 0], [150, 255, 150], [100, 200, 100], [50, 150, 50], [200, 255, 80], [100, 255, 80], [50, 200, 0],
  [255, 0, 255], [200, 0, 200], [150, 50, 150], [150, 100, 150], [170, 175, 255], [90, 120, 220], [75, 80, 180], [50, 0, 135],
  [0, 255, 255], [55, 200, 255], [0, 125, 125], [0, 70, 95],
  [178, 178, 178], [102, 102, 102],
  [139, 90, 60],
];
const WATER = [96, 118, 140];

// ---- Settings (SPEC 8): the C/D boundary and the Highland override. main.js
// loads and saves them (fcm:koppen) and redraws on change. ----

const settings = { cdBoundary: KOPPEN_CD_BOUNDARY_C, highland: true };
let onChange = () => {};
export const getKoppenSettings = () => ({ ...settings });
export function setKoppenSettings(patch, notify = true) {
  if (patch?.cdBoundary === 0 || patch?.cdBoundary === -3) settings.cdBoundary = patch.cdBoundary;
  if (typeof patch?.highland === 'boolean') settings.highland = patch.highland;
  if (notify) onChange(getKoppenSettings());
}
export function onKoppenSettings(fn) { onChange = fn; }

// Context for koppenfield.js: the monthly temperature context, the 12-month
// precipitation set (annual mean and statistics, kept by main.js as
// climate.hydro), and the settings. null until both have arrived.
export function koppenCtx(map, terrain, climate) {
  const stats = climate?.hydro?.stats;
  if (!stats?.nearestLand) return null;
  const ctx = climateCtx('monthly', map, terrain, climate);
  return ctx && { ...ctx, annual: climate.hydro.annual, stats, ...settings };
}

function controls() {
  const wrap = document.createElement('div');
  wrap.className = 'legend-controls';
  const cdRow = document.createElement('label');
  cdRow.className = 'field-row';
  cdRow.append(document.createTextNode('C/D boundary'));
  const cd = document.createElement('select');
  for (const [v, text] of [[0, '0 °C (coldest month)'], [-3, '−3 °C (coldest month)']]) cd.add(new Option(text, String(v)));
  cd.value = String(settings.cdBoundary);
  cd.addEventListener('change', () => setKoppenSettings({ cdBoundary: Number(cd.value) }));
  cdRow.append(cd);
  const hRow = document.createElement('label');
  hRow.className = 'check';
  const h = document.createElement('input');
  h.type = 'checkbox';
  h.checked = settings.highland;
  h.addEventListener('change', () => setKoppenSettings({ highland: h.checked }));
  hRow.append(h, document.createTextNode(`Highland (H) above ${KOPPEN_HIGHLAND_M.toLocaleString('en-US')} m`));
  wrap.append(cdRow, hRow);
  return wrap;
}

const SHORT = {
  Af: 'rainforest', Am: 'monsoon', Aw: 'savanna',
  BWh: 'hot desert', BWk: 'cold desert', BSh: 'hot steppe', BSk: 'cold steppe',
  ET: 'tundra', EF: 'ice cap', H: 'highland',
};
const THIRD = { a: 'hot summer', b: 'warm summer', c: 'cold summer', d: 'very cold winter' };
const item = (code) => ({ cls: KOPPEN[code], label: `${code} ${SHORT[code] ?? THIRD[code[2]]}` });
const group = (first) => KOPPEN_CODES.filter((c) => c[0] === first).map(item);

export const drawKoppen = makeClimateRenderer('koppen', {
  colors: COLORS,
  water: WATER,
  context: koppenCtx,
  fill: fillKoppenClasses,
  key: () => `${settings.cdBoundary}|${settings.highland}`,
  legend: {
    controls,
    columns: [
      { title: 'Tropical (A), dry (B)', items: [...group('A'), ...group('B')] },
      { title: 'Temperate (C)', items: group('C') },
      { title: 'Continental (D)', items: group('D') },
      { title: 'Polar (E), highland', items: [...group('E'), ...group('H')] },
    ],
    note: 'Second letter: s dry summer, w dry winter, f no dry season. From the 12 monthly temperatures (each pixel\'s own elevation) and precipitation (land cells only); ignores the selected season. Land only. Hover for the full name. No ocean currents (M7) or monsoons (M8) yet.',
  },
});
