import { INDEXNOW_KEY } from '../shared/indexing';
const origin = new URL(process.argv[2] || 'https://vibe.freakz2z.com').origin;
const keyResponse = await fetch(`${origin}/${INDEXNOW_KEY}.txt`);
if (!keyResponse.ok || (await keyResponse.text()).trim() !== INDEXNOW_KEY) throw new Error('Deploy and verify the IndexNow key before submitting');
const response = await fetch(origin + '/sitemap.xml');
if (!response.ok) throw new Error('Sitemap unavailable');
const xml = await response.text();
const urlList = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1].replace(/&amp;/g, '&'));
if (!urlList.length || urlList.some(url => new URL(url).origin !== origin)) throw new Error('Invalid sitemap URL list');
const result = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: new URL(origin).host, key: INDEXNOW_KEY, keyLocation: `${origin}/${INDEXNOW_KEY}.txt`, urlList }),
});
console.log(JSON.stringify({ origin, submitted: urlList.length, status: result.status, result: await result.text() }));
if (![200, 202].includes(result.status)) process.exitCode = 1;
// 200 = received; 202 = received, key validation pending. Neither means indexed.
