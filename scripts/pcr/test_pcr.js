// Test für template/site/pcr.js: Aufruf  node scripts/pcr/test_pcr.js
// Prüft Primer, Richtung (5'→3'), Länge der Stränge je Zyklus, die Zählung (2^n und 2^n − 2n) und die Sonderfälle.
const fs = require("fs"), path = require("path"), vm = require("vm");
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "..", "template", "site", "pcr.js"), "utf8") + "\nglobalThis.R = PCR;", ctx);
const R = ctx.R;
let fehler = 0;
const pruefe = (ok, text) => { if (!ok){ fehler++; console.log("FEHLER:", text); } };
const rev = s => s.split("").reverse().join("");
const komp = s => s.replace(/./g, b => R.KOMP[b]);

for (const [rand, ziel, primer] of [[4, 20, 5], [4, 20, 3], [6, 30, 8], [2, 10, 5], [1, 12, 4]]){
  for (let i = 0; i < 100; i++){
    const p = R.erzeuge(Math.random, {rand, ziel, primer});
    const name = `rand=${rand}, ziel=${ziel}, primer=${primer}`;
    pruefe(p.M === ziel + 2 * rand && p.oben.length === p.M && p.unten.length === p.M, name + ": Länge");
    for (let c = 0; c < p.M; c++) pruefe(R.KOMP[p.oben[c]] === p.unten[c], name + ": Basenpaarung Spalte " + c);
    // Primer: Primer 1 steht in der oberen Kette (5'→3' wie sie), Primer 2 ist das Gegenstück des rechten Endes, rückwärts gelesen
    pruefe(p.primer1 === p.oben.slice(p.a, p.a + primer), name + ": Primer 1 gleich der oberen Kette am linken Ende");
    pruefe(p.primer2 === rev(komp(p.oben.slice(p.b - primer, p.b))), name + ": Primer 2 komplementär zum rechten Ende (5'→3')");
    pruefe(p.primer1.length === primer && p.primer2.length === primer, name + ": Primerlänge");
    pruefe(p.primer1 !== undefined && p.basis("top", p.a) === p.primer1[0], name + ": basis (top)");
    pruefe(p.basis("bottom", p.b - 1) === p.primer2[0], name + ": 5'-Ende von Primer 2 liegt bei b-1");

    // Zyklen: Zahl der Doppelstränge 2^n, Zielstränge nach 2^n − 2n, Längen der Stränge
    let ds = R.start(p);
    for (let n = 1; n <= 12; n++){
      ds = R.zyklus(ds, p);
      const z = R.zaehle(ds, p), f = R.zahlen(n);
      pruefe(z.gesamt === f.gesamt, `${name}: gesamt nach ${n} Zyklen ${z.gesamt} ≠ ${f.gesamt}`);
      pruefe(z.ziel === f.ziel, `${name}: Ziel nach ${n} Zyklen ${z.ziel} ≠ ${f.ziel}`);
    }
    // Strangtypen nach drei Zyklen
    ds = R.start(p);
    for (let n = 1; n <= 3; n++) ds = R.zyklus(ds, p);
    ds.forEach(d => {
      for (const s of [d.top, d.bottom]){
        const lang = s.von === 0 || s.bis === p.M, ziel_ = s.von === p.a && s.bis === p.b;
        pruefe(lang || ziel_ || (s.art === "top" && s.von === p.a && s.bis === p.M) || (s.art === "bottom" && s.von === 0 && s.bis === p.b), name + ": unbekannter Strangtyp");
        pruefe(s.von >= 0 && s.bis <= p.M && s.von < s.bis, name + ": Strang liegt außerhalb");
      }
      // Paarung: Die Stränge eines Doppelstrangs überlappen mindestens in der Zielsequenz
      pruefe(Math.max(d.top.von, d.bottom.von) <= p.a && Math.min(d.top.bis, d.bottom.bis) >= p.b, name + ": Doppelstrang deckt die Zielsequenz nicht ab");
    });
    // Nach zwei Zyklen gibt es noch keinen Doppelstrang mit Zielsequenz in beiden Strängen, nach drei die ersten zwei
    ds = R.start(p); ds = R.zyklus(ds, p); ds = R.zyklus(ds, p);
    pruefe(R.zaehle(ds, p).ziel === 0, name + ": nach zwei Zyklen noch kein Doppelstrang mit Zielsequenz beidseitig");
    ds = R.zyklus(ds, p);
    pruefe(R.zaehle(ds, p).ziel === 2, name + ": nach drei Zyklen genau zwei");
    // Zielsequenz-Stränge nach zwei Zyklen: einer je Richtung
    let z2 = R.start(p); z2 = R.zyklus(R.zyklus(z2, p), p);
    const ziele = [].concat(...z2.map(d => [d.top, d.bottom])).filter(s => s.von === p.a && s.bis === p.b);
    pruefe(ziele.length === 2 && ziele.some(s => s.art === "top") && ziele.some(s => s.art === "bottom"), name + ": zwei Einzelstränge der Zielsequenz nach zwei Zyklen");

    // Sonderfälle: ohne Primerbindung oder ohne Polymerase bleibt alles, wie es war
    const s0 = R.start(p);
    pruefe(R.zyklus(s0, p, {bindet: false}).length === 1, name + ": zu heiß, nichts Neues");
    pruefe(R.zyklus(s0, p, {verlaengert: false}).length === 1, name + ": Polymerase zerstört, nichts Neues");
    pruefe(JSON.stringify(R.zyklus(s0, p, {verlaengert: false})) === JSON.stringify(s0), name + ": Zustand unverändert");
  }
}

// Geschlossene Form
const f = [[0, 1, 0], [1, 2, 0], [2, 4, 0], [3, 8, 2], [4, 16, 8], [10, 1024, 1004], [30, 1073741824, 1073741764]];
f.forEach(([n, g, z]) => { const r = R.zahlen(n); pruefe(r.gesamt === g && r.ziel === z, `zahlen(${n}) = ${JSON.stringify(r)}`); });

// Schmelztemperatur und Bewertung
pruefe(Math.abs(R.tm(20, 0.5) - 51.8) < 0.05, "Tm 20 Basen, 50 % GC");
pruefe(R.tm(25, 0.6) > R.tm(25, 0.4), "mehr GC, höhere Tm");
pruefe(R.tm(30, 0.5) > R.tm(20, 0.5), "länger, höhere Tm");
pruefe(R.bewerte(60, 52) === "heiss" && R.bewerte(50, 52) === "gut" && R.bewerte(42, 52) === "gut" && R.bewerte(41, 52) === "kalt", "Bewertung der Temperatur");

// Fehlerfälle
for (const [oben, opt] of [["ACGT", {}], ["ACGTACGTACGTACGTACGTACGTACGX", {}], ["ACGTACGTACGTACGTACGTACGTACGT", {primer: 11}], ["ACGTACGTACGT", {rand: 0, ziel: 12, primer: 4}]]){
  let geworfen = false; try { R.plan(oben, opt); } catch (e) { geworfen = true; }
  pruefe(geworfen, "plan soll bei ungültiger Eingabe einen Fehler werfen: " + oben);
}

console.log(fehler ? `${fehler} Fehler` : "pcr.js: alle Tests bestanden");
process.exit(fehler ? 1 : 0);
