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
  reload: 'R', // with Shift; plain R is a mode key
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
  ['Shift+R', 'Reload the last imported map image'],
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
// Ctrl/Alt/Meta held (those combinations belong to the browser or to
// menu shortcuts such as Ctrl+Z).
export function shouldIgnoreHotkey({ target, dialogOpen = false, ctrlKey = false, altKey = false, metaKey = false }) {
  return dialogOpen || ctrlKey || altKey || metaKey || isTypingTarget(target);
}

export function modeHotkeyLabel(categoryIndex, modeIndex) {
  return `${CATEGORY_KEYS[categoryIndex]}, ${MODE_KEYS[modeIndex].toUpperCase()}`;
}
