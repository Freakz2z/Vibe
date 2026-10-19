import test from 'node:test';
import assert from 'node:assert/strict';
import { cachedPublicResponse } from '../src/edge-cache';
import { bootstrapScript, safeJson } from '../src/bootstrap';

function harness() {
  const entries = new Map<string, Response>();
  const tasks: Promise<unknown>[] = [];
  const keys: Request[] = [];
  const cache = {
    async match(key: Request) {
      keys.push(key);
      return entries.get(key.url)?.clone();
    },
    async put(key: Request, response: Response) {
      entries.set(key.url, new Response(await response.arrayBuffer(), response));
    },
  };
  Object.defineProperty(globalThis, 'caches', { configurable: true, value: { default: cache } });
  const ctx = {
    waitUntil(task: Promise<unknown>) {
      tasks.push(task);
    },
  };
  return { entries, tasks, keys, cache, ctx };
}

test('public cache avoids repeated origin reads and keeps response streams independent', async () => {
  const { ctx, tasks, keys } = harness();
  let reads = 0;
  const load = async () => {
    reads++;
    return new Response('catalog', { headers: { ETag: '"v1"', 'Cache-Control': 'public, max-age=60' } });
  };
  const first = await cachedPublicResponse('https://vibe.test', 'catalog', 'all', 60, ctx, load);
  assert.equal(first.status, 'MISS');
  assert.equal(await first.response.text(), 'catalog');
  await Promise.all(tasks);
  const second = await cachedPublicResponse('https://vibe.test', 'catalog', 'all', 60, ctx, load);
  assert.equal(second.status, 'HIT');
  assert.equal(await second.response.text(), 'catalog');
  assert.equal(reads, 1);
  assert.equal(second.response.headers.get('ETag'), '"v1"');
  assert.match(keys[0].url, /\/__vibe-cache\/[a-f0-9]{20}\/catalog\/all$/);
  assert.equal(keys[0].method, 'GET');
  assert.deepEqual([...keys[0].headers], []);
});

test('parallel cold catalog requests share one load, while namespaces remain isolated', async () => {
  const { ctx, tasks } = harness();
  let reads = 0;
  let finish!: () => void;
  const gate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const load = async () => {
    reads++;
    await gate;
    return new Response('shared');
  };
  const pending = [1, 2, 3].map(() =>
    cachedPublicResponse('https://vibe.test', 'catalog', 'all', 60, ctx, load),
  );
  finish();
  const results = await Promise.all(pending);
  assert.deepEqual(await Promise.all(results.map((row) => row.response.text())), [
    'shared',
    'shared',
    'shared',
  ]);
  assert.equal(reads, 1);
  await Promise.all(tasks);
  await cachedPublicResponse('https://vibe.test', 'media', 'all', 60, ctx, load);
  assert.equal(reads, 2);
  await Promise.all(tasks);
});

test('private, missing and error responses never enter the public cache', async () => {
  const { ctx, tasks, entries } = harness();
  for (const [index, response] of [
    new Response('private', { headers: { 'Cache-Control': 'private' } }),
    new Response('error', { status: 503 }),
    new Response('missing', { status: 404 }),
    new Response('cookie', { headers: { 'Set-Cookie': 'id=secret' } }),
    new Response('live', { headers: { 'Cache-Control': 'no-store' } }),
  ].entries()) {
    await cachedPublicResponse('https://vibe.test', 'skip', String(index), 60, ctx, async () => response);
  }
  await Promise.all(tasks);
  assert.equal(entries.size, 0);
});

test('cache failures and rejected origin loads do not poison subsequent requests', async () => {
  const { ctx, cache, tasks } = harness();
  cache.match = async () => {
    throw new Error('cache unavailable');
  };
  cache.put = async () => {
    throw new Error('cache full');
  };
  await assert.rejects(
    cachedPublicResponse('https://vibe.test', 'catalog', 'retry', 60, ctx, async () => {
      throw new Error('temporary D1 failure');
    }),
  );
  const result = await cachedPublicResponse(
    'https://vibe.test',
    'catalog',
    'retry',
    60,
    ctx,
    async () => new Response('recovered'),
  );
  assert.equal(await result.response.text(), 'recovered');
  await Promise.all(tasks);
});

test('embedded catalog JSON cannot close its script element or introduce markup', () => {
  const value = { name: '</script><script>alert(1)</script>', special: '<>&\u2028\u2029' };
  const encoded = safeJson(value);
  assert(!encoded.includes('<'));
  assert(!encoded.includes('>'));
  assert.deepEqual(JSON.parse(encoded), value);
  assert.equal((bootstrapScript(value as never).match(/<script/g) ?? []).length, 1);
});

test('edge TTL does not replace the browser immutable policy on a cache hit', async () => {
  const { ctx, tasks, entries } = harness();
  const first = await cachedPublicResponse(
    'https://vibe.test',
    'media',
    'hashed.wasm',
    3600,
    ctx,
    async () => new Response('wasm', { headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } }),
  );
  await first.response.text();
  await Promise.all(tasks);
  assert.equal([...entries.values()][0].headers.get('Cache-Control'), 'public, max-age=3600');
  const second = await cachedPublicResponse(
    'https://vibe.test',
    'media',
    'hashed.wasm',
    3600,
    ctx,
    async () => {
      throw new Error('must use cache');
    },
  );
  assert.equal(second.status, 'HIT');
  assert.equal(second.response.headers.get('Cache-Control'), 'public, max-age=31536000, immutable');
  assert.equal(second.response.headers.get('X-Vibe-Client-Cache-Control'), null);
  assert.equal(await second.response.text(), 'wasm');
});
