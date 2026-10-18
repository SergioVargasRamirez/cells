// Der Standard-Code der Translation (Quelle: template/site/code.js, von build.py in die Seiten kopiert).
// Codons als RNA (ACGU). Tabelle 1 der NCBI-Genetic-Codes (universeller Code).
//
//   GENCODE.AS            Aminosäuren: kurz (Ala), name, einbuchstabig, klasse
//   GENCODE.TABELLE       Codon → "Ala" … oder "Stopp"
//   GENCODE.uebersetze(rna, start)   → {aa: [...], codons: [...], stopp: bool}   (ab Position start, 0-basiert)
//   GENCODE.TEILCODE      die acht Aminosäuren der Übung "Der Code im Reagenzglas" mit ihren Codons
const GENCODE = (() => {
  "use strict";
  const REIHE = "UCAG";
  // Reihenfolge der Codons: erste Base am langsamsten, jeweils U, C, A, G
  const KETTE = "FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG";
  const EIN = {A: "Ala", R: "Arg", N: "Asn", D: "Asp", C: "Cys", Q: "Gln", E: "Glu", G: "Gly", H: "His", I: "Ile", L: "Leu", K: "Lys", M: "Met", F: "Phe", P: "Pro", S: "Ser", T: "Thr", W: "Trp", Y: "Tyr", V: "Val"};
  const NAME = {Ala: "Alanin", Arg: "Arginin", Asn: "Asparagin", Asp: "Asparaginsäure", Cys: "Cystein", Gln: "Glutamin", Glu: "Glutaminsäure", Gly: "Glycin", His: "Histidin", Ile: "Isoleucin",
                Leu: "Leucin", Lys: "Lysin", Met: "Methionin", Phe: "Phenylalanin", Pro: "Prolin", Ser: "Serin", Thr: "Threonin", Trp: "Tryptophan", Tyr: "Tyrosin", Val: "Valin"};
  // Eigenschaft der Seitenkette (grobe Einteilung für Farben)
  const KLASSE = {Ala: "unpolar", Val: "unpolar", Leu: "unpolar", Ile: "unpolar", Met: "unpolar", Phe: "unpolar", Trp: "unpolar",
                  Ser: "polar", Thr: "polar", Cys: "polar", Tyr: "polar", Asn: "polar", Gln: "polar",
                  Asp: "sauer", Glu: "sauer", Lys: "basisch", Arg: "basisch", His: "basisch", Gly: "sonder", Pro: "sonder"};
  const KLASSEN = {unpolar: "unpolar (wasserabweisend)", polar: "polar, ungeladen", sauer: "sauer (negativ geladen)", basisch: "basisch (positiv geladen)", sonder: "Sonderfall"};
  const AS = {};
  for (const [e, k] of Object.entries(EIN)) AS[k] = {kurz: k, e, name: NAME[k], klasse: KLASSE[k]};
  const TABELLE = {}, CODONS = [];
  for (let i = 0; i < 64; i++){
    const c = REIHE[i >> 4] + REIHE[(i >> 2) & 3] + REIHE[i & 3];
    TABELLE[c] = KETTE[i] === "*" ? "Stopp" : EIN[KETTE[i]];
    CODONS.push(c);
  }
  // Acht Aminosäuren für die Übung mit Reagenzglas und Tabelle; Arg ist auf CGN beschränkt (AGA und AGG fehlen, damit vier Plätze genügen)
  const TEILCODE = [
    {aa: "Phe", codons: ["UUU", "UUC"]},
    {aa: "His", codons: ["CAU", "CAC"]},
    {aa: "Lys", codons: ["AAA", "AAG"]},
    {aa: "Pro", codons: ["CCU", "CCC", "CCA", "CCG"]},
    {aa: "Ala", codons: ["GCU", "GCC", "GCA", "GCG"]},
    {aa: "Thr", codons: ["ACU", "ACC", "ACA", "ACG"]},
    {aa: "Arg", codons: ["CGU", "CGC", "CGA", "CGG"]},
    {aa: "Gly", codons: ["GGU", "GGC", "GGA", "GGG"]},
  ];
  // Translation ab Position start (0-basiert), Codon für Codon, bis zum Stopp oder zum Ende der Sequenz
  function uebersetze(rna, start){
    const aa = [], codons = [];
    let stopp = false;
    for (let i = start || 0; i + 3 <= rna.length; i += 3){
      const c = rna.slice(i, i + 3), a = TABELLE[c];
      codons.push(c);
      if (a === "Stopp"){ stopp = true; aa.push("Stopp"); break; }
      aa.push(a);
    }
    return {aa, codons, stopp};
  }
  // Versuche mit sich wiederholenden mRNAs (Einheit n-mal), wie in den klassischen Experimenten mit zellfreiem Extrakt
  const IMTEIL = new Set(TEILCODE.flatMap(t => t.codons));
  const ggt = (a, b) => b ? ggt(b, a % b) : a;
  // Ein Leserahmen (1, 2 oder 3 = Start bei diesem Nukleotid) ist verfügbar, wenn alle seine Codons zum Teilcode gehören
  function rahmen(einheit){
    const n = einheit.length / ggt(einheit.length, 3), m = einheit.repeat(8);
    return [0, 1, 2].map(f => {
      const codons = [];
      for (let k = 0; k < n; k++) codons.push(m.slice(f + 3 * k, f + 3 * k + 3));
      return {start: f + 1, codons, verfuegbar: codons.every(c => IMTEIL.has(c))};
    });
  }
  const VERSUCHE = ["U", "C", "A", "UUC", "CG", "CGC", "CA", "CCA", "CGG", "CGGG", "CGCA", "ACG", "AAG", "GGA"];
  const NICHT_HERSTELLBAR = [
    {einheit: "G", grund: "Poly-G faltet sich zu Vierersträngen und lässt sich nicht herstellen."},
    {einheit: "UC", grund: "Dieser Versuch liefert Aminosäuren, die nicht zu den acht dieser Übung gehören."},
    {einheit: "AUG", grund: "Dieser Versuch liefert Aminosäuren und ein Stopp-Signal außerhalb dieser Übung."},
  ];
  return {AS, TABELLE, CODONS, REIHE, KLASSEN, TEILCODE, IMTEIL, uebersetze, rahmen, VERSUCHE, NICHT_HERSTELLBAR};
})();
