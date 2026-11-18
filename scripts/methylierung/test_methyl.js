// Test für template/site/methyl.js: Aufruf  node scripts/methylierung/test_methyl.js
// Prüft Grundzustand, Wirkung der Stellen (Bindestelle, Promotor, Genkörper), die Aufgaben der Seite und die Weitergabe bei der Teilung.
const fs = require("fs"), path = require("path"), vm = require("vm");
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "..", "template", "site", "methyl.js"), "utf8") + "\nglobalThis.M = METHYL;", ctx);
const M = ctx.M;
let fehler = 0;
const pruefe = (ok, text) => { if (!ok){ fehler++; console.log("FEHLER:", text); } };
const nah = (a, b) => Math.abs(a - b) < 1e-9;
const mit = (...stellen) => { const s = M.neu(); stellen.forEach(i => M.setze(s, i, 1)); return s; };

// Grundzustand
let z = M.zahlen(M.neu());
pruefe(nah(z.expr, 1) && nah(z.tf, 1) && z.mbd === 0 && z.voll === 0, "unmethyliert: volle Ablesung");
pruefe(M.N === 14 && M.SITES.filter(x => x.motif).length === 2 && M.SITES.filter(x => x.region === "koerper").length === 4, "Aufbau der Stellen");

// Bindestelle: eine Stelle senkt auf 20 %, zwei auf 4 %
pruefe(nah(M.tf(mit(4)), 0.2) && nah(M.tf(mit(4, 5)), 0.04), "TF-Bindung bei ein und zwei methylierten Stellen");
pruefe(M.zahlen(mit(4, 5)).expr < 0.05, "Aufgabe 1: zwei Stellen in der Bindestelle schalten unter 5 % ab");
// Aufgabe 1 ist mit weniger als zwei ganzen Stellen nicht zu schaffen
for (let i = 0; i < M.N; i++) pruefe(M.zahlen(mit(i)).expr >= 0.05, "eine einzelne Stelle " + i + " reicht nicht für unter 5 %");
// … und zwei Stellen schaffen es nur, wenn beide in der Bindestelle liegen
let paare = [];
for (let i = 0; i < M.N; i++) for (let j = i + 1; j < M.N; j++) if (M.zahlen(mit(i, j)).expr < 0.05) paare.push([i, j]);
pruefe(paare.length === 1 && paare[0][0] === 4 && paare[0][1] === 5, "genau ein Paar (4, 5) schafft unter 5 %: " + JSON.stringify(paare));

// Genkörper ändert nichts
pruefe(nah(M.expression(mit(10, 11, 12, 13)), 1), "Methylierung im Genkörper ändert die Ablesung nicht");
// Flanken im Promotor wirken kooperativ: wenige kaum, viele stark
const flanke = [0, 1, 2, 3, 6, 7, 8, 9];
let letzte = 1;
for (let k = 1; k <= flanke.length; k++){
  const e = M.expression(mit(...flanke.slice(0, k)));
  pruefe(e <= letzte + 1e-12, "Ablesung sinkt mit mehr methylierten Flanken (k=" + k + ")");
  letzte = e;
}
pruefe(M.expression(mit(0)) > 0.99, "eine einzelne Flankenstelle fast ohne Wirkung");
pruefe(M.expression(mit(...flanke)) < 0.35, "alle acht Flankenstellen senken stark");
// Aufgabe 2: mindestens 8 ganze Stellen und trotzdem über 50 %
const a2 = mit(10, 11, 12, 13, 0, 1, 2, 3);
pruefe(M.ganzeStellen(a2) >= 8 && M.expression(a2) > 0.5, "Aufgabe 2 ist lösbar: " + M.expression(a2));
pruefe(M.expression(M.alle(1)) < 0.01, "alles methyliert: praktisch aus");
// Symmetrie: oben/unten gleich bewertet
const hemi = M.neu(); hemi.oben[4] = 1;
pruefe(nah(M.tf(hemi), 0.6), "hemimethylierte Bindestelle: 60 %");
const hemi2 = M.neu(); hemi2.unten[4] = 1;
pruefe(nah(M.expression(hemi), M.expression(hemi2)), "oben und unten gleich gewertet");

// Teilung mit DNMT1 (Wirksamkeit 1): beide Töchter wie die Mutter
const mutter = M.zufallsmuster(Math.random, 0.5);
let [A, B] = M.teile(mutter, 1, Math.random);
pruefe(JSON.stringify(A) === JSON.stringify(mutter) && JSON.stringify(B) === JSON.stringify(mutter), "Teilung mit DNMT1: Muster bleibt erhalten");
// Teilung ohne DNMT1: halbe Methylierung, ein Elternstrang pro Tochter
[A, B] = M.teile(mutter, 0, Math.random);
for (let i = 0; i < M.N; i++){
  pruefe(A.unten[i] === 0 && B.oben[i] === 0, "neuer Strang unmethyliert, Stelle " + i);
  pruefe(A.oben[i] === mutter.oben[i] && B.unten[i] === mutter.unten[i], "Elternstrang bleibt, Stelle " + i);
}
// Ohne DNMT1 über mehrere Teilungen: der Anteil methylierter Stränge halbiert sich im Mittel je Teilung, nach 6 Teilungen ist fast nichts mehr da
const voll = M.alle(1);
let summe = 0; const n = 4000;
for (let r = 0; r < n; r++){
  let s = voll;
  for (let g = 0; g < 6; g++) s = M.teile(s, 0, Math.random)[Math.random() < 0.5 ? 0 : 1];
  for (let i = 0; i < M.N; i++) summe += (s.oben[i] + s.unten[i]);
}
const anteil = summe / (n * M.N * 2);
pruefe(anteil < 0.03, "ohne DNMT1 nach 6 Teilungen fast alles verloren: " + anteil.toFixed(4));
// Nach einer Teilung ohne DNMT1 sind alle Stellen hemimethyliert (nur der Elternstrang trägt noch Methylgruppen)
const ein = M.alle(1); const [A1] = M.teile(ein, 0, Math.random);
pruefe(A1.oben.every(x => x === 1) && A1.unten.every(x => x === 0), "nach einer Teilung ohne DNMT1 sind alle Stellen hemimethyliert");
// Mit DNMT1 über viele Teilungen: Muster bleibt
let s = mutter;
for (let g = 0; g < 20; g++) s = M.teile(s, 1, Math.random)[Math.random() < 0.5 ? 0 : 1];
pruefe(JSON.stringify(s) === JSON.stringify(mutter), "mit DNMT1 bleibt das Muster über 20 Teilungen");
// Wirksamkeit 0,9: nach vielen Teilungen geht Methylierung langsam verloren
let rest = 0; const m = 2000;
for (let r = 0; r < m; r++){ let t = M.alle(1); for (let g = 0; g < 10; g++) t = M.teile(t, 0.9, Math.random)[Math.random() < 0.5 ? 0 : 1]; rest += M.ganzeStellen(t); }
const quote = rest / (m * M.N);
pruefe(quote > 0.2 && quote < 0.8, "Wirksamkeit 0,9: Verlust langsam, Anteil ganzer Stellen nach 10 Teilungen " + quote.toFixed(2));

console.log(fehler ? fehler + " Fehler." : "Alles in Ordnung.");
process.exit(fehler ? 1 : 0);
