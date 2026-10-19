// Retrieve brand marks directly from official sites. No third-party logo service.
import fs from 'node:fs';
import crypto from 'node:crypto';
const catalog=JSON.parse(fs.readFileSync('data/catalog.json','utf8'));
const ledgerPath='assets/icons/sources.json';
const ledger=fs.existsSync(ledgerPath)?JSON.parse(fs.readFileSync(ledgerPath,'utf8')):{};
const only=process.argv.slice(2);
const overrides={
 'aider':'https://aider.chat/assets/logo.svg',
 'playwright':'https://playwright.dev/img/playwright-logo.svg',
 'lexical':'https://lexical.dev/img/favicon.ico',
 'swiftui':'https://developer.apple.com/assets/elements/icons/swiftui/swiftui-96x96_2x.png',
 'recharts':'https://github.com/recharts.png?size=128',
 'markdown-it':'https://github.com/markdown-it.png?size=128',
 'cloudflare-workers':'https://raw.githubusercontent.com/cloudflare/cloudflare-docs/production/src/icons/workers.svg',
 'd1':'https://raw.githubusercontent.com/cloudflare/cloudflare-docs/production/src/icons/d1.svg',
 'r2':'https://raw.githubusercontent.com/cloudflare/cloudflare-docs/production/src/icons/r2.svg',
 'shadcn-ui':'https://ui.shadcn.com/favicon-32x32.png',
 'claude-code':'https://assets.claude.com/95a868946ac8a31e5ff832e2899f294aa368b836.png?w=128&h=128',
 'react':'https://react.dev/favicon.ico',
 'vue':'https://vuejs.org/logo.svg',
 'vite':'https://vite.dev/logo.svg',
 'nextjs':'https://nextjs.org/favicon.ico',
 'tailwindcss':'https://tailwindcss.com/favicon.ico',
 'typescript':'https://www.typescriptlang.org/favicon-32x32.png',
 'threejs':'https://threejs.org/files/favicon.ico',
 'echarts':'https://echarts.apache.org/zh/images/favicon.png',
 'd3':'https://d3js.org/logo.svg',
 'chartjs':'https://www.chartjs.org/favicon.ico',
 'github-actions':'https://github.githubassets.com/favicons/favicon.svg',
};
Object.assign(overrides, fs.existsSync('assets/icons/overrides.json') ? JSON.parse(fs.readFileSync('assets/icons/overrides.json','utf8')) : {});
const headers={'User-Agent':'VibeCatalog/1.0 (official brand assets; https://vibe.freakz2z.com)'};
async function get(url){const r=await fetch(url,{headers,signal:AbortSignal.timeout(18000)});if(!r.ok)throw Error(`HTTP ${r.status}`);return r;}
function inspect(bytes){
 const txt=bytes.toString('utf8');
 if(/<svg[\s>]/i.test(txt)&&!/<html/i.test(txt)){
  if(/<script|<foreignObject|\bon\w+\s*=|(?:href|src)\s*=\s*["'](?:https?:|\/\/|data:text\/html)|url\(\s*["']?https?:/i.test(txt))throw Error('Active or external SVG content');
  return ['svg','image/svg+xml'];
 }
 if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return ['png','image/png'];
 if(bytes[0]===0&&bytes[1]===0&&bytes[2]===1&&bytes[3]===0)return ['ico','image/x-icon'];
 if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')return ['webp','image/webp'];
 if(bytes[0]===255&&bytes[1]===216)return ['jpg','image/jpeg'];
 if(bytes.toString('ascii',0,6)==='GIF89a'||bytes.toString('ascii',0,6)==='GIF87a')return ['gif','image/gif'];
 throw Error('Not a supported image');
}
async function run(tool){
 if(!only.length&&ledger[tool.id]?.file&&fs.existsSync(ledger[tool.id].file))return;
 let candidates=[];const errors=[];
 if(overrides[tool.id])candidates.push(overrides[tool.id]);
 try{
  const page=await get(tool.website); const html=await page.text();
  const attr=(tag,name)=>{const match=tag.match(new RegExp('\\b'+name+'\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))','i'));return (match?.[1]??match?.[2]??match?.[3])?.replaceAll('&amp;','&');};
  const icons=[...html.matchAll(/<link\b[^>]*>/gi)].map(m=>m[0]).filter(s=>/^(?:icon|shortcut icon|apple-touch-icon|mask-icon)$/i.test(attr(s,'rel')||'')).map(s=>{
   const href=attr(s,'href');
   return {url:href?new URL(href,page.url).href:null,score:(/\.svg(?:\?|$)/i.test(href||'')?300:0)+Number(s.match(/sizes=["'](\d+)/i)?.[1]||0)};
  }).filter(x=>x.url).sort((a,b)=>b.score-a.score);
  candidates.push(...icons.map(x=>x.url));
  for(const m of html.matchAll(/<img\b[^>]*>/gi)){
   const src=attr(m[0],'src');if(src&&/(?:logo|brand)[\w./-]*\.(?:svg|png|webp)(?:\?|$)/i.test(src)&&!src.startsWith('data:'))candidates.push(new URL(src,page.url).href);
  }
  candidates.push(new URL('favicon.ico',page.url).href,new URL('/favicon.ico',page.url).href);
 }catch(e){errors.push(`${tool.website}: ${e.message}`);candidates.push(new URL('/favicon.ico',tool.website).href);}
 for(const url of [...new Set(candidates)]){
  try{
   const r=await get(url); const bytes=Buffer.from(await r.arrayBuffer());if(bytes.length>2*1024*1024)throw Error('Image exceeds 2MiB');
   const [ext,mime]=inspect(bytes);const file=`assets/icons/${tool.id}.${ext}`;fs.writeFileSync(file,bytes);
   ledger[tool.id]={name:tool.name,officialSite:tool.website,source:url,resolvedUrl:r.url,file,mime,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),retrievedAt:new Date().toISOString()};
   console.log(`${tool.id}: ${ext} ${bytes.length} ${r.url}`);return;
  }catch(e){errors.push(`${url}: ${e.message}`);}
 }
 const previous=ledger[tool.id];
 if(previous?.file&&fs.existsSync(previous.file)){
  ledger[tool.id]={...previous,lastCheck:{checkedAt:new Date().toISOString(),errors}};
 }else{
  ledger[tool.id]={name:tool.name,officialSite:tool.website,status:'unavailable',errors,fallbackReason:previous?.fallbackReason||'官网和官方仓库未找到可确认、可单独使用的产品 Logo，保留文字标识。'};
 }
 console.log(`${tool.id}: UNAVAILABLE ${errors.join('; ')}`);
}
const queue=catalog.tools.filter(t=>!only.length||only.includes(t.id));
await Promise.all(Array.from({length:5},async()=>{while(queue.length)await run(queue.shift());}));
fs.writeFileSync(ledgerPath,JSON.stringify(ledger,null,2)+'\n');
