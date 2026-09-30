// MATH-helper: the calculator, the notebook that explains every answer, Practice mode, the radio and saving.
import { solve, fmt, clean, fracHTML, polyStr, readAnswer, MathError } from './math.js';
import { writtenMethod } from './methods.js';
import { TOPICS, LEVELS, makeProblem } from './school.js';
import { sfx, setSfx, radio, TRACKS, setMusicVolume, audioCtx } from './audio.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const params = new URLSearchParams(location.search);
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

// ---------- saved state ----------
const SAVE_KEY = 'mathhelper.v1';
const S = Object.assign({
  deg: true, ans: 0, history: [],
  music: { on: true, vol: 0.6, track: 0 }, sfx: true,
  school: { topic: 'add', level: 0, stars: 0, streak: 0, best: 0, right: 0, stats: {} },
}, (() => { try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch { return {}; } })());
S.school = Object.assign({ topic: 'add', level: 0, stars: 0, streak: 0, best: 0, right: 0, stats: {} }, S.school);
function save(flash) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch { return; }
  if (flash) { const el = $('#saved'); el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 1400); }
}
setInterval(() => save(true), 30000);
addEventListener('visibilitychange', () => { if (document.hidden) save(false); });
addEventListener('pagehide', () => save(false));

// ---------- the calculator keys ----------
// l = label, i = what it types, s/si = gold SHIFT label and what that types, c = key style
const FKEYS = [
  { l: 'SHIFT', a: 'shift', c: 'shift' }, { l: 'MODE', a: 'mode', s: 'DEG/RAD' }, { l: '◀', a: 'left' }, { l: '▶', a: 'right' }, { l: 'S⇔D', a: 'sd', s: 'fraction' }, { l: 'x', i: 'x', c: 'var', s: 'variable' },
  { l: '√▫', i: '√(', s: '∛', si: '∛(' }, { l: 'x<sup>2</sup>', i: '²', s: 'x³', si: '³' }, { l: 'x<sup>▫</sup>', i: '^', s: 'x⁻¹', si: '^(−1)' }, { l: 'log', i: 'log(', s: '10<sup>x</sup>', si: '10^(' }, { l: 'ln', i: 'ln(', s: 'e<sup>x</sup>', si: 'e^(' }, { l: '=', i: '=', c: 'var', s: 'equation' },
  { l: 'sin', i: 'sin(', s: 'sin⁻¹', si: 'sin⁻¹(' }, { l: 'cos', i: 'cos(', s: 'cos⁻¹', si: 'cos⁻¹(' }, { l: 'tan', i: 'tan(', s: 'tan⁻¹', si: 'tan⁻¹(' }, { l: '(', i: '(' }, { l: ')', i: ')' }, { l: 'x!', i: '!', s: '|x|', si: 'abs(' },
  { l: '%', i: '%' }, { l: '<span style="font-family:Georgia,serif;font-size:17px">π</span>', i: 'π', s: 'e', si: 'e' }, { l: 'of', i: ' of ', s: 'percent of' }, { l: 'a/b', i: '/', s: 'fraction' }, { l: '(−)', i: '−', s: 'negative' }, { l: 'Ans', i: 'Ans', s: 'last answer' },
];
const NKEYS = [
  { l: '7', i: '7', c: 'num' }, { l: '8', i: '8', c: 'num' }, { l: '9', i: '9', c: 'num' }, { l: 'DEL', a: 'del', c: 'orange', s: 'INS' }, { l: 'AC', a: 'ac', c: 'orange', s: 'OFF' },
  { l: '4', i: '4', c: 'num' }, { l: '5', i: '5', c: 'num' }, { l: '6', i: '6', c: 'num' }, { l: '×', i: '×' }, { l: '÷', i: '÷' },
  { l: '1', i: '1', c: 'num' }, { l: '2', i: '2', c: 'num' }, { l: '3', i: '3', c: 'num' }, { l: '+', i: '+' }, { l: '−', i: '−' },
  { l: '0', i: '0', c: 'num' }, { l: '.', i: '.', c: 'num' }, { l: '×10<sup>x</sup>', i: '×10^(' }, { l: '|x|', i: 'abs(' }, { l: '=', a: 'eq', c: 'blue' },
];

const C = { toks: [], cur: 0, shift: false, done: false, result: null, rootIdx: 0, showFrac: false };

function buildKeys() {
  const mk = (list, host) => list.forEach(k => {
    const w = document.createElement('div'); w.className = 'kw';
    w.innerHTML = `<span class="gold">${k.s || ''}</span><button class="k ${k.c || ''}" aria-label="${(k.l || '').replace(/<[^>]+>/g, '')}">${k.l}</button>`;
    const b = w.querySelector('button'); k.el = b;
    b.addEventListener('pointerdown', e => { e.preventDefault(); press(k); });
    host.appendChild(w);
  });
  mk(FKEYS, $('#fkeys')); mk(NKEYS, $('#nkeys'));
}
const keyByAction = a => [...FKEYS, ...NKEYS].find(k => k.a === a);
const keyByIns = i => [...NKEYS, ...FKEYS].find(k => k.i === i);
function flashKey(k) { if (!k?.el) return; k.el.classList.add('down'); setTimeout(() => k.el.classList.remove('down'), 110); }

function insert(t) {
  if (C.done) {
    // like a real calculator: a new number starts over, an operator keeps going from Ans
    if (/^[+\-−×÷^²³!%]/.test(t) || t === ' of ') { C.toks = ['Ans']; C.cur = 1; }
    else { C.toks = []; C.cur = 0; }
    C.done = false;
  }
  C.toks.splice(C.cur, 0, t); C.cur++;
}
function press(k, silent) {
  if (!silent) sfx.key(k.c === 'blue' ? 'eq' : k.c === 'num' ? 'num' : 'fn');
  flashKey(k);
  startMusicIfWanted();
  const sh = C.shift && !!k.s; C.shift = k.a === 'shift' ? !C.shift : false;
  if (k.a) {
    switch (k.a) {
      case 'shift': break;
      case 'mode': S.deg = !S.deg; break;
      case 'left': if (C.done) C.done = false; C.cur = Math.max(0, C.cur - 1); break;
      case 'right': if (C.done) C.done = false; C.cur = Math.min(C.toks.length, C.cur + 1); break;
      case 'sd': if (C.result) { C.showFrac = !C.showFrac; } break;
      case 'del': if (C.done) { C.done = false; C.cur = C.toks.length; } if (C.cur > 0) { C.toks.splice(C.cur - 1, 1); C.cur--; } break;
      case 'ac': C.toks = []; C.cur = 0; C.done = false; C.result = null; C.showFrac = false; sfx.clear(); break;
      case 'eq': evaluate(); break;
    }
  } else insert(sh && k.si ? k.si : k.i);
  drawLCD();
}

// ---------- the LCD ----------
const SEGS = (() => {
  const h = (x1, x2, y) => `${x1},${y} ${x1 + 2.2},${y - 2.2} ${x2 - 2.2},${y - 2.2} ${x2},${y} ${x2 - 2.2},${y + 2.2} ${x1 + 2.2},${y + 2.2}`;
  const v = (x, y1, y2) => `${x},${y1} ${x + 2.2},${y1 + 2.2} ${x + 2.2},${y2 - 2.2} ${x},${y2} ${x - 2.2},${y2 - 2.2} ${x - 2.2},${y1 + 2.2}`;
  return { a: h(4.5, 20.5, 3), b: v(21.5, 4, 21.5), c: v(21.5, 22.5, 40), d: h(4.5, 20.5, 41), e: v(3.5, 22.5, 40), f: v(3.5, 4, 21.5), g: h(4.5, 20.5, 22) };
})();
const GLYPH = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g', E: 'afged', r: 'eg', o: 'cdeg', t: 'fged', U: 'bcdef', F: 'afge', A: 'abcefg', L: 'fed', S: 'afgcd', n: 'ceg', d: 'bcdeg', b: 'cdefg', P: 'abefg', C: 'adef', H: 'bcefg', '⌟': 'cd', ' ': '' };
const CELLS = 13;
function drawSeg(text) {
  const cells = [];
  for (const ch of String(text)) {
    if (ch === '.' && cells.length) cells[cells.length - 1].dp = true;
    else cells.push({ ch, dp: false });
  }
  while (cells.length > CELLS) cells.shift();
  while (cells.length < CELLS) cells.unshift({ ch: ' ', dp: false });
  const W = 27;
  let svg = '';
  cells.forEach((c, i) => {
    const on = GLYPH[c.ch] ?? '';
    svg += `<g transform="translate(${i * W},0)">`;
    for (const s in SEGS) svg += `<polygon class="s${on.includes(s) ? '' : ' off'}" points="${SEGS[s]}"/>`;
    svg += `<circle class="s${c.dp ? '' : ' off'}" cx="25" cy="41" r="1.9"/></g>`;
  });
  const el = $('#seg'); el.setAttribute('viewBox', `-2 0 ${CELLS * W + 2} 44`); el.innerHTML = svg;
}
function lcdNumber(v) {
  if (!isFinite(v)) return 'Error';
  v = clean(v); const a = Math.abs(v);
  if (a !== 0 && (a >= 1e10 || a < 1e-9)) { const [m, e] = v.toExponential(5).split('e'); return String(parseFloat(m)) + 'E' + (+e); }
  let s = String(parseFloat(v.toPrecision(10)));
  return s;
}
function drawLCD() {
  const text = C.toks.map(esc).join('');
  const before = C.toks.slice(0, C.cur).map(esc).join(''), after = C.toks.slice(C.cur).map(esc).join('');
  $('#inText').innerHTML = C.done ? text : before + '<span class="cur"></span>' + after;
  const line = $('#line1'), cur = $('#inText .cur');
  if (cur) line.scrollLeft = Math.max(0, cur.offsetLeft - line.clientWidth + 30); else line.scrollLeft = 0;
  $('#indS').classList.toggle('on', C.shift);
  $('#indMode').textContent = S.deg ? 'D' : 'R'; $('#indMode').classList.add('on');
  FKEYS[0].el.classList.toggle('on', C.shift);
  const r = C.result;
  $('#indFrac').classList.toggle('on', !!(r && C.showFrac && r.frac));
  $('#indX').classList.toggle('on', !!(r && r.kind === 'eqn' && r.roots));
  let seg = '0', xlab = '';
  if (r && r.error) seg = 'Error';
  else if (r) {
    if (r.kind === 'eqn') {
      if (r.roots?.length) { const i = C.rootIdx % r.roots.length; seg = lcdNumber(r.roots[i]); xlab = r.roots.length > 1 ? `x${i + 1}=` : 'x='; }
      else seg = r.lcd;
    } else if (r.kind === 'check') seg = r.lcd;
    else if (r.kind === 'simplify') { seg = ''; xlab = esc(r.answer); }
    else if (C.showFrac && r.frac) seg = `${r.frac[0]}⌟${r.frac[1]}`;
    else seg = lcdNumber(r.value);
  } else if (!C.toks.length) seg = '0';
  else seg = '';
  $('#xlab').innerHTML = xlab;
  drawSeg(seg);
}

function evaluate() {
  const src = C.toks.join('');
  if (!src.trim()) { C.result = null; return; }
  if (C.done && C.result?.roots?.length > 1) { C.rootIdx++; sfx.click(); return; }   // press = again to see the other answer
  let r;
  try { r = solve(src, { deg: S.deg, ans: S.ans }); }
  catch (e) {
    if (!(e instanceof MathError)) console.error(e);
    C.result = { error: true }; C.done = true; sfx.error();
    renderError($('#nbSteps'), src, e.message === '=' ? 'Put the = only once, with something on both sides.' : e.message);
    showNb('steps');
    return;
  }
  C.result = r; C.done = true; C.rootIdx = 0; C.showFrac = r.kind === 'frac';
  if (typeof r.value === 'number' && isFinite(r.value)) S.ans = r.value;
  else if (r.roots?.length) S.ans = r.roots[0];
  S.history.unshift({ src, ans: r.answer.replace(/<[^>]+>/g, '') }); S.history = S.history.slice(0, 60);
  renderExplain($('#nbSteps'), r);
  renderHistory(); showNb('steps');
}

// ---------- the notebook ----------
function answerHTML(r) {
  if (r.kind === 'frac' && r.frac) {
    const [n, d] = r.frac; let s = (n < 0 ? '−' : '') + fracHTML(Math.abs(n), d);
    if (Math.abs(n) > d) s += ` = ${fmt(Math.trunc(n / d))} ${fracHTML(Math.abs(n % d), d)}`;
    return s + ` <small>≈ ${fmt(n / d)}</small>`;
  }
  if (r.kind === 'expr' && r.frac && Math.abs(r.frac[1]) <= 100) return `${fmt(r.value)} <small>= ${(r.frac[0] < 0 ? '−' : '') + fracHTML(Math.abs(r.frac[0]), r.frac[1])}</small>`;
  if (r.kind === 'simplify') return r.steps[0].after;
  if (r.kind === 'check') return r.ok ? 'TRUE ✔' : 'FALSE ✘';
  return esc(r.answer).replace(/ or /g, ' <small>or</small> ');
}
function renderExplain(el, r, { sound = true, heading = r.title } = {}) {
  let h = `<h3 class="nb-title">${heading}<small>${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</small></h3>`;
  h += `<div class="probline">Problem: <span class="m">${r.start}</span></div>`;
  h += `<div class="answerbox"><span>Answer: <b class="m">${answerHTML(r)}</b></span></div>`;
  h += '<ol class="steps">';
  r.steps.forEach((s, i) => {
    const wm = writtenMethod(s.method);
    h += `<li class="step" style="--d:${(0.15 + i * 0.28).toFixed(2)}s">
      <div class="rule">${esc(s.rule)}</div>
      <div class="mathline m">${s.before}${s.after ? `<span class="to">→</span>${s.after}` : ''}</div>
      <p class="why">${esc(s.text)}</p>
      ${wm ? `<details class="method"><summary>Show it on paper (${wm.title})</summary><div class="paper">${wm.html}</div></details>` : ''}
    </li>`;
  });
  h += '</ol>';
  el.innerHTML = h;
  el.closest('.page').scrollTop = 0;
  el.querySelectorAll('details.method').forEach(d => d.addEventListener('toggle', () => { if (d.open) sfx.pencil(0.5); }));
  if (sound) { sfx.page(); r.steps.slice(0, 6).forEach((_, i) => setTimeout(() => sfx.pencil(0.3), 150 + i * 280)); }
}
function renderError(el, src, msg) {
  el.innerHTML = `<h3 class="nb-title">Hmm, let's fix that</h3>
    <div class="probline">You typed: <span class="m">${esc(src)}</span></div>
    <p class="errnote"><span class="big">✏️</span> ${esc(msg)}</p>
    <p class="why">Tip: press <b>AC</b> to start over, or <b>◀ ▶</b> and <b>DEL</b> to fix one part.</p>`;
}
function renderEmpty() {
  $('#nbSteps').innerHTML = `<div class="nb-empty"><h3>How to do it <span class="arrowdoodle">✎</span></h3>
    <p>Type any problem on the calculator and press <b style="color:#2f73c9">=</b>.</p>
    <p>I'll write down every step, <em>in order</em>, and why it happens — just like your teacher would.</p>
    <p>You can do: <br>• plain math like 3 + 4 × 2<br>• fractions like 1/2 + 1/3<br>• percents like 15% of 80<br>• powers & roots like 2<sup>5</sup> or √50<br>• equations like 2x + 5 = 17 or x² − 5x + 6 = 0</p>
    <p>For big numbers look for <span style="color:#2f62b0">✏️ Show it on paper</span> to see long division, carrying and borrowing.</p></div>`;
}
function renderHistory() {
  const el = $('#nbHist');
  if (!S.history.length) { el.innerHTML = '<p class="nb-empty">Nothing yet — your problems will be listed here.</p>'; return; }
  el.innerHTML = '<h3 class="nb-title">History</h3>' + S.history.map((h, i) => `<button class="hist-item" data-i="${i}"><span>${esc(h.src)}</span><span>${esc(h.ans)}</span></button>`).join('');
  el.querySelectorAll('.hist-item').forEach(b => b.onclick = () => { sfx.click(); runExample(S.history[+b.dataset.i].src); });
}
function showNb(which) {
  $$('#calcNote .nbt').forEach(b => b.classList.toggle('on', b.dataset.nb === which));
  $('#nbSteps').hidden = which !== 'steps'; $('#nbHist').hidden = which !== 'hist';
}
$$('#calcNote .nbt').forEach(b => b.onclick = () => { sfx.page(); showNb(b.dataset.nb); });

// typing a whole problem in (examples, history, links)
function runExample(src) {
  C.toks = [...src.replace(/\*/g, '×').replace(/\//g, '÷').replace(/-/g, '−').replace(/sqrt/g, '√')]; C.cur = C.toks.length; C.done = false;
  // keep words like "sin(" and "Ans" as single keys so DEL removes them in one go
  C.toks = C.toks.join('').match(/sin⁻¹\(|cos⁻¹\(|tan⁻¹\(|sin\(|cos\(|tan\(|log\(|ln\(|abs\(|√\(|∛\(|Ans| of |./g) || [];
  C.cur = C.toks.length;
  evaluate(); drawLCD();
}
const EXAMPLES = ['3 + 4 × 2', '(8 − 3) × 4²', '1/2 + 1/3', '3/4 × 2/9', '15% of 80', '√50', '456 × 23', '7825 ÷ 25', '2x + 5 = 17', '3(x − 2) = 2x + 4', 'x² − 5x + 6 = 0', '−3² + 10', 'sin(30) + cos(60)', '5!', '1234 − 567', '17 ÷ 5'];
$('#examples').innerHTML = EXAMPLES.map(e => `<button>${esc(e)}</button>`).join('');
$$('#examples button').forEach(b => b.onclick = () => { sfx.key('fn'); startMusicIfWanted(); runExample(b.textContent.replace(/÷/g, '/').replace(/×/g, '*')); });

// keyboard
addEventListener('keydown', e => {
  if ($('#view-calc').classList.contains('on') === false || e.target.tagName === 'INPUT' || e.metaKey || e.ctrlKey || e.altKey) return;
  const map = { '*': '×', '/': '÷', '-': '−', 'Enter': null, '=': '=' };
  let k = null;
  if (e.key === 'Enter') k = keyByAction('eq');
  else if (e.key === 'Backspace') k = keyByAction('del');
  else if (e.key === 'Escape' || e.key === 'Delete') k = keyByAction('ac');
  else if (e.key === 'ArrowLeft') k = keyByAction('left');
  else if (e.key === 'ArrowRight') k = keyByAction('right');
  else if (/^[0-9.+()^!%x=]$/.test(e.key) || map[e.key]) k = keyByIns(map[e.key] || e.key) || { i: map[e.key] || e.key };
  else if (/^[a-z]$/i.test(e.key)) k = { i: e.key.toLowerCase() };
  if (!k) return;
  e.preventDefault(); press(k);
});
addEventListener('paste', e => {
  if (!$('#view-calc').classList.contains('on') || e.target.tagName === 'INPUT') return;
  const t = e.clipboardData.getData('text'); if (t) { e.preventDefault(); runExample(t.trim()); }
});

// ---------- practice ----------
const P = { prob: null, sol: null, tries: 0, over: false, hinted: false };
const TOPIC_COLORS = ['#d24a3c', '#e07a2a', '#c9a227', '#3d9a4f', '#2a8a8a', '#2f6fc0', '#6a4fc0', '#a04ab0', '#c0457a', '#5a6b7a', '#7a5230', '#1f7a5a'];
function buildPractice() {
  $('#topics').innerHTML = TOPICS.map((t, i) => `<button class="topic" data-t="${t.id}" style="background:linear-gradient(${TOPIC_COLORS[i]}, color-mix(in srgb, ${TOPIC_COLORS[i]} 75%, black))">${t.icon} ${t.name}<small>${t.grade}</small><span class="gr8" data-g="${t.id}"></span></button>`).join('');
  $$('.topic').forEach(b => b.onclick = () => { sfx.page(); S.school.topic = b.dataset.t; newProblem(); });
  $('#levels').innerHTML = LEVELS.map((l, i) => `<button class="lvl" data-l="${i}">${l}</button>`).join('');
  $$('.lvl').forEach(b => b.onclick = () => { sfx.chalk(); S.school.level = +b.dataset.l; newProblem(); });
  $('#ansForm').onsubmit = e => { e.preventDefault(); if (P.over) newProblem(); else check(); };
  $('#nextBtn').onclick = () => newProblem();
  $('#hintBtn').onclick = hint;
  $('#showBtn').onclick = () => { if (!P.over) giveUp(); else explainProblem(); };
  $('#reportBtn').onclick = openReport;
  $('#reportClose').onclick = () => { sfx.click(); $('#report').hidden = true; };
  $('#report').onclick = e => { if (e.target.id === 'report') $('#report').hidden = true; };
  $('#resetBtn').onclick = () => { if (!confirm('Clear all your stars, streaks and report card?')) return; S.school = { topic: S.school.topic, level: S.school.level, stars: 0, streak: 0, best: 0, right: 0, stats: {} }; save(false); drawScores(); openReport(); };
}
const chalkMath = q => esc(q).replace(/⟨(\d+)\|(\d+)⟩/g, (_, a, b) => fracHTML(+a, +b)).replace(/\^(\d+)/g, '<sup>$1</sup>');
function newProblem() {
  const s = S.school;
  let p, sol;
  for (let i = 0; i < 20; i++) { p = makeProblem(s.topic, s.level); try { sol = solve(p.src, { deg: true }); break; } catch { } }
  Object.assign(P, { prob: p, sol, tries: 0, over: false, hinted: false });
  const t = TOPICS.find(t => t.id === s.topic);
  $('#bTopic').textContent = t.icon + ' ' + t.name;
  $$('.topic').forEach(b => b.classList.toggle('on', b.dataset.t === s.topic));
  $$('.lvl').forEach(b => b.classList.toggle('on', +b.dataset.l === s.level));
  const pe = $('#problem'); pe.classList.remove('write'); void pe.offsetWidth; pe.classList.add('write');
  pe.innerHTML = chalkMath(p.q) + (p.kind === 'x' ? '' : p.kind === 'roots' ? '' : ' = ?');
  const inp = $('#ans'); inp.value = '';
  inp.placeholder = p.kind === 'frac' ? 'like 3/4' : p.kind === 'roots' ? 'like 2, 3' : p.kind === 'x' ? 'x = ?' : 'type here';
  inp.inputMode = p.kind === 'frac' || p.kind === 'roots' || p.kind === 'x' ? 'text' : 'decimal';
  setFeedback('', '');
  $('#showBtn').textContent = '📖 Show me how';
  $('#pSteps').innerHTML = `<div class="nb-empty"><h3>How to do it</h3><p>Try the problem on the board first!</p><p>Stuck? Press <b>💡 Hint</b> for a nudge, or <b>📖 Show me how</b> to see every step.</p><p style="margin-top:32px">${t.icon} <b>${t.name}</b> · ${LEVELS[s.level]}</p></div>`;
  sfx.chalk();
  if (matchMedia('(pointer: fine)').matches) inp.focus();
  drawScores();
}
function setFeedback(cls, html) { const f = $('#feedback'); f.className = 'feedback ' + cls; f.innerHTML = html ? `<span class="pop">${html}</span>` : ''; }
const expectRoots = () => P.sol.roots || [];
function check() {
  const raw = $('#ans').value.trim();
  if (!raw) { setFeedback('hint', 'Type your answer first ✏️'); return; }
  const p = P.prob, s = S.school;
  let ok = false, note = '';
  try {
    if (p.kind === 'roots') {
      const got = raw.replace(/x\s*=\s*/gi, '').split(/\s*(?:,|;|\bor\b|\band\b|\s)\s*/i).filter(Boolean).map(readAnswer);
      const want = [...new Set(expectRoots().map(v => clean(v)))];
      ok = got.length === want.length && want.every(w => got.some(g => Math.abs(g - w) < 1e-6));
      if (!ok && got.length < want.length && got.every(g => want.some(w => Math.abs(g - w) < 1e-6))) note = `That's one of them — there ${want.length === 2 ? 'are 2 answers' : 'is another'}. Type both, like "2, 3".`;
    } else {
      const want = P.sol.value ?? expectRoots()[0], got = readAnswer(raw);
      const tol = Math.max(1e-9, Math.abs(want) * 1e-9);
      ok = Math.abs(got - want) <= tol;
      const longDecimal = Math.abs(Math.round(want * 100) - want * 100) > 1e-6;   // e.g. 0.8333… — rounding to 2 places is fine
      if (!ok && longDecimal && Math.abs(got - want) <= 0.0051) { ok = true; note = `(Exactly it's ${fmt(want)}.)`; }
      if (ok && p.kind === 'frac' && P.sol.frac) {
        const [n, d] = P.sol.frac, m = /^(-?\d+)\s*\/\s*(\d+)$/.exec(raw);
        if (m && (+m[2] !== d)) note = `Simplest form is ${n}/${d}.`;
        else if (!m && !/\//.test(raw)) note = `As a fraction: ${n}/${d}.`;
      }
    }
  } catch (e) { setFeedback('hint', "I can't read that answer — " + (e.message === '=' ? 'just type the number.' : e.message)); sfx.error(); return; }
  const st = s.stats[p.topic] = s.stats[p.topic] || { tries: 0, right: 0 };
  if (P.tries === 0) st.tries++;
  if (ok) {
    P.over = true;
    if (P.tries === 0) st.right++;
    const gain = P.tries === 0 && !P.hinted ? s.level + 1 : 1;
    s.stars += gain; s.right++; s.streak++; s.best = Math.max(s.best, s.streak);
    const cheers = ['Correct! 🌟', 'Nailed it! ✨', 'Yes! Great work! 🎉', 'A+ answer! 🍎', 'Perfect! 💯', 'You got it! 🙌'];
    setFeedback('good', `${cheers[Math.floor(Math.random() * cheers.length)]} <small>+${gain}⭐</small>${note ? `<br><small>${esc(note)}</small>` : ''}`);
    sfx.right();
    if (s.streak % 5 === 0) { setTimeout(() => { sfx.bell(); sfx.star(); }, 450); confetti(); setFeedback('good', `🔥 ${s.streak} in a row! You're on fire! <small>+${gain}⭐</small>`); }
    $('#showBtn').textContent = '📖 See the steps';
    bump('#sStars'); bump('#sStreak');
    explainProblem(false);
  } else {
    P.tries++; s.streak = 0;
    sfx.wrong();
    if (note) { setFeedback('hint', esc(note)); P.tries--; }
    else if (P.tries >= 2) { setFeedback('bad', `Not quite. The answer is <b>${answerHTML(P.sol)}</b> — look at the steps to see how →`); P.over = true; explainProblem(); $('#showBtn').textContent = '📖 See the steps'; }
    else setFeedback('bad', pick(['Not quite — try again! 💪', 'Close? Check your work and try again.', 'Hmm, not that one. One more try!']));
  }
  drawScores(); save(false);
}
const pick = a => a[Math.floor(Math.random() * a.length)];
function hint() {
  if (!P.sol) return;
  sfx.chalk(); P.hinted = true;
  const first = P.sol.steps[0];
  const tips = {
    add: 'Line the numbers up by place value and add the ones first. Carry when a column gets to 10 or more.',
    sub: 'Line them up and start with the ones. If the top digit is smaller, borrow from the next column.',
    mul: 'Break it apart: multiply by each digit, then add the rows.', div: 'Ask: how many times does the divisor fit? Use your times tables.',
    neg: 'Same signs → positive. Different signs → negative. Subtracting a negative = adding.',
    order: 'PEMDAS: Parentheses, Exponents, Multiply/Divide (left→right), Add/Subtract (left→right).',
    frac: 'For + and − you need the same bottom number. For ×, go straight across. For ÷, keep-change-flip.',
    dec: 'Line up the decimal points. When multiplying, count the digits after the points.',
    pct: '"Percent" means out of 100, and "of" means multiply. 10% is the number ÷ 10.',
    pow: 'An exponent says how many times to multiply the number by itself. √ asks what times itself gives this.',
    eq: 'Do the opposite to both sides. Undo + and − first, then × and ÷.',
    quad: 'Find two numbers that multiply to the last number and add to the middle number.',
  };
  setFeedback('hint', `💡 First step: <b>${esc(first.rule)}</b>.<br><small>${esc(tips[P.prob.topic])}</small>`);
}
function giveUp() {
  S.school.streak = 0; P.over = true;
  const st = S.school.stats[P.prob.topic] = S.school.stats[P.prob.topic] || { tries: 0, right: 0 };
  if (P.tries === 0) st.tries++;
  setFeedback('hint', `The answer is <b>${answerHTML(P.sol)}</b>. Read the steps, then try the next one!`);
  $('#showBtn').textContent = '📖 See the steps';
  explainProblem(); drawScores();
}
function explainProblem(sound = true) { renderExplain($('#pSteps'), P.sol, { sound }); }
function bump(sel) { const el = $(sel).parentElement; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
function grade(st) { if (!st || !st.tries) return '—'; const p = st.right / st.tries; return p >= .9 ? 'A' : p >= .8 ? 'B' : p >= .7 ? 'C' : p >= .6 ? 'D' : 'F'; }
function drawScores() {
  const s = S.school;
  $('#sStars').textContent = s.stars; $('#sStreak').textContent = s.streak; $('#sBest').textContent = s.best; $('#sRight').textContent = s.right;
  $$('.gr8').forEach(g => { const v = grade(s.stats[g.dataset.g]); g.textContent = v === '—' ? '' : v; g.style.display = v === '—' ? 'none' : ''; });
}
function openReport() {
  sfx.page();
  const s = S.school;
  let rows = '<tr><th>Subject</th><th>Right</th><th>Tried</th><th class="g">Grade</th></tr>';
  let tot = 0, right = 0;
  for (const t of TOPICS) {
    const st = s.stats[t.id]; if (st) { tot += st.tries; right += st.right; }
    rows += `<tr><td>${t.icon} ${t.name}</td><td>${st?.right ?? 0}</td><td>${st?.tries ?? 0}</td><td class="g">${grade(st)}</td></tr>`;
  }
  $('#rcTable').innerHTML = rows;
  const p = tot ? right / tot : 0;
  $('#rcNote').textContent = !tot ? 'No work turned in yet — pick a subject and give it a try!' : p >= .9 ? 'Outstanding work! Try a Hard level next.' : p >= .75 ? 'Great effort — keep practicing and you’ll be at the top of the class.' : p >= .5 ? 'Good progress. Use "Show me how" to learn from the ones you miss.' : 'Keep going! Every mistake is a chance to learn. Try Easy first and read the steps.';
  $('#report').hidden = false;
}
function confetti() {
  const box = $('#confetti'); const cols = ['#ff5a5f', '#ffd23f', '#3bceac', '#0ead69', '#4d96ff', '#b983ff'];
  for (let i = 0; i < 80; i++) {
    const c = document.createElement('i');
    c.style.left = Math.random() * 100 + 'vw'; c.style.background = cols[i % cols.length];
    c.style.animationDuration = 1.8 + Math.random() * 1.6 + 's'; c.style.animationDelay = Math.random() * .4 + 's';
    c.style.transform = `rotate(${Math.random() * 360}deg)`;
    box.appendChild(c); setTimeout(() => c.remove(), 4000);
  }
}

// ---------- tabs ----------
function show(view) {
  $$('.tab').forEach(t => t.classList.toggle('on', t.dataset.view === view));
  $$('.view').forEach(v => v.classList.toggle('on', v.id === 'view-' + view));
  if (view === 'practice') { if (!P.prob) newProblem(); else if (matchMedia('(pointer: fine)').matches) $('#ans').focus(); }
  S.view = view;
}
$$('.tab').forEach(t => t.onclick = () => { sfx.click(); startMusicIfWanted(); if (t.dataset.view === 'practice' && !$('#view-practice').classList.contains('on')) sfx.bell(); show(t.dataset.view); });
window.MH = { show };

// ---------- radio ----------
function drawRadio() {
  $('#trackName').textContent = TRACKS[radio.track].name;
  $('#rPlay').textContent = radio.playing ? '❚❚' : '▶';
  $('#radio').classList.toggle('playing', radio.playing);
  $('#sfxBtn').classList.toggle('off', !S.sfx);
}
radio.track = S.music.track || 0;
radio.onBeat = () => $$('#eq i').forEach(i => i.style.height = (3 + Math.random() * 11) + 'px');
let musicStarted = false;
function startMusicIfWanted() {
  if (musicStarted) return; musicStarted = true;
  audioCtx(); setMusicVolume(S.music.vol);
  if (S.music.on) { radio.play(S.music.track); drawRadio(); }
}
$('#rPlay').onclick = () => { musicStarted = true; audioCtx(); setMusicVolume(S.music.vol); if (radio.playing) { radio.stop(); S.music.on = false; } else { radio.play(); S.music.on = true; } drawRadio(); };
$('#rNext').onclick = () => { musicStarted = true; setMusicVolume(S.music.vol); radio.play(radio.track + 1); S.music = { ...S.music, on: true, track: radio.track }; drawRadio(); };
$('#rPrev').onclick = () => { musicStarted = true; setMusicVolume(S.music.vol); radio.play(radio.track - 1); S.music = { ...S.music, on: true, track: radio.track }; drawRadio(); };
$('#rVol').value = S.music.vol;
$('#rVol').oninput = e => { S.music.vol = +e.target.value; setMusicVolume(S.music.vol); };
$('#sfxBtn').onclick = () => { S.sfx = !S.sfx; setSfx(S.sfx); sfx.click(); drawRadio(); };
setSfx(S.sfx);
// Music plays by itself as soon as the app opens. Browsers only allow sound after the first click or key,
// so if it is held back, the radio shows a small "click anywhere" note and starts on the very first touch.
function unlockAudio() {
  const c = audioCtx(); if (!c) return;
  const waiting = c.state !== 'running';
  $('#radio').classList.toggle('waiting', waiting && radio.playing);
  if (!waiting) ['pointerdown', 'keydown', 'touchend', 'click'].forEach(ev => removeEventListener(ev, unlockAudio, true));
  else c.resume().then(() => { if (c.state === 'running') unlockAudio(); });
}
['pointerdown', 'keydown', 'touchend', 'click'].forEach(ev => addEventListener(ev, unlockAudio, true));

// ---------- start ----------
buildKeys(); buildPractice(); renderEmpty(); renderHistory(); drawLCD(); drawRadio(); drawScores();
if (params.get('topic')) S.school.topic = params.get('topic');
if (params.get('level')) S.school.level = +params.get('level');
show(params.get('view') || 'calc');
if (params.get('q')) runExample(params.get('q'));
startMusicIfWanted(); setTimeout(unlockAudio, 400);
window.__mh = { S, C, P, press, runExample, solve, newProblem, check, keyByAction };
