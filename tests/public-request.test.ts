import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizedPageUrl, publicRequestHost } from '../src/public-request';
const env = { PUBLIC_ORIGIN: 'https://vibe.freakz2z.com', CDN_ORIGIN_HOST: 'vibe-origin.freakz2z.com', CDN_TEST_ORIGIN: 'https://vibe-cdn-test.freakz2z.com' };
const request = (host: string, forwarded?: string) => new Request(`https://${host}/tools/react/?q=react`, {headers: forwarded ? {'X-Vibe-Forwarded-Host': forwarded} : {}});
test('CDN origin distinguishes public, test and direct requests for search engine indexing', () => {
  assert.equal(publicRequestHost(request(env.CDN_ORIGIN_HOST, 'vibe.freakz2z.com'), env), 'vibe.freakz2z.com');
  assert.equal(publicRequestHost(request(env.CDN_ORIGIN_HOST, 'vibe-cdn-test.freakz2z.com'), env), 'vibe-cdn-test.freakz2z.com');
  assert.equal(publicRequestHost(request(env.CDN_ORIGIN_HOST), env), env.CDN_ORIGIN_HOST);
  assert.equal(publicRequestHost(request(env.CDN_ORIGIN_HOST, 'attacker.test'), env), env.CDN_ORIGIN_HOST);
  assert.equal(publicRequestHost(request('preview.workers.dev', 'vibe.freakz2z.com'), env), 'preview.workers.dev');
});
test('trailing-slash redirects never leak CDN origin or accept arbitrary forwarded destinations', () => {
  assert.equal(normalizedPageUrl(request(env.CDN_ORIGIN_HOST, 'vibe.freakz2z.com'), env).href, 'https://vibe.freakz2z.com/tools/react?q=react');
  assert.equal(normalizedPageUrl(request(env.CDN_ORIGIN_HOST, 'vibe-cdn-test.freakz2z.com'), env).href, 'https://vibe-cdn-test.freakz2z.com/tools/react?q=react');
  assert.equal(normalizedPageUrl(request(env.CDN_ORIGIN_HOST, 'attacker.test'), env).hostname, 'vibe.freakz2z.com');
  assert.equal(normalizedPageUrl(request('localhost:8787'), env).host, 'localhost:8787');
});
