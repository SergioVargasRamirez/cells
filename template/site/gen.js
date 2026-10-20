// Die Bausteine eines Gens und die Regel, was die RNA-Polymerase abschreibt
// (Quelle: template/site/gen.js, wird von build.py in die Seiten kopiert; Test: scripts/transkription/test_gen.js).
//
//   GEN.BAUSTEINE   fünf Abschnitte à 12 Basenpaare (Sequenz = Gegenstrang, 5'→3', so wie die RNA lautet, mit T statt U)
//   GEN.analysiere(platz)   platz[s] = Nummer des Bausteins auf Platz s (0 bis 4, von links nach rechts)
//                           → {p, t, von, bis, teile, stopp, ok}
//        p      Platz des Promotors
//        von    erste abgeschriebene Base (Index auf der ganzen Strecke), die Polymerase startet hinter dem Promotor
//        bis    Index hinter der letzten abgeschriebenen Base: bis zum Ende des Terminators, sonst bis zum Ende der DNA
//        teile  Nummern der abgeschriebenen Bausteine in der Reihenfolge des Transkripts
//        stopp  true, wenn hinter dem Promotor ein Terminator liegt
//        ok     true, wenn das Transkript genau 5'-UTR, codierender Bereich, 3'-UTR und Terminator enthält
//   GEN.rna(platz, pl)   die abgeschriebene RNA als Text (A, C, G, U)
const GEN = (() => {
  "use strict";
  const PROM = 0, UTR5 = 1, CDS = 2, UTR3 = 3, TERM = 4, N = 5, L = 12;
  const BAUSTEINE = [
    {key: "prom", name: "Promotor", seq: "GGCTATAAAAGG", tata: [3, 8]},       // TATA-Box (TATAAA) an den Stellen 3 bis 8
    {key: "utr5", name: "5'-UTR", seq: "CAGAGCGCCACC"},                      // endet mit der Kozak-Sequenz GCCACC
    {key: "cds", name: "Codierender Bereich", seq: "ATGGGCGAATGA"},          // ATG GGC GAA TGA = Met-Gly-Glu-Stopp
    {key: "utr3", name: "3'-UTR", seq: "CCAATAAAGGCT"},                      // enthält das Polyadenylierungssignal AATAAA
    {key: "term", name: "Terminator", seq: "GCCCAAAAGGGC"},                  // GCCC und GGGC bilden in der RNA eine Haarnadel
  ];
  const sollTeile = [UTR5, CDS, UTR3, TERM];

  function analysiere(platz){
    const p = platz.indexOf(PROM), t = platz.indexOf(TERM);
    const stopp = t > p;
    const letzter = stopp ? t : N - 1;
    const teile = platz.slice(p + 1, letzter + 1);
    return {p, t, von: (p + 1) * L, bis: (letzter + 1) * L, teile, stopp,
            ok: teile.length === sollTeile.length && teile.every((x, i) => x === sollTeile[i])};
  }
  function rna(platz, pl){
    return platz.slice(pl.p + 1, pl.t > pl.p ? pl.t + 1 : N).map(id => BAUSTEINE[id].seq).join("").replace(/T/g, "U");
  }
  return {BAUSTEINE, N, L, PROM, UTR5, CDS, UTR3, TERM, analysiere, rna};
})();
