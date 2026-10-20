// Test für template/site/gen.js: Aufruf  node scripts/transkription/test_gen.js
// Prüft die Bausteine, geht alle 5040 Anordnungen durch und prüft das Mischen des Vorrats.
const fs = require("fs"), path = require("path"), vm = require("vm");
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "..", "template", "site", "gen.js"), "utf8") + "\nglobalThis.G = GEN;", ctx);
const G = ctx.G;
let fehler = 0;
const pruefe = (ok, text) => { if (!ok){ fehler++; console.log("FEHLER:", text); } };

// Bausteine
const B = G.BAUSTEINE;
pruefe(B.length === 7 && G.N === 7, "sieben Bausteine");
pruefe(B.filter(b => b.key === "exon").length === 3 && B.filter(b => b.key === "intron").length === 2, "drei Exons, zwei Introns");
pruefe(B[G.PROM].key === "prom" && B[G.TERM].key === "term", "Promotor und Terminator an den bekannten Stellen");
const prom = B[G.PROM];
pruefe(/^[ACGT]+$/.test(prom.seq) && prom.seq.length === G.L, "Promotor hat Sequenz mit " + G.L + " Basen");
pruefe(prom.seq.slice(prom.tata[0], prom.tata[1] + 1) === "TATAAA", "TATA-Box an der angegebenen Stelle");
for (const b of B) if (b.key !== "prom") pruefe(!b.seq, b.name + " ist schematisch (ohne Sequenz)");
pruefe(G.SOLL.join() === "prom,exon,intron,exon,intron,exon,term", "Reihenfolge eines Gens");

// Alle Anordnungen
const perm = (a) => a.length <= 1 ? [a] : a.flatMap((x, i) => perm([...a.slice(0, i), ...a.slice(i + 1)]).map(r => [x, ...r]));
const alle = perm([0, 1, 2, 3, 4, 5, 6]);
pruefe(alle.length === 5040, "5040 Anordnungen");
const richtige = alle.filter(a => G.analysiere(a).ok);
pruefe(richtige.length === 12, "12 richtige Anordnungen (3! Exons mal 2! Introns): " + richtige.length);
pruefe(richtige.every(a => a.map(G.typ).join() === G.SOLL.join()), "alle richtigen Anordnungen haben die Typenfolge des Gens");

const a = platz => G.analysiere(platz);
pruefe(a([1, 4, 2, 5, 3, 6, 0]).teile.length === 0 && a([1, 4, 2, 5, 3, 6, 0]).bis === 56, "Promotor ganz hinten: nichts abzuschreiben");
pruefe(a([1, 0, 4, 2, 5, 3, 6]).teile.join() === "4,2,5,3,6", "Baustein vor dem Promotor wird nicht abgeschrieben");
pruefe(a([0, 6, 1, 4, 2, 5, 3]).teile.join() === "6" && a([0, 6, 1, 4, 2, 5, 3]).bis === 16, "Terminator direkt hinter dem Promotor: nur der Terminator");
pruefe(!a([6, 0, 1, 4, 2, 5, 3]).stopp && a([6, 0, 1, 4, 2, 5, 3]).bis === 56 && a([6, 0, 1, 4, 2, 5, 3]).teile.length === 5, "Terminator vor dem Promotor: bis zum Ende der DNA");
pruefe(!a([0, 4, 1, 5, 2, 3, 6]).ok, "Intron direkt hinter dem Promotor ist nicht richtig");
pruefe(!a([0, 1, 2, 4, 5, 3, 6]).ok, "zwei Exons hintereinander sind nicht richtig");
for (const x of alle){
  const r = a(x);
  if (r.von !== (r.p + 1) * 8 || r.bis < r.von || r.bis > 56) { pruefe(false, "Grenzen der Anordnung " + x.join("")); break; }
}

// Vorrat mischen: immer eine Permutation, nie in Gen-Reihenfolge, nie ein Typ an der Stelle, die er im Gen hätte; wirklich zufällig
const gesehen = new Set();
for (let i = 0; i < 3000; i++){
  const v = G.vorrat(Math.random);
  pruefe(v.slice().sort().join() === "0,1,2,3,4,5,6", "Vorrat enthält jeden Baustein genau einmal");
  pruefe(v.every((id, k) => G.typ(id) !== G.SOLL[k]), "kein Baustein an einer Stelle, die dem fertigen Gen entspricht: " + v.join(""));
  gesehen.add(v.join(""));
}
pruefe(gesehen.size > 100, "viele verschiedene Reihenfolgen im Vorrat: " + gesehen.size);
console.log(fehler ? fehler + " Fehler." : "OK (" + alle.length + " Anordnungen, " + gesehen.size + " Vorräte).");
process.exit(fehler ? 1 : 0);
