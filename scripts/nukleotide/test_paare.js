// Test für die Basenpaarung in template/site/dna2d.js: Aufruf  node scripts/nukleotide/test_paare.js
// Von allen 32 Kombinationen (DNA und RNA) darf nur A-T/U und G-C passen; A-T/U muss 2, G-C 3
// Wasserstoffbrücken ergeben, zwei Purine müssen als überlappend abgelehnt werden.
const fs = require("fs"), path = require("path"), vm = require("vm");
const site = path.join(__dirname, "..", "..", "template", "site");
const ctx = {document: {documentElement: {getAttribute: () => null}}, matchMedia: () => ({matches: false})};
ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(["palette.js", "nuc-data.js", "dna2d.js"].map(f => fs.readFileSync(path.join(site, f), "utf8")).join("\n") + "\nglobalThis.D = DNA2D;", ctx);
const D = ctx.D, x = 3.714;
let fehler = 0;
for (const [f, alph, at] of [["DNA", "ACGT", "T"], ["RNA", "ACGU", "U"]]){
  const partner = {A: at, G: "C", C: "G"}; partner[at] = "A";
  for (const a of alph) for (const b of alph){
    const r = D.bruecken(D.kachel(a, f, "l"), [-x, 0], D.kachel(b, f, "r"), [x, 0]);
    const soll = partner[a] === b, anzahl = soll ? ((a === "G" || a === "C") ? 3 : 2) : null;
    if (r.passt !== soll || (soll && r.liste.length !== anzahl)){ fehler++; console.log(`FEHLER ${f} ${a}·${b}: passt=${r.passt}, Brücken=${r.liste.length}, klirr=${r.klirr.toFixed(2)}`); }
  }
}
console.log(fehler ? fehler + " Fehler" : "OK: alle 32 Kombinationen richtig (A-T/U 2, G-C 3 Brücken, Purine überlappen).");
process.exit(fehler ? 1 : 0);
