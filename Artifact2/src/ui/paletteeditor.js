// Palette editor (SPEC 2.5), shown in the import dialog for color palette
// images: swatch rows (color, category, elevation), an eyedropper, tolerance
// and tier-smoothing sliders, the preview view (Source / Categories /
// Result), and named presets with JSON export/import.

import {
  PALETTE_CATEGORIES, paletteCategory, defaultElevation, scanSwatches, rescanSwatches, clampMergeDE, classifyPixels,
  srgbToLab, deltaE76, hexToRgb, rgbToHex, UNMATCHED,
} from '../sim/palette.js';
import {
  PALETTE_TOLERANCE_DE, PALETTE_SMOOTH_PX, PALETTE_MERGE_DE, PALETTE_MERGE_MAX_DE, PALETTE_MAX_SWATCHES,
} from '../sim/constants.js';
import { load, save } from '../io/storage.js';
import { listPresets, savePreset, deletePreset, makePreset, presetToJson, presetFromJson } from '../io/palettepresets.js';
import { createSlider } from './slider.js';

// Categories view colors (a map-mode data palette, so it lives here).
const CATEGORY_VIEW_COLORS = {
  ignore: [120, 120, 120],
  deep: [22, 64, 118],
  shallow: [96, 160, 214],
  lake: [82, 150, 200],
  land: [110, 160, 80],
  'land-ice': [236, 242, 246],
  'sea-ice': [204, 224, 238],
};

export const DEFAULT_PALETTE = Object.freeze({ swatches: [], tolerance: PALETTE_TOLERANCE_DE, smoothing: PALETTE_SMOOTH_PX, seed: 1 });

const html = (s) => {
  const t = document.createElement('template');
  t.innerHTML = s.trim();
  return t.content.firstElementChild;
};

// opts: { onChange(what) — 'swatches' (rebuild preview) or 'view' (redraw);
//         unmatchedColor: [r, g, b]; flash(text) for messages }
export function createPaletteEditor({ onChange, unmatchedColor = [255, 0, 255], flash = () => {} }) {
  let pal = structuredClone(DEFAULT_PALETTE);
  let scanRgba = null;
  let shares = []; // matched share per swatch, from the latest Categories view
  let view = 'categories';
  let eyedropper = false;
  let highlight = -1;

  const root = document.createElement('div');
  root.className = 'palette-editor';

  const viewRow = html(`<div class="field-row" role="radiogroup" aria-label="Preview view">
      <label>Preview</label>
      <label class="check"><input type="radio" name="pal-view" value="source"> Source</label>
      <label class="check"><input type="radio" name="pal-view" value="categories"> Categories</label>
      <label class="check"><input type="radio" name="pal-view" value="result"> Result</label>
      <button type="button" class="eyedropper" aria-pressed="false" title="Click the preview to add or find a swatch color">Eyedropper</button>
    </div>`);
  const list = html('<div class="swatch-list" role="list" aria-label="Palette swatches"></div>');
  const listActions = html(`<div class="field-row">
      <button type="button" data-a="rescan" title="Replace the swatches with the most common colors of this image">Rescan colors</button>
      <span class="hint" data-a="summary"></span></div>`);
  // Scan merge: how close two colors must be (ΔE) to become one suggested
  // swatch. Remembered between imports (fcm:paletteScan).
  let mergeDE = clampMergeDE(load('paletteScan', null)?.mergeDE ?? PALETTE_MERGE_DE);
  const merge = createSlider({
    label: 'Scan merge', min: 0, max: PALETTE_MERGE_MAX_DE, step: 0.5, value: mergeDE, unit: 'ΔE',
    onInput: (v) => {
      mergeDE = clampMergeDE(v);
      save('paletteScan', { mergeDE });
      if (!scanRgba) return;
      rescan();
      changed('swatches');
    },
  });
  merge.element.title = 'Colors closer than this are merged into one suggested swatch. Raise it for noisy or anti-aliased images.';
  const tolerance = createSlider({ label: 'Tolerance', min: 1, max: 50, step: 1, value: pal.tolerance, unit: 'ΔE', onInput: (v) => { pal.tolerance = v; changed('swatches'); } });
  const smoothing = createSlider({ label: 'Tier smoothing', min: 0, max: 4, step: 1, value: pal.smoothing, unit: 'px', onInput: (v) => { pal.smoothing = v; changed('swatches'); } });
  const presetRow = html(`<div class="field-row preset-row">
      <label>Presets</label>
      <select data-a="presets" aria-label="Saved palette presets"></select>
      <button type="button" data-a="apply">Apply</button>
      <button type="button" data-a="delete">Delete</button>
      <button type="button" data-a="export">Export JSON</button>
      <button type="button" data-a="import">Import JSON…</button>
    </div>`);
  const saveRow = html(`<div class="field-row">
      <label>Save as</label>
      <input type="text" data-a="name" placeholder="Preset name" aria-label="Preset name">
      <button type="button" data-a="save">Save preset</button>
    </div>`);
  root.append(viewRow, list, listActions, merge.element, tolerance.element, smoothing.element, presetRow, saveRow);
  const a = (row, name) => row.querySelector(`[data-a="${name}"]`);

  function changed(what) {
    onChange?.(what);
  }

  // ---- View and eyedropper ----
  for (const radio of viewRow.querySelectorAll('input[name="pal-view"]')) {
    radio.addEventListener('change', () => { view = radio.value; changed('view'); });
  }
  const eyeBtn = viewRow.querySelector('.eyedropper');
  eyeBtn.addEventListener('click', () => setEyedropper(!eyedropper));
  function setEyedropper(on) {
    eyedropper = on;
    eyeBtn.setAttribute('aria-pressed', String(on));
    eyeBtn.classList.toggle('is-on', on);
  }

  // ---- Swatch rows ----
  function renderList() {
    list.replaceChildren();
    pal.swatches.forEach((s, i) => {
      const cat = paletteCategory(s.category);
      const row = html(`<div class="swatch-row" role="listitem">
          <span class="swatch-chip" aria-hidden="true"></span>
          <code class="swatch-hex"></code>
          <span class="swatch-share"></span>
          <select aria-label="Category"></select>
          <input type="number" step="10" aria-label="Elevation (m)" class="swatch-elev">
          <span class="unit">m</span>
          <button type="button" class="icon-button" aria-label="Remove swatch" title="Remove swatch">×</button>
        </div>`);
      row.querySelector('.swatch-chip').style.background = s.hex;
      row.querySelector('.swatch-hex').textContent = s.hex;
      row.querySelector('.swatch-share').textContent = shares[i] == null ? '' : `${(shares[i] * 100).toFixed(shares[i] < 0.01 ? 1 : 0)}%`;
      row.classList.toggle('is-highlight', i === highlight);
      const sel = row.querySelector('select');
      for (const c of PALETTE_CATEGORIES) sel.append(new Option(c.label, c.id, false, c.id === s.category));
      sel.addEventListener('change', () => {
        const next = paletteCategory(sel.value);
        if (next.elevation && !paletteCategory(s.category).elevation) s.elevation = defaultElevation(next.id);
        if (next.id === 'lake' && s.category !== 'lake') s.elevation = defaultElevation('lake');
        s.category = next.id;
        renderList();
        changed('swatches');
      });
      const elev = row.querySelector('.swatch-elev');
      elev.value = cat.elevation ? String(s.elevation ?? defaultElevation(s.category)) : '';
      elev.disabled = !cat.elevation;
      elev.title = cat.id === 'lake' ? 'Lake surface elevation' : 'Elevation of this land tier';
      elev.addEventListener('change', () => {
        const v = Number(elev.value);
        if (Number.isFinite(v)) { s.elevation = Math.round(v); changed('swatches'); } else elev.value = String(s.elevation);
      });
      row.querySelector('button').addEventListener('click', () => {
        pal.swatches.splice(i, 1);
        shares.splice(i, 1);
        highlight = -1;
        renderList();
        changed('swatches');
      });
      list.append(row);
    });
    const assigned = pal.swatches.filter((s) => s.category !== 'ignore').length;
    a(listActions, 'summary').textContent = `${pal.swatches.length} swatches, ${assigned} assigned.`;
    if (highlight >= 0) list.children[highlight]?.scrollIntoView({ block: 'nearest' });
  }

  a(listActions, 'rescan').addEventListener('click', () => {
    if (!scanRgba) return;
    rescan();
    changed('swatches');
  });
  // Re-scans with the current merge distance, keeping assignments made so far.
  function rescan() {
    pal.swatches = rescanSwatches(scanSwatches(scanRgba, { mergeDE }), pal.swatches, mergeDE);
    shares = [];
    highlight = -1;
    renderList();
  }

  // ---- Presets ----
  function renderPresets(selectName = null) {
    const sel = a(presetRow, 'presets');
    sel.replaceChildren();
    const presets = listPresets();
    if (!presets.length) sel.append(new Option('No saved presets', ''));
    for (const p of presets) sel.append(new Option(p.name, p.name, false, p.name === selectName));
    for (const b of ['apply', 'delete', 'export']) a(presetRow, b).disabled = !presets.length;
  }
  function applyPreset(p) {
    pal = { ...pal, swatches: structuredClone(p.swatches), tolerance: p.tolerance, smoothing: p.smoothing };
    shares = [];
    highlight = -1;
    sync();
    changed('swatches');
  }
  const selected = () => listPresets().find((p) => p.name === a(presetRow, 'presets').value);
  a(presetRow, 'apply').addEventListener('click', () => { const p = selected(); if (p) applyPreset(p); });
  a(presetRow, 'delete').addEventListener('click', () => {
    const p = selected();
    if (!p) return;
    deletePreset(p.name);
    renderPresets();
    flash(`Deleted preset "${p.name}".`);
  });
  a(presetRow, 'export').addEventListener('click', () => {
    const p = selected();
    if (!p) return;
    const url = URL.createObjectURL(new Blob([presetToJson(p)], { type: 'application/json' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: `${p.name.replace(/[^\w.-]+/g, '-')}.fcm-palette.json` });
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  a(presetRow, 'import').addEventListener('click', () => {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept: '.json,application/json' });
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        const p = presetFromJson(await file.text());
        savePreset(p);
        renderPresets(p.name);
        applyPreset(p);
        flash(`Imported preset "${p.name}".`);
      } catch (err) {
        flash(`Couldn't import ${file.name}: ${err.message}`);
      }
    });
    input.click();
  });
  a(saveRow, 'save').addEventListener('click', () => {
    const name = a(saveRow, 'name').value.trim();
    if (!name) { flash('Type a preset name first.'); a(saveRow, 'name').focus(); return; }
    if (!pal.swatches.length) { flash('There are no swatches to save.'); return; }
    if (!savePreset(makePreset(name, pal))) { flash('Couldn\'t save the preset (browser storage is unavailable or full).'); return; }
    renderPresets(name);
    flash(`Saved preset "${name}".`);
  });

  function sync() {
    for (const radio of viewRow.querySelectorAll('input[name="pal-view"]')) radio.checked = radio.value === view;
    tolerance.set(pal.tolerance);
    smoothing.set(pal.smoothing);
    renderList();
    renderPresets(a(presetRow, 'presets').value || null);
  }

  return {
    element: root,
    get view() { return view; },
    get eyedropper() { return eyedropper; },
    get() { return structuredClone(pal); },
    // Sets the palette settings; an empty swatch list is filled by a scan.
    set(settings, rgba) {
      pal = { ...structuredClone(DEFAULT_PALETTE), ...structuredClone(settings ?? {}) };
      scanRgba = rgba;
      shares = [];
      highlight = -1;
      setEyedropper(false);
      if (!pal.swatches.length && rgba) rescan();
      sync();
    },
    // Eyedropper pick: highlights a swatch within the scan merge distance of
    // the color, or adds a new (Ignore) swatch for it.
    pick(r, g, b) {
      const lab = srgbToLab(r, g, b);
      const idx = pal.swatches.findIndex((s) => deltaE76(srgbToLab(...hexToRgb(s.hex)), lab) <= mergeDE);
      if (idx >= 0) {
        highlight = idx;
        renderList();
        return;
      }
      if (pal.swatches.length >= PALETTE_MAX_SWATCHES * 2) { flash('That\'s a lot of swatches; remove some first.'); return; }
      pal.swatches.push({ hex: rgbToHex(r, g, b), category: 'ignore', elevation: defaultElevation('land') });
      highlight = pal.swatches.length - 1;
      renderList();
      changed('swatches');
    },
    // Categories view: each pixel in its swatch category's color, unmatched
    // in magenta. Also updates each swatch's matched share.
    categoriesImage(rgba) {
      const { index, unmatched } = classifyPixels(rgba, pal.swatches, pal.tolerance);
      const out = new Uint8ClampedArray(rgba.length);
      const counts = new Array(pal.swatches.length).fill(0);
      const colors = pal.swatches.map((s) => CATEGORY_VIEW_COLORS[s.category] ?? CATEGORY_VIEW_COLORS.ignore);
      for (let i = 0, p = 0; i < index.length; i++, p += 4) {
        const k = index[i];
        const c = k === UNMATCHED ? unmatchedColor : colors[k];
        if (k !== UNMATCHED) counts[k]++;
        out[p] = c[0]; out[p + 1] = c[1]; out[p + 2] = c[2]; out[p + 3] = 255;
      }
      shares = counts.map((c) => c / index.length);
      renderList();
      return { rgba: out, unmatchedShare: unmatched / index.length };
    },
  };
}
