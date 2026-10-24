import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {readDemoAssets} from './demo-assets';
const root = 'dist-toy';
for (const [source, dest] of [['assets/icons', 'icons'], ['apps/web/public/brand', 'brand']]) {
  fs.mkdirSync(path.join(root, 'media', dest), {recursive: true});
  for (const name of fs.readdirSync(source)) {
    if (!/\.(svg|png|webp|jpe?g|ico)$/i.test(name)) continue;
    fs.copyFileSync(path.join(source, name), path.join(root, 'media', dest, name));
  }
}
for (const asset of readDemoAssets()) {
  const target = path.join(root, 'media', asset.key.replace(/\.geojson$/, '.json'));
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.copyFileSync(asset.file, target);
}
fs.mkdirSync(path.join(root, 'sources'), {recursive: true});
fs.copyFileSync('assets/icons/sources.json', path.join(root, 'sources', 'official-logos.json'));
fs.copyFileSync('assets/demos/manifest.json', path.join(root, 'sources', 'runtime-assets.json'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert(!/(?:src|href)="\/(?!\/)/.test(html), 'Toy entry still has root-absolute resources');
assert(html.includes('toy-sdk.js'), 'Missing Toy SDK');
console.log('Packaged Toy directory, official logos, and verified demo assets');
