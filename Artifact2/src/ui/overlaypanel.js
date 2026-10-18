// Overlay toggles: a dropdown at the map's top-right corner listing every
// toggle in its group. Toggles from later milestones are disabled with
// "coming in M#".

import { icon } from './icons.js';
import { bindPopover } from './menu.js';
import { isAvailable, comingSoonText } from './comingsoon.js';
import { OVERLAY_GROUPS, OVERLAYS } from '../render/overlays.js';

// opts: { onToggle(id, on) }
export function createOverlayPanel(root, { onToggle }) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'overlay-button';
  button.innerHTML = `${icon('layers', 16)}<span>Overlays</span>${icon('caret', 14)}`;

  const panel = document.createElement('div');
  panel.className = 'popover overlay-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Overlay toggles');

  const inputs = new Map();
  for (const group of OVERLAY_GROUPS) {
    const section = document.createElement('div');
    section.className = 'overlay-group';
    section.innerHTML = `<h3>${group.label}</h3>`;
    for (const o of OVERLAYS.filter((x) => x.group === group.id)) {
      const label = document.createElement('label');
      label.className = 'check';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.addEventListener('change', () => onToggle(o.id, input.checked));
      const text = document.createElement('span');
      text.textContent = o.label;
      label.append(input, text);
      if (!isAvailable(o.milestone)) {
        input.disabled = true;
        label.classList.add('is-coming');
        label.title = comingSoonText(o.milestone);
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.textContent = `M${o.milestone}`;
        label.append(badge);
      }
      inputs.set(o.id, input);
      section.append(label);
    }
    panel.append(section);
  }

  bindPopover(button, panel);
  root.append(button, panel);

  return {
    update(overlays) {
      for (const [id, input] of inputs) input.checked = Boolean(overlays[id]);
    },
  };
}
