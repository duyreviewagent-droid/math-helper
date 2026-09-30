// Reads handwriting. Strokes → symbols → a problem the calculator understands.
// Digits go through the little neural network (digitnet.js). The math signs are recognized by their shape:
// "−" is one flat line, "=" is two, "+" is flat + upright crossing, "×"/x is two crossing diagonals, "÷" is a line
// with dots, "(" ")" are bent upright strokes, a flat line with things above AND below is a fraction bar,
// "√" is a tick with a roof, and anything small and raised up after a number is an exponent.
import { predict } from './digitnet.js';

const bbox = pts => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of pts) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
};
const union = boxes => bbox(boxes.flatMap(b => [[b.minX, b.minY], [b.maxX, b.maxY]]));
const median = a => { const s = [...a].sort((p, q) => p - q); return s.length ? s[Math.floor(s.length / 2)] : 0; };

function shape(s) {
  const pts = s.pts, a = pts[0], b = pts[pts.length - 1];
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  let dev = 0, devI = 0, side = 0;
  pts.forEach((p, i) => {
    const d = ((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / L;   // signed distance to the chord
    if (Math.abs(d) > Math.abs(dev)) { dev = d; devI = i; }
  });
  let len = 0; for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  const ang = Math.atan2(-(b[1] - a[1]), b[0] - a[0]) * 180 / Math.PI;   // 0 = flat → right, 90 = straight up
  const bend = Math.abs(dev) / L;
  const mid = pts[devI];
  side = mid[0] < (a[0] + b[0]) / 2 ? -1 : 1;
  const bb = bbox(pts), devY = bb.h ? (mid[1] - bb.minY) / bb.h : 0.5;
  return { chord: L, len, dev, bend, devPos: devI / (pts.length - 1 || 1), devY, ang, side, straight: bend < 0.12 && len < L * 1.5 };
}
const lean = ang => { let a = ((ang % 180) + 180) % 180; return a; };   // 0..180
const isFlat = (s, H) => s.box.h < Math.max(0.28 * s.box.w, 0.12 * H) && s.box.w > 0.25 * H;
const isTiny = (b, H) => Math.max(b.w, b.h) < 0.22 * H;

/** Picture of a group of strokes as a 28×28 image, the way MNIST digits are drawn (20 px box, centred by weight). */
export function rasterize(strokes) {
  const b = union(strokes.map(s => s.box));
  const S = 20 / Math.max(b.w, b.h, 1);
  const cv = document.createElement('canvas'); cv.width = cv.height = 28;
  const g = cv.getContext('2d', { willReadFrequently: true });
  const draw = (ox, oy) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, 28, 28);
    g.strokeStyle = '#fff'; g.lineWidth = 2.3; g.lineCap = g.lineJoin = 'round';
    for (const s of strokes) {
      g.beginPath();
      s.pts.forEach(([x, y], i) => { const X = (x - b.cx) * S + 14 + ox, Y = (y - b.cy) * S + 14 + oy; i ? g.lineTo(X, Y) : g.moveTo(X, Y); });
      if (s.pts.length === 1) g.lineTo((s.pts[0][0] - b.cx) * S + 14.1 + ox, (s.pts[0][1] - b.cy) * S + 14 + oy);
      g.stroke();
    }
    return g.getImageData(0, 0, 28, 28).data;
  };
  let d = draw(0, 0), mx = 0, my = 0, m = 0;
  for (let i = 0; i < 784; i++) { const v = d[i * 4]; m += v; mx += v * (i % 28); my += v * Math.floor(i / 28); }
  if (m) d = draw(14 - mx / m - 0.5 + 0.5, 14 - my / m);
  const img = new Float32Array(784);
  for (let i = 0; i < 784; i++) img[i] = d[i * 4] / 255;
  return img;
}

function classify(g, H) {
  const ss = g.strokes, b = g.box, n = ss.length;
  if (isTiny(b, H)) return { ch: 'dot' };
  const flats = ss.filter(s => isFlat(s, H)), tinies = ss.filter(s => isTiny(s.box, H));
  if (n === 1 && flats.length === 1) return { ch: '−' };
  if (n === 2 && flats.length === 2) return { ch: '=' };
  if (n === 3 && flats.length === 1 && tinies.length === 2) return { ch: '÷' };
  if (n === 2 && tinies.length === 1 && flats.length === 1) return { ch: '÷' };
  if (n === 2) {
    const [p, q] = ss.map(shape);
    if (p.straight && q.straight) {
      const A = lean(p.ang), B = lean(q.ang);
      const horiz = a => a < 28 || a > 152, vert = a => a > 62 && a < 118, diag = a => (a > 22 && a < 70) || (a > 110 && a < 158);
      if ((horiz(A) && vert(B)) || (vert(A) && horiz(B))) return { ch: '+' };
      if (diag(A) && diag(B) && (A < 90) !== (B < 90)) return { ch: 'X' };
    }
  }
  if (n === 1) {
    const s = shape(ss[0]);
    if (b.h > 1.8 * b.w && b.h > 0.45 * H) {
      if (s.bend > 0.09 && s.devPos > 0.25 && s.devPos < 0.75 && s.devY > 0.25 && s.devY < 0.75 && s.len < s.chord * 1.6) return { ch: s.side < 0 ? '(' : ')' };
      if (s.straight) { const tilt = Math.abs(90 - lean(s.ang)); if (tilt < 13) return { ch: '1' }; if (lean(s.ang) < 90 && tilt < 60) return { ch: '/' }; }
    }
    if (s.straight && b.h > 0.4 * H) { const A = lean(s.ang); if (A > 30 && A < 72) return { ch: '/' }; }
  }
  const probs = predict(rasterize(ss));
  let best = 0; for (let k = 1; k < 10; k++) if (probs[k] > probs[best]) best = k;
  return { ch: String(best), conf: probs[best] };
}

function rootInfo(s, H) {
  const p = s.pts, b = s.box, n = p.length;
  if (n < 5 || b.w < 0.7 * H || b.h < 0.5 * H) return null;
  let iLow = 0; for (let i = 1; i < n; i++) if (p[i][1] > p[iLow][1]) iLow = i;
  if (iLow > 0.6 * n || iLow === 0) return null;
  let iTop = -1; for (let i = iLow; i < n; i++) if (p[i][1] <= b.minY + 0.22 * b.h) { iTop = i; break; }
  if (iTop < 0) return null;
  const end = p[n - 1];
  if (end[0] - p[iTop][0] < 0.35 * b.w || Math.abs(end[1] - p[iTop][1]) > 0.28 * b.h) return null;
  if (p[iLow][0] > p[iTop][0] + 0.1 * H) return null;
  return { roofX: p[iTop][0] };
}

/** Handwriting → { text, items } — text is ready for the calculator. */
export function recognize(strokes) {
  strokes = strokes.filter(s => s.pts.length).map(s => ({ ...s, box: bbox(s.pts) }));
  if (!strokes.length) return { text: '', items: [] };
  const H = Math.max(24, median(strokes.map(s => Math.max(s.box.w, s.box.h)).filter(v => v > 8)) || 40);
  const items = [];
  const text = parse(strokes, H, items);
  const hasEq = text.includes('=');
  const out = text.replace(/X/g, hasEq ? 'x' : '×').replace(/·/g, '×');
  return { text: out, items, H };
}

function parse(pool, H, flat) {
  pool = [...pool];
  const specials = [];
  const big = s => !isTiny(s.box, H) && !isFlat(s, H);
  // widest first: fraction bars and square roots own the strokes inside them
  const cands = pool.map(s => {
    if (isFlat(s, H) && s.box.w > 0.6 * H) {
      const inside = pool.filter(o => o !== s && o.box.cx > s.box.minX - 0.05 * H && o.box.cx < s.box.maxX + 0.05 * H);
      const above = inside.filter(o => o.box.maxY < s.box.cy + 0.1 * H && o.box.cy < s.box.cy - 0.15 * H);
      const below = inside.filter(o => o.box.minY > s.box.cy - 0.1 * H && o.box.cy > s.box.cy + 0.15 * H);
      if (above.some(big) && below.some(big)) return { s, type: 'frac' };
    }
    const r = rootInfo(s, H); if (r) return { s, type: 'root', r };
    return null;
  }).filter(Boolean).sort((a, b) => b.s.box.w - a.s.box.w);
  for (const c of cands) {
    if (!pool.includes(c.s)) continue;
    const s = c.s, others = pool.filter(o => o !== s);
    if (c.type === 'frac') {
      const inside = others.filter(o => o.box.cx > s.box.minX - 0.05 * H && o.box.cx < s.box.maxX + 0.05 * H);
      const num = inside.filter(o => o.box.cy < s.box.cy), den = inside.filter(o => o.box.cy > s.box.cy);
      if (!num.length || !den.length) continue;
      pool = pool.filter(o => o !== s && !num.includes(o) && !den.includes(o));
      specials.push({ type: 'frac', box: union([s.box, ...num.map(o => o.box), ...den.map(o => o.box)]), num, den, bar: s });
    } else {
      const inner = others.filter(o => o.box.cx > c.r.roofX && o.box.cx < s.box.maxX + 0.15 * H && o.box.cy > s.box.minY && o.box.cy < s.box.maxY + 0.2 * H);
      pool = pool.filter(o => o !== s && !inner.includes(o));
      specials.push({ type: 'root', box: union([s.box, ...inner.map(o => o.box)]), inner, sign: s });
    }
  }
  // group what is left into single symbols: strokes that sit over each other left-to-right belong together
  pool.sort((a, b) => a.box.minX - b.box.minX);
  const groups = [];
  for (const s of pool) {
    const g = groups.find(g => {
      const ov = Math.min(g.box.maxX, s.box.maxX) - Math.max(g.box.minX, s.box.minX);
      const narrow = Math.max(Math.min(g.box.w, s.box.w), 0.18 * H);
      const vgap = Math.max(g.box.minY, s.box.minY) - Math.min(g.box.maxY, s.box.maxY);
      const inside = (s.box.cx >= g.box.minX - 0.04 * H && s.box.cx <= g.box.maxX + 0.04 * H) || (g.box.cx >= s.box.minX - 0.04 * H && g.box.cx <= s.box.maxX + 0.04 * H);
      return (ov > 0.45 * narrow || (inside && Math.min(g.box.w, s.box.w) < 0.3 * H)) && vgap < 0.9 * H;
    });
    if (g) { g.strokes.push(s); g.box = union(g.strokes.map(t => t.box)); }
    else groups.push({ strokes: [s], box: s.box });
  }
  const items = [...groups.map(g => ({ type: 'sym', ...g, ...classify(g, H) })), ...specials].sort((a, b) => a.box.minX - b.box.minX);
  // a dot low on the line is a decimal point, a dot in the middle means times
  const solid = items.filter(i => i.type !== 'sym' || /[0-9()X]/.test(i.ch));
  const top = median(solid.map(i => i.box.minY)), bot = median(solid.map(i => i.box.maxY));
  for (const it of items) if (it.ch === 'dot') it.ch = it.box.cy > top + (bot - top) * 0.62 ? '.' : '·';
  // exponents: smaller and raised above the thing before them
  let out = '', base = null, inExp = false;
  const isBase = it => it.type !== 'sym' || /[0-9)X]/.test(it.ch);
  for (const it of items) {
    const raised = base && isBase(it) && it.box.h < 0.8 * base.box.h && it.box.maxY < base.box.minY + 0.55 * base.box.h;
    const stillRaised = inExp && base && it.box.maxY < base.box.minY + 0.6 * base.box.h && it.box.h < 0.85 * base.box.h;
    if (inExp && !stillRaised) { out += ')'; inExp = false; }
    if (!inExp && raised) { out += '^('; inExp = true; }
    let t;
    if (it.type === 'frac') t = `(${parse(it.num, H, flat)})/(${parse(it.den, H, flat)})`;
    else if (it.type === 'root') t = `√(${parse(it.inner, H, flat)})`;
    else t = it.ch;
    out += t;
    flat.push({ box: it.box, ch: it.type === 'sym' ? it.ch : it.type, exp: inExp, conf: it.conf });
    if (!inExp && isBase(it)) base = it;
    if (!inExp && !isBase(it)) base = null;
  }
  if (inExp) out += ')';
  return out;
}
