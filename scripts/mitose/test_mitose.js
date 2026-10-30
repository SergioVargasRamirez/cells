// Test für template/site/mitose.js: Aufruf  node scripts/mitose/test_mitose.js
// Prüft Zeitplan, Chromosomen- und Chromatidenzahl, DNA-Gehalt (2C → 4C → 2C), Zellform und Lage der Chromatiden.
const fs = require("fs"), path = require("path"), vm = require("vm");
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "..", "template", "site", "mitose.js"), "utf8") + "\nglobalThis.M = MITOSE;", ctx);
const M = ctx.M;
let fehler = 0;
const pruefe = (ok, text) => { if (!ok){ fehler++; console.log("FEHLER:", text); } };

// Zeitplan lückenlos von 0 bis 1
let t0 = 0;
for (const p of M.PHASEN){ pruefe(Math.abs(p.von - t0) < 1e-9 && p.bis > p.von, "Zeitplan: " + p.id); t0 = p.bis; }
pruefe(t0 === 1, "Zeitplan endet bei 1");
for (const g of M.GRUPPEN) pruefe(M.PHASEN.some(p => p.gruppe === g.id), "Gruppe ohne Phase: " + g.id);

// DNA-Gehalt und Zahlen
pruefe(M.dnaGehalt(0) === 2, "G1: 2C");
pruefe(M.dnaGehalt(0.2) === 4 && M.dnaGehalt(0.9) === 4, "G2 bis Cytokinese: 4C");
pruefe(M.dnaGehalt(0.99) === 2, "nach der Teilung: 2C");
let zuvor = 0;
for (let i = 0; i <= 1000; i++){ const t = i / 1000; const d = M.dnaGehalt(t); if (t < M.T_TEIL) { pruefe(d >= zuvor - 1e-9, "DNA-Gehalt sinkt vor der Teilung bei " + t); zuvor = d; } }
pruefe(M.zahlen(0.1).jeChromosom === 1 && M.zahlen(0.3).jeChromosom === 2 && M.zahlen(0.5).jeChromosom === 2 && M.zahlen(0.65).jeChromosom === 1, "Chromatiden je Chromosom");
pruefe(M.zahlen(0.5).chromosomen === 4 && M.zahlen(0.65).chromosomen === 8 && M.zahlen(0.99).chromosomen === 4, "Zahl der Chromosomen 4 → 8 → 4");
pruefe(M.zahlen(0).chromatiden === 4 && M.zahlen(0.3).chromatiden === 8, "Chromatiden 4 → 8");

// Zustand: in der Metaphase liegen die Chromosomen auf der Platte, danach auf der Seite ihres Pols
const m = M.zustand(0.55);
m.chromosomen.forEach(c => c.chromatiden.forEach(ch => pruefe(Math.abs(ch.x) < 16, "Metaphase: Chromatide nahe der Platte, " + c.id)));
const a = M.zustand(0.70);
a.chromosomen.forEach(c => c.chromatiden.forEach(ch => pruefe(Math.sign(ch.x) === ch.seite, "Anaphase: Chromatide auf der Seite ihres Pols, " + c.id)));
const e = M.zustand(1);
pruefe(e.geteilt && e.kern.tochter.huelle > 0.99, "Ende: zwei Zellen, Kernhülle geschlossen");
pruefe(M.zustand(0.3).kern.huelle > 0 && M.zustand(0.5).kern.huelle < 0.01, "Kernhülle löst sich bis zur Metaphase auf");

// Alle Chromatiden bleiben für alle t in der Zelle (Rechteck der Zellwand)
for (let i = 0; i <= 500; i++){
  const z = M.zustand(i / 500), W2 = M.W_ZELLE / 2, H2 = M.H_ZELLE / 2;
  z.chromosomen.forEach(c => c.chromatiden.forEach(ch => {
    if (ch.laenge < 0.05) return;
    pruefe(Math.abs(ch.x) < W2 - 50 && Math.abs(ch.y) < H2 - 30, `Chromatide ${c.id} außerhalb der Zelle bei t=${(i / 500).toFixed(3)}`);
  }));
  // Pflanzenzelle: Spindelpole und Zellplatte bleiben in der Zelle, keine Zentrosomen im Zustand
  pruefe(z.pol.x < W2 - 60 && !("zentrosomen" in z), "Spindelpol in der Zelle, bei t=" + (i / 500));
}
// Zellplatte wächst von 0 auf 1, erst danach zwei Zellen; Phragmoplast nur dazwischen
pruefe(M.zustand(0.7).platte.wachstum === 0 && M.zustand(0.95).platte.wachstum === 1 && M.zustand(0.9).platte.wachstum < 1, "Zellplatte wächst");
pruefe(M.zustand(0.3).platte.phragmoplast === 0 && M.zustand(0.85).platte.phragmoplast > 0.5, "Phragmoplast in der Telophase");
pruefe(M.zustand(0.1).vakuole > 0.95 && M.zustand(0.55).vakuole < 0.35, "Vakuole wird zur Teilung klein");
pruefe(Math.abs(M.zustand(1).kern.tochter.x - M.W_ZELLE / 4) < 1e-9, "Tochterkerne in der Mitte der Tochterzellen");

// Tierzelle: Zentrosomen, Einschnürung, zwei Kreise am Ende; Chromatiden bleiben in der Zelle
const tz = M.zustand(1, "tier"), tz0 = M.zustand(0, "tier");
pruefe(tz.geteilt && Math.abs(tz.zelle.c - M.R_TOCHTER) < 1e-9 && Math.abs(2 * tz.zelle.rho ** 2 - M.R_ZELLE ** 2) < 1e-6, "Tierzelle: zwei Tochterzellen mit halber Fläche");
pruefe(tz0.zelle.c === 0 && tz0.zentrosomen[1].sichtbar === 0 && M.zustand(0.2, "tier").zentrosomen[1].sichtbar === 1, "Tierzelle: Zentrosom wird in der S-Phase verdoppelt");
pruefe(!("platte" in tz) && "furche" in tz, "Tierzelle: Furche statt Zellplatte");
for (let i = 0; i <= 500; i++){
  const z = M.zustand(i / 500, "tier"), zc = z.zelle;
  z.chromosomen.forEach(c => c.chromatiden.forEach(ch => {
    if (ch.laenge < 0.05) return;
    const d = Math.min(Math.hypot(ch.x - zc.c, ch.y), Math.hypot(ch.x + zc.c, ch.y));
    pruefe(d < zc.rho - 8, `Tierzelle: Chromatide ${c.id} außerhalb bei t=${(i / 500).toFixed(3)}`);
  }));
}
const kt = M.einfachTier.teilung(1, 34);
pruefe(Math.abs(kt.zelle.c - 34 / Math.SQRT2) < 1e-9 && Math.abs(kt.kern.c - kt.zelle.c) < 1e-9, "Klasse 5 Tierzelle: Kerne in den Tochterzellen");

// Umriss: bei c = 0 ein Kreis, bei c = rho zwei getrennte Formen
const kreis = M.verbund(0, 100)[0];
pruefe(M.verbund(0, 100).length === 1 && kreis.every(([x, y]) => Math.abs(Math.hypot(x, y) - 100) < 0.5), "verbund: Kreis");
pruefe(M.verbund(100, 100).length === 2, "verbund: zwei Formen");

// Klasse 5: am Ende zwei Kerne in der Mitte der Hälften, Fläche der Kerne bleibt erhalten, Zellwand wächst ganz durch
const L = 80, S = 40, en = M.einfach.teilung(1, L, S), k0 = M.einfach.teilung(0, L, S);
pruefe(Math.abs(en.kern.c - L / 4) < 1e-9 && en.platte === 1, "Klasse 5: Kerne in den Hälften, Wand vollständig");
pruefe(Math.abs(2 * en.kern.rho ** 2 - M.einfach.kernR(S) ** 2) < 1e-9, "Klasse 5: Kernfläche erhalten");
pruefe(k0.kern.c === 0 && k0.platte === 0 && k0.vakuole === 1, "Klasse 5: Anfang ein Kern, keine Wand");
console.log(fehler ? fehler + " Fehler" : "Alle Tests bestanden.");
process.exit(fehler ? 1 : 0);
