// Sculpt tool controls for the context bar: brush picker, Size (brush
// radius in source px) and Strength (%) sliders with number inputs, and a km
// readout of the brush width at the cursor's latitude.

import { createSlider } from './slider.js';
import { FIXED_BRUSHES } from '../sim/brushes.js';
import { BRUSH_MAX_RADIUS_PX } from '../sim/constants.js';

export const BRUSH_SIZE = { min: 1, max: BRUSH_MAX_RADIUS_PX, value: 40 };
export const BRUSH_STRENGTH = { min: 1, max: 100, value: 50 };

// opts: { brushes: [{ id, label }], value: { brushId, size, strength }, onChange(value) }
export function createSculptPanel({ brushes, value, onChange }) {
  const root = document.createElement('div');
  root.className = 'sculpt-panel';
  let v = { ...value };

  const select = document.createElement('select');
  select.setAttribute('aria-label', 'Brush');
  for (const b of brushes) select.append(new Option(b.label, b.id));
  select.addEventListener('change', () => set({ brushId: select.value }));

  const size = createSlider({ label: 'Size', ...BRUSH_SIZE, value: v.size, unit: 'px', onInput: (n) => set({ size: n }) });
  const strength = createSlider({ label: 'Strength', ...BRUSH_STRENGTH, value: v.strength, unit: '%', onInput: (n) => set({ strength: n }) });
  const km = document.createElement('span');
  km.className = 'hint sculpt-km';

  root.append(select, size.element, strength.element, km);

  function sync() {
    select.value = v.brushId;
    size.set(v.size);
    strength.set(v.strength);
    strength.setDisabled(FIXED_BRUSHES.has(v.brushId));
    strength.element.title = FIXED_BRUSHES.has(v.brushId) ? 'Draw Land and Erase ignore strength.' : '';
  }

  function set(patch) {
    v = { ...v, ...patch };
    sync();
    onChange(v);
  }

  sync();
  return {
    element: root,
    get value() { return v; },
    set(patch) { v = { ...v, ...patch }; sync(); },
    // text: e.g. "≈ 280 km wide here", or '' off the map
    setKm(text) { km.textContent = text; },
  };
}
