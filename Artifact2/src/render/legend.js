// Legend panel for the current map mode. Until a mode's milestone lands it
// says when the mode arrives and that the open-ocean placeholder is shown.
// Renderers may describe their colors with a `legend`:
//   { items: [{ color, label }], columns?: [{ title, items }], note? }

import { icon } from '../ui/icons.js';
import { isAvailable, milestoneLabel } from '../ui/comingsoon.js';
import { RENDERERS } from './modes/index.js';
import { BOUNDARY_LINES } from './climateboundaries.js';

function swatchList(items) {
  const list = document.createElement('ul');
  list.className = 'legend-items';
  for (const { color, label } of items) {
    const li = document.createElement('li');
    const chip = document.createElement('span');
    chip.className = 'legend-chip';
    chip.style.background = color; // a data color from the renderer
    li.append(chip, document.createTextNode(label));
    list.append(li);
  }
  return list;
}

// Key for the Climate Boundaries toggle (M4), shown under the mode's legend
// while the toggle is on. Line colors are UI colors (CSS variables).
function boundaryKey() {
  const wrap = document.createElement('div');
  wrap.className = 'legend-overlay';
  const h = document.createElement('div');
  h.className = 'legend-col-title';
  h.textContent = 'Climate Boundaries';
  const items = BOUNDARY_LINES.map((l) => ({ color: `var(${l.cssVar})`, label: l.label }));
  const note = document.createElement('p');
  note.className = 'muted';
  note.textContent = 'Lines follow the simulation grid. Predicted ice edge: coming in M7 (needs SST).';
  wrap.append(h, swatchList(items), note);
  return wrap;
}

export function renderLegend(el, mode, overlays = {}) {
  el.replaceChildren();
  renderModeLegend(el, mode);
  if (overlays['climate-boundaries'] && isAvailable(4)) el.append(boundaryKey());
}

function renderModeLegend(el, mode) {
  const title = document.createElement('div');
  title.className = 'legend-title';
  title.innerHTML = icon(mode.icon, 18);
  title.append(document.createTextNode(mode.label));
  const blurb = document.createElement('p');
  blurb.className = 'muted';
  blurb.textContent = mode.blurb;
  el.append(title, blurb);
  if (!isAvailable(mode.milestone)) {
    const note = document.createElement('p');
    note.textContent = `Arrives in ${milestoneLabel(mode.milestone)}. Showing the open-ocean placeholder.`;
    el.append(note);
    return;
  }
  const legend = RENDERERS[mode.id]?.legend;
  if (!legend) return;
  if (legend.items) el.append(swatchList(legend.items));
  if (legend.columns) {
    const cols = document.createElement('div');
    cols.className = 'legend-columns';
    for (const c of legend.columns) {
      const col = document.createElement('div');
      const h = document.createElement('div');
      h.className = 'legend-col-title';
      h.textContent = c.title;
      col.append(h, swatchList(c.items));
      cols.append(col);
    }
    el.append(cols);
  }
  if (legend.note) {
    const note = document.createElement('p');
    note.className = 'muted';
    note.textContent = legend.note;
    el.append(note);
  }
}
