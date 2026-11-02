// localStorage access for remembered choices. Storage can be blocked, full
// or cleared (private windows, site-data settings), so every call is
// guarded and the app works without it.

const PREFS_KEY = "pc:prefs";

function load(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

// Returns false when the browser wouldn't store it.
function save(key, text) {
  try {
    localStorage.setItem(key, text);
    return true;
  } catch {
    return false;
  }
}

export const loadPrefsText = () => load(PREFS_KEY);
export const savePrefsText = (text) => save(PREFS_KEY, text);
