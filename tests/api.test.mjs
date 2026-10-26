import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { API_BASE, ApiError, apiFetchRaw, getApiUrl } from '../lib/api.ts';

const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
const jwt = `header.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.signature`;
let calls;
beforeEach(() => {
  calls = [];
  const storage = new Map([['HM_TOKEN', jwt], ['hm-session', JSON.stringify({ playerId: 'player-123' })]]);
  globalThis.window = { location: { hash: '', pathname: '/', search: '' }, localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) } };
  globalThis.fetch = async (url, init) => { calls.push({ url, init }); return Response.json({ ok: true }); };
});
afterEach(() => { globalThis.fetch = originalFetch; globalThis.window = originalWindow; });

test('relative paths and explicit API URLs stay in the selected function', () => {
  assert.equal(getApiUrl('/api/games?limit=2'), `${API_BASE}/api/games?limit=2`);
  assert.equal(getApiUrl('api/games'), `${API_BASE}/api/games`);
  assert.equal(getApiUrl(`${API_BASE}/api/games`), `${API_BASE}/api/games`);
});

for (const address of [
  'https://untrusted.example/api', '//untrusted.example/api',
  `${API_BASE}-other/api`, `${API_BASE}/../other/api`, `${API_BASE}/%2e%2e/other/api`,
  `${API_BASE.replace('https://', 'https://someone@')}/api`,
  `${API_BASE.replace('https://', 'http://')}/api`, 'javascript:alert(1)', '/api#fragment',
]) {
  test(`rejects credential destination ${address}`, async () => {
    await assert.rejects(apiFetchRaw(address), error => error instanceof ApiError && error.status === 400);
    assert.equal(calls.length, 0, 'no refresh or credential-bearing request may occur');
  });
}

for (const initHeaders of [new Headers({ 'Content-Type': 'application/json', 'X-Player-ID': 'explicit' }), [['Content-Type', 'application/json'], ['X-Player-ID', 'explicit']], { 'Content-Type': 'application/json', 'X-Player-ID': 'explicit' }]) {
  test(`preserves ${initHeaders.constructor.name} request headers`, async () => {
    await apiFetchRaw('/api/games', { method: 'POST', headers: initHeaders, body: '{}' });
    const headers = calls[0].init.headers;
    assert.equal(headers.get('Content-Type'), 'application/json');
    assert.equal(headers.get('X-Player-ID'), 'explicit');
    assert.equal(headers.get('Authorization'), `Bearer ${jwt}`);
    assert.equal(calls[0].url, `${API_BASE}/api/games`);
    assert.equal(calls[0].init.redirect, 'error');
  });
}

test('uses the stored player ID if the caller does not set one', async () => {
  await apiFetchRaw('/api/games');
  assert.equal(calls[0].init.headers.get('x-player-id'), 'player-123');
});
