import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import type {Catalog} from '../shared/contracts';
const base=process.argv[2]||'http://localhost:8787';
const catalog=await(await fetch(base+'/api/catalog')).json() as Catalog;
const sources=JSON.parse(fs.readFileSync('assets/icons/sources.json','utf8'));
const queue=[...catalog.tools];
const evidence:{id:string;status:string;path?:string}[]=[];
await Promise.all(Array.from({length:5},async()=>{
 while(queue.length){
  const tool=queue.shift()!;const source=sources[tool.id];assert(source,'Missing official source record: '+tool.id);
  if(!tool.logo){assert(source.fallbackReason,'Undocumented logo fallback: '+tool.id);evidence.push({id:tool.id,status:'documented fallback'});continue;}
  assert(tool.logo.startsWith('/media/icons/'),'Logo must use site R2: '+tool.id);
  const response=await fetch(base+tool.logo);assert.equal(response.status,200,tool.id);assert.equal(response.headers.get('Content-Type'),source.mime,tool.id);
  const data=Buffer.from(await response.arrayBuffer());assert.equal(createHash('sha256').update(data).digest('hex'),source.sha256,'Official asset checksum: '+tool.id);
  assert(response.headers.get('ETag'),'R2 ETag: '+tool.id);evidence.push({id:tool.id,status:'verified official asset',path:tool.logo});
 }
}));
const report={base,checkedAt:new Date().toISOString(),official:evidence.filter(e=>e.path).length,fallback:evidence.filter(e=>!e.path).length,evidence:evidence.sort((a,b)=>a.id.localeCompare(b.id))};
fs.writeFileSync(`artifacts/logos-${base.includes('localhost')?'local':'production'}.json`,JSON.stringify(report,null,2)+'\n');
console.log(`Verified ${report.official} official R2 marks; ${report.fallback} documented fallback at ${base}`);
