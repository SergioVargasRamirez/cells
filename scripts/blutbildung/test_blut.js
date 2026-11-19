// Test für template/site/blutbildung.js: Aufruf  node scripts/blutbildung/test_blut.js
// Prüft die stabilen Zustände beider Modelle, die Zelltypen, die Eingriffe und das Verhalten aus dem Anfangszustand.
const fs = require("fs"), path = require("path"), vm = require("vm");
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "..", "template", "site", "blutbildung.js"), "utf8") + "\nglobalThis.B = BLUT;", ctx);
const B = ctx.B;
let fehler = 0;
const pruefe = (ok, text) => { if (!ok){ fehler++; console.log("FEHLER:", text); } };
// feste Zufallszahlen (mulberry32), damit der Test jedes Mal dasselbe zeigt
const gen = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const an = (m, z) => B.MODELLE[m].faktoren.filter(f => z[f]).sort().join(",");
const menge = (m, liste) => liste.map(z => an(m, z)).sort();
const gleich = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const anteil = (c, t, n) => (c[t] || 0) / n;

// 1. Stabile Zustände (ohne Eingriffe)
pruefe(gleich(menge("einfach", B.stabile("einfach")), ["", "EKLF,GATA1", "Fli1,GATA1", "PU1"].sort()), "einfaches Modell: stabile Zustände " + JSON.stringify(menge("einfach", B.stabile("einfach"))));
const soll = ["", "CEBPa,Gfi1,PU1", "CEBPa,EgrNab,PU1,cJun", "EgrNab,PU1,cJun", "EKLF,FOG1,GATA1,SCL", "FOG1,Fli1,GATA1,SCL"].map(s => s.split(",").sort().join(",")).sort();
pruefe(gleich(menge("experte", B.stabile("experte")), soll), "Experten-Modell: stabile Zustände " + JSON.stringify(menge("experte", B.stabile("experte"))));

// 2. Zelltypen der stabilen Zustände
const typen = (m) => B.stabile(m).map(z => B.typ(m, z)).sort();
pruefe(gleich(typen("einfach"), ["aus", "ery", "gm", "mk"]), "einfach: Zelltypen " + typen("einfach"));
pruefe(gleich(typen("experte"), ["aus", "ery", "gran", "misch", "mk", "mono"]), "Experte: Zelltypen " + typen("experte"));

// 3. Anfangszustand: nur die genannten Faktoren aktiv
pruefe(an("experte", B.neu("experte")) === "CEBPa,GATA2,PU1", "Anfangszustand Experte");
pruefe(an("einfach", B.neu("einfach")) === "GATA1,PU1", "Anfangszustand einfach");

// 4. Aus dem Anfangszustand entstehen ohne Eingriff genau vier Zelltypen (Experte) bzw. drei (einfach)
const N = 3000;
const frei = (m, eingriff) => B.haeufigkeit(m, eingriff || {}, N, gen(7));
let c = frei("experte");
pruefe(gleich(Object.keys(c).sort(), ["ery", "gran", "mk", "mono"]), "Experte frei: Zelltypen " + JSON.stringify(c));
c = frei("einfach");
pruefe(gleich(Object.keys(c).sort(), ["ery", "gm", "mk"]), "einfach frei: Zelltypen " + JSON.stringify(c));
pruefe(anteil(c, "ery", N) > .15 && anteil(c, "mk", N) > .15 && anteil(c, "gm", N) > .3, "einfach frei: alle drei Wege kommen vor");

// 5. Eingriffe (Voraussagen des Modells, wie bei Krumsiek et al. 2011)
c = frei("experte", {GATA2: "aus"});
pruefe(!c.ery && !c.mk, "GATA-2 aus: keine Erythrozyten und Megakaryozyten " + JSON.stringify(c));
c = frei("experte", {cJun: "aus"});
pruefe(!c.mono && c.gran && c.ery && c.mk, "cJun aus: keine Monozyten, sonst alles " + JSON.stringify(c));
c = frei("experte", {PU1: "aus"});
pruefe(gleich(Object.keys(c).sort(), ["ery", "mk"]), "PU.1 aus: nur Erythrozyten und Megakaryozyten " + JSON.stringify(c));
c = frei("experte", {Gfi1: "aus"});
pruefe(!c.gran && c.mono, "Gfi-1 aus: keine Granulozyten " + JSON.stringify(c));
c = frei("experte", {SCL: "aus"});
pruefe(gleich(Object.keys(c).sort(), ["ery", "gran", "mk", "mono"]) && anteil(c, "mono", N) > .05, "SCL aus: nichts ändert sich (SCL ohne aktive Rolle) " + JSON.stringify(c));
c = frei("einfach", {PU1: "an"});
pruefe(gleich(Object.keys(c), ["gm"]), "einfach, PU.1 an: nur myeloische Zellen " + JSON.stringify(c));
c = frei("einfach", {GATA1: "aus"});
pruefe(gleich(Object.keys(c), ["gm"]), "einfach, GATA-1 aus: nur myeloische Zellen " + JSON.stringify(c));

// 6. Umprogrammieren: fertige Zelle bekommt einen Eingriff
const umprogrammiere = (m, von, eingriff, seed) => {
  const zufall = gen(seed), z = B.stabile(m).find(s => B.typ(m, s) === von);
  const e = Object.assign({}, eingriff); B.festhalten(m, z, e); B.lauf(m, z, e, zufall);
  return B.typ(m, z);
};
let ok = true;
for (let s = 1; s <= 200; s++){ const t = umprogrammiere("experte", "mono", {GATA1: "an"}, s); if (t !== "ery" && t !== "mk") ok = false; }
pruefe(ok, "Monozyt + GATA-1 an wird zur Erythrozyten- oder Megakaryozytenlinie");
ok = true;
for (let s = 1; s <= 200; s++){ if (umprogrammiere("experte", "ery", {PU1: "an"}, s) !== "misch") ok = false; }
pruefe(ok, "Erythrozyt + PU.1 an gibt einen Mischzustand");

// 7. Ein festgehaltener Faktor ändert sich nie
{
  const z = B.festhalten("experte", B.neu("experte"), {PU1: "aus", GATA1: "an"});
  const v = B.lauf("experte", z, {PU1: "aus", GATA1: "an"}, gen(3));
  pruefe(!v.includes("PU1") && !v.includes("GATA1") && z.PU1 === false && z.GATA1 === true, "festgehaltene Faktoren bleiben");
}
// 8. Jeder Lauf endet
{
  let lang = 0;
  for (let s = 0; s < 500; s++){ const z = B.neu("experte"); if (B.lauf("experte", z, {}, gen(s)).length >= 500) lang++; }
  pruefe(lang === 0, "Läufe enden vor 500 Schritten");
}
console.log(fehler ? fehler + " Fehler" : "OK");
process.exit(fehler ? 1 : 0);
