// Practice problems for class. Each topic has Easy / Medium / Hard, and every problem can be
// explained by the same step-by-step engine as the calculator.
import { gcd, fmt } from './math.js';

const R = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const nz = (a, b) => { let v; do v = R(a, b); while (v === 0); return v; };
const sgn = v => v < 0 ? `− ${-v}` : `+ ${v}`;
const par = v => v < 0 ? `(${fmt(v)})` : String(v);
const coef = (k) => k === 1 ? '' : k === -1 ? '−' : String(k).replace('-', '−');

export const TOPICS = [
  { id: 'add', name: 'Addition', icon: '➕', grade: 'Grades 1–5', lo: 0, hi: 4 },
  { id: 'sub', name: 'Subtraction', icon: '➖', grade: 'Grades 1–5', lo: 0, hi: 4 },
  { id: 'mul', name: 'Multiplication', icon: '✖️', grade: 'Grades 3–6', lo: 2, hi: 5 },
  { id: 'div', name: 'Division', icon: '➗', grade: 'Grades 3–6', lo: 3, hi: 6 },
  { id: 'neg', name: 'Negative numbers', icon: '🌡️', grade: 'Grades 6–7', lo: 6, hi: 7 },
  { id: 'order', name: 'Order of operations', icon: '🧩', grade: 'Grades 5–8', lo: 5, hi: 8 },
  { id: 'frac', name: 'Fractions', icon: '🍕', grade: 'Grades 4–7', lo: 3, hi: 7 },
  { id: 'dec', name: 'Decimals', icon: '🔢', grade: 'Grades 4–7', lo: 4, hi: 7 },
  { id: 'pct', name: 'Percents', icon: '💯', grade: 'Grades 6–8', lo: 6, hi: 8 },
  { id: 'pow', name: 'Exponents & roots', icon: '🔺', grade: 'Grades 6–9', lo: 6, hi: 9 },
  { id: 'eq', name: 'Equations', icon: '⚖️', grade: 'Grades 6–9', lo: 6, hi: 9 },
  { id: 'quad', name: 'Quadratics', icon: '📈', grade: 'Grades 9–11', lo: 9, hi: 12 },
];

// Every generator returns { q: what's shown, src: what the explainer works on, ans: number | [roots], kind }
const GEN = {
  add: [() => { const a = R(1, 20), b = R(1, 20); return { src: `${a}+${b}` }; },
    () => { const a = R(100, 899), b = R(100, 899); return { src: `${a}+${b}` }; },
    () => pick([() => { const a = R(1000, 49999), b = R(1000, 49999); return { src: `${a}+${b}` }; }, () => { const a = R(100, 9999) / 100, b = R(100, 9999) / 100; return { src: `${a}+${b}` }; }])()],
  sub: [() => { const a = R(5, 20), b = R(1, a); return { src: `${a}-${b}` }; },
    () => { const a = R(200, 999), b = R(100, a - 1); return { src: `${a}-${b}` }; },
    () => { const a = R(1000, 9999), b = R(100, a - 1); return { src: `${a}-${b}` }; }],
  mul: [() => ({ src: `${R(2, 10)}*${R(2, 10)}` }),
    () => ({ src: `${R(12, 99)}*${R(3, 9)}` }),
    () => ({ src: `${R(101, 999)}*${R(12, 99)}` })],
  div: [() => { const b = R(2, 10), q = R(2, 10); return { src: `${b * q}/${b}` }; },
    () => { const b = R(3, 9), q = R(12, 120); return { src: `${b * q}/${b}` }; },
    () => { const b = R(12, 49), q = R(21, 250); return { src: `${b * q}/${b}` }; }],
  neg: [() => { const a = nz(-10, 10), b = nz(-10, 10); return { src: `${a}+(${b})`, q: `${fmt(a)} + ${par(b)}` }; },
    () => { const a = nz(-12, 12), b = nz(-12, 12), op = pick(['-', '*']); return { src: `${a}${op}(${b})`, q: `${fmt(a)} ${op === '-' ? '−' : '×'} ${par(b)}` }; },
    () => { const b = nz(-9, 9), q = nz(-12, 12), c = nz(-20, 20); return { src: `${b * q}/(${b})+(${c})`, q: `${fmt(b * q)} ÷ ${par(b)} + ${par(c)}` }; }],
  order: [() => { const a = R(1, 20), b = R(2, 9), c = R(2, 9); return pick([{ src: `${a}+${b}*${c}` }, { src: `${a * 0 + b * c + a}-${b}*${c}` }]); },
    () => { const a = R(1, 12), b = R(1, 12), c = R(2, 6), d = R(1, 10); return { src: `(${a}+${b})*${c}-${d}` }; },
    () => { const a = R(1, 20), b = R(2, 5), c = R(6, 12), d = R(1, 5), e = pick([2, 3, 4]);
      const inner = (c - d) * b * b; if (inner % e) return GEN.order[2](); return { src: `${a}+${b}^2*(${c}-${d})/${e}` }; }],
  frac: [() => { const d = R(3, 12), a = R(1, d - 1), b = R(1, d - a); return { src: `${a}/${d}+${b}/${d}`, kind: 'frac' }; },
    () => { let b, d; do { b = R(2, 9); d = R(2, 9); } while (b === d); const a = R(1, b - 1), c = R(1, d - 1); return { src: `${a}/${b}${pick(['+', '-'])}${c}/${d}`, kind: 'frac' }; },
    () => { const b = R(2, 9), d = R(2, 9), a = R(1, 9), c = R(1, 9); return { src: `${a}/${b}${pick(['*', '/'])}${c}/${d}`, kind: 'frac' }; }],
  dec: [() => { const a = R(1, 99) / 10, b = R(1, 99) / 10; return { src: `${a}+${b}` }; },
    () => { const a = R(100, 999) / 100, b = R(1, 99) / 10; return pick([{ src: `${a}-${b}` }, { src: `${b}*${R(2, 9)}` }]); },
    () => { const a = R(11, 99) / 10, b = R(11, 99) / 10; return pick([{ src: `${a}*${b}` }, { src: `${(a * 4).toFixed(1)}/4` }]); }],
  pct: [() => { const p = pick([10, 25, 50, 20]), n = R(1, 20) * 20; return { src: `${p}% of ${n}` }; },
    () => { const p = R(1, 19) * 5, n = R(1, 30) * 20; return { src: `${p}% of ${n}` }; },
    () => { const p = R(1, 99), n = R(2, 40) * 10; return { src: `${p}% of ${n}` }; }],
  pow: [() => pick([() => { const a = R(2, 12); return { src: `${a}^2` }; }, () => { const a = R(2, 12); return { src: `√${a * a}`, q: `√${a * a}` }; }])(),
    () => pick([() => ({ src: `${R(2, 6)}^3` }), () => ({ src: `2^${R(4, 10)}` }), () => { const a = R(2, 5); return { src: `∛${a ** 3}` }; }])(),
    () => { const a = R(2, 9), b = R(2, 4), c = R(2, 12); return { src: `${a}^2+${b}^3-√${c * c}` }; }],
  eq: [() => { const x = R(-5, 15), a = R(2, 12); return pick([{ src: `x+${a}=${x + a}` }, { src: `${a}x=${a * x}` }, { src: `x-${a}=${x - a}` }]); },
    () => { const x = R(-9, 12), a = nz(-6, 9), b = nz(-15, 15); if (a === 1) return GEN.eq[1](); return { src: `${a}x${b < 0 ? '' : '+'}${b}=${a * x + b}`, q: `${coef(a)}x ${sgn(b)} = ${fmt(a * x + b)}` }; },
    () => pick([() => { const x = R(-8, 10), a = R(3, 9), c = R(1, a - 1), b = nz(-12, 12), d = (a - c) * x + b; return { src: `${a}x${b < 0 ? '' : '+'}${b}=${c}x${d < 0 ? '' : '+'}${d}`, q: `${coef(a)}x ${sgn(b)} = ${coef(c)}x ${sgn(d)}` }; },
      () => { const x = R(-6, 10), a = R(2, 7), b = nz(-8, 8); return { src: `${a}(x${b < 0 ? '' : '+'}${b})=${a * (x + b)}`, q: `${a}(x ${sgn(b)}) = ${fmt(a * (x + b))}` }; }])()],
  quad: [() => { const p = R(1, 7), q = R(1, 7); return quad(p, q); },
    () => { const p = nz(-9, 9), q = nz(-9, 9); return quad(p, q); },
    () => { const p = nz(-12, 12); return pick([quad(p, -p), quad(p, nz(-12, 12)), quad(0, nz(-10, 10))]); }],
};
function quad(r1, r2) {
  const b = -(r1 + r2), c = r1 * r2;
  const q = `x² ${b ? sgn(b).replace(/\d+/, m => (m === '1' ? '' : m)) + 'x ' : ''}${c ? sgn(c) + ' ' : ''}= 0`.replace(/\s+/g, ' ');
  return { src: `x^2${b ? (b < 0 ? '' : '+') + b + 'x' : ''}${c ? (c < 0 ? '' : '+') + c : ''}=0`, q, kind: 'roots' };
}

/** A new problem for this topic and level (0 easy, 1 medium, 2 hard). */
export function makeProblem(topic, level) {
  const p = GEN[topic][level]();
  p.kind = p.kind || (topic === 'eq' ? 'x' : 'num');
  p.q = p.q || p.src.replace(/\*/g, ' × ').replace(/\//g, ' ÷ ').replace(/\+/g, ' + ').replace(/(\d|\))-/g, '$1 − ').replace(/\^2/g, '²').replace(/\^3/g, '³').replace(/\^(\d+)/g, '^$1').replace(/-/g, '−');
  if (topic === 'frac') p.q = p.src.replace(/(\d+)\/(\d+)/g, '⟨$1|$2⟩').replace(/\*/g, ' × ').replace(/\//g, ' ÷ ').replace(/\+/g, ' + ').replace(/-/g, ' − ');
  if (topic === 'eq' && !p.q.includes(' = ')) p.q = p.src.replace(/=/, ' = ').replace(/(\w)\+/g, '$1 + ').replace(/(\w)-/g, '$1 − ').replace(/-/g, '−');
  p.q = p.q.replace(/(\d)x/g, '$1x').replace(/\s+/g, ' ').trim();
  p.topic = topic; p.level = level;
  return p;
}
export const LEVELS = ['Easy', 'Medium', 'Hard'];
export const GRADES = ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
export const gradeName = g => g === 0 ? 'Kindergarten' : `Grade ${g}`;
/** Is this subject taught around this grade? */
export const forGrade = (t, g) => g >= t.lo && g <= t.hi;
/** Easy / Medium / Hard to start on for this grade. */
export const levelFor = (t, g) => g <= t.lo ? 0 : g >= t.hi ? 2 : 1;
export const GRADE_EXAMPLES = [
  ['2 + 3', '5 − 1', '4 + 4', '10 − 3', '1 + 2 + 3', '6 + 0', '9 − 5', '3 + 3 + 3'],
  ['8 + 5', '12 − 4', '9 + 9', '15 − 8', '20 + 30', '3 + 4 + 5', '18 − 9', '50 + 25'],
  ['47 + 25', '63 − 28', '100 − 45', '3 × 4', '5 + 5 + 5', '99 + 1', '2 × 6', '84 − 37'],
  ['6 × 7', '56 ÷ 8', '345 + 278', '702 − 356', '1/2 + 1/2', '4 × 25', '9 × 8', '81 ÷ 9'],
  ['456 × 23', '7825 ÷ 25', '3/8 + 2/8', '1.5 + 2.75', '17 ÷ 5', '12 × 12', '1203 − 567', '36'],
  ['1/2 + 1/3', '3/4 × 2/9', '2.4 × 1.5', '(8 − 3) × 4', '3 + 4 × 2', '10²', '7/4', '0.75'],
  ['15% of 80', '5/6 ÷ 1/3', '2x = 18', '−3 + 7', '2³ + 4', '3.6 ÷ 0.4', '360', '5 − (−3)'],
  ['2x + 5 = 17', '−4 × −5', '3(x − 2) = 12', '25% of 64', '−3² + 10', 'x + 7 = −2', '2x + 3 > 7', '97'],
  ['3(x − 2) = 2x + 4', '√50', '5x − 3 = 2x + 9', '4.5 × 10^3', '√144 + 2³', '−3x + 4 ≤ 10', '2^10', '(2 + 3)²'],
  ['x² − 5x + 6 = 0', 'x² = 16', '(2x + 1)(x − 3) = 0', '2x² + 3x − 7 = 0', 'x² − 5x + 6 < 0', '√(3² + 4²)', 'x² + 1 = 0', '6!'],
  ['sin(30) + cos(60)', 'tan(45)', 'x² ≥ 4', 'sin⁻¹(0.5)', '2x² − 8 = 0', '√(5² + 12²)', 'cos(180)', '3^4'],
  ['log(1000)', 'ln(e^2)', '2^x = 8', '6!', '5!/(2!×3!)', 'log(2) + log(5)', 'e^2', '17 mod 5'],
  ['x³ − 6x² + 11x − 6 = 0', '6!!', 'e^2', '10!/7!', '2.5!', 'ln(10)', '2^x = 100', 'sin(x) = 0.5'],
];
export const tidyFrac = (n, d) => { const g = gcd(n, d); return [n / g, d / g]; };
