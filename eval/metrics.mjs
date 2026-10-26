// chrF (Popović 2015): character n-gram F-score, n = 1..6, beta = 2.
function ngrams(s, n) {
  const m = new Map();
  for (let i = 0; i + n <= s.length; i++) {
    const g = s.slice(i, i + n);
    m.set(g, (m.get(g) || 0) + 1);
  }
  return m;
}

export function chrF(hyp, ref, { maxN = 6, beta = 2 } = {}) {
  const norm = (x) => x.toLowerCase().replace(/\s+/g, '');
  const h = norm(hyp);
  const r = norm(ref);
  let p = 0;
  let rc = 0;
  let count = 0;
  for (let n = 1; n <= maxN; n++) {
    const hg = ngrams(h, n);
    const rg = ngrams(r, n);
    let match = 0;
    let ht = 0;
    let rt = 0;
    for (const [g, c] of hg) {
      ht += c;
      match += Math.min(c, rg.get(g) || 0);
    }
    for (const c of rg.values()) rt += c;
    if (ht === 0 || rt === 0) continue;
    p += match / ht;
    rc += match / rt;
    count++;
  }
  if (!count) return 0;
  p /= count;
  rc /= count;
  if (p + rc === 0) return 0;
  return (100 * (1 + beta * beta) * p * rc) / (beta * beta * p + rc);
}
