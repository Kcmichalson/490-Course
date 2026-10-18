// Legend panel for the current map mode. Until a mode's milestone lands it
// says when the mode arrives and that the open-ocean placeholder is shown.

import { icon } from '../ui/icons.js';
import { isAvailable } from '../ui/comingsoon.js';

export function renderLegend(el, mode) {
  el.replaceChildren();
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
    note.textContent = `Arrives in M${mode.milestone}. Showing the open-ocean placeholder.`;
    el.append(note);
  }
}
