// Popup menus (menu bar dropdowns, tool dropdown) and simple popovers.
//
// Menu item: { label, shortcut?, milestone?, action?, checked?, radio?,
//              submenu?, separator? }
// `checked` may be a boolean or a function evaluated when the menu opens.
// Items from later milestones show a "M#" badge and do nothing when chosen.

import { isAvailable, comingSoonText } from './comingsoon.js';

const layer = () => document.getElementById('menu-layer');
let stack = []; // open menus by level: { el, anchor, opts, items }

export function isMenuOpen() {
  return stack.length > 0;
}

export function closeMenus({ returnFocus = false } = {}) {
  const root = stack[0];
  for (const m of stack) m.el.remove();
  stack = [];
  if (root) {
    root.opts.onClose?.();
    if (returnFocus) root.anchor.focus();
  }
}

function closeFrom(level) {
  for (const m of stack.splice(level)) m.el.remove();
}

// Opens a top-level menu under `anchor`. opts: { onClose, onArrow(dir), label }
export function showMenu(anchor, items, opts = {}) {
  closeMenus();
  const el = openLevel(0, anchor, items, opts);
  return el;
}

function openLevel(level, anchor, items, opts) {
  closeFrom(level);
  const el = buildMenu(items, level, opts);
  layer().appendChild(el);
  position(el, anchor, level === 0 ? 'below' : 'right');
  stack[level] = { el, anchor, opts, items };
  return el;
}

function position(el, anchor, where) {
  const r = anchor.getBoundingClientRect();
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  let left = where === 'below' ? r.left : r.right - 2;
  let top = where === 'below' ? r.bottom + 1 : r.top - 4;
  if (left + w > innerWidth - 4) left = where === 'below' ? innerWidth - w - 4 : r.left - w + 2;
  if (top + h > innerHeight - 4) top = Math.max(4, innerHeight - h - 4);
  el.style.left = `${Math.max(4, left)}px`;
  el.style.top = `${top}px`;
}

function buildMenu(items, level, opts) {
  const ul = document.createElement('ul');
  ul.className = 'menu';
  ul.setAttribute('role', 'menu');
  if (opts.label && level === 0) ul.setAttribute('aria-label', opts.label);

  for (const item of items) {
    const li = document.createElement('li');
    li.setAttribute('role', 'none');
    if (item.separator) {
      li.className = 'menu-sep';
      li.setAttribute('role', 'separator');
      ul.appendChild(li);
      continue;
    }
    const available = isAvailable(item.milestone);
    const checked = typeof item.checked === 'function' ? item.checked() : item.checked;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'menu-item';
    btn.tabIndex = -1;
    btn.setAttribute('role', checked === undefined ? 'menuitem' : item.radio ? 'menuitemradio' : 'menuitemcheckbox');
    if (checked !== undefined) btn.setAttribute('aria-checked', String(Boolean(checked)));
    if (item.submenu) btn.setAttribute('aria-haspopup', 'menu');
    if (!available) {
      btn.classList.add('is-coming');
      btn.setAttribute('aria-disabled', 'true');
      btn.title = comingSoonText(item.milestone);
    }

    const mark = checked ? (item.radio ? '•' : '✓') : '';
    const right = !available && !item.submenu
      ? `<span class="badge">M${item.milestone}</span>`
      : `<span class="shortcut">${item.shortcut ?? ''}</span>`;
    btn.innerHTML = `<span class="mark">${mark}</span><span class="label"></span>${right}<span class="arrow">${item.submenu ? '›' : ''}</span>`;
    btn.querySelector('.label').textContent = item.label;

    btn.addEventListener('mouseenter', () => {
      btn.focus();
      if (item.submenu) openSub(level, btn, item, opts, false);
      else closeFrom(level + 1);
    });
    btn.addEventListener('click', () => activate(level, btn, item, opts));
    li.appendChild(btn);
    ul.appendChild(li);
  }

  ul.addEventListener('keydown', (e) => onMenuKey(e, ul, level, opts));
  return ul;
}

function openSub(level, btn, item, opts, focusFirst) {
  const items = typeof item.submenu === 'function' ? item.submenu() : item.submenu;
  const el = openLevel(level + 1, btn, items, opts);
  if (focusFirst) el.querySelector('.menu-item')?.focus();
}

function activate(level, btn, item, opts) {
  if (item.submenu) { openSub(level, btn, item, opts, true); return; }
  if (!isAvailable(item.milestone)) return;
  closeMenus({ returnFocus: false });
  item.action?.();
}

function onMenuKey(e, ul, level, opts) {
  const buttons = [...ul.querySelectorAll(':scope > li > .menu-item')];
  const i = buttons.indexOf(document.activeElement);
  const move = (to) => buttons[(to + buttons.length) % buttons.length]?.focus();
  switch (e.key) {
    case 'ArrowDown': move(i + 1); break;
    case 'ArrowUp': move(i < 0 ? buttons.length - 1 : i - 1); break;
    case 'Home': move(0); break;
    case 'End': move(buttons.length - 1); break;
    case 'ArrowRight': {
      const btn = buttons[i];
      if (btn?.getAttribute('aria-haspopup')) btn.click();
      else stack[0]?.opts.onArrow?.(1);
      break;
    }
    case 'ArrowLeft':
      if (level > 0) { const parent = stack[level].anchor; closeFrom(level); parent.focus(); }
      else opts.onArrow?.(-1);
      break;
    case 'Escape':
      if (level > 0) { const parent = stack[level].anchor; closeFrom(level); parent.focus(); }
      else closeMenus({ returnFocus: true });
      break;
    case 'Tab': closeMenus(); return;
    default: return;
  }
  e.preventDefault();
  e.stopPropagation();
}

// Clicking anywhere outside open menus closes them (the root anchor handles
// its own toggle).
document.addEventListener('pointerdown', (e) => {
  if (!stack.length) return;
  if (stack.some((m) => m.el.contains(e.target))) return;
  if (stack[0].anchor.contains(e.target)) return;
  closeMenus();
}, true);
window.addEventListener('blur', () => closeMenus());
window.addEventListener('resize', () => closeMenus());

// Popover: a panel toggled by a button that stays open while you interact
// with it (checkbox lists, small forms). Closes on outside click or Esc.
export function bindPopover(button, panel, { onOpen } = {}) {
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-haspopup', 'dialog');
  panel.hidden = true;
  const isOpen = () => !panel.hidden;
  const set = (open) => {
    panel.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    if (open) onOpen?.();
  };
  button.addEventListener('click', () => set(!isOpen()));
  document.addEventListener('pointerdown', (e) => {
    if (isOpen() && !panel.contains(e.target) && !button.contains(e.target)) set(false);
  }, true);
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); set(false); button.focus(); }
  });
  return { open: () => set(true), close: () => set(false), isOpen };
}
