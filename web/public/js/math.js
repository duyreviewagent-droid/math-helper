// The math brain: reads a problem, works it out one step at a time the way a teacher would,
// and writes down *why* each step happens. Used by the calculator and by Practice mode.

export class MathError extends Error {}

const FUNCS = ['asin', 'acos', 'atan', 'sin', 'cos', 'tan', 'sqrt', 'cbrt', 'log', 'ln', 'abs'];
const WORDS = [...FUNCS, 'mod', 'pi', 'ans', 'of', 'e', 'x', 'y'].sort((a, b) => b.length - a.length);
export const FN_LABEL = { sin: 'sin', cos: 'cos', tan: 'tan', asin: 'sin⁻¹', acos: 'cos⁻¹', atan: 'tan⁻¹', sqrt: '√', cbrt: '∛', log: 'log', ln: 'ln', abs: 'abs' };

// ---------- numbers ----------
export function clean(v) {
  if (!isFinite(v)) return v;
  if (Math.abs(v) < 1e-12) return 0;
  return parseFloat(v.toPrecision(12));
}
export function fmt(v) {
  if (Number.isNaN(v)) return 'undefined';
  if (!isFinite(v)) return v > 0 ? '∞' : '−∞';
  v = clean(v);
  const a = Math.abs(v);
  let s;
  if (a !== 0 && (a >= 1e15 || a < 1e-7)) {
    const [m, e] = v.toExponential(8).split('e');
    s = parseFloat(m) + ' × 10^' + (+e);
  } else s = String(v);
  return s.replace(/-/g, '−');
}
export const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
export const lcm = (a, b) => Math.abs(a * b) / gcd(a, b);
export const isInt = v => Number.isFinite(v) && Math.abs(v - Math.round(v)) < 1e-9;

/** Best simple fraction for v, or null (e.g. 0.75 → [3, 4]). */
export function toFrac(v, maxDen = 10000) {
  if (!isFinite(v) || isInt(v)) return null;
  const sign = v < 0 ? -1 : 1; let x = Math.abs(v);
  let h1 = 1, h0 = 0, k1 = 0, k0 = 1, b = x;
  for (let i = 0; i < 30; i++) {
    const a = Math.floor(b);
    [h1, h0] = [a * h1 + h0, h1]; [k1, k0] = [a * k1 + k0, k1];
    if (k1 > maxDen) return null;
    if (Math.abs(h1 / k1 - x) < 1e-10 * Math.max(1, x)) return [sign * h1, k1];
    b = 1 / (b - a);
    if (!isFinite(b)) break;
  }
  return null;
}
/** √n written simply: √50 → 5√2 (returns null if it can't be simplified). */
export function simpRoot(n) {
  if (!isInt(n) || n < 4 || n > 1e9) return null;
  let out = 1, inside = n;
  for (let f = Math.floor(Math.sqrt(n)); f >= 2; f--) if (inside % (f * f) === 0) { out = f; inside = inside / (f * f); break; }
  return out > 1 && inside > 1 ? [out, inside] : null;
}

// ---------- reading the problem ----------
function tokenize(src) {
  let s = String(src)
    .replace(/sin⁻¹/g, 'asin').replace(/cos⁻¹/g, 'acos').replace(/tan⁻¹/g, 'atan')
    .replace(/[−–—]/g, '-').replace(/[×·✕]/g, '*').replace(/÷/g, '/').replace(/²/g, '^2').replace(/³/g, '^3')
    .replace(/π/g, ' pi ').replace(/√/g, ' sqrt ').replace(/∛/g, ' cbrt ').replace(/\*\*/g, '^')
    .replace(/[\[{]/g, '(').replace(/[\]}]/g, ')').replace(/X/g, 'x');
  const out = []; let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === ' ' || c === '\t' || c === '\n') { i++; continue; }
    let m = /^\d{1,3}(,\d{3})+(\.\d+)?/.exec(s.slice(i)) || /^(\d+\.?\d*|\.\d+)/.exec(s.slice(i));
    if (m) { out.push({ k: 'num', v: parseFloat(m[0].replace(/,/g, '')) }); i += m[0].length; continue; }
    if (/[a-zA-Z]/.test(c)) {
      let word = /^[a-zA-Z]+/.exec(s.slice(i))[0]; i += word.length; word = word.toLowerCase();
      while (word) {
        const w = WORDS.find(w => word.startsWith(w));
        if (!w) throw new MathError(`I don't know what "${word}" means. Try numbers, x, and keys like sin, √, log.`);
        if (FUNCS.includes(w)) out.push({ k: 'fn', v: w });
        else if (w === 'x') out.push({ k: 'var' });
        else if (w === 'y') out.push({ k: 'var', name: 'y' });
        else if (w === 'of') out.push({ k: 'op', v: '*', of: true });
        else if (w === 'mod') out.push({ k: 'op', v: 'mod' });
        else out.push({ k: 'const', v: w });
        word = word.slice(w.length);
      }
      continue;
    }
    if (c === '!' && s[i + 1] === '!') { out.push({ k: 'op', v: '!!' }); i += 2; continue; }
    if ('+-*/^!%='.includes(c)) { out.push({ k: 'op', v: c }); i++; continue; }
    if (c === '(') { out.push({ k: 'lp' }); i++; continue; }
    if (c === ')') { out.push({ k: 'rp' }); i++; continue; }
    if (c === '|') throw new MathError('For absolute value use abs( ).');
    throw new MathError(`I can't read "${c}".`);
  }
  return out;
}

export function parse(src) {
  const t = tokenize(src); let p = 0;
  if (!t.length) throw new MathError('Type a problem first.');
  const peek = () => t[p], next = () => t[p++];
  const isOp = (v) => t[p] && t[p].k === 'op' && t[p].v === v;
  const startsValue = tk => tk && (tk.k === 'num' || tk.k === 'const' || tk.k === 'var' || tk.k === 'fn' || tk.k === 'lp');

  function expr() {
    let n = term();
    while (isOp('+') || isOp('-')) { const op = next().v; n = { t: 'bin', op, a: n, b: term() }; }
    return n;
  }
  function term() {
    let n = unary();
    for (;;) {
      if (isOp('*') || isOp('/') || isOp('mod')) { const tk = next(); n = { t: 'bin', op: tk.v, a: n, b: unary(), of: tk.of }; }
      else if (startsValue(peek())) n = { t: 'bin', op: '*', a: n, b: power(), implicit: true };
      else break;
    }
    return n;
  }
  function unary() {
    if (isOp('-')) { next(); const a = unary(); if (a.t === 'num' && !a.paren) { a.v = -a.v; return a; } return { t: 'neg', a }; }
    if (isOp('+')) { next(); return unary(); }
    return power();
  }
  function power() {
    const base = postfix();
    if (isOp('^')) { next(); return { t: 'bin', op: '^', a: base, b: unary() }; }
    return base;
  }
  function postfix() {
    let n = primary();
    while (isOp('!') || isOp('!!') || isOp('%')) n = { t: 'post', op: next().v, a: n };
    return n;
  }
  function primary() {
    const tk = next();
    if (!tk) throw new MathError('The problem ends too soon — something is missing at the end.');
    if (tk.k === 'num') return { t: 'num', v: tk.v };
    if (tk.k === 'const') return { t: 'const', name: tk.v };
    if (tk.k === 'var') return tk.name ? { t: 'var', name: tk.name } : { t: 'var' };
    if (tk.k === 'fn') {
      let a;
      if (peek() && peek().k === 'lp') { next(); a = expr(); if (peek() && peek().k === 'rp') next(); }
      else a = postfix();
      a.scope = true;
      return { t: 'fn', name: tk.v, a };
    }
    if (tk.k === 'lp') {
      if (peek() && peek().k === 'rp') throw new MathError('There is nothing inside the ( ).');
      const e = expr();
      if (peek() && peek().k === 'rp') next();           // like a real calculator, missing ) at the end are fine
      else if (peek()) throw new MathError('A ( is missing its ).');
      e.paren = true; e.scope = true;
      return e;
    }
    if (tk.k === 'rp') throw new MathError('There is a ) without a ( before it.');
    if (tk.k === 'op') throw new MathError(`"${tk.v === '*' ? '×' : tk.v === '/' ? '÷' : tk.v}" needs a number before it.`);
    throw new MathError('Something is off in that problem.');
  }
  const n = expr();
  if (p < t.length) {
    const tk = t[p];
    if (tk.k === 'rp') throw new MathError('There is a ) without a ( before it.');
    if (tk.k === 'op' && tk.v === '=') throw new MathError('=');
    throw new MathError('I got lost reading that — check for a missing sign.');
  }
  return n;
}

// ---------- showing expressions ----------
const PREC = { '+': 3, '-': 3, '*': 4, '/': 4, mod: 4 };
/** Writes a tree as text. html=true gives superscripts, pretty fractions and a highlight around `hl`. */
export function show(n, o = {}, pp = 0, right = false) {
  const html = !!o.html; let s, p;
  const sym = { '+': ' + ', '-': ' − ', '*': ' × ', '/': ' ÷ ', mod: ' mod ' };
  switch (n.t) {
    case 'num': s = fmt(n.v); p = n.v < 0 ? (right || pp >= 5 ? 0 : 5) : 9; break;
    case 'const': s = { pi: 'π', e: 'e', ans: 'Ans' }[n.name]; p = 9; break;
    case 'var': s = n.name || 'x'; p = 9; break;
    case 'fn': {
      const inner = show(n.a, o, 0);
      s = (n.name === 'abs') ? '|' + inner + '|' : FN_LABEL[n.name] + '(' + inner + ')'; p = 8; break;
    }
    case 'post': s = show(n.a, o, 8) + n.op; p = 7; break;
    case 'neg': s = '−' + (n.a.t === 'num' ? '(' + show(n.a, o, 0) + ')' : show(n.a, o, 5)); p = 5; break;
    case 'bin':
      if (n.op === '^') {
        const b = show(n.b, o, 0);
        s = show(n.a, o, 7) + (html ? '<sup>' + b + '</sup>' : '^' + (/^[\w.]+$/.test(b) ? b : '(' + b + ')'));
        p = 6;
      } else {
        const bp = PREC[n.op];
        const l = show(n.a, o, bp), r = show(n.b, o, bp + 1, true);
        if (n.of) s = l + ' of ' + r;
        else if (n.implicit && n.a.t === 'num' && (n.b.t === 'var' || n.b.t === 'const' || (n.b.t === 'bin' && n.b.op === '^' && n.b.a.t === 'var'))) s = l + r;
        else if (html && n.op === '/' && o.frac && n.a.t === 'num' && n.b.t === 'num' && isInt(n.a.v) && isInt(n.b.v)) s = fracHTML(n.a.v, n.b.v);
        else s = l + sym[n.op] + r;
        p = bp;
      }
      break;
  }
  if (n.paren || p < pp) s = '(' + s + ')';
  if (html && n === o.hl) s = `<span class="hl${o.hlNew ? ' new' : ''}">${s}</span>`;
  return s;
}
export const fracHTML = (a, b) => `<span class="frac"><span>${fmt(a)}</span><span>${fmt(b)}</span></span>`;
const plain = n => show(n);

// ---------- working it out ----------
const DEG = Math.PI / 180;
export function evalNode(n, ctx, x = 0) {
  const ev = m => evalNode(m, ctx, x);
  switch (n.t) {
    case 'num': return n.v;
    case 'var': return n.name === 'y' ? (ctx.yv ?? 0) : x;
    case 'const': return n.name === 'pi' ? Math.PI : n.name === 'e' ? Math.E : (ctx.ans ?? 0);
    case 'neg': return -ev(n.a);
    case 'post': return n.op === '%' ? ev(n.a) / 100 : n.op === '!!' ? dfact(ev(n.a)) : fact(ev(n.a));
    case 'fn': return fnValue(n.name, ev(n.a), ctx).v;
    case 'bin': {
      const a = ev(n.a), b = ev(n.b);
      return n.op === '+' ? a + b : n.op === '-' ? a - b : n.op === '*' ? a * b : n.op === '/' ? a / b : n.op === 'mod' ? modv(a, b) : Math.pow(a, b);
    }
  }
}
function lgamma(z) {            // log of the gamma function (Lanczos)
  const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * z))) - lgamma(1 - z);
  z -= 1; let x = c[0]; for (let i = 1; i < 9; i++) x += c[i] / (z + i);
  const t = z + g + 0.5; return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}
function gamma(z) { if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z)); return Math.exp(lgamma(z)); }
function tooBig(label, log10) {
  const e = Math.floor(log10), m = Math.pow(10, log10 - e);
  return new MathError(`${label} is a number with ${(e + 1).toLocaleString()} digits (about ${m.toFixed(3)} × 10^${e.toLocaleString()}). That's too big for any calculator to keep working with!`);
}
function fact(n) {
  if (isInt(n) && n < 0) throw new MathError('Factorial (!) of a negative whole number is undefined.');
  if (n > 170) throw tooBig(`${fmt(n)}!`, lgamma(n + 1) / Math.LN10);
  if (!isInt(n)) return gamma(n + 1);
  let r = 1; for (let i = 2; i <= n; i++) r *= i; return r;
}
function dfact(n) {
  if (!isInt(n) || n < -1) throw new MathError('Double factorial (!!) works on whole numbers.');
  if (n > 300) throw tooBig(`${fmt(n)}!!`, (() => { let l = 0; for (let i = n; i > 1; i -= 2) l += Math.log10(i); return l; })());
  let r = 1; for (let i = n; i > 1; i -= 2) r *= i; return r;
}
const modv = (a, b) => { if (b === 0) throw new MathError("mod 0 doesn't work — you can't divide by zero."); return ((a % b) + b) % b; };
const EXACT = {
  sin: { 0: '0', 30: '1/2', 45: '√2/2', 60: '√3/2', 90: '1', 180: '0', 270: '−1', 360: '0' },
  cos: { 0: '1', 30: '√3/2', 45: '√2/2', 60: '1/2', 90: '0', 180: '−1', 270: '0', 360: '1' },
  tan: { 0: '0', 30: '√3/3', 45: '1', 60: '√3', 180: '0', 360: '0' },
};
function fnValue(name, a, ctx) {
  const deg = ctx.deg !== false, A = fmt(a), u = deg ? '°' : '';
  const r = (v, text) => ({ v: clean(v), text });
  switch (name) {
    case 'sqrt': {
      if (a < 0) throw new MathError(`√${A} has no real answer — no real number times itself makes a negative.`);
      const v = Math.sqrt(a);
      if (isInt(v)) return r(v, `√${A} = ${fmt(v)} because ${fmt(v)} × ${fmt(v)} = ${A}.`);
      const lo = Math.floor(v), sr = simpRoot(a);
      let t = `√${A} ≈ ${fmt(v)}.`;
      if (a >= 1 && a < 1e6) t += ` It is between ${lo} and ${lo + 1}, because ${lo}² = ${lo * lo} and ${lo + 1}² = ${(lo + 1) ** 2}.`;
      if (sr) t += ` Exact form: √${A} = √(${sr[0] * sr[0]} × ${sr[1]}) = ${sr[0]}√${sr[1]}.`;
      return r(v, t);
    }
    case 'cbrt': {
      const v = Math.cbrt(a);
      return r(v, isInt(v) ? `∛${A} = ${fmt(v)} because ${fmt(v)} × ${fmt(v)} × ${fmt(v)} = ${A}.` : `∛${A} ≈ ${fmt(v)} (the number that times itself 3 times gives ${A}).`);
    }
    case 'sin': case 'cos': case 'tan': {
      const ang = deg ? a * DEG : a;
      const k = deg ? (((a % 360) + 360) % 360) : null;
      if (name === 'tan' && Math.abs(Math.cos(ang)) < 1e-12) throw new MathError(`tan(${A}${u}) is undefined — the angle points straight up/down, so cos is 0 and you'd divide by 0.`);
      const v = Math[name](ang);
      let t = `${name}(${A}${u}) = ${fmt(clean(v))}`;
      if (deg && EXACT[name][k] !== undefined && /[√/]/.test(EXACT[name][k])) t += ` (exactly ${EXACT[name][k]} — a special angle worth remembering)`;
      t += '.';
      if (!deg) t += ' (The calculator is in RAD mode, so the angle is in radians.)';
      return r(v, t);
    }
    case 'asin': case 'acos': case 'atan': {
      if (name !== 'atan' && (a < -1 || a > 1)) throw new MathError(`${FN_LABEL[name]}(${A}) is impossible — sin and cos are always between −1 and 1.`);
      const v = Math[name](a) / (deg ? DEG : 1), base = name.slice(1);
      return r(v, `${FN_LABEL[name]}(${A}) asks "what angle has ${base} = ${A}?" The answer is ${fmt(clean(v))}${u}.`);
    }
    case 'log': {
      if (a <= 0) throw new MathError(`log(${A}) doesn't exist — you can't raise 10 to any power and get zero or a negative number.`);
      const v = Math.log10(a);
      return r(v, isInt(v) ? `log(${A}) = ${fmt(clean(v))} because 10^${fmt(clean(v))} = ${A}. (log asks: "10 to what power gives this?")` : `log(${A}) ≈ ${fmt(clean(v))}, meaning 10^${fmt(clean(v))} ≈ ${A}.`);
    }
    case 'ln': {
      if (a <= 0) throw new MathError(`ln(${A}) doesn't exist — e to any power is always positive.`);
      const v = Math.log(a);
      return r(v, `ln(${A}) = ${fmt(clean(v))}. ln asks "e (≈ 2.718) to what power gives ${A}?"`);
    }
    case 'abs': return r(Math.abs(a), `|${A}| = ${fmt(Math.abs(a))}. Absolute value is how far a number is from 0, so it's never negative.`);
  }
}

/** Works out one small piece (a node whose parts are already numbers). */
function reduceNode(n, ctx) {
  const V = m => m.v, F = m => fmt(m.v);
  const r = (v, text, rule, method) => ({ v: clean(v), text, rule, method });
  switch (n.t) {
    case 'const':
      if (n.name === 'pi') return r(Math.PI, 'π (pi) is the distance around a circle divided by the distance across. It is about 3.14159.', 'Numbers');
      if (n.name === 'e') return r(Math.E, 'e is a special number, about 2.71828 (it shows up in growth and interest).', 'Numbers');
      return r(ctx.ans ?? 0, `Ans means your last answer, which was ${fmt(ctx.ans ?? 0)}.`, 'Numbers');
    case 'fn': { const o = fnValue(n.name, V(n.a), ctx); return r(o.v, o.text, n.name === 'sqrt' || n.name === 'cbrt' ? 'Roots' : 'Functions'); }
    case 'neg': return r(-V(n.a), `The minus sign in front means "the opposite of": −(${F(n.a)}) = ${fmt(-V(n.a))}.`, 'Signs');
    case 'post':
      if (n.op === '%') return r(V(n.a) / 100, `Percent means "out of 100", so ${F(n.a)}% = ${F(n.a)} ÷ 100 = ${fmt(V(n.a) / 100)}.`, 'Percent');
      if (n.op === '!!') {
        const k = dfact(V(n.a)), list = [];
        for (let i = V(n.a); i > 1 && list.length < 12; i -= 2) list.push(i);
        return r(k, `${F(n.a)}!! (double factorial) multiplies every OTHER number going down: ${list.join(' × ') || '1'}${list.length > 1 ? ' = ' + fmt(k) : ''}. (Not the same as (${F(n.a)}!)!, which would be ${fmt(V(n.a)) === '6' ? '720!' : 'enormous'}.)`, 'Factorial');
      }
      if (!isInt(V(n.a))) { const k = fact(V(n.a)); return r(k, `${F(n.a)}! isn't a whole number factorial, so it uses the gamma function (a smooth version of factorial): ${F(n.a)}! = Γ(${fmt(V(n.a) + 1)}) ≈ ${fmt(k)}.`, 'Factorial'); }
      {
        const k = fact(V(n.a));
        const list = V(n.a) <= 10 && V(n.a) >= 2 ? ' = ' + Array.from({ length: V(n.a) }, (_, i) => V(n.a) - i).join(' × ') : '';
        return r(k, `${F(n.a)}! (factorial) means multiply all the whole numbers from ${F(n.a)} down to 1${list} = ${fmt(k)}.`, 'Factorial');
      }
    case 'bin': {
      const a = V(n.a), b = V(n.b), A = F(n.a), B = fmt(b), Bp = b < 0 ? '(' + B + ')' : B;
      switch (n.op) {
        case '+': {
          let t = `Add: ${A} + ${Bp} = ${fmt(a + b)}.`;
          if (b < 0) t += ` Adding a negative is the same as subtracting ${fmt(-b)}.`;
          return r(a + b, t, 'Add & subtract (left to right)', { op: '+', a, b });
        }
        case '-': {
          let t = `Subtract: ${A} − ${Bp} = ${fmt(a - b)}.`;
          if (b < 0) t += ` Subtracting a negative is the same as adding ${fmt(-b)}.`;
          else if (a < b && a >= 0) t += ` The bigger number is being taken away, so the answer is below zero.`;
          return r(a - b, t, 'Add & subtract (left to right)', { op: '-', a, b });
        }
        case '*': {
          let t = n.of ? `"of" means multiply: ${A} × ${Bp} = ${fmt(a * b)}.` : `Multiply: ${A} × ${Bp} = ${fmt(a * b)}.`;
          if (a < 0 && b < 0) t += ' Negative × negative = positive.';
          else if ((a < 0) !== (b < 0) && a !== 0 && b !== 0) t += ' Negative × positive = negative.';
          return r(a * b, t, 'Multiply & divide (left to right)', { op: '*', a, b });
        }
        case '/': {
          if (b === 0) throw new MathError(`You can't divide by zero. There is no number that times 0 gives ${A}.`);
          const q = a / b;
          let t = `Divide: ${A} ÷ ${Bp} = ${fmt(q)}.`;
          if (isInt(a) && isInt(b) && !isInt(q) && a > 0 && b > 0) t += ` (${A} ÷ ${B} is ${Math.floor(a / b)} remainder ${a % b}${toFrac(q) ? `, or as a fraction ${fracText(a / gcd(a, b), b / gcd(a, b))}` : ''}.)`;
          if ((a < 0) !== (b < 0) && a !== 0) t += ' Signs are different, so the answer is negative.';
          return r(q, t, 'Multiply & divide (left to right)', { op: '/', a, b });
        }
        case 'mod': {
          const v = modv(a, b);
          return r(v, `mod means "the remainder": ${A} ÷ ${Bp} = ${fmt(Math.floor(a / b))} with ${fmt(v)} left over, so ${A} mod ${B} = ${fmt(v)}.`, 'Multiply & divide (left to right)');
        }
        case '^': {
          if (a === 0 && b <= 0) throw new MathError('0 to the power of 0 or a negative power is undefined.');
          const v = Math.pow(a, b);
          if (Number.isNaN(v)) throw new MathError(`${A}^${B} has no real answer (a negative number to a fraction power).`);
          let t;
          if (b === 0) t = `Anything (except 0) to the power 0 is 1, so ${A}⁰ = 1.`;
          else if (b === 1) t = `Power 1 means the number itself: ${A}¹ = ${A}.`;
          else if (isInt(b) && b > 1 && b <= 8) t = `${A}^${B} means ${A} multiplied by itself ${B} times: ${Array(b).fill(a < 0 ? '(' + A + ')' : A).join(' × ')} = ${fmt(v)}.`;
          else if (isInt(b) && b < 0) t = `A negative power means "1 divided by": ${A}^${B} = 1 ÷ ${A}^${fmt(-b)} = 1 ÷ ${fmt(Math.pow(a, -b))} = ${fmt(v)}.`;
          else if (Math.abs(b - 0.5) < 1e-12) t = `A power of ½ is a square root: ${A}^0.5 = √${A} = ${fmt(v)}.`;
          else t = `${A}^${B} = ${fmt(v)}.`;
          return r(v, t, 'Exponents', { op: '^', a, b });
        }
      }
    }
  }
}
const fracText = (a, b) => `${fmt(a)}/${fmt(b)}`;
const RANK = { const: 6, fn: 5, post: 5, neg: 4 };
const rankOf = n => n.t === 'bin' ? (n.op === '^' ? 4 : n.op === '+' || n.op === '-' ? 2 : 3) : RANK[n.t];
function reducible(n) {
  switch (n.t) {
    case 'const': return true;
    case 'fn': case 'post': case 'neg': return n.a.t === 'num';
    case 'bin': return n.a.t === 'num' && n.b.t === 'num';
  }
  return false;
}
function kids(n) { return n.t === 'bin' ? [n.a, n.b] : n.a ? [n.a] : []; }
/** The leftmost innermost set of brackets that still has work to do. */
function findScope(n) {
  for (const k of kids(n)) { const s = findScope(k); if (s) return s; }
  return (n.scope || n.root) && n.t !== 'num' ? n : null;
}
function candidates(n, out = []) {
  if (reducible(n)) out.push(n);
  for (const k of kids(n)) if (!(k.scope && k.t !== 'num' && k !== n)) candidates(k, out);
  return out;
}
export function hasVar(n, name) { return (n.t === 'var' && (!name || (n.name || 'x') === name)) || kids(n).some(k => hasVar(k, name)); }

/** Works out an expression with no x, returning every step. */
export function stepsFor(tree, ctx) {
  const root = { t: 'bin', op: '+', a: { t: 'num', v: 0 }, b: tree }; // holder so the top node can be replaced in place
  tree.root = true;
  const steps = []; let guard = 0;
  while (root.b.t !== 'num') {
    if (guard++ > 300) throw new MathError('That problem is too long for me.');
    const scope = findScope(root.b) || root.b;
    const list = candidates(scope);
    if (!list.length) throw new MathError('I got stuck on that one.');
    let best = list[0];
    for (const c of list) if (rankOf(c) > rankOf(best)) best = c;
    const inParens = scope.paren || (scope !== root.b && scope.scope);
    const before = show(root.b, { html: true, hl: best, frac: false });
    const res = reduceNode(best, ctx);
    const wasParen = best.paren;
    for (const k of Object.keys(best)) if (k !== 'root') delete best[k];
    Object.assign(best, { t: 'num', v: res.v });
    let rule = res.rule;
    if (inParens && scope !== best && rule !== 'Numbers') rule = 'Inside the brackets first → ' + rule;
    let text = res.text;
    if (wasParen) text += ' The brackets are finished, so they go away.';
    const after = show(root.b, { html: true, hl: best, hlNew: true });
    steps.push({ rule, text, before, after, method: res.method });
  }
  return { value: root.b.v, steps };
}

// ---------- polynomials in x (for equations) ----------
function polyOf(f) {
  const c = f(0), p1 = f(1), m1 = f(-1);
  const a = clean((p1 + m1) / 2 - c), b = clean((p1 - m1) / 2);
  for (const x of [2, -3, 0.5, 7]) {
    const want = a * x * x + b * x + c, got = f(x);
    if (!isFinite(got) || Math.abs(got - want) > 1e-7 * Math.max(1, Math.abs(want))) return null;
  }
  return { a, b, c: clean(c) };
}
/** "3x² − 5x + 6" */
export function polyStr({ a = 0, b = 0, c = 0 }, html = true) {
  const parts = [];
  const term = (k, s) => {
    if (Math.abs(k) < 1e-12) return;
    const neg = k < 0, m = Math.abs(k);
    const coef = s && Math.abs(m - 1) < 1e-12 ? '' : fmt(m);
    parts.push({ neg, s: coef + s });
  };
  term(a, html ? 'x<sup>2</sup>' : 'x²'); term(b, 'x'); term(c, '');
  if (!parts.length) return '0';
  return parts.map((p, i) => i === 0 ? (p.neg ? '−' : '') + p.s : (p.neg ? ' − ' : ' + ') + p.s).join('');
}
const sideStr = (m, k) => polyStr({ b: m, c: k });
const rt = (n) => { const v = clean(n); return fmt(v); };

function solveEquation(src, ctx) {
  const parts = src.split('=');
  if (parts.length > 2) throw new MathError('An equation should have just one = sign.');
  if (!parts[0].trim() || !parts[1].trim()) throw new MathError('Put something on both sides of the = sign.');
  const L = parse(parts[0]), R = parse(parts[1]);
  const Ls = show(L, { html: true }), Rs = show(R, { html: true });
  const start = `${Ls} = ${Rs}`;
  if (!hasVar(L) && !hasVar(R)) {
    const l = stepsFor(L, ctx), r = stepsFor(R, ctx);
    const ok = Math.abs(l.value - r.value) < 1e-9 * Math.max(1, Math.abs(l.value));
    const steps = [
      ...l.steps.map(s => ({ ...s, rule: 'Left side: ' + s.rule })),
      ...r.steps.map(s => ({ ...s, rule: 'Right side: ' + s.rule })),
      { rule: 'Compare', text: `The left side is ${fmt(l.value)} and the right side is ${fmt(r.value)}. ${ok ? 'They match, so the statement is TRUE.' : 'They are different, so the statement is FALSE.'}`, before: `${fmt(l.value)} ${ok ? '=' : '≠'} ${fmt(r.value)}` },
    ];
    return { kind: 'check', ok, answer: ok ? 'TRUE' : 'FALSE', lcd: ok ? 'trUE' : 'FALSE', steps, start, title: 'Is it true?' };
  }
  const fL = x => evalNode(L, ctx, x), fR = x => evalNode(R, ctx, x);
  const pL = polyOf(fL), pR = polyOf(fR);
  const P = pL && pR ? { a: clean(pL.a - pR.a), b: clean(pL.b - pR.b), c: clean(pL.c - pR.c) } : null;
  if (!P) return numericSolve(fL, fR, start);
  const steps = [];
  const check = (x) => {
    const tidy = v => Math.abs(v) < 1e-8 ? 0 : v;
    const l = tidy(fL(x)), r = tidy(fR(x));
    return { rule: 'Check your answer', text: `Put x = ${fmt(x)} back into the original: left side = ${fmt(l)}, right side = ${fmt(r)}. ${Math.abs(l - r) < 1e-6 * Math.max(1, Math.abs(l)) ? 'They match ✔' : 'Close (rounding) ✔'}`, before: start.replace(/x/g, `(${fmt(x)})`).replace(/(\d)\(/g, '$1·(') };
  };
  if (Math.abs(P.a) < 1e-12) {
    // ---- linear: mx + k = nx + j
    let m = pL.b, k = pL.c, n = pR.b, j = pR.c;
    const simple = sideStr(m, k) + ' = ' + sideStr(n, j);
    if (simple.replace(/<[^>]+>/g, '') !== start.replace(/<[^>]+>/g, '').replace(/\s/g, ' ')) steps.push({ rule: 'Simplify each side', text: 'Multiply out any brackets and combine like terms (x-terms together, plain numbers together) on each side.', before: start, after: simple });
    if (Math.abs(n) > 1e-12) {
      const how = n > 0 ? `Subtract ${polyStr({ b: n })} from both sides` : `Add ${polyStr({ b: -n })} to both sides`;
      const ns = sideStr(clean(m - n), k) + ' = ' + sideStr(0, j);
      steps.push({ rule: 'Get the x’s on one side', text: `${how} so all the x's are on the left. Whatever you do to one side, do to the other.`, before: simple, after: ns });
      m = clean(m - n); n = 0;
    }
    if (Math.abs(m) < 1e-12) {
      const inf = Math.abs(k - j) < 1e-12;
      steps.push({ rule: inf ? 'Every number works' : 'No solution', text: inf ? `The x's cancelled out and you're left with ${fmt(k)} = ${fmt(j)}, which is always true. So x can be ANY number.` : `The x's cancelled out and you're left with ${fmt(k)} = ${fmt(j)}, which is never true. So no value of x works.`, before: `${fmt(k)} ${inf ? '=' : '≠'} ${fmt(j)}` });
      return { kind: 'eqn', answer: inf ? 'any number' : 'no solution', lcd: inf ? 'ALL' : 'nonE', steps, start, title: 'Solve for x' };
    }
    const cur = sideStr(m, k) + ' = ' + fmt(j);
    if (Math.abs(k) > 1e-12) {
      const nj = clean(j - k);
      steps.push({ rule: 'Undo the plain number', text: k > 0 ? `Subtract ${fmt(k)} from both sides: ${fmt(j)} − ${fmt(k)} = ${fmt(nj)}.` : `Add ${fmt(-k)} to both sides: ${fmt(j)} + ${fmt(-k)} = ${fmt(nj)}.`, before: cur, after: `${sideStr(m, 0)} = ${fmt(nj)}`, method: k > 0 ? { op: '-', a: j, b: k } : { op: '+', a: j, b: -k } });
      j = nj;
    }
    const x = clean(j / m);
    if (Math.abs(m - 1) > 1e-12) {
      const fr = toFrac(x);
      steps.push({ rule: 'Undo the multiply', text: Math.abs(m + 1) < 1e-12 ? `−x = ${fmt(j)}, so flip the sign of both sides.` : `x is being multiplied by ${fmt(m)}, so divide both sides by ${fmt(m)}: ${fmt(j)} ÷ ${fmt(m)} = ${fmt(x)}${fr ? ` (that's ${fr[0]}/${fr[1]} as a fraction)` : ''}.`, before: `${sideStr(m, 0)} = ${fmt(j)}`, after: `x = ${fmt(x)}`, method: { op: '/', a: j, b: m } });
    }
    steps.push(check(x));
    return { kind: 'eqn', answer: `x = ${fmt(x)}`, roots: [x], lcd: fmt(x), steps, start, title: 'Solve for x' };
  }
  // ---- quadratic: ax² + bx + c = 0
  let { a, b, c } = P;
  let form = polyStr(P) + ' = 0';
  if (form.replace(/<[^>]+>|\s/g, '') !== start.replace(/<[^>]+>|\s/g, '')) steps.push({ rule: 'Make one side zero', text: 'Move every term to the left side (do the opposite on both sides) so the right side is 0. Now it looks like ax² + bx + c = 0.', before: start, after: form });
  if (a < 0) { a = -a; b = -b; c = -c; const nf = polyStr({ a, b, c }) + ' = 0'; steps.push({ rule: 'Make x² positive', text: 'Multiply every term by −1. It is easier when the x² term is positive.', before: form, after: nf }); form = nf; }
  if ([a, b, c].every(isInt)) {
    const g = [a, b, c].filter(v => v !== 0).reduce((s, v) => gcd(s, v));
    if (g > 1) { a /= g; b /= g; c /= g; const nf = polyStr({ a, b, c }) + ' = 0'; steps.push({ rule: 'Divide out a common factor', text: `Every number can be divided by ${g}, so divide both sides by ${g} to make it simpler.`, before: form, after: nf }); form = nf; }
  }
  const D = clean(b * b - 4 * a * c);
  const sq = Math.sqrt(Math.abs(D));
  // Factor it when it's a nice x² + bx + c with whole-number answers.
  if (a === 1 && isInt(b) && isInt(c) && D >= 0 && isInt(sq)) {
    const r1 = clean((-b - sq) / 2), r2 = clean((-b + sq) / 2);
    const p = -r1, q = -r2;
    const fac = (k) => k === 0 ? 'x' : `(x ${k > 0 ? '+' : '−'} ${fmt(Math.abs(k))})`;
    if (c === 0) steps.push({ rule: 'Factor', text: `Both terms have an x, so pull it out.`, before: form, after: `x${fac(p === 0 ? q : p)} = 0` });
    else steps.push({ rule: 'Factor', text: `Find two numbers that multiply to ${fmt(c)} and add to ${fmt(b)}. They are ${fmt(p)} and ${fmt(q)} (${fmt(p)} × ${fmt(q)} = ${fmt(c)}, ${fmt(p)} + ${fmt(q)} = ${fmt(b)}).`, before: form, after: `${fac(p)}${fac(q)} = 0` });
    if (r1 === r2) {
      steps.push({ rule: 'Solve', text: `Both brackets are the same, so there's just one answer: x = ${fmt(r1)}.`, before: `${fac(p)}² = 0`, after: `x = ${fmt(r1)}` });
      steps.push(check(r1));
      return { kind: 'eqn', answer: `x = ${fmt(r1)}`, roots: [r1], lcd: fmt(r1), steps, start, title: 'Solve for x' };
    }
    steps.push({ rule: 'Zero product rule', text: `If two things multiply to 0, one of them must be 0. So set each bracket equal to 0.`, before: `${fac(p)} = 0  or  ${fac(q)} = 0`, after: `x = ${fmt(r1)}  or  x = ${fmt(r2)}` });
    steps.push(check(r1), check(r2));
    return { kind: 'eqn', answer: `x = ${fmt(r1)} or x = ${fmt(r2)}`, roots: [r1, r2], lcd: fmt(r1), steps, start, title: 'Solve for x' };
  }
  steps.push({ rule: 'Use the quadratic formula', text: `Here a = ${fmt(a)}, b = ${fmt(b)}, c = ${fmt(c)}. The formula works for every quadratic.`, before: 'x = <span class="frac"><span>−b ± √(b<sup>2</sup> − 4ac)</span><span>2a</span></span>' });
  steps.push({ rule: 'Find the discriminant', text: `The part under the √ is b² − 4ac = (${fmt(b)})² − 4 × ${fmt(a)} × ${fmt(c)} = ${fmt(b * b)} − ${fmt(4 * a * c)} = ${fmt(D)}. ${D > 0 ? 'Positive, so there are 2 answers.' : D === 0 ? 'Zero, so there is exactly 1 answer.' : 'Negative, so there are no real answers.'}`, before: `b<sup>2</sup> − 4ac = ${fmt(D)}` });
  if (D < 0) {
    const re = clean(-b / (2 * a)), im = clean(sq / (2 * a));
    steps.push({ rule: 'No real solutions', text: `You can't take the square root of a negative number with real numbers, so the graph never touches the x-axis. (With imaginary numbers: x = ${fmt(re)} ± ${fmt(im)}i.)`, before: `x = ${fmt(re)} ± ${fmt(im)}i` });
    return { kind: 'eqn', answer: 'no real solution', lcd: 'nonE', steps, start, title: 'Solve for x' };
  }
  const r1 = clean((-b - sq) / (2 * a)), r2 = clean((-b + sq) / (2 * a));
  const sr = simpRoot(D);
  const rootTxt = isInt(sq) ? fmt(sq) : sr ? `${sr[0]}√${sr[1]}` : `√${fmt(D)}`;
  steps.push({ rule: 'Plug in', text: `Put the numbers in: x = (${fmt(-b)} ± ${rootTxt}) ÷ ${fmt(2 * a)}.${isInt(sq) ? '' : ` √${fmt(D)} ≈ ${fmt(sq)}.`}`, before: `x = <span class="frac"><span>${fmt(-b)} ± ${rootTxt}</span><span>${fmt(2 * a)}</span></span>`, after: D === 0 ? `x = ${fmt(r1)}` : `x = ${fmt(r2)}  or  x = ${fmt(r1)}` });
  if (D === 0) { steps.push(check(r1)); return { kind: 'eqn', answer: `x = ${fmt(r1)}`, roots: [r1], lcd: fmt(r1), steps, start, title: 'Solve for x' }; }
  steps.push(check(r2), check(r1));
  return { kind: 'eqn', answer: `x = ${fmt(r2)} or x = ${fmt(r1)}`, roots: [r2, r1], lcd: fmt(r2), steps, start, title: 'Solve for x' };
}

function numericSolve(fL, fR, start) {
  const f = x => fL(x) - fR(x);
  const roots = [];
  let px = -1000, pv = f(px);
  for (let i = 1; i <= 40000; i++) {
    const x = -1000 + i * 0.05, v = f(x);
    if (isFinite(v) && isFinite(pv) && (v === 0 || pv * v < 0) && Math.abs(v - pv) < 1e3) {
      let lo = px, hi = x;
      for (let k = 0; k < 80; k++) { const mid = (lo + hi) / 2; if (f(lo) * f(mid) <= 0) hi = mid; else lo = mid; }
      const rr = clean((lo + hi) / 2);
      if (!roots.some(q => Math.abs(q - rr) < 1e-6)) roots.push(rr);
      if (roots.length >= 6) break;
    }
    px = x; pv = v;
  }
  const steps = [{ rule: 'A harder kind of equation', text: 'This one isn’t a straight-line (linear) or x² (quadratic) equation, so there are no simple "undo" steps. Instead I tried x values from −1000 to 1000 and zoomed in wherever the two sides crossed.', before: start }];
  if (!roots.length) { steps.push({ rule: 'No solution found', text: 'The two sides never meet between −1000 and 1000.', before: 'no solution found' }); return { kind: 'eqn', answer: 'no solution found', lcd: 'nonE', steps, start, title: 'Solve for x' }; }
  steps.push({ rule: 'Answers', text: `The sides are equal when x = ${roots.map(fmt).join(', ')}. (Rounded answers.)`, before: roots.map(r => `x ≈ ${fmt(r)}`).join('   ') });
  return { kind: 'eqn', answer: roots.map(r => `x ≈ ${fmt(r)}`).join(' or '), roots, lcd: fmt(roots[0]), steps, start, title: 'Solve for x' };
}

// ---------- fractions shown the school way ----------
function fracLit(n) {
  if (n.t === 'num' && isInt(n.v)) return [n.v, 1];
  if (n.t === 'bin' && n.op === '/' && n.a.t === 'num' && n.b.t === 'num' && isInt(n.a.v) && isInt(n.b.v) && n.b.v !== 0) return [n.a.v, n.b.v];
  if (n.t === 'neg') { const f = fracLit(n.a); return f && [-f[0], f[1]]; }
  return null;
}
function fracWay(tree, src) {
  // a/b × c/d and a/b ÷ c/d read left-to-right as one long chain, so spot them in the text instead
  const m = /^\s*(-?\d+)\s*(?:\/\s*(\d+))?\s*([*/])\s*(\d+)\s*(?:\/\s*(\d+))?\s*$/.exec(src.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-'));
  if (m && m[3] === '*' && (m[2] || m[5]) || m && m[3] === '/' && m[2] && m[5]) {
    const lit = (a, b) => b ? { t: 'bin', op: '/', a: { t: 'num', v: +a }, b: { t: 'num', v: +b } } : { t: 'num', v: +a };
    tree = { t: 'bin', op: m[3], a: lit(m[1], m[2]), b: lit(m[4], m[5]) };
  }
  const F = (a, b) => b === 1 ? fmt(a) : (a < 0 ? '−' : '') + fracHTML(Math.abs(a), b);
  const steps = []; let N, Dn, start;
  const single = fracLit(tree);
  if (single && single[1] !== 1 && single[0] % single[1] === 0) return null;   // plain division: long division explains it better
  if (single && single[1] !== 1) { [N, Dn] = single; start = F(N, Dn); }
  else {
    if (tree.t !== 'bin' || tree.op === '^' || tree.paren) return null;
    const x = fracLit(tree.a), y = fracLit(tree.b);
    if (!x || !y || (x[1] === 1 && y[1] === 1)) return null;
    if (x[1] < 0 || y[1] < 0) return null;
    let [a, b] = x, [c, d] = y;
    const sym = { '+': '+', '-': '−', '*': '×', '/': '÷' }[tree.op];
    start = `${F(a, b)} ${sym} ${F(c, d)}`;
    if (tree.op === '+' || tree.op === '-') {
      if (b === d) {
        N = tree.op === '+' ? a + c : a - c; Dn = b;
        steps.push({ rule: 'Same denominator', text: `The bottoms are already the same (${b}), so just ${tree.op === '+' ? 'add' : 'subtract'} the tops and keep the bottom: ${fmt(a)} ${sym} ${fmt(c)} = ${fmt(N)}.`, before: start, after: F(N, Dn) });
      } else {
        const L = lcm(b, d), mb = L / b, md = L / d;
        const mult = (k) => Array.from({ length: Math.min(L / k, 6) }, (_, i) => k * (i + 1)).join(', ') + (L / k > 6 ? ', … ' + L : '');
        steps.push({ rule: 'Find a common denominator', text: `The bottoms (${b} and ${d}) are different, so you can't add yet. Find the smallest number both go into — the LCD. Multiples of ${b}: ${mult(b)}. Multiples of ${d}: ${mult(d)}. The LCD is ${L}.`, before: start });
        const nx = a * mb, ny = c * md;
        steps.push({ rule: 'Rewrite each fraction', text: `Change each fraction to have ${L} on the bottom. Multiply top and bottom by the same number: ${fmt(a)}/${b} × ${mb}/${mb}${b === 1 ? ' (a whole number is itself over 1)' : ''}, and ${fmt(c)}/${d} × ${md}/${md}.`, before: start, after: `${F(nx, L)} ${sym} ${F(ny, L)}` });
        N = tree.op === '+' ? nx + ny : nx - ny; Dn = L;
        steps.push({ rule: `${tree.op === '+' ? 'Add' : 'Subtract'} the tops`, text: `Now the bottoms match: ${fmt(nx)} ${sym} ${fmt(ny)} = ${fmt(N)}. Keep the bottom as ${L}.`, before: `${F(nx, L)} ${sym} ${F(ny, L)}`, after: F(N, Dn), method: { op: tree.op, a: nx, b: ny } });
      }
    } else if (tree.op === '*') {
      N = a * c; Dn = b * d;
      steps.push({ rule: 'Multiply straight across', text: `Top × top: ${fmt(a)} × ${fmt(c)} = ${fmt(N)}. Bottom × bottom: ${b} × ${d} = ${Dn}. (No common denominator needed for ×.)`, before: start, after: F(N, Dn) });
    } else {
      if (c === 0) throw new MathError("You can't divide by zero.");
      const flip = c < 0 ? [-d, -c] : [d, c];
      steps.push({ rule: 'Keep, change, flip', text: `Dividing by a fraction is the same as multiplying by it flipped over. Keep ${F(a, b).replace(/<[^>]+>/g, '') === F(a, b) ? F(a, b) : 'the first'}, change ÷ to ×, flip ${fmt(c)}/${d} to ${fmt(flip[0])}/${flip[1]}.`, before: start, after: `${F(a, b)} × ${F(flip[0], flip[1])}` });
      N = a * flip[0]; Dn = b * flip[1];
      steps.push({ rule: 'Multiply straight across', text: `Top × top = ${fmt(N)}, bottom × bottom = ${Dn}.`, before: `${F(a, b)} × ${F(flip[0], flip[1])}`, after: F(N, Dn) });
    }
  }
  if (Dn < 0) { N = -N; Dn = -Dn; }
  const g = gcd(N, Dn) || 1;
  if (g > 1) {
    steps.push({ rule: 'Simplify', text: `${fmt(Math.abs(N))} and ${Dn} can both be divided by ${g} (their greatest common factor). ${fmt(N)} ÷ ${g} = ${fmt(N / g)}, ${Dn} ÷ ${g} = ${Dn / g}.`, before: F(N, Dn), after: F(N / g, Dn / g) });
    N /= g; Dn /= g;
  } else if (Dn !== 1 && steps.length) steps.push({ rule: 'Already simplest', text: `${fmt(Math.abs(N))} and ${Dn} have no common factor bigger than 1, so this fraction can't be simplified.`, before: F(N, Dn) });
  let answer = Dn === 1 ? fmt(N) : `${fmt(N)}/${Dn}`;
  if (Dn !== 1 && Math.abs(N) > Dn) {
    const w = Math.trunc(N / Dn), rem = Math.abs(N % Dn);
    steps.push({ rule: 'Mixed number', text: `The top is bigger than the bottom (an improper fraction). ${Math.abs(N)} ÷ ${Dn} = ${Math.abs(w)} remainder ${rem}, so it's ${fmt(w)} and ${rem}/${Dn}.`, before: F(N, Dn), after: `${fmt(w)} ${fracHTML(rem, Dn)}`, method: { op: '/', a: Math.abs(N), b: Dn } });
    answer += `  =  ${fmt(w)} ${rem}/${Dn}`;
  }
  if (Dn !== 1) steps.push({ rule: 'As a decimal', text: `Divide the top by the bottom: ${fmt(N)} ÷ ${Dn} = ${fmt(N / Dn)}.`, before: F(N, Dn), after: fmt(N / Dn), method: N > 0 ? { op: '/', a: N, b: Dn } : null });
  if (!steps.length) return null;
  return { kind: 'frac', value: N / Dn, frac: Dn === 1 ? null : [N, Dn], answer, lcd: fmt(N / Dn), steps, start, title: 'Fractions' };
}

/** The main entry: works out anything typed on the calculator. */
const NUMWORDS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100, thousand: 1000, million: 1000000, half: 0.5 };
/** "what is five plus 3 squared?" → "5 + 3^2" */
export function wordsToMath(s) {
  let t = ' ' + s.replace(/[“”"]/g, '') + ' ';
  const R = (re, to) => { t = t.replace(re, to); };
  R(/\b(what\s*is|what's|whats|how much is|calculate|compute|evaluate|work out|find|solve|simplify|please|the answer to)\b/gi, ' ');
  R(/\?/g, ' ');
  R(/\bsquare\s*root\s*of\b/gi, ' sqrt '); R(/\bcube\s*root\s*of\b/gi, ' cbrt ');
  R(/\b(multiplied\s*by|times)\b/gi, ' * '); R(/\b(divided\s*by|over)\b/gi, ' / ');
  R(/\b(plus|added\s*to|and)\b/gi, ' + '); R(/\b(minus|take\s*away|less)\b/gi, ' - ');
  R(/\b(to\s*the\s*power\s*of|raised\s*to(\s*the\s*power\s*of)?|to\s*the)\b/gi, ' ^ ');
  R(/\bsquared\b/gi, '^2'); R(/\bcubed\b/gi, '^3'); R(/\b(percent|per\s*cent)\b/gi, '%');
  R(/\b(is\s*equal\s*to|equals|is)\b/gi, ' = '); R(/\b(remainder|modulo)\b/gi, ' mod ');
  R(/\bfactorial\b/gi, '!'); R(/\b(is\s*)?(greater|more)\s*than\s*or\s*equal\s*to\b/gi, ' >= '); R(/\b(is\s*)?(less|fewer)\s*than\s*or\s*equal\s*to\b/gi, ' <= ');
  R(/\b(is\s*)?(greater|more|bigger)\s*than\b/gi, ' > '); R(/\b(is\s*)?(less|smaller|fewer)\s*than\b/gi, ' < ');
  R(/\b([a-z]+)\b/gi, w => NUMWORDS[w.toLowerCase()] !== undefined ? ' ' + NUMWORDS[w.toLowerCase()] + ' ' : w);
  R(/\s+/g, ' ');
  return t.trim().replace(/^=\s*/, '').replace(/\s*=$/, '');
}

/** The main entry: works out anything typed (or drawn) on the calculator. */
export function solve(src, ctx = {}) {
  let text = String(src).trim();
  if (!text) throw new MathError('Type a problem first.');
  if (/[a-wyz]{3,}/i.test(text.replace(/sin|cos|tan|sqrt|cbrt|log|ln|abs|pi|ans|mod|of/gi, ''))) text = wordsToMath(text);
  if (!text) throw new MathError('Type a problem first.');
  if (/(^|[^a-z])y([^a-z]|$)/i.test(text.replace(/\b(yes|why)\b/gi, ''))) throw new MathError('That has a y in it — open 📈 Graph to draw it, or use just x here.');
  const stats = statsOf(text); if (stats) return stats;
  if (/[<>≤≥]/.test(text)) return solveInequality(text, ctx);
  if (text.includes('=')) return solveEquation(text, ctx);
  // "5x3" with no = sign means 5 times 3
  for (let k = 0; k < 3; k++) text = text.replace(/(\d)\s*[xX]\s*(?=\d)/g, '$1×');
  const tree = parse(text);
  const start = show(tree, { html: true });
  if (hasVar(tree)) {
    const p = polyOf(x => evalNode(tree, ctx, x));
    if (!p) throw new MathError('To solve for x, add an = sign, like 2x + 3 = 11.');
    return { kind: 'simplify', answer: polyStr(p, false), lcd: '', start, title: 'Simplify', steps: [{ rule: 'Combine like terms', text: 'Multiply out brackets, then put the x² terms together, the x terms together and the plain numbers together. (Add an = sign if you want to solve for x.)', before: start, after: polyStr(p) }] };
  }
  const fw = fracWay(tree, text);
  if (fw) return fw;
  const { value, steps } = stepsFor(tree, ctx);
  const fr = toFrac(value, 1000);
  let answer = fmt(value);
  if (fr) answer += `  (= ${fr[0]}/${fr[1]})`;
  if (!steps.length) return numberFacts(value, start);
  return { kind: 'expr', value, frac: fr, answer, lcd: fmt(value), steps, start, title: steps.length > 1 ? 'Order of operations' : 'Work it out' };
}

/** Value of something the student typed as an answer ("3/4", "1 1/2", "-2.5"). */
export function readAnswer(s) {
  s = String(s).trim().replace(/^x\s*=\s*/i, '');
  const mixed = /^(-|−)?\s*(\d+)\s+(\d+)\s*\/\s*(\d+)$/.exec(s);
  if (mixed) return (mixed[1] ? -1 : 1) * (+mixed[2] + mixed[3] / mixed[4]);
  const t = parse(s);
  if (hasVar(t)) throw new MathError('Just the number, please.');
  return evalNode(t, { deg: true });
}

// ---------- one number on its own: tell everything about it ----------
function numberFacts(v, start) {
  const steps = [];
  if (isInt(v) && Math.abs(v) >= 2 && Math.abs(v) < 1e12) {
    const n = Math.abs(v);
    steps.push({ rule: 'Even or odd?', text: n % 2 === 0 ? `${fmt(v)} ends in ${String(n).slice(-1)}, so it splits into 2 equal groups — it's EVEN.` : `${fmt(v)} ends in ${String(n).slice(-1)}, so it can't split into 2 equal groups — it's ODD.`, before: start });
    const pf = []; let m = n;
    for (let f = 2; f * f <= m; f++) while (m % f === 0) { pf.push(f); m /= f; }
    if (m > 1) pf.push(m);
    if (pf.length === 1) steps.push({ rule: 'Prime number!', text: `${fmt(n)} can only be divided evenly by 1 and itself, so it is PRIME.`, before: `${fmt(n)} = 1 × ${fmt(n)}` });
    else {
      const cnt = {}; pf.forEach(f => cnt[f] = (cnt[f] || 0) + 1);
      const pow = Object.entries(cnt).map(([f, c]) => c > 1 ? `${f}<sup>${c}</sup>` : f).join(' × ');
      steps.push({ rule: 'Prime factors (factor tree)', text: `Keep splitting into smaller factors until every piece is prime: ${pf.join(' × ')}.`, before: `${fmt(n)} = ${pow}` });
    }
    if (n <= 1e7) {
      const fs = []; for (let d = 1; d * d <= n; d++) if (n % d === 0) { fs.push(d); if (d * d !== n) fs.push(n / d); }
      fs.sort((a, b) => a - b);
      steps.push({ rule: 'All the factors', text: `These numbers divide ${fmt(n)} evenly (${fs.length} of them). They come in pairs that multiply to ${fmt(n)}.`, before: fs.length > 40 ? fs.slice(0, 40).join(', ') + ', …' : fs.join(', ') });
    }
    const sq = Math.sqrt(n), cb = Math.round(Math.cbrt(n));
    if (isInt(sq)) steps.push({ rule: 'Perfect square', text: `${fmt(sq)} × ${fmt(sq)} = ${fmt(n)}, so ${fmt(n)} is a perfect square.`, before: `√${fmt(n)} = ${fmt(sq)}` });
    if (cb ** 3 === n && cb > 1) steps.push({ rule: 'Perfect cube', text: `${cb} × ${cb} × ${cb} = ${fmt(n)}.`, before: `∛${fmt(n)} = ${cb}` });
    steps.push({ rule: 'Squared and square root', text: `${fmt(v)}² = ${fmt(v * v)}${isInt(sq) ? '' : `, and √${fmt(n)} ≈ ${fmt(sq)}`}.`, before: `${fmt(v)}<sup>2</sup> = ${fmt(v * v)}` });
  } else if (!isInt(v)) {
    const fr = toFrac(v);
    if (fr) steps.push({ rule: 'As a fraction', text: `Read the decimal as a fraction and simplify it.`, before: `${fmt(v)} = ${fracHTML(fr[0], fr[1])}` });
    steps.push({ rule: 'As a percent', text: 'Multiply by 100 to turn a decimal into a percent.', before: `${fmt(v)} × 100 = ${fmt(v * 100)}%` });
    steps.push({ rule: 'Rounding', text: `To the nearest whole number: ${fmt(Math.round(v))}. To 1 decimal place: ${fmt(Math.round(v * 10) / 10)}.`, before: `${fmt(v)} ≈ ${fmt(Math.round(v))}` });
  } else steps.push({ rule: 'Just a number', text: `${fmt(v)} is already as simple as it gets. Try an operation like + − × ÷, or an equation with x.`, before: start });
  return { kind: 'expr', value: v, frac: toFrac(v, 1000), answer: fmt(v), lcd: fmt(v), steps, start, title: 'About this number' };
}

// ---------- inequalities: 2x + 3 > 7 ----------
const REL = { '<': '<', '>': '>', '<=': '≤', '>=': '≥', '≤': '≤', '≥': '≥' };
const flipRel = r => ({ '<': '>', '>': '<', '≤': '≥', '≥': '≤' })[r];
function solveInequality(src, ctx) {
  const m = /^(.*?)(<=|>=|≤|≥|<|>)(.*)$/.exec(src);
  if (!m || /[<>≤≥]/.test(m[3])) throw new MathError('Use just one < or > sign.');
  const rel = REL[m[2]];
  const L = parse(m[1]), R = parse(m[3]);
  const start = `${show(L, { html: true })} ${rel} ${show(R, { html: true })}`;
  const holds = (a, b) => rel === '<' ? a < b - 1e-12 : rel === '>' ? a > b + 1e-12 : rel === '≤' ? a <= b + 1e-12 : a >= b - 1e-12;
  if (!hasVar(L) && !hasVar(R)) {
    const a = evalNode(L, ctx), b = evalNode(R, ctx), ok = holds(a, b);
    return { kind: 'check', ok, answer: ok ? 'TRUE' : 'FALSE', lcd: ok ? 'trUE' : 'FALSE', start, title: 'Is it true?', steps: [{ rule: 'Compare', text: `The left side is ${fmt(a)} and the right side is ${fmt(b)}. ${fmt(a)} ${rel} ${fmt(b)} is ${ok ? 'TRUE' : 'FALSE'}.`, before: `${fmt(a)} ${rel} ${fmt(b)}` }] };
  }
  const fL = x => evalNode(L, ctx, x), fR = x => evalNode(R, ctx, x);
  const pL = polyOf(fL), pR = polyOf(fR), steps = [];
  if (pL && pR && Math.abs(pL.a - pR.a) < 1e-12) {
    let m1 = pL.b, k = pL.c, n = pR.b, j = pR.c, r = rel;
    const simple = sideStr(m1, k) + ` ${r} ` + sideStr(n, j);
    if (simple.replace(/<[^>]+>|\s/g, '') !== start.replace(/<[^>]+>|\s/g, '')) steps.push({ rule: 'Simplify each side', text: 'Multiply out brackets and combine like terms, just like an equation.', before: start, after: simple });
    if (Math.abs(n) > 1e-12) { steps.push({ rule: 'Get the x’s on one side', text: `${n > 0 ? 'Subtract' : 'Add'} ${polyStr({ b: Math.abs(n) })} ${n > 0 ? 'from' : 'to'} both sides. Adding or subtracting never flips the sign.`, before: simple, after: `${sideStr(clean(m1 - n), k)} ${r} ${fmt(j)}` }); m1 = clean(m1 - n); }
    if (Math.abs(m1) < 1e-12) { const ok = holds(k, j); steps.push({ rule: ok ? 'Always true' : 'Never true', text: `The x's cancel, leaving ${fmt(k)} ${r} ${fmt(j)}, which is ${ok ? 'always true — every x works' : 'never true — no x works'}.`, before: `${fmt(k)} ${r} ${fmt(j)}` }); return { kind: 'eqn', answer: ok ? 'every x' : 'no solution', lcd: ok ? 'ALL' : 'nonE', steps, start, title: 'Solve the inequality' }; }
    if (Math.abs(k) > 1e-12) { const nj = clean(j - k); steps.push({ rule: 'Undo the plain number', text: `${k > 0 ? 'Subtract' : 'Add'} ${fmt(Math.abs(k))} ${k > 0 ? 'from' : 'to'} both sides: ${fmt(j)} ${k > 0 ? '−' : '+'} ${fmt(Math.abs(k))} = ${fmt(nj)}.`, before: `${sideStr(m1, k)} ${r} ${fmt(j)}`, after: `${sideStr(m1, 0)} ${r} ${fmt(nj)}` }); j = nj; }
    const x = clean(j / m1);
    if (Math.abs(m1 - 1) > 1e-12) {
      const nr = m1 < 0 ? flipRel(r) : r;
      steps.push({ rule: m1 < 0 ? 'Divide — and FLIP the sign!' : 'Undo the multiply', text: m1 < 0 ? `Divide both sides by ${fmt(m1)}. When you multiply or divide by a NEGATIVE number, the inequality sign flips: ${r} becomes ${nr}.` : `Divide both sides by ${fmt(m1)}.`, before: `${sideStr(m1, 0)} ${r} ${fmt(j)}`, after: `x ${nr} ${fmt(x)}` });
      r = nr;
    }
    const t = r === '<' || r === '≤' ? x - 1 : x + 1;
    steps.push({ rule: 'Check with a number', text: `Try x = ${fmt(t)} (it should work): left side = ${fmt(fL(t))}, right side = ${fmt(fR(t))}, and ${fmt(fL(t))} ${rel} ${fmt(fR(t))} is true ✔. The line on a number line has ${r === '<' || r === '>' ? 'an open circle (x can’t equal ' + fmt(x) + ')' : 'a filled circle (x can equal ' + fmt(x) + ')'} at ${fmt(x)}.`, before: `x = ${fmt(t)}` });
    return { kind: 'eqn', answer: `x ${r} ${fmt(x)}`, lcd: fmt(x), steps, start, title: 'Solve the inequality' };
  }
  // anything else: find where the sides are equal, then test each section
  const f = x => fL(x) - fR(x);
  let roots = [];
  if (pL && pR) {
    const a = pL.a - pR.a, b = pL.b - pR.b, c = pL.c - pR.c, D = b * b - 4 * a * c;
    if (D >= 0) roots = [(-b - Math.sqrt(D)) / (2 * a), (-b + Math.sqrt(D)) / (2 * a)].map(clean).sort((p, q) => p - q);
    steps.push({ rule: 'Where are the sides equal?', text: `First solve ${polyStr({ a, b, c }, false)} = 0 as if it were an equation. ${roots.length ? `That gives x = ${[...new Set(roots)].map(fmt).join(' and x = ')}.` : 'It has no real solutions, so the sides are never equal.'}`, before: `${polyStr({ a, b, c })} = 0` });
  } else {
    let px = -1000, pv = f(px);
    for (let x = -999.95; x <= 1000; x += 0.05) { const v = f(x); if (isFinite(v) && isFinite(pv) && pv * v < 0) { let lo = x - 0.05, hi = x; for (let k2 = 0; k2 < 60; k2++) { const mid = (lo + hi) / 2; if (f(lo) * f(mid) <= 0) hi = mid; else lo = mid; } roots.push(clean((lo + hi) / 2)); } px = x; pv = v; if (roots.length > 8) break; }
    steps.push({ rule: 'Where are the sides equal?', text: `I searched from −1000 to 1000 for where both sides are equal: ${roots.length ? roots.map(fmt).join(', ') : 'nowhere'}.`, before: start });
  }
  roots = [...new Set(roots)];
  const edges = [-Infinity, ...roots, Infinity], parts = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const lo = edges[i], hi = edges[i + 1];
    const t = !isFinite(lo) && !isFinite(hi) ? 0 : !isFinite(lo) ? hi - 1 : !isFinite(hi) ? lo + 1 : (lo + hi) / 2;
    const ok = holds(fL(t), fR(t));
    parts.push({ lo, hi, ok, t: clean(t) });
  }
  const inc = rel === '≤' || rel === '≥';
  steps.push({ rule: 'Test each section', text: 'The equal points cut the number line into sections. Try one number from each section: ' + parts.map(p => `x = ${fmt(p.t)} ${p.ok ? 'works ✔' : 'doesn’t ✘'}`).join('; ') + '.', before: parts.map(p => (p.ok ? '✔ ' : '✘ ') + (isFinite(p.lo) ? fmt(p.lo) + ' < ' : '') + 'x' + (isFinite(p.hi) ? ' < ' + fmt(p.hi) : '')).join('   ') });
  const lt = inc ? '≤' : '<';
  const ans = parts.filter(p => p.ok).map(p => !isFinite(p.lo) && !isFinite(p.hi) ? 'every x' : !isFinite(p.lo) ? `x ${lt} ${fmt(p.hi)}` : !isFinite(p.hi) ? `x ${inc ? '≥' : '>'} ${fmt(p.lo)}` : `${fmt(p.lo)} ${lt} x ${lt} ${fmt(p.hi)}`);
  const answer = ans.length ? ans.join(' or ') : (inc && roots.length ? roots.map(r => `x = ${fmt(r)}`).join(' or ') : 'no solution');
  steps.push({ rule: 'Answer', text: `Keep the sections that work${inc ? ' (and the equal points too, because of the “or equal” sign)' : ''}.`, before: answer });
  return { kind: 'eqn', answer, lcd: roots.length ? fmt(roots[0]) : '', steps, start, title: 'Solve the inequality' };
}

// ---------- lists of numbers: mean, median, mode, range ----------
function statsOf(text) {
  const m = /^\s*(mean|median|mode|range|average|avg|stats|statistics)?\s*(?:of)?\s*\(?\s*([-−\d.\s,;]+?)\s*\)?\s*$/i.exec(text);
  if (!m) return null;
  const body = m[2].replace(/−/g, '-');
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(body.trim())) return null;              // that's just 1,000,000
  const nums = body.split(/[\s,;]+/).filter(Boolean).map(Number);
  if (nums.length < 2 || nums.some(n => !isFinite(n)) || (!m[1] && nums.length < 3 && !/[,;]/.test(body))) return null;
  if (!/[,;\s]/.test(body.trim())) return null;
  const want = (m[1] || 'stats').toLowerCase().replace(/average|avg/, 'mean');
  const sorted = [...nums].sort((a, b) => a - b), n = nums.length, sum = nums.reduce((a, b) => a + b, 0), mean = clean(sum / n);
  const mid = n % 2 ? sorted[(n - 1) / 2] : clean((sorted[n / 2 - 1] + sorted[n / 2]) / 2);
  const cnt = {}; nums.forEach(v => cnt[v] = (cnt[v] || 0) + 1);
  const top = Math.max(...Object.values(cnt)), modes = top > 1 ? Object.keys(cnt).filter(k => cnt[k] === top).map(Number).sort((a, b) => a - b) : [];
  const range = clean(sorted[n - 1] - sorted[0]);
  const list = sorted.map(fmt).join(', ');
  const steps = [{ rule: 'Put them in order', text: `Sort the ${n} numbers from smallest to largest. It makes everything else easier.`, before: list }];
  const stepMean = { rule: 'Mean (average)', text: `Add them all up: ${nums.map(fmt).join(' + ')} = ${fmt(sum)}. Then divide by how many there are (${n}): ${fmt(sum)} ÷ ${n} = ${fmt(mean)}.`, before: `mean = ${fmt(sum)} ÷ ${n} = ${fmt(mean)}`, method: { op: '/', a: sum, b: n } };
  const stepMed = { rule: 'Median (middle)', text: n % 2 ? `There are ${n} numbers (odd), so the median is the one right in the middle — number ${(n + 1) / 2} in the sorted list.` : `There are ${n} numbers (even), so there are two middle numbers, ${fmt(sorted[n / 2 - 1])} and ${fmt(sorted[n / 2])}. The median is halfway between them: (${fmt(sorted[n / 2 - 1])} + ${fmt(sorted[n / 2])}) ÷ 2 = ${fmt(mid)}.`, before: `median = ${fmt(mid)}` };
  const stepMode = { rule: 'Mode (most common)', text: modes.length ? `${modes.map(fmt).join(' and ')} ${modes.length > 1 ? 'show' : 'shows'} up the most (${top} times).` : 'Every number shows up the same number of times, so there is no mode.', before: `mode = ${modes.length ? modes.map(fmt).join(', ') : 'none'}` };
  const stepRange = { rule: 'Range (spread)', text: `Biggest minus smallest: ${fmt(sorted[n - 1])} − ${fmt(sorted[0])} = ${fmt(range)}.`, before: `range = ${fmt(range)}` };
  const pick = { mean: [stepMean], median: [stepMed], mode: [stepMode], range: [stepRange] }[want] || [stepMean, stepMed, stepMode, stepRange];
  steps.push(...pick);
  const answer = want === 'mean' ? `mean = ${fmt(mean)}` : want === 'median' ? `median = ${fmt(mid)}` : want === 'mode' ? `mode = ${modes.length ? modes.map(fmt).join(', ') : 'none'}` : want === 'range' ? `range = ${fmt(range)}` : `mean ${fmt(mean)}, median ${fmt(mid)}, mode ${modes.length ? modes.map(fmt).join(', ') : 'none'}, range ${fmt(range)}`;
  const value = want === 'median' ? mid : want === 'range' ? range : want === 'mode' ? (modes[0] ?? NaN) : mean;
  return { kind: 'stats', value, answer, lcd: fmt(value), steps, start: `${m[1] ? m[1].toLowerCase() + ' of ' : ''}${nums.map(fmt).join(', ')}`, title: 'Statistics' };
}
