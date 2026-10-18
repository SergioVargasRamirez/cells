// Peptidketten aus Bindungslängen, Winkeln und Torsionswinkeln bauen (Quelle: template/site/peptid.js,
// von build.py in die Seiten kopiert). Einheiten: Ångström und Grad.
//
//   const k = PEPTID.kette({n: 2, phi: -60, psi: 140, omega: 180, rest: "R"});
//   k.atome      [{name, el, res, pos, art}]   art: "ruecken", "rest" oder "h"
//   k.bindungen  [[i, j], ...]
//   k.ebenen     [{res, atome: [6 Indizes]}]   Peptideinheit zwischen Rest res und res+1:
//                                              Cα(i), C(i), O(i), N(i+1), H(i+1), Cα(i+1)
//   Option keineH: true lässt alle Wasserstoffatome weg (dann gibt es keine ebenen).
//   PEPTID.ebeneFit(punkte) → {mitte, normale, abweichung: [...], max}
//
// Die Standardwerte stammen aus den Idealwerten für Proteine (Engh und Huber 1991).
const PEPTID = (() => {
  "use strict";
  const GEO = {
    NCA: 1.458, CAC: 1.525, CN: 1.329, CO: 1.231, CACB: 1.530, NH: 1.010, CAHA: 1.090, COXT: 1.231,
    NCAC: 111.2, CACN: 116.2, CACO: 120.8, CNCA: 121.7, NCACB: 110.4, CNH: 119.15, NCAHA: 109.5, CAOXT: 117.0, CANH: 109.5,
    CB_TOR: -122.6,   // Torsion C–N–Cα–Cβ bei L-Aminosäuren
  };
  const rad = d => d * Math.PI / 180, grad = r => r * 180 / Math.PI;
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const len = a => Math.hypot(a[0], a[1], a[2]);
  const norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

  // Punkt D mit Abstand l von C, Winkel B–C–D (wi) und Torsion A–B–C–D (to)
  function platziere(a, b, c, l, wi, to){
    const bc = norm(sub(c, b)), n = norm(cross(sub(b, a), bc)), m = cross(n, bc), th = rad(wi), ta = rad(to);
    const d = [-l * Math.cos(th), l * Math.sin(th) * Math.cos(ta), l * Math.sin(th) * Math.sin(ta)];
    return add(c, add(mul(bc, d[0]), add(mul(m, d[1]), mul(n, d[2]))));
  }
  function torsion(a, b, c, d){
    const b1 = sub(b, a), b2 = sub(c, b), b3 = sub(d, c), n1 = cross(b1, b2), n2 = cross(b2, b3);
    const m1 = cross(n1, norm(b2));
    return -grad(Math.atan2(dot(m1, n2), dot(n1, n2)));   // IUPAC-Vorzeichen: positiv, wenn die vordere Bindung im Uhrzeigersinn zur hinteren dreht
  }
  const winkel = (a, b, c) => { const u = norm(sub(a, b)), v = norm(sub(c, b)); return grad(Math.acos(Math.max(-1, Math.min(1, dot(u, v))))); };
  const abstand = (a, b) => len(sub(a, b));

  // Beste Ebene durch Punkte (kleinste Hauptachse der Kovarianz, Jacobi-Verfahren für 3×3)
  function ebeneFit(P){
    const n = P.length, mitte = [0, 0, 0];
    P.forEach(p => { mitte[0] += p[0] / n; mitte[1] += p[1] / n; mitte[2] += p[2] / n; });
    const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    P.forEach(p => { const d = sub(p, mitte); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i][j] += d[i] * d[j]; });
    let A = C.map(r => r.slice()), V = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    for (let it = 0; it < 40; it++){
      let p = 0, q = 1, mx = Math.abs(A[0][1]);
      if (Math.abs(A[0][2]) > mx){ p = 0; q = 2; mx = Math.abs(A[0][2]); }
      if (Math.abs(A[1][2]) > mx){ p = 1; q = 2; mx = Math.abs(A[1][2]); }
      if (mx < 1e-14) break;
      const th = 0.5 * Math.atan2(2 * A[p][q], A[q][q] - A[p][p]), c = Math.cos(th), s = Math.sin(th);
      for (let k = 0; k < 3; k++){ const kp = A[k][p], kq = A[k][q]; A[k][p] = c * kp - s * kq; A[k][q] = s * kp + c * kq; }
      for (let k = 0; k < 3; k++){ const pk = A[p][k], qk = A[q][k]; A[p][k] = c * pk - s * qk; A[q][k] = s * pk + c * qk; }
      for (let k = 0; k < 3; k++){ const kp = V[k][p], kq = V[k][q]; V[k][p] = c * kp - s * kq; V[k][q] = s * kp + c * kq; }
    }
    let imin = 0; for (let i = 1; i < 3; i++) if (A[i][i] < A[imin][imin]) imin = i;
    const normale = norm([V[0][imin], V[1][imin], V[2][imin]]);
    const abweichung = P.map(p => dot(sub(p, mitte), normale));
    return {mitte, normale, abweichung, max: Math.max(...abweichung.map(Math.abs)), rms: Math.sqrt(abweichung.reduce((s, x) => s + x * x, 0) / n)};
  }

  // Kette aus n Resten. phi, psi, omega: Zahl oder Liste (je Rest bzw. je Peptidbindung)
  function kette(o){
    const n = o.n || 2, g = GEO, wert = (v, i, std) => v === undefined ? std : (Array.isArray(v) ? (v[i] !== undefined ? v[i] : std) : v);
    const phi = i => wert(o.phi, i, -60), psi = i => wert(o.psi, i, 140), omega = i => wert(o.omega, i, 180);
    const rest = o.rest === undefined ? "R" : o.rest;
    const atome = [], bind = [], R = [];
    const neu = (name, el, res, pos, art) => { atome.push({name, el, res, pos, art}); return atome.length - 1; };
    const ver = (i, j) => bind.push([i, j]);
    // Gerüst
    const N = [], CA = [], C = [];
    N[0] = [0, 0, 0]; CA[0] = [g.NCA, 0, 0];
    C[0] = [g.NCA + g.CAC * (-Math.cos(rad(g.NCAC))), g.CAC * Math.sin(rad(g.NCAC)), 0];
    for (let i = 0; i < n - 1; i++){
      N[i + 1] = platziere(N[i], CA[i], C[i], g.CN, g.CACN, psi(i));
      CA[i + 1] = platziere(CA[i], C[i], N[i + 1], g.NCA, g.CNCA, omega(i));
      C[i + 1] = platziere(C[i], N[i + 1], CA[i + 1], g.CAC, g.NCAC, phi(i + 1));
    }
    const idx = {};
    for (let i = 0; i < n; i++){
      const r = i + 1;
      idx["N" + r] = neu("N", "N", r, N[i], "ruecken");
      idx["CA" + r] = neu("CA", "C", r, CA[i], "ruecken");
      idx["C" + r] = neu("C", "C", r, C[i], "ruecken");
      const O = platziere(N[i], CA[i], C[i], g.CO, g.CACO, psi(i) + 180);
      idx["O" + r] = neu("O", "O", r, O, "ruecken");
      ver(idx["N" + r], idx["CA" + r]); ver(idx["CA" + r], idx["C" + r]); ver(idx["C" + r], idx["O" + r]);
      if (i > 0){
        ver(idx["C" + (r - 1)], idx["N" + r]);
        if (o.keineH) { /* ohne Amid-H */ } else {
        const H = platziere(CA[i - 1], C[i - 1], N[i], g.NH, g.CNH, omega(i - 1) + 180);
        idx["H" + r] = neu("H", "H", r, H, "h"); ver(idx["N" + r], idx["H" + r]);
        }
      } else if (o.nTerminus !== false && !o.keineH){
        [60, 180, -60].forEach((t, k) => { const H = platziere(C[0], CA[0], N[0], g.NH, g.CANH, t); const h = neu("H" + (k + 1), "H", r, H, "h"); ver(idx["N" + r], h); });
      }
      if (i === n - 1 && o.cTerminus !== false){
        const X = platziere(N[i], CA[i], C[i], g.COXT, g.CAOXT, psi(i));
        idx["OXT"] = neu("OXT", "O", r, X, "ruecken"); ver(idx["C" + r], idx["OXT"]);
      }
      if (o.h !== false && !o.keineH){
        const HA = platziere(C[i], N[i], CA[i], g.CAHA, g.NCAHA, -g.CB_TOR);
        const h = neu("HA", "H", r, HA, "h"); ver(idx["CA" + r], h);
      }
      const rr = Array.isArray(rest) ? rest[i] : rest;
      if (rr && rr !== "H"){
        const CB = platziere(C[i], N[i], CA[i], g.CACB, g.NCACB, g.CB_TOR);
        idx["CB" + r] = neu(rr === "R" ? "R" : "CB", "C", r, CB, "rest"); ver(idx["CA" + r], idx["CB" + r]);
      } else if (rr === "H" && !o.keineH){
        const HB = platziere(C[i], N[i], CA[i], g.CAHA, g.NCAHA, g.CB_TOR);
        const h = neu("HA2", "H", r, HB, "h"); ver(idx["CA" + r], h);
      }
    }
    const ebenen = [];
    for (let i = 1; i < n && !o.keineH; i++){
      const teile = [idx["CA" + i], idx["C" + i], idx["O" + i], idx["N" + (i + 1)], idx["H" + (i + 1)], idx["CA" + (i + 1)]];
      ebenen.push({res: i, atome: teile});
    }
    return {atome, bindungen: bind, ebenen, idx, n};
  }
  // Beste Überlagerung (Drehung und Verschiebung) einer Punktmenge A auf B nach Horn (1987), über Quaternionen.
  // Rückgabe: Funktion, die einen Punkt aus dem System von A in das von B überführt.
  function ausrichtung(A, B){
    const n = A.length, ca = [0, 0, 0], cb = [0, 0, 0];
    A.forEach(p => { for (let i = 0; i < 3; i++) ca[i] += p[i] / n; }); B.forEach(p => { for (let i = 0; i < 3; i++) cb[i] += p[i] / n; });
    const Sm = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let k = 0; k < n; k++) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) Sm[i][j] += (A[k][i] - ca[i]) * (B[k][j] - cb[j]);
    const [[xx, xy, xz], [yx, yy, yz], [zx, zy, zz]] = Sm;
    const M = [[xx + yy + zz, yz - zy, zx - xz, xy - yx], [yz - zy, xx - yy - zz, xy + yx, zx + xz], [zx - xz, xy + yx, -xx + yy - zz, yz + zy], [xy - yx, zx + xz, yz + zy, -xx - yy + zz]];
    // Jacobi-Verfahren für die symmetrische 4×4-Matrix
    const m = 4; let a = M.map(r => r.slice()), v = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];
    for (let sweep = 0; sweep < 60; sweep++){
      let off = 0; for (let i = 0; i < m; i++) for (let j = i + 1; j < m; j++) off += a[i][j] * a[i][j];
      if (off < 1e-24) break;
      for (let p2 = 0; p2 < m; p2++) for (let q = p2 + 1; q < m; q++){
        if (Math.abs(a[p2][q]) < 1e-30) continue;
        const th = 0.5 * Math.atan2(2 * a[p2][q], a[q][q] - a[p2][p2]), c = Math.cos(th), s = Math.sin(th);
        for (let k = 0; k < m; k++){ const kp = a[k][p2], kq = a[k][q]; a[k][p2] = c * kp - s * kq; a[k][q] = s * kp + c * kq; }
        for (let k = 0; k < m; k++){ const pk = a[p2][k], qk = a[q][k]; a[p2][k] = c * pk - s * qk; a[q][k] = s * pk + c * qk; }
        for (let k = 0; k < m; k++){ const kp = v[k][p2], kq = v[k][q]; v[k][p2] = c * kp - s * kq; v[k][q] = s * kp + c * kq; }
      }
    }
    let imax = 0; for (let i = 1; i < m; i++) if (a[i][i] > a[imax][imax]) imax = i;
    const [q0, q1, q2, q3] = [v[0][imax], v[1][imax], v[2][imax], v[3][imax]];
    const Rm = [[q0 * q0 + q1 * q1 - q2 * q2 - q3 * q3, 2 * (q1 * q2 - q0 * q3), 2 * (q1 * q3 + q0 * q2)],
                [2 * (q1 * q2 + q0 * q3), q0 * q0 - q1 * q1 + q2 * q2 - q3 * q3, 2 * (q2 * q3 - q0 * q1)],
                [2 * (q1 * q3 - q0 * q2), 2 * (q2 * q3 + q0 * q1), q0 * q0 - q1 * q1 - q2 * q2 + q3 * q3]];
    return p => { const d = [p[0] - ca[0], p[1] - ca[1], p[2] - ca[2]]; return [0, 1, 2].map(i => Rm[i][0] * d[0] + Rm[i][1] * d[1] + Rm[i][2] * d[2] + cb[i]); };
  }
  return {GEO, kette, ausrichtung, platziere, torsion, winkel, abstand, ebeneFit, norm, sub, add, mul, dot, cross, len};
})();
