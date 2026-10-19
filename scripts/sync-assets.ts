import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const mode=process.argv.includes('--remote')?'--remote':'--local';
const sources=[['brand','apps/web/public/brand'],['icons','assets/icons']];
const only=process.argv.find(x=>x.startsWith('--prefix='))?.split('=')[1];
for(const [prefix,dir]of sources){
 if(only&&only!==prefix)continue;
 for(const file of fs.readdirSync(dir)){
  if(!/\.(png|webp|ico|svg|jpe?g)$/.test(file))continue;
  const type=file.endsWith('.png')?'image/png':file.endsWith('.webp')?'image/webp':file.endsWith('.svg')?'image/svg+xml':/\.jpe?g$/.test(file)?'image/jpeg':'image/x-icon';
  const result=spawnSync('npx',['wrangler','r2','object','put',`vibe-assets/${prefix}/${file}`,'--file',path.resolve(dir,file),'--content-type',type,mode],{stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);
 }
}
