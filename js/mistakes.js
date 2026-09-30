// "How people get it wrong": the usual slip-ups for a problem, the wrong answer each one gives, and why.
// Practice mode also uses these to tell a student exactly which mistake they probably made.
import { fmt, gcd, clean, isInt, toFrac } from './math.js';

const norm = s => String(s).replace(/[−–]/g, '-').replace(/×/g, '*').replace(/÷/g, '/').replace(/²/g, '^2').replace(/³/g, '^3').replace(/\s+/g, '');
const fracStr = (n, d) => { if (d < 0) { n = -n; d = -d; } const g = gcd(n, d) || 1; n /= g; d /= g; return d === 1 ? fmt(n) : `${fmt(n)}/${fmt(d)}`; };

/** Evaluates + − × ÷ strictly left to right (ignoring times-before-plus). */
function leftToRight(t) {
  const m = t.match(/-?\d+(\.\d+)?|[-+*/]/g);
  if (!m || m.join('') !== t) return null;
  let v = +m[0];
  for (let i = 1; i < m.length; i += 2) { const b = +m[i + 1], o = m[i]; if (isNaN(b)) return null; v = o === '+' ? v + b : o === '-' ? v - b : o === '*' ? v * b : v / b; }
  return v;
}
function safeEval(t) {
  if (!/^[-+*/().\d^]+$/.test(t)) return null;
  try { const v = Function(`"use strict";return (${t.replace(/\^/g, '**')})`)(); return isFinite(v) ? v : null; } catch { return null; }
}
const digitsOf = n => String(n).split('').map(Number);

/** List of { value, wrong, why } — only mistakes that give a DIFFERENT answer than the right one. */
export function mistakes(src, r) {
  const t = norm(src), out = [];
  const right = r?.value ?? r?.roots?.[0];
  const add = (value, why, wrong = null) => {
    if (value == null || (typeof value === 'number' && !isFinite(value))) return;
    if (typeof value === 'number' && right != null && Math.abs(value - right) < 1e-9) return;
    const w = wrong ?? fmt(clean(value));
    if (out.some(o => o.wrong === w)) return;
    out.push({ value: typeof value === 'number' ? clean(value) : value, wrong: w, why });
  };
  let m;
  // order of operations
  if (/^[-\d.]+([-+*/][\d.]+)+$/.test(t) && !/^\d+\/\d+[-+*/]\d+\/\d+$/.test(t) && /[+-]/.test(t.slice(1)) && /[*/]/.test(t)) add(leftToRight(t), 'Worked straight from left to right. Multiply and divide come BEFORE add and subtract.');
  if (/\(/.test(t) && /^[-+*/().\d]+$/.test(t)) add(safeEval(t.replace(/[()]/g, '')), 'Ignored the brackets. Whatever is inside ( ) must be worked out first.');
  // fractions
  if ((m = /^(\d+)\/(\d+)([-+])(\d+)\/(\d+)$/.exec(t))) {
    const [a, b, o, c, d] = [+m[1], +m[2], m[3], +m[4], +m[5]];
    if (b !== d) add(o === '+' ? (a + c) / (b + d) : (a - c) / (b - d), `Added (or subtracted) the tops AND the bottoms. You need a common denominator first — you can't add the bottoms.`, fracStr(o === '+' ? a + c : a - c, o === '+' ? b + d : b - d));
    else add(o === '+' ? (a + c) / (2 * b) : 0, 'Added the bottom numbers too. When the bottoms match, keep the bottom and only add the tops.', fracStr(o === '+' ? a + c : a - c, 2 * b));
  }
  if ((m = /^(\d+)\/(\d+)\/(\d+)\/(\d+)$/.exec(t))) {
    const [a, b, c, d] = m.slice(1).map(Number);
    add((b / a) * (c / d), 'Flipped the FIRST fraction. Keep the first one, change ÷ to ×, and flip only the second.', fracStr(b * c, a * d));
    add((a / c) / (b / d), 'Divided straight across (top ÷ top, bottom ÷ bottom) — that only works if they divide evenly.');
  }
  if ((m = /^(\d+)\/(\d+)\*(\d+)\/(\d+)$/.exec(t))) {
    const [a, b, c, d] = m.slice(1).map(Number);
    add((a * d) / (b * c), 'Cross-multiplied. That trick is for comparing or dividing fractions — to multiply, go straight across.', fracStr(a * d, b * c));
  }
  // negatives and powers
  if ((m = /^-(\d+(?:\.\d+)?)\^(\d+)$/.exec(t)) && +m[2] % 2 === 0) add(Math.pow(+m[1], +m[2]), `Squared the minus sign too. −${m[1]}² means −(${m[1]}²). Only (−${m[1]})² would be positive.`);
  if ((m = /^(\d+)\^(\d+)$/.exec(t)) && +m[2] > 1) add(+m[1] * +m[2], `Multiplied ${m[1]} × ${m[2]}. The power means multiply ${m[1]} by ITSELF ${m[2]} times.`);
  if ((m = /^(?:sqrt|√)\(?(\d+)\)?$/.exec(t)) && +m[1] > 4) add(+m[1] / 2, `Halved it. A square root isn't half — it's the number that times ITSELF makes ${m[1]}.`);
  if ((m = /^(-?\d+)-\((-\d+)\)$/.exec(t))) add(+m[1] + +m[2], 'Forgot that subtracting a negative is the same as adding.');
  if ((m = /^(-\d+)\*\(?(-\d+)\)?$/.exec(t))) add(-(+m[1] * +m[2]), 'Negative × negative is POSITIVE, not negative.');
  // percent
  if ((m = /^(\d+(?:\.\d+)?)%(?:of|\*)(\d+(?:\.\d+)?)$/.exec(t))) { add(+m[1] * +m[2], `Forgot to turn ${m[1]}% into ${fmt(+m[1] / 100)} (÷ 100) before multiplying.`); add(+m[2] / +m[1], `Divided ${m[2]} by ${m[1]}. "Of" means multiply by ${m[1]}/100.`); }
  // factorial
  if ((m = /^(\d+)!$/.exec(t)) && +m[1] > 2) { const n = +m[1]; add(n * (n + 1) / 2, `Added ${n} + ${n - 1} + … + 1. Factorial means MULTIPLY them.`); add(n * (n - 1), `Stopped after two numbers (${n} × ${n - 1}). Keep going all the way down to 1.`); }
  if ((m = /^(\d+)!!$/.exec(t)) && +m[1] > 2) { let f = 1; for (let i = 2; i <= +m[1]; i++) f *= i; add(f, `Treated !! like one factorial. Double factorial skips every other number.`); }
  if ((m = /^(\d+)mod(\d+)$/.exec(t))) add(Math.floor(+m[1] / +m[2]), 'Gave how many times it fits (the quotient). mod asks for what is LEFT OVER.');
  // column methods
  if ((m = /^(\d+)\+(\d+)$/.exec(t))) {
    const A = digitsOf(m[1]).reverse(), B = digitsOf(m[2]).reverse(), n = Math.max(A.length, B.length); let s = '';
    for (let i = 0; i < n; i++) { const v = (A[i] || 0) + (B[i] || 0); s = (i === n - 1 ? String(v) : String(v % 10)) + s; }
    add(+s, 'Forgot to carry the 1 when a column added up to 10 or more.');
  }
  if ((m = /^(\d+)-(\d+)$/.exec(t)) && +m[1] > +m[2]) {
    const A = digitsOf(m[1]).reverse(), B = digitsOf(m[2]).reverse(); let s = '';
    for (let i = 0; i < A.length; i++) s = Math.abs(A[i] - (B[i] || 0)) + s;
    add(+s, 'Took the smaller digit from the bigger one in each column. When the top digit is smaller, you have to BORROW.');
  }
  if ((m = /^(\d+)\*(\d{2,3})$/.exec(t))) { const a = +m[1]; add(digitsOf(m[2]).reduce((s, d) => s + a * d, 0), 'Forgot the placeholder zero. The second row is times TENS, so it moves one place left.'); }
  if ((m = /^(\d+)\/(\d+)$/.exec(t)) && +m[1] % +m[2] && +m[1] > +m[2]) { const q = Math.floor(+m[1] / +m[2]), rem = +m[1] % +m[2]; add(+(q + '.' + rem), `Wrote the remainder (${rem}) after the point. "${q} remainder ${rem}" is NOT ${q}.${rem} — the remainder is ${rem} out of ${m[2]}.`); }
  if ((m = /^(\d+\.\d+)\*(\d+\.\d+)$/.exec(t))) { const dp = m[1].split('.')[1].length + m[2].split('.')[1].length; const raw = +(m[1].replace('.', '')) * +(m[2].replace('.', '')); add(raw / Math.pow(10, dp - 1), `Put the decimal point in the wrong place. Count the digits after BOTH points (${dp} in total).`); }
  if ((m = /^(\d+\.\d+)\+(\d+)$/.exec(t)) || (m = /^(\d+)\+(\d+\.\d+)$/.exec(t))) { const a = m[1], b = m[2]; const dec = a.includes('.') ? a : b, whole = a.includes('.') ? b : a; add(+dec + +whole / Math.pow(10, dec.split('.')[1].length), 'Lined the numbers up on the right instead of lining up the decimal points.'); }
  // equations
  if ((m = /^(-?\d*)x([-+]\d+)=(-?\d+)$/.exec(t))) {
    const a = m[1] === '' ? 1 : m[1] === '-' ? -1 : +m[1], b = +m[2], c = +m[3];
    add((c + b) / a, `Did the wrong opposite: to undo ${b > 0 ? '+' : '−'}${Math.abs(b)} you ${b > 0 ? 'SUBTRACT' : 'ADD'} ${Math.abs(b)} on both sides.`, `x = ${fmt(clean((c + b) / a))}`);
    if (a !== 1) add(c - b, `Forgot the last step: divide both sides by ${a}.`, `x = ${fmt(c - b)}`);
    if (a !== 1) add(c / a - b, `Divided only part of it. Undo the + or − FIRST, then divide.`, `x = ${fmt(clean(c / a - b))}`);
  }
  if ((m = /^(\d+)\(x([-+]\d+)\)=(-?\d+)$/.exec(t))) { const a = +m[1], b = +m[2], c = +m[3]; add((c - b) / a, `Only multiplied the x by ${a}, not the ${Math.abs(b)} too. ${a}(x ${b > 0 ? '+' : '−'} ${Math.abs(b)}) = ${a}x ${b > 0 ? '+' : '−'} ${Math.abs(a * b)}.`, `x = ${fmt(clean((c - b) / a))}`); }
  if (r?.kind === 'eqn' && r.roots?.length === 2 && /x\^2/.test(t) && /=0$/.test(t)) {
    const [p, q] = r.roots;
    add(-p, 'Took the numbers straight out of the brackets. (x − 2) = 0 means x = +2 — the sign flips!', `x = ${fmt(-p)} or x = ${fmt(-q)}`);
    out.push({ value: [p], wrong: `only x = ${fmt(p)}`, why: 'Stopped after one answer. An x² equation usually has TWO answers.' });
  }
  if (r?.kind === 'eqn' && /[<>≤≥]/.test(src) && (m = /x ([<>≤≥]) (.+)$/.exec(r.answer)) && /^[-−]\d*x/.test(src.trim())) {
    const flip = { '<': '>', '>': '<', '≤': '≥', '≥': '≤' }[m[1]];
    out.push({ value: null, wrong: `x ${flip} ${m[2]}`, why: 'Forgot to FLIP the sign when dividing by a negative number.' });
  }
  return out.filter(o => o.why).slice(0, 3);
}
