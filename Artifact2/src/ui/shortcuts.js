// The single keymap: used by the key handler, tooltips, menus, and the
// Help > Keyboard Shortcuts dialog. No DOM access at load time, so the
// guard can be tested in Node.

export const CATEGORY_KEYS = ['1', '2', '3', '4', '5'];
export const MODE_KEYS = ['q', 'w', 'e', 'r', 't', 'y', 'u'];

export const KEYS = {
  fit: '0',
  zoomIn: ['+', '='],
  zoomOut: ['-', '_'],
  goTo: 'g',
  shortcuts: '?',
  reload: 'KeyR', // physical key (event.code), with Ctrl+Shift; plain R is a mode key
};

// Rows for the shortcuts dialog.
export const SHORTCUT_ROWS = [
  ['1 – 5', 'Pick a map-mode category (Terrain, Climate, Weather, Ocean, Life)'],
  ['Q W E R T Y U', 'Pick the 1st–7th mode in the current category'],
  ['Mouse wheel / pinch', 'Zoom at the cursor'],
  ['+ / −', 'Zoom in / out'],
  ['0', 'Fit the map to the screen'],
  ['Arrow keys', 'Pan'],
  ['Drag (Navigate tool)', 'Pan'],
  ['Space + drag, middle-drag', 'Pan in any tool'],
  ['Click (Navigate tool)', 'Inspect a tile'],
  ['G', 'Go to lat/lon'],
  ['Drag (Sculpt tool)', 'Paint with the current brush'],
  ['Ctrl+Shift+R', 'Reload the last imported map image'],
  ['Ctrl+Z', 'Undo (in a text field: undo typing)'],
  ['Ctrl+Y, Ctrl+Shift+Z', 'Redo'],
  ['Esc', 'Back to the Navigate tool; leave a text field; close menus and dialogs'],
  ['?', 'Show this list'],
];

const NON_TEXT_INPUTS = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'color', 'file', 'image']);

// True when keystrokes belong to the focused element: text and number
// fields, sliders, selects, textareas, and contenteditable elements.
export function isTypingTarget(target) {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = String(target.tagName || '').toUpperCase();
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') return !NON_TEXT_INPUTS.has(String(target.type || 'text').toLowerCase());
  return false;
}

// Hotkeys never fire while typing, while a dialog is open, or with
// Alt/Meta held (those combinations belong to the browser or to
// menu shortcuts such as Ctrl+Z). Ctrl+Shift+R is permitted for reload.
export function shouldIgnoreHotkey({ target, dialogOpen = false, ctrlKey = false, altKey = false, metaKey = false, shiftKey = false, code = '' }) {
  if (dialogOpen || altKey || metaKey || isTypingTarget(target)) return true;
  // Allow Ctrl+Shift+R for reload even though ctrlKey and shiftKey are true
  if (ctrlKey && shiftKey && code === KEYS.reload) return false;
  return ctrlKey;
}

// Ctrl+Shift+R: Reload map image. Matched by physical key (event.code), so
// it works whatever the keyboard layout or Caps Lock state.
export function isReloadKey({ ctrlKey = false, shiftKey = false, altKey = false, metaKey = false, code = '' }) {
  return ctrlKey && shiftKey && !altKey && !metaKey && code === KEYS.reload;
}

// Map undo/redo from a key event: 'undo', 'redo', or null. Never while
// typing in a field (the field's own text undo runs) or with a dialog open.
export function undoAction({ key, ctrlKey = false, metaKey = false, shiftKey = false, altKey = false, target, dialogOpen = false }) {
  if (!(ctrlKey || metaKey) || altKey || dialogOpen || isTypingTarget(target)) return null;
  const k = String(key).toLowerCase();
  if (k === 'z') return shiftKey ? 'redo' : 'undo';
  if (k === 'y' && !shiftKey) return 'redo';
  return null;
}

export function modeHotkeyLabel(categoryIndex, modeIndex) {
  return `${CATEGORY_KEYS[categoryIndex]}, ${MODE_KEYS[modeIndex].toUpperCase()}`;
}
