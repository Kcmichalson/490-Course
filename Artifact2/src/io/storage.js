// localStorage helpers. Every key gets the `fcm:` prefix because all GitHub
// Pages sites on one account share an origin. Storage can be missing or full
// (private windows, blocked site data), so failures fall back quietly.

const PREFIX = 'fcm:';

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
