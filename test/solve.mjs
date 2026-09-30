import { solve, readAnswer } from '../web/public/js/math.js';
import { writtenMethod } from '../web/public/js/methods.js';
const strip = s => (s || '').replace(/<sup>/g, '^').replace(/<[^>]+>/g, '');
for (const p of process.argv.slice(2)) {
  try {
    const r = solve(p, { deg: true, ans: 5 });
    console.log('\n##', p, '→', r.answer, '[' + r.kind + ']');
    for (const s of r.steps) console.log(' -', s.rule, '|', strip(s.before), s.after ? '=> ' + strip(s.after) : '', '|', s.text, s.method && writtenMethod(s.method) ? '[method ' + writtenMethod(s.method).title + ']' : '');
  } catch (e) { console.log('\n##', p, 'ERROR', e.message); }
}
