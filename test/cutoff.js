// Pasted into the page: switches through every view and lists anything cut off by the window or by its box.
(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const out = [];
  const views = ['calc', 'draw', 'graph', 'geo', 'practice'];
  __mh.runExample('x² − 5x + 6 = 0');
  for (const v of views) {
    MH.show(v); await wait(1600);
    const W = innerWidth, H = innerHeight, seen = new Set();
    const skip = el => el.closest('.deco, .modal, #confetti, .saved, .pbar, .shapes, .sidecol, .exprs, .page, .dial, .line1, .mathline, .paper, .gex, .geopaper') ;
    for (const el of document.querySelectorAll(`header *, #view-${v} *`)) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') continue;
      if (el.closest('[hidden]') || skip(el)) continue;
      const name = (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '') || el.tagName;
      if (r.right > W + 1 || (document.body.classList.contains('fitted') && r.bottom > H + 1) || r.left < -1) { const k = 'off ' + name; if (!seen.has(k)) { seen.add(k); out.push(`${v}: OFF SCREEN ${name} (${Math.round(r.left)},${Math.round(r.top)} → ${Math.round(r.right)},${Math.round(r.bottom)})`); } }
      const cs = getComputedStyle(el);
      if ((cs.overflowX === 'hidden' || cs.overflowY === 'hidden') && (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2) && !['CANVAS', 'svg'].includes(el.tagName)) { const k = 'clip ' + name; if (!seen.has(k)) { seen.add(k); out.push(`${v}: CLIPPED INSIDE ${name} (${el.scrollWidth}x${el.scrollHeight} in ${el.clientWidth}x${el.clientHeight})`); } }
    }
    // things in scroll areas that are cut off sideways
    for (const el of document.querySelectorAll(`#view-${v} .page, #view-${v} .mathline, #view-${v} .sidecol, #view-${v} .exprs, #view-${v} .geopaper`)) {
      if (el.closest('[hidden]')) continue;
      if (el.scrollWidth > el.clientWidth + 2) out.push(`${v}: SIDEWAYS SCROLL ${el.className} (${el.scrollWidth} in ${el.clientWidth})`);
    }
  }
  return out.join('\n') || 'nothing cut off';
})()
