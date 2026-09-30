// Graph mode — a Desmos-style grapher on graph paper.
// Type y = 2x + 1, x^2 − 4, sin(x), x = 3, x^2 + y^2 = 25, y < x + 1 or a point (2, 3).
// Drag to move, scroll / pinch / buttons to zoom. Grey dots mark zeros, turning points, intercepts and
// where graphs cross — tap one to see its coordinates. The notebook explains each graph.
import { parse, evalNode, hasVar, fmt, clean, polyStr, MathError } from './math.js';

export const COLORS = ['#c74440', '#2d70b3', '#388c46', '#6042a6', '#fa7e19', '#000000', '#e05aa0', '#1f9a9a'];
const REL_RE = /(<=|>=|≤|≥|<|>|=)/;

/** Turns one typed line into something drawable. */
export function compile(src) {
  let s = String(src).trim().replace(/−/g, '-').replace(/×/g, '*').replace(/÷/g, '/');
  if (!s) return null;
  const pm = /^\(\s*([^,]+)\s*,\s*([^,]+)\s*\)$/.exec(s);
  if (pm) {
    const x = evalNode(parse(pm[1]), {}), y = evalNode(parse(pm[2]), {});
    if (!isFinite(x) || !isFinite(y)) throw new MathError('That point has something undefined in it.');
    return { type: 'point', x: clean(x), y: clean(y) };
  }
  const m = REL_RE.exec(s);
  let rel = '=', L, R;
  if (!m) { R = parse(s); if (hasVar(R, 'y')) throw new MathError('Add an = sign, like x² + y² = 25.'); L = { t: 'var', name: 'y' }; }
  else {
    rel = { '<=': '≤', '>=': '≥' }[m[1]] || m[1];
    const a = s.slice(0, m.index), b = s.slice(m.index + m[1].length);
    if (REL_RE.test(b)) throw new MathError('Use just one = or < sign per line.');
    if (!a.trim() || !b.trim()) throw new MathError('Put something on both sides.');
    L = parse(a); R = parse(b);
  }
  const isY = n => n.t === 'var' && n.name === 'y', isX = n => n.t === 'var' && !n.name;
  const flip = { '<': '>', '>': '<', '≤': '≥', '≥': '≤', '=': '=' };
  const ctx = { deg: false };
  if (isY(L) && !hasVar(R, 'y')) return { type: 'fx', rel, f: x => evalNode(R, ctx, x), tree: R };
  if (isY(R) && !hasVar(L, 'y')) return { type: 'fx', rel: flip[rel], f: x => evalNode(L, ctx, x), tree: L };
  if (isX(L) && !hasVar(R, 'x')) return { type: 'fy', rel, f: y => evalNode(R, { ...ctx, yv: y }, 0), tree: R };
  if (isX(R) && !hasVar(L, 'x')) return { type: 'fy', rel: flip[rel], f: y => evalNode(L, { ...ctx, yv: y }, 0), tree: L };
  return { type: 'implicit', rel, F: (x, y) => evalNode(L, { ...ctx, yv: y }, x) - evalNode(R, { ...ctx, yv: y }, x) };
}

// ---------- analysis ----------
function bisect(f, a, b) { let fa = f(a); for (let i = 0; i < 60; i++) { const m = (a + b) / 2, fm = f(m); if ((fa <= 0) === (fm <= 0)) { a = m; fa = fm; } else b = m; } return (a + b) / 2; }
function zerosOf(f, x0, x1, n = 800) {
  const out = []; let px = x0, pv = f(x0);
  for (let i = 1; i <= n; i++) {
    const x = x0 + (x1 - x0) * i / n, v = f(x);
    if (isFinite(v) && isFinite(pv)) {
      if (v === 0) out.push(x);
      else if (pv * v < 0) { const r = bisect(f, px, x); if (Math.abs(f(r)) < 1e-6 * Math.max(1, Math.abs(f(px)) + Math.abs(f(x)))) out.push(r); }
    }
    px = x; pv = v;
  }
  return dedupe(out, (x1 - x0) / n * 2);
}
const dedupe = (a, eps) => a.filter((v, i) => !a.slice(0, i).some(w => Math.abs(w - v) < eps));
function turnsOf(f, x0, x1) {
  const h = (x1 - x0) / 4000, d = x => (f(x + h) - f(x - h)) / (2 * h);
  return zerosOf(d, x0, x1, 600).filter(x => isFinite(f(x)) && Math.abs(d(x - 10 * h) - d(x + 10 * h)) > 1e-9).map(x => ({ x, y: f(x), kind: d(x - 20 * h) < 0 ? 'min' : 'max' }));
}
function polyFit(f) {
  const c = f(0), p = f(1), q = f(-1), a = (p + q) / 2 - c, b = (p - q) / 2;
  for (const x of [2, -3, 0.5, 7]) { const w = a * x * x + b * x + c, g = f(x); if (!isFinite(g) || Math.abs(g - w) > 1e-7 * Math.max(1, Math.abs(w))) return null; }
  return { a: clean(a), b: clean(b), c: clean(c) };
}
function conicFit(F) {
  const E = F(0, 0), A = (F(1, 0) + F(-1, 0)) / 2 - E, C = (F(1, 0) - F(-1, 0)) / 2, B = (F(0, 1) + F(0, -1)) / 2 - E, D = (F(0, 1) - F(0, -1)) / 2;
  const XY = F(1, 1) - (A + B + C + D + E);
  for (const [x, y] of [[2, 3], [-1.5, 2], [3, -2]]) { const w = A * x * x + B * y * y + XY * x * y + C * x + D * y + E, g = F(x, y); if (!isFinite(g) || Math.abs(g - w) > 1e-7 * Math.max(1, Math.abs(w))) return null; }
  return { A: clean(A), B: clean(B), XY: clean(XY), C: clean(C), D: clean(D), E: clean(E) };
}
const P = (x, y) => `(${fmt(clean(x))}, ${fmt(clean(y))})`;

/** Teacher notes about one graph (and pairs of points / crossings), for the notebook. */
export function explain(items, view) {
  const steps = [];
  const [x0, x1] = [view.x0, view.x1];
  items.forEach(it => {
    const c = it.c, name = it.src.trim();
    if (!c) return;
    if (c.type === 'point') { steps.push({ rule: `Point ${name}`, text: `Start at the middle (0, 0). Go ${fmt(Math.abs(c.x))} ${c.x < 0 ? 'left' : 'right'}, then ${fmt(Math.abs(c.y))} ${c.y < 0 ? 'down' : 'up'}. ${c.x === 0 || c.y === 0 ? 'It sits on an axis.' : `It is in quadrant ${c.x > 0 ? (c.y > 0 ? 'I' : 'IV') : (c.y > 0 ? 'II' : 'III')}.`}`, before: P(c.x, c.y) }); return; }
    if (c.type === 'fx') {
      const p = polyFit(c.f);
      const ineq = c.rel !== '=' ? ` The ${c.rel === '<' || c.rel === '≤' ? 'shaded part BELOW' : 'shaded part ABOVE'} the line is where it's true${c.rel === '<' || c.rel === '>' ? ' (dashed line = the line itself doesn’t count)' : ''}.` : '';
      if (p && p.a === 0) {
        const m = p.b, b = p.c;
        if (m === 0) steps.push({ rule: `Flat line: ${name}`, text: `y is always ${fmt(b)}, so it's a flat (horizontal) line. Its slope is 0.${ineq}`, before: `y = ${fmt(b)}` });
        else steps.push({ rule: `Straight line: ${name}`, text: `It's in the form y = mx + b. The slope m = ${fmt(m)}: for every 1 step right, it goes ${fmt(Math.abs(m))} ${m > 0 ? 'up' : 'down'} (rise over run). It crosses the y-axis at b = ${fmt(b)}, and the x-axis at x = ${fmt(clean(-b / m))}.${ineq}`, before: `y = ${polyStr({ b: m, c: b })}`, after: `slope ${fmt(m)}, y-intercept ${P(0, b)}, x-intercept ${P(-b / m, 0)}` });
        return;
      }
      if (p) {
        const h = clean(-p.b / (2 * p.a)), k = clean(p.a * h * h + p.b * h + p.c), D = p.b * p.b - 4 * p.a * p.c;
        const roots = D < 0 ? [] : D === 0 ? [h] : [(-p.b - Math.sqrt(D)) / (2 * p.a), (-p.b + Math.sqrt(D)) / (2 * p.a)].sort((u, v) => u - v);
        steps.push({ rule: `Parabola: ${name}`, text: `It has an x², so it's a U-shaped parabola that opens ${p.a > 0 ? 'UP (a is positive)' : 'DOWN (a is negative)'}. The vertex is at x = −b ÷ 2a = ${fmt(-p.b)} ÷ ${fmt(2 * p.a)} = ${fmt(h)}, and y there is ${fmt(k)}. The line of symmetry is x = ${fmt(h)}. ${roots.length ? `It crosses the x-axis at x = ${roots.map(r => fmt(clean(r))).join(' and x = ')}.` : 'It never touches the x-axis (no real roots).'} It crosses the y-axis at ${P(0, p.c)}.${ineq}`, before: `y = ${polyStr(p)}`, after: `vertex ${P(h, k)}` });
        return;
      }
      const z = zerosOf(c.f, x0, x1), t = turnsOf(c.f, x0, x1), y0 = c.f(0);
      steps.push({ rule: `Curve: ${name}`, text: `In the part you can see: ${z.length ? `it crosses the x-axis at x ≈ ${z.slice(0, 6).map(v => fmt(clean(+v.toFixed(4)))).join(', ')}` : 'it doesn’t cross the x-axis'}${t.length ? `; it turns around at ${t.slice(0, 4).map(q => `${P(+q.x.toFixed(4), +q.y.toFixed(4))} (${q.kind === 'min' ? 'lowest' : 'highest'} point nearby)`).join(', ')}` : ''}${isFinite(y0) ? `; it crosses the y-axis at ${P(0, y0)}` : ''}.${ineq}`, before: `y = ${name.replace(/^y\s*=\s*/, '')}` });
      return;
    }
    if (c.type === 'fy') { steps.push({ rule: `Sideways graph: ${name}`, text: `x is given by y, so the graph is drawn sideways. ${polyFit(c.f)?.a === 0 && polyFit(c.f)?.b === 0 ? `x is always ${fmt(c.f(0))}, so it's a straight up-and-down (vertical) line. Its slope is undefined.` : ''}`, before: name }); return; }
    const k = conicFit(c.F);
    if (k && k.XY === 0 && k.A !== 0 && Math.abs(k.A - k.B) < 1e-9) {
      const h = clean(-k.C / (2 * k.A)), v = clean(-k.D / (2 * k.A)), r2 = clean(h * h + v * v - k.E / k.A);
      if (r2 > 0) steps.push({ rule: `Circle: ${name}`, text: `x² and y² have the same number in front, so it's a circle. Written as (x − h)² + (y − k)² = r², the center is ${P(h, v)} and r² = ${fmt(r2)}, so the radius is ${fmt(clean(Math.sqrt(r2)))}. Its area is πr² ≈ ${fmt(clean(Math.PI * r2))} and it's ${fmt(clean(2 * Math.PI * Math.sqrt(r2)))} around.`, before: `center ${P(h, v)}, radius ${fmt(clean(Math.sqrt(r2)))}` });
      else steps.push({ rule: `No picture: ${name}`, text: 'This would be a circle with a radius of zero or less, so there are no points to draw.', before: name });
    } else if (k && k.XY === 0 && k.A * k.B > 0) steps.push({ rule: `Ellipse: ${name}`, text: 'x² and y² both appear with the same sign but different numbers, so it is an oval (an ellipse).', before: name });
    else if (k && k.XY === 0 && k.A * k.B < 0) steps.push({ rule: `Hyperbola: ${name}`, text: 'x² and y² have opposite signs, so it is a hyperbola — two curves that bend away from each other.', before: name });
    else steps.push({ rule: `Equation in x and y: ${name}`, text: 'I drew every point (x, y) that makes this true.', before: name });
  });
  // two points: distance, midpoint, slope
  const pts = items.filter(i => i.c?.type === 'point').map(i => i.c);
  if (pts.length >= 2) {
    const [A, B] = pts, dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy);
    steps.push({ rule: 'Distance between the first two points', text: `Use Pythagoras: across ${fmt(clean(dx))}, up ${fmt(clean(dy))}. d = √(${fmt(clean(dx))}² + ${fmt(clean(dy))}²) = √${fmt(clean(dx * dx + dy * dy))} ≈ ${fmt(clean(d))}.`, before: `d ≈ ${fmt(clean(d))}` });
    steps.push({ rule: 'Midpoint', text: `Average the x's and the y's: ((${fmt(A.x)} + ${fmt(B.x)}) ÷ 2, (${fmt(A.y)} + ${fmt(B.y)}) ÷ 2).`, before: P((A.x + B.x) / 2, (A.y + B.y) / 2) });
    if (dx !== 0) { const m = clean(dy / dx), b = clean(A.y - m * A.x); steps.push({ rule: 'Line through them', text: `Slope = rise ÷ run = ${fmt(clean(dy))} ÷ ${fmt(clean(dx))} = ${fmt(m)}. Then b = y − mx = ${fmt(A.y)} − ${fmt(m)}·${fmt(A.x)} = ${fmt(b)}.`, before: `y = ${polyStr({ b: m, c: b })}` }); }
    else steps.push({ rule: 'Line through them', text: 'Both points have the same x, so the line is vertical.', before: `x = ${fmt(A.x)}` });
  }
  const fx = items.filter(i => i.c?.type === 'fx' && i.c.rel === '=');
  for (let i = 0; i < fx.length; i++) for (let j = i + 1; j < fx.length; j++) {
    const f = x => fx[i].c.f(x) - fx[j].c.f(x), z = zerosOf(f, x0, x1);
    steps.push({ rule: `Where ${fx[i].src.trim()} and ${fx[j].src.trim()} cross`, text: z.length ? `Set them equal and solve (or look where the lines meet): ${z.slice(0, 5).map(x => P(+x.toFixed(4), +fx[i].c.f(x).toFixed(4))).join(', ')}.` : 'They don’t cross in the part you can see.', before: z.length ? z.slice(0, 3).map(x => P(+x.toFixed(4), +fx[i].c.f(x).toFixed(4))).join('  ') : 'no crossing here' });
  }
  return steps;
}

// ---------- the drawing ----------
export function initGraph({ onChange }) {
  const $ = s => document.querySelector(s);
  const cv = $('#graphCv'), box = $('#graphBox'), g = cv.getContext('2d');
  const V = { cx: 0, cy: 0, s: 40 };   // center and pixels per unit
  let W = 0, H = 0, dpr = 1, items = [], marks = [], hover = null, pinned = new Set();
  const X = x => (x - V.cx) * V.s + W / 2, Y = y => H / 2 - (y - V.cy) * V.s;
  const ux = px => (px - W / 2) / V.s + V.cx, uy = py => (H / 2 - py) / V.s + V.cy;
  const view = () => ({ x0: ux(0), x1: ux(W), y0: uy(H), y1: uy(0) });

  function size() {
    const r = box.getBoundingClientRect(); if (!r.width || !r.height) return;
    dpr = Math.min(devicePixelRatio || 1, 2); W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + 'px'; cv.style.height = H + 'px';
    draw();
  }
  new ResizeObserver(size).observe(box);

  function niceStep() { const raw = 80 / V.s, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p; return (m < 2 ? 1 : m < 5 ? 2 : 5) * p; }
  function grid() {
    const st = niceStep(), minor = st / (String(st)[0] === '2' ? 4 : 5), v = view();
    g.lineWidth = 1;
    for (const [step, col] of [[minor, '#e8eef5'], [st, '#c9d6e4']]) {
      g.strokeStyle = col; g.beginPath();
      for (let x = Math.ceil(v.x0 / step) * step; x <= v.x1; x += step) { const px = Math.round(X(x)) + 0.5; g.moveTo(px, 0); g.lineTo(px, H); }
      for (let y = Math.ceil(v.y0 / step) * step; y <= v.y1; y += step) { const py = Math.round(Y(y)) + 0.5; g.moveTo(0, py); g.lineTo(W, py); }
      g.stroke();
    }
    // axes
    g.strokeStyle = '#2b2f36'; g.lineWidth = 1.6; g.beginPath();
    const ax = Math.round(X(0)) + 0.5, ay = Math.round(Y(0)) + 0.5;
    g.moveTo(0, ay); g.lineTo(W, ay); g.moveTo(ax, 0); g.lineTo(ax, H); g.stroke();
    g.fillStyle = '#2b2f36';
    g.beginPath(); g.moveTo(W - 2, ay); g.lineTo(W - 12, ay - 5); g.lineTo(W - 12, ay + 5); g.fill();
    g.beginPath(); g.moveTo(ax, 2); g.lineTo(ax - 5, 12); g.lineTo(ax + 5, 12); g.fill();
    g.font = 'italic 15px Georgia, serif'; g.fillText('x', W - 16, ay - 10); g.fillText('y', ax + 9, 16);
    // numbers
    g.font = '12px -apple-system, Helvetica, Arial, sans-serif'; g.fillStyle = '#4a5568';
    const lab = v => fmt(clean(v)).replace(' × 10^', 'e');
    const ly = Math.min(H - 6, Math.max(14, ay + 15)), lx = Math.min(W - 6, Math.max(6, ax - 6));
    g.textAlign = 'center';
    for (let x = Math.ceil(v.x0 / st) * st; x <= v.x1; x += st) if (Math.abs(x) > st / 2) { g.fillStyle = 'rgba(255,255,255,.85)'; const t = lab(x), w = g.measureText(t).width; g.fillRect(X(x) - w / 2 - 2, ly - 11, w + 4, 14); g.fillStyle = '#4a5568'; g.fillText(t, X(x), ly); }
    g.textAlign = ax - 6 < 30 ? 'left' : 'right';
    const lx2 = ax - 6 < 30 ? Math.max(4, ax + 6) : lx;
    for (let y = Math.ceil(v.y0 / st) * st; y <= v.y1; y += st) if (Math.abs(y) > st / 2) { g.fillStyle = 'rgba(255,255,255,.85)'; const t = lab(y), w = g.measureText(t).width; g.fillRect(g.textAlign === 'right' ? lx2 - w - 2 : lx2 - 2, Y(y) - 8, w + 4, 14); g.fillStyle = '#4a5568'; g.fillText(t, lx2, Y(y) + 4); }
    g.textAlign = 'right'; g.fillText('0', ax - 5, ay + 15); g.textAlign = 'left';
  }
  function curveFx(f, col, dashed) {
    g.strokeStyle = col; g.lineWidth = 2.6; g.setLineDash(dashed ? [8, 6] : []); g.beginPath();
    let pen = false, py = 0;
    for (let px = -1; px <= W + 1; px += 0.5) {
      const y = f(ux(px)), sy = Y(y);
      if (!isFinite(y) || Math.abs(sy) > 1e5) { pen = false; continue; }
      if (pen && Math.abs(sy - py) > H * 1.5) pen = false;
      pen ? g.lineTo(px, sy) : g.moveTo(px, sy); pen = true; py = sy;
    }
    g.stroke(); g.setLineDash([]);
  }
  function curveFy(f, col, dashed) {
    g.strokeStyle = col; g.lineWidth = 2.6; g.setLineDash(dashed ? [8, 6] : []); g.beginPath();
    let pen = false, pxl = 0;
    for (let py = -1; py <= H + 1; py += 0.5) {
      const x = f(uy(py)), sx = X(x);
      if (!isFinite(x) || Math.abs(sx) > 1e5) { pen = false; continue; }
      if (pen && Math.abs(sx - pxl) > W * 1.5) pen = false;
      pen ? g.lineTo(sx, py) : g.moveTo(sx, py); pen = true; pxl = sx;
    }
    g.stroke(); g.setLineDash([]);
  }
  function implicit(F, col, rel) {
    const cs = 5, nx = Math.ceil(W / cs) + 1, ny = Math.ceil(H / cs) + 1, val = new Float64Array(nx * ny);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) val[j * nx + i] = F(ux(i * cs), uy(j * cs));
    if (rel !== '=') {
      g.fillStyle = col + '2e';
      const ok = v => rel === '<' ? v < 0 : rel === '>' ? v > 0 : rel === '≤' ? v <= 0 : v >= 0;
      for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) { const v = val[j * nx + i]; if (isFinite(v) && ok(v)) g.fillRect(i * cs, j * cs, cs, cs); }
    }
    g.strokeStyle = col; g.lineWidth = 2.6; g.setLineDash(rel === '<' || rel === '>' ? [8, 6] : []); g.beginPath();
    const lerp = (a, b) => a / (a - b);
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const a = val[j * nx + i], b = val[j * nx + i + 1], c = val[(j + 1) * nx + i + 1], d = val[(j + 1) * nx + i];
      if (![a, b, c, d].every(isFinite)) continue;
      const pts = [];
      if ((a < 0) !== (b < 0)) pts.push([(i + lerp(a, b)) * cs, j * cs]);
      if ((b < 0) !== (c < 0)) pts.push([(i + 1) * cs, (j + lerp(b, c)) * cs]);
      if ((d < 0) !== (c < 0)) pts.push([(i + lerp(d, c)) * cs, (j + 1) * cs]);
      if ((a < 0) !== (d < 0)) pts.push([i * cs, (j + lerp(a, d)) * cs]);
      const big = Math.max(Math.abs(a), Math.abs(b), Math.abs(c), Math.abs(d));
      if (big > 1e3 * (Math.abs(a - c) + Math.abs(b - d) + 1e-9) * 0 + 1e6) continue;   // skip poles
      if (pts.length >= 2) { g.moveTo(...pts[0]); g.lineTo(...pts[1]); if (pts.length === 4) { g.moveTo(...pts[2]); g.lineTo(...pts[3]); } }
    }
    g.stroke(); g.setLineDash([]);
  }
  function shadeFx(f, col, rel) {
    g.fillStyle = col + '2e'; g.beginPath();
    const below = rel === '<' || rel === '≤';
    g.moveTo(-1, below ? H + 1 : -1);
    for (let px = -1; px <= W + 1; px += 2) { let y = Y(f(ux(px))); if (!isFinite(y)) y = below ? -1 : H + 1; g.lineTo(px, Math.max(-5, Math.min(H + 5, y))); }
    g.lineTo(W + 1, below ? H + 1 : -1); g.closePath(); g.fill();
  }
  function findMarks() {
    marks = []; const v = view();
    const fx = items.filter(i => i.c?.type === 'fx');
    for (const it of fx) {
      for (const x of zerosOf(it.c.f, v.x0, v.x1)) marks.push({ x, y: 0, what: 'crosses the x-axis', col: it.col });
      for (const t of turnsOf(it.c.f, v.x0, v.x1)) if (t.y > v.y0 && t.y < v.y1) marks.push({ x: t.x, y: t.y, what: t.kind === 'min' ? 'lowest point' : 'highest point', col: it.col });
      const y0 = it.c.f(0); if (isFinite(y0) && Math.abs(y0) > 1e-12 && y0 > v.y0 && y0 < v.y1) marks.push({ x: 0, y: y0, what: 'crosses the y-axis', col: it.col });
    }
    for (let i = 0; i < fx.length; i++) for (let j = i + 1; j < fx.length; j++) {
      const f = x => fx[i].c.f(x) - fx[j].c.f(x);
      for (const x of zerosOf(f, v.x0, v.x1)) marks.push({ x, y: fx[i].c.f(x), what: 'the graphs cross', col: '#555' });
    }
    marks = marks.filter(m => isFinite(m.y)).map(m => ({ ...m, x: clean(+m.x.toFixed(6)), y: clean(+m.y.toFixed(6)) }));
  }
  function label(x, y, text, col) {
    g.font = '600 14px -apple-system, Helvetica, Arial, sans-serif';
    const w = g.measureText(text).width, bx = Math.min(W - w - 14, X(x) + 10), by = Math.max(24, Y(y) - 12);
    g.fillStyle = 'rgba(255,255,255,.95)'; g.strokeStyle = col; g.lineWidth = 1.5;
    g.beginPath(); g.roundRect(bx - 6, by - 17, w + 12, 24, 6); g.fill(); g.stroke();
    g.fillStyle = '#1f2a44'; g.fillText(text, bx, by);
  }
  function draw() {
    if (!W) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#fdfdfb'; g.fillRect(0, 0, W, H);
    grid();
    for (const it of items) {
      const c = it.c; if (!c || it.hidden) continue;
      try {
        if (c.type === 'fx') { if (c.rel !== '=') shadeFx(c.f, it.col, c.rel); curveFx(c.f, it.col, c.rel === '<' || c.rel === '>'); }
        else if (c.type === 'fy') curveFy(c.f, it.col, false);
        else if (c.type === 'implicit') implicit(c.F, it.col, c.rel);
      } catch { }
    }
    for (const m of marks) { g.fillStyle = '#fff'; g.strokeStyle = '#7b8494'; g.lineWidth = 2; g.beginPath(); g.arc(X(m.x), Y(m.y), 4.5, 0, 7); g.fill(); g.stroke(); }
    for (const it of items) if (it.c?.type === 'point' && !it.hidden) { g.fillStyle = it.col; g.beginPath(); g.arc(X(it.c.x), Y(it.c.y), 6, 0, 7); g.fill(); label(it.c.x, it.c.y, P(it.c.x, it.c.y), it.col); }
    for (const k of pinned) { const m = marks[k]; if (m) label(m.x, m.y, P(m.x, m.y), m.col); }
    if (hover) {
      g.strokeStyle = hover.col; g.lineWidth = 2; g.fillStyle = hover.col;
      g.beginPath(); g.arc(X(hover.x), Y(hover.y), 5, 0, 7); g.fill();
      label(hover.x, hover.y, (hover.what ? hover.what + ' ' : '') + P(+hover.x.toFixed(4), +hover.y.toFixed(4)), hover.col);
    }
  }
  let markTimer = null;
  function redraw(recalc = true) { if (recalc) { clearTimeout(markTimer); markTimer = setTimeout(() => { findMarks(); draw(); }, 120); } draw(); }

  // pan / zoom / trace
  let drag = null; const ptrs = new Map();
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.offsetX, e.offsetY]); drag = { x: e.offsetX, y: e.offsetY, cx: V.cx, cy: V.cy, moved: false }; if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; drag.pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), s: V.s }; } });
  cv.addEventListener('pointermove', e => {
    if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, [e.offsetX, e.offsetY]);
    if (drag && ptrs.size === 2 && drag.pinch) { const [a, b] = [...ptrs.values()]; V.s = Math.max(0.5, Math.min(5e4, drag.pinch.s * Math.hypot(a[0] - b[0], a[1] - b[1]) / drag.pinch.d)); drag.moved = true; redraw(); return; }
    if (drag && ptrs.size === 1) {
      const dx = e.offsetX - drag.x, dy = e.offsetY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      if (drag.moved) { V.cx = drag.cx - dx / V.s; V.cy = drag.cy + dy / V.s; hover = null; redraw(); return; }
    }
    // hover: snap to a mark, else trace the nearest curve
    const mx = e.offsetX, my = e.offsetY;
    let best = null, bd = 14;
    marks.forEach((m, k) => { const d = Math.hypot(X(m.x) - mx, Y(m.y) - my); if (d < bd) { bd = d; best = { ...m, k }; } });
    if (!best) for (const it of items) if (it.c?.type === 'fx' && !it.hidden) { const y = it.c.f(ux(mx)); if (isFinite(y) && Math.abs(Y(y) - my) < 12) { best = { x: ux(mx), y, col: it.col }; break; } }
    hover = best; draw();
  });
  const end = e => { ptrs.delete(e.pointerId); if (drag && !drag.moved && hover?.k != null) { pinned.has(hover.k) ? pinned.delete(hover.k) : pinned.add(hover.k); draw(); } if (ptrs.size === 0) { if (drag?.moved) onChange(); drag = null; } };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  cv.addEventListener('pointerleave', () => { hover = null; draw(); });
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    const k = Math.exp(-e.deltaY * 0.0015), bx = ux(e.offsetX), by = uy(e.offsetY);
    V.s = Math.max(0.5, Math.min(5e4, V.s * k)); V.cx = bx - (e.offsetX - W / 2) / V.s; V.cy = by + (e.offsetY - H / 2) / V.s;
    pinned.clear(); redraw(); clearTimeout(zoomT); zoomT = setTimeout(onChange, 300);
  }, { passive: false });
  let zoomT = null;
  const zoom = k => { V.s = Math.max(0.5, Math.min(5e4, V.s * k)); pinned.clear(); redraw(); onChange(); };
  $('#gZoomIn').onclick = () => zoom(1.5); $('#gZoomOut').onclick = () => zoom(1 / 1.5);
  $('#gHome').onclick = () => { V.cx = 0; V.cy = 0; V.s = Math.min(W, H) / 22; pinned.clear(); redraw(); onChange(); };

  size();
  V.s = Math.max(20, Math.min(W, H) / 22 || 40);
  return {
    size, view, V,
    set(list) { items = list; pinned.clear(); redraw(); },
    redraw,
  };
}
