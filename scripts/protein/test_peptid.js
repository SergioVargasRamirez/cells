// Test für template/site/peptid.js: Aufruf  node scripts/protein/test_peptid.js
// Prüft die Geometrie (Bindungslängen, Winkel, Torsionen, Ebene), die Händigkeit (L-Aminosäuren, verglichen mit
// Ubiquitin 1UBQ aus results/protein/) und die bekannten Werte für α-Helix und β-Strang.
const fs = require("fs"), path = require("path"), vm = require("vm");
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "..", "template", "site", "peptid.js"), "utf8") + "\nglobalThis.P = PEPTID;", ctx);
const P = ctx.P;
let fehler = 0;
const pruefe = (ok, text) => { if (!ok){ fehler++; console.log("FEHLER:", text); } };
const nah = (a, b, t) => Math.abs(a - b) <= t;

// 1) Zwei Reste: ideale Werte, ω = 180°
{
  const k = P.kette({n: 2, phi: -60, psi: 140, omega: 180}), a = (n, r) => k.atome[k.idx[n + r]].pos, g = P.GEO;
  pruefe(nah(P.abstand(a("N", 2), a("C", 1)), g.CN, 1e-6), "C–N-Länge");
  pruefe(nah(P.abstand(a("CA", 1), a("C", 1)), g.CAC, 1e-6), "Cα–C-Länge");
  pruefe(nah(P.abstand(a("N", 2), a("CA", 2)), g.NCA, 1e-6), "N–Cα-Länge");
  pruefe(nah(P.winkel(a("CA", 1), a("C", 1), a("N", 2)), g.CACN, 1e-6), "Winkel Cα–C–N");
  pruefe(nah(P.winkel(a("C", 1), a("N", 2), a("CA", 2)), g.CNCA, 1e-6), "Winkel C–N–Cα");
  const om = P.torsion(a("CA", 1), a("C", 1), a("N", 2), a("CA", 2));
  pruefe(nah(Math.abs(om), 180, 1e-6), "ω = " + om);
  pruefe(nah(P.torsion(a("C", 1), a("N", 2), a("CA", 2), a("C", 2)), -60, 1e-6), "φ");
  pruefe(nah(P.torsion(a("N", 1), a("CA", 1), a("C", 1), a("N", 2)), 140, 1e-6), "ψ");
  const e = k.ebenen[0], fit = P.ebeneFit(e.atome.map(i => k.atome[i].pos));
  pruefe(fit.max < 1e-6, "Peptidebene nicht eben: " + fit.max);
  pruefe(e.atome.length === 6, "sechs Atome in der Peptideinheit");
  // verdrehte Bindung: Ebene bricht auf
  const kv = P.kette({n: 2, phi: -60, psi: 140, omega: 150}), fv = P.ebeneFit(kv.ebenen[0].atome.map(i => kv.atome[i].pos));
  pruefe(fv.max > 0.1, "verdreht (ω=150°) sollte klar von der Ebene abweichen: " + fv.max.toFixed(3));
  console.log(`ideal: Ebene max ${fit.max.toExponential(1)} Å; ω = 150°: max ${fv.max.toFixed(2)} Å`);
}

// 2) Händigkeit und Ebene in einem echten Protein (Ubiquitin 1UBQ, 1,8 Å)
{
  const pdb = fs.readFileSync(path.join(__dirname, "..", "..", "results", "protein", "1UBQ.pdb"), "utf8").split("\n").filter(l => l.startsWith("ATOM"));
  const res = {};
  for (const l of pdb){ const nr = +l.slice(22, 26), name = l.slice(12, 16).trim(); (res[nr] = res[nr] || {})[name] = [+l.slice(30, 38), +l.slice(38, 46), +l.slice(46, 54)]; res[nr].name = l.slice(17, 20); }
  const nrs = Object.keys(res).map(Number).sort((a, b) => a - b);
  const cb = [], om = [], rms = [], cn = [];
  for (const i of nrs){
    const r = res[i], s = res[i + 1];
    if (r.CB && r.N && r.C) cb.push(P.torsion(r.C, r.N, r.CA, r.CB));
    if (s && r.C && s.N){
      om.push(P.torsion(r.CA, r.C, s.N, s.CA)); cn.push(P.abstand(r.C, s.N));
      const pts = [r.CA, r.C, r.O, s.N, s.CA]; rms.push(P.ebeneFit(pts).rms);
    }
  }
  const mw = a => a.reduce((x, y) => x + y, 0) / a.length;
  const cbm = mw(cb), omAbs = mw(om.map(x => 180 - Math.abs(x)));
  console.log(`1UBQ: Cβ-Torsion C–N–Cα–Cβ im Mittel ${cbm.toFixed(1)}° (${cb.length} Reste), |180°−|ω|| im Mittel ${omAbs.toFixed(1)}°, C–N im Mittel ${mw(cn).toFixed(3)} Å, Abweichung von der Ebene (5 schwere Atome) im Mittel ${mw(rms).toFixed(3)} Å`);
  pruefe(nah(cbm, P.GEO.CB_TOR, 4), "Händigkeit: Cβ-Torsion weicht von der echten ab: " + cbm.toFixed(1));
  pruefe(nah(mw(cn), P.GEO.CN, 0.03), "mittlere C–N-Länge im Protein");
  pruefe(omAbs < 8, "ω im Protein nahe 180°");
}

// 3) α-Helix und β-Strang
{
  const h = P.kette({n: 14, phi: -57, psi: -47, omega: 180}), a = (n, r) => h.atome[h.idx[n + r]].pos;
  const rise = P.abstand(a("CA", 1), a("CA", 11)) / 10;
  const o = a("O", 4), hh = a("H", 8);
  pruefe(P.abstand(o, hh) < 2.4, "Helix: O(i)···H(i+4) = " + P.abstand(o, hh).toFixed(2));
  const dCa = P.abstand(a("CA", 2), a("CA", 3)); pruefe(nah(dCa, 3.8, 0.1), "Cα–Cα-Abstand " + dCa.toFixed(2));
  const radius = 2.3;
  console.log(`α-Helix: O(i)···H(i+4) = ${P.abstand(o, hh).toFixed(2)} Å, Cα(1)–Cα(11) = ${(rise * 10).toFixed(1)} Å (10 Reste, Anstieg ≈ 1,5 Å je Rest wäre ${(1.5 * 10).toFixed(1)} Å entlang der Achse)`);
  const s = P.kette({n: 8, phi: -120, psi: 130, omega: 180}), b = (n, r) => s.atome[s.idx[n + r]].pos;
  const proRest = P.abstand(b("CA", 2), b("CA", 6)) / 4;
  pruefe(proRest > 3.0 && proRest < 3.6, "β-Strang: Cα–Cα über zwei Reste " + proRest.toFixed(2));
  console.log(`β-Strang: Abstand je Rest entlang der Kette ≈ ${proRest.toFixed(2)} Å`);
}
// 4) Überlagerung: eine bekannte Drehung und Verschiebung muss wiedergefunden werden
{
  const zuf = (() => { let sd = 7; return () => { sd = (sd * 1103515245 + 12345) & 0x7fffffff; return sd / 0x7fffffff - 0.5; }; })();
  const A = Array.from({length: 40}, () => [zuf() * 30, zuf() * 20, zuf() * 25]);
  const ax = P.norm([0.3, -0.7, 0.4]), w = 1.9, c = Math.cos(w), s = Math.sin(w);
  const dreh = p => P.add(P.add(P.mul(p, c), P.mul(P.cross(ax, p), s)), P.mul(ax, P.dot(ax, p) * (1 - c)));
  const B = A.map(p => P.add(dreh(p), [5, -3, 12]));
  const f = P.ausrichtung(A, B);
  const fehl = Math.max(...A.map((p, i) => P.abstand(f(p), B[i])));
  pruefe(fehl < 1e-6, "Überlagerung: größter Fehler " + fehl.toExponential(1));
  console.log("Überlagerung: größter Fehler " + fehl.toExponential(1) + " Å");
}
console.log(fehler ? fehler + " Fehler" : "OK: Peptid-Geometrie stimmt.");
process.exit(fehler ? 1 : 0);
