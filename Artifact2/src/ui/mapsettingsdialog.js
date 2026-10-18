// Edit > Map settings: change the latitude range, west-edge longitude, span,
// wrap, and sim width of the current map without re-importing. The pixel size
// stays fixed. The caller re-runs the import pipeline (or, for a blank map,
// just applies the new extent).

import { createExtentFields } from './extentfields.js';

// opts: { onApply(cfgValues) → Promise }
export function createMapSettingsDialog(dialog, { onApply }) {
  dialog.innerHTML = `
    <form method="dialog" novalidate>
      <h2>Map settings</h2>
      <p class="muted" data-r="note"></p>
      <fieldset><legend>Map extent</legend><div data-r="extent"></div></fieldset>
      <ul class="errors" data-r="errors" aria-live="polite"></ul>
      <div class="dialog-actions">
        <span class="busy" data-r="busy" aria-live="polite"></span>
        <button type="button" data-r="cancel">Cancel</button>
        <button type="submit" class="primary" data-r="apply">Apply</button>
      </div>
    </form>`;
  const r = (name) => dialog.querySelector(`[data-r="${name}"]`);
  let busy = false;
  const extent = createExtentFields(r('extent'), { onChange: validate });

  function validate() {
    const problems = extent.errors();
    r('errors').replaceChildren(...problems.map((p) => Object.assign(document.createElement('li'), { textContent: p })));
    r('apply').disabled = busy || problems.length > 0;
    return problems;
  }

  r('cancel').addEventListener('click', () => { if (!busy) dialog.close(); });
  dialog.addEventListener('cancel', (e) => { if (busy) e.preventDefault(); });
  dialog.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy || validate().length) return;
    busy = true;
    r('apply').disabled = true;
    r('busy').textContent = 'Applying…';
    try {
      await onApply(extent.get());
      dialog.close();
    } catch (err) {
      r('errors').replaceChildren(Object.assign(document.createElement('li'), { textContent: err.message }));
    } finally {
      busy = false;
      r('busy').textContent = '';
      validate();
    }
  });

  return {
    // hasSource: whether an imported image will be re-processed.
    open(map, hasSource) {
      r('note').textContent = hasSource
        ? 'Applying re-runs the import with the same settings (generated depths and relief depend on distances in km).'
        : 'Blank map: the new extent is applied directly.';
      extent.set(map, map.sourceWidth, map.sourceHeight);
      validate();
      dialog.showModal();
    },
  };
}
