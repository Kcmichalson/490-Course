// Import dialog (SPEC 2.3–2.6): choose the image type, the map extent, and
// type-specific settings, with a live preview computed in the worker at
// ≤ 1024 px wide. The full-resolution import is done by the caller.

import { pickImageFile, imageSize, fitWithinMax, decodeImage, readPixels } from '../io/imagefile.js';
import { luminance, grayHistogram, detectLevels } from '../sim/heightmap.js';
import { guessImageKind, detectSilhouetteMode, describeGuess } from '../sim/silhouette.js';
import { allowedSimWidths } from '../sim/mapconfig.js';
import { DEFAULT_MAX_HEIGHT_M, DEFAULT_MAX_DEPTH_M, SMOOTH_RADIUS_PX } from '../sim/constants.js';
import { PHYSICAL_STOPS, buildLut, terrainToRGBA } from '../render/colorramps.js';
import { makeTerrain, landMask } from '../sim/terrain.js';
import { createExtentFields } from './extentfields.js';
import { createSlider } from './slider.js';
import { load, save } from '../io/storage.js';

const PREVIEW_MAX_W = 1024;

export const DEFAULT_SETTINGS = {
  heightmap: {
    seaLevel: 'auto', highest: 'auto', maxHeight: DEFAULT_MAX_HEIGHT_M, gamma: 1,
    depthMode: 'auto', maxDepth: DEFAULT_MAX_DEPTH_M, smoothing: SMOOTH_RADIUS_PX,
    mask: { mode: 'threshold', threshold: 128, invert: false }, seed: 1,
  },
  silhouette: { mode: 'auto', threshold: 128, invert: false, autoRelief: true, seed: 1 },
};

const el = (html) => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};

// opts: { worker, getCurrentMap(), getEditCount() (edited tiles, 0 = none),
//         onImport(payload) → Promise }
export function createImportDialog(dialog, { worker, getCurrentMap, getEditCount = () => 0, onImport }) {
  dialog.innerHTML = `
    <form method="dialog" class="import-form" novalidate>
      <h2>Import map image</h2>
      <p class="muted" data-r="file"></p>
      <ul class="notices" data-r="notices"></ul>
      <div class="import-body">
        <div class="import-preview">
          <canvas data-r="preview" aria-label="Preview of the imported terrain"></canvas>
          <p class="hint" data-r="previewStatus"></p>
        </div>
        <div class="import-settings">
          <fieldset>
            <legend>Image type</legend>
            <div class="field-row">
              <label class="check"><input type="radio" name="kind" value="heightmap"> Grayscale heightmap</label>
              <label class="check"><input type="radio" name="kind" value="silhouette"> Silhouette (land/ocean)</label>
              <label class="check is-coming" title="Coming in M2b"><input type="radio" name="kind" value="palette" disabled> Color palette <span class="badge">M2b</span></label>
            </div>
            <p class="hint" data-r="guess"></p>
          </fieldset>
          <fieldset><legend>Map extent</legend><div data-r="extent"></div></fieldset>
          <fieldset data-r="hm"><legend>Heightmap</legend></fieldset>
          <fieldset data-r="sil"><legend>Silhouette</legend></fieldset>
        </div>
      </div>
      <ul class="errors" data-r="errors" aria-live="polite"></ul>
      <div class="dialog-actions">
        <label class="check keep-edits" data-r="keepRow" title="Your brush edits are kept as a layer on top of the new import (same image size only).">
          <input type="checkbox" data-r="keep" checked> Keep brush edits</label>
        <span class="busy" data-r="busy" aria-live="polite"></span>
        <button type="button" data-r="cancel">Cancel</button>
        <button type="submit" class="primary" data-r="import">Import</button>
      </div>
    </form>`;
  const r = (name) => dialog.querySelector(`[data-r="${name}"]`);
  const canvas = r('preview');
  const lut = buildLut(PHYSICAL_STOPS);

  let job = null; // { file, handle, natural, mapSize, previewSize, previewRgba, levels, guess, mask }
  let kind = 'silhouette';
  let settings = structuredClone(DEFAULT_SETTINGS);
  let previewToken = 0;
  let previewTimer = 0;
  let busy = false;

  const extent = createExtentFields(r('extent'), { onChange: () => { validate(); schedulePreview(); } });

  // ---- Heightmap controls ----
  const hm = r('hm');
  const seaRow = el(`<div class="field-row">
      <label>Sea level value</label>
      <label class="check"><input type="checkbox" data-c="seaAuto"> Auto</label>
      <input type="number" min="0" max="255" step="1" data-c="sea" aria-label="Sea level gray value">
      <span class="hint" data-c="seaHint"></span></div>`);
  const highRow = el(`<div class="field-row">
      <label>Highest value</label>
      <label class="check"><input type="checkbox" data-c="highAuto"> Auto</label>
      <input type="number" min="0" max="255" step="1" data-c="high" aria-label="Highest gray value">
      <span class="hint" data-c="highHint"></span></div>`);
  const c = (row, name) => row.querySelector(`[data-c="${name}"]`);
  const maxHeight = createSlider({ label: 'Max height', min: 100, max: 10000, step: 50, value: 5000, unit: 'm', onInput: (v) => update('heightmap', { maxHeight: v }) });
  const gamma = createSlider({ label: 'Curve', min: 0.2, max: 3, step: 0.05, value: 1, onInput: (v) => update('heightmap', { gamma: v }) });
  const depthRow = el(`<div class="field-row"><label>Depths</label>
      <select data-c="depthMode" aria-label="Ocean depths">
        <option value="auto">Auto</option><option value="linear">From the image (linear)</option><option value="generate">Generated</option>
      </select><span class="hint" data-c="depthHint"></span></div>`);
  const maxDepth = createSlider({ label: 'Max depth', min: -11000, max: -100, step: 100, value: -6000, unit: 'm', onInput: (v) => update('heightmap', { maxDepth: v }) });
  const smoothing = createSlider({ label: 'Smoothing', min: 0, max: 4, step: 1, value: 1, unit: 'px', onInput: (v) => update('heightmap', { smoothing: v }) });
  const maskRow = el(`<div class="field-row"><label>Land/sea mask</label>
      <button type="button" data-c="maskPick">Add mask image…</button>
      <span class="hint" data-c="maskName">None</span>
      <button type="button" data-c="maskClear" hidden>Remove</button></div>`);
  const maskThreshold = createSlider({ label: 'Mask threshold', min: 0, max: 255, step: 1, value: 128, onInput: (v) => update('heightmap', { mask: { ...settings.heightmap.mask, threshold: v } }) });
  const maskInvertRow = el(`<div class="field-row"><label class="check"><input type="checkbox" data-c="maskInvert"> Invert mask (dark = land)</label></div>`);
  hm.append(seaRow, highRow, maxHeight.element, gamma.element, depthRow, maxDepth.element, smoothing.element, maskRow, maskThreshold.element, maskInvertRow);

  c(seaRow, 'seaAuto').addEventListener('change', (e) => update('heightmap', { seaLevel: e.target.checked ? 'auto' : (job?.levels.seaLevel ?? job?.levels.darkest + 1 ?? 1) }));
  c(seaRow, 'sea').addEventListener('change', (e) => update('heightmap', { seaLevel: clampByte(e.target.value) }));
  c(highRow, 'highAuto').addEventListener('change', (e) => update('heightmap', { highest: e.target.checked ? 'auto' : (job?.levels.highest ?? 255) }));
  c(highRow, 'high').addEventListener('change', (e) => update('heightmap', { highest: clampByte(e.target.value) }));
  c(depthRow, 'depthMode').addEventListener('change', (e) => update('heightmap', { depthMode: e.target.value }));
  c(maskRow, 'maskPick').addEventListener('click', pickMask);
  c(maskRow, 'maskClear').addEventListener('click', () => { if (job) job.mask = null; syncControls(); schedulePreview(); });
  c(maskInvertRow, 'maskInvert').addEventListener('change', (e) => update('heightmap', { mask: { ...settings.heightmap.mask, invert: e.target.checked } }));

  // ---- Silhouette controls ----
  const sil = r('sil');
  const modeRow = el(`<div class="field-row"><label>Land from</label>
      <select data-c="mode" aria-label="Land detection">
        <option value="auto">Auto</option><option value="alpha">Transparency (opaque = land)</option><option value="threshold">Brightness (bright = land)</option>
      </select><span class="hint" data-c="modeHint"></span></div>`);
  const threshold = createSlider({ label: 'Threshold', min: 0, max: 255, step: 1, value: 128, onInput: (v) => update('silhouette', { threshold: v }) });
  const silChecks = el(`<div class="field-row">
      <label class="check"><input type="checkbox" data-c="invert"> Invert (dark = land)</label>
      <label class="check"><input type="checkbox" data-c="relief"> Auto-generate interior elevation</label>
      <label>Seed</label><input type="number" step="1" data-c="seed" aria-label="Relief seed" class="seed-input"></div>`);
  sil.append(modeRow, threshold.element, silChecks);
  c(modeRow, 'mode').addEventListener('change', (e) => update('silhouette', { mode: e.target.value }));
  c(silChecks, 'invert').addEventListener('change', (e) => update('silhouette', { invert: e.target.checked }));
  c(silChecks, 'relief').addEventListener('change', (e) => update('silhouette', { autoRelief: e.target.checked }));
  c(silChecks, 'seed').addEventListener('change', (e) => update('silhouette', { seed: Math.round(Number(e.target.value) || 1) }));

  for (const radio of dialog.querySelectorAll('input[name="kind"]')) {
    radio.addEventListener('change', () => { kind = radio.value; syncControls(); validate(); schedulePreview(); });
  }
  r('cancel').addEventListener('click', () => { if (!busy) dialog.close(); });
  dialog.addEventListener('cancel', (e) => { if (busy) e.preventDefault(); });
  dialog.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); submit(); });

  function clampByte(v) {
    return Math.min(255, Math.max(0, Math.round(Number(v) || 0)));
  }

  function update(which, patch) {
    settings[which] = { ...settings[which], ...patch };
    syncControls();
    validate();
    schedulePreview();
  }

  function resolvedSilMode() {
    return settings.silhouette.mode === 'auto' ? detectSilhouetteMode(job.previewRgba) : settings.silhouette.mode;
  }

  function syncControls() {
    if (!job) return;
    for (const radio of dialog.querySelectorAll('input[name="kind"]')) radio.checked = radio.value === kind;
    hm.hidden = kind !== 'heightmap';
    sil.hidden = kind !== 'silhouette';
    const h = settings.heightmap;
    const lv = job.levels;
    const seaAuto = h.seaLevel === 'auto';
    c(seaRow, 'seaAuto').checked = seaAuto;
    c(seaRow, 'sea').disabled = seaAuto;
    c(seaRow, 'sea').value = seaAuto ? (lv.seaLevel ?? '') : h.seaLevel;
    c(seaRow, 'seaHint').textContent = lv.seaLevel == null
      ? `No flat ocean found (darkest ${lv.darkest}); set it by hand.`
      : `Detected ${lv.seaLevel} (flat ocean at ${lv.darkest}).`;
    const highAuto = h.highest === 'auto';
    c(highRow, 'highAuto').checked = highAuto;
    c(highRow, 'high').disabled = highAuto;
    c(highRow, 'high').value = highAuto ? lv.highest : h.highest;
    c(highRow, 'highHint').textContent = `Brightest ${lv.highest}`;
    maxHeight.set(h.maxHeight);
    gamma.set(h.gamma);
    c(depthRow, 'depthMode').value = h.depthMode;
    const depthMode = h.depthMode === 'auto' ? (lv.flatOcean ? 'generate' : 'linear') : h.depthMode;
    c(depthRow, 'depthHint').textContent = h.depthMode === 'auto' ? `→ ${depthMode === 'generate' ? 'generated' : 'from the image'}` : '';
    maxDepth.set(h.maxDepth);
    maxDepth.setDisabled(depthMode !== 'linear');
    smoothing.set(h.smoothing);
    c(maskRow, 'maskName').textContent = job.mask ? `${job.mask.file.name}${job.mask.resized ? ' (scaled to the heightmap size)' : ''}` : 'None';
    c(maskRow, 'maskClear').hidden = !job.mask;
    maskThreshold.set(h.mask.threshold);
    maskThreshold.setDisabled(!job.mask);
    c(maskInvertRow, 'maskInvert').checked = h.mask.invert;
    c(maskInvertRow, 'maskInvert').disabled = !job.mask;

    const s = settings.silhouette;
    c(modeRow, 'mode').value = s.mode;
    c(modeRow, 'modeHint').textContent = s.mode === 'auto' ? `→ ${resolvedSilMode() === 'alpha' ? 'transparency' : 'brightness'}` : '';
    threshold.set(s.threshold);
    c(silChecks, 'invert').checked = s.invert;
    c(silChecks, 'relief').checked = s.autoRelief;
    c(silChecks, 'seed').value = s.seed;
    renderNotices();
  }

  function renderNotices() {
    const list = r('notices');
    list.replaceChildren();
    const add = (text) => list.append(Object.assign(document.createElement('li'), { textContent: text }));
    if (job.mapSize.scale < 1) {
      add(`This image is ${job.natural.width} × ${job.natural.height}, larger than the 8192 × 4096 maximum. It will be downscaled to ${job.mapSize.width} × ${job.mapSize.height}. Cancel to keep the original untouched.`);
    }
    if (kind === 'heightmap' && job.guess.isColor) add('Color image: the heightmap uses its brightness. Color palette import arrives in M2b.');
    if (job.mask?.resized) add(`The mask is ${job.mask.natural.width} × ${job.mask.natural.height}; it is scaled to ${job.mapSize.width} × ${job.mapSize.height} to match the heightmap.`);
  }

  // Edits are in source pixels, so they can only be kept at the same size.
  function canKeepEdits() {
    const cur = getCurrentMap();
    return Boolean(job) && getEditCount() > 0
      && job.mapSize.width === cur.sourceWidth && job.mapSize.height === cur.sourceHeight;
  }

  function heightmapNeedsSeaLevel() {
    return kind === 'heightmap' && settings.heightmap.seaLevel === 'auto' && job.levels.seaLevel == null;
  }

  function validate() {
    if (!job) return [];
    const problems = [...extent.errors()];
    if (heightmapNeedsSeaLevel()) problems.push('Set the sea level value: this image has no flat ocean to detect it from.');
    r('errors').replaceChildren(...problems.map((p) => Object.assign(document.createElement('li'), { textContent: p })));
    r('import').disabled = busy || problems.length > 0;
    return problems;
  }

  function schedulePreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(runPreview, 150);
  }

  function workerSettings() {
    if (kind === 'heightmap') return { ...settings.heightmap };
    return { ...settings.silhouette, mode: resolvedSilMode() };
  }

  async function runPreview() {
    if (!job || validate().length) return;
    const token = ++previewToken;
    const { width, height } = job.previewSize;
    const full = extent.get();
    const cfg = { ...full, sourceWidth: width, sourceHeight: height, simWidth: allowedSimWidths(width).at(-1) };
    r('previewStatus').textContent = 'Updating preview…';
    try {
      const rgba = job.previewRgba.slice();
      const maskRgba = kind === 'heightmap' && job.mask ? job.mask.previewRgba.slice() : null;
      const transfer = [rgba.buffer];
      if (maskRgba) transfer.push(maskRgba.buffer);
      const result = await worker.request('build', { kind, rgba, maskRgba, settings: workerSettings(), cfg }, transfer);
      if (token !== previewToken) return;
      drawPreview(result.elevation, result.category, width, height);
      const pct = Math.round(result.info.landFraction * 100);
      r('previewStatus').textContent = `Preview at ${width} × ${height}: ${pct}% land. The full import uses ${job.mapSize.width} × ${job.mapSize.height}.`;
    } catch (err) {
      if (token === previewToken) r('previewStatus').textContent = err.message;
    }
  }

  // Physical colors with the coastline outlined in white.
  function drawPreview(elevation, category, w, h) {
    canvas.width = w;
    canvas.height = h;
    const terrain = makeTerrain(w, h, elevation, category);
    const rgba = terrainToRGBA(terrain, lut);
    const land = landMask(terrain);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!land[i]) continue;
        const coast = (x > 0 && !land[i - 1]) || (x < w - 1 && !land[i + 1])
          || (y > 0 && !land[i - w]) || (y < h - 1 && !land[i + w]);
        if (coast) rgba.set([255, 255, 255, 255], i * 4);
      }
    }
    canvas.getContext('2d').putImageData(new ImageData(rgba, w, h), 0, 0);
  }

  async function pickMask() {
    const picked = await pickImageFile();
    if (!picked || !job) return;
    try {
      const natural = await imageSize(picked.file);
      const { width, height } = job.mapSize;
      const preview = await decodeImage(picked.file, job.previewSize.width, job.previewSize.height, 'pixelated');
      job.mask = {
        file: picked.file,
        handle: picked.handle,
        natural,
        resized: natural.width !== width || natural.height !== height,
        previewRgba: readPixels(preview),
      };
      preview.close();
      syncControls();
      schedulePreview();
    } catch (err) {
      r('errors').replaceChildren(Object.assign(document.createElement('li'), { textContent: err.message }));
    }
  }

  async function submit() {
    if (busy || !job || validate().length) return;
    busy = true;
    r('import').disabled = true;
    r('cancel').disabled = true;
    const started = performance.now();
    const tick = setInterval(() => { r('busy').textContent = `Importing… ${Math.round((performance.now() - started) / 1000)} s`; }, 250);
    r('busy').textContent = 'Importing…';
    try {
      const cfgValues = extent.get();
      await onImport({
        kind,
        file: job.file,
        handle: job.handle,
        natural: job.natural,
        settings: workerSettings(),
        storedSettings: structuredClone(settings),
        cfgValues,
        mask: kind === 'heightmap' && job.mask ? { file: job.mask.file, handle: job.mask.handle } : null,
        keepEdits: canKeepEdits() && r('keep').checked,
      });
      save('importExtent', { latTop: cfgValues.latTop, latBottom: cfgValues.latBottom, lonWest: cfgValues.lonWest, lonSpan: cfgValues.lonSpan, wraps: cfgValues.wraps, simWidth: cfgValues.simWidth });
      save('importSettings', settings);
      dialog.close();
    } catch (err) {
      r('errors').replaceChildren(Object.assign(document.createElement('li'), { textContent: `Import failed: ${err.message}` }));
    } finally {
      clearInterval(tick);
      busy = false;
      r('busy').textContent = '';
      r('cancel').disabled = false;
      validate();
    }
  }

  // Opens the dialog for a file. prefill: { kind, storedSettings, cfgValues } (Reload with a new size).
  async function open({ file, handle = null, prefill = null }) {
    const natural = await imageSize(file);
    const mapSize = fitWithinMax(natural.width, natural.height);
    const pw = Math.min(PREVIEW_MAX_W, mapSize.width);
    const previewSize = { width: pw, height: Math.max(1, Math.round((pw * mapSize.height) / mapSize.width)) };
    const bmp = await decodeImage(file, previewSize.width, previewSize.height);
    const previewRgba = readPixels(bmp);
    bmp.close();
    const guess = guessImageKind(previewRgba);
    const levels = detectLevels(grayHistogram(luminance(previewRgba)));
    job = { file, handle, natural, mapSize, previewSize, previewRgba, guess, levels, mask: null };

    const stored = load('importSettings', null);
    settings = structuredClone(prefill?.storedSettings ?? DEFAULT_SETTINGS);
    if (!prefill && stored) {
      settings.heightmap = { ...settings.heightmap, ...stored.heightmap };
      settings.silhouette = { ...settings.silhouette, ...stored.silhouette };
    }
    kind = prefill?.kind ?? guess.kind;
    const cur = getCurrentMap();
    const lastExtent = prefill?.cfgValues ?? load('importExtent', null) ?? cur;
    extent.set({ ...cur, ...lastExtent }, mapSize.width, mapSize.height);

    r('file').textContent = `${file.name} · ${natural.width} × ${natural.height} px`;
    r('guess').textContent = describeGuess(guess);
    canvas.width = previewSize.width;
    canvas.height = previewSize.height;
    r('errors').replaceChildren();
    r('keepRow').hidden = !canKeepEdits();
    r('keep').checked = true;
    syncControls();
    validate();
    if (!dialog.open) dialog.showModal();
    runPreview();
  }

  return {
    async openFromPicker() {
      const picked = await pickImageFile();
      if (picked) await open(picked);
    },
    open,
  };
}
