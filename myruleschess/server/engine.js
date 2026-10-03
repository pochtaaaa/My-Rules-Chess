(function(){
const DIR={orth:[[1,0],[-1,0],[0,1],[0,-1]],diag:[[1,1],[1,-1],[-1,1],[-1,-1]],knight:[[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]]};DIR.all=[...DIR.orth,...DIR.diag];
const vec=v=>typeof v==='string'?(DIR[v]||[]):(Array.isArray(v)?v:[]);
const STD={winPiece:'K',promoteTo:'Q',pawnDouble:true,shield:{},pieces:{K:{slide:'all',max:1},Q:{slide:'all',max:8},R:{slide:'orth',max:8},B:{slide:'diag',max:8},N:{jumps:'knight'}}};
const In=(r,c)=>r>=0&&r<8&&c>=0&&c<8;
function newGame(cfg){const row='RNBQKBNR',bd=Array.from({length:8},()=>Array(8).fill(null));
 for(let c=0;c<8;c++){bd[0][c]={t:row[c],c:'b'};bd[1][c]={t:'P',c:'b'};bd[6][c]={t:'P',c:'w'};bd[7][c]={t:row[c],c:'w'}}
 return{cfg,bd,turn:'w',jc:{},over:false,winner:null}}
function shielded(S,r,c,q){const by=(S.cfg.shield||{})[q.t];if(!by)return false;
 return DIR.orth.some(([a,b])=>{const p=In(r+a,c+b)&&S.bd[r+a][c+b];return p&&p.c===q.c&&p.t===by})}
function movesOf(S,r,c){const bd=S.bd,p=bd[r][c],o=[],en=p.c==='w'?'b':'w',pc=S.cfg.pieces[p.t]||{};
 const can=(q,y,x)=>q.c!==p.c&&!(pc.noCapture||[]).includes(q.t)&&!shielded(S,y,x,q);
 const add=(y,x)=>{if(!In(y,x))return false;const q=bd[y][x];if(!q){o.push([y,x]);return true}if(can(q,y,x))o.push([y,x]);return false};
 if(p.t==='P'){const d=p.c==='w'?-1:1,st=p.c==='w'?6:1;
  if(In(r+d,c)&&!bd[r+d][c]){o.push([r+d,c]);if(S.cfg.pawnDouble!==false&&r===st&&!bd[r+2*d][c])o.push([r+2*d,c])}
  [-1,1].forEach(s=>{if(In(r+d,c+s)){const q=bd[r+d][c+s];if(q&&q.c===en&&can(q,r+d,c+s))o.push([r+d,c+s])}});return o}
 vec(pc.slide).forEach(([a,b])=>{for(let i=1;i<=(pc.max||8);i++)if(!add(r+a*i,c+b*i))break});
 if(!pc.jumpLimit||(S.jc[p.c+p.t]||0)<pc.jumpLimit)vec(pc.jumps).forEach(([a,b])=>add(r+a,c+b));
 return o}
function play(S,r,c,y,x){const p=S.bd[r][c],q=S.bd[y][x],pc=S.cfg.pieces[p.t]||{};
 if(pc.jumpLimit&&vec(pc.jumps).some(([a,b])=>a===y-r&&b===x-c)&&!vec(pc.slide).some(([a,b])=>{for(let i=1;i<=(pc.max||8);i++)if(a*i===y-r&&b*i===x-c)return true;return false}))S.jc[p.c+p.t]=(S.jc[p.c+p.t]||0)+1;
 S.bd[y][x]=p;S.bd[r][c]=null;if(p.t==='P'&&(y===0||y===7))p.t=S.cfg.promoteTo||'N';
 if(q&&q.t===S.cfg.winPiece){S.over=true;S.winner=p.c;return}
 S.turn=S.turn==='w'?'b':'w'}
function sanitize(c){const L='KQRBNP',ok=x=>typeof x==='string'&&x.length===1&&L.includes(x);c=c||{};
 const o={winPiece:ok(c.winPiece)?c.winPiece:'K',promoteTo:ok(c.promoteTo)&&c.promoteTo!=='P'?c.promoteTo:'Q',pawnDouble:c.pawnDouble!==false,shield:{},pieces:{}};
 for(const k in(c.shield||{}))if(ok(k)&&ok(c.shield[k]))o.shield[k]=c.shield[k];
 const sv=v=>typeof v==='string'?(DIR[v]?v:undefined):Array.isArray(v)?v.slice(0,16).filter(a=>Array.isArray(a)&&a.length===2&&a.every(n=>Number.isInteger(n)&&Math.abs(n)<8)):undefined;
 for(const k of L){const p=(c.pieces||{})[k];if(!p||typeof p!=='object')continue;const q={};
  const sl=sv(p.slide),jm=sv(p.jumps);if(sl)q.slide=sl;if(jm)q.jumps=jm;
  if(Number.isInteger(p.max))q.max=Math.min(8,Math.max(1,p.max));
  if(Number.isInteger(p.jumpLimit))q.jumpLimit=Math.min(64,Math.max(1,p.jumpLimit));
  if(Array.isArray(p.noCapture))q.noCapture=p.noCapture.filter(ok).slice(0,6);o.pieces[k]=q}
 return o}
const E={STD,DIR,vec,newGame,movesOf,play,sanitize};
if(typeof module!=='undefined')module.exports=E;else window.Chess=E;
})();
