const http=require('http'),crypto=require('crypto'),{WebSocketServer}=require('ws'),E=require('./engine');
const GROQ=process.env.GROQ_API_KEY,MODEL=process.env.GROQ_MODEL||'llama-3.1-8b-instant',GURL=process.env.GROQ_URL||'https://api.groq.com/openai/v1/chat/completions';
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
const hits=new Map(),cache=new Map();let gHits=[];
const allow=ip=>{const n=Date.now(),a=(hits.get(ip)||[]).filter(t=>n-t<60000);gHits=gHits.filter(t=>n-t<60000);
 if(a.length>=3||gHits.length>=5)return false;a.push(n);gHits.push(n);if(hits.size>5000)hits.clear();hits.set(ip,a);return true};
const PROMPT=[
'You configure a chess variant engine. Output ONLY JSON: {"config":{...},"summary":"...","unsupported":["..."]}.',
'The player rules apply ON TOP of the CURRENT config given in the user message (rules can change mid-game). In "config" output ONLY what the player changed. Top-level fields: only the changed ones. Pieces: pieces.<letter> is a PATCH merged into the current definition of that piece, so list ONLY the fields that change (set a field to null to remove it). Never repeat unchanged fields and never drop a field the player did not mention.',
'Piece letters: K king, Q queen, R rook, B bishop, N knight, P pawn.',
'TOP-LEVEL fields: check (bool, default true = real check and checkmate; false = no check at all, the king is simply captured), winPiece ("K"; capturing it wins when check is false), promoteTo (a letter or "choice"), castling (bool), pawnDouble (bool), pawnCapture ("diag" classic | "straight" | "both"), immune (array of letters of pieces that can never be captured), shield (object like {"K":"R"}: K cannot be captured while a friendly R is orthogonally adjacent).',
'PIECE fields (pieces.<letter>): slide ("orth"|"diag"|"all" or an array of [dy,dx] vectors; an EMPTY array [] means the piece does not slide), max (1-8), jumps ("knight"|"any"|array of [dy,dx]), jumpLimit (uses per game), leap (bool), noCapture (array of letters), rel (bool: vectors are from the point of view of the owner, dy -1 = forward), shoot ({"dirs":"orth"|"diag"|"all","range":1-8,"limit":optional number}), swap (bool) with optional swapLimit, blast (bool). Pawns have built-in classic movement; giving a pawn slide or jumps replaces it.',
'FANTASY VOCABULARY, map the words of the player to fields: levitation / flying / ghost / passes through pieces -> leap:true. Teleport anywhere -> jumps:"any" (plus jumpLimit for "N times per game") - teleport moves ONLY to EMPTY squares (it never captures) and the piece keeps its normal moves. Teleport like a knight -> jumps:"knight". Gun / pistol / rifle / sniper / shoots (kills the first enemy piece in a line WITHOUT moving) -> shoot. Swap places with an ally -> swap:true. Invulnerable / immortal / armored -> immune:[letters] at top level. Bomb / grenade / explosion (when it captures, it also destroys all adjacent enemy pieces) -> blast:true. A piece that can not move at all (cannot move, stands still) -> {"slide":[],"jumps":null}. "No check, no checkmate, win by eating the king" -> check:false. Anything else (new pieces, extra turns, freezing, resurrecting, changing the board, effects over time) is NOT supported: put it in "unsupported" and never fake it.',
'Examples (only the config is shown): "слон ходит как конь" -> {"pieces":{"B":{"slide":[],"jumps":"knight"}}}; "ладья ходит как слон и конь, но максимум на 3 клетки" -> {"pieces":{"R":{"slide":"diag","max":3,"jumps":"knight"}}}; "слон прыгает через фигуры" -> {"pieces":{"B":{"leap":true}}}; "у пешек пистолет, стреляют на 3 клетки" -> {"pieces":{"P":{"shoot":{"dirs":"all","range":3}}}}; "король не может ходить" -> {"pieces":{"K":{"slide":[],"jumps":null}}}; "конь может один раз телепортироваться куда угодно" -> {"pieces":{"N":{"jumps":"any","jumpLimit":1}}}; "ферзь неуязвим" -> {"immune":["Q"]}; "без шаха и мата, побеждает съевший короля" -> {"check":false}; "пешки бьют только прямо" -> {"pawnCapture":"straight"}.',
'"summary" is 1-2 short sentences in the requested language describing what changed. If nothing can be applied, leave config empty ({}) and explain briefly in summary.'
].join('\n');
const MODELS=[process.env.GROQ_MODEL,'openai/gpt-oss-20b','llama-3.1-8b-instant','llama-3.3-70b-versatile'].filter((m,i,a)=>m&&a.indexOf(m)===i);
let good=null;
async function ask(text,lang,base){
 const order=good?[good,...MODELS.filter(m=>m!==good)]:MODELS;let last='';
 for(const model of order){
  const oss=/gpt-oss/.test(model);
  for(const json of[true,false]){
   const r=await fetch(GURL,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+GROQ},signal:AbortSignal.timeout(12000),
    body:JSON.stringify({model,temperature:0,max_tokens:oss?1500:700,...(oss?{reasoning_effort:'low'}:{}),...(json?{response_format:{type:'json_object'}}:{}),
     messages:[{role:'system',content:PROMPT},{role:'user',content:'Current config:\n'+JSON.stringify(base)+'\nSummary language: '+(lang==='en'?'English':'Russian')+'\nPlayer rules:\n'+text}]})});
   if(r.ok){
    const raw=String((await r.json()).choices[0].message.content||''),j=JSON.parse(raw.slice(raw.indexOf('{'),raw.lastIndexOf('}')+1)),rc=j.config||{},san=E.sanitize(rc),c=JSON.parse(JSON.stringify(base));
    good=model;for(const k of['winPiece','promoteTo','pawnDouble','pawnCapture','castling','check','immune','shield'])if(k in rc)c[k]=san[k];
    for(const k in(rc.pieces||{})){const pt=rc.pieces[k];if(k.length!==1||!'KQRBNP'.includes(k)||!pt||typeof pt!=='object')continue;const sp=E.sanitize({pieces:{[k]:pt}}).pieces[k]||{},out={...(c.pieces[k]||{}),...sp};for(const f in pt)if(pt[f]===null)delete out[f];c.pieces[k]=out}
    return{config:c,changed:JSON.stringify(c)!==JSON.stringify(base),summary:String(j.summary||'').slice(0,400),unsupported:(Array.isArray(j.unsupported)?j.unsupported:[]).slice(0,6).map(x=>String(x).slice(0,80))}}
   const body=(await r.text().catch(()=>'')).slice(0,160);last=model+' '+r.status+' '+body;
   if(r.status===401||r.status===429)throw Error('groq '+last);
   if(r.status===400&&json&&/response_format|json/i.test(body))continue;
   break}}
 throw Error('groq '+last)}
const srv=http.createServer((q,s)=>{
 const path=String(q.url||'').split('?')[0].replace(/\/+$/,'')||'/';
 if(q.method==='GET'&&path==='/version'){s.writeHead(200,CORS);return s.end('chess-server v10 · groq key: '+(GROQ?'yes':'NO')+' · models: '+MODELS.join(' > ')+' · working: '+(good||'not yet used'))}
 if(q.method==='OPTIONS'){s.writeHead(204,CORS);return s.end()}
 if(q.method==='POST'&&path==='/parse'){
  const ip=(q.headers['x-forwarded-for']||q.socket.remoteAddress||'').split(',')[0].trim(),fail=(c,err)=>{s.writeHead(c,{...CORS,'content-type':'application/json'});s.end(JSON.stringify({err:err||''}))},done=r=>{s.writeHead(200,{...CORS,'content-type':'application/json'});s.end(JSON.stringify(r))};
  let b='';q.on('data',d=>{b+=d;if(b.length>2000)q.destroy()});
  q.on('end',async()=>{try{const m=JSON.parse(b),text=String(m.text||'').slice(0,400);if(!text.trim())return fail(400,'empty');
   const lang=m.lang==='en'?'en':'ru',base=m.base&&typeof m.base==='object'?E.sanitize(m.base):E.STD,key=lang+'|'+JSON.stringify(base)+'|'+text.toLowerCase().replace(/[\s.,;!?]+/g,' ').trim(),hit=cache.get(key);
   if(hit&&Date.now()-hit.t<864e5){cache.delete(key);cache.set(key,hit);return done(hit.r)}
   if(!GROQ)return fail(503,'no GROQ_API_KEY on server');if(!allow(ip))return fail(429,'rate limit');
   const r=await ask(text,lang,base);cache.set(key,{t:Date.now(),r});if(cache.size>1000)cache.delete(cache.keys().next().value);done(r)}catch(e){console.error(String(e.message||e));fail(502,String(e.message||e).slice(0,200))}});return}
 s.writeHead(200,CORS);s.end('ok')});
const wss=new WebSocketServer({server:srv,maxPayload:20000});
const rooms=new Map();
const rnd=n=>[...Array(n)].map(()=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.random()*32|0]).join('');
const J=(w,o)=>{if(w&&w.readyState===1)w.send(JSON.stringify(o))};
const live=p=>!!(p&&p.ws&&p.ws.readyState===1);
function push(R){for(const c of['w','b']){const p=R.p[c];if(p)J(p.ws,{t:'state',s:R.S,opp:live(R.p[c==='w'?'b':'w']),rq:R.rm[c],dq:!!(R.dr&&R.dr[c==='w'?'b':'w']),dm:!!(R.dr&&R.dr[c]),sum:R.sum})}}
wss.on('connection',ws=>{
 ws.alive=true;ws.on('pong',()=>ws.alive=true);let me=null;
 const A=(R,c)=>{const p=R.p[c]||(R.p[c]={token:crypto.randomBytes(12).toString('hex'),c,R});p.ws=ws;me=p;J(ws,{t:'room',code:R.code,color:c,token:p.token});push(R)};
 const bad=()=>J(ws,{t:'err',c:'bm'});
 ws.on('message',d=>{let m;try{m=JSON.parse(d)}catch(e){return}if(!m||typeof m!=='object')return;
  if(m.t==='create'){if(rooms.size>2000)return;let cfg;try{cfg=E.sanitize(m.cfg)}catch(e){cfg=E.STD}
   let code;do{code=rnd(4)}while(rooms.has(code));
   const R={code,S:E.newGame(cfg),p:{},rm:{w:false,b:false},dr:{w:false,b:false},sum:String(m.sum||'').slice(0,600),cfg0:cfg,sum0:String(m.sum||'').slice(0,600),ts:Date.now()};rooms.set(code,R);return A(R,'w')}
  if(m.t==='join'){const R=rooms.get(String(m.code||'').toUpperCase());if(!R)return J(ws,{t:'err',c:'nf'});
   const free=k=>{const p=R.p[k];return !p||(!live(p)&&Date.now()-(p.off||0)>15000)},c=['w','b'].find(free);
   if(!c)return J(ws,{t:'err',c:'full'});delete R.p[c];return A(R,c)}
  if(m.t==='resume'){const R=rooms.get(String(m.code||'').toUpperCase());const c=R&&['w','b'].find(k=>R.p[k]&&R.p[k].token===m.token);if(!c)return J(ws,{t:'err',c:'nf'});return A(R,c)}
  if(!me)return;const R=me.R,c=me.c,S=R.S;R.ts=Date.now();
  if(m.t==='rules'){if(!E.canChange(S,c))return J(ws,{t:'err',c:'rl'});let cf;try{cf=E.sanitize(m.cfg)}catch(e){return bad()}
   E.setRules(S,cf,c);R.sum=String(m.sum||'').slice(0,600);if(S.nm.w+S.nm.b===0){R.cfg0=cf;R.sum0=R.sum}R.rm={w:false,b:false};return push(R)}
  if(m.t==='resign'){if(S.over||S.nm.w+S.nm.b===0)return;E.finish(S,c==='w'?'b':'w','resign');return push(R)}
  if(m.t==='draw'){if(S.over||S.nm.w+S.nm.b===0)return;R.dr[c]=true;if(R.dr.w&&R.dr.b)E.finish(S,null,'agreed');return push(R)}
  if(m.t==='leave'){const k=me.c;delete R.p[k];R.rm={w:false,b:false};me=null;if(!R.p.w&&!R.p.b)rooms.delete(R.code);else push(R);return}
  if(m.t==='move'){if(S.over||S.turn!==c||!R.p.w||!R.p.b)return bad();
   const mm=Array.isArray(m.m)?m.m:[],a=mm.slice(0,4).map(Number),promo=typeof mm[4]==='string'?mm[4].slice(0,1):undefined;if(mm.length<4||mm.length>5||a.some(n=>!Number.isInteger(n)||n<0||n>7))return bad();
   const[r,cc,y,x]=a,pc=S.bd[r][cc],sp=(promo==='s'||promo==='w')?promo:'';if(!pc||pc.c!==c||!E.movesOf(S,r,cc).some(v=>v[0]===y&&v[1]===x&&(v[2]||'')===sp))return bad();
   E.play(S,r,cc,y,x,promo);R.rm={w:false,b:false};R.dr={w:false,b:false};return push(R)}
  if(m.t==='rematch'){if(!S.over||!R.p.w||!R.p.b)return;R.rm[c]=true;
   if(R.rm.w&&R.rm.b){R.S=E.newGame(R.cfg0||S.cfg);R.sum=R.sum0!==undefined?R.sum0:R.sum;R.rm={w:false,b:false};R.dr={w:false,b:false};const a=R.p.w,b=R.p.b;R.p={w:b,b:a};a.c='b';b.c='w';
    for(const k of['w','b'])J(R.p[k].ws,{t:'room',code:R.code,color:k,token:R.p[k].token})}
   push(R)}
 });
 ws.on('close',()=>{if(me&&me.ws===ws){me.ws=null;me.off=Date.now();push(me.R)}});
});
setInterval(()=>wss.clients.forEach(w=>{if(!w.alive)return w.terminate();w.alive=false;w.ping()}),30000);
setInterval(()=>{for(const[k,R]of rooms)if(Date.now()-R.ts>3*3600e3)rooms.delete(k)},600e3);
srv.listen(process.env.PORT||8080,()=>console.log('chess server up'));
