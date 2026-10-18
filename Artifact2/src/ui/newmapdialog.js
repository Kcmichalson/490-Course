// New Map dialog: size presets or custom size, latitude range, west-edge
// longitude and span, wrap (only at 360°), and simulation resolution.
// Remembers the last values in localStorage (fcm:newMap).

import {
  SIZE_PRESETS, allowedSimWidths, validateMapConfig, createMapConfig, isFullSpan,
  squarePixelLatSpan, simGridSize, MIN_SOURCE_SIZE,
} from '../sim/mapconfig.js';
import { load, save } from '../io/storage.js';

const fmt = (v, d = 2) => String(Number(v.toFixed(d)));

export function createNewMapDialog(dialog, { onCreate }) {
  const $ = (id) => dialog.querySelector(`#${id}`);
  const preset = $('nm-preset');
  const width = $('nm-width');
  const height = $('nm-height');
  const latTop = $('nm-lat-top');
  const latBottom = $('nm-lat-bottom');
  const lonWest = $('nm-lon-west');
  const lonSpan = $('nm-lon-span');
  const wraps = $('nm-wraps');
  const sim = $('nm-sim');
  const squareHint = $('nm-square-hint');
  const wrapHint = $('nm-wrap-hint');
  const simHint = $('nm-sim-hint');
  const errors = $('nm-errors');
  const create = $('nm-create');

  preset.innerHTML = SIZE_PRESETS.map((p) => `<option value="${p.id}">${p.label}</option>`).join('')
    + '<option value="custom">Custom</option>';

  let wrapWanted = true;
  let simWanted = 1024;

  const num = (input) => (input.value.trim() === '' ? Number.NaN : Number(input.value));
  const read = () => ({
    sourceWidth: num(width),
    sourceHeight: num(height),
    latTop: num(latTop),
    latBottom: num(latBottom),
    lonWest: num(lonWest),
    lonSpan: num(lonSpan),
    wraps: wraps.checked,
    simWidth: Number(sim.value),
  });

  function syncPresetFromSize() {
    const match = SIZE_PRESETS.find((p) => p.width === num(width) && p.height === num(height));
    preset.value = match ? match.id : 'custom';
  }

  function refresh() {
    const w = num(width);
    const h = num(height);
    const span = num(lonSpan);
    const sizeOk = Number.isInteger(w) && w >= MIN_SOURCE_SIZE;

    // Wrap is only offered for a full 360° span.
    const full = isFullSpan(span);
    wraps.disabled = !full;
    wraps.checked = full && wrapWanted;
    wrapHint.textContent = full ? '' : 'Wrap needs a 360° span.';

    // Sim widths that fit the source.
    const allowed = sizeOk ? allowedSimWidths(w) : [];
    const pick = allowed.includes(simWanted) ? simWanted
      : allowed.filter((s) => s <= simWanted).pop() ?? allowed[0];
    sim.innerHTML = allowed.map((s) => `<option value="${s}">${s} wide</option>`).join('');
    sim.disabled = allowed.length <= 1;
    if (pick !== undefined) sim.value = String(pick);
    if (sizeOk && Number.isInteger(h) && h >= MIN_SOURCE_SIZE && pick !== undefined) {
      const g = simGridSize({ sourceWidth: w, sourceHeight: h, simWidth: pick });
      simHint.textContent = `Grid ${g.width} × ${g.height} cells${w < 512 ? ' (small map: sim width equals source width)' : ''}`;
    } else {
      simHint.textContent = '';
    }

    // Square-pixel hint.
    squareHint.replaceChildren();
    if (sizeOk && h > 0 && span > 0) {
      const sq = squarePixelLatSpan(w, h, span);
      if (sq <= 180) {
        squareHint.append(`Square pixels: ±${fmt(sq / 2)}° (${fmt(sq)}° tall).`);
        const use = document.createElement('button');
        use.type = 'button';
        use.textContent = 'Use';
        use.addEventListener('click', () => {
          latTop.value = fmt(sq / 2, 4);
          latBottom.value = fmt(-sq / 2, 4);
          refresh();
        });
        squareHint.append(use);
      } else {
        squareHint.append(`Square pixels would need ${fmt(sq)}° of latitude (more than 180°), so pixels will be taller than wide in degrees.`);
      }
    }

    // Validation
    const problems = validateMapConfig(read());
    errors.replaceChildren(...problems.map((p) => Object.assign(document.createElement('li'), { textContent: p })));
    create.disabled = problems.length > 0;
  }

  preset.addEventListener('change', () => {
    const p = SIZE_PRESETS.find((x) => x.id === preset.value);
    if (p) { width.value = p.width; height.value = p.height; }
    refresh();
    if (!p) width.focus();
  });
  for (const input of [width, height]) input.addEventListener('input', () => { syncPresetFromSize(); refresh(); });
  for (const input of [latTop, latBottom, lonWest, lonSpan]) input.addEventListener('input', refresh);
  wraps.addEventListener('change', () => { wrapWanted = wraps.checked; refresh(); });
  sim.addEventListener('change', () => { simWanted = Number(sim.value); refresh(); });

  $('nm-cancel').addEventListener('click', () => dialog.close());
  dialog.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (validateMapConfig(read()).length) { refresh(); return; }
    const cfg = createMapConfig(read());
    save('newMap', { ...cfg });
    dialog.close();
    onCreate(cfg);
  });

  return {
    open(currentMap) {
      const start = { ...currentMap, ...(load('newMap', null) ?? {}) };
      width.value = start.sourceWidth;
      height.value = start.sourceHeight;
      latTop.value = start.latTop;
      latBottom.value = start.latBottom;
      lonWest.value = start.lonWest;
      lonSpan.value = start.lonSpan;
      wrapWanted = start.wraps !== false;
      simWanted = start.simWidth;
      syncPresetFromSize();
      refresh();
      dialog.showModal();
      preset.focus();
    },
  };
}
