// A tiny neural network that reads one handwritten digit (a 28×28 picture) and says which of 0–9 it is.
// It was trained on the MNIST handwriting set by test/train_digits.mjs; the weights live in digit-weights.js.
// Layout: conv 5×5 ×8 → ReLU → maxpool 2 → conv 3×3 ×16 → ReLU → maxpool 2 → dense 64 → ReLU → dense 10.
import { WEIGHTS } from './digit-weights.js';

export const SIZES = { c1w: 8 * 25, c1b: 8, c2w: 16 * 8 * 9, c2b: 16, f1w: 64 * 400, f1b: 64, f2w: 10 * 64, f2b: 10 };
export function unpack(b64) {
  const bin = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const all = new Float32Array(bytes.buffer), W = {}; let o = 0;
  for (const k in SIZES) { W[k] = all.subarray(o, o + SIZES[k]); o += SIZES[k]; }
  return W;
}
let W = null;

/** Scores for 0–9 (they add up to 1). */
export function predict(img, weights) {
  const w = weights || (W = W || unpack(WEIGHTS));
  const c1 = new Float32Array(8 * 24 * 24);
  for (let f = 0; f < 8; f++) for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) {
    let s = w.c1b[f];
    for (let ky = 0; ky < 5; ky++) for (let kx = 0; kx < 5; kx++) s += w.c1w[f * 25 + ky * 5 + kx] * img[(y + ky) * 28 + x + kx];
    c1[f * 576 + y * 24 + x] = s > 0 ? s : 0;
  }
  const p1 = new Float32Array(8 * 144);
  for (let f = 0; f < 8; f++) for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) {
    const b = f * 576 + y * 48 + x * 2;
    p1[f * 144 + y * 12 + x] = Math.max(c1[b], c1[b + 1], c1[b + 24], c1[b + 25]);
  }
  const c2 = new Float32Array(16 * 100);
  for (let o = 0; o < 16; o++) for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) {
    let s = w.c2b[o];
    for (let c = 0; c < 8; c++) for (let ky = 0; ky < 3; ky++) for (let kx = 0; kx < 3; kx++) s += w.c2w[((o * 8 + c) * 3 + ky) * 3 + kx] * p1[c * 144 + (y + ky) * 12 + x + kx];
    c2[o * 100 + y * 10 + x] = s > 0 ? s : 0;
  }
  const p2 = new Float32Array(400);
  for (let o = 0; o < 16; o++) for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
    const b = o * 100 + y * 20 + x * 2;
    p2[o * 25 + y * 5 + x] = Math.max(c2[b], c2[b + 1], c2[b + 10], c2[b + 11]);
  }
  const h = new Float32Array(64);
  for (let j = 0; j < 64; j++) { let s = w.f1b[j]; for (let i = 0; i < 400; i++) s += w.f1w[j * 400 + i] * p2[i]; h[j] = s > 0 ? s : 0; }
  const out = new Float32Array(10); let mx = -1e9;
  for (let k = 0; k < 10; k++) { let s = w.f2b[k]; for (let j = 0; j < 64; j++) s += w.f2w[k * 64 + j] * h[j]; out[k] = s; if (s > mx) mx = s; }
  let sum = 0; for (let k = 0; k < 10; k++) { out[k] = Math.exp(out[k] - mx); sum += out[k]; }
  for (let k = 0; k < 10; k++) out[k] /= sum;
  return out;
}
