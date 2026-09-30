// node test/drag.mjs query x1 y1 x2 y2 → drags the mouse (and double-clicks) and prints any selected text
import { spawn } from 'node:child_process'; import fs from 'node:fs';
const [q, x1, y1, x2, y2] = process.argv.slice(2);
const port = 9400 + Math.floor(Math.random() * 400), dir = `/tmp/claude-501/drag-${port}`;
const ch = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, '--window-size=1440,900', `http://localhost:8173/?${q}`], { stdio: 'ignore' });
let list; for (let i = 0; i < 60 && !list; i++) { await new Promise(r => setTimeout(r, 200)); try { list = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page'); } catch { } }
const ws = new WebSocket(list.webSocketDebuggerUrl); await new Promise(r => ws.addEventListener('open', r));
let id = 0; const pend = new Map(); ws.addEventListener('message', e => { const d = JSON.parse(e.data); if (pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } });
const call = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await new Promise(r => setTimeout(r, 3500));
const m = (type, x, y, extra = {}) => call('Input.dispatchMouseEvent', { type, x: +x, y: +y, button: 'left', clickCount: 1, ...extra });
await m('mousePressed', x1, y1); for (let k = 1; k <= 10; k++) await m('mouseMoved', +x1 + (x2 - x1) * k / 10, +y1 + (y2 - y1) * k / 10, { buttons: 1 }); await m('mouseReleased', x2, y2);
const a = (await call('Runtime.evaluate', { expression: 'getSelection().toString()', returnByValue: true })).result.result.value;
await m('mousePressed', x1, y1, { clickCount: 2 }); await m('mouseReleased', x1, y1, { clickCount: 2 });
const b = (await call('Runtime.evaluate', { expression: 'getSelection().toString()', returnByValue: true })).result.result.value;
console.log('drag:', JSON.stringify(a), ' double-click:', JSON.stringify(b));
ch.kill('SIGKILL'); setTimeout(() => { fs.rmSync(dir, { recursive: true, force: true }); process.exit(0); }, 300);
