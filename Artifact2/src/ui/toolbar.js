// Toolbar: tool dropdown, "View: <mode>" label, category tabs, the active
// category's mode icons, season controls, zoom, Go to lat/lon, Bookmarks.

import { icon } from './icons.js';
import { showMenu, closeMenus, isMenuOpen } from './menu.js';
import { applyComingSoon, isAvailable, milestoneLabel } from './comingsoon.js';
import { CATEGORIES, modesInCategory, getMode } from '../render/modes.js';
import { CATEGORY_KEYS, modeHotkeyLabel } from './shortcuts.js';
import { getTool } from './tools.js';
import { createBookmarks } from './bookmarks.js';

const el = (tag, props = {}, html = '') => {
  const e = Object.assign(document.createElement(tag), props);
  if (html) e.innerHTML = html;
  return e;
};

// handlers: { toolMenuItems(), onCategory(id), onMode(id), onZoomIn(), onZoomOut(),
//             onZoomInput(percent), onGoTo(text) → bool, bookmarks: {...} }
export function createToolbar(root, handlers) {
  // Tool dropdown
  const toolGroup = el('div', { className: 'tb-group' });
  const toolBtn = el('button', { type: 'button', className: 'tool-button', title: 'Current tool' });
  toolBtn.setAttribute('aria-haspopup', 'menu');
  toolBtn.setAttribute('aria-expanded', 'false');
  toolBtn.addEventListener('click', () => {
    if (isMenuOpen() && toolBtn.getAttribute('aria-expanded') === 'true') { closeMenus(); return; }
    openToolMenu(false);
  });
  toolBtn.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); openToolMenu(true); }
  });
  function openToolMenu(focusFirst) {
    const menu = showMenu(toolBtn, handlers.toolMenuItems(), {
      label: 'Tools',
      onClose: () => toolBtn.setAttribute('aria-expanded', 'false'),
    });
    toolBtn.setAttribute('aria-expanded', 'true');
    if (focusFirst) menu.querySelector('.menu-item')?.focus();
  }
  toolGroup.append(toolBtn);

  // View label
  const viewLabel = el('div', { className: 'view-label' });
  viewLabel.setAttribute('aria-live', 'polite');

  // Category tabs + mode grid
  const tabs = el('div', { className: 'cat-tabs' });
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Map mode categories');
  const tabButtons = CATEGORIES.map((c, i) => {
    const b = el('button', { type: 'button', className: 'cat-tab', title: `${c.label} (${CATEGORY_KEYS[i]})` },
      `${icon(c.icon, 16)}<span class="label">${c.label}</span><span class="key">${CATEGORY_KEYS[i]}</span>`);
    b.setAttribute('role', 'tab');
    b.dataset.category = c.id;
    b.addEventListener('click', () => handlers.onCategory(c.id));
    tabs.append(b);
    return b;
  });
  const grid = el('div', { className: 'mode-grid' });
  grid.setAttribute('role', 'tabpanel');
  let gridCategory = null;

  function renderGrid(categoryId) {
    gridCategory = categoryId;
    grid.replaceChildren();
    const ci = CATEGORIES.findIndex((c) => c.id === categoryId);
    grid.setAttribute('aria-label', `${CATEGORIES[ci].label} map modes`);
    modesInCategory(categoryId).forEach((m, mi) => {
      const status = isAvailable(m.milestone) ? 'available' : `arrives in ${milestoneLabel(m.milestone)}`;
      const b = el('button', {
        type: 'button',
        className: `mode-button${isAvailable(m.milestone) ? '' : ' is-placeholder'}`,
        title: `${m.label} — ${status}\nHotkey: ${modeHotkeyLabel(ci, mi)}`,
      }, icon(m.icon, 20));
      b.setAttribute('aria-label', `${m.label} (${status})`);
      b.dataset.mode = m.id;
      b.addEventListener('click', () => handlers.onMode(m.id));
      grid.append(b);
    });
  }

  // Season (M3) and playback (M11)
  const seasonGroup = el('div', { className: 'tb-group' });
  const season = el('select', { 'aria-label': 'Season' }, '<option>Annual Mean</option>');
  season.setAttribute('aria-label', 'Season');
  applyComingSoon(season, 3, 'Season selector');
  const play = el('button', { type: 'button', className: 'icon-button' }, icon('play', 16));
  play.setAttribute('aria-label', 'Play the year');
  applyComingSoon(play, 11, 'Season playback');
  seasonGroup.append(season, play);

  // Zoom
  const zoomGroup = el('div', { className: 'tb-group' });
  const zoomOut = el('button', { type: 'button', className: 'icon-button', title: 'Zoom out (−)' }, '−');
  zoomOut.setAttribute('aria-label', 'Zoom out');
  const zoomIn = el('button', { type: 'button', className: 'icon-button', title: 'Zoom in (+)' }, '+');
  zoomIn.setAttribute('aria-label', 'Zoom in');
  const zoomInput = el('input', { type: 'text', className: 'zoom-input', inputMode: 'decimal', title: 'Zoom percentage; type a value and press Enter' });
  zoomInput.setAttribute('aria-label', 'Zoom percentage');
  zoomOut.addEventListener('click', handlers.onZoomOut);
  zoomIn.addEventListener('click', handlers.onZoomIn);
  const applyZoomInput = () => {
    const v = parseFloat(zoomInput.value);
    if (Number.isFinite(v) && v > 0) handlers.onZoomInput(v);
  };
  zoomInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { applyZoomInput(); zoomInput.blur(); }
  });
  zoomInput.addEventListener('change', applyZoomInput);
  zoomInput.addEventListener('focus', () => zoomInput.select());
  zoomGroup.append(zoomOut, zoomInput, zoomIn);

  // Go to lat/lon
  const goForm = el('form', { className: 'tb-group' });
  const goInput = el('input', { type: 'text', className: 'goto-input', placeholder: 'Go to lat, lon', title: 'Examples: 45N 30W · 45.5, -30 · 12S 100E (G)' });
  goInput.setAttribute('aria-label', 'Go to latitude and longitude');
  const goBtn = el('button', { type: 'submit' }, 'Go');
  goForm.append(goInput, goBtn);
  goForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const ok = handlers.onGoTo(goInput.value);
    goInput.setAttribute('aria-invalid', String(!ok));
    if (ok) goInput.blur();
  });
  goInput.addEventListener('input', () => goInput.removeAttribute('aria-invalid'));

  // Bookmarks
  const bookmarks = createBookmarks(handlers.bookmarks);

  const sep = () => el('div', { className: 'tb-sep' });
  root.append(toolGroup, sep(), viewLabel, tabs, grid, el('div', { className: 'tb-spacer' }),
    seasonGroup, sep(), zoomGroup, goForm, bookmarks.element);

  return {
    update(state) {
      const tool = getTool(state.toolId);
      toolBtn.innerHTML = `${icon(tool.icon, 18)}<span>${tool.label}</span>${icon('caret', 14).replace('class="icon"', 'class="icon caret-icon"')}`;
      toolBtn.setAttribute('aria-label', `Tool: ${tool.label}`);

      const mode = getMode(state.modeId);
      viewLabel.innerHTML = 'View: <strong></strong>';
      viewLabel.querySelector('strong').textContent = mode.label;

      for (const b of tabButtons) {
        const on = b.dataset.category === state.categoryId;
        b.setAttribute('aria-selected', String(on));
        b.tabIndex = on ? 0 : -1;
      }
      if (gridCategory !== state.categoryId) renderGrid(state.categoryId);
      for (const b of grid.children) b.setAttribute('aria-pressed', String(b.dataset.mode === state.modeId));
    },
    setZoom(percent) {
      if (document.activeElement === zoomInput) return;
      const text = percent >= 100 ? `${Math.round(percent)}%` : `${percent.toFixed(percent < 10 ? 1 : 0)}%`;
      if (zoomInput.value !== text) zoomInput.value = text;
    },
    focusGoTo() {
      goInput.focus();
      goInput.select();
    },
  };
}
