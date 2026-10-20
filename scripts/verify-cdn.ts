import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {gunzipSync, brotliDecompressSync, zstdDecompressSync} from 'node:zlib';

// Use raw wire bytes: fetch's transparent decoding can hide a broken CDN variant.
const base=(process.argv[2]||'https://vibe-cdn-test.freakz2z.com').replace(/\/$/,'');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'vibe-cdn-'));
const evidence:unknown[]=[];
const transport=process.env.VIBE_TEST_PROXY?['--proxy',process.env.VIBE_TEST_PROXY,'--noproxy','']:['--noproxy','*'];
function request(route:string, encoding='identity', args:string[]=[], origin=base){
 const headersFile=path.join(tmp,'headers'),bodyFile=path.join(tmp,'body');
 execFileSync('curl',[...transport,'--silent','--show-error','--connect-timeout','5','--max-time','25','-H','Accept-Encoding: '+encoding,'-D',headersFile,'-o',bodyFile,...args,origin+route]);
 const allHeaders=fs.readFileSync(headersFile,'utf8');
 // An explicitly selected proxy can prepend its CONNECT response.
 const raw=allHeaders.slice(allHeaders.lastIndexOf('\nHTTP/')+1);
 const headers=new Headers();
 for(const line of raw.split(/\r?\n/).slice(1)){const p=line.indexOf(':');if(p>0)headers.append(line.slice(0,p),line.slice(p+1).trim());}
 const status=Number(raw.match(/^HTTP\/\S+ (\d+)/)?.[1]);
 const ce=headers.get('Content-Encoding')||'identity';
 assert(ce==='identity'||encoding.split(',').map(x=>x.trim()).includes(ce),`Unexpected ${ce} for ${encoding}: ${route}`);
 const bytes=fs.readFileSync(bodyFile);
 const body=ce==='gzip'?gunzipSync(bytes):ce==='br'?brotliDecompressSync(bytes):ce==='zstd'?zstdDecompressSync(bytes):bytes;
 evidence.push({route,encoding,status,contentEncoding:ce,cache:headers.get('X-Site-Cache-Status'),bytes:bytes.length});
 console.log(`${status} ${route} offer=${encoding} received=${ce} cache=${headers.get('X-Site-Cache-Status')||'-'}`);
 return {status,headers,body};
}
const hash=(body:Buffer)=>createHash('sha256').update(body).digest('hex');
try{
 const index=fs.readFileSync('apps/web/dist/index.html','utf8');
 const assets=[...index.matchAll(/(?:src|href)="(\/assets\/[^\"]+\.(?:js|css))"/g)].map(m=>m[1]);
 assert(assets.length>=2,'Build the site before validating CDN assets');
 for(const asset of assets){
  const expected=hash(fs.readFileSync('apps/web/dist'+asset));
  // Prime with modern encoding, then request older clients on the same cache key.
  for(const encoding of ['gzip, br, zstd','identity','gzip','br','identity','gzip']){
   const r=request(asset,encoding);assert.equal(r.status,200);assert.equal(r.headers.get('Server'),'ESA');
   assert.equal(hash(r.body),expected,asset+' decoded content differs from build');
  }
 }
 assert(evidence.some((e:any)=>e.cache==='HIT'),'No ESA cache HIT observed');
 const first=request('/'),second=request('/');
 assert.equal(first.status,200);assert(first.headers.get('Cache-Control')?.includes('no-store'));
 const isPublic=base==='https://vibe.freakz2z.com';
 assert.equal(first.headers.get('X-Robots-Tag'),isPublic?null:'noindex');
 assert(first.body.toString().includes('rel="canonical" href="https://vibe.freakz2z.com/"'));
 assert.notEqual(first.headers.get('Content-Security-Policy'),second.headers.get('Content-Security-Policy'));
 const slash=request('/tools/react/');assert.equal(slash.status,308);assert.equal(slash.headers.get('Location'),base+'/tools/react');
 const http=request('/tools/react','identity',[],base.replace('https:','http:'));
 assert([301,302,307,308].includes(http.status));assert.equal(http.headers.get('Location'),base+'/tools/react');
 const validOrigin=request('/api/visitors','identity',['-H','Origin: '+base,'-H','Content-Type: application/json','--data','{}']);
 assert.equal(validOrigin.status,400); // reaches ID validation without adding a fake visitor
 const foreignOrigin=request('/api/visitors','identity',['-H','Origin: https://invalid.example','-H','Content-Type: application/json','--data','{}']);
 assert.equal(foreignOrigin.status,403);
 fs.mkdirSync('artifacts',{recursive:true});fs.writeFileSync(`artifacts/cdn-compatibility-${isPublic?'production':'test'}.json`,JSON.stringify({base,transport:process.env.VIBE_TEST_PROXY?'explicit proxy':'direct',checkedAt:new Date().toISOString(),evidence},null,2));
 console.log(`PASS ${evidence.length} CDN wire-format, content, redirect, nonce and visitor-origin checks`);
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
