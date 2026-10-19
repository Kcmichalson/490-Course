// Planet panel (SPEC 3, 13.1): slides up from the context bar. Every slider
// has a number input beside it; the simulation runs when a value is settled
// (slider released, or the number entered), debounced so a held arrow key
// gives one run. Also exports the season selector shared with the toolbar.

import { createSlider } from './slider.js';
import { debounceCommit } from './debounce.js';
import {
  PLANET_RANGES, SEASON_PRESETS, ANNUAL, seasonPreset, cellsPerHemisphere, createSeason,
} from '../sim/planet.js';
import { PLANET_RADIUS_MIN_KM, PLANET_RADIUS_MAX_KM, YEAR_DAYS } from '../sim/constants.js';

const el = (tag, props = {}, text = '') => {
  const e = Object.assign(document.createElement(tag), props);
  if (text) e.textContent = text;
  return e;
};

// Season <select>: Annual Mean, the four presets, and the current custom day.
// onChange(season) fires when the user picks an option.
export function createSeasonSelect({ label = 'Season', onChange, customDay = () => 172 }) {
  const select = el('select');
  select.setAttribute('aria-label', label);
  for (const p of SEASON_PRESETS) select.append(el('option', { value: p.id }, p.label));
  const custom = el('option', { value: 'custom' });
  select.append(custom);
  select.addEventListener('change', () => {
    const p = SEASON_PRESETS.find((x) => x.id === select.value);
    onChange(p ? p.season : createSeason({ day: customDay() }));
  });
  return {
    element: select,
    set(season) {
      const p = seasonPreset(season);
      custom.textContent = !p && !season.annual ? `Day ${season.day}` : 'Custom day';
      select.value = p ? p.id : 'custom';
    },
  };
}

const cellsText = (h) => {
  const n = cellsPerHemisphere(h);
  return `→ ${n} ${n === 1 ? 'cell' : 'cells'} per hemisphere`;
};

// opts: { planet, season, radiusKm,
//         onPlanet(planet patch), onSeason(season), onRadius(km), onTiltInput(tilt) }
export function createPlanetPanel(body, { planet, season, radiusKm, onPlanet, onSeason, onRadius, onTiltInput }) {
  body.replaceChildren();
  body.classList.add('planet-body');

  // ---- Planet column ----
  const colPlanet = el('fieldset', { className: 'planet-col' });
  colPlanet.append(el('legend', {}, 'Planet'));
  const radius = createSlider({
    label: 'Radius', min: PLANET_RADIUS_MIN_KM, max: PLANET_RADIUS_MAX_KM, step: 1, value: radiusKm, unit: 'km',
    onCommit: debounceCommit((v) => onRadius(v)),
  });
  const cells = el('span', { className: 'hint planet-cells' }, cellsText(planet.rotationHours));
  const rotation = createSlider({
    label: 'Rotation period', ...PLANET_RANGES.rotationHours, step: 0.1, value: planet.rotationHours, unit: 'h', scale: 'log',
    onInput: (v) => { cells.textContent = cellsText(v); },
    onCommit: debounceCommit((v) => onPlanet({ rotationHours: v })),
  });
  rotation.element.append(cells);

  const spinRow = el('div', { className: 'field-row' });
  spinRow.append(el('span', { className: 'field-label' }, 'Spin'));
  const spinInputs = [[1, 'Prograde'], [-1, 'Retrograde']].map(([value, text]) => {
    const label = el('label', { className: 'check' });
    const input = el('input', { type: 'radio', name: 'planet-spin', value: String(value) });
    input.addEventListener('change', () => { if (input.checked) onPlanet({ spin: value }); });
    label.append(input, document.createTextNode(` ${text}`));
    spinRow.append(label);
    return input;
  });
  colPlanet.append(radius.element, rotation.element, spinRow);

  // ---- Orbit & season column ----
  const colOrbit = el('fieldset', { className: 'planet-col' });
  colOrbit.append(el('legend', {}, 'Orbit & season'));
  const tilt = createSlider({
    label: 'Axial tilt', ...PLANET_RANGES.tiltDeg, step: 0.5, value: planet.tiltDeg, unit: '°',
    onInput: (v) => onTiltInput?.(v),
    onCommit: debounceCommit((v) => onPlanet({ tiltDeg: v })),
  });
  let lastDay = season.annual ? 172 : season.day;
  const seasonRow = el('div', { className: 'field-row' });
  const seasonSelect = createSeasonSelect({ onChange: (s) => onSeason(s), customDay: () => lastDay });
  seasonRow.append(el('span', { className: 'field-label' }, 'Season'), seasonSelect.element);
  const day = createSlider({
    label: 'Day of year', min: 0, max: YEAR_DAYS - 1, step: 1, value: lastDay, unit: '',
    onCommit: debounceCommit((v) => { lastDay = v; onSeason(createSeason({ day: v })); }),
  });
  // Annual Mean has no single day: the slider is off (releasing it used to
  // switch the season to that day). Custom day in the select turns it on.
  const dayHint = el('span', { className: 'hint' }, 'Annual Mean: pick a preset or Custom day to choose a day.');
  day.element.append(dayHint);
  const lunar = createSlider({
    label: 'Lunar pull', ...PLANET_RANGES.lunarPull, step: 0.05, value: planet.lunarPull, unit: '× Moon',
    onCommit: debounceCommit((v) => onPlanet({ lunarPull: v })),
  });
  lunar.element.append(el('span', { className: 'hint' }, 'used by tides (M9)'));
  colOrbit.append(tilt.element, seasonRow, day.element, lunar.element);

  const foot = el('p', { className: 'hint planet-foot' }, 'The simulation updates when you release a slider or enter a number. Rotation, spin, tilt, season, and lunar pull are saved for next time; the radius belongs to the map (Edit > Undo reverts it).');
  body.append(colPlanet, colOrbit, foot);

  const api = {
    setPlanet(p) {
      rotation.set(p.rotationHours);
      cells.textContent = cellsText(p.rotationHours);
      for (const input of spinInputs) input.checked = Number(input.value) === p.spin;
      tilt.set(p.tiltDeg);
      lunar.set(p.lunarPull);
    },
    setSeason(s) {
      seasonSelect.set(s);
      if (!s.annual) { lastDay = s.day; day.set(s.day); }
      day.setDisabled(Boolean(s.annual));
      dayHint.hidden = !s.annual;
    },
    setRadius(km) { radius.set(km); },
  };
  api.setPlanet(planet);
  api.setSeason(season ?? ANNUAL);
  return api;
}
