// Test für template/site/helix.js: Aufruf  node scripts/nukleotide/test_helix.js
// Prüft Anstieg, Drehung, O3'-P-Abstand und Wasserstoffbrücken-Abstände des gebauten Duplex.
const fs = require("fs"), path = require("path"), vm = require("vm");
const site = path.join(__dirname, "..", "..", "template", "site");
const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(site, "nuc-data.js"), "utf8") + "\n" +
                fs.readFileSync(path.join(site, "helix.js"), "utf8") +
                "\nglobalThis.HB = HELIX_BAU; globalThis.HX = HELIX;", ctx);
const {HB, HX} = ctx;

let fehler = 0;
const pruefe = (ok, text) => { if (!ok) { fehler++; console.log("FEHLER:", text); } };
const nah = (a, b, tol) => Math.abs(a - b) <= tol;

const PAARE = {AT: [["N1", "N3"], ["N6", "O4"]], AU: [["N1", "N3"], ["N6", "O4"]], GC: [["N1", "N3"], ["N2", "O2"], ["O6", "N4"]]};
const zufall = (alph, n, seed) => { let s = seed; let o = ""; for (let i = 0; i < n; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; o += alph[s % alph.length]; } return o; };

for (const [form, alph] of [["DNA", "ACGT"], ["RNA", "ACGU"]]) {
  let hbMin = 9, hbMax = 0, linkMin = 9, linkMax = 0, nHB = 0;
  for (let t = 0; t < 30; t++) {
    const seq = zufall(alph, 12, 7 + t * 31), d = HB.bauen(seq, form), id = d.index;
    pruefe(d.strang2 === HB.gegenstrang(seq, form), "Gegenstrang " + seq);
    // O3'-P-Abstand beider Stränge
    for (let k = 0; k < 11; k++) {
      for (const [a, b] of [["1:" + k + ":O3'", "1:" + (k + 1) + ":P"], ["2:" + (k + 1) + ":O3'", "2:" + k + ":P"]]) {
        const l = HB.abstand(d.atome[id[a]], d.atome[id[b]]);
        linkMin = Math.min(linkMin, l); linkMax = Math.max(linkMax, l);
      }
    }
    // Wasserstoffbrücken
    for (let k = 0; k < 12; k++) {
      const b1 = seq[k], b2 = HB.KOMP[form][b1];
      const key = (b1 + b2) in PAARE ? b1 + b2 : b2 + b1, flip = !((b1 + b2) in PAARE);
      for (const [x, y] of PAARE[key]) {
        const [a1, a2] = flip ? [y, x] : [x, y];
        const l = HB.abstand(d.atome[id["1:" + k + ":" + a1]], d.atome[id["2:" + k + ":" + a2]]);
        hbMin = Math.min(hbMin, l); hbMax = Math.max(hbMax, l); nHB++;
      }
    }
    // Anstieg und Drehung aus den C1'-Atomen von Strang 1
    if (t === 0) {
      const c1 = k => d.atome[id["1:" + k + ":C1'"]].pos;
      const w = k => Math.atan2(c1(k)[1], c1(k)[0]);
      let dw = (w(6) - w(5)) * 180 / Math.PI; if (dw < -180) dw += 360; if (dw > 180) dw -= 360;
      const dz = c1(6)[2] - c1(5)[2];
      pruefe(nah(dw, HX[form].drehung, 1.5), form + " Drehwinkel " + dw.toFixed(2));
      pruefe(nah(dz, HX[form].anstieg, 0.6), form + " Anstieg " + dz.toFixed(2));
      console.log(`${form}: Drehwinkel ${dw.toFixed(1)}° (Soll ${HX[form].drehung}°), Anstieg ${dz.toFixed(2)} Å (Soll ${HX[form].anstieg} Å)`);
      pruefe(d.atome.filter(a => a.rolle === "p5").length === 6, "zwei freie 5'-Phosphate");
      pruefe(d.atome.filter(a => a.rolle === "oh3").length === 2, "zwei freie 3'-OH");
    }
  }
  console.log(`${form}: O3'-P ${linkMin.toFixed(2)}–${linkMax.toFixed(2)} Å (Soll 1,60), ${nHB} H-Brücken ${hbMin.toFixed(2)}–${hbMax.toFixed(2)} Å (Soll ca. 2,6–3,2)`);
  pruefe(nah(linkMin, 1.6, 0.05) && nah(linkMax, 1.6, 0.05), form + " O3'-P-Abstand");
  pruefe(hbMin > 2.4 && hbMax < 3.3, form + " H-Brücken-Abstände");
}
// DNA-RNA-Hybrid (Transkription): Vorlage DNA mit T ohne 2'-OH, neuer Strang RNA, A-Form
{
  let hbMin = 9, hbMax = 0, linkMin = 9, linkMax = 0;
  for (let t = 0; t < 30; t++) {
    const seq = zufall("ACGT", 12, 5 + t * 17), d = HB.bauen(seq, "RNA", {hybrid: true}), id = d.index;
    pruefe(!d.atome.some(a => a.strang === 1 && a.name === "O2'"), "Hybrid: DNA-Strang ohne 2'-OH");
    pruefe(d.atome.some(a => a.strang === 2 && a.name === "O2'"), "Hybrid: RNA-Strang mit 2'-OH");
    const K = {A: "U", T: "A", G: "C", C: "G"};
    for (let k = 0; k < 11; k++) for (const [a, b] of [["1:" + k + ":O3'", "1:" + (k + 1) + ":P"], ["2:" + (k + 1) + ":O3'", "2:" + k + ":P"]]) {
      const l = HB.abstand(d.atome[id[a]], d.atome[id[b]]); linkMin = Math.min(linkMin, l); linkMax = Math.max(linkMax, l);
    }
    for (let k = 0; k < 12; k++) {
      const b1 = seq[k], b2 = K[b1], key = (b1 === "T" ? "A" : b1) + (b2 === "U" ? "U" : b2);
      const lst = {AU: [["N1", "N3"], ["N6", "O4"]], TA: [["N3", "N1"], ["O4", "N6"]], GC: [["N1", "N3"], ["N2", "O2"], ["O6", "N4"]], CG: [["N3", "N1"], ["O2", "N2"], ["N4", "O6"]]}[b1 + b2];
      pruefe(!!lst, "Hybrid: Paar " + b1 + b2);
      if (!lst) continue;
      for (const [x, y] of lst) { const l = HB.abstand(d.atome[id["1:" + k + ":" + x]], d.atome[id["2:" + k + ":" + y]]); hbMin = Math.min(hbMin, l); hbMax = Math.max(hbMax, l); }
    }
  }
  console.log(`Hybrid: O3'-P ${linkMin.toFixed(2)}–${linkMax.toFixed(2)} Å, H-Brücken ${hbMin.toFixed(2)}–${hbMax.toFixed(2)} Å`);
  pruefe(nah(linkMin, 1.6, 0.05) && nah(linkMax, 1.6, 0.05), "Hybrid O3'-P-Abstand");
  pruefe(hbMin > 2.4 && hbMax < 3.4, "Hybrid H-Brücken-Abstände");
}
console.log(fehler ? fehler + " Fehler" : "OK.");
process.exit(fehler ? 1 : 0);
