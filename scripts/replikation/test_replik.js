// Test für template/site/replik.js: Aufruf  node scripts/replikation/test_replik.js
// Prüft Richtung (5'→3'), Basenpaarung, Fragmente, Primer, Ersatz und Nicks für viele zufällige Vorlagen.
const fs = require("fs"), path = require("path"), vm = require("vm");
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "..", "template", "site", "replik.js"), "utf8") + "\nglobalThis.R = REPLIK;", ctx);
const R = ctx.R;
let fehler = 0;
const pruefe = (ok, text) => { if (!ok){ fehler++; console.log("FEHLER:", text); } };
const rev = s => s.split("").reverse().join("");

for (const [n, frag, primer] of [[40, 10, 3], [40, 8, 3], [40, 20, 3], [30, 10, 2], [24, 12, 5]]){
  for (let i = 0; i < 300; i++){
    const p = R.erzeuge(Math.random, {n, frag, primer});
    const name = `n=${n}, frag=${frag}, primer=${primer}`;
    // Vorlagen: Gegenstränge
    pruefe(p.oben.length === n + 8 && p.unten.length === n + 8, name + ": Länge");
    for (let j = 0; j < p.oben.length; j++) pruefe(R.KOMP[p.oben[j]] === p.unten[j], name + ": Basenpaarung Spalte " + j);
    // Leitstrang: lückenlos von links nach rechts, die ersten primer Schritte RNA
    pruefe(p.leit.schritte.length === n, name + ": Leitstrang deckt alle Spalten ab");
    p.leit.schritte.forEach((s, j) => {
      pruefe(s.c === j, name + ": Leitstrang wächst nach rechts (5'→3' in Richtung der Gabel)");
      pruefe((s.typ === "rna") === (j < primer), name + ": Primer nur am Anfang des Leitstrangs");
    });
    // Folgestrang: Fragmente teilen 0 … n-1 lückenlos auf, jedes wächst nach links, Primer am rechten Ende
    pruefe(p.folge.length === n / frag, name + ": Zahl der Fragmente");
    let naechste = 0;
    p.folge.forEach(f => {
      pruefe(f.von === naechste && f.bis === f.von + frag, name + ": Fragmente schließen aneinander an"); naechste = f.bis;
      pruefe(f.schritte.length === frag, name + ": Fragmentlänge");
      f.schritte.forEach((s, j) => {
        pruefe(s.c === f.bis - 1 - j, name + ": Fragment wächst nach links (5'→3' von der Gabel weg)");
        pruefe((s.typ === "rna") === (j < primer), name + ": Primer am Anfang der Synthese des Fragments (rechtes Ende)");
      });
    });
    // Buchstaben: Gegenstück zur Vorlage (RNA mit U)
    for (const strang of ["leit", "folge"]){
      const teile = strang === "leit" ? [p.leit.schritte] : p.folge.map(f => f.schritte);
      teile.forEach(sch => sch.forEach(s => {
        const b = R.neu(p, strang, s.c, s.typ), m = p.vorlage(strang, s.c);
        pruefe(b === (s.typ === "rna" ? R.RNA : R.KOMP)[m], name + ": Gegenstück");
        pruefe(s.typ === "rna" ? "ACGU".includes(b) : "ACGT".includes(b), name + ": Alphabet");
        pruefe(s.typ === "rna" || b !== "U", name + ": kein U in DNA");
      }));
    }
    // Ersatz: jeder Primer genau einmal, Richtung der Polymerase 5'→3' (Leitstrang nach rechts, Folgestrang nach links)
    pruefe(p.ersatz.length === 1 + n / frag, name + ": Zahl der Primer");
    const rna = {leit: new Set(), folge: new Set()};
    p.leit.schritte.filter(s => s.typ === "rna").forEach(s => rna.leit.add(s.c));
    p.folge.forEach(f => f.schritte.filter(s => s.typ === "rna").forEach(s => rna.folge.add(s.c)));
    const ersetzt = {leit: new Set(), folge: new Set()};
    p.ersatz.forEach(e => {
      e.cols.forEach((c, j) => {
        ersetzt[e.strang].add(c);
        if (j) pruefe(c === e.cols[j - 1] + (e.strang === "leit" ? 1 : -1), name + ": Polymerase I läuft 5'→3'");
      });
      pruefe(e.cols.length === primer, name + ": Primerlänge im Ersatz");
      // Das 3'-Ende des Nachbarn liegt direkt neben dem ersten Ersatz (Leitstrang: links von 0, Folgestrang: rechts vom Primer)
      pruefe(e.strang === "leit" ? e.cols[0] === 0 : e.cols[0] % frag === frag - 1, name + ": Ersatz beginnt am 3'-Ende des Nachbarn");
      // Das Rückgrat bleibt zwischen nick und nick+1 offen, dort grenzt der Rest des alten Fragments an
      pruefe(e.strang === "leit" ? e.nick === e.cols[primer - 1] : e.nick === e.cols[primer - 1] - 1, name + ": Nick am Ende des Ersatzes");
    });
    for (const s of ["leit", "folge"]) pruefe([...rna[s]].sort().join() === [...ersetzt[s]].sort().join(), name + ": alle Primer, nur Primer ersetzt (" + s + ")");
    // Nicks: eine mehr als Fragmente + 2, sortiert, keine Doppelten
    pruefe(p.nicks.length === 3 + n / frag, name + ": Zahl der Nicks " + p.nicks.length);
    const geseh = new Set(p.nicks.map(x => x.strang + x.c));
    pruefe(geseh.size === p.nicks.length, name + ": Nicks verschieden");
    p.nicks.forEach((x, j) => { if (j) pruefe(p.nicks[j - 1].c <= x.c, name + ": Nicks sortiert"); });
    // Endzustand: neue Stränge sind Gegenstränge der Vorlagen
    const e = R.endzustand(p);
    pruefe(e.leit.length === n && e.folge.length === n, name + ": Endzustand Länge");
    pruefe(e.leit === p.oben.slice(4, 4 + n), name + ": Leitstrang gleicht der oberen Vorlage (gleiche Sequenz wie das Original)");
    pruefe(e.folge === p.unten.slice(4, 4 + n), name + ": Folgestrang gleicht der unteren Vorlage");
    const revkomp = t => rev(t).replace(/./g, b => R.KOMP[b]);
    pruefe(rev(e.folge) === revkomp(p.oben.slice(4, 4 + n)), name + ": Folgestrang, 5'→3' gelesen, ist revers komplementär zur oberen Vorlage");
    pruefe(e.leit === revkomp(rev(p.unten.slice(4, 4 + n))) , name + ": Leitstrang ist komplementär zur unteren Vorlage");
  }
}
// Falsche Eingaben
for (const [oben, opt] of [["ACGT", {}], ["A".repeat(48), {frag: 7}], ["A".repeat(48), {primer: 10}], ["X".repeat(48), {}]]){
  let fehlerGeworfen = false; try { R.plan(oben, opt); } catch (e) { fehlerGeworfen = true; }
  pruefe(fehlerGeworfen, "ungültige Eingabe wird abgelehnt: " + JSON.stringify(opt));
}
console.log(fehler ? fehler + " Fehler" : "OK");
process.exit(fehler ? 1 : 0);
