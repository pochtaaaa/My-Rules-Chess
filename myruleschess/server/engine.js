(function(){
const DIR={orth:[[1,0],[-1,0],[0,1],[0,-1]],diag:[[1,1],[1,-1],[-1,1],[-1,-1]],knight:[[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]]};
DIR.all=[...DIR.orth,...DIR.diag];DIR.any=[];for(let a=-7;a<=7;a++)for(let b=-7;b<=7;b++)if(a||b)DIR.any.push([a,b]);
const vec=v=>typeof v==='string'?(DIR[v]||[]):(Array.isArray(v)?v:[]);
const STD={winPiece:'K',promoteTo:'choice',pawnDouble:true,pawnCapture:'diag',castling:true,check:true,immune:[],shield:{},pieces:{K:{slide:'all',max:1},Q:{slide:'all',max:8},R:{slide:'orth',max:8},B:{slide:'diag',max:8},N:{jumps:'knight'}}};
const In=(r,c)=>r>=0&&r<8&&c>=0&&c<8;
const rv=(p,pc,v)=>{const s=pc.rel&&p.c==='b'?-1:1;return vec(v).map(([a,b])=>[a*s,b])};
const royalOn=S=>S.cfg.check!==false&&S.cfg.winPiece==='K';
function key(S){let s=S.turn;for(let r=0;r<8;r++)for(let c=0;c<8;c++){const p=S.bd[r][c];s+=p?p.c+p.t+((p.t==='K'||p.t==='R')&&!p.m?'u':''):'.'}return s+(S.ep?S.ep.r+''+S.ep.c:'')}
function newGame(cfg){const row='RNBQKBNR',bd=Array.from({length:8},()=>Array(8).fill(null));
 for(let c=0;c<8;c++){bd[0][c]={t:row[c],c:'b'};bd[1][c]={t:'P',c:'b'};bd[6][c]={t:'P',c:'w'};bd[7][c]={t:row[c],c:'w'}}
 const S={cfg,bd,turn:'w',jc:{},over:false,winner:null,reason:null,nm:{w:0,b:0},lc:{w:0,b:0},ep:null,hm:0,rep:{}};S.rep[key(S)]=1;return S}
function shielded(S,r,c,q){const by=(S.cfg.shield||{})[q.t];if(!by)return false;
 return DIR.orth.some(([a,b])=>{const p=In(r+a,c+b)&&S.bd[r+a][c+b];return p&&p.c===q.c&&p.t===by})}
function castleRook(S,p,r,c,y,x){
 if(S.cfg.castling===false||p.t!=='K'||p.m)return -1;const row=p.c==='w'?7:0;
 if(r!==row||c!==4||y!==row||(x!==6&&x!==2))return -1;
 const rc=x===6?7:0,rk=S.bd[row][rc];if(!rk||rk.t!=='R'||rk.c!==p.c||rk.m)return -1;
 for(let i=Math.min(c,rc)+1;i<=Math.max(c,rc)-1;i++)if(S.bd[row][i])return -1;
 const pc=S.cfg.pieces.K||{},dx=x-c;
 if(vec(pc.slide).some(([a,b])=>a===0&&Math.abs(b)===1&&Math.sign(b)===Math.sign(dx)&&(pc.max||8)>=2)||vec(pc.jumps).some(([a,b])=>a===0&&b===dx))return -1;
 return rc}
function pseudo(S,r,c){const bd=S.bd,p=bd[r][c],o=[],en=p.c==='w'?'b':'w',pc=S.cfg.pieces[p.t]||{},imm=S.cfg.immune||[];
 const can=(q,y,x)=>q.c!==p.c&&!(pc.noCapture||[]).includes(q.t)&&!imm.includes(q.t)&&!shielded(S,y,x,q);
 const add=(y,x)=>{if(!In(y,x))return false;const q=bd[y][x];if(!q){o.push([y,x]);return true}if(can(q,y,x))o.push([y,x]);return false};
 if(p.t==='P'&&!pc.slide&&!pc.jumps){const d=p.c==='w'?-1:1,st=p.c==='w'?6:1,pcap=S.cfg.pawnCapture||'diag';
  if(In(r+d,c)){const q0=bd[r+d][c];if(!q0){o.push([r+d,c]);if(S.cfg.pawnDouble!==false&&r===st&&!bd[r+2*d][c])o.push([r+2*d,c])}else if(pcap!=='diag'&&q0.c===en&&can(q0,r+d,c))o.push([r+d,c])}
  if(pcap!=='straight'){
   [-1,1].forEach(s=>{if(In(r+d,c+s)){const q=bd[r+d][c+s];if(q&&q.c===en&&can(q,r+d,c+s))o.push([r+d,c+s])}});
   const e=S.ep;if(e&&e.by===en&&e.r===r+d&&Math.abs(e.c-c)===1&&!bd[e.r][e.c]){const vp=bd[e.pr][e.pc];if(vp&&can(vp,e.pr,e.pc))o.push([e.r,e.c])}}
 }else{
  rv(p,pc,pc.slide).forEach(([a,b])=>{for(let i=1;i<=(pc.max||8);i++){const y=r+a*i,x=c+b*i;if(!In(y,x))break;if(!add(y,x)&&!pc.leap)break}});
  if(!pc.jumpLimit||(S.jc[p.c+p.t]||0)<pc.jumpLimit)rv(p,pc,pc.jumps).forEach(([a,b])=>add(r+a,c+b));
 }
 const sh=pc.shoot;
 if(sh&&(!sh.limit||(S.jc[p.c+p.t+'s']||0)<sh.limit))for(const[a,b]of rv(p,pc,sh.dirs||'all')){for(let i=1;i<=(sh.range||3);i++){const y=r+a*i,x=c+b*i;if(!In(y,x))break;const q=bd[y][x];if(!q)continue;if(can(q,y,x))o.push([y,x,'s']);break}}
 if(pc.swap&&(!pc.swapLimit||(S.jc[p.c+p.t+'w']||0)<pc.swapLimit))for(let y=0;y<8;y++)for(let x=0;x<8;x++){const q=bd[y][x];if(q&&q.c===p.c&&q!==p)o.push([y,x,'w'])}
 if(p.t==='K')for(const x of[6,2])if(castleRook(S,p,r,c,r,x)>=0)o.push([r,x]);
 return o}
function attacked(S,col){let kr=-1,kc=-1;
 for(let r=0;r<8;r++)for(let c=0;c<8;c++){const p=S.bd[r][c];if(p&&p.t==='K'&&p.c===col){kr=r;kc=c}}
 if(kr<0)return false;
 for(let r=0;r<8;r++)for(let c=0;c<8;c++){const p=S.bd[r][c];if(p&&p.c!==col)for(const m of pseudo(S,r,c))if(m[0]===kr&&m[1]===kc&&m[2]!=='w')return true}
 return false}
function sim(S,r,c,y,x,opt){const bd=S.bd,p=bd[r][c],sv=[],save=(a,b)=>sv.push([a,b,bd[a][b]]);
 if(opt==='s'){save(y,x);bd[y][x]=null}
 else if(opt==='w'){save(r,c);save(y,x);const q=bd[y][x];bd[y][x]=p;bd[r][c]=q}
 else{save(r,c);save(y,x);const e=S.ep;
  if(p.t==='P'&&!bd[y][x]&&x!==c&&e&&e.r===y&&e.c===x){save(e.pr,e.pc);bd[e.pr][e.pc]=null}
  const cr=castleRook(S,p,r,c,y,x);if(cr>=0){const nx=x===6?5:3;save(r,cr);save(r,nx);bd[r][nx]=bd[r][cr];bd[r][cr]=null}
  bd[y][x]=p;bd[r][c]=null}
 return()=>{for(let i=sv.length-1;i>=0;i--){const[a,b,v]=sv[i];bd[a][b]=v}}}
function movesOf(S,r,c){const o=pseudo(S,r,c);if(!royalOn(S))return o;
 const p=S.bd[r][c],col=p.c,res=[];
 for(const m of o){const y=m[0],x=m[1],opt=m[2];
  if(!opt&&p.t==='K'&&castleRook(S,p,r,c,y,x)>=0){
   if(attacked(S,col))continue;
   const u=sim(S,r,c,r,(c+x)/2),bad=attacked(S,col);u();if(bad)continue}
  const u=sim(S,r,c,y,x,opt),bad=attacked(S,col);u();if(!bad)res.push(m)}
 return res}
function inCheck(S,col){return royalOn(S)&&attacked(S,col)}
function hasMoves(S,col){for(let r=0;r<8;r++)for(let c=0;c<8;c++){const p=S.bd[r][c];if(p&&p.c===col&&movesOf(S,r,c).length)return true}return false}
function ending(S,k){
 if(!hasMoves(S,S.turn))return inCheck(S,S.turn)?'checkmate':'stalemate';
 if(S.rep[k]>=3)return 'repetition';
 if(S.hm>=100)return 'fifty';
 let only=true;for(const row of S.bd)for(const p of row)if(p&&p.t!=='K')only=false;if(only)return 'kings';
 return null}
function finish(S,winner,reason){S.over=true;S.winner=winner;S.reason=reason}
function play(S,r,c,y,x,opt){const p=S.bd[r][c],pc=S.cfg.pieces[p.t]||{},imm=S.cfg.immune||[];
 S.nm[p.c]=(S.nm[p.c]||0)+1;
 const e=S.ep;S.ep=null;let kills=[],pawn=false;
 if(opt==='s'){const q=S.bd[y][x];S.jc[p.c+p.t+'s']=(S.jc[p.c+p.t+'s']||0)+1;S.bd[y][x]=null;kills=[q]}
 else if(opt==='w'){const q=S.bd[y][x];S.jc[p.c+p.t+'w']=(S.jc[p.c+p.t+'w']||0)+1;S.bd[y][x]=p;S.bd[r][c]=q;p.m=true;q.m=true}
 else{
  const q=S.bd[y][x];let epc=null;
  if(pc.jumpLimit&&vec(pc.jumps).some(([a,b])=>a===y-r&&b===x-c)&&!vec(pc.slide).some(([a,b])=>{for(let i=1;i<=(pc.max||8);i++)if(a*i===y-r&&b*i===x-c)return true;return false}))S.jc[p.c+p.t]=(S.jc[p.c+p.t]||0)+1;
  pawn=p.t==='P';const std=pawn&&!pc.slide&&!pc.jumps,diagOK=(S.cfg.pawnCapture||'diag')!=='straight',cr=castleRook(S,p,r,c,y,x);
  if(std&&diagOK&&!q&&x!==c&&e&&e.r===y&&e.c===x&&e.by!==p.c){epc=S.bd[e.pr][e.pc];S.bd[e.pr][e.pc]=null}
  S.bd[y][x]=p;S.bd[r][c]=null;p.m=true;
  if(cr>=0){const rk=S.bd[r][cr];S.bd[r][x===6?5:3]=rk;S.bd[r][cr]=null;rk.m=true}
  if(std&&diagOK&&Math.abs(y-r)===2&&x===c)S.ep={r:(r+y)/2,c,pr:y,pc:c,by:p.c};
  if(pawn&&(y===0||y===7)){const t=S.cfg.promoteTo;p.t=(!t||t==='choice')?(opt&&opt.length===1&&'QRBN'.includes(opt)?opt:'Q'):t}
  kills=[q||epc];
  if(pc.blast&&q)for(let da=-1;da<=1;da++)for(let db=-1;db<=1;db++){const ny=y+da,nx=x+db;if((da||db)&&In(ny,nx)){const z=S.bd[ny][nx];if(z&&z.c!==p.c&&!imm.includes(z.t)){kills.push(z);S.bd[ny][nx]=null}}}
 }
 kills=kills.filter(Boolean);
 if(kills.some(k=>k.t===S.cfg.winPiece)){finish(S,p.c,'capture');return}
 const mover=p.c;
 S.hm=(kills.length||pawn)?0:(S.hm||0)+1;if(kills.length||pawn)S.rep={};
 S.turn=S.turn==='w'?'b':'w';
 const k=key(S);S.rep[k]=(S.rep[k]||0)+1;
 const end=ending(S,k);if(end==='checkmate')finish(S,mover,'checkmate');else if(end)finish(S,null,end)}
function sanitize(c){const L='KQRBNP',ok=x=>typeof x==='string'&&x.length===1&&L.includes(x),cl=(n,a,b)=>Math.min(b,Math.max(a,n));c=c||{};
 const o={winPiece:ok(c.winPiece)?c.winPiece:'K',promoteTo:c.promoteTo==='choice'?'choice':(ok(c.promoteTo)&&c.promoteTo!=='P'?c.promoteTo:'choice'),pawnDouble:c.pawnDouble!==false,castling:c.castling!==false,check:c.check!==false,immune:Array.isArray(c.immune)?c.immune.filter(ok).slice(0,6):[],pawnCapture:['diag','straight','both'].includes(c.pawnCapture)?c.pawnCapture:'diag',shield:{},pieces:{}};
 for(const k in(c.shield||{}))if(ok(k)&&ok(c.shield[k]))o.shield[k]=c.shield[k];
 const sv=v=>typeof v==='string'?(DIR[v]?v:undefined):Array.isArray(v)?v.slice(0,16).filter(a=>Array.isArray(a)&&a.length===2&&a.every(n=>Number.isInteger(n)&&Math.abs(n)<8)):undefined;
 for(const k of L){const p=(c.pieces||{})[k];if(!p||typeof p!=='object')continue;const q={};
  const sl=sv(p.slide),jm=sv(p.jumps);if(sl)q.slide=sl;if(jm)q.jumps=jm;
  if(Number.isInteger(p.max))q.max=cl(p.max,1,8);
  if(Number.isInteger(p.jumpLimit))q.jumpLimit=cl(p.jumpLimit,1,64);
  if(p.leap===true)q.leap=true;if(p.rel===true)q.rel=true;if(p.blast===true)q.blast=true;
  if(p.swap===true){q.swap=true;if(Number.isInteger(p.swapLimit))q.swapLimit=cl(p.swapLimit,1,64)}
  if(p.shoot&&typeof p.shoot==='object'){q.shoot={dirs:sv(p.shoot.dirs)||'all',range:Number.isInteger(p.shoot.range)?cl(p.shoot.range,1,8):3};if(Number.isInteger(p.shoot.limit))q.shoot.limit=cl(p.shoot.limit,1,64)}
  if(Array.isArray(p.noCapture))q.noCapture=p.noCapture.filter(ok).slice(0,6);o.pieces[k]=q}
 return o}
const EVERY=2;
function canChange(S,c){const n=S.nm||{w:0,b:0},l=S.lc||{w:0,b:0};if(n.w+n.b===0)return true;return !S.over&&S.turn===c&&n[c]-l[c]>=EVERY}
function setRules(S,cfg,c){S.cfg=cfg;if(S.nm.w+S.nm.b>0)S.lc[c]=S.nm[c];S.hm=0;S.rep={};S.rep[key(S)]=1;
 if(!S.over&&!hasMoves(S,S.turn)){if(inCheck(S,S.turn))finish(S,S.turn==='w'?'b':'w','checkmate');else finish(S,null,'stalemate')}}
const E={STD,DIR,vec,newGame,movesOf,play,sanitize,EVERY,canChange,setRules,finish,inCheck};
if(typeof module!=='undefined')module.exports=E;else window.Chess=E;
})();
