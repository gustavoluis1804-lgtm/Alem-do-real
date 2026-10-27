import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const source=fileURLToPath(new URL('../web/index.html',import.meta.url));
const target=fileURLToPath(new URL('../public/index.html',import.meta.url));
let html=await readFile(source,'utf8');
// Keep the markup, styles and animation scripts on the same release in cached tabs.
const assetPattern=/(?:src|href)="([^"?#]+\.(?:css|js))(?:\?[^"#]*)?"/g;
const assets=[...new Set([...html.matchAll(assetPattern)].map(match=>match[1]))];
const versions=new Map(await Promise.all(assets.map(async asset=>{
  const bytes=await readFile(new URL('../public/'+asset,import.meta.url));
  return [asset,createHash('sha256').update(bytes).digest('hex').slice(0,12)];
})));
html=html.replace(assetPattern,(attribute,asset)=>attribute.replace(/="[^"]*"$/,`="${asset}?v=${versions.get(asset)}"`));
await writeFile(source,html);
await writeFile(target,html);
console.log('Experiência Além do Real preparada.');
