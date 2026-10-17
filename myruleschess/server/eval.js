// Quality check for the AI rule parser.
//
//   GROQ_API_KEY=your-key node eval.js        real check against Groq (uses ~1 request per case)
//   node eval.js --mock                        offline self-test with canned (including WRONG) model answers
//
// Every case is a phrase a player might type plus a check of what the game then actually DOES
// (not just what the JSON looks like). Add your own cases when you find a phrase that misbehaves,
// then improve PROMPT / repairPatch in server.js until the whole table is green.
const { ask, E } = require('./server.js');

const sq = s => [8 - +s[1], 'abcdefgh'.indexOf(s[0])];
const name = (r, c) => 'abcdefgh'[c] + (8 - r);
const game = cfg => { const S = E.newGame(cfg); S.bd = Array.from({ length: 8 }, () => Array(8).fill(null)); S.rep = {}; return S; };
const put = (S, m) => { for (const k in m) S.bd[sq(k)[0]][sq(k)[1]] = { t: m[k][1], c: m[k][0] }; return S; };
const dests = (S, from) => { const [r, c] = sq(from); return E.movesOf(S, r, c).map(m => name(m[0], m[1]) + (m[2] || '')).sort(); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify([...b].sort());
const kings = { e1: 'wK', e8: 'bK' };
const start = cfg => E.newGame(cfg);

// phrase, language, check(config) -> true when the game behaves as the player meant
const CASES = [
  { t: 'пешка ходит на 3 клетки', l: 'ru', ok: c => same(dests(start(c), 'e2'), ['e3', 'e4', 'e5']) && dests(put(game(c), { ...kings, e2: 'wP', d3: 'bN' }), 'e2').includes('d3'),
    mock: { config: { pieces: { P: { jumps: [[-3, 0]] } } } } },
  { t: 'pawns move 2 squares', l: 'en', ok: c => same(dests(put(game(c), { ...kings, e4: 'wP' }), 'e4'), ['e5', 'e6']),
    mock: { config: { pieces: { P: { slide: [[-1, 0]], max: 2 } } } } },
  { t: 'пешки ходят на 4 клетки вперёд', l: 'ru', ok: c => same(dests(start(c), 'e2'), ['e3', 'e4', 'e5', 'e6']) },
  { t: 'pawn can move 3 squares forward', l: 'en', ok: c => same(dests(start(c), 'a2'), ['a3', 'a4', 'a5']) },
  { t: 'слон ходит как конь', l: 'ru', ok: c => same(dests(put(game(c), { ...kings, c4: 'wB' }), 'c4'), ['a3', 'a5', 'b2', 'b6', 'd2', 'd6', 'e3', 'e5']),
    mock: { config: { pieces: { B: { slide: [], jumps: 'knight' } } } } },
  { t: 'ладья ходит только на 3 клетки', l: 'ru', ok: c => same(dests(put(game(c), { ...kings, a4: 'wR' }), 'a4'), ['a1', 'a2', 'a3', 'a5', 'a6', 'a7', 'b4', 'c4', 'd4']),
    mock: { config: { pieces: { R: { jumps: [[3, 0], [-3, 0], [0, 3], [0, -3]] } } } } },
  { t: 'ферзь ходит на 2 клетки', l: 'ru', ok: c => Math.max(...dests(put(game(c), { ...kings, a1: 'wQ' }), 'a1').map(d => Math.max(Math.abs(sq(d)[0] - 7), Math.abs(sq(d)[1])))) === 2 },
  { t: 'король ходит на 2 клетки', l: 'ru', ok: c => dests(put(game(c), { e8: 'bK', a1: 'wK' }), 'a1').includes('a3') && dests(put(game(c), { e8: 'bK', a1: 'wK' }), 'a1').includes('c3') },
  { t: 'слон ходит на 2 клетки', l: 'ru', ok: c => same(dests(put(game(c), { ...kings, d4: 'wB' }), 'd4'), ['b2', 'b6', 'c3', 'c5', 'e3', 'e5', 'f2', 'f6']) },
  { t: 'ферзь прыгает через фигуры', l: 'ru', ok: c => dests(put(game(c), { ...kings, a1: 'wQ', a2: 'wP', a3: 'bP' }), 'a1').includes('a3') },
  { t: 'конь телепортируется один раз', l: 'ru', ok: c => dests(put(game(c), { ...kings, b1: 'wN' }), 'b1').includes('e5') && dests(put(game(c), { ...kings, b1: 'wN' }), 'b1').includes('a3') },
  { t: 'ферзь неуязвим', l: 'ru', ok: c => (c.immune || []).includes('Q') },
  { t: 'у пешек пистолет, стреляют на 3 клетки', l: 'ru', ok: c => c.pieces.P && c.pieces.P.shoot && c.pieces.P.shoot.range === 3 && dests(start(c), 'e2').includes('e3') },
  { t: 'без шаха и мата', l: 'ru', ok: c => c.check === false },
  { t: 'пешки бьют только прямо', l: 'ru', ok: c => c.pawnCapture === 'straight' },
  { t: 'король не может ходить', l: 'ru', ok: c => dests(put(game(c), { ...kings, a1: 'wK', e8: 'bK' }), 'a1').length === 0 },
  { t: 'слон — бомба', l: 'ru', ok: c => c.pieces.B && c.pieces.B.blast === true },
  { t: 'ладья ходит как слон', l: 'ru', ok: c => dests(put(game(c), { ...kings, a1: 'wR' }), 'a1').includes('b2') },
  { t: 'пешка превращается в ферзя', l: 'ru', ok: c => c.promoteTo === 'Q' },
  { t: 'нельзя рокироваться', l: 'ru', ok: c => c.castling === false },
  { t: 'двойной ход пешки запрещён', l: 'ru', ok: c => same(dests(start(c), 'e2'), ['e3']) },
  { t: 'rook moves like a knight', l: 'en', ok: c => dests(put(game(c), { ...kings, d4: 'wR' }), 'd4').includes('e6') && !dests(put(game(c), { ...kings, d4: 'wR' }), 'd4').includes('d5') },
  { t: 'the queen cannot move', l: 'en', ok: c => dests(put(game(c), { ...kings, d4: 'wQ' }), 'd4').length === 0 },
  { t: 'ладья не может бить пешки', l: 'ru', ok: c => !dests(put(game(c), { ...kings, a1: 'wR', a4: 'bP' }), 'a1').includes('a4') },
  { t: 'bishop explodes when it captures', l: 'en', ok: c => c.pieces.B && c.pieces.B.blast === true },
  { t: 'конь замораживает врагов на 2 хода', l: 'ru', ok: c => c.pieces.N.freeze && c.pieces.N.freeze.turns === 2 },
  { t: 'слон обращает врагов в союзников', l: 'ru', ok: c => !!c.pieces.B.convert },
  { t: 'ферзь воскрешает павших один раз', l: 'ru', ok: c => c.pieces.Q.revive && c.pieces.Q.revive.limit === 1 },
  { t: 'пешки в броне', l: 'ru', ok: c => c.pieces.P && c.pieces.P.armor >= 1 && dests(start(c), 'e2').includes('e4') },
  { t: 'конь ходит ещё раз после взятия', l: 'ru', ok: c => c.pieces.N.extra === true && c.pieces.N.jumps === 'knight' },
  { t: 'пешки могут ходить назад', l: 'ru', ok: c => c.pawnBack === true },
  { t: 'knight freezes enemies', l: 'en', ok: c => !!c.pieces.N.freeze },
  { t: 'bishop converts enemy pieces to its side', l: 'en', ok: c => !!c.pieces.B.convert },
  { t: 'the queen has two lives', l: 'en', ok: c => c.pieces.Q.armor >= 1 },
];

const mock = process.argv.includes('--mock');
if (mock) {
  // offline: pretend to be the language model, answering with the known-wrong outputs
  global.fetch = async (_u, o) => {
    const text = JSON.parse(o.body).messages[1].content.split('Player rules:\n')[1];
    const c = CASES.find(x => x.t === text);
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify({ ...c.mock, summary: 'mock', unsupported: [] }) } }] }), text: async () => '' };
  };
} else if (!process.env.GROQ_API_KEY) {
  console.error('Set GROQ_API_KEY (or run with --mock for the offline self-test).'); process.exit(2);
}

(async () => {
  const base = E.sanitize(E.STD);
  let pass = 0, fail = 0;
  const list = mock ? CASES.filter(c => c.mock) : CASES;
  for (const c of list) {
    let res, ok = false, note = '';
    try { res = await ask(c.t, c.l, base); ok = !!c.ok(E.sanitize(res.config)); if (!res.changed) note = '(nothing changed) '; note += res.summary || ''; }
    catch (e) { note = 'ERROR ' + String(e.message || e).slice(0, 90); }
    ok ? pass++ : fail++;
    console.log((ok ? 'PASS ' : 'FAIL ') + c.t.padEnd(44) + note.slice(0, 80));
    if (!mock) await new Promise(r => setTimeout(r, 1200)); // stay under the rate limit
  }
  console.log(`\n${pass}/${pass + fail} passed`);
  process.exit(fail ? 1 : 0);
})();
