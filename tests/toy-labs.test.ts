import test from 'node:test';
import assert from 'node:assert/strict';
import {toyLabFetch, toyOriginAllowed} from '../src/toy-labs';
const env = {DB: {}, MEDIA: {}} as Parameters<typeof toyLabFetch>[1];
const url = 'https://vibe.freakz2z.com/api/toy/labs/hono/greet/Vibe';
test('Toy CORS accepts exact approved origins only', () => {
  assert(toyOriginAllowed('https://www.bilibili.com'));
  assert(toyOriginAllowed('https://www.bilibilitoy.com'));
  for (const origin of ['null', 'http://www.bilibili.com', 'https://evil.bilibili.com', 'https://www.bilibili.com.evil.test']) assert(!toyOriginAllowed(origin));
});
test('Toy preflight allows only read-only demo methods and known headers', async () => {
  const request = (method: string, headers = 'Range, If-None-Match, HX-Request') => new Request(url, {method: 'OPTIONS', headers: {Origin: 'https://www.bilibili.com', 'Access-Control-Request-Method': method, 'Access-Control-Request-Headers': headers}});
  const ok = await toyLabFetch(request('GET'), env);
  assert.equal(ok.status, 204); assert.equal(ok.headers.get('Access-Control-Allow-Origin'), 'https://www.bilibili.com');
  assert.equal(ok.headers.get('Access-Control-Allow-Credentials'), null);
  assert.equal((await toyLabFetch(request('POST'), env)).status, 405);
  assert.equal((await toyLabFetch(request('GET', 'Authorization'), env)).status, 403);
});
test('Toy CORS rejects untrusted origins and writes before invoking real services', async () => {
  assert.equal((await toyLabFetch(new Request(url, {headers: {Origin: 'https://evil.test'}}), env)).status, 403);
  assert.equal((await toyLabFetch(new Request(url, {method: 'POST', headers: {Origin: 'https://www.bilibili.com'}}), env)).status, 405);
});
test('Toy GET uses the real Hono router and exposes response evidence', async () => {
  const result = await toyLabFetch(new Request(url, {headers: {Origin: 'https://www.bilibili.com'}}), env);
  assert.equal(result.status, 200);
  assert.match(await result.text(), /Vibe/);
  assert.match(result.headers.get('Access-Control-Expose-Headers') || '', /X-Request-Id/);
});
