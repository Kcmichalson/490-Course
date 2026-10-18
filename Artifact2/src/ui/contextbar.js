// Context bar: hint text or the selected tile, the active tool's controls,
// and the Planet button that slides the planet panel up from this bar.

import { icon } from './icons.js';
import { getTool } from './tools.js';

export const STARTUP_HINT = 'Import a map or paint land to begin.';

// opts: { planetPanel, planetClose, onClearSelection }
export function createContextBar(root, { planetPanel, planetClose, onClearSelection }) {
  const message = document.createElement('div');
  message.className = 'ctx-message';
  message.setAttribute('aria-live', 'polite');

  const toolArea = document.createElement('div');
  toolArea.className = 'ctx-tool';

  const planetBtn = document.createElement('button');
  planetBtn.type = 'button';
  planetBtn.className = 'planet-button';
  planetBtn.innerHTML = `${icon('planet', 16)}<span>Planet</span>`;
  planetBtn.setAttribute('aria-expanded', 'false');
  planetBtn.setAttribute('aria-controls', planetPanel.id);

  root.append(message, toolArea, planetBtn);

  const setPlanet = (open) => {
    planetPanel.classList.toggle('is-open', open);
    planetPanel.setAttribute('aria-hidden', String(!open));
    planetBtn.setAttribute('aria-expanded', String(open));
  };
  planetBtn.addEventListener('click', () => setPlanet(!planetPanel.classList.contains('is-open')));
  planetClose.innerHTML = icon('close', 16);
  planetClose.addEventListener('click', () => { setPlanet(false); planetBtn.focus(); });

  let selection = null;
  let flashTimer = 0;

  function renderMessage() {
    message.classList.remove('is-flash');
    message.replaceChildren();
    if (!selection) {
      message.textContent = STARTUP_HINT;
      return;
    }
    const text = document.createElement('span');
    text.textContent = `Selected ${selection.latLon} · sim cell ${selection.i}, ${selection.j} · monthly climate chart arrives in M6`;
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'icon-button';
    clear.innerHTML = icon('close', 14);
    clear.title = 'Clear selection';
    clear.setAttribute('aria-label', 'Clear selection');
    clear.addEventListener('click', onClearSelection);
    message.append(text, clear);
  }
  renderMessage();

  return {
    setTool(toolId) {
      const tool = getTool(toolId);
      toolArea.textContent = tool.hint ? `${tool.label}: ${tool.hint}` : tool.label;
    },
    // info: { latLon, i, j } or null
    setSelection(info) {
      selection = info;
      clearTimeout(flashTimer);
      renderMessage();
    },
    flash(text, ms = 4000) {
      clearTimeout(flashTimer);
      message.replaceChildren(text);
      message.classList.add('is-flash');
      flashTimer = setTimeout(renderMessage, ms);
    },
    isPlanetOpen: () => planetPanel.classList.contains('is-open'),
    closePlanet: () => setPlanet(false),
  };
}
