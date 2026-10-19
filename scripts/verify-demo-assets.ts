import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readDemoAssets} from './demo-assets';
const base=(process.argv[2]||'http://127.0.0.1:8787').replace(/\/$/,'');
const assets=readDemoAssets();
for(let i=0;i<assets.length;i+=4){
 await Promise.all(assets.slice(i,i+4).map(async asset=>{
  const response=await fetch(base+'/media/'+asset.key);assert.equal(response.status,200,asset.key);
  assert.equal(response.headers.get('Content-Type'),asset.contentType,asset.key);
  const bytes=new Uint8Array(await response.arrayBuffer());
  assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256,asset.key);
  const etag=response.headers.get('ETag');assert(etag,asset.key);
  const cached=await fetch(base+'/media/'+asset.key,{headers:{'If-None-Match':etag!}});assert.equal(cached.status,304,asset.key);
  console.log('PASS '+asset.key+' '+bytes.length+' bytes');
 }));
}
const rejected=await fetch(base+'/media/demos/not-listed/secret.wasm');assert.equal(rejected.status,404);
console.log(`Verified ${assets.length} real runtime assets and unlisted-key rejection against ${base}`);
