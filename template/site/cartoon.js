// Cartoon-Darstellung einer Proteinkette als Dreiecksnetz (Quelle: template/site/cartoon.js, von build.py in die Seiten
// kopiert). Eine Spline durch die Cα-Atome wird mit einem Querschnitt umhüllt: Helix und Strang als flaches Band
// (Strang mit Pfeilspitze), Schleife als runder Schlauch. Die Bänder richten sich nach den Carbonylgruppen (C→O).
//
//   const m = CARTOON.bauen({ca, c, o, ss, farbe});   // Listen je Rest; ss: "H", "G", "E" oder "C"; farbe: [r, g, b] je Rest
//   m → {pos, nor, col}  (Float32Array, je drei Zahlen pro Ecke, für scene.netze in mol3d.js)
const CARTOON = (() => {
  "use strict";
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const STIL = {H: {a: 1.15, b: 0.22}, G: {a: 0.9, b: 0.2}, E: {a: 1.0, b: 0.2}, C: {a: 0.3, b: 0.3}};
  const glatt = k => k * k * (3 - 2 * k);
  const catmull = (p0, p1, p2, p3, t) => [0, 1, 2].map(i => 0.5 * ((2 * p1[i]) + (-p0[i] + p2[i]) * t + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t * t + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t * t * t));

  function bauen(o){
    const n = o.ca.length, S = o.teile || 6, M = o.seiten || 10, ss = o.ss;
    // Führungsvektoren aus C→O, mit durchgehendem Vorzeichen (sonst springt das Band im Strang) und leicht geglättet
    let g = [];
    for (let i = 0; i < n; i++){ let v = norm(sub(o.o[i], o.c[i])); if (i && dot(v, g[i - 1]) < 0) v = mul(v, -1); g.push(v); }
    g = g.map((v, i) => norm(add(add(mul(g[Math.max(0, i - 1)], 1), mul(v, 2)), g[Math.min(n - 1, i + 1)])));
    const pts = [], gv = [], aa = [], bb = [], cc = [], seg = [];
    const P = i => o.ca[Math.max(0, Math.min(n - 1, i))];
    for (let i = 0; i < n - 1; i++){
      for (let s = 0; s < S; s++){
        const t = s / S, e = glatt(t), sa = STIL[ss[i]] || STIL.C, sb = STIL[ss[i + 1]] || STIL.C;
        pts.push(catmull(P(i - 1), P(i), P(i + 1), P(i + 2), t));
        gv.push(norm(add(mul(g[i], 1 - t), mul(g[i + 1], t))));
        let a = sa.a + (sb.a - sa.a) * e, b = sa.b + (sb.b - sa.b) * e;
        if (ss[i] === "E" && ss[i + 1] !== "E"){ a = 1.75 * (1 - t) + 0.05 * t; b = 0.2 + 0.1 * t; }   // Pfeilspitze am Ende des Strangs
        aa.push(a); bb.push(b);
        cc.push(o.farbe[i].map((v, q) => v + (o.farbe[i + 1][q] - v) * e));
      }
    }
    pts.push(o.ca[n - 1]); gv.push(g[n - 1]); const le = STIL[ss[n - 1]] || STIL.C; aa.push(le.a); bb.push(le.b); cc.push(o.farbe[n - 1]);
    const K = pts.length, ringe = [], normalen = [];
    for (let k = 0; k < K; k++){
      const t = norm(sub(pts[Math.min(K - 1, k + 1)], pts[Math.max(0, k - 1)]));
      let w = sub(gv[k], mul(t, dot(gv[k], t))); w = norm(w); const nr = cross(t, w);
      const ring = [], nrm = [];
      for (let j = 0; j < M; j++){
        const th = 2 * Math.PI * j / M, c = Math.cos(th), s = Math.sin(th);
        ring.push(add(pts[k], add(mul(w, aa[k] * c), mul(nr, bb[k] * s))));
        nrm.push(norm(add(mul(w, c / Math.max(aa[k], 0.05)), mul(nr, s / Math.max(bb[k], 0.05)))));
      }
      ringe.push(ring); normalen.push({nrm, t});
    }
    const nV = (K - 1) * M * 6 + 2 * M * 3, pos = new Float32Array(nV * 3), nor = new Float32Array(nV * 3), col = new Float32Array(nV * 3);
    let q = 0;
    const put = (p, nn, c) => { pos[q] = p[0]; pos[q + 1] = p[1]; pos[q + 2] = p[2]; nor[q] = nn[0]; nor[q + 1] = nn[1]; nor[q + 2] = nn[2]; col[q] = c[0]; col[q + 1] = c[1]; col[q + 2] = c[2]; q += 3; };
    for (let k = 0; k < K - 1; k++) for (let j = 0; j < M; j++){
      const j2 = (j + 1) % M, A = ringe[k], B = ringe[k + 1], NA = normalen[k].nrm, NB = normalen[k + 1].nrm;
      put(A[j], NA[j], cc[k]); put(A[j2], NA[j2], cc[k]); put(B[j], NB[j], cc[k + 1]);   // gegen den Uhrzeigersinn von außen gesehen
      put(A[j2], NA[j2], cc[k]); put(B[j2], NB[j2], cc[k + 1]); put(B[j], NB[j], cc[k + 1]);
    }
    for (const [k, vz] of [[0, -1], [K - 1, 1]]) for (let j = 0; j < M; j++){
      const j2 = (j + 1) % M, nn = mul(normalen[k].t, vz), R = ringe[k];
      if (vz < 0){ put(pts[k], nn, cc[k]); put(R[j], nn, cc[k]); put(R[j2], nn, cc[k]); } else { put(pts[k], nn, cc[k]); put(R[j2], nn, cc[k]); put(R[j], nn, cc[k]); }
    }
    return {pos, nor, col, ringe: K};
  }
  return {bauen};
})();
