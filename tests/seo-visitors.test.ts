import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import type { Catalog } from '../shared/contracts';
import { pageSeo, sitemap } from '../src/seo';
import { visitorDay, visitorHash, visitorStats } from '../src/visitors';
const catalog = JSON.parse(fs.readFileSync('data/catalog.json', 'utf8')) as Catalog;
const origin = 'https://vibe.freakz2z.com';

test('sitemap and structured data describe the actual catalog, with safe HTML serialization', () => {
  const xml = sitemap(catalog, origin);
  assert.equal([...xml.matchAll(/<loc>/g)].length, catalog.tools.length + catalog.demos.length + 2);
  assert(xml.includes('<lastmod>' + catalog.updatedAt + '</lastmod>'));
  const page = pageSeo(catalog, '/tools/react', origin);
  assert.equal(page.canonical, origin + '/tools/react'); assert.equal(page.title, 'React · Vibe 工具集');
  assert.equal(JSON.parse(page.structured.slice(page.structured.indexOf('>') + 1, -9))['@graph'][1].about.name, 'React');
  const unsafe = structuredClone(catalog); unsafe.tools[0].tagline = '</script><script>alert(1)</script>';
  const escaped = pageSeo(unsafe, '/tools/' + unsafe.tools[0].id, origin).structured;
  assert.equal((escaped.match(/<script/g) || []).length, 1); assert(escaped.includes('\\u003c/script'));
});
test('visitors use a validated anonymous hash and Shanghai day boundaries', async () => {
  assert.equal(visitorDay(new Date('2026-10-20T15:59:59Z')), '2026-10-20');
  assert.equal(visitorDay(new Date('2026-10-20T16:00:00Z')), '2026-10-21');
  const id = '8ae4b52e-49ce-4f3f-a610-dc6c734d5db8';
  const hash = await visitorHash(id); assert.match(hash!, /^[a-f0-9]{64}$/); assert.equal(hash, await visitorHash(id.toUpperCase()));
  for (const invalid of [null, {}, '1', "' OR 1=1", id + ' ']) assert.equal(await visitorHash(invalid), null);
});
test('real SQLite schema deduplicates concurrent-style retries and preserves daily uniqueness', () => {
  const program = `import sqlite3, pathlib
c=sqlite3.connect(':memory:')
c.executescript(pathlib.Path('migrations/0014_visitor_statistics.sql').read_text())
for d,v in [('2026-10-20','a'),('2026-10-20','a'),('2026-10-21','a'),('2026-10-21','b')]:
 c.execute('INSERT OR IGNORE INTO site_visitors VALUES (?,?)',(v,d))
 c.execute('INSERT OR IGNORE INTO site_daily_visitors VALUES (?,?)',(d,v))
assert c.execute('SELECT count(*) FROM site_visitors').fetchone()[0]==2
assert c.execute('SELECT count(*) FROM site_daily_visitors WHERE day=?',('2026-10-20',)).fetchone()[0]==1
assert c.execute('SELECT count(*) FROM site_daily_visitors WHERE day=?',('2026-10-21',)).fetchone()[0]==2
`;
  const result = spawnSync('python3', ['-c', program], { encoding: 'utf8' }); assert.equal(result.status, 0, result.stderr);
});
test('tracking rejects cross-site, malformed and oversized requests before database access', async () => {
  const db = { batch() { throw new Error('Database should not be accessed'); } } as unknown as D1Database;
  const post = (body: string, extra: Record<string, string> = {}) => new Request(origin + '/api/visitors', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...extra }, body });
  assert.equal((await visitorStats(post('{}', { Origin: 'https://other.test' }), db)).status, 403);
  assert.equal((await visitorStats(post('{}', { 'Content-Type': 'text/plain' }), db)).status, 415);
  assert.equal((await visitorStats(post('not-json'), db)).status, 400);
  assert.equal((await visitorStats(post('{}'), db)).status, 400);
  assert.equal((await visitorStats(post('x'.repeat(257)), db)).status, 413);
});
