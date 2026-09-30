// Geometry mode: pick a shape, type its measurements, and see it drawn to scale with every
// length labelled, plus area / perimeter / volume / angles worked out step by step.
import { fmt, clean } from './math.js';

const f = v => fmt(Math.round(clean(v) * 1000) / 1000);
const deg = r => r * 180 / Math.PI, rad = d => d * Math.PI / 180;
const PI = 'π';

/** Each shape: fields to type, and solve(values, unit) → { steps, answers, svg } (or an { error }). */
export const SHAPES = [
  { id: 'rect', name: 'Rectangle', icon: '▭', fields: [['l', 'length', 8], ['w', 'width', 5]], solve: ({ l, w }, u) => {
    const A = l * w, P = 2 * (l + w), d = Math.hypot(l, w);
    return { answers: [['Area', `${f(A)} ${u}²`], ['Perimeter', `${f(P)} ${u}`], ['Diagonal', `${f(d)} ${u}`]], steps: [
      step('Area', 'Area is how many unit squares fit inside. For a rectangle, multiply length × width.', 'A = l × w', `A = ${f(l)} × ${f(w)} = ${f(A)} ${u}²`),
      step('Perimeter', 'Perimeter is the distance all the way around: two lengths and two widths.', 'P = 2(l + w)', `P = 2(${f(l)} + ${f(w)}) = 2 × ${f(l + w)} = ${f(P)} ${u}`),
      step('Diagonal', 'The diagonal cuts the rectangle into two right triangles, so use Pythagoras.', 'd = √(l² + w²)', `d = √(${f(l * l)} + ${f(w * w)}) = √${f(l * l + w * w)} ≈ ${f(d)} ${u}`)],
      svg: rectSVG(l, w, u) };
  } },
  { id: 'square', name: 'Square', icon: '□', fields: [['s', 'side', 6]], solve: ({ s }, u) => ({
    answers: [['Area', `${f(s * s)} ${u}²`], ['Perimeter', `${f(4 * s)} ${u}`], ['Diagonal', `${f(s * Math.SQRT2)} ${u}`]], steps: [
      step('Area', 'All four sides are equal, so area = side × side = side².', 'A = s²', `A = ${f(s)} × ${f(s)} = ${f(s * s)} ${u}²`),
      step('Perimeter', 'Four equal sides.', 'P = 4s', `P = 4 × ${f(s)} = ${f(4 * s)} ${u}`),
      step('Diagonal', 'Pythagoras with two equal sides gives side × √2.', 'd = s√2', `d = ${f(s)} × 1.414… ≈ ${f(s * Math.SQRT2)} ${u}`)],
    svg: rectSVG(s, s, u, true) }) },
  { id: 'tri', name: 'Triangle (base & height)', icon: '△', fields: [['b', 'base', 10], ['h', 'height', 6]], solve: ({ b, h }, u) => ({
    answers: [['Area', `${f(b * h / 2)} ${u}²`]], steps: [
      step('Why half?', 'A triangle is exactly half of a rectangle with the same base and height.', 'A = ½ × b × h', `A = ½ × ${f(b)} × ${f(h)}`),
      step('Area', 'Multiply base × height, then halve it.', `${f(b)} × ${f(h)} = ${f(b * h)}`, `${f(b * h)} ÷ 2 = ${f(b * h / 2)} ${u}²`),
      step('Remember', 'The height must be straight up from the base (at a right angle), not along a slanted side.', 'height ⟂ base')],
    svg: triBHSVG(b, h, u) }) },
  { id: 'tri3', name: 'Triangle (3 sides)', icon: '◬', fields: [['a', 'side a', 5], ['b', 'side b', 6], ['c', 'side c', 7]], solve: ({ a, b, c }, u) => {
    if (a + b <= c || a + c <= b || b + c <= a) return { error: `Those sides can't make a triangle: the two shorter sides must add up to MORE than the longest side (triangle inequality).` };
    const s = (a + b + c) / 2, A = Math.sqrt(s * (s - a) * (s - b) * (s - c));
    const Aa = deg(Math.acos((b * b + c * c - a * a) / (2 * b * c))), Bb = deg(Math.acos((a * a + c * c - b * b) / (2 * a * c))), Cc = 180 - Aa - Bb;
    const kind = Math.abs(Math.max(Aa, Bb, Cc) - 90) < 1e-6 ? 'right' : Math.max(Aa, Bb, Cc) > 90 ? 'obtuse' : 'acute';
    const sides = a === b && b === c ? 'equilateral (all sides equal)' : a === b || b === c || a === c ? 'isosceles (two sides equal)' : 'scalene (no sides equal)';
    return { answers: [['Perimeter', `${f(a + b + c)} ${u}`], ['Area', `${f(A)} ${u}²`], ['Angles', `${f(Aa)}°, ${f(Bb)}°, ${f(Cc)}°`]], steps: [
      step('Perimeter', 'Add the three sides.', 'P = a + b + c', `P = ${f(a)} + ${f(b)} + ${f(c)} = ${f(a + b + c)} ${u}`),
      step("Area (Heron's formula)", `With only the sides, first find s = half the perimeter = ${f(s)}. Then A = √(s(s − a)(s − b)(s − c)).`, `A = √(${f(s)} × ${f(s - a)} × ${f(s - b)} × ${f(s - c)})`, `A = √${f(s * (s - a) * (s - b) * (s - c))} ≈ ${f(A)} ${u}²`),
      step('Angles (law of cosines)', `cos A = (b² + c² − a²) ÷ 2bc, and the same idea for B. The three angles always add to 180°.`, `A ≈ ${f(Aa)}°, B ≈ ${f(Bb)}°`, `C = 180° − ${f(Aa)}° − ${f(Bb)}° ≈ ${f(Cc)}°`),
      step('What kind?', `It is ${kind} (${kind === 'right' ? 'one angle is exactly 90°' : kind === 'obtuse' ? 'one angle is more than 90°' : 'all angles are less than 90°'}) and ${sides}.`, `${kind}, ${sides.split(' ')[0]}`)],
      svg: tri3SVG(a, b, c, [Aa, Bb, Cc], u) };
  } },
  { id: 'right', name: 'Right triangle (Pythagoras)', icon: '◺', note: 'Leave the one you want to find EMPTY.', fields: [['a', 'leg a', 3], ['b', 'leg b', 4], ['c', 'hypotenuse c', '']], solve: ({ a, b, c }, u) => {
    const miss = ['a', 'b', 'c'].filter(k => !isFinite({ a, b, c }[k]));
    if (miss.length !== 1) return { error: 'Fill in exactly TWO of the three sides and leave the other one empty.' };
    const steps = [step('Pythagoras', 'In a right triangle, the two short sides (legs) squared add up to the long side (hypotenuse) squared.', 'a² + b² = c²')];
    if (miss[0] === 'c') { c = Math.hypot(a, b); steps.push(step('Find c', 'Square the legs, add, then take the square root.', `c² = ${f(a)}² + ${f(b)}² = ${f(a * a)} + ${f(b * b)} = ${f(a * a + b * b)}`, `c = √${f(a * a + b * b)} ≈ ${f(c)} ${u}`)); }
    else {
      const leg = miss[0], known = leg === 'a' ? b : a;
      if (!(c > known)) return { error: 'The hypotenuse c has to be the LONGEST side.' };
      const v = Math.sqrt(c * c - known * known); if (leg === 'a') a = v; else b = v;
      steps.push(step(`Find ${leg}`, 'Subtract: the missing leg² = c² − the other leg².', `${leg}² = ${f(c)}² − ${f(known)}² = ${f(c * c)} − ${f(known * known)} = ${f(c * c - known * known)}`, `${leg} = √${f(c * c - known * known)} ≈ ${f(v)} ${u}`));
    }
    const A = deg(Math.atan2(a, b)), B = 90 - A;
    steps.push(step('Angles (SOH-CAH-TOA)', `tan(angle) = opposite ÷ adjacent. The angle across from a: tan⁻¹(${f(a)} ÷ ${f(b)}) ≈ ${f(A)}°. The other is 90° − ${f(A)}° = ${f(B)}°.`, `${f(A)}° + ${f(B)}° + 90° = 180°`));
    steps.push(step('Area and perimeter', 'The legs are the base and height.', `A = ½ × ${f(a)} × ${f(b)} = ${f(a * b / 2)} ${u}²`, `P = ${f(a)} + ${f(b)} + ${f(c)} = ${f(a + b + c)} ${u}`));
    return { answers: [['a', `${f(a)} ${u}`], ['b', `${f(b)} ${u}`], ['c', `${f(c)} ${u}`], ['Area', `${f(a * b / 2)} ${u}²`]], steps, svg: rightSVG(a, b, c, A, B, u, miss[0]) };
  } },
  { id: 'circle', name: 'Circle', icon: '◯', fields: [['r', 'radius', 4]], solve: ({ r }, u) => ({
    answers: [['Diameter', `${f(2 * r)} ${u}`], ['Circumference', `${f(2 * Math.PI * r)} ${u}`], ['Area', `${f(Math.PI * r * r)} ${u}²`]], steps: [
      step('Diameter', 'The diameter goes all the way across through the center: two radiuses.', 'd = 2r', `d = 2 × ${f(r)} = ${f(2 * r)} ${u}`),
      step('Circumference', `The distance around is ${PI} (about 3.14159) times the diameter.`, `C = ${PI}d = 2${PI}r`, `C = 2 × ${PI} × ${f(r)} = ${f(2 * r)}${PI} ≈ ${f(2 * Math.PI * r)} ${u}`),
      step('Area', `Area = ${PI} × radius × radius.`, `A = ${PI}r²`, `A = ${PI} × ${f(r)}² = ${f(r * r)}${PI} ≈ ${f(Math.PI * r * r)} ${u}²`)],
    svg: circleSVG(r, u) }) },
  { id: 'trap', name: 'Trapezoid', icon: '⏢', fields: [['a', 'top', 4], ['b', 'bottom', 8], ['h', 'height', 5]], solve: ({ a, b, h }, u) => ({
    answers: [['Area', `${f((a + b) / 2 * h)} ${u}²`]], steps: [
      step('Idea', 'Average the two parallel sides, then multiply by the height — like turning it into a rectangle.', 'A = (a + b) ÷ 2 × h'),
      step('Average the parallel sides', '', `(${f(a)} + ${f(b)}) ÷ 2 = ${f((a + b) / 2)}`),
      step('Times the height', '', `${f((a + b) / 2)} × ${f(h)} = ${f((a + b) / 2 * h)} ${u}²`)],
    svg: trapSVG(a, b, h, u) }) },
  { id: 'para', name: 'Parallelogram', icon: '▱', fields: [['b', 'base', 9], ['h', 'height', 4], ['s', 'slanted side', 5]], solve: ({ b, h, s }, u) => ({
    answers: [['Area', `${f(b * h)} ${u}²`], ['Perimeter', isFinite(s) ? `${f(2 * (b + s))} ${u}` : '—']], steps: [
      step('Area', 'Cut the triangle off one end and slide it to the other: it becomes a rectangle. So area = base × height (NOT the slanted side).', 'A = b × h', `A = ${f(b)} × ${f(h)} = ${f(b * h)} ${u}²`),
      ...(isFinite(s) ? [step('Perimeter', 'Two bases and two slanted sides.', 'P = 2(b + s)', `P = 2(${f(b)} + ${f(s)}) = ${f(2 * (b + s))} ${u}`)] : [])],
    svg: paraSVG(b, h, s, u) }) },
  { id: 'poly', name: 'Regular polygon', icon: '⬡', fields: [['n', 'number of sides', 6], ['s', 'side length', 4]], solve: ({ n, s }, u) => {
    n = Math.round(n); if (!(n >= 3 && n <= 60)) return { error: 'A polygon needs 3 to 60 sides.' };
    const sum = (n - 2) * 180, ang = sum / n, ap = s / (2 * Math.tan(Math.PI / n)), A = n * s * ap / 2;
    const names = { 3: 'triangle', 4: 'square', 5: 'pentagon', 6: 'hexagon', 7: 'heptagon', 8: 'octagon', 9: 'nonagon', 10: 'decagon', 12: 'dodecagon' };
    return { answers: [['Perimeter', `${f(n * s)} ${u}`], ['Each angle', `${f(ang)}°`], ['Area', `${f(A)} ${u}²`]], steps: [
      step(`A ${names[n] || n + '-gon'}`, `All ${n} sides and all ${n} angles are equal.`, `${n} sides of ${f(s)} ${u}`),
      step('Perimeter', 'Number of sides × side length.', `P = ${n} × ${f(s)} = ${f(n * s)} ${u}`),
      step('Angles', 'Split it into triangles from one corner: you get (n − 2) triangles, each with 180°.', `sum = (${n} − 2) × 180° = ${f(sum)}°`, `each = ${f(sum)}° ÷ ${n} = ${f(ang)}°`),
      step('Area', `The apothem (center to the middle of a side) = s ÷ (2 tan(180°/n)) ≈ ${f(ap)}. Area = ½ × perimeter × apothem.`, `A = ½ × ${f(n * s)} × ${f(ap)}`, `A ≈ ${f(A)} ${u}²`)],
      svg: polySVG(n, s, u) };
  } },
  { id: 'angles', name: 'Angles', icon: '∠', fields: [['A', 'angle A (°)', 50], ['B', 'angle B (°)', 60]], solve: ({ A, B }) => {
    const C = 180 - A - B;
    if (!(C > 0)) return { error: `A triangle's angles add to exactly 180°. ${f(A)}° + ${f(B)}° is already ${f(A + B)}°, so there's no room for a third angle.` };
    const kind = C === 90 || A === 90 || B === 90 ? 'right' : Math.max(A, B, C) > 90 ? 'obtuse' : 'acute';
    return { answers: [['Third angle', `${f(C)}°`], ['Complement of A', A < 90 ? `${f(90 - A)}°` : '—'], ['Supplement of A', `${f(180 - A)}°`]], steps: [
      step('Angles in a triangle', 'The three angles inside any triangle always add up to 180°.', 'A + B + C = 180°'),
      step('Find C', 'Take the two you know away from 180°.', `C = 180° − ${f(A)}° − ${f(B)}°`, `C = ${f(C)}°`),
      step('What kind of triangle?', kind === 'right' ? 'One angle is exactly 90°: a right triangle.' : kind === 'obtuse' ? 'One angle is more than 90°: an obtuse triangle.' : 'All three are less than 90°: an acute triangle.', kind),
      step('Complement & supplement', 'Complementary angles add to 90° (a corner). Supplementary angles add to 180° (a straight line).', A < 90 ? `90° − ${f(A)}° = ${f(90 - A)}°` : `${f(A)}° is too big to have a complement`, `180° − ${f(A)}° = ${f(180 - A)}°`)],
      svg: anglesSVG(A, B, C) };
  } },
  { id: 'box', name: 'Box (prism)', icon: '📦', fields: [['l', 'length', 6], ['w', 'width', 4], ['h', 'height', 3]], solve: ({ l, w, h }, u) => {
    const V = l * w * h, S = 2 * (l * w + l * h + w * h);
    return { answers: [['Volume', `${f(V)} ${u}³`], ['Surface area', `${f(S)} ${u}²`], ['Space diagonal', `${f(Math.hypot(l, w, h))} ${u}`]], steps: [
      step('Volume', 'Volume is how many unit cubes fit inside: the bottom layer (l × w) times how many layers (h).', 'V = l × w × h', `V = ${f(l)} × ${f(w)} × ${f(h)} = ${f(V)} ${u}³`),
      step('Surface area', 'A box has 6 faces in 3 matching pairs: top & bottom, front & back, left & right.', `SA = 2(lw + lh + wh) = 2(${f(l * w)} + ${f(l * h)} + ${f(w * h)})`, `SA = ${f(S)} ${u}²`),
      step('Longest diagonal', 'Pythagoras in 3D.', `d = √(${f(l)}² + ${f(w)}² + ${f(h)}²)`, `d ≈ ${f(Math.hypot(l, w, h))} ${u}`)],
      svg: boxSVG(l, w, h, u) };
  } },
  { id: 'cube', name: 'Cube', icon: '🧊', fields: [['s', 'edge', 5]], solve: ({ s }, u) => ({
    answers: [['Volume', `${f(s ** 3)} ${u}³`], ['Surface area', `${f(6 * s * s)} ${u}²`]], steps: [
      step('Volume', 'Every edge is the same, so volume = s × s × s = s³.', 'V = s³', `V = ${f(s)}³ = ${f(s ** 3)} ${u}³`),
      step('Surface area', 'Six square faces, each s².', 'SA = 6s²', `SA = 6 × ${f(s * s)} = ${f(6 * s * s)} ${u}²`)],
    svg: boxSVG(s, s, s, u) }) },
  { id: 'cyl', name: 'Cylinder', icon: '🥫', fields: [['r', 'radius', 3], ['h', 'height', 8]], solve: ({ r, h }, u) => {
    const V = Math.PI * r * r * h, S = 2 * Math.PI * r * r + 2 * Math.PI * r * h;
    return { answers: [['Volume', `${f(V)} ${u}³`], ['Surface area', `${f(S)} ${u}²`]], steps: [
      step('Volume', `The base is a circle (area ${PI}r²). Stack it up h high.`, `V = ${PI}r²h`, `V = ${PI} × ${f(r)}² × ${f(h)} = ${f(r * r * h)}${PI} ≈ ${f(V)} ${u}³`),
      step('Surface area', `Two circles (top and bottom) plus the label wrapped around — a rectangle 2${PI}r wide and h tall.`, `SA = 2${PI}r² + 2${PI}rh`, `SA = ${f(2 * Math.PI * r * r)} + ${f(2 * Math.PI * r * h)} ≈ ${f(S)} ${u}²`)],
      svg: cylSVG(r, h, u) };
  } },
  { id: 'sphere', name: 'Sphere', icon: '⚽', fields: [['r', 'radius', 5]], solve: ({ r }, u) => ({
    answers: [['Volume', `${f(4 / 3 * Math.PI * r ** 3)} ${u}³`], ['Surface area', `${f(4 * Math.PI * r * r)} ${u}²`]], steps: [
      step('Volume', `A ball's volume is 4/3 × ${PI} × r³.`, `V = 4⁄3 ${PI}r³`, `V = 4⁄3 × ${PI} × ${f(r ** 3)} ≈ ${f(4 / 3 * Math.PI * r ** 3)} ${u}³`),
      step('Surface area', 'The outside is exactly 4 circles of the same radius!', `SA = 4${PI}r²`, `SA = 4 × ${PI} × ${f(r * r)} ≈ ${f(4 * Math.PI * r * r)} ${u}²`)],
    svg: sphereSVG(r, u) }) },
  { id: 'cone', name: 'Cone', icon: '🍦', fields: [['r', 'radius', 3], ['h', 'height', 7]], solve: ({ r, h }, u) => {
    const l = Math.hypot(r, h), V = Math.PI * r * r * h / 3, S = Math.PI * r * r + Math.PI * r * l;
    return { answers: [['Volume', `${f(V)} ${u}³`], ['Slant height', `${f(l)} ${u}`], ['Surface area', `${f(S)} ${u}²`]], steps: [
      step('Volume', 'A cone holds exactly ⅓ of the cylinder with the same base and height.', `V = ⅓${PI}r²h`, `V = ⅓ × ${PI} × ${f(r * r)} × ${f(h)} ≈ ${f(V)} ${u}³`),
      step('Slant height', 'The radius, height and slant make a right triangle.', `l = √(r² + h²) = √(${f(r * r)} + ${f(h * h)})`, `l ≈ ${f(l)} ${u}`),
      step('Surface area', `Circle base + the curved side (${PI}rl).`, `SA = ${PI}r² + ${PI}rl`, `SA ≈ ${f(S)} ${u}²`)],
      svg: coneSVG(r, h, u) };
  } },
  { id: 'pyr', name: 'Square pyramid', icon: '🔺', fields: [['s', 'base side', 6], ['h', 'height', 5]], solve: ({ s, h }, u) => {
    const l = Math.hypot(h, s / 2), V = s * s * h / 3, S = s * s + 2 * s * l;
    return { answers: [['Volume', `${f(V)} ${u}³`], ['Surface area', `${f(S)} ${u}²`]], steps: [
      step('Volume', 'Any pyramid is ⅓ of the box with the same base and height.', 'V = ⅓ × s² × h', `V = ⅓ × ${f(s * s)} × ${f(h)} = ${f(V)} ${u}³`),
      step('Slant height', 'Right triangle from the tip, down the middle of a face.', `l = √(h² + (s÷2)²) = √(${f(h * h)} + ${f(s * s / 4)})`, `l ≈ ${f(l)} ${u}`),
      step('Surface area', 'The square base + 4 triangles (each ½ × s × l).', `SA = s² + 4 × ½ × s × l`, `SA = ${f(s * s)} + ${f(2 * s * l)} ≈ ${f(S)} ${u}²`)],
      svg: pyrSVG(s, h, u) };
  } },
];
function step(rule, text, before, after) { return { rule, text, before, after }; }

// ---------- drawings (textbook style, to scale) ----------
const INK = '#1f2a44', RED = '#d2453c', BLUE = '#2f62b0', FILL = 'rgba(47, 98, 176, .12)';
const T = (x, y, s, col = RED, anchor = 'middle', size = 20) => `<text x="${x}" y="${y}" fill="${col}" font-size="${size}" text-anchor="${anchor}" font-family="Noteworthy, 'Patrick Hand', cursive">${s}</text>`;
const wrap = (inner, w = 420, h = 320) => `<svg viewBox="0 0 ${w} ${h}" class="geosvg" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
const fit = (w, h, W = 300, H = 210) => { const k = Math.min(W / w, H / h); return k; };
const rightMark = (x, y, dx, dy, s = 14) => `<path d="M${x + dx * s} ${y} L${x + dx * s} ${y + dy * s} L${x} ${y + dy * s}" fill="none" stroke="${INK}" stroke-width="1.6"/>`;
function rectSVG(l, w, u, sq) {
  const k = fit(l, w), W = l * k, H = w * k, x = (420 - W) / 2, y = (320 - H) / 2;
  return wrap(`<rect x="${x}" y="${y}" width="${W}" height="${H}" fill="${FILL}" stroke="${INK}" stroke-width="2.5"/>
    <line x1="${x}" y1="${y + H}" x2="${x + W}" y2="${y}" stroke="${BLUE}" stroke-dasharray="6 5" stroke-width="1.6"/>
    ${rightMark(x, y + H, 1, -1)}${rightMark(x + W, y, -1, 1)}
    ${T(x + W / 2, y + H + 30, `${f(l)} ${u}`)}${T(x - 12, y + H / 2 + 6, `${f(w)} ${u}`, RED, 'end')}
    ${sq ? '' : T(x + W / 2 + 14, y + H / 2 - 10, 'd', BLUE)}`);
}
function triBHSVG(b, h, u) {
  const k = fit(b, h), W = b * k, H = h * k, x = (420 - W) / 2, y = (320 - H) / 2 + H, tx = x + W * 0.35;
  return wrap(`<polygon points="${x},${y} ${x + W},${y} ${tx},${y - H}" fill="${FILL}" stroke="${INK}" stroke-width="2.5"/>
    <line x1="${tx}" y1="${y - H}" x2="${tx}" y2="${y}" stroke="${BLUE}" stroke-dasharray="6 5" stroke-width="2"/>${rightMark(tx, y, 1, -1)}
    ${T(x + W / 2, y + 30, `base ${f(b)} ${u}`)}${T(tx + 10, y - H / 2, `height ${f(h)}`, BLUE, 'start')}`);
}
function tri3SVG(a, b, c, [A, B, C], u) {
  // put side c on the bottom; A at left, B at right; C on top
  const Cx = b * Math.cos(rad(A)), Cy = b * Math.sin(rad(A));
  const minX = Math.min(0, Cx), maxX = Math.max(c, Cx), k = fit(maxX - minX, Cy);
  const ox = (420 - (maxX - minX) * k) / 2 - minX * k, oy = (320 + Cy * k) / 2;
  const P = (x, y) => [ox + x * k, oy - y * k], pa = P(0, 0), pb = P(c, 0), pc = P(Cx, Cy);
  return wrap(`<polygon points="${pa} ${pb} ${pc}" fill="${FILL}" stroke="${INK}" stroke-width="2.5"/>
    ${T((pa[0] + pb[0]) / 2, pa[1] + 30, `c = ${f(c)} ${u}`)}${T((pb[0] + pc[0]) / 2 + 16, (pb[1] + pc[1]) / 2, `a = ${f(a)}`, RED, 'start')}${T((pa[0] + pc[0]) / 2 - 16, (pa[1] + pc[1]) / 2, `b = ${f(b)}`, RED, 'end')}
    ${T(pa[0] + 34, pa[1] - 8, `${f(A)}°`, BLUE, 'start', 16)}${T(pb[0] - 34, pb[1] - 8, `${f(B)}°`, BLUE, 'end', 16)}${T(pc[0], pc[1] + 34, `${f(C)}°`, BLUE, 'middle', 16)}`);
}
function rightSVG(a, b, c, A, B, u, miss) {
  const k = fit(b, a), W = b * k, H = a * k, x = (420 - W) / 2, y = (320 + H) / 2;
  const lab = (n, v) => miss === n ? `${n} = ${f(v)} ?` : `${n} = ${f(v)}`;
  return wrap(`<polygon points="${x},${y} ${x + W},${y} ${x},${y - H}" fill="${FILL}" stroke="${INK}" stroke-width="2.5"/>${rightMark(x, y, 1, -1)}
    ${T(x + W / 2, y + 30, lab('b', b) + ' ' + u, miss === 'b' ? BLUE : RED)}${T(x - 12, y - H / 2, lab('a', a), miss === 'a' ? BLUE : RED, 'end')}${T(x + W / 2 + 14, y - H / 2 - 10, lab('c', c), miss === 'c' ? BLUE : RED, 'start')}
    ${T(x + W - 44, y - 8, `${f(B)}°`, BLUE, 'end', 15)}${T(x + 8, y - H + 42, `${f(A)}°`, BLUE, 'start', 15)}`);
}
function circleSVG(r, u) {
  return wrap(`<circle cx="210" cy="160" r="110" fill="${FILL}" stroke="${INK}" stroke-width="2.5"/><circle cx="210" cy="160" r="3.5" fill="${INK}"/>
    <line x1="210" y1="160" x2="320" y2="160" stroke="${RED}" stroke-width="2.2"/><line x1="130" y1="84" x2="290" y2="236" stroke="${BLUE}" stroke-dasharray="6 5" stroke-width="1.6"/>
    ${T(265, 150, `r = ${f(r)} ${u}`)}${T(150, 110, `d = ${f(2 * r)}`, BLUE, 'end', 17)}${T(210, 300, `C ≈ ${f(2 * Math.PI * r)} ${u} around`, INK, 'middle', 16)}`);
}
function trapSVG(a, b, h, u) {
  const k = fit(b, h), W = b * k, Wt = a * k, H = h * k, x = (420 - W) / 2, y = (320 + H) / 2, tx = x + (W - Wt) / 2;
  return wrap(`<polygon points="${x},${y} ${x + W},${y} ${tx + Wt},${y - H} ${tx},${y - H}" fill="${FILL}" stroke="${INK}" stroke-width="2.5"/>
    <line x1="${tx}" y1="${y - H}" x2="${tx}" y2="${y}" stroke="${BLUE}" stroke-dasharray="6 5" stroke-width="2"/>${rightMark(tx, y, 1, -1)}
    ${T(x + W / 2, y + 30, `b = ${f(b)} ${u}`)}${T(tx + Wt / 2, y - H - 12, `a = ${f(a)}`)}${T(tx - 8, y - H / 2, `h = ${f(h)}`, BLUE, 'end')}`);
}
function paraSVG(b, h, s, u) {
  const off = isFinite(s) && s > h ? Math.sqrt(s * s - h * h) : h * 0.6;
  const k = fit(b + off, h), W = b * k, H = h * k, O = off * k, x = (420 - W - O) / 2, y = (320 + H) / 2;
  return wrap(`<polygon points="${x},${y} ${x + W},${y} ${x + W + O},${y - H} ${x + O},${y - H}" fill="${FILL}" stroke="${INK}" stroke-width="2.5"/>
    <line x1="${x + O}" y1="${y - H}" x2="${x + O}" y2="${y}" stroke="${BLUE}" stroke-dasharray="6 5" stroke-width="2"/>${rightMark(x + O, y, 1, -1)}
    ${T(x + W / 2, y + 30, `b = ${f(b)} ${u}`)}${T(x + O + 10, y - H / 2, `h = ${f(h)}`, BLUE, 'start')}${isFinite(s) ? T(x + O / 2 - 12, y - H / 2, `s = ${f(s)}`, RED, 'end') : ''}`);
}
function polySVG(n, s, u) {
  const R = 115, pts = Array.from({ length: n }, (_, i) => { const t = -Math.PI / 2 + (i + 0.5) * 2 * Math.PI / n + (n % 2 ? -Math.PI / n : 0); return [210 + R * Math.cos(t), 165 + R * Math.sin(t)]; });
  const [p, q] = [pts[Math.floor(n / 2) - 1] || pts[0], pts[Math.floor(n / 2)] || pts[1]];
  const mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  return wrap(`<polygon points="${pts.map(v => v.join(',')).join(' ')}" fill="${FILL}" stroke="${INK}" stroke-width="2.5"/>
    <line x1="210" y1="165" x2="${mid[0]}" y2="${mid[1]}" stroke="${BLUE}" stroke-dasharray="6 5" stroke-width="1.8"/><circle cx="210" cy="165" r="3" fill="${INK}"/>
    ${T(mid[0], mid[1] + 28, `s = ${f(s)} ${u}`)}${T(210, 30, `${n} equal sides`, INK, 'middle', 16)}`);
}
function anglesSVG(A, B, C) {
  const c = 1, b = Math.sin(rad(B)) / Math.sin(rad(C)), Cx = b * Math.cos(rad(A)), Cy = b * Math.sin(rad(A));
  const minX = Math.min(0, Cx), maxX = Math.max(c, Cx), k = fit(maxX - minX, Cy), ox = (420 - (maxX - minX) * k) / 2 - minX * k, oy = (320 + Cy * k) / 2;
  const P = (x, y) => [ox + x * k, oy - y * k], pa = P(0, 0), pb = P(c, 0), pc = P(Cx, Cy);
  const arc = (p, a0, a1, r = 30) => `<path d="M${p[0] + r * Math.cos(a0)} ${p[1] - r * Math.sin(a0)} A${r} ${r} 0 0 0 ${p[0] + r * Math.cos(a1)} ${p[1] - r * Math.sin(a1)}" fill="none" stroke="${BLUE}" stroke-width="2"/>`;
  return wrap(`<polygon points="${pa} ${pb} ${pc}" fill="${FILL}" stroke="${INK}" stroke-width="2.5"/>
    ${arc(pa, 0, rad(A))}${arc(pb, Math.PI - rad(B), Math.PI)}
    ${T(pa[0] + 44, pa[1] - 10, `A ${f(A)}°`, BLUE, 'start', 17)}${T(pb[0] - 44, pb[1] - 10, `B ${f(B)}°`, BLUE, 'end', 17)}${T(pc[0], pc[1] - 12, `C = ${f(C)}°`, RED, 'middle', 20)}`);
}
function iso(l, w, h) {   // simple oblique drawing of a box
  const k = Math.min(260 / (l + w * 0.5), 220 / (h + w * 0.4)), L = l * k, Wd = w * k * 0.5, Hd = h * k, dy = w * k * 0.35;
  const x = (420 - L - Wd) / 2, y = (320 + Hd - dy) / 2 + dy;
  return { x, y, L, Wd, Hd, dy };
}
function boxSVG(l, w, h, u) {
  const { x, y, L, Wd, Hd, dy } = iso(l, w, h);
  return wrap(`<polygon points="${x},${y} ${x + L},${y} ${x + L},${y - Hd} ${x},${y - Hd}" fill="rgba(47,98,176,.16)" stroke="${INK}" stroke-width="2.3"/>
    <polygon points="${x},${y - Hd} ${x + Wd},${y - Hd - dy} ${x + L + Wd},${y - Hd - dy} ${x + L},${y - Hd}" fill="rgba(47,98,176,.08)" stroke="${INK}" stroke-width="2.3"/>
    <polygon points="${x + L},${y} ${x + L + Wd},${y - dy} ${x + L + Wd},${y - Hd - dy} ${x + L},${y - Hd}" fill="rgba(47,98,176,.24)" stroke="${INK}" stroke-width="2.3"/>
    <path d="M${x} ${y} L${x + Wd} ${y - dy} L${x + L + Wd} ${y - dy} M${x + Wd} ${y - dy} L${x + Wd} ${y - Hd - dy}" fill="none" stroke="${INK}" stroke-dasharray="5 5" stroke-width="1.4"/>
    ${T(x + L / 2, y + 28, `${f(l)} ${u}`)}${T(x + L + Wd / 2 + 16, y - dy / 2 + 10, `${f(w)}`, RED, 'start')}${T(x - 10, y - Hd / 2, `${f(h)}`, RED, 'end')}`);
}
function cylSVG(r, h, u) {
  const k = Math.min(110 / r, 210 / (h + r * 0.5)), R = r * k, H = h * k, ry = R * 0.3, cx = 210, top = (320 - H) / 2;
  return wrap(`<path d="M${cx - R} ${top} L${cx - R} ${top + H} A${R} ${ry} 0 0 0 ${cx + R} ${top + H} L${cx + R} ${top}" fill="rgba(47,98,176,.16)" stroke="${INK}" stroke-width="2.3"/>
    <path d="M${cx - R} ${top + H} A${R} ${ry} 0 0 1 ${cx + R} ${top + H}" fill="none" stroke="${INK}" stroke-dasharray="5 5" stroke-width="1.4"/>
    <ellipse cx="${cx}" cy="${top}" rx="${R}" ry="${ry}" fill="rgba(47,98,176,.08)" stroke="${INK}" stroke-width="2.3"/>
    <line x1="${cx}" y1="${top}" x2="${cx + R}" y2="${top}" stroke="${RED}" stroke-width="2"/>
    ${T(cx + R / 2, top - 10, `r = ${f(r)}`)}${T(cx + R + 12, top + H / 2, `h = ${f(h)} ${u}`, RED, 'start')}`);
}
function sphereSVG(r, u) {
  return wrap(`<defs><radialGradient id="sg" cx=".35" cy=".35"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="rgba(47,98,176,.35)"/></radialGradient></defs>
    <circle cx="210" cy="160" r="115" fill="url(#sg)" stroke="${INK}" stroke-width="2.3"/>
    <path d="M95 160 A115 34 0 0 0 325 160" fill="none" stroke="${INK}" stroke-width="1.8"/><path d="M95 160 A115 34 0 0 1 325 160" fill="none" stroke="${INK}" stroke-dasharray="5 5" stroke-width="1.3"/>
    <line x1="210" y1="160" x2="325" y2="160" stroke="${RED}" stroke-width="2"/><circle cx="210" cy="160" r="3" fill="${INK}"/>${T(268, 150, `r = ${f(r)} ${u}`)}`);
}
function coneSVG(r, h, u) {
  const k = Math.min(120 / r, 220 / (h + r * 0.3)), R = r * k, H = h * k, ry = R * 0.3, cx = 210, base = (320 + H) / 2;
  return wrap(`<path d="M${cx - R} ${base} L${cx} ${base - H} L${cx + R} ${base} A${R} ${ry} 0 0 1 ${cx - R} ${base}" fill="rgba(47,98,176,.16)" stroke="${INK}" stroke-width="2.3"/>
    <path d="M${cx - R} ${base} A${R} ${ry} 0 0 1 ${cx + R} ${base}" fill="none" stroke="${INK}" stroke-dasharray="5 5" stroke-width="1.4"/>
    <line x1="${cx}" y1="${base - H}" x2="${cx}" y2="${base}" stroke="${BLUE}" stroke-dasharray="6 5" stroke-width="2"/><line x1="${cx}" y1="${base}" x2="${cx + R}" y2="${base}" stroke="${RED}" stroke-width="2"/>${rightMark(cx, base, 1, -1, 11)}
    ${T(cx + R / 2, base + 28, `r = ${f(r)}`)}${T(cx - 10, base - H / 2, `h = ${f(h)} ${u}`, BLUE, 'end')}${T(cx + R / 2 + 16, base - H / 2, 'slant', INK, 'start', 15)}`);
}
function pyrSVG(s, h, u) {
  const k = Math.min(240 / (s * 1.5), 200 / (h + s * 0.3)), S = s * k, H = h * k, dx = S * 0.5, dy = S * 0.3, x = (420 - S - dx) / 2, y = (320 + H) / 2 + dy / 2;
  const apex = [x + (S + dx) / 2, y - dy / 2 - H];
  return wrap(`<polygon points="${x},${y} ${x + S},${y} ${apex}" fill="rgba(47,98,176,.18)" stroke="${INK}" stroke-width="2.3"/>
    <polygon points="${x + S},${y} ${x + S + dx},${y - dy} ${apex}" fill="rgba(47,98,176,.28)" stroke="${INK}" stroke-width="2.3"/>
    <path d="M${x} ${y} L${x + dx} ${y - dy} L${x + S + dx} ${y - dy} M${x + dx} ${y - dy} L${apex}" fill="none" stroke="${INK}" stroke-dasharray="5 5" stroke-width="1.3"/>
    <line x1="${apex[0]}" y1="${apex[1]}" x2="${apex[0]}" y2="${y - dy / 2}" stroke="${BLUE}" stroke-dasharray="6 5" stroke-width="2"/>
    ${T(x + S / 2, y + 28, `${f(s)} ${u}`)}${T(apex[0] + 8, (apex[1] + y) / 2, `h = ${f(h)}`, BLUE, 'start')}`);
}
