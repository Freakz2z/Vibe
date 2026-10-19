import assert from 'node:assert/strict';
const base=(process.argv[2]||'http://127.0.0.1:8787').replace(/\/$/,'');
let checks=0;
function check(name:string,fn:()=>void){fn();checks++;console.log('PASS '+name);}
async function request(path:string,init?:RequestInit){return fetch(base+path,init);}
async function data(path:string){const response=await request(path);assert.equal(response.status,200,path);assert.equal(response.headers.get('Cache-Control'),'no-store');return response.json() as Promise<any>;}
const greeting=await data('/api/labs/hono/greet/%E8%AE%BF%E5%AE%A2?greeting=Hello');
check('actual Hono middleware unwinds in order',()=>{assert.equal(greeting.message,'Hello，访客');assert.deepEqual(greeting.trace,['request:before','timing:before','handler','timing:after','request:after']);assert(greeting.requestId);});
const route=await request('/api/labs/hono/greet/Vibe');
check('router headers identify the actual request',()=>{assert.equal(route.headers.get('X-Demo-Router'),'Hono');assert(route.headers.get('X-Request-Id'));assert.notEqual(route.headers.get('X-Request-Id'),greeting.requestId);});
// Each request must produce a different ID; clients display repeated IDs only when SDK cache is used.
const q1=await data('/api/labs/query?key=alpha&delay=0'),q2=await data('/api/labs/query?key=alpha&delay=0');
check('query source is real catalog and never HTTP cached',()=>{assert(q1.items.length>0);assert.deepEqual(q1.items,q2.items);assert.notEqual(q1.requestId,q2.requestId);assert.equal(q1.count,q1.items.length);});
const failure=await request('/api/labs/query?fail=1&delay=0');check('retry example receives real 503',()=>assert.equal(failure.status,503));
const orders=await data('/api/labs/d1?view=orders&status=all');
const summary=await data('/api/labs/d1?view=summary&status=all');
check('D1 aggregate exactly matches queried sample rows',()=>{
 assert.equal(orders.rows.length,32);assert.equal(summary.rows.reduce((n:number,r:any)=>n+r.orderCount,0),orders.rows.length);
 assert.equal(summary.rows.reduce((n:number,r:any)=>n+r.totalCents,0),orders.rows.reduce((n:number,r:any)=>n+r.totalCents,0));
 assert.equal(summary.source,'demo_orders');assert(summary.sql.includes('GROUP BY'));assert(summary.durationMs>=0);
});
const ranking=await data('/api/labs/d1?view=ranking&region='+encodeURIComponent('华东')+'&status=all');
check('D1 window ranks partitioned results',()=>{assert(ranking.sql.includes('DENSE_RANK() OVER'));assert(ranking.rows.every((r:any)=>r.region==='华东'));assert.equal(ranking.rows[0].regionRank,1);assert(ranking.rows.every((r:any,i:number,a:any[])=>i===0||r.totalCents<=a[i-1].totalCents));});
const orm=await data('/api/labs/drizzle?region='+encodeURIComponent('华东')+'&status=paid');
check('Drizzle executes joins and bound conditions through D1',()=>{assert(orm.sql.includes('inner join'));assert.deepEqual(orm.parameters,['华东','paid',40]);assert.equal(orm.rows.length,orders.rows.filter((r:any)=>r.region==='华东'&&r.status==='paid').length);assert(orm.rows.every((r:any)=>r.customer.startsWith('示例客户')&&r.status==='paid'));});
const kysely=await data('/api/labs/kysely?minimum=0');
check('Kysely compiled aggregate executes on the same D1 rows',()=>{assert(kysely.sql.includes('having'));assert.deepEqual(kysely.parameters,[0]);assert.equal(kysely.rows.reduce((n:number,r:any)=>n+r.totalCents,0),orders.rows.reduce((n:number,r:any)=>n+r.totalCents,0));});
const filtered=await data('/api/labs/kysely?minimum=70000');check('Kysely HAVING changes real results',()=>{assert(filtered.rows.length<kysely.rows.length);assert(filtered.rows.every((r:any)=>r.totalCents>=70000));});
for(const path of ['/api/labs/query?delay=1201','/api/labs/query?delay=1e3','/api/labs/query?fail=2','/api/labs/d1?view=DROP%20TABLE','/api/labs/d1?region=unknown','/api/labs/drizzle?status=unknown','/api/labs/kysely?minimum=-1','/api/labs/htmx/search?q='+('a'.repeat(81))]){
 const response=await request(path);check('reject invalid input '+path.slice(0,70),()=>assert.equal(response.status,400));
}
const htmx=await request('/api/labs/htmx/search?q=gsap');const html=await htmx.text();check('htmx gets server HTML from real D1 catalog',()=>{assert(htmx.headers.get('Content-Type')?.startsWith('text/html'));assert(html.includes('GSAP'));assert(html.includes('/tools/gsap'));assert(!/<script/i.test(html));});
const xss=await request('/api/labs/htmx/search?q=%3Cscript%3Ealert(1)%3C/script%3E');check('search input is not echoed as executable markup',()=>assert(!xss.headers.get('Content-Type')?.includes('javascript')));
assert(!(await xss.text()).includes('<script>'));
const head=await request('/api/labs/r2',{method:'HEAD'}),etag=head.headers.get('ETag'),size=Number(head.headers.get('Content-Length'));
check('R2 metadata is actual object metadata',()=>{assert.equal(head.status,200);assert(size>64);assert(etag?.startsWith('"'));assert.equal(head.headers.get('X-Object-Key'),'brand/logo.png');assert.equal(head.headers.get('Accept-Ranges'),'bytes');assert.equal(head.headers.get('Content-Type'),'image/png');});
const full=await request('/api/labs/r2'),fullBytes=new Uint8Array(await full.arrayBuffer());
const partial=await request('/api/labs/r2',{headers:{Range:'bytes=0-63'}}),partBytes=new Uint8Array(await partial.arrayBuffer());
check('R2 range really returns the requested object bytes',()=>{assert.equal(fullBytes.length,size);assert.equal(partial.status,206);assert.equal(partial.headers.get('Content-Range'),`bytes 0-63/${size}`);assert.deepEqual(partBytes,fullBytes.slice(0,64));assert.deepEqual(Array.from(partBytes.slice(0,8)),[137,80,78,71,13,10,26,10]);});
const notModified=await request('/api/labs/r2',{headers:{'If-None-Match':etag!}});check('R2 conditional GET is 304 with no bytes',()=>assert.equal(notModified.status,304));assert.equal((await notModified.arrayBuffer()).byteLength,0);
const outside=await request('/api/labs/r2',{headers:{Range:`bytes=${size}-`}});check('R2 unsatisfiable range is 416',()=>{assert.equal(outside.status,416);assert.equal(outside.headers.get('Content-Range'),`bytes */${size}`);});
for(const path of ['/api/labs/r2','/api/labs/d1','/api/labs/hono/greet/Vibe']){
 const response=await request(path,{method:'POST'});check('read-only method '+path,()=>{assert.equal(response.status,405);assert.equal(response.headers.get('Allow'),'GET, HEAD');});
}
const unknown=await request('/api/labs/hono/unknown');check('unknown demo route is 404',()=>assert.equal(unknown.status,404));
console.log(`Verified ${checks} actual service checks against ${base}`);
