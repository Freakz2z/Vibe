import fs from 'node:fs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile);
const c=JSON.parse(fs.readFileSync('data/catalog.json','utf8'));const queue=c.tools.filter(t=>t.github);const results=[];
await Promise.all(Array.from({length:5},async()=>{while(queue.length){const t=queue.shift();try{const {stdout}=await run('gh',['api','repos/'+new URL(t.github).pathname.slice(1),'--jq','{full_name,html_url,homepage,archived,disabled,description,license:.license.spdx_id,default_branch}'],{timeout:25000});results.push({id:t.id,...JSON.parse(stdout)});}catch(e){results.push({id:t.id,error:e.stderr?.slice(0,200)||e.message});}}}));
results.sort((a,b)=>a.id.localeCompare(b.id));fs.writeFileSync('artifacts/repository-audit.json',JSON.stringify({checkedAt:new Date().toISOString(),results},null,2));console.log(JSON.stringify({total:results.length,review:results.filter(r=>r.error||r.archived||r.disabled||!r.license||r.license==='NOASSERTION')},null,2));
