// Draw mode: write a problem by hand on graph paper. When you stop for 10 seconds it reads your writing,
// writes the answer next to it in red pencil, and the notebook shows every step.
import { recognize } from './ink.js';
import { sfx, pencilLoop } from './audio.js';

export const WAIT = 10;   // seconds of no drawing before it answers

export function initDraw({ solve, onAnswer, onError, toCalc, ctx }) {
  const $ = s => document.querySelector(s);
  const cv = $('#drawCv'), paper = $('#drawPaper'), g = cv.getContext('2d');
  const D = { strokes: [], cur: null, tool: 'pen', timer: null, t0: 0, ink: null, inkT: 0, last: null, lastT: 0, rec: null };
  let W = 0, H = 0, dpr = 1;

  function size() {
    const r = paper.getBoundingClientRect();
    if (!r.width || !r.height) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2); W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    redraw();
  }
  new ResizeObserver(size).observe(paper);

  function pathStroke(s) {
    const p = s.pts;
    g.beginPath();
    if (p.length === 1) { g.arc(p[0][0], p[0][1], 2.2, 0, Math.PI * 2); g.fillStyle = g.strokeStyle; g.fill(); return; }
    g.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length - 1; i++) { const mx = (p[i][0] + p[i + 1][0]) / 2, my = (p[i][1] + p[i + 1][1]) / 2; g.quadraticCurveTo(p[i][0], p[i][1], mx, my); }
    g.lineTo(p[p.length - 1][0], p[p.length - 1][1]);
    g.stroke();
  }
  function pencilStyle() { g.strokeStyle = 'rgba(40, 40, 48, 0.92)'; g.lineWidth = 3.6; g.lineCap = g.lineJoin = 'round'; }
  function redraw() {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    pencilStyle();
    for (const s of D.strokes) pathStroke(s);
    if (D.cur) pathStroke(D.cur);
    if (D.ink) drawInk();
    $('#drawHint').style.opacity = D.strokes.length || D.cur ? 0 : 1;
  }

  // the answer, written in red pencil next to (or under) the problem
  function drawInk() {
    const k = Math.min(1, (performance.now() - D.inkT) / 900);
    const { text, x, y, size: sz } = D.ink;
    g.save();
    g.font = `${sz}px Noteworthy, "Patrick Hand", "Comic Sans MS", cursive`;
    const w = g.measureText(text).width;
    g.beginPath(); g.rect(x - 4, y - sz, (w + 8) * k, sz * 1.6); g.clip();
    g.fillStyle = '#d2453c'; g.textBaseline = 'alphabetic';
    g.fillText(text, x, y);
    g.strokeStyle = 'rgba(210, 69, 60, .7)'; g.lineWidth = 2.5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x - 6, y + sz * 0.22); g.quadraticCurveTo(x + w / 2, y + sz * 0.3, x + w + 6, y + sz * 0.16); g.stroke();
    g.restore();
    if (k < 1) requestAnimationFrame(redraw);
  }
  function placeInk(text) {
    const pts = D.strokes.flatMap(s => s.pts);
    const minX = Math.min(...pts.map(p => p[0])), maxX = Math.max(...pts.map(p => p[0]));
    const minY = Math.min(...pts.map(p => p[1])), maxY = Math.max(...pts.map(p => p[1]));
    const h = Math.max(30, Math.min(90, (D.rec?.H || maxY - minY) * 0.9));
    g.font = `${h}px Noteworthy, "Patrick Hand", cursive`;
    const w = g.measureText(text).width;
    let x = maxX + h * 0.4, y = (minY + maxY) / 2 + h * 0.35;
    if (x + w > W - 12) { x = Math.max(12, minX); y = maxY + h * 1.25; }      // no room on the right: write it underneath
    if (y > H - 10) y = H - 10;
    D.ink = { text, x, y, size: h }; D.inkT = performance.now();
    redraw(); sfx.pencil(0.9);
  }

  // ---- timer ----
  const ring = $('#dRing'), secs = $('#dSecs'), C = 2 * Math.PI * 15;
  ring.style.strokeDasharray = C;
  function setRing(left) { ring.style.strokeDashoffset = C * (1 - left / WAIT); secs.textContent = Math.ceil(left); $('#dTimer').classList.toggle('on', left < WAIT); }
  setRing(WAIT);
  function startWait() {
    stopWait();
    if (!D.strokes.length) return;
    D.t0 = performance.now();
    status(`I'll answer in ${WAIT} seconds — or keep writing`);
    const tick = () => {
      const left = WAIT - (performance.now() - D.t0) / 1000;
      if (left <= 0) { setRing(0); D.timer = null; answer(); return; }
      setRing(left); D.timer = requestAnimationFrame(tick);
    };
    D.timer = requestAnimationFrame(tick);
  }
  function stopWait() { if (D.timer) cancelAnimationFrame(D.timer); D.timer = null; setRing(WAIT); }
  function status(t) { $('#dStatus').textContent = t; $('#dStatus').classList.toggle('on', !!t); }

  function answer() {
    stopWait();
    if (!D.strokes.length) { status('Write something first ✏️'); return; }
    let rec;
    try { rec = recognize(D.strokes); } catch (e) { console.error(e); rec = { text: '' }; }
    D.rec = rec;
    $('#dRead').textContent = rec.text || '?';
    if (!rec.text) { status(''); onError('', "I couldn't read anything there. Try writing a bit bigger."); return; }
    try {
      const r = solve(rec.text, ctx());
      status('');
      const txt = r.kind === 'expr' || r.kind === 'frac' ? '= ' + (r.frac && r.kind === 'frac' ? `${r.frac[0]}/${r.frac[1]}` : r.lcd) : r.kind === 'check' ? (r.ok ? '✔ true' : '✘ false') : r.answer.replace(/<[^>]+>/g, '');
      placeInk(txt);
      onAnswer(r, rec.text);
    } catch (e) {
      status('');
      onError(rec.text, e.message === '=' ? 'Put just one = sign, with something on both sides.' : e.message);
      sfx.error();
    }
  }

  // ---- pen / eraser ----
  const pos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  function eraseAt(p) {
    const before = D.strokes.length;
    D.strokes = D.strokes.filter(s => !s.pts.some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < 14));
    if (D.strokes.length !== before) { D.ink = null; sfx.clear(); redraw(); }
  }
  cv.addEventListener('pointerdown', e => {
    e.preventDefault(); cv.setPointerCapture(e.pointerId);
    stopWait(); status('');
    if (D.ink) { D.ink = null; }
    const p = pos(e);
    if (D.tool === 'erase') { D.erasing = true; eraseAt(p); return; }
    D.cur = { pts: [p] }; D.last = p; D.lastT = performance.now();
    pencilLoop.start(); redraw();
  });
  cv.addEventListener('pointermove', e => {
    if (D.erasing) { eraseAt(pos(e)); return; }
    if (!D.cur) return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of evs) {
      const p = pos(ev), l = D.cur.pts[D.cur.pts.length - 1];
      if (Math.hypot(p[0] - l[0], p[1] - l[1]) > 1.2) D.cur.pts.push(p);
    }
    const p = pos(e), now = performance.now(), dt = Math.max(1, now - D.lastT);
    pencilLoop.speed(Math.hypot(p[0] - D.last[0], p[1] - D.last[1]) / dt * 16);
    D.last = p; D.lastT = now;
    redraw();
  });
  const up = () => {
    if (D.erasing) { D.erasing = false; startWait(); return; }
    if (!D.cur) return;
    D.strokes.push(D.cur); D.cur = null; pencilLoop.stop(); redraw(); startWait();
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('touchmove', e => e.preventDefault(), { passive: false });

  const setTool = t => { D.tool = t; $('#dPen').classList.toggle('on', t === 'pen'); $('#dErase').classList.toggle('on', t === 'erase'); paper.classList.toggle('erasing', t === 'erase'); sfx.click(); };
  $('#dPen').onclick = () => setTool('pen');
  $('#dErase').onclick = () => setTool('erase');
  $('#dUndo').onclick = () => { D.strokes.pop(); D.ink = null; sfx.clear(); redraw(); D.strokes.length ? startWait() : stopWait(); };
  $('#dClear').onclick = () => { D.strokes = []; D.ink = null; D.rec = null; $('#dRead').textContent = '—'; stopWait(); status(''); sfx.page(); redraw(); };
  $('#dNow').onclick = () => { sfx.key('eq'); answer(); };
  $('#dToCalc').onclick = () => { if (D.rec?.text) toCalc(D.rec.text); };
  size();
  return { size, D, answer, redraw };
}
