// Test für template/site/gen.js: Aufruf  node scripts/transkription/test_gen.js
// Prüft die Bausteine (Länge, Signale, Leseraster) und geht alle 120 Anordnungen durch.
const fs = require("fs"), path = require("path"), vm = require("vm");
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "..", "template", "site", "gen.js"), "utf8") + "\nglobalThis.G = GEN;", ctx);
const G = ctx.G;
let fehler = 0;
const pruefe = (ok, text) => { if (!ok){ fehler++; console.log("FEHLER:", text); } };

// Bausteine
pruefe(G.BAUSTEINE.length === 5, "fünf Bausteine");
for (const b of G.BAUSTEINE) pruefe(/^[ACGT]{12}$/.test(b.seq), `${b.name}: 12 Basen aus ACGT`);
const B = G.BAUSTEINE;
pruefe(B[G.PROM].seq.slice(...[B[G.PROM].tata[0], B[G.PROM].tata[1] + 1]) === "TATAAA", "TATA-Box an der angegebenen Stelle");
pruefe(B[G.UTR5].seq.endsWith("GCCACC"), "5'-UTR endet mit der Kozak-Sequenz");
pruefe(!B[G.UTR5].seq.includes("ATG"), "5'-UTR enthält kein ATG");
pruefe(B[G.UTR3].seq.includes("AATAAA"), "3'-UTR enthält das Polyadenylierungssignal");
const cds = B[G.CDS].seq;
pruefe(cds.startsWith("ATG") && cds.length % 3 === 0, "codierender Bereich beginnt mit ATG und hat ganze Codons");
pruefe(["TAA", "TAG", "TGA"].includes(cds.slice(-3)), "codierender Bereich endet mit einem Stopp-Codon");
for (let i = 3; i < cds.length - 3; i += 3) pruefe(!["TAA", "TAG", "TGA"].includes(cds.slice(i, i + 3)), "kein Stopp-Codon mitten im Gen (Codon " + i / 3 + ")");
const kompl = {A: "T", T: "A", G: "C", C: "G"}, rc = s => [...s].reverse().map(c => kompl[c]).join("");
const term = B[G.TERM].seq;
pruefe(term.slice(0, 4) === rc(term.slice(-4)), "Terminator: Anfang und Ende bilden eine Haarnadel");

// Alle Anordnungen
const perm = (a) => a.length <= 1 ? [a] : a.flatMap((x, i) => perm([...a.slice(0, i), ...a.slice(i + 1)]).map(r => [x, ...r]));
const alle = perm([0, 1, 2, 3, 4]);
pruefe(alle.length === 120, "120 Anordnungen");
const richtige = alle.filter(a => G.analysiere(a).ok);
pruefe(richtige.length === 1 && richtige[0].join() === "0,1,2,3,4", "genau eine Anordnung ist richtig: " + richtige.map(r => r.join("")));
pruefe(G.rna([0, 1, 2, 3, 4], G.analysiere([0, 1, 2, 3, 4])) === "CAGAGCGCCACCAUGGGCGAAUGACCAAUAAAGGCUGCCCAAAAGGGC", "RNA der richtigen Anordnung");

// Einzelfälle
const a = (platz) => G.analysiere(platz);
pruefe(a([1, 2, 3, 4, 0]).von === 60 && a([1, 2, 3, 4, 0]).bis === 60 && a([1, 2, 3, 4, 0]).teile.length === 0, "Promotor ganz hinten: nichts abzuschreiben");
pruefe(a([2, 0, 1, 3, 4]).teile.join() === "1,3,4", "Baustein vor dem Promotor wird nicht abgeschrieben");
pruefe(a([0, 4, 1, 2, 3]).teile.join() === "4" && a([0, 4, 1, 2, 3]).bis === 24, "Terminator direkt hinter dem Promotor: nur der Terminator");
pruefe(a([4, 0, 1, 2, 3]).teile.join() === "1,2,3" && !a([4, 0, 1, 2, 3]).stopp && a([4, 0, 1, 2, 3]).bis === 60, "Terminator vor dem Promotor: läuft bis zum Ende der DNA");
pruefe(a([0, 2, 1, 3, 4]).teile.join() === "2,1,3,4" && !a([0, 2, 1, 3, 4]).ok, "vertauschte Abschnitte sind nicht richtig");
for (const x of alle){
  const r = a(x);
  pruefe(r.von === (r.p + 1) * 12 && r.bis >= r.von && r.bis <= 60, "Grenzen der Anordnung " + x.join(""));
  pruefe(G.rna(x, r).length === r.bis - r.von, "RNA-Länge passt zu den Grenzen: " + x.join(""));
}
console.log(fehler ? fehler + " Fehler." : "OK (" + alle.length + " Anordnungen geprüft).");
process.exit(fehler ? 1 : 0);
