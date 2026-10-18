// A slider with a number input beside it for exact values (CLAUDE.md rule).
// Both stay in sync; onInput fires with the numeric value.

let nextId = 1;

export function createSlider({ label, min, max, step = 1, value, unit = '', onInput }) {
  const id = `sl-${nextId++}`;
  const row = document.createElement('div');
  row.className = 'field-row slider-row';
  row.innerHTML = `
    <label for="${id}"></label>
    <input id="${id}" type="range" min="${min}" max="${max}" step="${step}">
    <input type="number" min="${min}" max="${max}" step="${step}" aria-label="">
    <span class="unit"></span>`;
  row.querySelector('label').textContent = label;
  row.querySelector('.unit').textContent = unit;
  const range = row.querySelector('input[type="range"]');
  const number = row.querySelector('input[type="number"]');
  number.setAttribute('aria-label', `${label} (exact value)`);

  const clamp = (v) => Math.min(max, Math.max(min, v));
  const set = (v) => { range.value = String(v); number.value = String(v); };
  set(value);
  range.addEventListener('input', () => { number.value = range.value; onInput?.(Number(range.value)); });
  number.addEventListener('change', () => {
    const v = Number(number.value);
    if (!Number.isFinite(v)) { number.value = range.value; return; }
    set(clamp(v));
    onInput?.(clamp(v));
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
