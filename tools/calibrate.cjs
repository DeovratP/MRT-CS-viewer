/* Calibrate how strongly the CS cards link neighbouring slices and time points.

   Usage, from the folder that holds viewer.html:
       node tools/calibrate.cjs                 every patient and series
       node tools/calibrate.cjs P1,consecutive  just one

   Uses the same solver and the same holdout test as the page (the solver is
   read straight out of viewer.html), on slices and time points that the
   cards do not use for their error figures, and stores the best weights in
   data/manifest.json. A weight of 0 means that link made predictions worse
   for that series, and the page then shows it as switched off.
   Takes a few minutes per series. Needs Node.js 18 or newer. */

const fs = require('fs'), zlib = require('zlib'), path = require('path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'viewer.html'), 'utf8');
const tag = '<script type="text/plain" id="solverSrc">';
const start = html.indexOf(tag) + tag.length;
const src = html.slice(start, html.indexOf('</script>', start));
const mod = { exports: {} };
new Function('module', 'exports', src)(mod, mod.exports);
const M = mod.exports;

const D = path.join(root, 'data');
const man = JSON.parse(fs.readFileSync(path.join(D, 'manifest.json'), 'utf8'));
const only = process.argv[2];
const sg = Math.pow(10, 20 / 40), lam = 5 / sg;   // smoothing at 60 percent

const rd = (f, T) => {
  const b = zlib.gunzipSync(fs.readFileSync(path.join(D, f)));
  return new T(b.buffer, b.byteOffset, b.byteLength / T.BYTES_PER_ELEMENT);
};

for (const p of man.patients) for (const name of ['cumulative', 'consecutive']) {
  const m = p.series[name];
  if (!m || (only && only !== p.id + ',' + name)) continue;
  const d = { nx: p.nx, ny: p.ny, nz: p.nz, nt: m.nt, lo: m.lo, hi: m.hi,
              codes: rd(m.file, Uint16Array), mask: rd(p.maskFile, Uint8Array) };
  const tb = Math.floor(d.nt / 2);                 // the cards report on this one
  const others = [...Array(d.nt).keys()].filter((t) => t !== tb && t > 0);
  const tps = [others[0], others[Math.floor(others.length / 2)], others[others.length - 1]]
    .filter((v, i, a) => v !== undefined && a.indexOf(v) === i);
  let tpat = 0, few = Infinity;
  m.perTimePoint.forEach((s, i) => { if (s.n < few) { few = s.n; tpat = i; } });
  const zs = [0.2, 0.45, 0.8].map((f) => Math.round(f * (d.nz - 1)));
  const run = (slices, time, wz, wt) => {
    let sse = 0, n = 0;
    for (const t of tps) {
      const tp = t === tpat ? (t === 0 ? 1 : 0) : tpat;
      for (const z of zs) {
        const q = M.holdout(d, z, t, tp, { method: 'cs', slices, time, reach: 1, lam, wz, wt });
        sse += q.sse; n += q.n;
      }
    }
    return Math.sqrt(sse / n);
  };
  const t0 = Date.now();
  const e2 = run(false, false, 0, 0);
  let z3 = [e2, 0];
  for (const wz of [0.1, 0.2, 0.4, 0.8, 1.6]) { const e = run(true, false, wz, 0); if (e < z3[0]) z3 = [e, wz]; }
  let t2 = [e2, 0];
  if (d.nt > 1) for (const wt of [0.03, 0.1, 0.3, 1, 3]) { const e = run(false, true, 0, wt); if (e < t2[0]) t2 = [e, wt]; }
  let b3 = z3[0] <= t2[0] ? [z3[0], z3[1], 0] : [t2[0], 0, t2[1]];
  if (z3[1] > 0 && t2[1] > 0)
    for (const wz of [z3[1] * 0.25, z3[1] * 0.5, z3[1]]) for (const wt of [t2[1] * 0.5, t2[1]]) {
      const e = run(true, true, wz, wt);
      if (e < b3[0]) b3 = [e, wz, wt];
    }
  m.coupling = {
    cs3d: { wz: z3[1] }, cs2dt: { wt: t2[1] },
    cs3dt: { wz: +b3[1].toFixed(4), wt: +b3[2].toFixed(4) },
    hybrid: { wz: z3[1] > 0 ? z3[1] : 0.4 },
    calibratedOn: { timePoints: tps.map((t) => t + 1), slices: zs.map((z) => z + 1), smoothing: 60 },
  };
  console.log(`${p.id} ${name}: 2D ${e2.toFixed(2)}, 3D ${z3[0].toFixed(2)} (wz ${z3[1]}), ` +
              `2D + time ${t2[0].toFixed(2)} (wt ${t2[1]}), 3D + time ${b3[0].toFixed(2)} ` +
              `(wz ${+b3[1].toFixed(3)}, wt ${+b3[2].toFixed(3)}), ${Math.round((Date.now() - t0) / 1000)} s`);
  fs.writeFileSync(path.join(D, 'manifest.json'), JSON.stringify(man));
}
console.log('done');
