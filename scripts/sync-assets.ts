import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {getPlatformProxy} from 'wrangler';
const mode=process.argv.includes('--remote')?'--remote':'--local';
const sources=[['brand','apps/web/public/brand'],['icons','assets/icons']];
const only=process.argv.find(x=>x.startsWith('--prefix='))?.split('=')[1];
const idsPath=process.argv.find(x=>x.startsWith('--ids-file='))?.slice('--ids-file='.length);
const ids=idsPath?new Set(JSON.parse(fs.readFileSync(idsPath,'utf8')) as string[]):null;
const proxy=mode==='--local'?await getPlatformProxy<{MEDIA:R2Bucket}>({configPath:'wrangler.jsonc',persist:true}):null;
try{
for(const [prefix,dir]of sources){
 if(only&&only!==prefix)continue;
 for(const file of fs.readdirSync(dir)){
  if(prefix==='icons'&&ids&&!ids.has(file.replace(/\.[^.]+$/,'')))continue;
  if(!/\.(png|webp|ico|svg|jpe?g|gif)$/.test(file))continue;
  const type=file.endsWith('.png')?'image/png':file.endsWith('.webp')?'image/webp':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.gif')?'image/gif':/\.jpe?g$/.test(file)?'image/jpeg':'image/x-icon';
  if(proxy){
   await proxy.env.MEDIA.put(`${prefix}/${file}`,Uint8Array.from(fs.readFileSync(path.join(dir,file))).buffer,{httpMetadata:{contentType:type}});
   console.log(`Stored ${prefix}/${file} in local R2`);continue;
  }
  const result=spawnSync('npx',['wrangler','r2','object','put',`vibe-assets/${prefix}/${file}`,'--file',path.resolve(dir,file),'--content-type',type,mode],{stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);
 }
}
}finally{await proxy?.dispose();}
