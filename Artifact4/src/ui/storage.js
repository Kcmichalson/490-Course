// localStorage access for remembered choices. Storage can be blocked or
// cleared (private windows, site-data settings), so every call is guarded
// and the app works without it.

const PREFS_KEY = "pc:prefs";

export function loadPrefsText() {
  try {
    return localStorage.getItem(PREFS_KEY);
  } catch {
    return null;
  }
}

export function savePrefsText(text) {
  try {
    localStorage.setItem(PREFS_KEY, text);
    return true;
  } catch {
    return false;
  }
}
