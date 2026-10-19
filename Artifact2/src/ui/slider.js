// A slider with a number input beside it for exact values (CLAUDE.md rule).
// Both stay in sync. onInput fires with the numeric value while dragging or
// typing; onCommit fires when a value is settled: the slider is released (or
// stepped with the keyboard), or the number input changes (Enter / blur).
// scale: 'log' positions the slider logarithmically (for ranges such as
// 4–240 h, where the interesting values crowd the low end); the number
// input still shows the exact value.

let nextId = 1;

const LOG_STEPS = 1000;

export function createSlider({ label, min, max, step = 1, value, unit = '', scale = 'linear', onInput, onCommit }) {
  const id = `sl-${nextId++}`;
  const log = scale === 'log' && min > 0;
  const row = document.createElement('div');
  row.className = 'field-row slider-row';
  row.innerHTML = `
    <label for="${id}"></label>
    <input id="${id}" type="range">
    <input type="number" min="${min}" max="${max}" step="${step}" aria-label="">
    <span class="unit"></span>`;
  row.querySelector('label').textContent = label;
  row.querySelector('.unit').textContent = unit;
  const range = row.querySelector('input[type="range"]');
  const number = row.querySelector('input[type="number"]');
  number.setAttribute('aria-label', `${label} (exact value)`);
  if (log) Object.assign(range, { min: '0', max: String(LOG_STEPS), step: '1' });
  else Object.assign(range, { min: String(min), max: String(max), step: String(step) });

  const clamp = (v) => Math.min(max, Math.max(min, v));
  const decimals = (String(step).split('.')[1] ?? '').length;
  const roundStep = (v) => Number((Math.round(v / step) * step).toFixed(decimals));
  const toRange = (v) => (log ? Math.round((LOG_STEPS * Math.log(v / min)) / Math.log(max / min)) : v);
  const fromRange = (r) => (log ? clamp(roundStep(min * (max / min) ** (r / LOG_STEPS))) : r);

  const set = (v) => { range.value = String(toRange(v)); number.value = String(v); };
  set(value);
  range.addEventListener('input', () => {
    const v = fromRange(Number(range.value));
    number.value = String(v);
    onInput?.(v);
  });
  range.addEventListener('change', () => onCommit?.(Number(number.value)));
  number.addEventListener('change', () => {
    const v = Number(number.value);
    if (!Number.isFinite(v)) { number.value = String(fromRange(Number(range.value))); return; }
    set(clamp(v));
    onInput?.(clamp(v));
    onCommit?.(clamp(v));
  });

  return {
    element: row,
    get value() { return Number(number.value); },
    set,
    setDisabled(disabled) {
      range.disabled = disabled;
      number.disabled = disabled;
      row.classList.toggle('is-disabled', disabled);
    },
  };
}
