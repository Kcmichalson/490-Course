// Companion chat client (step D3): origin gate, error texts, token
// handling against a fake fetch, and the history limit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBridgeClient, errorText, isCompanionOrigin, recentHistory } from '../src/ui/chatclient.js';

const json = (status, body) => ({ ok: status < 400, status, json: async () => body });

test('only http://127.0.0.1:8000 may chat', () => {
  assert.equal(isCompanionOrigin('http://127.0.0.1:8000'), true);
  for (const o of ['http://localhost:8000', 'https://kcmichalson.github.io', 'http://127.0.0.1:8001', 'null']) {
    assert.equal(isCompanionOrigin(o), false, o);
  }
});

test('error texts name the four required failures', () => {
  assert.match(errorText('offline'), /isn't running.*py serve\.py/);
  assert.match(errorText('not_logged_in'), /claude auth login/);
  assert.match(errorText('busy'), /still answering/);
  assert.equal(errorText('run_failed', 'boom'), 'The run failed: boom');
});

test('token fetched once and sent on every request', async () => {
  const calls = [];
  const client = createBridgeClient(async (path, opts) => {
    calls.push([path, opts.headers['X-Companion-Token'] ?? null]);
    return path === '/companion/token' ? json(200, { token: 't1' }) : json(200, { reply: 'hi' });
  });
  assert.deepEqual(await client.post('/companion/chat', '{}'), { reply: 'hi' });
  await client.post('/companion/chat', '{}');
  assert.deepEqual(calls, [['/companion/token', null], ['/companion/chat', 't1'], ['/companion/chat', 't1']]);
});

test('a restarted server (bad_token) gets one new token', async () => {
  let n = 0;
  const seen = [];
  const client = createBridgeClient(async (path, opts) => {
    if (path === '/companion/token') return json(200, { token: `t${++n}` });
    seen.push(opts.headers['X-Companion-Token']);
    return seen.length === 1 ? json(403, { error: 'bad_token' }) : json(200, { ok: true });
  });
  await client.post('/companion/chat', '{}');
  assert.deepEqual(seen, ['t1', 't2']);
});

test('offline, abort, and bridge errors become codes', async () => {
  const offline = createBridgeClient(async () => { throw new TypeError('Failed to fetch'); });
  await assert.rejects(offline.post('/companion/chat', '{}'), { code: 'offline' });
  const aborted = createBridgeClient(async () => { throw Object.assign(new Error('x'), { name: 'AbortError' }); });
  await assert.rejects(aborted.post('/companion/chat', '{}'), { code: 'cancelled' });
  const busy = createBridgeClient(async (path) => (path === '/companion/token' ? json(200, { token: 't' }) : json(409, { error: 'busy', message: 'm' })));
  await assert.rejects(busy.post('/companion/chat', '{}'), { code: 'busy', message: 'm' });
});

test('history keeps the last 12 messages', () => {
  const h = Array.from({ length: 20 }, (_, i) => ({ role: 'user', text: String(i) }));
  assert.deepEqual(recentHistory(h).map((m) => m.text), Array.from({ length: 12 }, (_, i) => String(i + 8)));
});
