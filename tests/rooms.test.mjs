import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { resolve,dirname } from 'node:path';

const require=createRequire(import.meta.url);
const wranglerPath=require.resolve('wrangler');
const {Miniflare}=await import(require.resolve('miniflare',{paths:[dirname(wranglerPath)]}));
const {build}=await import(require.resolve('esbuild',{paths:[dirname(wranglerPath)]}));
const bundled=await build({stdin:{contents:"import {handleRoomRequest} from './server/room-service.mjs'; export default {fetch:handleRoomRequest};",resolveDir:process.cwd(),sourcefile:'test-worker.mjs'},bundle:true,format:'esm',platform:'browser',write:false});
const mf=new Miniflare({modules:true,script:bundled.outputFiles[0].text,compatibilityDate:'2026-05-15',d1Databases:{DB:'test-database'}});
const db=await mf.getD1Database('DB');
const migration=await readFile('drizzle/0000_aromatic_titanium_man.sql','utf8');
for(const statement of migration.split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(statement).run();
after(()=>mf.dispose());
const base='https://test.example';
async function request(path='',method='GET',body,headers={}){
  const response=await mf.dispatchFetch(base+'/api/rooms'+path,{method,headers:{Origin:base,...(body?{'Content-Type':'application/json'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});
  return {status:response.status,data:await response.json()};
}
let code,token;
test('room workflow with real D1: authorization, hidden answers, votes and exports',async()=>{
  assert.equal((await request('','POST',{})).status,401);
  const created=await request('','POST',{}, {'oai-authenticated-user-id':'presenter'});
  assert.equal(created.status,201);code=created.data.code;token=created.data.hostToken;
  assert.match(code,/^[A-Z2-9]{6}$/);assert.equal(created.data.phase,'lobby');
  const host={Authorization:'Bearer '+token};
  assert.equal((await request('/'+code+'/control','POST',{action:'open',round:0})).status,403);
  const opened=await request('/'+code+'/control','POST',{action:'open',round:0},host);
  assert.equal(opened.data.phase,'open');
  assert.equal(opened.data.correctChoice,undefined);
  assert.ok(opened.data.samples.every(s=>s.isAI===undefined&&s.origin===undefined));
  const vote={round:0,choice:'A',confidence:85,participantId:'participant_browser_identifier_123'};
  assert.equal((await request('/'+code+'/vote','POST',{...vote,confidence:101})).status,400);
  assert.equal((await request('/'+code+'/vote','POST',vote)).status,200);
  assert.equal((await request('/'+code+'/vote','POST',{...vote,choice:'B'})).status,200);
  let snap=await request('/'+code);assert.equal(snap.data.responses,1);assert.equal(snap.data.statistics,undefined);
  assert.equal((await request('/'+code+'/report')).status,403);
  assert.equal((await request('/'+code+'/control','POST',{action:'open',round:1},host)).status,409);
  const revealed=await request('/'+code+'/control','POST',{action:'reveal'},host);
  assert.equal(revealed.data.phase,'revealed');assert.ok(['A','B'].includes(revealed.data.correctChoice));
  assert.equal(revealed.data.statistics.responses,1);assert.equal(revealed.data.statistics.B,1);
  assert.equal((await request('/'+code+'/vote','POST',vote)).status,409);
  assert.equal((await request('/'+code+'/control','POST',{action:'open',round:0},host)).status,409);
  assert.equal((await request('/'+code+'/control','POST',{action:'open',round:1},host)).status,200);
  assert.equal((await request('/'+code+'/vote','POST',vote)).status,409);
  assert.equal((await request('/'+code+'/vote','POST',{...vote,round:1})).status,200);
  const exported=await request('/'+code+'/report','GET',undefined,host);
  assert.equal(exported.data.browserIdentifiers,1);assert.equal(exported.data.rounds.filter(r=>r.responses).length,2);
  assert.equal(exported.data.hostToken,undefined);assert.equal(JSON.stringify(exported.data).includes('participant_hash'),false);
  assert.equal((await request('/'+code+'/control','POST',{action:'close'},host)).data.phase,'closed');
  assert.equal((await request('/'+code+'/vote','POST',{...vote,round:1})).status,409);
  assert.equal((await request('/'+code+'/control','POST',{action:'open',round:2},host)).status,409);
});
test('cross-origin mutation and oversized bodies are rejected',async()=>{
  const response=await mf.dispatchFetch(base+'/api/rooms',{method:'POST',headers:{Origin:'https://other.example','Content-Type':'application/json','oai-authenticated-user-id':'presenter'},body:'{}'});
  assert.equal(response.status,403);
  assert.equal((await request('','POST',{payload:'x'.repeat(7000)},{'oai-authenticated-user-id':'presenter'})).status,413);
});
test('expired rooms cannot receive votes and deletion removes related votes',async()=>{
  const host={Authorization:'Bearer '+token};
  const before=await db.prepare('SELECT COUNT(*) as n FROM votes WHERE room_code=?').bind(code).first();assert.equal(before.n,2);
  assert.equal((await request('/'+code,'DELETE',undefined,host)).status,200);
  const after=await db.prepare('SELECT COUNT(*) as n FROM votes WHERE room_code=?').bind(code).first();assert.equal(after.n,0);
  const created=await request('','POST',{}, {'oai-authenticated-user-id':'presenter'});
  await db.prepare('UPDATE rooms SET expires_at=? WHERE code=?').bind(Date.now()-1,created.data.code).run();
  assert.equal((await request('/'+created.data.code)).status,410);
});
