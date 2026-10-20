// Die Bausteine eines Gens, die Regel, was die RNA-Polymerase abschreibt, und das Spleißen
// (Quelle: template/site/gen.js, wird von build.py in die Seiten kopiert; Test: scripts/transkription/test_gen.js).
//
//   Benötigt GENCODE (template/site/code.js) für die Codon-Tabelle.
//   GEN.erzeuge(zufall, k)   ein zufälliges Gen mit k Exons (2 bis 4, sonst zufällig) und k-1 Introns:
//                            {k, n, bausteine, soll, peptid, peptidName, peptidText, mrna}; die Bausteine stehen in der
//                            Reihenfolge des Gens: Promotor, Exon 1, Intron, Exon 2, …, Terminator; jeder Baustein hat key, name
//                            und eine Sequenz (Gegenstrang, 5'→3', so wie die RNA lautet, mit T statt U).
//                            Promotor: TATAAA; Terminator: Poly-U (TTTTTT); Introns: GU … AG (als DNA GT … AG), 7 bis 10 Basen.
//                            Die Exons ergeben zusammen die mRNA: 1 bis 2 Basen 5'-UTR, AUG, die Codons eines Miniproteins
//                            (Chignolin oder Trpzip2, zufällige synonyme Codons), Stopp-Codon, 1 bis 2 Basen 3'-UTR. Sie wird
//                            in k Stücke von mindestens 4 Basen zerlegt (die Schnitte liegen auch mitten in Codons).
//                            peptid: die Aminosäuren (Einbuchstaben-Code) mit dem Met vom Startcodon, mrna: die gespleißte mRNA.
//   GEN.analysiere(gen, platz)   platz[s] = Nummer des Bausteins auf Platz s (von links nach rechts)
//                            → {p, t, vonPlatz, bisPlatz, teile, stopp, ok}
//        p      Platz des Promotors
//        vonPlatz   erster abgeschriebener Platz: die Polymerase startet hinter dem Promotor
//        bisPlatz   Platz hinter dem letzten abgeschriebenen: bis zum Terminator (mit), sonst bis zum Ende der DNA
//        teile  Nummern der abgeschriebenen Bausteine in der Reihenfolge des Transkripts
//        stopp  true, wenn hinter dem Promotor ein Terminator liegt
//        ok     true, wenn die Typen des Transkripts Exon, Intron, …, Exon, Terminator folgen und die Exons in der Reihenfolge
//               ihrer Nummern liegen (die Introns sind untereinander austauschbar: sie werden herausgeschnitten)
//   GEN.vorrat(gen, zufall)  Reihenfolge der Bausteine im Vorrat (Stelle → Nummer), zufällig; an keiner Stelle liegt ein
//                            Baustein, dessen Typ an dieser Stelle auch im fertigen Gen stünde
//   GEN.erlaubt(gen, platz)  false, wenn auf der DNA zwei Exons oder zwei Introns direkt nebeneinander lägen (das gibt es in einem
//                            Gen nicht: Exons trennt immer ein Intron); platz[s] = Nummer oder null (leerer Platz)
//   GEN.rna(gen, teile)      die Sequenz der genannten Bausteine als RNA (A, C, G, U)
//   GEN.uebersetze(rna)      Translation ab dem ersten AUG bis zum Stopp-Codon (oder zum Ende der RNA):
//                            {start, aa (Dreibuchstaben-Namen), kurz (Einbuchstaben-Code), stopp, codons}; start -1 ohne AUG
//   GEN.breite(gen, nutzbar, abstand)   größte Breite einer Base (Einheiten), so dass die volle Reihe aller Bausteine in
//                            die Breite nutzbar passt (abstand zwischen den Bausteinen)
//   GEN.spleisse(gen, teile) was das Spleißen aus dem Transkript macht: {entfernt, abgespalten, rest}
//        entfernt     Nummern der Introns, die auf beiden Seiten ein Exon haben und herausgeschnitten werden
//        abgespalten  Nummer des Terminators am 3'-Ende (wird abgespalten) oder null
//        rest         Nummern der übrigen Bausteine in der Reihenfolge des Transkripts
const GEN = (() => {
  "use strict";
  const PROM = 0, BASEN = "ACGT";
  // Miniproteine, die sich in Wasser von selbst falten (Aminosäuren ohne das Met vom Startcodon)
  const PEPTIDE = [
    {name: "Chignolin", seq: "GYDPETGTWG", text: "ein künstlich entworfenes Miniprotein aus zehn Aminosäuren, das sich zu einer β-Haarnadel faltet (Honda et al. 2004)"},
    {name: "Trpzip2", seq: "SWTWENGKWTWK", text: "ein künstliches Miniprotein aus zwölf Aminosäuren, ein „Tryptophan-Reißverschluss“, der sich zu einer β-Haarnadel faltet (Cochran et al. 2001)"},
  ];
  let codonsVon = null;
  function codonsFuer(e){            // alle DNA-Codons einer Aminosäure (Einbuchstaben-Code, "*" = Stopp)
    if (!codonsVon){
      codonsVon = {};
      GENCODE.CODONS.forEach(c => { const n = GENCODE.TABELLE[c], k = n === "Stopp" ? "*" : GENCODE.AS[n].e; (codonsVon[k] = codonsVon[k] || []).push(c.replace(/U/g, "T")); });
    }
    return codonsVon[e];
  }
  function erzeuge(zufall, k){
    k = k || 2 + Math.floor(zufall() * 3);
    const zahl = (a, b) => a + Math.floor(zufall() * (b - a + 1));
    const waehle = a => a[Math.floor(zufall() * a.length)];
    const folge = n => Array.from({length: n}, () => BASEN[Math.floor(zufall() * 4)]).join("");
    const pep = k === 4 ? PEPTIDE[0] : waehle(PEPTIDE);       // bei vier Exons das kürzere, damit alles auf den Bildschirm passt
    let mrna, exons;
    for (;;){
      const orf = "ATG" + [...pep.seq].map(e => waehle(codonsFuer(e))).join("") + waehle(codonsFuer("*"));
      mrna = folge(zahl(1, 2)) + orf + folge(zahl(1, 2));
      const laengen = Array(k).fill(4), gewicht = Array.from({length: k}, () => 0.3 + zufall());
      for (let i = mrna.length - 4 * k; i > 0; i--){        // der Rest wird zufällig verteilt
        let r = zufall() * gewicht.reduce((x, y) => x + y, 0), j = 0;
        while (j < k - 1 && r >= gewicht[j]){ r -= gewicht[j]; j++; }
        laengen[j]++;
      }
      let x = 0; exons = laengen.map(n => { const t = mrna.slice(x, x + n); x += n; return t; });
      if (!exons.some(t => t === "TTTTTT" || t === "TATAAA")) break;   // nicht mit Terminator oder TATA-Box verwechselbar
    }
    const b = [{key: "prom", name: "Promotor", seq: "TATAAA", tata: [0, 5]}];
    exons.forEach((t, i) => {
      b.push({key: "exon", name: "Exon " + (i + 1), seq: t});
      if (i < k - 1) b.push({key: "intron", name: "Intron", seq: "GT" + folge(zahl(3, 6)) + "AG"});
    });
    b.push({key: "term", name: "Terminator", seq: "TTTTTT"});
    return {k, n: b.length, bausteine: b, soll: b.map(x => x.key), peptid: "M" + pep.seq, peptidName: pep.name, peptidText: pep.text, mrna: mrna.replace(/T/g, "U")};
  }
  function analysiere(gen, platz){
    const n = gen.n, p = platz.indexOf(PROM), t = platz.indexOf(n - 1);
    const stopp = t > p;
    const letzter = stopp ? t : n - 1;
    const teile = platz.slice(p + 1, letzter + 1);
    const soll = gen.soll.slice(1), exons = teile.filter(id => gen.bausteine[id].key === "exon");
    return {p, t, vonPlatz: p + 1, bisPlatz: letzter + 1, teile, stopp,
            ok: teile.length === soll.length && teile.every((x, i) => gen.bausteine[x].key === soll[i]) && exons.every((id, i) => i === 0 || id > exons[i - 1])};
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
  function uebersetze(rna){
    const start = rna.indexOf("AUG"), aa = [], codons = [];
    let stopp = false;
    if (start < 0) return {start, aa, kurz: "", stopp, codons};
    for (let i = start; i + 3 <= rna.length; i += 3){
      const c = rna.slice(i, i + 3), a = GENCODE.TABELLE[c];
      codons.push(c);
      if (a === "Stopp"){ stopp = true; break; }
      aa.push(a);
    }
    return {start, aa, kurz: aa.map(a => GENCODE.AS[a].e).join(""), stopp, codons};
  }
  function breite(gen, nutzbar, abstand){
    const summe = gen.bausteine.reduce((x, b) => x + b.seq.length, 0);
    return Math.floor((nutzbar - (gen.n - 1) * abstand) / summe);
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
  return {PROM, PEPTIDE, erzeuge, analysiere, vorrat, erlaubt, rna, spleisse, uebersetze, breite};
})();
