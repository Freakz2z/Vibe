import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const mode=process.argv.includes('--remote')?'--remote':'--local';
for(const file of fs.readdirSync('apps/web/public/brand')){
 if(!/\.(png|webp|ico|svg)$/.test(file))continue;
 const type=file.endsWith('.png')?'image/png':file.endsWith('.webp')?'image/webp':file.endsWith('.svg')?'image/svg+xml':'image/x-icon';
 const result=spawnSync('npx',['wrangler','r2','object','put',`vibe-assets/brand/${file}`,'--file',path.resolve('apps/web/public/brand',file),'--content-type',type,mode],{stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);
}
