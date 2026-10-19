import {parseTool,queryFilters,validMediaKey} from './catalog';
import type { Catalog,Category,Demo } from '../shared/contracts';
interface Env { DB:D1Database; MEDIA:R2Bucket; ASSETS:Fetcher; PUBLIC_ORIGIN?:string; }
const security:Record<string,string>={
 'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'strict-origin-when-cross-origin',
 'X-Frame-Options':'DENY','Permissions-Policy':'camera=(), microphone=(), geolocation=()',
 'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
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
async function route(request:Request,env:Env):Promise<Response>{
 const url=new URL(request.url);const path=url.pathname;const origin=env.PUBLIC_ORIGIN||url.origin;
 if(path.length>1&&path.endsWith('/')&&/^\/(tools|demos)(\/|$)/.test(path)){url.pathname=path.replace(/\/+$/,'');return Response.redirect(url.toString(),308);}
 if(request.method!=='GET'&&request.method!=='HEAD'){const response=json({error:'METHOD_NOT_ALLOWED'},405,'no-store');response.headers.set('Allow','GET, HEAD');return response;}
 if(path==='/api/health'){
  try {const [db,logo]=await Promise.all([env.DB.prepare('SELECT count(*) AS total FROM tools').first<{total:number}>(),env.MEDIA.head('brand/logo.png')]);
   const healthy=!!db?.total&&!!logo;return json({status:healthy?'ok':'degraded',database:db?.total?'ready':'empty',storage:logo?'ready':'missing',tools:db?.total||0},healthy?200:503,'no-store');
  }catch{return json({status:'unavailable'},503,'no-store');}
 }
 if(path==='/api/catalog')return json(await catalog(env));
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
  const object=await env.MEDIA.get(key);if(!object)return json({error:'NOT_FOUND'},404,'no-store');
  const headers=new Headers();object.writeHttpMetadata(headers);headers.set('ETag',object.httpEtag);headers.set('Cache-Control','public, max-age=3600');
  if(request.headers.get('If-None-Match')===object.httpEtag)return new Response(null,{status:304,headers});
  return new Response(object.body,{headers});
 }
 if(path==='/robots.txt')return new Response(`User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${origin}/sitemap.xml\n`,{headers:{'Content-Type':'text/plain; charset=utf-8'}});
 if(path==='/sitemap.xml'){
  const [tools,demos]=await env.DB.batch([env.DB.prepare('SELECT id FROM tools'),env.DB.prepare('SELECT id FROM demos')]);
  const urls=['/','/demos',...(tools.results as {id:string}[]).map(r=>'/tools/'+encodeURIComponent(r.id)),...(demos.results as {id:string}[]).map(r=>'/demos/'+encodeURIComponent(r.id))];
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(path=>`<url><loc>${origin}${path}</loc></url>`).join('')}</urlset>`,{headers:{'Content-Type':'application/xml; charset=utf-8'}});
 }
 let response=await env.ASSETS.fetch(request);
 if(response.headers.get('Content-Type')?.includes('text/html')){
  response=new HTMLRewriter().on('meta[property="og:image"], meta[name="twitter:image"]',{element(el){el.setAttribute('content',origin+'/media/brand/og.png');}}).on('head',{element(el){el.append('<link rel="canonical" href="'+origin+url.pathname+'"><meta property="og:url" content="'+origin+url.pathname+'">',{html:true});}}).transform(response);
 }
 if(path.startsWith('/tools/')&&response.headers.get('Content-Type')?.includes('text/html')){
  const row=await env.DB.prepare('SELECT payload FROM tools WHERE id=?').bind(path.slice(7)).first<{payload:string}>();
  if(!row)return new Response(response.body,{status:404,headers:response.headers});
  const tool=parseTool(row);
  return new HTMLRewriter().on('title',{element(el){el.setInnerContent(`${tool.name} · Vibe 工具集`);}}).on('meta[name="description"]',{element(el){el.setAttribute('content',tool.tagline);}}).on('meta[property="og:title"]',{element(el){el.setAttribute('content',`${tool.name} · Vibe 工具集`);}}).on('meta[property="og:description"]',{element(el){el.setAttribute('content',tool.tagline);}}).on('link[rel="canonical"]',{element(el){el.setAttribute('href',`${origin}/tools/${tool.id}`);}}).transform(response);
 }
 if(path.startsWith('/demos/')&&response.headers.get('Content-Type')?.includes('text/html')){
  const row=await env.DB.prepare('SELECT payload FROM demos WHERE id=?').bind(path.slice(7)).first<{payload:string}>();
  if(!row)return new Response(response.body,{status:404,headers:response.headers});
  const demo=JSON.parse(row.payload) as Demo;
  return new HTMLRewriter().on('title',{element(el){el.setInnerContent(demo.name+' · Vibe 工具集');}}).on('meta[name="description"], meta[property="og:description"]',{element(el){el.setAttribute('content',demo.description);}}).on('meta[property="og:title"]',{element(el){el.setAttribute('content',demo.name+' · Vibe 工具集');}}).transform(response);
 }
 if(response.headers.get('Content-Type')?.includes('text/html')&&path!=='/'&&path!=='/demos')return new Response(response.body,{status:404,headers:response.headers});
 return response;
}
export default {
 async fetch(request:Request,env:Env):Promise<Response>{
  let response:Response;
  try {response=await route(request,env);}catch(error){console.error('Request failed', error instanceof Error?error.message:'unknown');response=json({error:'SERVICE_UNAVAILABLE',message:'服务暂时不可用，请稍后重试'},503,'no-store');}
  const headers=new Headers(response.headers);for(const [key,value] of Object.entries(security))headers.set(key,value);
  if(headers.get('Content-Type')?.includes('text/html')){
   // Cloudflare forwards this nonce to its own injected detection scripts.
   const nonce=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
   headers.set('Content-Security-Policy',security['Content-Security-Policy'].replace("script-src 'self';",`script-src 'self' 'nonce-${nonce}' https://static.cloudflareinsights.com;`));
   headers.set('Cache-Control','private, no-store');
   headers.delete('ETag');headers.delete('Last-Modified');
   response=new HTMLRewriter().on('script',{element(el){el.setAttribute('nonce',nonce);}}).transform(response);
  }
  if(new URL(request.url).pathname.startsWith('/api/'))headers.set('X-Robots-Tag','noindex');
  if(new URL(request.url).protocol==='https:')headers.set('Strict-Transport-Security','max-age=31536000');
  return new Response(request.method==='HEAD'?null:response.body,{status:response.status,headers});
 }
};
