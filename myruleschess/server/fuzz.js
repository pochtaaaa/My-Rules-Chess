// Universal engine tester: random rule sets x random games, checked against hard invariants.
//
//   node fuzz.js            run for 20 seconds
//   node fuzz.js 120 42     run for 120 seconds with seed 42 (reproducible)
//
// It does NOT know about any specific rule. For every random position it checks that:
//   1. nothing throws (move generation, play, sanitize, JSON round trip);
//   2. the list of LEGAL moves equals what really happens when each move is played
//      (a move is legal <=> after playing it the mover's king is not attacked);
//   3. sanitize() is idempotent and the config survives JSON;
//   4. the state is always valid (turn is w/b, no piece off the board, kings never duplicated);
//   5. games make progress (a position never has "no legal moves" without the game ending).
// Any failure prints the rule set and position, so it can be turned into a regression test.
const E = require('./engine');

const seconds = +process.argv[2] || 20;
let seed = +process.argv[3] || (Date.now() % 1e9);
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const pick = a => a[Math.floor(rnd() * a.length)];
const chance = p => rnd() < p;
const clone = o => JSON.parse(JSON.stringify(o));
const L = 'KQRBNP';

function randomPiece() {
  const q = {};
  if (chance(.4)) q.slide = pick(['orth', 'diag', 'all', [], [[-1, 0]], [[1, 1], [-1, -1]]]);
  if (chance(.15)) q.max = 1 + Math.floor(rnd() * 8);
  if (chance(.3)) q.jumps = pick(['knight', 'any', [[2, 0], [0, 2]], [[-3, 0]]]);
  if (chance(.1)) q.jumpLimit = 1 + Math.floor(rnd() * 3);
  if (chance(.15)) q.leap = true;
  if (chance(.1)) q.rel = true;
  if (chance(.12)) q.shoot = { dirs: pick(['orth', 'diag', 'all']), range: 1 + Math.floor(rnd() * 5), ...(chance(.4) ? { limit: 1 + Math.floor(rnd() * 3) } : {}) };
  if (chance(.1)) q.swap = true;
  if (chance(.12)) q.blast = true;
  if (chance(.12)) q.freeze = chance(.3) ? true : { turns: 1 + Math.floor(rnd() * 4), range: 1 + Math.floor(rnd() * 3) };
  if (chance(.12)) q.convert = chance(.3) ? true : { range: 1 + Math.floor(rnd() * 3), ...(chance(.5) ? { limit: 1 + Math.floor(rnd() * 3) } : {}) };
  if (chance(.12)) q.revive = chance(.5) ? true : { limit: 1 + Math.floor(rnd() * 3) };
  if (chance(.12)) q.armor = 1 + Math.floor(rnd() * 3);
  if (chance(.12)) q.extra = true;
  if (chance(.05)) q.noCapture = [pick([...L])];
  return q;
}
function randomConfig() {
  const c = clone(E.STD);
  if (chance(.1)) c.check = false;
  if (chance(.05)) c.winPiece = pick(['Q', 'R', 'K']);
  if (chance(.3)) c.pawnRange = 1 + Math.floor(rnd() * 4);
  if (chance(.2)) c.pawnBack = true;
  if (chance(.15)) c.pawnDouble = false;
  if (chance(.15)) c.pawnCapture = pick(['straight', 'both']);
  if (chance(.15)) c.castling = false;
  if (chance(.15)) c.immune = [pick([...L]), pick([...L])];
  if (chance(.1)) c.shield = { [pick([...L])]: pick([...L]) };
  if (chance(.1)) c.promoteTo = pick(['Q', 'R', 'B', 'N', 'choice']);
  const n = Math.floor(rnd() * 4);
  for (let i = 0; i < n; i++) { const k = pick([...L]); c.pieces[k] = { ...(c.pieces[k] || {}), ...randomPiece() }; }
  return c;
}

const fail = {};
let positions = 0, games = 0, moves = 0, configs = 0, spells = 0, pendingSpell = null;
const record = (kind, detail) => { (fail[kind] = fail[kind] || []).push(detail); };
const board = S => S.bd.map(r => r.map(p => p ? (p.c === 'w' ? p.t : p.t.toLowerCase()) : '.').join('')).join('/');

function audit(S, cfgRaw) {
  positions++;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = S.bd[r][c]; if (!p || p.c !== S.turn) continue;
    const legal = new Set(E.movesOf(S, r, c).map(m => m.join(',')));
    const P = clone(S); P.cfg.check = false;                       // pseudo-legal moves only
    for (const m of E.movesOf(P, r, c)) {
      if (p.t === 'K' && !m[2] && Math.abs(m[1] - c) === 2) continue;   // castling has its own path rules
      const U = clone(S); if (U.spell) U.spell.left = 99;     // judge the move by the rules in force when it is made, not by the ones after expiry
      try { E.play(U, r, c, m[0], m[1], m[2] || (p.t === 'P' && (m[0] === 0 || m[0] === 7) ? 'Q' : undefined)); }
      catch (e) { record('play-threw', { err: String(e.message), cfg: cfgRaw, board: board(S), move: [r, c, ...m] }); continue; }
      const wonByCapture = U.over && U.reason === 'capture';
      const bad = wonByCapture ? false : E.inCheck(U, p.c);
      if (bad === legal.has(m.join(','))) record(bad ? 'illegal-move-allowed' : 'legal-move-blocked', { cfg: cfgRaw, board: board(S), turn: S.turn, piece: p.t + p.c, move: m, state: clone(S) });
    }
  }
}

const t0 = Date.now();
while (Date.now() - t0 < seconds * 1000) {
  const raw = randomConfig(); let cfg;
  try { cfg = E.sanitize(raw); const again = E.sanitize(cfg); if (JSON.stringify(again) !== JSON.stringify(cfg)) record('sanitize-not-idempotent', { cfg: raw }); JSON.parse(JSON.stringify(cfg)); }
  catch (e) { record('sanitize-threw', { err: String(e.message), cfg: raw }); continue; }
  configs++;
  let S = E.newGame(cfg); games++; pendingSpell = null;
  for (let ply = 0; ply < 70 && !S.over; ply++) {
    try {
      if (E.inCheck(S, S.turn) || ply % 6 === 0) audit(S, raw);
      const all = [];
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = S.bd[r][c]; if (p && p.c === S.turn) for (const m of E.movesOf(S, r, c)) all.push([r, c, ...m]); }
      if (!all.length) { record('no-moves-but-game-continues', { cfg: raw, board: board(S), turn: S.turn }); break; }
      // random spells: after a successful cast the enemy king must not be attacked, the caster must have a move,
      // and exactly two plies later the original rules must be back
      if (!S.spell && E.canChange(S, S.turn) && chance(.12)) {
        const caster = S.turn, before = JSON.stringify(S.cfg), r = E.setRules(S, E.sanitize(randomConfig()), caster);
        if (r.ok) {
          spells++;
          if (E.kingAttacked(S, caster === 'w' ? 'b' : 'w')) record('spell-exposed-king', { cfg: raw, board: board(S), caster });
          if (r.cost > E.BAL.budget) record('spell-over-budget', { cost: r.cost, cfg: raw });
          pendingSpell = { before, plies: 0 };
        }
        const all2 = []; for (let a = 0; a < 8; a++) for (let b = 0; b < 8; b++) { const q = S.bd[a][b]; if (q && q.c === S.turn) for (const mm of E.movesOf(S, a, b)) all2.push([a, b, ...mm]); }
        if (!all2.length) { record('spell-left-caster-without-moves', { cfg: raw, board: board(S) }); break; }
        all.length = 0; all.push(...all2);
      }
      const m = pick(all), p = S.bd[m[0]][m[1]];
      E.play(S, m[0], m[1], m[2], m[3], m[4] || (p.t === 'P' && (m[2] === 0 || m[2] === 7) ? 'Q' : undefined)); moves++;
      if (pendingSpell && !S.over) { pendingSpell.plies++; if (pendingSpell.plies >= E.BAL.lifetime) { if (S.spell || JSON.stringify(S.cfg) !== pendingSpell.before) record('spell-did-not-expire', { cfg: raw, board: board(S) }); pendingSpell = null; } }
      if (S.turn !== 'w' && S.turn !== 'b') record('bad-turn', { cfg: raw, board: board(S) });
      let kw = 0, kb = 0; for (const row of S.bd) for (const q of row) { if (q && q.t === 'K') q.c === 'w' ? kw++ : kb++; }
      if (kw > 1 || kb > 1) record('duplicate-king', { cfg: raw, board: board(S) });
      if (ply % 10 === 9) S = JSON.parse(JSON.stringify(S));            // the server/clients pass state as JSON
    } catch (e) { record('threw', { err: String(e.stack || e).split('\n').slice(0, 3).join(' | '), cfg: raw, board: board(S) }); break; }
  }
}
console.log(`fuzz: ${configs} rule sets, ${games} games, ${moves} moves, ${spells} spells cast, ${positions} audited positions in ${seconds}s (seed ${process.argv[3] || 'random'})`);
const kinds = Object.keys(fail);
if (!kinds.length) { console.log('no problems found'); process.exit(0); }
require('fs').writeFileSync('fuzz-failures.json', JSON.stringify(Object.fromEntries(kinds.map(k => [k, fail[k][0]])), null, 1));
console.log('first failure of each kind saved to fuzz-failures.json');
for (const k of kinds) { console.log(`\n${k}: ${fail[k].length}`); console.log(JSON.stringify(fail[k][0]).slice(0, 500)); }
process.exit(1);
