import fs from 'node:fs';
import type {Catalog} from '../shared/contracts';
const catalog=JSON.parse(fs.readFileSync('data/catalog.json','utf8')) as Catalog;
const queue=[...catalog.tools];const results:{id:string,url:string,status:number,title:string,redirectedTo?:string,error?:string}[]=[];
await Promise.all(Array.from({length:6},async()=>{while(queue.length){const tool=queue.shift()!;try{
 const response=await fetch(tool.website,{signal:AbortSignal.timeout(18000),headers:{'User-Agent':'Mozilla/5.0 (compatible; VibeDirectoryLinkCheck/1.0)'}});
 const html=(await response.text()).slice(0,250000);const title=html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g,' ').trim().slice(0,200)||'';
 results.push({id:tool.id,url:tool.website,status:response.status,title,...(response.url!==tool.website?{redirectedTo:response.url}:{})});
}catch(error){results.push({id:tool.id,url:tool.website,status:0,title:'',error:error instanceof Error?error.name:'unknown'});}}}));
results.sort((a,b)=>a.id.localeCompare(b.id));fs.mkdirSync('artifacts',{recursive:true});fs.writeFileSync('artifacts/link-check.json',JSON.stringify({checkedAt:new Date().toISOString(),results},null,2));console.log(JSON.stringify({total:results.length,ok:results.filter(r=>r.status>=200&&r.status<400).length,review:results.filter(r=>r.status===0||r.status>=400)},null,2));
