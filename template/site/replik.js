// Der Plan einer Replikation: Leitstrang, Folgestrang mit Okazaki-Fragmenten, Primer, Nicks
// (Quelle: template/site/replik.js, wird von build.py in die Seiten kopiert; Test: scripts/replikation/test_replik.js).
//
// Die Zeichnung ist ein Ausschnitt mit Spalten c = -rand … n+rand-1. Die Gabel läuft von links nach rechts, die
// obere Vorlage ("oben") steht von links nach rechts 5'→3', die untere ("unten") 3'→5'. Daraus folgt:
//   Leitstrang   entsteht unten (an "unten"), von links nach rechts, also 5'→3' in Richtung der Gabel; ein Primer bei c = 0.
//   Folgestrang  entsteht oben (an "oben"), in Fragmenten von rechts nach links (5'→3' von der Gabel weg); jedes Fragment
//                beginnt rechts mit einem Primer und endet links mit seinem 3'-Ende.
// Links (c < 0) und rechts (c ≥ n) liegen die Stücke der benachbarten Gabeln (an der Zeichnung: Rand, "Geister").
//
//   REPLIK.erzeuge(zufall, opt)  zufällige Vorlage; opt: {n: 40, frag: 10, primer: 3, rand: 4}
//   REPLIK.plan(oben, opt)       Plan zu einer gegebenen oberen Vorlage (Länge n + 2·rand, nur ACGT):
//        oben, unten             die beiden Vorlagen (unten ist die Basenpaarung zu oben, Spalte für Spalte)
//        vorlage(strang, c)      Base der Vorlage, an der der neue Strang "leit" bzw. "folge" entsteht
//        leit                    {primer: [0, primer), schritte: [{c, typ}]} in der Reihenfolge der Synthese; typ "rna" | "dna"
//        folge                   [{k, von, bis, primerVon, schritte}] Okazaki-Fragmente von links nach rechts (Spalten von … bis-1);
//                                die Schritte laufen von rechts nach links
//        ersatz                  [{strang, cols, nick}]: Primer entfernen und mit DNA auffüllen; cols in der Reihenfolge der Polymerase I
//                                (Leitstrang: von links nach rechts, Folgestrang: von rechts nach links), nick: Spalte c der Lücke im
//                                Rückgrat zwischen c und c+1, die danach bleibt
//        nicks                   alle Nicks nach der Auffüllung, nach c sortiert: {strang, c}
//   REPLIK.neu(plan, strang, c, typ)  die Base im neuen Strang: Gegenstück zur Vorlage, bei typ "rna" mit U statt T
//   REPLIK.endzustand(plan)      {leit, folge}: die fertigen neuen Stränge in den Spalten 0 … n-1, als Texte von links nach rechts
//                                (leit also 5'→3', folge 3'→5')
const REPLIK = (() => {
  const KOMP = {A: "T", T: "A", G: "C", C: "G"}, RNA = {A: "U", T: "A", G: "C", C: "G"};
  const STANDARD = {n: 40, frag: 10, primer: 3, rand: 4};

  function plan(oben, opt){
    const o = Object.assign({}, STANDARD, opt || {});
    const {n, frag, primer, rand} = o;
    if (n % frag !== 0) throw new Error("n muss ein Vielfaches der Fragmentlänge sein");
    if (primer < 1 || primer >= frag) throw new Error("Der Primer muss kürzer als ein Fragment sein");
    if (!/^[ACGT]+$/.test(oben) || oben.length !== n + 2 * rand) throw new Error("Die Vorlage passt nicht zu n und rand");
    const unten = oben.replace(/./g, b => KOMP[b]);
    const p = {n, frag, primer, rand, oben, unten};
    p.vorlage = (strang, c) => (strang === "leit" ? unten : oben)[c + rand];

    // Leitstrang: Primer (RNA) bei 0 … primer-1, danach DNA bis n-1, immer von links nach rechts
    p.leit = {primer: [0, primer], schritte: []};
    for (let c = 0; c < n; c++) p.leit.schritte.push({c, typ: c < primer ? "rna" : "dna"});

    // Folgestrang: Fragmente von links nach rechts nummeriert, jedes von rechts nach links aufgebaut
    p.folge = [];
    for (let k = 0; k < n / frag; k++){
      const von = k * frag, bis = von + frag, schritte = [];
      for (let c = bis - 1; c >= von; c--) schritte.push({c, typ: c >= bis - primer ? "rna" : "dna"});
      p.folge.push({k, von, bis, primerVon: bis - primer, schritte});
    }

    // Ersatz der Primer: Die Polymerase I verlängert das 3'-Ende des Nachbarn (links beim Leitstrang, rechts beim Folgestrang)
    p.ersatz = [{strang: "leit", cols: Array.from({length: primer}, (_, i) => i), nick: primer - 1}];
    p.folge.forEach(f => p.ersatz.push({strang: "folge", cols: Array.from({length: primer}, (_, i) => f.bis - 1 - i), nick: f.primerVon - 1}));

    // Nicks nach dem Ersatz: Lücken im Rückgrat zwischen c und c+1
    p.nicks = [{strang: "leit", c: n - 1}, {strang: "folge", c: -1}]
      .concat(p.ersatz.map(e => ({strang: e.strang, c: e.nick})))
      .sort((a, b) => a.c - b.c || (a.strang === "folge" ? -1 : 1));
    return p;
  }

  function erzeuge(zufall, opt){
    const o = Object.assign({}, STANDARD, opt || {});
    let oben = "";
    for (let i = 0; i < o.n + 2 * o.rand; i++) oben += "ACGT"[Math.floor(zufall() * 4)];
    return plan(oben, o);
  }

  const neu = (p, strang, c, typ) => (typ === "rna" ? RNA : KOMP)[p.vorlage(strang, c)];

  function endzustand(p){
    let leit = "", folge = "";
    for (let c = 0; c < p.n; c++){ leit += neu(p, "leit", c, "dna"); folge += neu(p, "folge", c, "dna"); }
    return {leit, folge};
  }

  return {plan, erzeuge, neu, endzustand, KOMP, RNA};
})();
