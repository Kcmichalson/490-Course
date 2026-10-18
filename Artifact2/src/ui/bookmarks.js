// Bookmarks: named camera views (center lat/lon + zoom %), kept in
// localStorage under fcm:bookmarks until project save (M11) stores them.

import { icon } from './icons.js';
import { bindPopover } from './menu.js';
import { load, save } from '../io/storage.js';
import { formatLatLon } from '../sim/coords.js';

const KEY = 'bookmarks';

function readAll() {
  const list = load(KEY, []);
  return Array.isArray(list)
    ? list.filter((b) => b && typeof b.name === 'string' && Number.isFinite(b.lat) && Number.isFinite(b.lon) && Number.isFinite(b.zoom))
    : [];
}

// opts: { getCurrent() → { lat, lon, zoom } | null, onGo(bookmark) }
export function createBookmarks({ getCurrent, onGo }) {
  const wrap = document.createElement('div');
  wrap.className = 'bookmarks';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'icon-button';
  button.title = 'Bookmarks (saved views)';
  button.setAttribute('aria-label', 'Bookmarks');
  button.innerHTML = `${icon('bookmark', 16)}`;

  const panel = document.createElement('div');
  panel.className = 'popover bookmark-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Bookmarks');
  panel.innerHTML = `
    <form class="bookmark-form">
      <input type="text" maxlength="60" placeholder="Name this view" aria-label="Bookmark name">
      <button type="submit">Save view</button>
    </form>
    <ul class="bookmark-list"></ul>`;
  const form = panel.querySelector('form');
  const nameInput = panel.querySelector('input');
  const listEl = panel.querySelector('ul');

  function render() {
    const list = readAll();
    listEl.replaceChildren();
    if (!list.length) {
      const li = document.createElement('li');
      li.className = 'bookmark-empty';
      li.textContent = 'No bookmarks yet.';
      listEl.append(li);
      return;
    }
    list.forEach((b, i) => {
      const li = document.createElement('li');
      const go = document.createElement('button');
      go.type = 'button';
      go.className = 'bookmark-go';
      go.innerHTML = '<span></span><small></small>';
      go.firstChild.textContent = b.name;
      go.lastChild.textContent = `${formatLatLon(b, 1)} · ${Math.round(b.zoom)}%`;
      go.addEventListener('click', () => { onGo(b); popover.close(); });
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'icon-button';
      del.innerHTML = icon('close', 14);
      del.setAttribute('aria-label', `Delete bookmark ${b.name}`);
      del.title = 'Delete';
      del.addEventListener('click', () => {
        const all = readAll();
        all.splice(i, 1);
        save(KEY, all);
        render();
      });
      li.append(go, del);
      listEl.append(li);
    });
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const current = getCurrent();
    if (!current) return;
    const all = readAll();
    const name = nameInput.value.trim() || `View ${all.length + 1}`;
    all.push({ name, ...current });
    save(KEY, all);
    nameInput.value = '';
    render();
  });

  const popover = bindPopover(button, panel, {
    onOpen: () => { render(); nameInput.focus(); },
  });
  wrap.append(button, panel);
  return { element: wrap };
}
