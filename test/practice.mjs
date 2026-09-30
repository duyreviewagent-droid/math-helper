import { TOPICS, makeProblem } from '../web/public/js/school.js';
import { solve } from '../web/public/js/math.js';
let bad = 0;
for (const t of TOPICS) for (let l = 0; l < 3; l++) {
  const ex = [];
  for (let i = 0; i < 300; i++) {
    const p = makeProblem(t.id, l);
    try { const s = solve(p.src, { deg: true }); const v = s.value ?? s.roots?.[0];
      if (v === undefined || !isFinite(v)) throw new Error('no answer ' + s.answer);
      if (i < 2) ex.push(`${p.q}  →  ${s.answer}`);
    } catch (e) { bad++; if (bad < 15) console.log('FAIL', t.id, l, p.src, e.message); }
  }
  console.log(t.id.padEnd(6), l, ex.join('   |   '));
}
console.log('failures', bad);
