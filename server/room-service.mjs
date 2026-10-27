import { rounds } from './rounds.mjs';

const MAX_BODY = 6000;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
class HttpError extends Error { constructor(status,message){super(message);this.status=status;} }
const json = (data,status=200) => new Response(JSON.stringify(data),{status,headers:{
  'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'
}});
const fail = (status,message) => { throw new HttpError(status,message); };
async function body(request) {
  if (!request.headers.get('Content-Type')?.includes('application/json')) fail(415,'Envie os dados no formato JSON.');
  if (Number(request.headers.get('Content-Length'))>MAX_BODY) fail(413,'Pedido muito grande.');
  const reader=request.body?.getReader(); if(!reader) fail(400,'Dados ausentes.');
  let size=0; const chunks=[];
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_BODY){await reader.cancel();fail(413,'Pedido muito grande.');}chunks.push(value);}
  const data=new Uint8Array(size);let offset=0;for(const c of chunks){data.set(c,offset);offset+=c.length;}
  try{return JSON.parse(new TextDecoder().decode(data));}catch{fail(400,'Dados inválidos.');}
}
const random = (n) => crypto.getRandomValues(new Uint8Array(n));
const hex = (bytes) => [...bytes].map((b)=>b.toString(16).padStart(2,'0')).join('');
async function hash(value) { return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))); }
function pair(room,index){return JSON.parse(room.flips)[index] ? [...rounds[index].samples].reverse() : [...rounds[index].samples];}
function answer(room,index){return pair(room,index).findIndex((s)=>s.isAI)===0 ? 'A' : 'B';}
async function authorize(request,room) {
  const token=request.headers.get('Authorization')?.replace(/^Bearer /,'') || '';
  if(!/^[a-f0-9]{64}$/.test(token))fail(403,'Este controle pertence ao apresentador da sala.');
  if(await hash(token)!==room.host_hash)fail(403,'Controle do apresentador inválido.');
}
async function report(db,room) {
  const result=await db.prepare('SELECT round_index, choice, COUNT(*) as n, SUM(confidence) as confidence_sum, SUM(CASE WHEN confidence >= 80 THEN 1 ELSE 0 END) as high_confidence FROM votes WHERE room_code=? GROUP BY round_index,choice').bind(room.code).all();
  const total=await db.prepare('SELECT COUNT(DISTINCT participant_hash) as n FROM votes WHERE room_code=?').bind(room.code).first();
  const rows=rounds.map((round,i)=>{
    const found=result.results.filter((v)=>v.round_index===i), n=found.reduce((s,v)=>s+Number(v.n),0);
    const a=found.find((v)=>v.choice==='A'), b=found.find((v)=>v.choice==='B'), correctChoice=answer(room,i);
    const correct=Number(found.find((v)=>v.choice===correctChoice)?.n||0);
    return {round:i,title:round.title,responses:n,A:Number(a?.n||0),B:Number(b?.n||0),correctChoice,correct,
      accuracy:n?Math.round(correct/n*100):null,
      averageConfidence:n?Math.round(found.reduce((s,v)=>s+Number(v.confidence_sum),0)/n):null,
      highConfidenceErrors:found.filter((v)=>v.choice!==correctChoice).reduce((s,v)=>s+Number(v.high_confidence),0)};
  });
  return {room:room.code,createdAt:room.created_at,exportedAt:Date.now(),phase:room.phase,
    browserIdentifiers:Number(total?.n||0),rounds:rows,
    interpretation:'Resultados descritivos de uma sessão. Identificadores de navegador não equivalem a pessoas únicas; as rodadas usam cenas diferentes e não isolam o efeito de aprendizagem.'};
}
async function snapshot(db,room) {
  const active=room.round_index>=0;
  const count=active?await db.prepare('SELECT COUNT(*) as n FROM votes WHERE room_code=? AND round_index=?').bind(room.code,room.round_index).first():{n:0};
  const data={code:room.code,phase:room.phase,round:room.round_index,expiresAt:room.expires_at,responses:Number(count?.n||0)};
  if(active){
    const r=rounds[room.round_index];
    data.title=r.title;data.focus=r.focus;
    data.samples=pair(room,room.round_index).map((s)=>({src:s.src,poster:s.poster,key:s.key}));
    if(room.phase==='revealed'||room.phase==='closed'){
      data.correctChoice=answer(room,room.round_index);
      data.samples=pair(room,room.round_index);
      data.statistics=(await report(db,room)).rounds[room.round_index];
    }
  }
  return data;
}
export async function handleRoomRequest(request,env) {
  try{
    if(!env?.DB)fail(503,'As salas precisam do serviço online. O desafio individual continua disponível.');
    const url=new URL(request.url),origin=request.headers.get('Origin');
    if(origin&&origin!==url.origin)fail(403,'Origem do pedido não autorizada.');
    const path=url.pathname.replace(/\/$/,'').split('/').filter(Boolean),db=env.DB;
    if(path[0]!=='api'||path[1]!=='rooms')fail(404,'Endereço não encontrado.');
    if(path.length===2&&request.method==='POST'){
      if(!request.headers.get('oai-authenticated-user-id'))fail(401,'Entre como apresentador para criar uma sala.');
      await body(request);
      await db.prepare('DELETE FROM rooms WHERE expires_at < ?').bind(Date.now()).run();
      const token=hex(random(32)),hostHash=await hash(token),flips=JSON.stringify([...random(6)].map((b)=>b%2));
      let code; for(let i=0;i<6;i++){
        const candidate=[...random(6)].map((b)=>CODE_CHARS[b%CODE_CHARS.length]).join('');
        if(!await db.prepare('SELECT code FROM rooms WHERE code=?').bind(candidate).first()){code=candidate;break;}
      }
      if(!code)fail(503,'Não foi possível abrir uma sala. Tente novamente.');
      const now=Date.now();
      await db.prepare('INSERT INTO rooms(code,host_hash,phase,round_index,flips,created_at,expires_at) VALUES(?,?,?,?,?,?,?)').bind(code,hostHash,'lobby',-1,flips,now,now+86400000).run();
      return json({...(await snapshot(db,{code,host_hash:hostHash,phase:'lobby',round_index:-1,flips,created_at:now,expires_at:now+86400000})),hostToken:token},201);
    }
    if(path.length<3||path.length>4||!/^[A-Z2-9]{6}$/.test(path[2]))fail(404,'Sala não encontrada.');
    const room=await db.prepare('SELECT * FROM rooms WHERE code=?').bind(path[2]).first();
    if(!room)fail(404,'Sala não encontrada. Confira o código.');
    if(room.expires_at<Date.now())fail(410,'Esta sala expirou. Peça um novo código ao apresentador.');
    if(path.length===3&&request.method==='GET')return json(await snapshot(db,room));
    if(path.length===3&&request.method==='DELETE'){
      await authorize(request,room);await db.prepare('DELETE FROM rooms WHERE code=?').bind(room.code).run();return json({deleted:true});
    }
    if(path[3]==='report'&&request.method==='GET'){await authorize(request,room);return json(await report(db,room));}
    if(path[3]==='control'&&request.method==='POST'){
      await authorize(request,room);const input=await body(request);
      if(input.action==='close'){
        await db.prepare('UPDATE rooms SET phase=? WHERE code=?').bind('closed',room.code).run();
      }else if(input.action==='open'){
        if(!Number.isInteger(input.round)||input.round<0||input.round>=rounds.length)fail(400,'Rodada inválida.');
        if(!['lobby','revealed'].includes(room.phase)||input.round!==room.round_index+1)fail(409,'Revele a rodada atual antes de abrir a próxima.');
        const result=await db.prepare('UPDATE rooms SET phase=?,round_index=? WHERE code=? AND phase=? AND round_index=?').bind('open',input.round,room.code,room.phase,room.round_index).run();
        if(!result.meta.changes)fail(409,'O estado mudou. Atualize a sala.');
      }else if(input.action==='reveal'){
        if(room.phase!=='open')fail(409,'Não há uma votação aberta para encerrar.');
        await db.prepare('UPDATE rooms SET phase=? WHERE code=? AND phase=?').bind('revealed',room.code,'open').run();
      }else fail(400,'Ação desconhecida.');
      const current=await db.prepare('SELECT * FROM rooms WHERE code=?').bind(room.code).first();
      return json(await snapshot(db,current));
    }
    if(path[3]==='vote'&&request.method==='POST'){
      const v=await body(request);
      if(!Number.isInteger(v.round)||v.round<0||v.round>=6||!['A','B'].includes(v.choice)||
        !Number.isInteger(v.confidence)||v.confidence<0||v.confidence>100||
        typeof v.participantId!=='string'||!/^[A-Za-z0-9_-]{20,100}$/.test(v.participantId))fail(400,'Confira a escolha, a confiança e o identificador da participação.');
      if(room.phase!=='open'||room.round_index!==v.round)fail(409,'A votação desta rodada já foi encerrada.');
      const participant=await hash(room.code+':'+v.participantId);
      const result=await db.prepare("INSERT INTO votes(room_code,round_index,participant_hash,choice,confidence,submitted_at) SELECT ?,?,?,?,?,? FROM rooms WHERE code=? AND phase='open' AND round_index=? AND expires_at>? ON CONFLICT(room_code,round_index,participant_hash) DO UPDATE SET choice=excluded.choice,confidence=excluded.confidence,submitted_at=excluded.submitted_at WHERE EXISTS(SELECT 1 FROM rooms WHERE code=? AND phase='open' AND round_index=? AND expires_at>?)").bind(room.code,v.round,participant,v.choice,v.confidence,Date.now(),room.code,v.round,Date.now(),room.code,v.round,Date.now()).run();
      if(!result.meta.changes)fail(409,'A votação desta rodada já foi encerrada.');
      return json({accepted:true,round:v.round,choice:v.choice});
    }
    fail(405,'Operação não disponível.');
  }catch(error){
    if(error instanceof HttpError)return json({error:error.message},error.status);
    console.error('room-service failure',error?.name);
    return json({error:'O serviço da sala não respondeu. Tente novamente; o desafio individual continua disponível.'},503);
  }
}
