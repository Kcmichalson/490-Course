// Menu bar: File / Edit / View / Tools / Help. Each menu's items are built
// fresh when it opens, so check marks always reflect the current state.

import { showMenu, closeMenus, isMenuOpen } from './menu.js';

// menus: [{ label, items: () => MenuItem[] }]
export function createMenuBar(root, menus) {
  let openIndex = -1;
  const buttons = menus.map((menu, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'menubar-item';
    btn.textContent = menu.label;
    btn.setAttribute('role', 'menuitem');
    btn.setAttribute('aria-haspopup', 'menu');
    btn.setAttribute('aria-expanded', 'false');
    btn.tabIndex = i === 0 ? 0 : -1;

    btn.addEventListener('click', () => {
      if (openIndex === i) closeMenus();
      else open(i, false);
    });
    btn.addEventListener('mouseenter', () => {
      if (openIndex !== -1 && openIndex !== i && isMenuOpen()) open(i, false);
    });
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(i, true); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); focusButton(i + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); focusButton(i - 1); }
    });
    root.appendChild(btn);
    return btn;
  });

  function focusButton(i) {
    const n = buttons.length;
    const b = buttons[(i + n) % n];
    buttons.forEach((x) => { x.tabIndex = x === b ? 0 : -1; });
    b.focus();
  }

  function open(i, focusFirst) {
    const n = buttons.length;
    i = (i + n) % n;
    const btn = buttons[i];
    const el = showMenu(btn, menus[i].items(), {
      label: menus[i].label,
      onArrow: (dir) => open(i + dir, true),
      onClose: () => {
        btn.setAttribute('aria-expanded', 'false');
        if (openIndex === i) openIndex = -1;
      },
    });
    openIndex = i;
    btn.setAttribute('aria-expanded', 'true');
    if (focusFirst) el.querySelector('.menu-item')?.focus();
  }
}
