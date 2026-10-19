import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {getPlatformProxy} from 'wrangler';
import {prepareDemoAssets} from './demo-assets';
const assets=prepareDemoAssets(),remote=process.argv.includes('--remote');
const proxy=remote?null:await getPlatformProxy<{MEDIA:R2Bucket}>({configPath:'wrangler.jsonc',persist:true});
try{
 for(const asset of assets){
  if(proxy){await proxy.env.MEDIA.put(asset.key,Uint8Array.from(fs.readFileSync(asset.file)).buffer,{httpMetadata:{contentType:asset.contentType}});console.log('Stored local '+asset.key);}
  else {
   const result=spawnSync('npx',['wrangler','r2','object','put','vibe-assets/'+asset.key,'--file',asset.file,'--content-type',asset.contentType,'--remote'],{stdio:'inherit',env:process.env});
   if(result.status!==0)throw new Error('R2 asset upload failed: '+asset.key);
  }
 }
}finally{await proxy?.dispose();}
