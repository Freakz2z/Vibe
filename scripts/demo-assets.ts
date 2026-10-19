import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
export interface DemoAsset {key:string;file:string;contentType:string;sha256:string;source:string;license:string;}
export function readDemoAssets():DemoAsset[]{
 const manifest='assets/demos/manifest.json';
 const assets:DemoAsset[]=fs.existsSync(manifest)?JSON.parse(fs.readFileSync(manifest,'utf8')):[];
 assert(Array.isArray(assets),'Demo asset manifest must be an array');
 const keys=new Set<string>();
 const root=path.resolve('assets/demos')+path.sep;
 for(const asset of assets){
  assert(/^demos\/[a-z0-9-]+\/[a-zA-Z0-9_.-]+$/.test(asset.key)&&!asset.key.includes('..'),'Invalid runtime asset key');
  assert(!keys.has(asset.key),'Duplicate runtime asset');keys.add(asset.key);
  assert(path.resolve(asset.file).startsWith(root),'Runtime asset must be in assets/demos');
  assert(fs.realpathSync(asset.file).startsWith(fs.realpathSync('assets/demos')+path.sep),'Runtime asset symlink must stay in assets/demos');
  assert(/^[a-z0-9.+-]+\/[a-z0-9.+-]+(?:; charset=utf-8)?$/i.test(asset.contentType),'Invalid MIME');
  assert(!/html|javascript/.test(asset.contentType),'Runtime asset cannot inject document or script');
  assert(/^[a-f0-9]{64}$/.test(asset.sha256),'Missing SHA256');
  const digest=createHash('sha256').update(fs.readFileSync(asset.file)).digest('hex');
  assert.equal(digest,asset.sha256,'Asset digest mismatch: '+asset.key);
  assert(asset.key.includes(digest.slice(0,8)),'Use content-hashed runtime asset names: '+asset.key);
  assert(asset.source&&asset.license,'Asset provenance required');
  assert(/^https:\/\/|^npm:/.test(asset.source),'Official source URL or npm package required');
 }
 return assets;
}
export function prepareDemoAssets(){
 const assets=readDemoAssets();
 const code='// Generated from validated assets/demos/manifest.json.\nexport const demoAssets:Readonly<Record<string,string>> = '+JSON.stringify(Object.fromEntries(assets.map(a=>[a.key,a.contentType])),null,2)+';\n';
 const output='src/demo-assets.ts';if(!fs.existsSync(output)||fs.readFileSync(output,'utf8')!==code)fs.writeFileSync(output,code);
 console.log(`Validated ${assets.length} runtime assets and generated exact media allowlist`);
 return assets;
}
