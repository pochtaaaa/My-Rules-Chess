const http=require('http'),crypto=require('crypto'),{WebSocketServer}=require('ws'),E=require('./engine');
const GROQ=process.env.GROQ_API_KEY,MODEL=process.env.GROQ_MODEL||'llama-3.1-8b-instant',GURL=process.env.GROQ_URL||'https://api.groq.com/openai/v1/chat/completions';
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
const hits=new Map(),cache=new Map();let gHits=[];
const allow=ip=>{const n=Date.now(),a=(hits.get(ip)||[]).filter(t=>n-t<60000);gHits=gHits.filter(t=>n-t<60000);
 if(a.length>=3||gHits.length>=5)return false;a.push(n);gHits.push(n);if(hits.size>5000)hits.clear();hits.set(ip,a);return true};
const PROMPT=['You configure a chess variant engine. Output ONLY JSON: {"config":{...},"summary":"...","unsupported":["..."]}.',
'Classic config for reference: '+JSON.stringify(E.STD)+'.',
'Piece letters: K king, Q queen, R rook, B bishop, N knight, P pawn. Config fields: winPiece (letter; capturing it wins; there is NO check or checkmate), promoteTo (letter), pawnDouble (bool), shield (object like {"K":"R"}: K cannot be captured while friendly R is orthogonally adjacent), pieces.<letter>: slide ("orth"|"diag"|"all" or array of [dy,dx] vectors), max (slide distance 1-8), jumps ("knight" or array of [dy,dx] vectors), jumpLimit (jumps per game per side), noCapture (array of letters it cannot capture). Pawns are fixed (forward 1, optional double, diagonal capture); for pawns only noCapture applies.',
'In "config" output ONLY what the player changed: top-level fields they changed, and for every piece they changed its COMPLETE definition (omit unchanged pieces). Rules you cannot express (castling, en passant, new pieces, turn-based effects, board changes) go to "unsupported" as short phrases. "summary" is 1-2 short sentences on what changed, in the requested language.'].join('\n');
async function ask(text,lang){
 const r=await fetch(GURL,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+GROQ},signal:AbortSignal.timeout(8000),
  body:JSON.stringify({model:MODEL,temperature:0,max_tokens:700,response_format:{type:'json_object'},messages:[{role:'system',content:PROMPT},{role:'user',content:'Summary language: '+(lang==='en'?'English':'Russian')+'\nPlayer rules:\n'+text}]})});
 if(!r.ok)throw Error('groq '+r.status);
 const j=JSON.parse((await r.json()).choices[0].message.content),c=E.sanitize(j.config);
 for(const k of Object.keys(E.STD.pieces))if(!c.pieces[k])c.pieces[k]=E.STD.pieces[k];
 return{config:c,summary:String(j.summary||'').slice(0,400),unsupported:(Array.isArray(j.unsupported)?j.unsupported:[]).slice(0,6).map(x=>String(x).slice(0,80))}}
const srv=http.createServer((q,s)=>{
 if(q.method==='OPTIONS'){s.writeHead(204,CORS);return s.end()}
 if(q.method==='POST'&&q.url==='/parse'){
  const ip=(q.headers['x-forwarded-for']||q.socket.remoteAddress||'').split(',')[0].trim(),fail=c=>{s.writeHead(c,CORS);s.end('{}')},done=r=>{s.writeHead(200,{...CORS,'content-type':'application/json'});s.end(JSON.stringify(r))};
  let b='';q.on('data',d=>{b+=d;if(b.length>2000)q.destroy()});
  q.on('end',async()=>{try{const m=JSON.parse(b),text=String(m.text||'').slice(0,400);if(!text.trim())return fail(400);
   const lang=m.lang==='en'?'en':'ru',key=lang+'|'+text.toLowerCase().replace(/[\s.,;!?]+/g,' ').trim(),hit=cache.get(key);
   if(hit&&Date.now()-hit.t<864e5){cache.delete(key);cache.set(key,hit);return done(hit.r)}
   if(!GROQ)return fail(503);if(!allow(ip))return fail(429);
   const r=await ask(text,lang);cache.set(key,{t:Date.now(),r});if(cache.size>1000)cache.delete(cache.keys().next().value);done(r)}catch(e){fail(502)}});return}
 s.writeHead(200,CORS);s.end('ok')});
const wss=new WebSocketServer({server:srv,maxPayload:20000});
const rooms=new Map();
const rnd=n=>[...Array(n)].map(()=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.random()*32|0]).join('');
const J=(w,o)=>{if(w&&w.readyState===1)w.send(JSON.stringify(o))};
const live=p=>!!(p&&p.ws&&p.ws.readyState===1);
function push(R){for(const c of['w','b']){const p=R.p[c];if(p)J(p.ws,{t:'state',s:R.S,opp:live(R.p[c==='w'?'b':'w']),rq:R.rm[c],sum:R.sum})}}
wss.on('connection',ws=>{
 ws.alive=true;ws.on('pong',()=>ws.alive=true);let me=null;
 const A=(R,c)=>{const p=R.p[c]||(R.p[c]={token:crypto.randomBytes(12).toString('hex'),c,R});p.ws=ws;me=p;J(ws,{t:'room',code:R.code,color:c,token:p.token});push(R)};
 const bad=()=>J(ws,{t:'err',c:'bm'});
 ws.on('message',d=>{let m;try{m=JSON.parse(d)}catch(e){return}if(!m||typeof m!=='object')return;
  if(m.t==='create'){if(rooms.size>2000)return;let cfg;try{cfg=E.sanitize(m.cfg)}catch(e){cfg=E.STD}
   let code;do{code=rnd(4)}while(rooms.has(code));
   const R={code,S:E.newGame(cfg),p:{},rm:{w:false,b:false},sum:String(m.sum||'').slice(0,600),ts:Date.now()};rooms.set(code,R);return A(R,'w')}
  if(m.t==='join'){const R=rooms.get(String(m.code||'').toUpperCase());if(!R)return J(ws,{t:'err',c:'nf'});if(R.p.b)return J(ws,{t:'err',c:'full'});return A(R,'b')}
  if(m.t==='resume'){const R=rooms.get(String(m.code||'').toUpperCase());const c=R&&['w','b'].find(k=>R.p[k]&&R.p[k].token===m.token);if(!c)return J(ws,{t:'err',c:'nf'});return A(R,c)}
  if(!me)return;const R=me.R,c=me.c,S=R.S;R.ts=Date.now();
  if(m.t==='move'){if(S.over||S.turn!==c||!R.p.w||!R.p.b)return bad();
   const a=Array.isArray(m.m)?m.m.map(Number):[];if(a.length!==4||a.some(n=>!Number.isInteger(n)||n<0||n>7))return bad();
   const[r,cc,y,x]=a,pc=S.bd[r][cc];if(!pc||pc.c!==c||!E.movesOf(S,r,cc).some(v=>v[0]===y&&v[1]===x))return bad();
   E.play(S,r,cc,y,x);R.rm={w:false,b:false};return push(R)}
  if(m.t==='rematch'){if(!S.over||!R.p.w||!R.p.b)return;R.rm[c]=true;
   if(R.rm.w&&R.rm.b){R.S=E.newGame(S.cfg);R.rm={w:false,b:false};const a=R.p.w,b=R.p.b;R.p={w:b,b:a};a.c='b';b.c='w';
    for(const k of['w','b'])J(R.p[k].ws,{t:'room',code:R.code,color:k,token:R.p[k].token})}
   push(R)}
 });
 ws.on('close',()=>{if(me&&me.ws===ws){me.ws=null;push(me.R)}});
});
setInterval(()=>wss.clients.forEach(w=>{if(!w.alive)return w.terminate();w.alive=false;w.ping()}),30000);
setInterval(()=>{for(const[k,R]of rooms)if(Date.now()-R.ts>3*3600e3)rooms.delete(k)},600e3);
srv.listen(process.env.PORT||8080,()=>console.log('chess server up'));
