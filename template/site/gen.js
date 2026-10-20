// Die Bausteine eines Gens, die Regel, was die RNA-Polymerase abschreibt, und das Spleißen
// (Quelle: template/site/gen.js, wird von build.py in die Seiten kopiert; Test: scripts/transkription/test_gen.js).
//
//   GEN.erzeuge(zufall, k)   ein zufälliges Gen mit k Exons (2 bis 4, sonst zufällig) und k-1 Introns:
//                            {k, n, bausteine, soll}; die Bausteine stehen in der Reihenfolge des Gens:
//                            Promotor, Exon, Intron, …, Exon, Terminator; jeder Baustein hat key, name und eine
//                            Sequenz (Gegenstrang, 5'→3', so wie die RNA lautet, mit T statt U).
//                            Promotor: TATAAA; Terminator: Poly-U (TTTTTT); Exons 4 bis 7 Basen, Introns 7 bis 11 Basen lang
//                            (Introns beginnen mit GU und enden mit AG; als DNA GT … AG). Introns sind länger als Exons wie in
//                            Wirklichkeit, aber viel kürzer, damit alles auf den Bildschirm passt.
//   GEN.analysiere(gen, platz)   platz[s] = Nummer des Bausteins auf Platz s (von links nach rechts)
//                            → {p, t, vonPlatz, bisPlatz, teile, stopp, ok}
//        p      Platz des Promotors
//        vonPlatz   erster abgeschriebener Platz: die Polymerase startet hinter dem Promotor
//        bisPlatz   Platz hinter dem letzten abgeschriebenen: bis zum Terminator (mit), sonst bis zum Ende der DNA
//        teile  Nummern der abgeschriebenen Bausteine in der Reihenfolge des Transkripts
//        stopp  true, wenn hinter dem Promotor ein Terminator liegt
//        ok     true, wenn die Typen des Transkripts Exon, Intron, …, Exon, Terminator folgen (die Exons sind untereinander
//               austauschbar, ebenso die Introns: das Gen ist das, was gebaut wurde)
//   GEN.vorrat(gen, zufall)  Reihenfolge der Bausteine im Vorrat (Stelle → Nummer), zufällig; an keiner Stelle liegt ein
//                            Baustein, dessen Typ an dieser Stelle auch im fertigen Gen stünde
//   GEN.erlaubt(gen, platz)  false, wenn auf der DNA zwei Exons oder zwei Introns direkt nebeneinander lägen (das gibt es in einem
//                            Gen nicht: Exons trennt immer ein Intron); platz[s] = Nummer oder null (leerer Platz)
//   GEN.rna(gen, teile)      die Sequenz der genannten Bausteine als RNA (A, C, G, U)
//   GEN.spleisse(gen, teile) was das Spleißen aus dem Transkript macht: {entfernt, abgespalten, rest}
//        entfernt     Nummern der Introns, die auf beiden Seiten ein Exon haben und herausgeschnitten werden
//        abgespalten  Nummer des Terminators am 3'-Ende (wird abgespalten) oder null
//        rest         Nummern der übrigen Bausteine in der Reihenfolge des Transkripts
const GEN = (() => {
  "use strict";
  const PROM = 0, BASEN = "ACGT";
  function erzeuge(zufall, k){
    k = k || 2 + Math.floor(zufall() * 3);
    const zahl = (a, b) => a + Math.floor(zufall() * (b - a + 1));
    const folge = n => Array.from({length: n}, () => BASEN[Math.floor(zufall() * 4)]).join("");
    const exon = () => { let s; do s = folge(zahl(4, 7)); while (s === "TTTTTT" || s === "TATAAA"); return s; };
    const b = [{key: "prom", name: "Promotor", seq: "TATAAA", tata: [0, 5]}];
    for (let i = 0; i < k; i++){
      b.push({key: "exon", name: "Exon", seq: exon()});
      if (i < k - 1) b.push({key: "intron", name: "Intron", seq: "GT" + folge(zahl(3, 7)) + "AG"});
    }
    b.push({key: "term", name: "Terminator", seq: "TTTTTT"});
    return {k, n: b.length, bausteine: b, soll: b.map(x => x.key)};
  }
  function analysiere(gen, platz){
    const n = gen.n, p = platz.indexOf(PROM), t = platz.indexOf(n - 1);
    const stopp = t > p;
    const letzter = stopp ? t : n - 1;
    const teile = platz.slice(p + 1, letzter + 1);
    const soll = gen.soll.slice(1);
    return {p, t, vonPlatz: p + 1, bisPlatz: letzter + 1, teile, stopp,
            ok: teile.length === soll.length && teile.every((x, i) => gen.bausteine[x].key === soll[i])};
  }
  function vorrat(gen, zufall){
    const a = gen.bausteine.map((b, i) => i);
    for (;;){
      for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(zufall() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
      if (a.every((id, s) => gen.bausteine[id].key !== gen.soll[s])) return a.slice();
    }
  }
  function erlaubt(gen, platz){
    for (let s = 0; s < platz.length - 1; s++){
      const a = platz[s], b = platz[s + 1];
      if (a === null || b === null) continue;
      const t = gen.bausteine[a].key;
      if ((t === "exon" || t === "intron") && gen.bausteine[b].key === t) return false;
    }
    return true;
  }
  const rna = (gen, teile) => teile.map(id => gen.bausteine[id].seq).join("").replace(/T/g, "U");
  function spleisse(gen, teile){
    const typ = id => gen.bausteine[id].key, entfernt = [], rest = [];
    let abgespalten = null;
    teile.forEach((id, i) => {
      if (typ(id) === "intron" && i > 0 && i < teile.length - 1 && typ(teile[i - 1]) === "exon" && typ(teile[i + 1]) === "exon") entfernt.push(id);
      else if (typ(id) === "term" && i === teile.length - 1) abgespalten = id;
      else rest.push(id);
    });
    return {entfernt, abgespalten, rest};
  }
  return {PROM, erzeuge, analysiere, vorrat, erlaubt, rna, spleisse};
})();
