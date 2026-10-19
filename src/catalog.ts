import type { Tool } from '../shared/contracts';
export function queryFilters(params: URLSearchParams) {
 const q = (params.get('q') || '').trim().slice(0,120).toLowerCase();
 const category = (params.get('category') || '').slice(0,80);
 const platform = params.get('platform') || '';
 const pricing = params.get('pricing') || '';
 const demo = params.get('demo') === '1';
 const featured = params.get('featured') === '1';
 const where:string[] = []; const bindings:(string|number)[]=[];
 if(q){ where.push('instr(search_text, ?) > 0'); bindings.push(q); }
 if(category){ where.push('category_id = ?'); bindings.push(category); }
 if(['Web','Mobile','CLI'].includes(platform)){ where.push("EXISTS (SELECT 1 FROM json_each(payload, '$.platforms') WHERE value = ?)"); bindings.push(platform); }
 if(['开源免费','免费使用','免费增值','付费'].includes(pricing)){where.push('pricing = ?');bindings.push(pricing);}
 if(demo) where.push('demo_id IS NOT NULL');
 if(featured) where.push('featured = 1');
 const parse=(key:string,fallback:number,max:number)=>{const raw=Number(params.get(key) ?? fallback);return Number.isFinite(raw)?Math.min(max,Math.max(key==='limit'?1:0,Math.floor(raw))):fallback;};
 return {where:where.length?' WHERE '+where.join(' AND '):'',bindings,limit:parse('limit',60,100),offset:parse('offset',0,100000)};
}
export function parseTool(row:{payload:string}):Tool { return JSON.parse(row.payload) as Tool; }
export function validMediaKey(path:string):string|null {
 try { const key=decodeURIComponent(path.replace(/^\/media\//,'')); return /^(brand|icons|previews)\/[a-zA-Z0-9_./-]+\.(png|webp|jpg|jpeg|svg|ico|gif)$/.test(key) && !key.split('/').some(s=>s==='..'||s==='.') ? key:null; } catch {return null;}
}
