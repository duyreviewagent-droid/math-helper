// Trains the digit reader used by Draw mode. node test/train_digits.mjs MNIST_DIR [epochs]
// Writes web/public/js/digit-weights.js. Training pictures are randomly tilted, stretched, moved and made
// thicker or thinner so the network copes with mouse / finger / trackpad handwriting.
import fs from 'node:fs';
import { SIZES, predict } from '../web/public/js/digitnet.js';

const dir = process.argv[2], EPOCHS = +(process.argv[3] || 6);
const read = (f, off) => fs.readFileSync(`${dir}/${f}`).subarray(off);
const trX = read('train-images-idx3-ubyte', 16), trY = read('train-labels-idx1-ubyte', 8);
const teX = read('t10k-images-idx3-ubyte', 16), teY = read('t10k-labels-idx1-ubyte', 8);

let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

// weights
const total = Object.values(SIZES).reduce((a, b) => a + b, 0);
const all = new Float32Array(total), W = {}; { let o = 0; for (const k in SIZES) { W[k] = all.subarray(o, o + SIZES[k]); o += SIZES[k]; } }
const init = (a, fanIn) => { const s = Math.sqrt(2 / fanIn); for (let i = 0; i < a.length; i++) a[i] = gauss() * s; };
init(W.c1w, 25); init(W.c2w, 72); init(W.f1w, 400); init(W.f2w, 64);
const gAll = new Float32Array(total), G = {}, vAll = new Float32Array(total);
{ let o = 0; for (const k in SIZES) { G[k] = gAll.subarray(o, o + SIZES[k]); o += SIZES[k]; } }

function augment(src) {
  const img = new Float32Array(784);
  const ang = (rnd() - 0.5) * 0.5, sc = 0.82 + rnd() * 0.3, sh = (rnd() - 0.5) * 0.4, sy = sc * (0.9 + rnd() * 0.2);
  const tx = (rnd() - 0.5) * 4, ty = (rnd() - 0.5) * 4;
  const c = Math.cos(ang), s = Math.sin(ang);
  // inverse map: output pixel -> source pixel
  const a = c / sc, b = s / sc, d = -s / sy, e = c / sy;
  for (let y = 0; y < 28; y++) for (let x = 0; x < 28; x++) {
    const X = x - 13.5 - tx, Y = y - 13.5 - ty;
    let u = a * X + b * Y + sh * Y / sc + 13.5, v = d * X + e * Y + 13.5;
    const u0 = Math.floor(u), v0 = Math.floor(v), fu = u - u0, fv = v - v0;
    const px = (i, j) => (i < 0 || j < 0 || i > 27 || j > 27) ? 0 : src[j * 28 + i] / 255;
    img[y * 28 + x] = px(u0, v0) * (1 - fu) * (1 - fv) + px(u0 + 1, v0) * fu * (1 - fv) + px(u0, v0 + 1) * (1 - fu) * fv + px(u0 + 1, v0 + 1) * fu * fv;
  }
  const r = rnd();
  if (r < 0.35 || r > 0.8) {             // thicker (dilate) or thinner (erode)
    const out = new Float32Array(784), thick = r < 0.35;
    for (let y = 0; y < 28; y++) for (let x = 0; x < 28; x++) {
      let m = thick ? 0 : 1;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        if (Math.abs(i) + Math.abs(j) > 1) continue;
        const X = x + i, Y = y + j, v = (X < 0 || Y < 0 || X > 27 || Y > 27) ? 0 : img[Y * 28 + X];
        m = thick ? Math.max(m, v) : Math.min(m, v);
      }
      out[y * 28 + x] = thick ? m : (m + img[y * 28 + x]) / 2;
    }
    return out;
  }
  return img;
}

// one training example: forward, then backward into G
const c1 = new Float32Array(8 * 576), p1 = new Float32Array(8 * 144), a1 = new Int32Array(8 * 144);
const c2 = new Float32Array(1600), p2 = new Float32Array(400), a2 = new Int32Array(400), h = new Float32Array(64), out = new Float32Array(10);
const dh = new Float32Array(64), dp2 = new Float32Array(400), dc2 = new Float32Array(1600), dp1 = new Float32Array(8 * 144), dc1 = new Float32Array(8 * 576);
function step(img, label) {
  for (let f = 0; f < 8; f++) for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) {
    let s = W.c1b[f];
    for (let ky = 0; ky < 5; ky++) { const r = (y + ky) * 28 + x, wr = f * 25 + ky * 5; for (let kx = 0; kx < 5; kx++) s += W.c1w[wr + kx] * img[r + kx]; }
    c1[f * 576 + y * 24 + x] = s > 0 ? s : 0;
  }
  for (let f = 0; f < 8; f++) for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) {
    const b = f * 576 + y * 48 + x * 2; let m = b;
    for (const q of [b + 1, b + 24, b + 25]) if (c1[q] > c1[m]) m = q;
    p1[f * 144 + y * 12 + x] = c1[m]; a1[f * 144 + y * 12 + x] = m;
  }
  for (let o = 0; o < 16; o++) for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) {
    let s = W.c2b[o];
    for (let c = 0; c < 8; c++) for (let ky = 0; ky < 3; ky++) { const r = c * 144 + (y + ky) * 12 + x, wr = ((o * 8 + c) * 3 + ky) * 3; for (let kx = 0; kx < 3; kx++) s += W.c2w[wr + kx] * p1[r + kx]; }
    c2[o * 100 + y * 10 + x] = s > 0 ? s : 0;
  }
  for (let o = 0; o < 16; o++) for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
    const b = o * 100 + y * 20 + x * 2; let m = b;
    for (const q of [b + 1, b + 10, b + 11]) if (c2[q] > c2[m]) m = q;
    p2[o * 25 + y * 5 + x] = c2[m]; a2[o * 25 + y * 5 + x] = m;
  }
  for (let j = 0; j < 64; j++) { let s = W.f1b[j]; for (let i = 0; i < 400; i++) s += W.f1w[j * 400 + i] * p2[i]; h[j] = s > 0 ? s : 0; }
  let mx = -1e9;
  for (let k = 0; k < 10; k++) { let s = W.f2b[k]; for (let j = 0; j < 64; j++) s += W.f2w[k * 64 + j] * h[j]; out[k] = s; if (s > mx) mx = s; }
  let sum = 0; for (let k = 0; k < 10; k++) { out[k] = Math.exp(out[k] - mx); sum += out[k]; }
  for (let k = 0; k < 10; k++) out[k] /= sum;
  const loss = -Math.log(out[label] + 1e-9);
  // backward
  dh.fill(0);
  for (let k = 0; k < 10; k++) {
    const d = out[k] - (k === label ? 1 : 0);
    G.f2b[k] += d;
    for (let j = 0; j < 64; j++) { G.f2w[k * 64 + j] += d * h[j]; dh[j] += W.f2w[k * 64 + j] * d; }
  }
  dp2.fill(0);
  for (let j = 0; j < 64; j++) {
    if (h[j] <= 0) continue; const d = dh[j];
    G.f1b[j] += d;
    for (let i = 0; i < 400; i++) { G.f1w[j * 400 + i] += d * p2[i]; dp2[i] += W.f1w[j * 400 + i] * d; }
  }
  dc2.fill(0);
  for (let i = 0; i < 400; i++) if (c2[a2[i]] > 0) dc2[a2[i]] += dp2[i];
  dp1.fill(0);
  for (let o = 0; o < 16; o++) for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) {
    const d = dc2[o * 100 + y * 10 + x]; if (!d) continue;
    G.c2b[o] += d;
    for (let c = 0; c < 8; c++) for (let ky = 0; ky < 3; ky++) {
      const r = c * 144 + (y + ky) * 12 + x, wr = ((o * 8 + c) * 3 + ky) * 3;
      for (let kx = 0; kx < 3; kx++) { G.c2w[wr + kx] += d * p1[r + kx]; dp1[r + kx] += W.c2w[wr + kx] * d; }
    }
  }
  dc1.fill(0);
  for (let i = 0; i < 8 * 144; i++) if (c1[a1[i]] > 0) dc1[a1[i]] += dp1[i];
  for (let f = 0; f < 8; f++) for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) {
    const d = dc1[f * 576 + y * 24 + x]; if (!d) continue;
    G.c1b[f] += d;
    for (let ky = 0; ky < 5; ky++) { const r = (y + ky) * 28 + x, wr = f * 25 + ky * 5; for (let kx = 0; kx < 5; kx++) G.c1w[wr + kx] += d * img[r + kx]; }
  }
  return loss;
}

function testAcc() {
  let ok = 0;
  for (let i = 0; i < 10000; i++) {
    const img = new Float32Array(784); for (let p = 0; p < 784; p++) img[p] = teX[i * 784 + p] / 255;
    const o = predict(img, W); let best = 0; for (let k = 1; k < 10; k++) if (o[k] > o[best]) best = k;
    if (best === teY[i]) ok++;
  }
  return ok / 100;
}

const N = 60000, B = 32, order = [...Array(N).keys()];
let lr = 0.02;
for (let ep = 0; ep < EPOCHS; ep++) {
  for (let i = N - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  let L = 0; const t0 = Date.now();
  for (let bi = 0; bi < N; bi += B) {
    gAll.fill(0);
    for (let k = bi; k < Math.min(N, bi + B); k++) {
      const idx = order[k], src = trX.subarray(idx * 784, idx * 784 + 784);
      const img = rnd() < 0.85 ? augment(src) : Float32Array.from(src, v => v / 255);
      L += step(img, trY[idx]);
    }
    for (let i = 0; i < total; i++) { vAll[i] = 0.9 * vAll[i] - lr * (gAll[i] / B + 1e-4 * all[i]); all[i] += vAll[i]; }
  }
  lr *= 0.6;
  console.log(`epoch ${ep + 1}: loss ${(L / N).toFixed(4)}  test ${testAcc()}%  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  const b64 = Buffer.from(all.buffer).toString('base64');
  fs.writeFileSync(new URL('../web/public/js/digit-weights.js', import.meta.url), `// Trained by test/train_digits.mjs on MNIST (${EPOCHS} epochs, augmented). Float32, base64.\nexport const WEIGHTS = '${b64}';\n`);
}
