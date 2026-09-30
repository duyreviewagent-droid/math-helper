// Written (paper-and-pencil) methods: column addition with carrying, subtraction with borrowing,
// long multiplication and long division, drawn on graph paper like a teacher would on the board.
import { fmt, isInt } from './math.js';

const cell = (ch = '', cls = '') => ({ ch, cls });
function grid(rows, note) {
  const w = Math.max(...rows.map(r => r.length));
  const html = rows.map(r => {
    const pad = Array(w - r.length).fill(cell()).concat(r);
    return '<div class="gr">' + pad.map(c => `<span class="gc ${c.cls}">${c.ch}</span>`).join('') + '</div>';
  }).join('');
  return `<div class="grid">${html}</div>` + (note?.length ? '<ol class="mnote">' + note.map(n => `<li>${n}</li>`).join('') + '</ol>' : '');
}
const digits = (s, cls = '') => [...s].map(ch => cell(ch, cls));
const PLACE = ['ones', 'tens', 'hundreds', 'thousands', 'ten-thousands', 'hundred-thousands', 'millions', 'ten-millions', 'hundred-millions'];

/** Lines up decimals: ['12.5', '3.75'] → ['12.50', '03.75'] (same length, same point). */
function align(nums) {
  const dec = Math.max(...nums.map(n => (String(n).split('.')[1] || '').length));
  const strs = nums.map(n => n.toFixed(dec));
  const w = Math.max(...strs.map(s => s.length));
  return { strs: strs.map(s => s.padStart(w, ' ')), dec };
}

function addition(a, b) {
  const { strs: [A, B], dec } = align([a, b]);
  const w = A.length, carry = Array(w + 1).fill(''), res = Array(w + 1).fill('');
  let c = 0; const note = [];
  let place = -dec;
  for (let i = w - 1; i >= 0; i--) {
    if (A[i] === '.') { res[i + 1] = '.'; continue; }
    const x = +(A[i].trim() || 0), y = +(B[i].trim() || 0), s = x + y + c;
    res[i + 1] = String(s % 10);
    const name = place >= 0 ? PLACE[place] : ['tenths', 'hundredths', 'thousandths', 'ten-thousandths'][-place - 1];
    if (note.length < 8) note.push(`${name ? name[0].toUpperCase() + name.slice(1) : 'Next'}: ${x} + ${y}${c ? ' + ' + c + ' (carried)' : ''} = ${s}.${s >= 10 ? ` Write ${s % 10}, carry the 1.` : ''}`);
    c = s >= 10 ? 1 : 0;
    if (c) { let j = i - 1; if (A[j] === '.') j--; carry[j + 1] = '1'; }
    place++;
  }
  if (c) { res[0] = '1'; note.push('Write the last carried 1 at the front.'); }
  const rows = [
    [cell(), ...carry.slice(1).map(ch => cell(ch, 'carry'))],
    [cell(), ...digits(A.replace(/ /g, ' '))],
    [cell('+'), ...digits(B.replace(/ /g, ' '), 'ul')],
    [...res.map(ch => cell(ch, 'ans'))],
  ];
  rows[2][0].cls = 'ul';
  return grid(rows, note);
}

function subtraction(a, b) {
  const { strs: [A, B] } = align([a, b]);
  const top = [...A].map(ch => ch === ' ' ? null : ch === '.' ? '.' : +ch), bot = [...B];
  const orig = [...top], borrowed = Array(A.length).fill(false), res = Array(A.length).fill('');
  const note = [];
  for (let i = A.length - 1; i >= 0; i--) {
    if (top[i] === '.') { res[i] = '.'; continue; }
    const y = +(bot[i].trim() || 0);
    if (top[i] === null) break;
    if (top[i] < y) {
      let j = i - 1; while (j >= 0 && (top[j] === '.' || top[j] === 0)) j--;
      if (note.length < 8) note.push(j < i - 1 || top[i - 1] === '.' && j < i - 2
        ? `${top[i]} is smaller than ${y}. The next column is 0, so borrow from the first non-zero digit to the left — the 0s in between turn into 9s.`
        : `${top[i]} is smaller than ${y}, so borrow 1 from the next column over (it goes down by 1, and this one gets 10 more).`);
      top[j]--; borrowed[j] = true;
      for (let k = j + 1; k < i; k++) if (top[k] !== '.') { top[k] = 9; borrowed[k] = true; }
      top[i] += 10; borrowed[i] = true;
    }
    res[i] = String(top[i] - y);
    if (i === 0 && top[i] === 0 && !bot[i].trim()) continue;
    if (note.length < 8) note.push(`${top[i]} − ${y} = ${top[i] - y}.`);
  }
  let r = res.join('').replace(/^0+(?=\d)/, '');
  const pad = A.length - r.length;
  const rows = [
    top.map((d, i) => cell(borrowed[i] && d !== '.' ? String(d) : '', 'carry')),
    [...A].map((ch, i) => cell(ch === ' ' ? '' : ch, borrowed[i] ? 'strike' : '')),
    [...B].map(ch => cell(ch === ' ' ? '' : ch, 'ul')),
    [...Array(pad).fill(''), ...r].map(ch => cell(ch, 'ans')),
  ];
  rows.forEach(rw => rw.unshift(cell()));
  rows[2][0] = cell('−', 'ul');
  return grid(rows, note);
}

function multiplication(a, b) {
  const A = String(a), B = String(b);
  const note = [], partial = [];
  for (let i = B.length - 1, sh = 0; i >= 0; i--, sh++) {
    const d = +B[i], p = a * d;
    partial.push(String(p) + '0'.repeat(sh));
    note.push(`${A} × ${d}${sh ? ` (really ${d}${'0'.repeat(sh)}, so put ${sh} zero${sh > 1 ? 's' : ''} at the end first)` : ''} = ${fmt(p * 10 ** sh)}.`);
  }
  const total = String(a * b);
  const rows = [digits(A), [cell('×', 'ul'), ...digits(B, 'ul')]];
  if (partial.length > 1) {
    partial.forEach((p, i) => { const r = [...p].map((ch, k) => cell(ch, k >= p.length - i && i > 0 ? 'zero' : '')); if (i === partial.length - 1) { r.forEach(c => c.cls += ' ul'); r.unshift(cell('+', 'ul')); } rows.push(r); });
    note.push(`Add the rows together: ${partial.map(p => +p).join(' + ')} = ${total}.`);
  }
  rows.push(digits(total, 'ans'));
  return grid(rows, note);
}

function longDivision(a, b) {
  const A = String(a), note = [];
  let q = '', rem = 0, started = false;
  const work = []; // [ {col, sub, left} ]
  for (let i = 0; i < A.length; i++) {
    const cur = rem * 10 + +A[i];
    const d = Math.floor(cur / b);
    if (d > 0 || started || i === A.length - 1) {
      started = true;
      if (note.length < 9) note.push(`How many ${b}s fit in ${cur}? ${d}. (${d} × ${b} = ${d * b}) → ${cur} − ${d * b} = ${cur - d * b}${i < A.length - 1 ? `, bring down the ${A[i + 1]}` : ''}.`);
      work.push({ col: i, cur, sub: d * b, left: cur - d * b });
    }
    q += started ? d : '';
    rem = cur - d * b;
  }
  if (!q) q = '0';
  const W = A.length, B = String(b), off = B.length + 1;
  const rows = [];
  const lead = n => Array(n).fill(cell());
  rows.push([...lead(off + W - q.length), ...digits(q, 'ans')]);
  rows.push([...digits(B), cell(')', 'bracket'), ...digits(A, 'over')]);
  work.forEach((w, k) => {
    const s = String(w.sub), c = String(w.cur);
    if (k > 0) rows.push([...lead(off + w.col + 1 - c.length), ...digits(c)]);
    rows.push([...lead(off + w.col + 1 - s.length - 1), cell('−'), ...digits(s, 'ul')]);
  });
  const last = work[work.length - 1];
  if (last) rows.push([...lead(off + last.col + 1 - String(last.left).length), ...digits(String(last.left), 'rem')]);
  note.push(rem ? `Nothing left to bring down. Answer: ${q} remainder ${rem}${rem ? ` (= ${fmt(a / b)} as a decimal)` : ''}.` : `The remainder is 0, so ${A} ÷ ${b} = ${q} exactly.`);
  return grid(rows, note);
}

/** Paper method for one operation, or null when there isn't a nice one. */
export function writtenMethod(m) {
  if (!m) return null;
  let { op, a, b } = m;
  if (!isFinite(a) || !isFinite(b)) return null;
  const dp = v => (String(v).split('.')[1] || '').length;
  const ok = v => v >= 0 && v < 1e9 && dp(v) <= 4;
  if (op === '+' && ok(a) && ok(b) && (a >= 10 || b >= 10)) return { title: 'Column addition', html: addition(a, b) };
  if (op === '-' && ok(a) && ok(b) && a >= b && a >= 10) return { title: 'Column subtraction', html: subtraction(a, b) };
  if (op === '*' && isInt(a) && isInt(b) && a >= 0 && b >= 0) {
    if (b > a && String(a).length <= 3) [a, b] = [b, a];
    if ((a >= 10 || b >= 10) && String(b).length <= 3 && String(a).length <= 7) return { title: 'Long multiplication', html: multiplication(a, b) };
  }
  if (op === '/' && isInt(a) && isInt(b) && a > 0 && b > 0 && b < 1000 && a < 1e10 && a >= b && (a >= 20 || b >= 10)) return { title: 'Long division', html: longDivision(a, b) };
  return null;
}
