/* My Rules Chess: engine */
(function(){
const DIR={orth:[[1,0],[-1,0],[0,1],[0,-1]],diag:[[1,1],[1,-1],[-1,1],[-1,-1]],knight:[[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]]};
DIR.all=[...DIR.orth,...DIR.diag];DIR.any=[];for(let a=-7;a<=7;a++)for(let b=-7;b<=7;b++)if(a||b)DIR.any.push([a,b]);
const vec=v=>typeof v==='string'?(DIR[v]||[]):(Array.isArray(v)?v:[]);
const STD={winPiece:'K',promoteTo:'choice',pawnDouble:true,pawnRange:1,pawnBack:false,pawnCapture:'diag',castling:true,check:true,immune:[],shield:{},pieces:{K:{slide:'all',max:1},Q:{slide:'all',max:8},R:{slide:'orth',max:8},B:{slide:'diag',max:8},N:{jumps:'knight'}}};
const In=(r,c)=>r>=0&&r<8&&c>=0&&c<8;
const rv=(p,pc,v)=>{const s=pc.rel&&p.c==='b'?-1:1;return vec(v).map(([a,b])=>[a*s,b])};
const reviveIdx=(S,col)=>{const L=(S.cap||{})[col]||[];for(let i=L.length-1;i>=0;i--)if(L[i]!=='Q'&&L[i]!=='K')return i;return -1};
const armorOf=(S,q)=>q.ar!==undefined?q.ar:((S.cfg.pieces[q.t]||{}).armor||0);
const royalOn=S=>S.cfg.check!==false&&S.cfg.winPiece==='K';
function key(S){let s=S.turn;for(let r=0;r<8;r++)for(let c=0;c<8;c++){const p=S.bd[r][c];s+=p?p.c+p.t+((p.t==='K'||p.t==='R')&&!p.m?'u':''):'.'}return s+(S.ep?S.ep.r+''+S.ep.c:'')}
function newGame(cfg){const row='RNBQKBNR',bd=Array.from({length:8},()=>Array(8).fill(null));
 for(let c=0;c<8;c++){bd[0][c]={t:row[c],c:'b'};bd[1][c]={t:'P',c:'b'};bd[6][c]={t:'P',c:'w'};bd[7][c]={t:row[c],c:'w'}}
 const S={cfg,bd,turn:'w',jc:{},over:false,winner:null,reason:null,nm:{w:0,b:0},lc:{w:-EVERY,b:-EVERY},ep:null,hm:0,rep:{},cap:{w:[],b:[]},bz:false,spell:null};S.rep[key(S)]=1;if(!hasMoves(S,S.turn))finish(S,null,'stalemate');return S}
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
 if(p.fz>0)return o;
 const can=(q,y,x)=>q.c!==p.c&&!(pc.noCapture||[]).includes(q.t)&&!imm.includes(q.t)&&!shielded(S,y,x,q);
 const add=(y,x)=>{if(!In(y,x))return false;const q=bd[y][x];if(!q){o.push([y,x]);return true}if(can(q,y,x))o.push([y,x]);return false};
 if(p.t==='P'&&!pc.slide&&!pc.jumps){const d=p.c==='w'?-1:1,st=p.c==='w'?6:1,pcap=S.cfg.pawnCapture||'diag';
  if(In(r+d,c)){const q0=bd[r+d][c];if(!q0){const lim=Math.max(S.cfg.pawnRange||1,(S.cfg.pawnDouble!==false&&r===st)?2:1);for(let k=1;k<=lim;k++){const y=r+d*k;if(!In(y,c)||bd[y][c])break;o.push([y,c])}}else if(pcap!=='diag'&&q0.c===en&&can(q0,r+d,c))o.push([r+d,c])}
  if(S.cfg.pawnBack&&In(r-d,c)&&!bd[r-d][c])o.push([r-d,c]);
  if(pcap!=='straight'){
   [-1,1].forEach(s=>{if(In(r+d,c+s)){const q=bd[r+d][c+s];if(q&&q.c===en&&can(q,r+d,c+s))o.push([r+d,c+s])}});
   const e=S.ep;if(e&&e.by===en&&e.r===r+d&&Math.abs(e.c-c)===1&&!bd[e.r][e.c]){const vp=bd[e.pr][e.pc];if(vp&&can(vp,e.pr,e.pc))o.push([e.r,e.c])}}
 }else{
  rv(p,pc,pc.slide).forEach(([a,b])=>{for(let i=1;i<=(pc.max||8);i++){const y=r+a*i,x=c+b*i;if(!In(y,x))break;if(!add(y,x)&&!pc.leap)break}});
  {const bj=rv(p,pc,(STD.pieces[p.t]||{}).jumps),lim=pc.jumpLimit,jl=!lim||(S.jc[p.c+p.t]||0)<lim;
   if(pc.jumps==='any'){bj.forEach(([a,b])=>add(r+a,c+b));
    if(jl)for(let y=0;y<8;y++)for(let x=0;x<8;x++)if(!bd[y][x]&&Math.max(Math.abs(y-r),Math.abs(x-c))<=(pc.jumpRange||7)&&!o.some(m=>m[0]===y&&m[1]===x))o.push([y,x])}
   else{const bs=bj.map(v=>v+'');rv(p,pc,pc.jumps).forEach(([a,b])=>{if(jl||bs.includes(a+','+b))add(r+a,c+b)})}}
 }
 const sh=pc.shoot;
 if(sh&&(!sh.limit||(S.jc[p.c+p.t+'s']||0)<sh.limit))for(const[a,b]of rv(p,pc,sh.dirs||'all')){for(let i=1;i<=(sh.range||3);i++){const y=r+a*i,x=c+b*i;if(!In(y,x))break;const q=bd[y][x];if(!q)continue;if(can(q,y,x))o.push([y,x,'s']);break}}
 if(pc.swap&&(!pc.swapLimit||(S.jc[p.c+p.t+'w']||0)<pc.swapLimit))for(let y=0;y<8;y++)for(let x=0;x<8;x++){const q=bd[y][x];if(q&&q.c===p.c&&q!==p)o.push([y,x,'w'])}
 const lim=(k,l)=>!l||(S.jc[p.c+p.t+k]||0)<l,near=(R,f)=>{for(let y=Math.max(0,r-R);y<=Math.min(7,r+R);y++)for(let x=Math.max(0,c-R);x<=Math.min(7,c+R);x++)f(y,x,bd[y][x])};
 if(pc.freeze&&lim('f',pc.freeze.limit))near(pc.freeze.range||1,(y,x,q)=>{if(q&&q.c!==p.c&&!(q.fz>0)&&!imm.includes(q.t))o.push([y,x,'f'])});
 if(pc.convert&&lim('c',pc.convert.limit))near(pc.convert.range||1,(y,x,q)=>{if(q&&q.c!==p.c&&BAL.convertTypes.includes(q.t)&&q.t!==S.cfg.winPiece&&!imm.includes(q.t))o.push([y,x,'c'])});
 if(pc.revive&&lim('r',pc.revive.limit)&&reviveIdx(S,p.c)>=0)near(1,(y,x,q)=>{if(!q)o.push([y,x,'r'])});
 if(p.t==='K')for(const x of[6,2])if(castleRook(S,p,r,c,r,x)>=0)o.push([r,x]);
 return o}
function attacked(S,col){let kr=-1,kc=-1;
 for(let r=0;r<8;r++)for(let c=0;c<8;c++){const p=S.bd[r][c];if(p&&p.t==='K'&&p.c===col){kr=r;kc=c}}
 if(kr<0)return false;
 for(let r=0;r<8;r++)for(let c=0;c<8;c++){const p=S.bd[r][c];if(p&&p.c!==col)for(const m of pseudo(S,r,c))if(m[0]===kr&&m[1]===kc&&(!m[2]||m[2]==='s'))return true}
 return false}
function sim(S,r,c,y,x,opt){const bd=S.bd,p=bd[r][c],sv=[],save=(a,b)=>sv.push([a,b,bd[a][b]]);
 if(opt==='s'){const q=bd[y][x];if(!(q&&armorOf(S,q)>0)){save(y,x);bd[y][x]=null}}
 else if(opt==='f'){save(y,x);bd[y][x]={...bd[y][x],fz:(S.cfg.pieces[p.t].freeze||{}).turns||2}}
 else if(opt==='c'){save(y,x);bd[y][x]={...bd[y][x],c:p.c}}
 else if(opt==='r'){save(y,x);const L=S.cap[p.c];bd[y][x]={t:L[reviveIdx(S,p.c)],c:p.c}}
 else if(opt==='w'){save(r,c);save(y,x);const q=bd[y][x];bd[y][x]=p;bd[r][c]=q}
 else{const q0=bd[y][x];if(q0&&q0.c!==p.c&&armorOf(S,q0)>0)return()=>{};save(r,c);save(y,x);const e=S.ep;
  if(p.t==='P'&&!bd[y][x]&&x!==c&&e&&e.r===y&&e.c===x){save(e.pr,e.pc);bd[e.pr][e.pc]=null}
  const cr=castleRook(S,p,r,c,y,x);if(cr>=0){const nx=x===6?5:3;save(r,cr);save(r,nx);bd[r][nx]=bd[r][cr];bd[r][cr]=null}
  const cap=bd[y][x],bpc=S.cfg.pieces[p.t]||{};bd[y][x]=p;bd[r][c]=null;
  if(bpc.blast&&cap){const im=S.cfg.immune||[];for(let da=-1;da<=1;da++)for(let db=-1;db<=1;db++){const ny=y+da,nx=x+db;if((da||db)&&In(ny,nx)){const z=bd[ny][nx];if(z&&z.c!==p.c&&!im.includes(z.t)&&z.t!==S.cfg.winPiece){save(ny,nx);bd[ny][nx]=null}}}}}
 return()=>{for(let i=sv.length-1;i>=0;i--){const[a,b,v]=sv[i];bd[a][b]=v}}}
function movesOf(S,r,c){const o=pseudo(S,r,c);if(!royalOn(S))return o;
 const p=S.bd[r][c],col=p.c,res=[];
 for(const m of o){const y=m[0],x=m[1],opt=m[2];
  if(!opt&&p.t==='K'&&castleRook(S,p,r,c,y,x)>=0){
   if(attacked(S,col))continue;
   const u=sim(S,r,c,r,(c+x)/2),bad=attacked(S,col);u();if(bad)continue}
  const u=sim(S,r,c,y,x,opt),bad=attacked(S,col)&&S.bd.some(row=>row.some(q=>q&&q.t==='K'&&q.c!==col));u();if(!bad)res.push(m)}
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
function play(S,r,c,y,x,opt){const promo=(typeof opt==='string'&&opt.length===1&&'QRBN'.includes(opt))?opt:undefined;if(promo)opt=undefined;const p=S.bd[r][c],pc=S.cfg.pieces[p.t]||{},imm=S.cfg.immune||[];
 S.nm[p.c]=(S.nm[p.c]||0)+1;
 S.cap=S.cap||{w:[],b:[]};const e=S.ep;S.ep=null;let kills=[],pawn=false;
 const tq0=S.bd[y][x],armored=tq0&&tq0.c!==p.c&&(opt==='s'||!opt)&&armorOf(S,tq0)>0;
 if(armored){tq0.ar=armorOf(S,tq0)-1;if(opt==='s')S.jc[p.c+p.t+'s']=(S.jc[p.c+p.t+'s']||0)+1}
 else if(opt==='f'){const q=S.bd[y][x];S.jc[p.c+p.t+'f']=(S.jc[p.c+p.t+'f']||0)+1;q.fz=(pc.freeze&&pc.freeze.turns)||2}
 else if(opt==='c'){const q=S.bd[y][x];S.jc[p.c+p.t+'c']=(S.jc[p.c+p.t+'c']||0)+1;q.c=p.c;q.m=true}
 else if(opt==='r'){S.jc[p.c+p.t+'r']=(S.jc[p.c+p.t+'r']||0)+1;S.bd[y][x]={t:S.cap[p.c].splice(reviveIdx(S,p.c),1)[0],c:p.c,m:true}}
 else if(opt==='s'){const q=S.bd[y][x];S.jc[p.c+p.t+'s']=(S.jc[p.c+p.t+'s']||0)+1;S.bd[y][x]=null;kills=[q]}
 else if(opt==='w'){const q=S.bd[y][x];S.jc[p.c+p.t+'w']=(S.jc[p.c+p.t+'w']||0)+1;S.bd[y][x]=p;S.bd[r][c]=q;p.m=true;q.m=true}
 else{
  const q=S.bd[y][x];let epc=null;
  if(pc.jumpLimit&&pc.jumps){const dy=y-r,dx=x-c,hit=vs=>vs.some(([a,b])=>a===dy&&b===dx),bj=rv(p,pc,(STD.pieces[p.t]||{}).jumps),isSl=rv(p,pc,pc.slide).some(([a,b])=>{for(let i=1;i<=(pc.max||8);i++)if(a*i===dy&&b*i===dx)return true;return false});
   if(!isSl&&!hit(bj)&&(pc.jumps==='any'?!q:hit(rv(p,pc,pc.jumps))))S.jc[p.c+p.t]=(S.jc[p.c+p.t]||0)+1}
  pawn=p.t==='P';const std=pawn&&!pc.slide&&!pc.jumps,diagOK=(S.cfg.pawnCapture||'diag')!=='straight',cr=castleRook(S,p,r,c,y,x);
  if(std&&diagOK&&!q&&x!==c&&e&&e.r===y&&e.c===x&&e.by!==p.c){epc=S.bd[e.pr][e.pc];S.bd[e.pr][e.pc]=null}
  S.bd[y][x]=p;S.bd[r][c]=null;p.m=true;
  if(cr>=0){const rk=S.bd[r][cr];S.bd[r][x===6?5:3]=rk;S.bd[r][cr]=null;rk.m=true}
  if(std&&diagOK&&Math.abs(y-r)===2&&x===c&&r===(p.c==='w'?6:1))S.ep={r:(r+y)/2,c,pr:y,pc:c,by:p.c};
  if(pawn&&y===(p.c==='w'?0:7)){const t=S.cfg.promoteTo;p.t=(!t||t==='choice')?(promo||'Q'):t}
  kills=[q||epc];
  if(pc.blast&&q)for(let da=-1;da<=1;da++)for(let db=-1;db<=1;db++){const ny=y+da,nx=x+db;if((da||db)&&In(ny,nx)){const z=S.bd[ny][nx];if(z&&z.c!==p.c&&!imm.includes(z.t)&&z.t!==S.cfg.winPiece){kills.push(z);S.bd[ny][nx]=null}}}
 }
 kills=kills.filter(Boolean);
 for(const z of kills){const L=(S.cap[z.c]=S.cap[z.c]||[]);L.push(z.t);if(L.length>16)L.shift()}
 if(kills.some(k=>k.t===S.cfg.winPiece)){finish(S,p.c,'capture');return}
 const mover=p.c;
 S.hm=(kills.length||pawn)?0:(S.hm||0)+1;if(kills.length||pawn)S.rep={};
 for(const row of S.bd)for(const z of row)if(z&&z.c===mover&&z.fz>0)z.fz--;
 const again=!!(pc.extra&&kills.length&&!S.bz&&hasMoves(S,mover));S.bz=again;
 if(!again)S.turn=S.turn==='w'?'b':'w';
 if(S.spell&&--S.spell.left<=0){S.cfg=S.spell.base;S.spell=null;for(const row of S.bd)for(const z of row)if(z&&z.ar!==undefined)delete z.ar}
 const k=key(S);S.rep[k]=(S.rep[k]||0)+1;
 const end=ending(S,k);if(end==='checkmate')finish(S,mover,'checkmate');else if(end)finish(S,null,end)}
function sanitize(c){const L='KQRBNP',ok=x=>typeof x==='string'&&x.length===1&&L.includes(x),cl=(n,a,b)=>Math.min(b,Math.max(a,n));c=c||{};
 const o={winPiece:ok(c.winPiece)?c.winPiece:'K',promoteTo:c.promoteTo==='choice'?'choice':(ok(c.promoteTo)&&c.promoteTo!=='P'?c.promoteTo:'choice'),pawnDouble:c.pawnDouble!==false,pawnRange:Number.isInteger(c.pawnRange)?cl(c.pawnRange,1,7):1,pawnBack:c.pawnBack===true,castling:c.castling!==false,check:c.check!==false,immune:Array.isArray(c.immune)?c.immune.filter(ok).slice(0,6):[],pawnCapture:['diag','straight','both'].includes(c.pawnCapture)?c.pawnCapture:'diag',shield:{},pieces:{}};
 for(const k in(c.shield||{}))if(ok(k)&&ok(c.shield[k]))o.shield[k]=c.shield[k];
 const sv=v=>typeof v==='string'?(DIR[v]?v:undefined):Array.isArray(v)?v.slice(0,16).filter(a=>Array.isArray(a)&&a.length===2&&a.every(n=>Number.isInteger(n)&&Math.abs(n)<8)):undefined;
 for(const k of L){const p=(c.pieces||{})[k];if(!p||typeof p!=='object'){if(STD.pieces[k])o.pieces[k]=JSON.parse(JSON.stringify(STD.pieces[k]));continue}const q={};
  const sl=sv(p.slide),jm=sv(p.jumps);if(sl)q.slide=sl;if(jm)q.jumps=jm;
  if(Number.isInteger(p.max))q.max=cl(p.max,1,8);
  if(Number.isInteger(p.jumpLimit))q.jumpLimit=cl(p.jumpLimit,1,64);if(Number.isInteger(p.jumpRange))q.jumpRange=cl(p.jumpRange,1,7);
  if(p.leap===true)q.leap=true;if(p.rel===true)q.rel=true;if(p.blast===true)q.blast=true;
  if(p.swap===true){q.swap=true;if(Number.isInteger(p.swapLimit))q.swapLimit=cl(p.swapLimit,1,64)}
  if(p.shoot&&typeof p.shoot==='object'){q.shoot={dirs:sv(p.shoot.dirs)||'all',range:Number.isInteger(p.shoot.range)?cl(p.shoot.range,1,8):3};if(Number.isInteger(p.shoot.limit))q.shoot.limit=cl(p.shoot.limit,1,64)}
  const ab=(v,f)=>{if(v===true)return f({});if(v&&typeof v==='object')return f(v)};
  const fz=ab(p.freeze,f=>({turns:Number.isInteger(f.turns)?cl(f.turns,1,5):2,range:Number.isInteger(f.range)?cl(f.range,1,3):1,...(Number.isInteger(f.limit)?{limit:cl(f.limit,1,64)}:{})}));if(fz)q.freeze=fz;
  const cv=ab(p.convert,f=>({range:Number.isInteger(f.range)?cl(f.range,1,3):1,...(Number.isInteger(f.limit)?{limit:cl(f.limit,1,64)}:{})}));if(cv)q.convert=cv;
  const rv2=ab(p.revive,f=>(Number.isInteger(f.limit)?{limit:cl(f.limit,1,64)}:{}));if(rv2)q.revive=rv2;
  if(Number.isInteger(p.armor))q.armor=cl(p.armor,1,3);if(p.extra===true)q.extra=true;
  if(Array.isArray(p.noCapture))q.noCapture=p.noCapture.filter(ok).slice(0,6);o.pieces[k]=q}
 return o}
const EVERY=2;
function canChange(S,c){const n=S.nm||{w:0,b:0},l=S.lc||{w:-EVERY,b:-EVERY};return !S.over&&!S.spell&&S.turn===c&&n[c]-l[c]>=EVERY}

// ===== balance: rules are short-lived spells; the engine trims anything too strong =====
const BAL={budget:4,lifetime:2,pawnRange:3,shoot:3,blink:3,freezeTurns:1,freezeRange:2,armor:1,mobilityCap:14,convertTypes:'PNB'};
const MOVE_FIELDS=['slide','max','jumps','jumpLimit','leap','jumpRange','rel'];
function power(cfg,X){const c=JSON.parse(JSON.stringify(cfg));c.check=false;if(c.pieces[X]&&c.pieces[X].jumps==='any')c.pieces[X].jumps=null;
 const T=newGame(c);T.over=false;T.bd=Array.from({length:8},()=>Array(8).fill(null));T.bd[4][3]={t:X,c:'w'};T.cap={w:[],b:[]};
 return movesOf(T,4,3).filter(m=>!m[2]).length}
function balance(baseIn,cfgIn){
 const B=sanitize(baseIn),c=sanitize(cfgIn),notes=[],J=JSON.stringify,note=(k,x,v)=>notes.push({k,x,v});
 if(c.winPiece!==B.winPiece){c.winPiece=B.winPiece;note('win')}
 if(c.immune.includes('K')){c.immune=c.immune.filter(x=>x!=='K');note('immuneK')}
 if(c.pawnRange>BAL.pawnRange){c.pawnRange=BAL.pawnRange;note('pawnRange',null,BAL.pawnRange)}
 const changed=X=>J(c.pieces[X])!==J(B.pieces[X]);
 for(const X of Object.keys(c.pieces)){if(!changed(X))continue;const d=c.pieces[X];
  if(d.shoot&&d.shoot.range>BAL.shoot){d.shoot.range=BAL.shoot;note('shoot',X,BAL.shoot)}
  if(d.jumps==='any'&&(d.jumpRange||7)>BAL.blink){d.jumpRange=BAL.blink;note('blink',X,BAL.blink)}
  if(d.freeze&&(d.freeze.turns>BAL.freezeTurns||d.freeze.range>BAL.freezeRange)){d.freeze.turns=Math.min(d.freeze.turns,BAL.freezeTurns);d.freeze.range=Math.min(d.freeze.range,BAL.freezeRange);note('freeze',X)}
  if(d.convert&&d.convert.range>1){d.convert.range=1;note('convert',X)}
  if(d.armor>BAL.armor){d.armor=BAL.armor;note('armor',X,BAL.armor)}}
 // movement power: a changed piece may not become stronger than a rook
 for(const X of 'KQRBN'){if(!changed(X)||!c.pieces[X])continue;const d=c.pieces[X],mv=o=>J(MOVE_FIELDS.map(k=>o&&o[k]));if(mv(d)===mv(B.pieces[X]))continue;
  const cap=Math.max(power(B,X),BAL.mobilityCap);if(power(c,X)<=cap)continue;
  if(d.slide&&d.slide.length)for(let m=(d.max||8)-1;m>=1;m--){d.max=m;if(power(c,X)<=cap)break}
  if(power(c,X)>cap){for(const k of MOVE_FIELDS){const v=B.pieces[X]&&B.pieces[X][k];if(v===undefined)delete d[k];else d[k]=JSON.parse(J(v))}}
  note('mobility',X)}
 // power budget
 const F=[],add=(cost,k,x,rm)=>F.push({cost,k,x,rm});
 for(const X of Object.keys(c.pieces)){if(!changed(X))continue;const d=c.pieces[X],b0=B.pieces[X]||{};
  if(J(MOVE_FIELDS.map(k=>d[k]))!==J(MOVE_FIELDS.map(k=>b0[k])))add(1,'move',X,()=>{for(const k of MOVE_FIELDS){if(b0[k]===undefined)delete d[k];else d[k]=JSON.parse(J(b0[k]))}});
  if(d.leap&&!b0.leap)add(1,'leap',X,()=>{delete d.leap});
  if(d.jumps==='any'&&b0.jumps!=='any')add(1,'blinkc',X,()=>{if(b0.jumps===undefined)delete d.jumps;else d.jumps=JSON.parse(J(b0.jumps));delete d.jumpRange});
  for(const [k,cost] of [['shoot',2],['swap',1],['blast',2],['freeze',2],['convert',3],['revive',2],['armor',1],['extra',3]])if(d[k]&&!b0[k])add(cost,k,X,()=>{delete d[k]})}
 if(!c.check&&B.check)add(2,'nocheck',null,()=>{c.check=true});
 if(c.pawnRange>B.pawnRange)add(c.pawnRange-B.pawnRange,'pawnRange',null,()=>{c.pawnRange=B.pawnRange});
 if(c.pawnBack&&!B.pawnBack)add(1,'pawnBack',null,()=>{c.pawnBack=false});
 if(c.pawnCapture!==B.pawnCapture)add(1,'pawnCapture',null,()=>{c.pawnCapture=B.pawnCapture});
 for(const X of c.immune)if(!B.immune.includes(X))add(2,'immune',X,()=>{c.immune=c.immune.filter(z=>z!==X)});
 for(const X of Object.keys(c.shield))if(J(c.shield[X])!==J(B.shield[X]))add(1,'shield',X,()=>{if(B.shield[X]===undefined)delete c.shield[X];else c.shield[X]=B.shield[X]});
 const spent=F.reduce((a,f)=>a+f.cost,0);let total=spent;
 while(total>BAL.budget&&F.length){let bi=0;F.forEach((f,i)=>{if(f.cost>=F[bi].cost)bi=i});const f=F.splice(bi,1)[0];f.rm();total-=f.cost;note('trim',f.x,f.k)}
 return{cfg:sanitize(c),notes,cost:total,spent,budget:BAL.budget}}
const kingAttacked=(S,col)=>attacked(S,col);
// a spell must not hand anybody an instant win: the enemy king may not be attacked right after the cast, and the caster must still have a move
function validateSpell(S,cfg,c){const P=[],T=JSON.parse(JSON.stringify(S));T.cfg=cfg;T.spell=null;T.over=false;
 if(attacked(T,c==='w'?'b':'w'))P.push('exposed');
 if(!hasMoves(T,c))P.push('trapped');
 return P}
function setRules(S,cfg,c){
 const base=S.spell?S.spell.base:S.cfg,b=balance(base,cfg),probs=validateSpell(S,b.cfg,c);
 if(probs.length)return{ok:false,problems:probs,notes:b.notes,cost:b.cost,budget:b.budget};
 S.spell={base,left:BAL.lifetime,by:c};S.cfg=b.cfg;S.lc[c]=S.nm[c];S.hm=0;S.rep={};S.rep[key(S)]=1;
 return{ok:true,cfg:b.cfg,notes:b.notes,cost:b.cost,budget:b.budget}}
const E={STD,DIR,vec,newGame,movesOf,play,sanitize,EVERY,canChange,setRules,finish,inCheck,armorOf,balance,validateSpell,kingAttacked,BAL};
if(typeof module!=='undefined')module.exports=E;else window.Chess=E;
})();

/* My Rules Chess: UI, parser, online, Yandex Games */
const SERVER='wss://CHANGE-ME.onrender.com';
const E=window.Chess,STD=E.STD,vec=E.vec;
const $=id=>document.getElementById(id);
let cfg=STD,S=E.newGame(cfg),mode='local',me='w',ws=null,room=null,sel=null,mv=[],opp=true,rq=false,dq=false,dm=false,tries=0,sumTxt='',sum0='',lang=(()=>{try{const v=localStorage.getItem('chessLang');if(v==='ru'||v==='en')return v}catch(e){}return /^ru|^be|^kk|^uk|^uz/.test(navigator.language||'')?'ru':'en'})();
/*P1*/
const PN=/королев\p{L}*|корол[ьяюеё]\p{L}*|king|ферз\p{L}*|queen|ладь\p{L}*|ладе[йяю]\p{L}*|rook|слон\p{L}*|bishop|кон(?:ь|я|ю|ём|ем|ей|и|е)(?!\p{L})|knight|пеш(?:к|ек)\p{L}*|pawn/giu;
const pl=w=>{w=w.toLowerCase();return /^(королев|queen|ферз)/.test(w)?'Q':/^(корол|king)/.test(w)?'K':/^(ладь|ладе|rook)/.test(w)?'R':/^(слон|bishop)/.test(w)?'B':/^(кон|knight)/.test(w)?'N':'P'};
const pcs=t=>(t.match(PN)||[]).map(pl);
const NMS={ru:{K:'король',Q:'ферзь',R:'ладья',B:'слон',N:'конь',P:'пешка'},en:{K:'king',Q:'queen',R:'rook',B:'bishop',N:'knight',P:'pawn'}};const NM=new Proxy({},{get:(_,k)=>NMS[lang][k]});
const NUM={один:1,одну:1,одна:1,одно:1,два:2,две:2,три:3,четыре:4,пять:5,шесть:6,семь:7};
const num=w=>/^\d+$/.test(w)?+w:NUM[w];
function parseRules(text,base){
 const c=JSON.parse(JSON.stringify(base||STD)),ok=[],bad=[];let lastX=null;
 text.toLowerCase().split(/[.;\n!]+|,(?!\s*(?:кто|who))|\s+но\s+|\s+but\s+|\s+а также\s+/).map(x=>x.trim()).filter(Boolean).forEach(t=>{
  const p=pcs(t);if(p[0])lastX=p[0];const X=p[0]||lastX,rest=p.slice(1);
  if(/рокир|castling|castle/.test(t)){c.castling=!/без|нет|нельзя|запрещ|отмен|убра|(?:^|\s)не\s|\bno\b|without|disable|forbid|cannot|can't|\bnot\b/.test(t);ok.push(f('cst',{v:TX[lang][c.castling?'yes':'no']}));return}
  if(/(?<![\p{L}])(?:шах|шаха|шаху|шахи|шахом|мат|мата|мату|матом|checkmates?|checks?)(?![\p{L}])/u.test(t)){c.check=!/без|нет|отмен|убра|\bno\b|without|disable|\boff\b|не\s/.test(t);ok.push(f('ckr',{v:TX[lang][c.check?'yes':'no']}));return}
  if(/пешк|pawn/.test(t)&&/назад|backward|backwards/.test(t)){c.pawnBack=!/(?:^|\s)не\s|нельзя|запрещ|\bno\b|cannot|can't|don't|doesn't/.test(t);ok.push('pawn back');return}
  if(!X){bad.push(t);return}
  const pc=()=>c.pieces[X]=c.pieces[X]||{};
  const cnt=()=>{const m2=t.match(/(\d+|два|две|три)\s*(?:раз|times)/);return m2?num(m2[1]):(/\btwice\b/.test(t)?2:(/один|одн[ауо]|\bonce\b|\bone\b/.test(t)?1:0))};
  if(/пистолет|ружь|ружё|снайпер|стреля|выстрел|\bgun|shoot|sniper|pistol|rifle/.test(t)){
   const mm=t.match(/(\d+|один|одну|одна|одно|два|две|три|четыре|пять|шесть|семь)\s*(?:клет|squares?|cells?)/),n=mm?num(mm[1]):3,l=cnt();
   const dirs=/диагонал|diagonal/.test(t)?'diag':/по прям|вертикал|горизонтал|straight|orthogonal/.test(t)?'orth':'all';
   pc().shoot={dirs,range:Math.min(8,n||3)};if(l)pc().shoot.limit=l;ok.push(f('gun',{a:NM[X],n:pc().shoot.range}));return}
  if(/меняется\s+местами|меняться\s+местами|поменяться\s+местами|обмен\w*\s+мест|\bswap/.test(t)){const l=cnt();pc().swap=true;if(l)pc().swapLimit=l;ok.push(f('swp',{a:NM[X]}));return}
  if(/неуязвим|бессмертн|\bimmune|invulnerable|immortal|cannot be captured|can't be captured/.test(t)){c.immune=[...new Set([...(c.immune||[]),X])];ok.push(f('imm',{a:NM[X]}));return}
  if(/взрыв|бомб|гранат|explo|\bblast|\bbomb|grenade/.test(t)){pc().blast=true;ok.push(f('bl',{a:NM[X]}));return}
  const rng=()=>{const m3=t.match(/(\d+|один|одну|одна|одно|два|две|три)\s*(?:клет|squares?|cells?)/);return m3?Math.min(3,Math.max(1,num(m3[1]))):1};
  if(/замораж|замороз|ледян|\bfreez|\bfrost|\bice\b/.test(t)){const mt=t.match(/(\d+|один|одну|одна|одно|два|две|три|четыре|пять)\s*(?:хода|ходов|ход|turns?|moves?)/),l=cnt();pc().freeze={turns:mt?Math.min(5,Math.max(1,num(mt[1]))):2,range:rng()};if(l)pc().freeze.limit=l;ok.push('freeze');return}
  if(/обраща|обратит|переманив|вербу|гипноз|подчин|\bcharm|\bconvert|mind\s*control|brainwash|hypnoti[sz]e|enthrall|turns?\s+(?:the\s+)?enem\w+\s+into|into\s+allies|to\s+(?:your|its)\s+side/.test(t)){const l=cnt();pc().convert={range:rng()};if(l)pc().convert.limit=l;ok.push('convert');return}
  if(/воскре|оживля|оживит|некромант|\brevive|resurrect|raise\s+(?:the\s+)?dead|necromanc/.test(t)){const l=cnt();pc().revive=l?{limit:l}:{};ok.push('revive');return}
  if(/брон[яеи]|доспех|прочн|крепк\w*\s+(?:шкур|панцир)|\barmou?r|\btough|extra\s+life|hit\s*points?|\d+\s+жизн/.test(t)){const ma=t.match(/(\d+|один|одну|одна|одно|два|две|три)\s*(?:раз|удар|взят|hits?|captures?|times?|жизн|lives?)/);pc().armor=ma?Math.min(3,Math.max(1,num(ma[1]))):1;ok.push('armor');return}
  if(/берсерк|ещ[её]\s+(?:один\s+)?ход|дополнительн\w*\s+ход|ходит\s+(?:ещ[её]\s+раз|дважды|снова)|extra\s+(?:turn|move)|\bberserk|moves\s+again|another\s+(?:turn|move)|second\s+move/.test(t)){pc().extra=true;ok.push('extra');return}
  if(/не\s+(?:умеет|умеют|может|могут|способен|способны)\s+(?:ходить|двигаться|перемещаться)(?!\s+(?:на|по|как|через|вперёд|вперед|назад|в)\s)|не\s+(?:ходит|ходят|двигается|двигаются|перемещается)(?!\s+(?:на|по|как|через|вперёд|вперед|назад|в)\s)|стоит\s+на\s+месте|стоят\s+на\s+месте|\bcannot\s+move(?!\s+(?:\d|one|two|three|four|by|like|forward|backward|over|through))|can't\s+move(?!\s+(?:\d|one|two|three|four|by|like|forward|backward|over|through))|doesn'?t\s+move(?!\s+(?:\d|one|two|three|four|by|like|forward|backward|over|through))|don'?t\s+move(?!\s+(?:\d|one|two|three|four|by|like|forward|backward|over|through))|\bimmobile|\bstays?\s+still/.test(t)){c.pieces[X]={slide:[]};ok.push(f('stay',{a:NM[X]}));return}
  if(X==='P'&&/бь[её]т|бьют|бить|берёт|берут|брать|captur|take/.test(t)&&!/не\s+(?:может|могут)/.test(t)){
   const pv=/и\s+(?:по\s+)?диагонал|и\s+прямо|и\s+вперёд|и\s+вперед|both|and\s+diagonal/.test(t)?'both':(/только\s+по\s+диагонал|only\s+diagonal/.test(t)||(/диагонал|diagonal/.test(t)&&!/прямо|вперёд|вперед|straight|forward|ahead/.test(t)))?'diag':(/прямо|вперёд|вперед|straight|forward|ahead/.test(t)?'straight':null);
   if(pv){c.pawnCapture=pv;ok.push(f('pcp',{v:TX[lang][{straight:'pcs',diag:'pcd',both:'pcb'}[pv]]}));return}}
  if(/не\s+(?:может\s+|могут\s+)?(?:бить|бьёт|бьет|брать|берёт|берет|съедать|съедает)|(?:cannot|can't|doesn't|never)\s+(?:capture|take)/.test(t)&&rest.length){
   pc().noCapture=[...new Set([...(pc().noCapture||[]),...rest])];ok.push(f('nc',{a:NM[X],b:rest.map(r=>NM[r]).join(', ')}));return}
  if(X!=='P'&&/левитир|левитац|летает|летают|летит|парит|полёт|полет|призрак|\bflies|\bfly\b|float|levitat|ghost|через\s+(?:другие\s+|любые\s+|все\s+)?фигур|перепрыг|сквозь|не\s+блокиру|jumps?\s+over|through\s+(?:other\s+)?pieces|ignor\w+\s+block|can'?t be blocked/.test(t)){pc().leap=true;ok.push(f('lp',{a:NM[X]}));return}
  if(/телепорт|прыж|прыг|jump|teleport|любую\s+(?:пустую\s+)?клетку|куда\s+угодно|anywhere|any\s+square/.test(t)&&X!=='P'){
   const any=/любую\s+(?:пустую\s+)?клетку|куда\s+угодно|anywhere|any\s+square/.test(t)||(X==='N'&&/телепорт|teleport/.test(t)),a=pc();a.jumps=any?'any':'knight';const m2=t.match(/(\d+|два|две|три)\s*(?:раз|times)/);
   const n=m2?num(m2[1]):/\btwice\b/.test(t)?2:(/один|одн[ауо]|\bonce\b|\bone\b/.test(t)?1:0);if(n)a.jumpLimit=n;
   ok.push(f(any?'jany':'jp',{a:NM[X],n:n?f('jn',{n}):''}));return}
  if(/превращ|становится|становятся|promot|turns? into|becomes?/.test(t)){
   if(/на\s+выбор|любую\s+фигуру|во\s+что\s+(?:угодно|захоч)|any\s+piece|of\s+choice|player\s+chooses/.test(t)){c.promoteTo='choice';ok.push(f('pr',{a:TX[lang].anyp}))}else if(rest[0]&&rest[0]!=='P'){c.promoteTo=rest[0];ok.push(f('pr',{a:NM[rest[0]]}))}else bad.push(t);return}
  if(/побежда|выигрыв|победа|\bwins?\b/.test(t)){if(!p[0]){bad.push(t);return}c.winPiece=X;ok.push(f('wn',{a:NM[X]}));return}
  if(/щит|защит|shield|protect/.test(t)&&p.length>=2){
   const pr=/защищает|защищают|protects/.test(t),a=pr?p[1]:p[0],b=pr?p[0]:p[1];
   c.shield[a]=b;ok.push(f('sh',{a:NM[a],b:NM[b]}));return}
  let hit=false;
  let dbl=false;
  if(X==='P'&&(/двойн|перв\S*\s+ход|начальн|double|first\s+move|initial/.test(t)||(/(?:^|\s)не\s|нельзя|без\s|\bno\b|cannot|can't|don't|doesn't/.test(t)&&/(?:на\s+(?:две|2)\s+клет|\b(?:by\s+)?(?:2|two)\s+squares?)/.test(t)))){dbl=true;c.pawnDouble=!/не |без|нельзя|запрещ|отключ|отмен|убер|убр|\bno |cannot|can't|forbid|disable|remove/.test(t);ok.push(f('db',{v:TX[lang][c.pawnDouble?'yes':'no']}));hit=true}
  {
   const a=pc();
   if(/(?:ходит|ходят|двигается|двигаются|moves?)\s+(?:на\s+\S+\s+клет\S*\s+|(?:up\s+to\s+)?\S+\s+squares?\s+)?(?:и\s+)?(?:как|like)/.test(t)&&rest.length){
    let sl=[],jm=[],mx=0;
    rest.forEach(L=>{const r=STD.pieces[L]||{};sl=sl.concat(vec(r.slide));jm=jm.concat(vec(r.jumps));mx=Math.max(mx,r.max||0)});
    const u=v=>[...new Map(v.map(x=>[x+'',x])).values()];
    if(sl.length||jm.length){a.slide=u(sl);a.jumps=u(jm);a.max=mx||8;ok.push(f('lk',{a:NM[X],b:rest.map(r=>NM[r]).join(' + ')}));hit=true}
   }
   const d=/диагонал|diagonal/.test(t)?'diag':/по прям|горизонтал|вертикал|straight|orthogonal|ортогонал/.test(t)?'orth':/во все сторон|any direction|all directions|в любом направлени/.test(t)?'all':null;
   if(d){a.slide=d;if(!a.max)a.max=8;ok.push(f('dr',{a:NM[X],d:TX[lang]['d_'+d]}));hit=true}
   const mm=t.match(/(\d+|один|одну|одна|одно|два|две|три|четыре|пять|шесть|семь)\s*(?:клет|squares?|cells?)/);
   if(mm&&!dbl){if(X==='P'&&!hit){c.pawnRange=Math.min(7,Math.max(1,num(mm[1])));ok.push(f('prg',{n:c.pawnRange}))}else{a.max=num(mm[1]);ok.push(f('mx',{a:NM[X],n:a.max}))}hit=true}
  }
  if(!hit)bad.push(t);
 });
 return{c,ok,bad};
}
/*P2*/
const TX={ru:{lp:'{a} прыгает через фигуры',stay:'{a}: не может ходить',rst:'все правила сброшены к классическим',chk:'ШАХ!',r_checkmate:'мат',chs:'Выбери действие',mvto:'пойти и взять',shoot:'выстрелить',swapt:'поменяться местами',gun:'{a}: стреляет, дальность {n}',swp:'{a}: меняется местами с союзником',imm:'{a}: неуязвим',bl:'{a}: взрыв при взятии',ckr:'шах и мат: {v}',draw:'Ничья: {r}',r_stalemate:'пат',r_repetition:'троекратное повторение',r_fifty:'правило 50 ходов',r_kings:'остались одни короли',r_agreed:'по согласию',r_resign:'соперник сдался',dw:'ничья',rg:'сдаться',dro:'соперник предлагает ничью (нажми «ничья»)',drw:'ничья предложена',prot:'Во что превратить пешку?',cst:'рокировка: {v}',anyp:'любую фигуру на выбор',pcp:'пешки бьют: {v}',pcs:'только прямо',pcd:'по диагонали',pcb:'прямо и по диагонали',jany:'{a}: ходит в любую клетку{n}',mt:'MyChessRules',tag:'правила пишешь ты',back:'← меню',ri_setup:'Партия не начата',ri_turn:'Менять правила можно только в свой ход',ri_wait:'Правило можно накладывать раз в 2 своих хода, осталось ходов: {n}',ri_ready:'Можно наложить правило: оно действует один ход каждого игрока, ход не тратится',rl:'Сейчас менять правила нельзя',lv:'выйти из комнаты',locked:'В комнате правила менять нельзя. Выйди из комнаты, примени правила и создай новую.',aifail:'ИИ недоступен: ',code4:'Введи 4-значный код комнаты',wake:'Сервер просыпается, подожди около минуты…',loc:'играть с ботом',crt:'создать комнату',jn2:'войти',wait:'Ждём соперника. Код комнаты: {k}',you:'ты — {c}',nf:'Комната не найдена',full:'Комната занята',bm:'Недопустимый ход',off:'Нет связи с сервером, переподключаюсь…',rmw:'ждём согласия на реванш',codeph:'код',title:'MyChessRules: шахматы, где правила пишешь ты',bot:'бот за чёрных',again:'заново',apply:'применить правила',hq:'Примеры правил',cw:'белые',cb:'чёрные',turn:'Ходят {c}',win:'Победа! Выиграли {c}!',yes:'да',no:'нет',
dmh:'бот против бота',dms:'обычные шахматы',cf_rs:'Начать заново?',cf_rs_m:'Текущая партия будет потеряна.',cf_rs_mo:'Сопернику уйдёт запрос на новую партию.',cf_rs_y:'да, заново',cf_rg:'Сдаться?',cf_rg_m:'Партия будет засчитана как поражение.',cf_rg_y:'да, сдаться',cf_dw:'Предложить ничью?',cf_dw_m:'Партия закончится вничью.',cf_dw_mo:'Сопернику придёт предложение. Если он согласится, партия закончится вничью.',cf_dw_y:'да, ничья',ri_active:'Правило действует, осталось ходов: {n}',spellbad:'Это правило сейчас нельзя применить',spellend:'Правило закончилось: снова обычные шахматы',spelldur:'действует один ход каждого игрока',pvcost:'Мощность правила: {c} из {b}',pvdur:'Действует один ход каждого игрока, потом правила вернутся.',freezet:'заморозить',convt:'обратить в союзника',revt:'воскресить',mvgo:'пойти',pvt:'Проверь, что получится',pvy:'применить',pvn:'отмена',pvlg:'● ходы    ◯ способности',pvnote:'Так фигура ведёт себя на пустой доске:',d_orth:'по прямым',d_diag:'по диагонали',d_all:'во все стороны',prg:'пешка: ходит вперёд до {n} кл.',
ph:'Напиши: слон ходит как конь',
help:'слон ходит как конь\nконь замораживает врагов на 2 хода\nслон обращает врагов в союзников\nферзь воскрешает павших\nпешки в броне\nконь ходит ещё раз после взятия\nпешки ходят назад\nпешка ходит на 3 клетки\nферзь прыгает через фигуры\nу пешек пистолет\nконь телепортируется один раз\nферзь неуязвим\nпешки бьют только прямо\nслон — бомба\nбез шаха и мата',
nc:'{a} не бьёт: {b}',jp:'{a}: прыжок конём{n}',jn:' ({n} р. за партию)',pr:'пешка превращается в: {a}',wn:'победа за того, кто съест: {a}',sh:'{a} под щитом: {b} рядом',db:'двойной ход пешки: {v}',lk:'{a} ходит как {b}',dr:'{a} ходит: {d}',mx:'{a}: максимум {n} кл.',none:'Ничего не понял. Загляни в «Примеры правил».',bad:'Не понял:',okh:'Применено:',skip:'Не понял (пропустил):'},
en:{lp:'{a} jumps over pieces',stay:'{a}: cannot move',rst:'all rules reset to classic',chk:'CHECK!',r_checkmate:'checkmate',chs:'Choose an action',mvto:'move and capture',shoot:'shoot',swapt:'swap places',gun:'{a}: shoots, range {n}',swp:'{a}: swaps places with an ally',imm:'{a}: invulnerable',bl:'{a}: explodes on capture',ckr:'check and checkmate: {v}',draw:'Draw: {r}',r_stalemate:'stalemate',r_repetition:'threefold repetition',r_fifty:'50-move rule',r_kings:'only kings left',r_agreed:'by agreement',r_resign:'opponent resigned',dw:'draw',rg:'resign',dro:'opponent offers a draw (press «draw»)',drw:'draw offered',prot:'Promote the pawn to:',cst:'castling: {v}',anyp:'any piece of choice',pcp:'pawns capture: {v}',pcs:'straight ahead only',pcd:'diagonally',pcb:'straight and diagonally',jany:'{a}: moves to any square{n}',mt:'MyChessRules',tag:'you write the rules',back:'← menu',ri_setup:'Game not started: set the rules and press apply',ri_turn:'You can change rules only on your turn',ri_wait:'A rule can be cast every 2 of your moves, moves left: {n}',ri_ready:'You can cast a rule now: it lasts one move of each player and costs no move',rl:'You cannot change the rules right now',lv:'leave room',locked:'Rules cannot be changed inside a room. Leave, apply rules, then create a new room.',aifail:'AI unavailable: ',code4:'Enter the 4-character room code',wake:'Server is waking up, wait about a minute…',loc:'play vs bot',crt:'create room',jn2:'join',wait:'Waiting for opponent. Room code: {k}',you:'you are {c}',nf:'Room not found',full:'Room is full',bm:'Illegal move',off:'No connection, reconnecting…',rmw:'waiting for rematch',codeph:'code',title:'MyChessRules: chess where you write the rules',bot:'bot plays black',again:'restart',apply:'apply rules',hq:'Example rules',cw:'White',cb:'Black',turn:'{c} to move',win:'{c} win!',yes:'yes',no:'no',
dmh:'bot vs bot',dms:'classic chess',cf_rs:'Start over?',cf_rs_m:'The current game will be lost.',cf_rs_mo:'Your opponent will get a request for a new game.',cf_rs_y:'yes, restart',cf_rg:'Resign?',cf_rg_m:'The game will count as a loss.',cf_rg_y:'yes, resign',cf_dw:'Offer a draw?',cf_dw_m:'The game will end in a draw.',cf_dw_mo:'Your opponent gets an offer. If they accept, the game ends in a draw.',cf_dw_y:'yes, draw',ri_active:'A rule is active, moves left: {n}',spellbad:'This rule cannot be applied now',spellend:'The rule is over: normal chess again',spelldur:'lasts one move of each player',pvcost:'Rule power: {c} of {b}',pvdur:'Lasts one move of each player, then the rules return.',freezet:'freeze',convt:'convert to ally',revt:'revive',mvgo:'move',pvt:'Check what you get',pvy:'apply',pvn:'cancel',pvlg:'● moves    ◯ abilities',pvnote:'How the piece behaves on an empty board:',d_orth:'straight',d_diag:'diagonally',d_all:'in all directions',prg:'pawn: moves forward up to {n} squares',
ph:'Type: bishop moves like a knight',
help:'bishop moves like knight\nknight freezes enemies for 2 turns\nbishop turns enemies into allies\nqueen revives fallen pieces\npawns wear armor\nknight moves again after a capture\npawns can move backward\npawn moves 3 squares\nqueen jumps over pieces\npawns have a pistol\nknight teleports once\nqueen is invulnerable\npawns capture only straight ahead\nbishop is a bomb\nno check and no checkmate',
nc:'{a} cannot capture: {b}',jp:'{a}: knight jump{n}',jn:' ({n}x per game)',pr:'pawn promotes to: {a}',wn:'win by capturing: {a}',sh:'{a} is shielded by adjacent {b}',db:'pawn double step: {v}',lk:'{a} moves like {b}',dr:'{a} moves: {d}',mx:'{a}: max {n} squares',none:'Did not understand anything. See "Example rules".',bad:'Not understood:',okh:'Applied:',skip:'Not understood (skipped):'}};
const t=k=>TX[lang][k],f=(k,o)=>t(k).replace(/\{(\w+)\}/g,(_,x)=>o[x]);

const G={K:'♚',Q:'♛',R:'♜',B:'♝',N:'♞',P:'♟\uFE0E'},V={K:1000,Q:9,R:5,B:3,N:3,P:1};
const cn=c=>t(c==='w'?'cw':'cb');
const psvg=k=>'<svg class="ps" viewBox="0 0 45 45"><use href="#'+k+'" width="45" height="45"/></svg>';
const inChk=()=>!S.over&&E.inCheck(S,S.turn);
function status(){
 if(mode==='online'&&ws&&ws.readyState===0)return t('wake');
 if(mode==='online'&&ws&&ws.readyState!==1)return t('off');
 if(S.over)return(S.winner?f('win',{c:cn(S.winner)})+(S.reason==='resign'?' · '+t('r_resign'):S.reason==='checkmate'?' · '+t('r_checkmate'):''):f('draw',{r:t('r_'+S.reason)}))+(rq?' · '+t('rmw'):'');
 const ck=inChk()?' · '+t('chk'):'';
 if(mode==='online'){if(!opp)return f('wait',{k:room?room.code:'…'});return f('turn',{c:cn(S.turn)})+ck+' · '+f('you',{c:cn(me)})+(dq?' · '+t('dro'):'')+(dm?' · '+t('drw'):'')}
 return f('turn',{c:cn(S.turn)})+ck}
let prev=null,lm=null,introFlag=false,lastSp=false;
const snap=()=>S.bd.map(r=>r.map(p=>p?p.c+p.t:''));
function diffMoves(a,b){
 const src=[],dst=[];
 for(let r=0;r<8;r++)for(let c=0;c<8;c++)if(a[r][c]!==b[r][c]){if(a[r][c])src.push({r,c,k:a[r][c],used:false});if(b[r][c])dst.push({r,c,k:b[r][c]})}
 if(!src.length&&!dst.length||src.length+dst.length>8)return null;
 const to={};
 for(const d of dst){const s=src.find(s=>!s.used&&s.k===d.k);if(s){s.used=true;to[d.r+','+d.c]={fr:s.r,fc:s.c}}}
 for(const d of dst){if(to[d.r+','+d.c])continue;const s=src.find(s=>!s.used&&s.k[0]===d.k[0]&&s.k[1]==='P');if(s){s.used=true;to[d.r+','+d.c]={fr:s.r,fc:s.c}}}
 const gone={};for(const s of src)if(!s.used)gone[s.r+','+s.c]=1;
 for(const d of dst)if(to[d.r+','+d.c]&&a[d.r][d.c])gone[d.r+','+d.c]=1;
 return{to,gone}}
function draw(){
 const B=$('b');B.innerHTML='';const fl=mode==='online'&&me==='b',cur=snap(),an=prev?diffMoves(prev,cur):null,pend=[],ck=inChk();const chg=prev&&cur.some((row,i)=>row.some((v,j)=>v!==prev[i][j]));if(an){lm={};for(const k in an.to){lm[k]=1;lm[an.to[k].fr+','+an.to[k].fc]=1}for(const k in an.gone)lm[k]=1}else if(chg)lm=null;const oldB=prev;prev=cur;
 for(let i=0;i<8;i++)for(let j=0;j<8;j++){
  const r=fl?7-i:i,c=fl?7-j:j,d=document.createElement('div');d.className='c '+((r+c)%2?'d':'l');
  if(sel&&sel[0]===r&&sel[1]===c)d.classList.add('s');
  const p=S.bd[r][c],here=mv.filter(m=>m[0]===r&&m[1]===c);
  if(here.length){const n=here.find(m=>!m[2]),o=here.find(m=>m[2]);d.classList.add('m');if(n){if(p)d.classList.add('x');if(o)d.classList.add('both')}else if(o)d.classList.add(({s:'sh',w:'sw',f:'fzk',c:'cvk',r:'rvk'})[o[2]]||'sw')}
  if(p){const sp=document.createElement('span');sp.className='pc';sp.innerHTML=psvg(p.c+p.t);d.appendChild(sp);d.classList.add(p.c==='w'?'w':'k');
   if(ck&&p.t==='K'&&p.c===S.turn)d.classList.add('ck');
   badges(sp,p,S);
   if(introFlag){sp.classList.add('pi');sp.style.animationDelay=(i*45+j*25)+'ms'}
   const a=an&&an.to[r+','+c];if(a){const fi=fl?7-a.fr:a.fr,fj=fl?7-a.fc:a.fc,dx=(fj-j)*100,dy=(fi-i)*100;sp.style.transition='none';sp.style.transform='translate('+dx+'%,'+dy+'%)';sp.style.zIndex=5;sp.dataset.from=dx+','+dy;pend.push(sp)}}
  if(an&&an.gone[r+','+c]){d.classList.add('fl');const ok=oldB&&oldB[r][c];if(ok){const g=document.createElement('span');g.className='gh';g.innerHTML=psvg(ok);d.appendChild(g)}}
  if(lm&&lm[r+','+c])d.classList.add('lm');
  if(j===0){const n=document.createElement('i');n.className='co n';n.textContent=8-r;d.appendChild(n)}
  if(i===7){const n=document.createElement('i');n.className='co f';n.textContent='abcdefgh'[c];d.appendChild(n)}
  d.onclick=()=>click(r,c);B.appendChild(d)}
 if(pend.length){void B.offsetWidth;for(const sp of pend){sp.style.transition='transform .26s cubic-bezier(.25,.8,.25,1)';sp.style.transform='translate(0,0)'}}
 {const s=status();$('st').textContent=s;$('mst').textContent=(mode==='online'&&ws&&ws.readyState!==1)?s:'';const rc=$('rc');rc.style.display=(mode==='online'&&room)?'':'none';rc.textContent=room?room.code:'';const lv=!S.over&&S.nm.w+S.nm.b>0;$('rg').style.display=lv?'':'none';$('dw').style.display=(lv&&(mode==='online'||!$('bot').checked))?'':'none'}
 $('bot').parentNode.style.display=mode==='online'?'none':'';
 $('ri').textContent=rinfo(mode==='online'?me:($('bot').checked?'w':S.turn));{const sp=!!S.spell;if(lastSp&&!sp&&!S.over&&S.nm.w+S.nm.b>0)$('sum').textContent=t('spellend');lastSp=sp}
}
function rinfo(who){if(S.over)return '';if(S.spell)return f('ri_active',{n:S.spell.left});if(S.turn!==who)return t('ri_turn');const left=E.EVERY-(S.nm[who]-S.lc[who]);return left>0?f('ri_wait',{n:left}):t('ri_ready')}
function askBox(title,items,msg){$('prt').textContent=title;$('prm').textContent=msg||'';const box=$('prob');box.innerHTML='';for(const it of items){const b=document.createElement('button');b.className=it.cls;if(it.html)b.innerHTML=it.html;else b.textContent=it.txt;b.onclick=()=>{$('pro').classList.add('hid');it.fn()};box.appendChild(b)}$('pro').classList.remove('hid')}
function askPromo(col,cb){askBox(t('prot'),[...'QRBN'].map(l=>({cls:'pb '+(col==='w'?'w':'k'),html:psvg(col+l),fn:()=>cb(l)})))}
function newLocal(){S=E.newGame(cfg);prev=null;lm=null;sel=null;mv=[];lastSp=false;introFlag=true;draw();setTimeout(()=>{introFlag=false},60)}
function click(r,c){
 if(S.over)return;const on=mode==='online',bot=$('bot').checked;
 if(on&&(!opp||!ws||ws.readyState!==1))return;
 if(S.turn!==(on?me:(bot?'w':S.turn)))return;
 const opts=sel?mv.filter(m=>m[0]===r&&m[1]===c):[];
 if(opts.length){
  const m0=[sel[0],sel[1],r,c],pp=S.bd[sel[0]][sel[1]];sel=null;mv=[];
  const go=l=>{const mm=l?[...m0,l]:m0;if(on){send({t:'move',m:mm});draw()}else{E.play(S,...mm);draw();if(bot&&!S.over)setTimeout(botMove,350)}};
  const fin=kind=>{if(kind){go(kind);return}if(pp&&pp.t==='P'&&r===(pp.c==='w'?0:7)&&S.cfg.promoteTo==='choice')askPromo(pp.c,go);else go()};
  draw();
  if(opts.length>1)askBox(t('chs'),opts.map(o=>({cls:'btn',txt:t(({'':pp&&S.bd[r][c]?'mvto':'mvgo',s:'shoot',w:'swapt',f:'freezet',c:'convt',r:'revt'})[o[2]||'']),fn:()=>fin(o[2])})));
  else fin(opts[0][2]);
  return}
 const p=S.bd[r][c];if(p&&p.c===S.turn){sel=[r,c];mv=E.movesOf(S,r,c)}else{sel=null;mv=[]}draw()}
function botMove(){
 if(S.over||S.turn!=='b'||mode!=='local')return;
 const best=brain(S,'b',{budget:260,noise:.15});
 if(best){E.play(S,...best);draw()}}

const send=o=>{if(ws&&ws.readyState===1)ws.send(JSON.stringify(o))};
const save=()=>{try{sessionStorage.setItem('chessRoom',JSON.stringify(room))}catch(e){}};
function leave(){const w=ws;ws=null;if(w)try{w.close()}catch(e){}room=null;mode='local';me='w';opp=true;rq=false;dq=dm=false;try{sessionStorage.removeItem('chessRoom')}catch(e){}$('sum').textContent=sum0;newLocal();show('menu')}
function connect(first){
 mode='online';let w;try{w=new WebSocket(SERVER)}catch(e){$('err').textContent=t('off');return}
 ws=w;
 w.onopen=()=>{tries=0;$('err').textContent='';send(first)};
 w.onmessage=e=>{let m;try{m=JSON.parse(e.data)}catch(x){return}
  if(m.t==='room'){room={code:m.code,token:m.token};me=m.color;save();show('game')}
  else if(m.t==='state'){S=m.s;opp=m.opp;rq=m.rq;dq=m.dq;dm=m.dm;if(typeof m.sum==='string')$('sum').textContent=m.sum;sel=null;mv=[]}
  else if(m.t==='err'){$('err').textContent=t(m.c);if(m.c==='nf'||m.c==='full')leave();return}
  draw()};
 w.onclose=()=>{if(ws!==w||mode!=='online')return;draw();const nx=room?{t:'resume',code:room.code,token:room.token}:first;if(tries++<20)setTimeout(()=>{if(ws===w)connect(nx)},Math.min(1500+tries*500,4000))};
 draw()}
function applyLang(){document.documentElement.lang=lang;document.title=t('title');document.querySelectorAll('[data-i18n]').forEach(e=>e.textContent=t(e.dataset.i18n));$('nlt').placeholder=t('ph');{const hp=$('hp');hp.innerHTML='';for(const line of t('help').split('\n')){const b=document.createElement('button');b.className='chip2';b.textContent=line;b.onclick=()=>{$('nlt').value=line;grow();$('nlt').focus()};hp.appendChild(b)}}$('cd').placeholder=t('codeph');draw();try{demoCap()}catch(e){}}
const RESET_RE=/(?:отмен\p{L}*|сброс\p{L}*|обнул\p{L}*|убер\p{L}*|убра\p{L}*)\s+(?:вс[её]\s+)?(?:правил\p{L}*|изменени\p{L}*)|(?:вс[её]\s+)?правила\s+(?:отмен\p{L}*|сброш\p{L}*|убран\p{L}*|обнулен\p{L}*)|(?:обычн|классическ|стандартн)\p{L}*\s+(?:шахмат|правил)\p{L}*|reset\s+(?:all\s+)?(?:the\s+)?rules|cancel\s+all\s+rules|(?:back\s+to\s+)?classic(?:al)?\s+(?:chess|rules)|standard\s+(?:chess|rules)|normal\s+chess/iu;

// ===== what the rule REALLY does: plain-language description, warnings and a preview board =====
const DS={
 ru:{dirs:{orth:'по прямым',diag:'по диагонали',all:'во все стороны'},slide:(s,m)=>'скользит '+DS.ru.dirs[s]+(m&&m<8?', до '+m+' кл.':''),slideV:m=>'скользит по особым направлениям'+(m&&m<8?', до '+m+' кл.':''),
  kn:'прыгает как конь',any:(l,r)=>'телепортируется на пустую клетку'+(r&&r<7?' в пределах '+r+' кл.':'')+(l?' ('+l+' р. за партию)':''),jv:l=>'прыгает по особым векторам'+(l?' ('+l+' р.)':''),leap:'перепрыгивает через фигуры',stay:'не может ходить',
  shoot:s=>'стреляет '+DS.ru.dirs[s.dirs]+' на '+s.range+' кл.'+(s.limit?' ('+s.limit+' р.)':''),swap:'меняется местами с союзником',blast:'взрывает соседей при взятии',
  freeze:f=>'замораживает врага на '+f.turns+' ход. (дальность '+f.range+')'+(f.limit?', '+f.limit+' р.':''),conv:f=>'обращает врага в союзника (дальность '+f.range+')'+(f.limit?', '+f.limit+' р.':''),
  rev:f=>'воскрешает последнюю погибшую фигуру рядом'+(f.limit?' ('+f.limit+' р.)':''),arm:n=>'броня: выдерживает '+n+' взят.',extra:'после взятия ходит ещё раз',noc:a=>'не бьёт: '+a,pawnStd:'ходит как обычная пешка',
  chkOn:'шах и мат включены',chkOff:'шаха и мата нет: выигрывает тот, кто съел короля',win:a=>'побеждает тот, кто съест: '+a,promo:a=>'пешка превращается в: '+a,promoC:'превращение пешки: на выбор',cstOn:'рокировка разрешена',cstOff:'рокировки нет',
  dblOn:'пешка может ходить на 2 клетки первым ходом',dblOff:'двойного хода пешки нет',prg:n=>'пешка ходит вперёд до '+n+' кл.',back:'пешка может ходить назад',capD:'пешка бьёт по диагонали',capS:'пешка бьёт только прямо',capB:'пешка бьёт и прямо, и по диагонали',
  imm:a=>'неуязвимы: '+a,noimm:'неуязвимых фигур нет',shield:(a,b)=>a+' под защитой соседней '+b,noshield:'защиты соседей нет',
  w_stuck:a=>'⚠ '+a+' больше не сможет ходить',w_nocap:'⚠ пешка больше не сможет бить',w_nostart:'⚠ у белых не будет ни одного хода: партия закончится сразу',w_end:'⚠ после этого правила партия закончится сразу'},
 en:{dirs:{orth:'straight',diag:'diagonally',all:'in all directions'},slide:(s,m)=>'slides '+DS.en.dirs[s]+(m&&m<8?', up to '+m+' squares':''),slideV:m=>'slides in special directions'+(m&&m<8?', up to '+m+' squares':''),
  kn:'jumps like a knight',any:(l,r)=>'teleports to an empty square'+(r&&r<7?' within '+r+' squares':'')+(l?' ('+l+' per game)':''),jv:l=>'jumps by special vectors'+(l?' ('+l+' per game)':''),leap:'jumps over pieces',stay:'cannot move',
  shoot:s=>'shoots '+DS.en.dirs[s.dirs]+' up to '+s.range+' squares'+(s.limit?' ('+s.limit+' times)':''),swap:'swaps places with an ally',blast:'blows up neighbours when capturing',
  freeze:f=>'freezes an enemy for '+f.turns+' turn(s) (range '+f.range+')'+(f.limit?', '+f.limit+' times':''),conv:f=>'turns an enemy into an ally (range '+f.range+')'+(f.limit?', '+f.limit+' times':''),
  rev:f=>'revives the last fallen piece next to it'+(f.limit?' ('+f.limit+' times)':''),arm:n=>'armor: survives '+n+' capture(s)',extra:'moves again after a capture',noc:a=>'cannot capture: '+a,pawnStd:'moves like a normal pawn',
  chkOn:'check and checkmate are on',chkOff:'no check or checkmate: whoever captures the king wins',win:a=>'whoever captures this wins: '+a,promo:a=>'a pawn promotes to: '+a,promoC:'pawn promotion: your choice',cstOn:'castling is allowed',cstOff:'no castling',
  dblOn:'a pawn may move 2 squares on its first move',dblOff:'no two-square pawn move',prg:n=>'a pawn moves forward up to '+n+' squares',back:'a pawn may move backward',capD:'a pawn captures diagonally',capS:'a pawn captures straight ahead only',capB:'a pawn captures straight and diagonally',
  imm:a=>'invulnerable: '+a,noimm:'nothing is invulnerable',shield:(a,b)=>a+' is protected by a neighbouring '+b,noshield:'no neighbour protection',
  w_stuck:a=>'⚠ the '+a+' will no longer be able to move',w_nocap:'⚠ the pawn will no longer be able to capture',w_nostart:'⚠ White will have no moves at all: the game ends at once',w_end:'⚠ the game will end immediately after this rule'}};
const pnames=a=>a.map(x=>NM[x]).join(', ');
const FEAT={ru:{move:'ход',leap:'перепрыгивание',blinkc:'телепорт',shoot:'стрельба',swap:'обмен',blast:'взрыв',freeze:'заморозка',convert:'обращение',revive:'воскрешение',armor:'броня',extra:'доп. ход',nocheck:'отмена шаха',pawnRange:'дальность пешки',pawnBack:'пешка назад',pawnCapture:'взятие пешкой',immune:'неуязвимость',shield:'защита соседом'},
 en:{move:'movement',leap:'jumping over pieces',blinkc:'teleport',shoot:'shooting',swap:'swap',blast:'explosion',freeze:'freeze',convert:'conversion',revive:'revival',armor:'armor',extra:'extra move',nocheck:'no check',pawnRange:'pawn range',pawnBack:'pawn backward',pawnCapture:'pawn capture',immune:'invulnerability',shield:'neighbour protection'}};
function noteText(n){const ru=lang==='ru',x=n.x&&'KQRBNP'.includes(n.x)?NM[n.x]:'',v=n.v;
 switch(n.k){case 'win':return ru?'победа всегда за королём':'the king always decides the win';
  case 'immuneK':return ru?'король не может быть неуязвимым':'the king cannot be invulnerable';
  case 'pawnRange':return ru?'пешка: дальность урезана до '+v+' кл.':'pawn range cut to '+v;
  case 'shoot':return ru?x+': стрельба урезана до '+v+' кл.':x+': shooting range cut to '+v;
  case 'blink':return ru?x+': телепорт только на '+v+' кл.':x+': teleport only '+v+' squares';
  case 'freeze':return ru?x+': заморозка 1 ход, дальность до 2':x+': freeze 1 turn, range up to 2';
  case 'convert':return ru?x+': обращать можно только пешки, коней и слонов, дальность 1':x+': only pawns, knights and bishops can be converted, range 1';
  case 'armor':return ru?x+': броня урезана до '+v:x+': armor cut to '+v;
  case 'mobility':return ru?x+': ход урезан до силы ладьи':x+': movement cut to rook strength';
  case 'trim':return (ru?'убрано ради баланса: ':'removed for balance: ')+(FEAT[lang][v]||v)+(x?' ('+x+')':'')}
 return ''}
const PROB={ru:{exposed:'⛔ нельзя: правило сразу создало бы шах королю соперника',trapped:'⛔ нельзя: у тебя не осталось бы ни одного хода'},en:{exposed:'⛔ not allowed: the rule would put the enemy king in check at once',trapped:'⛔ not allowed: you would be left without any move'}};
const dirSet=v=>JSON.stringify(v.map(q=>q.join(',')).sort());
function dirName(sl){if(typeof sl==='string')return sl;if(!Array.isArray(sl)||!sl.length)return null;const k=dirSet(sl);for(const n of['orth','diag','all'])if(dirSet(E.vec(n))===k)return n;return null}
function pieceLine(X,d){const D=DS[lang],P=[];
 const std=X==='P'&&!d.slide&&!d.jumps;
 if(std)P.push(D.pawnStd);
 else{const sl=d.slide,jm=d.jumps,has=(typeof sl==='string')||(Array.isArray(sl)&&sl.length);
  const dn=dirName(sl);if(dn)P.push(D.slide(dn,d.max));else if(Array.isArray(sl)&&sl.length)P.push(D.slideV(d.max));
  const jn=Array.isArray(jm)&&jm.length&&dirSet(jm)===dirSet(E.vec('knight'))?'knight':jm;
  if(jn==='knight')P.push(D.kn);else if(jm==='any')P.push(D.any(d.jumpLimit,d.jumpRange));else if(Array.isArray(jm)&&jm.length)P.push(D.jv(d.jumpLimit));
  if(d.leap&&has)P.push(D.leap);
  if(!has&&!jm)P.push(D.stay)}
 if(d.shoot)P.push(D.shoot(d.shoot));if(d.swap)P.push(D.swap);if(d.blast)P.push(D.blast);
 if(d.freeze)P.push(D.freeze(d.freeze));if(d.convert)P.push(D.conv(d.convert));if(d.revive)P.push(D.rev(d.revive));
 if(d.armor)P.push(D.arm(d.armor));if(d.extra)P.push(D.extra);if((d.noCapture||[]).length)P.push(D.noc(pnames(d.noCapture)));
 return NM[X]+': '+P.join('; ')}
// returns {lines, changed}: what differs between the current rules and the new ones, described from the CONFIG itself
function describeRules(a,b){const D=DS[lang],lines=[],changed=[];a=E.sanitize(a);b=E.sanitize(b);
 const J=x=>JSON.stringify(x);
 const nz=x=>x&&Object.keys(x).length?x:undefined;
 for(const X of 'KQRBNP')if(J(nz(a.pieces[X]))!==J(nz(b.pieces[X]))&&(b.pieces[X]||X==='P')){lines.push(pieceLine(X,b.pieces[X]||{}));changed.push(X)}
 if(a.check!==b.check)lines.push(b.check?D.chkOn:D.chkOff);
 if(a.winPiece!==b.winPiece)lines.push(D.win(NM[b.winPiece]));
 if(a.promoteTo!==b.promoteTo)lines.push(b.promoteTo==='choice'?D.promoC:D.promo(NM[b.promoteTo]));
 if(a.castling!==b.castling)lines.push(b.castling?D.cstOn:D.cstOff);
 if(a.pawnDouble!==b.pawnDouble)lines.push(b.pawnDouble?D.dblOn:D.dblOff);
 if(a.pawnRange!==b.pawnRange){lines.push(D.prg(b.pawnRange));if(!changed.includes('P'))changed.push('P')}
 if(a.pawnBack!==b.pawnBack){lines.push(b.pawnBack?D.back:DS[lang].pawnStd);if(!changed.includes('P'))changed.push('P')}
 if(a.pawnCapture!==b.pawnCapture){lines.push(b.pawnCapture==='straight'?D.capS:b.pawnCapture==='both'?D.capB:D.capD);if(!changed.includes('P'))changed.push('P')}
 if(J(a.immune)!==J(b.immune))lines.push(b.immune.length?D.imm(pnames(b.immune)):D.noimm);
 if(J(a.shield)!==J(b.shield))lines.push(Object.keys(b.shield).length?Object.entries(b.shield).map(([x,y])=>D.shield(NM[x],NM[y])).join('; '):D.noshield);
 return {lines,changed}}
// a sandbox: one white piece (and optional black "targets") on an otherwise empty board
function sandbox(cfg,X,fill){const T=E.newGame(Object.assign(JSON.parse(JSON.stringify(cfg)),{check:false}));T.over=false;T.bd=Array.from({length:8},()=>Array(8).fill(null));T.cap={w:['P'],b:[]};T.rep={};
 const at=X==='P'?[6,4]:[4,3];if(fill)for(let r=0;r<8;r++)for(let c=0;c<8;c++)T.bd[r][c]={t:'P',c:'b'};T.bd[at[0]][at[1]]={t:X,c:'w'};return {T,at}}
function probeMoves(cfg,X){const {T,at}=sandbox(cfg,X);return E.movesOf(T,at[0],at[1]).length}
function warnRules(a,b,S,who){const D=DS[lang],W=[];a=E.sanitize(a);b=E.sanitize(b);
 for(const X of 'KQRBNP'){if(probeMoves(b,X)===0&&probeMoves(a,X)>0)W.push(D.w_stuck(NM[X]))}
 const canCap=cf=>{const {T,at}=sandbox(cf,'P');T.bd[5][3]={t:'N',c:'b'};T.bd[5][5]={t:'N',c:'b'};return E.movesOf(T,at[0],at[1]).some(m=>m[0]===5&&(m[1]===3||m[1]===5))};
 if(!canCap(b)&&canCap(a)&&!W.includes(D.w_stuck(NM.P)))W.push(D.w_nocap);
 return W}
function miniBoard(cfg,X){const A=sandbox(cfg,X),B=sandbox(cfg,X,true),cell={},at=A.at;
 for(const m of E.movesOf(A.T,at[0],at[1])){if(m[2]==='w')continue;const k=m[0]+','+m[1];cell[k]=m[2]==='r'?'rv':'mv'}
 for(const m of E.movesOf(B.T,at[0],at[1])){const k=m[0]+','+m[1];if(['s','f','c'].includes(m[2]))cell[k]='ab';else if(X==='P'&&!m[2]&&m[1]!==at[1])cell[k]='ab'}
 let h='';for(let r=0;r<8;r++)for(let c=0;c<8;c++){const k=r+','+c,isP=r===at[0]&&c===at[1];h+='<div class="dc '+((r+c)%2?'d':'l')+(cell[k]?' '+cell[k]:'')+'">'+(isP?'<span class="pc">'+psvg('w'+X)+'</span>':'')+'</div>'}
 return '<div class="pvm"><div class="dmb">'+h+'</div><div class="pvn">'+NM[X]+'</div></div>'}
function previewRules(a,b,lines,bad,warns,changed,commit,x){x=x||{notes:[],probs:[]};
 $('pvt').textContent=t('pvt');$('pvy').textContent=t('pvy');$('pvn').textContent=t('pvn');
 $('pvl').innerHTML=lines.map(l=>'<li>'+l.replace(/[<>&]/g,'')+'</li>').join('');
 const nt=x.notes.map(noteText).filter(Boolean);
 $('pvx').innerHTML=(nt.length?'<div class="pvbal">'+nt.map(l=>'<div>⚖ '+l.replace(/[<>&]/g,'')+'</div>').join('')+'</div>':'')+'<div class="pvk">'+f('pvcost',{c:x.cost==null?'?':x.cost,b:x.budget||4})+' · '+t('pvdur')+'</div>';
 $('pvw').innerHTML=x.probs.map(p=>'<div>'+PROB[lang][p]+'</div>').concat(warns.map(l=>'<div>'+l.replace(/[<>&]/g,'')+'</div>')).join('');
 const bs=changed.slice(0,3).map(X=>miniBoard(b,X)).join('');
 $('pvb').innerHTML=bs?'<div class="pvk">'+t('pvnote')+'</div><div class="pvr">'+bs+'</div><div class="pvk">'+t('pvlg')+'</div>':'';
 const close=()=>$('pv').classList.add('hid');
 $('pvy').disabled=x.probs.length>0;$('pvy').onclick=()=>{close();commit()};$('pvn').onclick=close;$('pv').classList.remove('hid')}
$('nlb').onclick=async()=>{
 const raw=$('nlt').value.trim();if(!raw)return;
 const who=mode==='online'?me:($('bot').checked?'w':S.turn);
 if(!E.canChange(S,who)){$('err').textContent=rinfo(who);return}
 const low=raw.toLowerCase(),rst=RESET_RE.test(low);
 const txt=rst?low.replace(new RegExp(RESET_RE.source,'giu'),' ').replace(/[\s.,;!]+/g,' ').trim():raw;
 const baseCfg=rst?JSON.parse(JSON.stringify(STD)):S.cfg;
 const bt=$('nlb'),lab=bt.textContent;bt.disabled=true;bt.textContent='…';$('err').textContent='';
 let c,ok=[],bad=[],ai=false,aiErr='';
 if(rst&&txt.length<3){c=JSON.parse(JSON.stringify(STD))}
 else{
  try{const r=await fetch(SERVER.replace(/^ws/,'http').replace(/\/+$/,'')+'/parse',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:txt,lang,base:baseCfg}),signal:AbortSignal.timeout?AbortSignal.timeout(9000):undefined});
   const j=await r.json().catch(()=>({}));if(!r.ok||!j.config||!j.config.pieces){aiErr=j.err||(r.ok?(lang==='ru'?'на сервере старая версия без /parse, обнови server.js':'the server is outdated (no /parse), update server.js'):'HTTP '+r.status);throw 0}
   c=j.config;bad=j.unsupported||[];ai=true;
   if(j.changed===false){const p=parseRules(txt,baseCfg);if(p.ok.length){c=p.c;ok=p.ok;bad=p.bad;ai=false}else{ok=[];bad=[j.summary,...bad].filter(Boolean)}}else ok=[j.summary||t('okh')]}
  catch(e){if(!aiErr)aiErr='network/timeout';const p=parseRules(txt,baseCfg);c=p.c;ok=p.ok;bad=p.bad}
 }
 if(rst&&!c)c=JSON.parse(JSON.stringify(STD));
 bt.disabled=false;bt.textContent=lab;if(aiErr)$('err').textContent=t('aifail')+aiErr;
 // the description comes from the CONFIG itself (the engine's truth), not from the language model's own words
 const cc0=c?E.sanitize(c):null,base0=S.spell?S.spell.base:S.cfg,bal=cc0?E.balance(base0,cc0):null,cc=bal?bal.cfg:null;
 // the description comes from the CONFIG itself (the engine's truth), after the engine has balanced it
 const det=cc?describeRules(base0,cc):{lines:[],changed:[]};
 if(!cc||!det.lines.length){$('sum').textContent=t('none')+(bal&&bal.notes.length?'\n⚖ '+bal.notes.map(noteText).filter(Boolean).join('; '):'')+(bad.length?'\n'+t('bad')+' '+bad.join(' | '):'');return}
 if(!E.canChange(S,who)){draw();return}
 const lines=det.lines,warns=warnRules(base0,cc,S,who),probs=E.validateSpell(S,cc,who);
 const commit=()=>{
  if(!E.canChange(S,who)){draw();return}
  sumTxt=(ai?'✨ ':'')+cn(who)+': '+t('okh')+'\n• '+lines.join('\n• ')+'\n⏱ '+t('spelldur');
  const shown=sumTxt+(bad.length?'\n\n'+t('skip')+'\n• '+bad.join('\n• '):'');
  $('sum').textContent=shown;$('nlt').value='';
  if(mode==='online')send({t:'rules',cfg:cc,sum:sumTxt});
  else{const r=E.setRules(S,cc,who);if(!r.ok){$('err').textContent=t('spellbad');return}draw()}};
 previewRules(base0,cc,lines,bad,warns,det.changed,commit,{notes:bal.notes,cost:bal.cost,budget:bal.budget,probs})};
$('rs').onclick=()=>{const go=()=>{if(mode==='online')send({t:'rematch'});else{$('sum').textContent=sum0;newLocal()}};if(S.over||S.nm.w+S.nm.b===0)go();else confirmAct('rs',mode==='online'?'cf_rs_mo':'cf_rs_m',go)};
function zoomIn(fn){
 const m=$('s-menu');if(m.classList.contains('zoom'))return;
 if(matchMedia('(prefers-reduced-motion:reduce)').matches||m.classList.contains('hid')){fn();return}
 const b=$('dmb').getBoundingClientRect(),mr=m.getBoundingClientRect();
 m.style.transformOrigin=(b.left+b.width/2-mr.left)+'px '+(b.top+b.height/2-mr.top)+'px';
 m.style.setProperty('--zs',Math.min(4.5,Math.max(2.2,innerWidth/b.width*1.6)));
 document.documentElement.classList.add('zooming');demoStop();m.classList.add('zoom');
 setTimeout(()=>{fn();m.classList.remove('zoom');m.style.transformOrigin='';document.documentElement.classList.remove('zooming')},620)}
$('bLoc').onclick=()=>{if(mode==='online'){send({t:'leave'});leave()}zoomIn(()=>{cfg=JSON.parse(JSON.stringify(STD));sum0='';$('sum').textContent='';newLocal();show('game')})};
function confirmAct(k,msgKey,fn){askBox(t('cf_'+k),[{cls:'btn',txt:t('pvn'),fn:()=>{}},{cls:'btn dng',txt:t('cf_'+k+'_y'),fn}],t(msgKey))}
$('rg').onclick=()=>{if(S.over||S.nm.w+S.nm.b===0)return;confirmAct('rg','cf_rg_m',()=>{if(S.over)return;if(mode==='online')send({t:'resign'});else{const who=$('bot').checked?'w':S.turn;E.finish(S,who==='w'?'b':'w','resign');draw()}})};
$('dw').onclick=()=>{if(S.over||S.nm.w+S.nm.b===0)return;confirmAct('dw',mode==='online'?'cf_dw_mo':'cf_dw_m',()=>{if(S.over)return;if(mode==='online')send({t:'draw'});else{E.finish(S,null,'agreed');draw()}})};
$('bBack').onclick=()=>{if(mode==='online'){send({t:'leave'});leave()}show('menu')};
$('rc').onclick=()=>{try{navigator.clipboard.writeText(room.code);$('rc').textContent='✓';setTimeout(draw,900)}catch(e){}};
$('bCr').onclick=()=>{if(mode==='online')leave();$('err').textContent='';connect({t:'create',cfg,sum:sum0})};
$('bJn').onclick=()=>{const k=$('cd').value.trim().toUpperCase();if(k.length<4){$('err').textContent=t('code4');return}if(mode==='online')leave();$('err').textContent='';connect({t:'join',code:k})};
$('nlt').addEventListener('input',grow);$('nlt').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('nlb').click()}});
$('b').oncontextmenu=e=>e.preventDefault();
function show(n){$('s-menu').classList.toggle('hid',n!=='menu');$('s-game').classList.toggle('hid',n!=='game');draw();const el=$(n==='game'?'s-game':'s-menu');el.classList.remove('enter');void el.offsetWidth;el.classList.add('enter');if(n==='menu')demoStart();else demoStop()}
function setTheme(th){document.documentElement.dataset.theme=th;$('th').textContent=th==='dark'?'☀':'☾';try{localStorage.setItem('chessTheme',th)}catch(e){}deco()}
function deco(){const col=document.documentElement.dataset.theme==='dark'?'w':'b';$('deco').innerHTML=['R','N','B','Q','K','B','N','R'].map(x=>psvg(col+x)).join('')}
function grow(){const e=$('nlt');e.style.height='auto';const h=Math.max(44,Math.min(e.scrollHeight,132));e.style.height=h+'px';e.style.overflowY=e.scrollHeight>132?'auto':'hidden'}
$('th').onclick=()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');
function hasSavedLang(){try{return !!localStorage.getItem('chessLang')}catch(e){return false}}
function renderLg(){$('lg').innerHTML='<span'+(lang==='ru'?' class="on"':'')+'>RU</span><i>/</i><span'+(lang==='en'?' class="on"':'')+'>EN</span>'}
function setLang(l){lang=l;try{localStorage.setItem('chessLang',l)}catch(e){}applyLang();renderLg()}
$('lg').onclick=()=>setLang(lang==='ru'?'en':'ru');

// ===== bot brain: 2 plies (my move, then the opponent's best reply); material + position =====
function fclone(S){const T={...S};T.bd=S.bd.map(r=>r.map(p=>p?{...p}:null));T.nm={...S.nm};T.lc={...S.lc};T.jc={...S.jc};T.spell=S.spell?{...S.spell}:null;T.cap={w:[...((S.cap||{}).w||[])],b:[...((S.cap||{}).b||[])]};T.rep={};return T}
function evalB(T,me){let s=0;for(let r=0;r<8;r++)for(let c=0;c<8;c++){const p=T.bd[r][c];if(!p)continue;let v=V[p.t]||0;
  if(p.t==='P')v+=(p.c==='w'?6-r:r-1)*.06;
  else if(p.t==='N'||p.t==='B')v+=(7-Math.abs(2*r-7)-Math.abs(2*c-7))/14*.3;
  else if(p.t==='Q')v+=(7-Math.abs(2*r-7)-Math.abs(2*c-7))/14*.1;
  s+=p.c===me?v:-v}
 return s}
function brain(S,me,o){o=o||{};const t0=performance.now(),budget=o.budget||200,noise=o.noise==null?.2:o.noise,opp=me==='w'?'b':'w',moves=[];
 for(let r=0;r<8;r++)for(let c=0;c<8;c++){const p=S.bd[r][c];if(p&&p.c===me)for(const m of E.movesOf(S,r,c))moves.push([r,c,m[0],m[1],m[2]])}
 if(!moves.length)return null;
 const capv=m=>{const q=S.bd[m[2]][m[3]];return q&&m[4]!=='w'?V[q.t]:0};moves.sort((a,b)=>capv(b)-capv(a));
 let best=null,bs=-1e9;
 for(const m of moves){
  if(best&&performance.now()-t0>budget)break;
  const T=fclone(S);E.play(T,m[0],m[1],m[2],m[3],m[4]);let sc;
  if(T.over){const e=evalB(T,me);sc=T.winner===me?1000:T.winner?-1000:(e>1.5?-4:e<-1.5?3:0)}
  else{sc=evalB(T,me);
   outer:for(let r=0;r<8;r++)for(let c=0;c<8;c++){const q=T.bd[r][c];if(!q||q.c!==opp)continue;
    for(const n of E.movesOf(T,r,c)){const U=fclone(T);E.play(U,r,c,n[0],n[1],n[2]);
     const v=U.over?(U.winner===opp?-1000:U.winner?1000:0):evalB(U,me);
     if(v<sc)sc=v;if(sc<bs-noise)break outer}}}
  sc+=Math.random()*noise;if(sc>bs){bs=sc;best=m}}
 return best}

// ===== start screen: two bots play; white types a new rule, then they keep playing =====
const DEMO_RULES=[
 {ru:'слон ходит как конь',en:'bishop moves like a knight',p:c=>{c.pieces.B={...c.pieces.B,slide:[],jumps:'knight'}}},
 {ru:'ферзь перепрыгивает фигуры',en:'queen jumps over pieces',p:c=>{c.pieces.Q={...c.pieces.Q,leap:true}}},
 {ru:'конь телепортируется',en:'knight can teleport',p:c=>{c.pieces.N={...c.pieces.N,jumps:'any',jumpLimit:2}}},
 {ru:'у пешек пистолеты',en:'pawns have guns',p:c=>{c.pieces.P={...(c.pieces.P||{}),shoot:{dirs:'all',range:3,limit:2}}}},
 {ru:'слон взрывается при взятии',en:'bishop explodes on capture',p:c=>{c.pieces.B={...c.pieces.B,blast:true}}},
 {ru:'ладья ходит как слон',en:'rook also moves like a bishop',p:c=>{c.pieces.R={...c.pieces.R,slide:'all'}}},
 {ru:'конь замораживает врагов',en:'knight freezes enemies',p:c=>{c.pieces.N={...c.pieces.N,freeze:{turns:2,range:1}}}},
 {ru:'слон обращает врагов в союзников',en:'bishop turns enemies into allies',p:c=>{c.pieces.B={...c.pieces.B,convert:{range:1,limit:2}}}},
 {ru:'ферзь воскрешает павших',en:'queen revives fallen pieces',p:c=>{c.pieces.Q={...c.pieces.Q,revive:{limit:1}}}},
 {ru:'пешки в броне',en:'pawns wear armor',p:c=>{c.pieces.P={...(c.pieces.P||{}),armor:1}}},
 {ru:'конь ходит ещё раз после взятия',en:'knight moves again after a capture',p:c=>{c.pieces.N={...c.pieces.N,extra:true}}}
];
let D=null,dT=0,dTy=0,dTyT=0,dTyping=false,dQ=[],dRule=null,dPrev=null,dLm={},dIntro=false,dNext=3,dMoves=0;
function demoNew(){D=E.newGame(JSON.parse(JSON.stringify(STD)));dQ=DEMO_RULES.map((_,i)=>i).sort(()=>Math.random()-.5).slice(0,6);dRule=null;dPrev=null;dLm={};dIntro=true;dNext=3;dMoves=0;demoCap()}
function demoCap(){const el=$('dmc');if(!el)return;el.innerHTML='<span class="dml">'+t('dmh')+'</span><span id="dmp" class="dmp'+(dRule?' on':'')+'">'+(dRule?'✎ '+cn('w').replace(/^./,x=>x.toUpperCase())+': '+dRule[lang]:t('dms'))+'</span>'}
function badges(sp,p,G){if(p.fz>0){sp.classList.add('fz');sp.dataset.fz=p.fz}const a=E.armorOf(G,p);if(a>0){sp.classList.add('ar');sp.dataset.ar='+'+a}}
function demoDraw(){
 const B=$('dmb'),cur=D.bd.map(r=>r.map(p=>p?p.c+p.t:'')),an=dPrev?diffMoves(dPrev,cur):null,old=dPrev,pend=[];
 const chg=dPrev&&cur.some((row,i)=>row.some((v,j)=>v!==dPrev[i][j]));
 if(an){dLm={};for(const k in an.to){dLm[k]=1;dLm[an.to[k].fr+','+an.to[k].fc]=1}for(const k in an.gone)dLm[k]=1}else if(chg)dLm={};
 dPrev=cur;B.innerHTML='';
 for(let r=0;r<8;r++)for(let c=0;c<8;c++){
  const d=document.createElement('div');d.className='dc '+((r+c)%2?'d':'l')+(dLm[r+','+c]?' lm':'');
  const k=cur[r][c];
  if(k){const sp=document.createElement('span');sp.className='pc';sp.innerHTML=psvg(k);d.appendChild(sp);badges(sp,D.bd[r][c],D);
   if(dIntro){sp.classList.add('pi');sp.style.animationDelay=(r*45+c*25)+'ms'}
   const a=an&&an.to[r+','+c];if(a){sp.style.transition='none';sp.style.transform='translate('+(a.fc-c)*100+'%,'+(a.fr-r)*100+'%)';sp.style.zIndex=5;pend.push(sp)}}
  if(an&&an.gone[r+','+c]){d.classList.add('fl');const ok=old&&old[r][c];if(ok){const g=document.createElement('span');g.className='gh';g.innerHTML=psvg(ok);d.appendChild(g)}}
  B.appendChild(d)}
 dIntro=false;
 if(pend.length){void B.offsetWidth;for(const sp of pend){sp.style.transition='transform .3s cubic-bezier(.25,.8,.25,1)';sp.style.transform='translate(0,0)'}}}
// the white bot "types" the rule letter by letter, then it is applied
function demoType(r,done){const el=$('dmp');if(!el){done();return}const txt=r[lang];let i=0;
 el.className='dmp typing';el.textContent='✎ ';
 dTy=setInterval(()=>{i++;el.textContent='✎ '+txt.slice(0,i);if(i>=txt.length){clearInterval(dTy);dTy=0;dTyT=setTimeout(()=>{dTyT=0;done()},550)}},50)}
function demoStep(){
 if(!D||D.over||dMoves>=140){demoNew();demoDraw();return 2200}
 if(D.turn==='w'&&dQ.length&&D.nm.w>=dNext&&E.canChange(D,'w')){
  const r=DEMO_RULES[dQ[0]];dTyping=true;
  demoType(r,()=>{dTyping=false;if(!D)return;dQ.shift();const c=JSON.parse(JSON.stringify(D.cfg));r.p(c);
   try{const rr=E.setRules(D,E.sanitize(c),'w');if(rr.ok){dRule=r;dNext=D.nm.w+4}}catch(e){}demoCap()});
  return r[lang].length*50+550+1300}
 const m=brain(D,D.turn,{budget:90,noise:.35});
 if(!m){D.over=true;return 2500}
 E.play(D,m[0],m[1],m[2],m[3],m[4]);dMoves++;demoDraw();if(dRule&&!D.spell){dRule=null;demoCap()}
 return D.over?3200:850+Math.random()*350}
function demoOn(){return !$('s-menu').classList.contains('hid')&&!document.hidden}
function demoTick(){dT=0;if(!demoOn()||dTyping)return;let d=1000;try{d=demoStep()}catch(e){D=null}dT=setTimeout(demoTick,d)}
function demoStart(){if(dT||dTyping||!demoOn())return;if(!D){demoNew();demoDraw()}else demoCap();dT=setTimeout(demoTick,600)}
function demoStop(){if(dT){clearTimeout(dT);dT=0}if(dTy){clearInterval(dTy);dTy=0}if(dTyT){clearTimeout(dTyT);dTyT=0}dTyping=false}
document.addEventListener('visibilitychange',()=>{if(document.hidden)demoStop();else demoStart()});
setTheme(document.documentElement.dataset.theme||'light');
applyLang();renderLg();demoStart();
try{fetch(SERVER.replace(/^ws/,'http').replace(/\/+$/,'')+'/',{mode:'no-cors'}).catch(()=>{})}catch(e){}
try{const sv=JSON.parse(sessionStorage.getItem('chessRoom')||'null');if(sv&&sv.code){room=sv;connect({t:'resume',code:sv.code,token:sv.token})}}catch(e){}

/* ===== Yandex Games integration ===== */
let YA=null,gpOn=false,adPending=false,adBusy=false,ya_player=null;
function gpSync(){if(!YA)return;let on=false;try{on=!$('s-game').classList.contains('hid')&&!S.over&&!adBusy&&!document.hidden}catch(e){}
 if(on===gpOn)return;gpOn=on;try{const g=YA.features.GameplayAPI;if(g)on?g.start():g.stop()}catch(e){}}
let lastOver=false;
{const _draw=draw;draw=function(){_draw.apply(this,arguments);if(S.over&&!lastOver)adPending=true;lastOver=!!S.over;gpSync()}}
document.addEventListener('visibilitychange',gpSync);
function yaAd(){if(!YA||!adPending||adBusy)return;adPending=false;adBusy=true;gpSync();
 const done=()=>{adBusy=false;gpSync()};
 try{YA.adv.showFullscreenAdv({callbacks:{onClose:done,onError:done,onOffline:done}})}catch(e){done()}}
{const _nl=newLocal;newLocal=function(){yaAd();return _nl.apply(this,arguments)}}
{const _sh=show;show=function(n){if(n==='menu')yaAd();const r=_sh.apply(this,arguments);gpSync();return r}}
{const _st=setTheme;setTheme=function(th){_st.apply(this,arguments);yaSave()}}
{const _sl=setLang;setLang=function(l){_sl.apply(this,arguments);yaSave()}}
function yaSave(){try{if(ya_player)ya_player.setData({lang:lang,theme:document.documentElement.dataset.theme},true).catch(()=>{})}catch(e){}}
function yaInit(y){YA=y;
 try{y.getPlayer({scopes:false}).then(pl=>{ya_player=pl;return pl.getData(['lang','theme'])}).then(d=>{if(!d)return;if((d.lang==='ru'||d.lang==='en')&&!hasSavedLang()){lang=d.lang;applyLang();renderLg()}if((d.theme==='dark'||d.theme==='light')&&!localStorage.getItem('chessTheme'))setTheme(d.theme)}).catch(()=>{})}catch(e){}
 gpSync()}
/* online controls appear only when the server answers (Render free tier can be asleep) */
(function(){const els=[$('bCr'),document.querySelector('#s-menu .row')].filter(Boolean);
 els.forEach(e=>e.style.display='none');
 const show_=()=>els.forEach(e=>e.style.display='');
 const base=SERVER.replace(/^ws/,'http').replace(/\/+$/,'');
 let ok=false;
 fetch(base+'/version',{signal:AbortSignal.timeout(70000)}).then(r=>{if(r.ok){ok=true;show_()}}).catch(()=>{});
 if(room)show_()})();
if(typeof YaGames!=='undefined')YaGames.init().then(y=>{try{yaInit(y)}catch(e){}try{if(!hasSavedLang()){const l=y.environment.i18n.lang;lang=/^(ru|be|kk|uk|uz)/.test(l)?'ru':'en'}}catch(e){}applyLang();renderLg();try{y.features.LoadingAPI.ready()}catch(e){}}).catch(()=>{});
