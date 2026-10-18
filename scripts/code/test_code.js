// Test für template/site/code.js: Aufruf  node scripts/code/test_code.js
// Prüft die Codon-Tabelle (Standardcode) und den Aufbau der Versuche mit wiederholten mRNAs.
const fs = require("fs"), path = require("path"), vm = require("vm");
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "..", "template", "site", "code.js"), "utf8") + "\nglobalThis.G = GENCODE;", ctx);
const G = ctx.G;
let fehler = 0;
const pruefe = (ok, text) => { if (!ok){ fehler++; console.log("FEHLER:", text); } };

// Standardcode: bekannte Stichproben und Anzahlen
const stichprobe = {AUG: "Met", UGG: "Trp", UUU: "Phe", UUA: "Leu", CUG: "Leu", AGA: "Arg", AGC: "Ser", UCA: "Ser", GAU: "Asp", GAA: "Glu", UAA: "Stopp", UAG: "Stopp", UGA: "Stopp", AAA: "Lys", GGG: "Gly", CCU: "Pro", AUA: "Ile", UGU: "Cys", CAU: "His", CAA: "Gln"};
for (const [c, a] of Object.entries(stichprobe)) pruefe(G.TABELLE[c] === a, `Codon ${c} soll ${a} sein, ist ${G.TABELLE[c]}`);
const anzahl = {}; for (const c of G.CODONS) anzahl[G.TABELLE[c]] = (anzahl[G.TABELLE[c]] || 0) + 1;
pruefe(G.CODONS.length === 64, "64 Codons");
pruefe(anzahl.Stopp === 3 && anzahl.Met === 1 && anzahl.Trp === 1, "Stopp 3, Met 1, Trp 1");
for (const a of ["Leu", "Ser", "Arg"]) pruefe(anzahl[a] === 6, a + " hat 6 Codons");
for (const a of ["Ala", "Gly", "Pro", "Thr", "Val"]) pruefe(anzahl[a] === 4, a + " hat 4 Codons");
for (const a of ["Ile"]) pruefe(anzahl[a] === 3, "Ile hat 3 Codons");
pruefe(Object.keys(G.AS).length === 20, "20 Aminosäuren");

// Teilcode: stimmt mit dem Standardcode überein
let teil = 0;
for (const t of G.TEILCODE) for (const c of t.codons){ teil++; pruefe(G.TABELLE[c] === t.aa, `Teilcode ${c} soll ${t.aa} sein`); }
pruefe(teil === 26, "26 Codons im Teilcode");

// Versuche: nur verfügbare Leserahmen, Abdeckung des Teilcodes
const erreicht = new Set();
for (const u of G.VERSUCHE){
  const r = G.rahmen(u);
  pruefe(r.some(x => x.verfuegbar), `Versuch (${u})n hat keinen verfügbaren Leserahmen`);
  for (const x of r) if (x.verfuegbar) x.codons.forEach(c => erreicht.add(c));
}
for (const n of G.NICHT_HERSTELLBAR) if (n.einheit.length > 1) pruefe(!G.rahmen(n.einheit).some(x => x.verfuegbar) || n.einheit === "G", `(${n.einheit})n sollte keinen verfügbaren Rahmen haben`);
const fehlt = [...G.IMTEIL].filter(c => !erreicht.has(c)).sort();
console.log(`Vorgegebene mRNAs erreichen ${erreicht.size} von ${G.IMTEIL.size} Codons (${Math.round(erreicht.size / G.IMTEIL.size * 100)} %). Es fehlen: ${fehlt.join(" ")}`);
pruefe(erreicht.size / G.IMTEIL.size >= 0.75, "mindestens drei Viertel der Codons erreichbar");
pruefe(fehlt.length >= 4, "ein Rest bleibt für die eigenen mRNAs");

// Beispiele aus der Aufgabe
const u = (m, f) => G.uebersetze(m, f).aa.join("-");
pruefe(u("UUUUUUUUU", 0) === "Phe-Phe-Phe", "Poly-U");
pruefe(u("CGCGCGCGCGCG", 0) === "Arg-Ala-Arg-Ala", "Poly-CG Rahmen 1");
pruefe(u("CGCGCGCGCGCG", 1) === "Ala-Arg-Ala", "Poly-CG Rahmen 2");
pruefe(u("CGCCGCCGCCGC", 0) === "Arg-Arg-Arg-Arg" && u("CGCCGCCGCCGC", 1) === "Ala-Ala-Ala" && u("CGCCGCCGCCGC", 2) === "Pro-Pro-Pro", "Poly-CGC, drei Rahmen");
pruefe(u("CGCACGCACGCA", 0) === "Arg-Thr-His-Ala", "Poly-CGCA");
pruefe(G.uebersetze("AUGUAAGGG", 0).stopp, "Stopp-Codon beendet die Translation");
console.log(fehler ? fehler + " Fehler" : "OK: Standardcode und Versuche stimmen.");
process.exit(fehler ? 1 : 0);
