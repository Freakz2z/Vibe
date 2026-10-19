import {Hono} from 'hono';
import {and, asc, eq} from 'drizzle-orm';
import {drizzle} from 'drizzle-orm/d1';
import {DummyDriver, Kysely, SqliteAdapter, SqliteIntrospector, SqliteQueryCompiler, sql} from 'kysely';
import {demoCustomers, demoOrders} from './labs-schema';
export interface LabEnv { DB:D1Database; MEDIA:R2Bucket; }
interface TraceVariables { requestId:string; trace:string[]; greeting?:{name:string;message:string}; }
const app=new Hono<{Bindings:LabEnv;Variables:TraceVariables}>().basePath('/api/labs');
const regions=['all','华东','华南','华北','西部'];
const statuses=['all','paid','pending','refunded'];
const noStore={'Cache-Control':'no-store'};
const error=(message:string,status=400)=>Response.json({error:message},{status,headers:noStore});
function selection(params:URLSearchParams) {
 const region=params.get('region')??'all',status=params.get('status')??'paid';
 return regions.includes(region)&&statuses.includes(status)?{region,status}:null;
}
export function boundedInteger(value:string|null,fallback:number,min:number,max:number):number|null {
 if(value===null)return fallback;
 if(!/^\d+$/.test(value))return null;
 const n=Number(value);return Number.isSafeInteger(n)&&n>=min&&n<=max?n:null;
}
export function escapeHtml(value:string):string {
 return value.replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]!));
}
app.use('*',async(c,next)=>{c.header('Cache-Control','no-store');await next();});
// The trace is collected during real middleware execution, then serialized after both unwind.
app.use('/hono/*',async(c,next)=>{
 const id=crypto.randomUUID();c.set('requestId',id);c.set('trace',['request:before']);
 c.header('X-Demo-Router','Hono');c.header('X-Request-Id',id);
 await next();c.get('trace').push('request:after');
 const greeting=c.get('greeting');
 if(greeting)c.res=c.json({technology:'Hono',...greeting,requestId:id,trace:c.get('trace'),generatedAt:new Date().toISOString()});
});
app.use('/hono/*',async(c,next)=>{c.get('trace').push('timing:before');await next();c.get('trace').push('timing:after');});
app.get('/hono/greet/:name',c=>{
 const name=c.req.param('name').trim(),greeting=c.req.query('greeting')??'你好';
 if(!name||name.length>80||greeting.length>40)return c.json({error:'INVALID_GREETING'},400);
 c.get('trace').push('handler');c.set('greeting',{name,message:`${greeting}，${name}`});
 return c.body(null,204);
});
app.get('/query',async c=>{
 const params=new URL(c.req.url).searchParams,key=params.get('key')??'alpha';
 const delay=boundedInteger(params.get('delay'),400,0,1200),fail=params.get('fail')??'0';
 if(!key||key.length>40||delay===null||!['0','1'].includes(fail))return error('INVALID_QUERY');
 if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
 if(fail==='1')return error('DEMONSTRATION_FAILURE',503);
 // A stable key changes the real catalog slice; request IDs expose actual SDK cache hits.
 let offset=0;for(const ch of key)offset=(offset*31+ch.charCodeAt(0))%210;
 const result=await c.env.DB.prepare('SELECT t.id,t.name,c.name AS category FROM tools t JOIN categories c ON c.id=t.category_id ORDER BY t.position LIMIT 4 OFFSET ?').bind(offset).all();
 return c.json({key,requestId:crypto.randomUUID(),generatedAt:new Date().toISOString(),items:result.results,count:result.results.length});
});
app.get('/d1',async c=>{
 const params=new URL(c.req.url).searchParams,filters=selection(params),view=params.get('view')??'summary';
 if(!filters||!['orders','summary','ranking'].includes(view))return error('INVALID_QUERY');
 const conditions:string[]=[],parameters:string[]=[];
 if(filters.region!=='all'){conditions.push('region = ?');parameters.push(filters.region);}
 if(filters.status!=='all'){conditions.push('status = ?');parameters.push(filters.status);}
 const where=conditions.length?' WHERE '+conditions.join(' AND '):'';
 const queries:Record<string,string>={
  orders:'SELECT id AS orderId, customer_id AS customerId, region, status, total_cents AS totalCents, ordered_at AS orderedAt FROM demo_orders'+where+' ORDER BY ordered_at DESC, id LIMIT 40',
  summary:'SELECT region, COUNT(*) AS orderCount, SUM(total_cents) AS totalCents, ROUND(AVG(total_cents), 0) AS averageCents FROM demo_orders'+where+' GROUP BY region ORDER BY totalCents DESC, region',
  ranking:'SELECT id AS orderId, region, total_cents AS totalCents, DENSE_RANK() OVER (PARTITION BY region ORDER BY total_cents DESC) AS regionRank FROM demo_orders'+where+' ORDER BY region, regionRank, id LIMIT 40',
 };
 const started=performance.now(),result=await c.env.DB.prepare(queries[view]).bind(...parameters).all();
 return c.json({technology:'Cloudflare D1',sql:queries[view],parameters,rows:result.results,durationMs:Math.round((performance.now()-started)*100)/100,source:'demo_orders'});
});
app.get('/drizzle',async c=>{
 const filters=selection(new URL(c.req.url).searchParams);if(!filters)return error('INVALID_QUERY');
 const db=drizzle(c.env.DB),clauses=[];
 if(filters.region!=='all')clauses.push(eq(demoOrders.region,filters.region));
 if(filters.status!=='all')clauses.push(eq(demoOrders.status,filters.status));
 const query=db.select({orderId:demoOrders.id,customer:demoCustomers.name,region:demoOrders.region,status:demoOrders.status,totalCents:demoOrders.totalCents})
 .from(demoOrders).innerJoin(demoCustomers,eq(demoOrders.customerId,demoCustomers.id)).where(and(...clauses)).orderBy(asc(demoOrders.id)).limit(40);
 const compiled=query.toSQL(),rows=await query.all();
 return c.json({technology:'Drizzle ORM',sql:compiled.sql,parameters:compiled.params,rows,source:'demo_orders + demo_customers'});
});
interface QuerySchema {demo_orders:{id:string;customer_id:string;region:string;status:string;total_cents:number;ordered_at:string;};}
const builder=new Kysely<QuerySchema>({dialect:{
 createAdapter:()=>new SqliteAdapter(),createDriver:()=>new DummyDriver(),
 createIntrospector:db=>new SqliteIntrospector(db),createQueryCompiler:()=>new SqliteQueryCompiler(),
}});
app.get('/kysely',async c=>{
 const params=new URL(c.req.url).searchParams,region=params.get('region')??'all',minimum=boundedInteger(params.get('minimum'),0,0,100000);
 if(!regions.includes(region)||minimum===null)return error('INVALID_QUERY');
 let query=builder.selectFrom('demo_orders').select(['region',sql<number>`count(*)`.as('orderCount'),sql<number>`sum(total_cents)`.as('totalCents')]);
 if(region!=='all')query=query.where('region','=',region);
 const compiled=query.groupBy('region').having(sql<number>`sum(total_cents)`,'>=',minimum).orderBy('totalCents','desc').orderBy('region','asc').compile();
 // Kysely compiles; D1 actually executes. DummyDriver is deliberately never executed.
 const result=await c.env.DB.prepare(compiled.sql).bind(...compiled.parameters).all();
 return c.json({technology:'Kysely',sql:compiled.sql,parameters:compiled.parameters,rows:result.results,source:'demo_orders'});
});
export function parseByteRange(value:string,size:number):{offset:number;length:number}|null {
 const match=/^bytes=(\d*)-(\d*)$/.exec(value);if(!match||(!match[1]&&!match[2])||size<=0)return null;
 let start:number,end:number;
 if(!match[1]){const suffix=Number(match[2]);if(!Number.isSafeInteger(suffix)||suffix<=0)return null;start=Math.max(0,size-suffix);end=size-1;}
 else {start=Number(match[1]);end=match[2]?Math.min(Number(match[2]),size-1):size-1;}
 return Number.isSafeInteger(start)&&Number.isSafeInteger(end)&&start>=0&&start<size&&end>=start?{offset:start,length:end-start+1}:null;
}
app.on(['GET','HEAD'],'/r2',async c=>{
 const key='brand/logo.png',meta=await c.env.MEDIA.head(key);if(!meta)return error('OBJECT_NOT_FOUND',404);
 const headers=new Headers(noStore);meta.writeHttpMetadata(headers);headers.set('ETag',meta.httpEtag);headers.set('Accept-Ranges','bytes');headers.set('X-Object-Key',key);headers.set('Content-Length',String(meta.size));
 const conditional=c.req.header('If-None-Match');
 if(conditional?.split(',').some(x=>x.trim()==='*'||x.trim().replace(/^W\//,'')===meta.httpEtag))return new Response(null,{status:304,headers});
 if(c.req.method==='HEAD')return new Response(null,{headers});
 const rawRange=c.req.header('Range'),ifRange=c.req.header('If-Range');
 const useRange=rawRange&&(!ifRange||ifRange===meta.httpEtag);
 const range=useRange?parseByteRange(rawRange,meta.size):undefined;
 if(range===null){headers.set('Content-Range',`bytes */${meta.size}`);headers.delete('Content-Length');return new Response(null,{status:416,headers});}
 const object=await c.env.MEDIA.get(key,range?{range}:undefined);if(!object||!('body' in object))return error('OBJECT_NOT_FOUND',404);
 if(range){headers.set('Content-Range',`bytes ${range.offset}-${range.offset+range.length-1}/${meta.size}`);headers.set('Content-Length',String(range.length));}
 return new Response(object.body,{status:range?206:200,headers});
});
app.get('/htmx/search',async c=>{
 const q=c.req.query('q')??'';if(q.length>80)return error('INVALID_SEARCH');
 const rows=await c.env.DB.prepare('SELECT id,name,json_extract(payload,\'$.tagline\') AS tagline FROM tools WHERE instr(search_text,?)>0 ORDER BY position LIMIT 8').bind(q.trim().toLowerCase()).all<{id:string;name:string;tagline:string}>();
 const html=rows.results.length?`<ul class="htmx-results">${rows.results.map(t=>`<li><a href="/tools/${encodeURIComponent(t.id)}">${escapeHtml(t.name)}</a><p>${escapeHtml(t.tagline)}</p></li>`).join('')}</ul>`:'<p role="status">没有匹配的工具</p>';
 return c.html(html);
});
app.notFound(c=>c.json({error:'NOT_FOUND'},404));
export const labFetch=(request:Request,env:LabEnv)=>app.fetch(request,env);
