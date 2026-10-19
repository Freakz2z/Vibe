import fs from 'node:fs';
import assert from 'node:assert/strict';
import type {Catalog} from '../shared/contracts';
const catalog=JSON.parse(fs.readFileSync('data/catalog.json','utf8')) as Catalog;
assert(catalog.categories.length>=10,'至少10个分类');assert(catalog.tools.length>=48,'至少48个工具');assert(catalog.demos.length>=6,'至少6个示例');
const ids=new Set<string>();const cats=new Set(catalog.categories.map(x=>x.id));const demos=new Set(catalog.demos.map(x=>x.id));
const quote=(s:string)=>"'"+s.replaceAll("'","''")+"'";
const sql=['-- Generated from data/catalog.json. Update via npm run seed:build.'];
for(const [i,c] of catalog.categories.entries()){assert(/^[a-z0-9-]+$/.test(c.id));sql.push(`INSERT INTO categories(id,name,description,icon,position) VALUES(${[c.id,c.name,c.description,c.icon].map(quote).join(',')},${i}) ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,icon=excluded.icon,position=excluded.position;`);}
for(const [i,t]of catalog.tools.entries()){
 assert(/^[a-z0-9-]+$/.test(t.id)&&!ids.has(t.id),'Invalid or duplicate tool id '+t.id);ids.add(t.id);assert(cats.has(t.categoryId),'Unknown category');assert(!t.demoId||demos.has(t.demoId),'Unknown demo');assert(new URL(t.website).protocol==='https:','HTTPS required');assert(t.name&&t.tagline&&t.description&&t.useCases?.length&&t.highlights?.length,'Content missing '+t.id);assert(['开源免费','免费使用','免费增值','付费'].includes(t.pricing),'Invalid pricing');
 const search=[t.name,t.tagline,t.description,...t.tags,...t.useCases].join(' ').toLowerCase();
 sql.push(`INSERT INTO tools(id,name,category_id,pricing,featured,demo_id,search_text,payload,position) VALUES(${[t.id,t.name,t.categoryId,t.pricing].map(quote).join(',')},${t.featured?1:0},${t.demoId?quote(t.demoId):'NULL'},${quote(search)},${quote(JSON.stringify(t))},${i}) ON CONFLICT(id) DO UPDATE SET name=excluded.name,category_id=excluded.category_id,pricing=excluded.pricing,featured=excluded.featured,demo_id=excluded.demo_id,search_text=excluded.search_text,payload=excluded.payload,position=excluded.position;`);
}
for(const [i,d]of catalog.demos.entries()){assert(/^[a-z0-9-]+$/.test(d.id));assert(d.toolIds.every(id=>ids.has(id)),'Demo tool missing');sql.push(`INSERT INTO demos(id,payload,position) VALUES(${quote(d.id)},${quote(JSON.stringify(d))},${i}) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,position=excluded.position;`);}
sql.push(`INSERT INTO metadata(key,value) VALUES('updatedAt',${quote(catalog.updatedAt)}) ON CONFLICT(key) DO UPDATE SET value=excluded.value;`);
const contents=sql.join('\n')+'\n';
let output='migrations/0002_catalog.sql';
if(process.argv.includes('--next')){
 const highest=Math.max(...fs.readdirSync('migrations').map(f=>Number(f.match(/^(\d+)_/)?.[1]||0)));
 output='migrations/'+String(highest+1).padStart(4,'0')+'_catalog_update.sql';
}else if(fs.existsSync(output)&&fs.readFileSync(output,'utf8')!==contents){
 const matching=fs.readdirSync('migrations').filter(f=>f.endsWith('.sql')&&f.includes('catalog')).find(f=>fs.readFileSync('migrations/'+f,'utf8')===contents);
 if(!matching)throw new Error('Refusing to rewrite an existing migration. Use npm run seed:build -- --next for content updates.');
 output='migrations/'+matching;
}
fs.writeFileSync(output,contents);console.log(`Validated ${catalog.tools.length} tools, ${catalog.categories.length} categories, ${catalog.demos.length} demos; wrote ${output}`);
