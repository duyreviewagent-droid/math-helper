// The math brain: reads a problem, works it out one step at a time the way a teacher would,
// and writes down *why* each step happens. Used by the calculator and by Practice mode.

export class MathError extends Error {}

const FUNCS = ['asin', 'acos', 'atan', 'sin', 'cos', 'tan', 'sqrt', 'cbrt', 'log', 'ln', 'abs'];
const WORDS = [...FUNCS, 'pi', 'ans', 'of', 'e', 'x'].sort((a, b) => b.length - a.length);
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
        else if (w === 'of') out.push({ k: 'op', v: '*', of: true });
        else out.push({ k: 'const', v: w });
        word = word.slice(w.length);
      }
      continue;
    }
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
      if (isOp('*') || isOp('/')) { const tk = next(); n = { t: 'bin', op: tk.v, a: n, b: unary(), of: tk.of }; }
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
    while (isOp('!') || isOp('%')) n = { t: 'post', op: next().v, a: n };
    return n;
  }
  function primary() {
    const tk = next();
    if (!tk) throw new MathError('The problem ends too soon — something is missing at the end.');
    if (tk.k === 'num') return { t: 'num', v: tk.v };
    if (tk.k === 'const') return { t: 'const', name: tk.v };
    if (tk.k === 'var') return { t: 'var' };
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
const PREC = { '+': 3, '-': 3, '*': 4, '/': 4 };
/** Writes a tree as text. html=true gives superscripts, pretty fractions and a highlight around `hl`. */
export function show(n, o = {}, pp = 0, right = false) {
  const html = !!o.html; let s, p;
  const sym = { '+': ' + ', '-': ' − ', '*': ' × ', '/': ' ÷ ' };
  switch (n.t) {
    case 'num': s = fmt(n.v); p = n.v < 0 ? (right || pp >= 5 ? 0 : 5) : 9; break;
    case 'const': s = { pi: 'π', e: 'e', ans: 'Ans' }[n.name]; p = 9; break;
    case 'var': s = 'x'; p = 9; break;
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
        else if (n.implicit && n.a.t === 'num' && n.a.v >= 0 && (n.b.t === 'var' || n.b.t === 'const' || (n.b.t === 'bin' && n.b.op === '^' && n.b.a.t === 'var'))) s = l + r;
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
    case 'var': return x;
    case 'const': return n.name === 'pi' ? Math.PI : n.name === 'e' ? Math.E : (ctx.ans ?? 0);
    case 'neg': return -ev(n.a);
    case 'post': return n.op === '%' ? ev(n.a) / 100 : fact(ev(n.a));
    case 'fn': return fnValue(n.name, ev(n.a), ctx).v;
    case 'bin': {
      const a = ev(n.a), b = ev(n.b);
      return n.op === '+' ? a + b : n.op === '-' ? a - b : n.op === '*' ? a * b : n.op === '/' ? a / b : Math.pow(a, b);
    }
  }
}
function fact(n) {
  if (!isInt(n) || n < 0) throw new MathError('Factorial (!) only works on whole numbers 0, 1, 2, 3…');
  if (n > 170) throw new MathError('That factorial is too big for any calculator!');
  let r = 1; for (let i = 2; i <= n; i++) r *= i; return r;
}
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
function hasVar(n) { return n.t === 'var' || kids(n).some(hasVar); }

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
export function solve(src, ctx = {}) {
  const text = String(src).trim();
  if (!text) throw new MathError('Type a problem first.');
  if (text.includes('=')) return solveEquation(text, ctx);
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
  if (!steps.length) steps.push({ rule: 'Nothing to do', text: 'That is already just a number.', before: start });
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
