import { solve } from '../web/public/js/math.js';
import { mistakes } from '../web/public/js/mistakes.js';
for (const p of process.argv.slice(2)) { const r = solve(p, { deg: true }); console.log('##', p, '→', r.answer); for (const m of mistakes(p, r)) console.log('   ✘', m.wrong, '—', m.why); }
