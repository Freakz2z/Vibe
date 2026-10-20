import {visitorStats} from './visitors';
import {escapeXml,pageSeo,sitemap} from './seo';
import {INDEXNOW_KEY} from '../shared/indexing';
import {cachedPublicResponse} from './edge-cache';
import {bootstrapScript,initialThemeScript} from './bootstrap';
import {renderHomePreview} from './home-preview';
import {demoAssets} from './demo-assets';
import {labFetch} from './labs';
import {matchesEntityTag,parseTool,queryFilters,validMediaKey} from './catalog';
import type { Catalog,Category,Demo } from '../shared/contracts';
interface Env { DB:D1Database; MEDIA:R2Bucket; ASSETS:Fetcher; PUBLIC_ORIGIN?:string; }
const security:Record<string,string>={
 'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'strict-origin-when-cross-origin',
 'X-Frame-Options':'DENY','Permissions-Policy':'camera=(), microphone=(), geolocation=()',
 'Content-Security-Policy':"default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
};
function json(data:unknown,status=200,cache='public, max-age=60, stale-while-revalidate=300'){
 return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':cache}});
}
async function catalog(env:Env):Promise<Catalog>{
 const [categories,tools,demos,updated]=await env.DB.batch([
 env.DB.prepare('SELECT id,name,description,icon FROM categories ORDER BY position'),
 env.DB.prepare('SELECT payload FROM tools ORDER BY position'),
 env.DB.prepare('SELECT payload FROM demos ORDER BY position'),
 env.DB.prepare("SELECT value FROM metadata WHERE key='updatedAt'")]);
 if(!categories.results.length||!tools.results.length)throw new Error('CATALOG_NOT_SEEDED');
 return {categories:categories.results as unknown as Category[],tools:(tools.results as {payload:string}[]).map(parseTool),demos:(demos.results as {payload:string}[]).map(r=>JSON.parse(r.payload) as Demo),updatedAt:(updated.results[0] as {value:string})?.value||''};
}
interface CatalogSnapshot { data:Catalog; etag:string; home:string; }
async function snapshot(request:Request,env:Env,ctx:ExecutionContext):Promise<CatalogSnapshot & {cache:string}>{
 const origin=env.PUBLIC_ORIGIN||new URL(request.url).origin;
 const result=await cachedPublicResponse(origin,'catalog','all',60,ctx,async()=>{
  const data=await catalog(env);const body=JSON.stringify(data);
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body));
  const etag='"'+Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('')+'"';
  let home='';try{home=renderHomePreview(data);}catch{console.warn('Homepage preview unavailable');}
  return json({data,etag,home},200,'public, max-age=60');
 });
 return {...await result.response.json<CatalogSnapshot>(),cache:result.status};
}
async function route(request:Request,env:Env,ctx:ExecutionContext):Promise<Response>{
 const url=new URL(request.url);const path=url.pathname;const origin=env.PUBLIC_ORIGIN||url.origin;
 if(path.length>1&&path.endsWith('/')&&/^\/(tools|demos)(\/|$)/.test(path)){url.pathname=path.replace(/\/+$/,'');return Response.redirect(url.toString(),308);}
 if(path==='/api/visitors')return visitorStats(request,env.DB,origin);
 if(request.method!=='GET'&&request.method!=='HEAD'){const response=json({error:'METHOD_NOT_ALLOWED'},405,'no-store');response.headers.set('Allow','GET, HEAD');return response;}
 if(path==='/'+INDEXNOW_KEY+'.txt')return new Response(INDEXNOW_KEY,{headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'public, max-age=3600'}});
 if(path==='/api/labs'||path.startsWith('/api/labs/'))return labFetch(request,env);
 if(path==='/api/health'){
  try {const [db,logo]=await Promise.all([env.DB.prepare('SELECT count(*) AS total FROM tools').first<{total:number}>(),env.MEDIA.head('brand/logo.png')]);
   const healthy=!!db?.total&&!!logo;return json({status:healthy?'ok':'degraded',database:db?.total?'ready':'empty',storage:logo?'ready':'missing',tools:db?.total||0},healthy?200:503,'no-store');
  }catch{return json({status:'unavailable'},503,'no-store');}
 }
 if(path==='/api/catalog'){
  const entry=await snapshot(request,env,ctx);const response=json(entry.data,200,'public, max-age=60');
  response.headers.set('ETag',entry.etag);response.headers.set('X-Vibe-Cache',entry.cache);
  if(matchesEntityTag(request.headers.get('If-None-Match'),entry.etag))return new Response(null,{status:304,headers:response.headers});
  return response;
 }
 if(path==='/api/categories'){const result=await env.DB.prepare('SELECT c.id,c.name,c.description,c.icon,count(t.id) AS count FROM categories c LEFT JOIN tools t ON t.category_id=c.id GROUP BY c.id ORDER BY c.position').all();return json({categories:result.results});}
 if(path==='/api/demos'){const result=await env.DB.prepare('SELECT payload FROM demos ORDER BY position').all<{payload:string}>();return json({demos:result.results.map(r=>JSON.parse(r.payload))});}
 if(path==='/api/tools'){
  const {where,bindings,limit,offset}=queryFilters(url.searchParams);
  const [rows,count]=await env.DB.batch([env.DB.prepare('SELECT payload FROM tools'+where+' ORDER BY featured DESC,position LIMIT ? OFFSET ?').bind(...bindings,limit,offset),env.DB.prepare('SELECT count(*) AS total FROM tools'+where).bind(...bindings)]);
  return json({tools:(rows.results as {payload:string}[]).map(parseTool),total:(count.results[0] as {total:number}).total,limit,offset});
 }
 if(path.startsWith('/api/tools/')){let id:string;try{id=decodeURIComponent(path.slice(11));}catch{return json({error:'INVALID_TOOL_ID'},400,'no-store');}const row=await env.DB.prepare('SELECT payload FROM tools WHERE id=?').bind(id).first<{payload:string}>();return row?json({tool:parseTool(row)}):json({error:'TOOL_NOT_FOUND'},404);}
 if(path.startsWith('/api/'))return json({error:'NOT_FOUND'},404);
 if(path.startsWith('/media/')){
  const key=validMediaKey(path);if(!key)return json({error:'NOT_FOUND'},404,'no-store');
  // Browser caching stays bounded for mutable icon URLs; deployed cache keys invalidate on release.
  const result=await cachedPublicResponse(origin,'media',key,3600,ctx,async()=>{
   const object=await env.MEDIA.get(key);if(!object)return json({error:'NOT_FOUND'},404,'no-store');
   const headers=new Headers();object.writeHttpMetadata(headers);if(Object.hasOwn(demoAssets,key))headers.set('Content-Type',demoAssets[key]);
   headers.set('ETag',object.httpEtag);headers.set('Cache-Control',Object.hasOwn(demoAssets,key)?'public, max-age=31536000, immutable':'public, max-age=3600');
   return new Response(object.body,{headers});
  });
  const response=new Response(result.response.body,result.response);response.headers.set('X-Vibe-Cache',result.status);
  if(response.status===200&&matchesEntityTag(request.headers.get('If-None-Match'),response.headers.get('ETag')||''))return new Response(null,{status:304,headers:response.headers});
  return response;
 }
 if(path==='/robots.txt')return new Response(`User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${origin}/sitemap.xml\n`,{headers:{'Content-Type':'text/plain; charset=utf-8'}});
 if(path==='/sitemap.xml'){
  const entry=await snapshot(request,env,ctx);
  return new Response(sitemap(entry.data,origin),{headers:{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'public, max-age=60'}});
 }
 let response=await env.ASSETS.fetch(request);
 let boot:Awaited<ReturnType<typeof snapshot>>|undefined;
 if(response.headers.get('Content-Type')?.includes('text/html')){
  try{boot=await snapshot(request,env,ctx);}catch(error){console.error('Page catalog unavailable',error instanceof Error?error.message:'unknown');return new Response(response.body,{status:503,headers:response.headers});}
 }
 if(response.headers.get('Content-Type')?.includes('text/html')&&path!=='/'&&path!=='/demos'&&!/^\/(tools|demos)\/[^/]+$/.test(path))return new Response(response.body,{status:404,headers:response.headers});
 if(boot&&response.headers.get('Content-Type')?.includes('text/html')&&(
  (path.startsWith('/tools/')&&!boot.data.tools.some(item=>path==='/tools/'+encodeURIComponent(item.id)))||
  (path.startsWith('/demos/')&&!boot.data.demos.some(item=>path==='/demos/'+encodeURIComponent(item.id)))
 ))return new Response(response.body,{status:404,headers:response.headers});
 if(boot&&response.status===200&&response.headers.get('Content-Type')?.includes('text/html')){
  const seo=pageSeo(boot.data,path,origin);
  response=new HTMLRewriter()
   .on('title',{element(el){el.setInnerContent(seo.title);}})
   .on('meta[name="description"], meta[property="og:description"]',{element(el){el.setAttribute('content',seo.description);}})
   .on('meta[property="og:title"]',{element(el){el.setAttribute('content',seo.title);}})
   .on('meta[property="og:image"], meta[name="twitter:image"]',{element(el){el.setAttribute('content',origin+'/media/brand/og.png');}})
   .on('head',{element(el){el.append('<link rel="canonical" href="'+escapeXml(seo.canonical)+'"><meta property="og:url" content="'+escapeXml(seo.canonical)+'">'+seo.structured,{html:true});}})
   .transform(response);
  const preview=path==='/'?boot.home:renderHomePreview(boot.data,path);
  response=new HTMLRewriter().on('head',{element(el){el.prepend(initialThemeScript,{html:true});}}).on('#root',{element(el){if(preview)el.setInnerContent(preview,{html:true});}}).on('body',{element(el){el.append(bootstrapScript(boot!.data),{html:true});}}).transform(response);
  const headers=new Headers(response.headers);headers.set('X-Vibe-Catalog-Cache',boot.cache);
  response=new Response(response.body,{status:response.status,headers});
 }
 if(response.status===200&&path.startsWith('/assets/')&&!response.headers.get('Content-Type')?.includes('text/html')){
  const headers=new Headers(response.headers);headers.set('Cache-Control','public, max-age=31536000, immutable');
  response=new Response(response.body,{status:response.status,headers});
 }
 return response;
}
export default {
 async fetch(request:Request,env:Env,ctx:ExecutionContext):Promise<Response>{
  let response:Response;
  try {response=await route(request,env,ctx);}catch(error){console.error('Request failed', error instanceof Error?error.message:'unknown');response=json({error:'SERVICE_UNAVAILABLE',message:'服务暂时不可用，请稍后重试'},503,'no-store');}
  const headers=new Headers(response.headers);for(const [key,value] of Object.entries(security))headers.set(key,value);
  if(headers.get('Content-Type')?.includes('text/html')){
   // Cloudflare forwards this nonce to its own injected detection scripts.
   const nonce=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
   headers.set('Content-Security-Policy',security['Content-Security-Policy'].replace(/script-src[^;]*;/,`script-src 'self' 'wasm-unsafe-eval' 'nonce-${nonce}' https://static.cloudflareinsights.com;`));
   headers.set('Cache-Control','private, no-store');
   headers.delete('ETag');headers.delete('Last-Modified');
   response=new HTMLRewriter().on('script',{element(el){el.setAttribute('nonce',nonce);}}).transform(response);
  }
  const pageUrl=new URL(request.url);
  const canonicalHost=env.PUBLIC_ORIGIN?new URL(env.PUBLIC_ORIGIN).host:pageUrl.host;
  if(response.status>=400||pageUrl.pathname.startsWith('/api/')||pageUrl.host!==canonicalHost||
   (pageUrl.pathname==='/'&&['q','category','platform','pricing','favorites'].some(key=>pageUrl.searchParams.has(key))))headers.set('X-Robots-Tag','noindex');
  if(new URL(request.url).protocol==='https:')headers.set('Strict-Transport-Security','max-age=31536000');
  return new Response(request.method==='HEAD'?null:response.body,{status:response.status,headers});
 }
};
