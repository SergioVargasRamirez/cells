// Die Bausteine eines Gens und die Regel, was die RNA-Polymerase abschreibt
// (Quelle: template/site/gen.js, wird von build.py in die Seiten kopiert; Test: scripts/transkription/test_gen.js).
//
//   GEN.BAUSTEINE   sieben Abschnitte zu je 8 Einheiten: Promotor (mit Sequenz), drei Exons, zwei Introns, Terminator
//                   (Exons und Introns sind schematisch, ohne Sequenz; gleiche Typen sind austauschbar)
//   GEN.SOLL        Typen in der Reihenfolge eines Gens: Promotor, Exon, Intron, Exon, Intron, Exon, Terminator
//   GEN.analysiere(platz)   platz[s] = Nummer des Bausteins auf Platz s (von links nach rechts)
//                           → {p, t, von, bis, teile, stopp, ok}
//        p      Platz des Promotors
//        von    erste abgeschriebene Einheit (Index auf der ganzen Strecke), die Polymerase startet hinter dem Promotor
//        bis    Index hinter der letzten abgeschriebenen Einheit: bis zum Ende des Terminators, sonst bis zum Ende der DNA
//        teile  Nummern der abgeschriebenen Bausteine in der Reihenfolge des Transkripts
//        stopp  true, wenn hinter dem Promotor ein Terminator liegt
//        ok     true, wenn das Transkript genau Exon, Intron, Exon, Intron, Exon und Terminator enthält
//   GEN.vorrat(zufall)   Reihenfolge der Bausteine im Vorrat (Stelle → Nummer), zufällig; an keiner Stelle liegt ein
//                        Baustein, dessen Typ an dieser Stelle auch im fertigen Gen stünde
const GEN = (() => {
  "use strict";
  const L = 8;
  const BAUSTEINE = [
    {key: "prom", name: "Promotor", seq: "CTATAAAA", tata: [1, 6]},     // TATA-Box (TATAAA) an den Stellen 1 bis 6
    {key: "exon", name: "Exon"}, {key: "exon", name: "Exon"}, {key: "exon", name: "Exon"},
    {key: "intron", name: "Intron"}, {key: "intron", name: "Intron"},
    {key: "term", name: "Terminator"},
  ];
  const N = BAUSTEINE.length, PROM = 0, TERM = N - 1;
  const SOLL = ["prom", "exon", "intron", "exon", "intron", "exon", "term"];
  const typ = id => BAUSTEINE[id].key;

  function analysiere(platz){
    const p = platz.indexOf(PROM), t = platz.indexOf(TERM);
    const stopp = t > p;
    const letzter = stopp ? t : N - 1;
    const teile = platz.slice(p + 1, letzter + 1);
    const soll = SOLL.slice(1);
    return {p, t, von: (p + 1) * L, bis: (letzter + 1) * L, teile, stopp,
            ok: teile.length === soll.length && teile.every((x, i) => typ(x) === soll[i])};
  }
  function vorrat(zufall){
    const a = BAUSTEINE.map((b, i) => i);
    for (;;){
      for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(zufall() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
      if (a.every((id, k) => typ(id) !== SOLL[k])) return a.slice();
    }
  }
  return {BAUSTEINE, N, L, PROM, TERM, SOLL, typ, analysiere, vorrat};
})();
