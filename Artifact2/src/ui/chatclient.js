// Companion chat client (step D3): talks to the local bridge in serve.py
// (POST /companion/…). The bridge exists only at http://127.0.0.1:8000;
// anywhere else (GitHub Pages, localhost) the panel sends nothing.

export const COMPANION_ORIGIN = 'http://127.0.0.1:8000';
export const LOCAL_ONLY_NOTE = 'Chat needs the local server (py serve.py), opened at http://127.0.0.1:8000.';

export const isCompanionOrigin = (origin) => origin === COMPANION_ORIGIN;

// The panel's text for a failure: a bridge error code, or 'offline' when
// the server can't be reached.
export function errorText(code, message = '') {
  switch (code) {
    case 'offline': return 'The local server isn\'t running. Start it with py serve.py, then reload this page.';
    case 'not_logged_in': return 'Claude isn\'t logged in. Run claude auth login (see tools/README.md), then try again.';
    case 'busy': return 'The companion is still answering another message. Wait, or cancel it.';
    case 'cancelled': return 'Cancelled.';
    case 'no_claude': return 'The claude CLI wasn\'t found (see tools/README.md).';
    case 'no_map_data': return 'Open Köppen mode (Q) once so the map\'s rainfall is computed, then send again.';
    case 'too_long': return 'That message is too long (4,000 characters at most).';
    default: return `The run failed${message ? `: ${message}` : '.'}`;
  }
}

// { token, post(path, body, signal) } with the token fetched once and
// fetched again if the server restarted (403 bad_token). Throws
// { code, message } on failure.
export function createBridgeClient(fetchFn = (...a) => fetch(...a)) {
  let token = null;

  async function raw(path, body, signal, headers = {}) {
    let res;
    try {
      res = await fetchFn(path, { method: 'POST', body, signal, headers });
    } catch (e) {
      if (e?.name === 'AbortError') throw { code: 'cancelled', message: '' };
      throw { code: 'offline', message: String(e?.message ?? e) };
    }
    let data = null;
    try { data = await res.json(); } catch { /* not JSON */ }
    if (!res.ok) throw { code: data?.error ?? 'run_failed', message: data?.message ?? `HTTP ${res.status}` };
    return data;
  }

  async function getToken() {
    if (!token) token = (await raw('/companion/token', '')).token;
    return token;
  }

  async function post(path, body, signal) {
    try {
      return await raw(path, body, signal, { 'X-Companion-Token': await getToken() });
    } catch (e) {
      if (e.code !== 'bad_token') throw e;
      token = null; // the server restarted: fetch a new token once
      return raw(path, body, signal, { 'X-Companion-Token': await getToken() });
    }
  }

  return { post };
}

// The last `limit` messages (the bridge resends at most 12).
export const recentHistory = (history, limit = 12) => history.slice(-limit);
