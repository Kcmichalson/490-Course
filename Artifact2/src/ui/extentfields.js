// Map extent fields (latitude range, west-edge longitude, span, wrap, sim
// width) for a map whose pixel size is fixed, shared by the Import and Map
// settings dialogs.

import { allowedSimWidths, isFullSpan, validateMapConfig, simGridSize } from '../sim/mapconfig.js';

let nextId = 1;

export function createExtentFields(container, { onChange } = {}) {
  const p = `ex${nextId++}`;
  container.innerHTML = `
    <div class="field-row">
      <label for="${p}-top">Top edge</label>
      <input id="${p}-top" type="number" min="-90" max="90" step="any"> <span class="unit">°</span>
      <label for="${p}-bottom">Bottom edge</label>
      <input id="${p}-bottom" type="number" min="-90" max="90" step="any"> <span class="unit">°</span>
    </div>
    <div class="field-row">
      <label for="${p}-west">West edge</label>
      <input id="${p}-west" type="number" min="-360" max="360" step="any"> <span class="unit">°</span>
      <label for="${p}-span">Span</label>
      <input id="${p}-span" type="number" min="0" max="360" step="any"> <span class="unit">°</span>
    </div>
    <div class="field-row">
      <label class="check"><input id="${p}-wraps" type="checkbox"> Wrap east–west</label>
      <label for="${p}-sim">Sim width</label>
      <select id="${p}-sim"></select>
      <span class="hint" data-role="hint"></span>
    </div>`;
  const q = (s) => container.querySelector(`#${p}-${s}`);
  const top = q('top'), bottom = q('bottom'), west = q('west'), span = q('span'), wraps = q('wraps'), sim = q('sim');
  const hint = container.querySelector('[data-role="hint"]');
  let size = { width: 1024, height: 512 };
  let wrapWanted = true;
  let simWanted = 1024;

  const num = (el) => (el.value.trim() === '' ? Number.NaN : Number(el.value));

  function refresh() {
    const full = isFullSpan(num(span));
    wraps.disabled = !full;
    wraps.checked = full && wrapWanted;
    const allowed = allowedSimWidths(size.width);
    const pick = allowed.includes(simWanted) ? simWanted : (allowed.filter((s) => s <= simWanted).pop() ?? allowed[0]);
    sim.innerHTML = allowed.map((s) => `<option value="${s}">${s} wide</option>`).join('');
    sim.value = String(pick);
    sim.disabled = allowed.length <= 1;
    const g = simGridSize({ sourceWidth: size.width, sourceHeight: size.height, simWidth: pick });
    hint.textContent = `${size.width} × ${size.height} px → grid ${g.width} × ${g.height}${full ? '' : ' · wrap needs a 360° span'}`;
  }

  for (const el of [top, bottom, west, span]) el.addEventListener('input', () => { refresh(); onChange?.(); });
  wraps.addEventListener('change', () => { wrapWanted = wraps.checked; refresh(); onChange?.(); });
  sim.addEventListener('change', () => { simWanted = Number(sim.value); refresh(); onChange?.(); });

  return {
    // values: { latTop, latBottom, lonWest, lonSpan, wraps, simWidth }; px size fixed.
    set(values, width, height) {
      size = { width, height };
      top.value = values.latTop;
      bottom.value = values.latBottom;
      west.value = values.lonWest;
      span.value = values.lonSpan;
      wrapWanted = values.wraps !== false;
      simWanted = values.simWidth ?? 1024;
      refresh();
    },
    get() {
      return {
        sourceWidth: size.width,
        sourceHeight: size.height,
        latTop: num(top),
        latBottom: num(bottom),
        lonWest: num(west),
        lonSpan: num(span),
        wraps: wraps.checked,
        simWidth: Number(sim.value),
      };
    },
    errors() {
      return validateMapConfig(this.get());
    },
  };
}
