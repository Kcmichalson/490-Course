// localStorage access for remembered choices and saved searches. Storage
// can be blocked, full or cleared (private windows, site-data settings), so
// every call is guarded and the app works without it.

const PREFS_KEY = "pc:prefs";
const SAVED_KEY = "pc:saved";

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
export const loadSavedText = () => load(SAVED_KEY);
export const saveSavedText = (text) => save(SAVED_KEY, text);
