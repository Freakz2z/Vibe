import {createServer} from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve('dist-toy');
const mount = '/toy/vibe-tools-mobile/';
const types: Record<string, string> = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.geojson': 'application/geo+json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2'};
createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  if (url.pathname === '/') { res.writeHead(302, {Location: mount + 'index.html'}).end(); return; }
  if (!url.pathname.startsWith(mount)) { res.writeHead(404).end(); return; }
  let file: string;
  try { file = path.resolve(root, decodeURIComponent(url.pathname.slice(mount.length)) || 'index.html'); }
  catch { res.writeHead(400).end(); return; }
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
  res.writeHead(200, {'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store'});
  fs.createReadStream(file).pipe(res);
}).listen(4178, '127.0.0.1', () => console.log('Toy nested-path preview: http://127.0.0.1:4178' + mount + 'index.html'));
