// Das Modell der PCR: Einzelstränge, Primer, Zyklen, Zählwerk
// (Quelle: template/site/pcr.js, wird von build.py in die Seiten kopiert; Test: scripts/pcr/test_pcr.js).
//
// Die Ausgangs-DNA hat M = ziel + 2·rand Basenpaare, Spalten c = 0 … M-1. Die obere Kette ("top") steht von links nach
// rechts 5'→3', die untere ("bottom") 3'→5'. Die Zielsequenz liegt in den Spalten a … b-1 (a = rand, b = rand + ziel).
//   Primer 1  gleich der oberen Kette bei a … a+primer-1; er lagert sich an die UNTERE Kette an und wird nach rechts verlängert
//             (neue obere Kette: 5'-Ende bei a, wächst 5'→3' bis zum Ende der Vorlage).
//   Primer 2  komplementär zur oberen Kette bei b-primer … b-1; er lagert sich an die OBERE Kette an und wird nach links verlängert
//             (neue untere Kette: 5'-Ende bei b-1, wächst 5'→3' nach links bis zum Ende der Vorlage).
// Ein Strang ist {art: "top" | "bottom", von, bis}: er deckt die Spalten von … bis-1 ab.
//
//   PCR.erzeuge(zufall, opt)  zufällige Ausgangs-DNA; opt: {rand: 4, ziel: 20, primer: 5}
//   PCR.plan(oben, opt)       Plan zu einer gegebenen oberen Kette (Länge ziel + 2·rand, nur ACGT):
//        M, a, b, rand, ziel, primer, oben, unten
//        basis(art, c)        Base der Kette "top" / "bottom" in Spalte c
//        primer1, primer2     Basenfolgen der beiden Primer, jeweils 5'→3' gelesen
//   PCR.start(p)              [{top, bottom}]: ein Doppelstrang aus den beiden Ausgangssträngen
//   PCR.neuUnten(p, top)      der Strang, der an der oberen Vorlage entsteht (Primer 2): {art: "bottom", von: top.von, bis: b}
//   PCR.neuOben(p, bottom)    der Strang, der an der unteren Vorlage entsteht (Primer 1): {art: "top", von: a, bis: bottom.bis}
//   PCR.zyklus(ds, p, opt)    ein Zyklus: Jeder Doppelstrang liefert zwei neue (opt.bindet = false: die Primer finden keinen Halt;
//                             opt.verlaengert = false: die Polymerase arbeitet nicht; dann bleibt alles, wie es war).
//                             Reihenfolge: zu jedem Doppelstrang (top, bottom) erst {top, neuUnten(top)}, dann {neuOben(bottom), bottom}.
//   PCR.zaehle(ds, p)         {gesamt, ziel}: Zahl der Doppelstränge und davon die mit Zielsequenz in beiden Strängen
//   PCR.zahlen(n)             {gesamt, ziel} nach n Zyklen in geschlossener Form: 2^n und 2^n − 2n (ab n = 2, davor 0)
//   PCR.tm(laenge, gc)        Faustformel für die Schmelztemperatur eines Primers (gc als Anteil 0 … 1)
//   PCR.bewerte(T, tm)        "heiss" (T > tm), "gut" (tm − 10 ≤ T ≤ tm) oder "kalt" (T < tm − 10)
const PCR = (() => {
  const KOMP = {A: "T", T: "A", G: "C", C: "G"};
  const STANDARD = {rand: 4, ziel: 20, primer: 5};

  function plan(oben, opt){
    const o = Object.assign({}, STANDARD, opt || {});
    const {rand, ziel, primer} = o;
    const M = ziel + 2 * rand;
    if (!/^[ACGT]+$/.test(oben) || oben.length !== M) throw new Error("Die Vorlage passt nicht zu ziel und rand");
    if (primer < 1 || 2 * primer > ziel) throw new Error("Zwei Primer müssen in die Zielsequenz passen");
    if (rand < 1) throw new Error("Die Ausgangs-DNA braucht auf beiden Seiten Randstücke, sonst ist sie schon die Zielsequenz");
    const unten = oben.replace(/./g, b => KOMP[b]);
    const a = rand, b = rand + ziel;
    return {
      M, a, b, rand, ziel, primer, oben, unten,
      basis: (art, c) => (art === "top" ? oben : unten)[c],
      primer1: oben.slice(a, a + primer),
      primer2: unten.slice(b - primer, b).split("").reverse().join("")
    };
  }

  function erzeuge(zufall, opt){
    const o = Object.assign({}, STANDARD, opt || {});
    let oben = "";
    for (let i = 0; i < o.ziel + 2 * o.rand; i++) oben += "ACGT"[Math.floor(zufall() * 4)];
    return plan(oben, o);
  }

  const start = p => [{top: {art: "top", von: 0, bis: p.M}, bottom: {art: "bottom", von: 0, bis: p.M}}];
  const neuUnten = (p, top) => ({art: "bottom", von: top.von, bis: p.b});
  const neuOben = (p, bottom) => ({art: "top", von: p.a, bis: bottom.bis});

  function zyklus(ds, p, opt){
    const o = Object.assign({bindet: true, verlaengert: true}, opt || {});
    if (!o.bindet || !o.verlaengert) return ds.map(d => ({top: Object.assign({}, d.top), bottom: Object.assign({}, d.bottom)}));
    const aus = [];
    ds.forEach(d => {
      aus.push({top: d.top, bottom: neuUnten(p, d.top)});
      aus.push({top: neuOben(p, d.bottom), bottom: d.bottom});
    });
    return aus;
  }

  const istZiel = (p, s) => s.von === p.a && s.bis === p.b;
  const zaehle = (ds, p) => ({gesamt: ds.length, ziel: ds.filter(d => istZiel(p, d.top) && istZiel(p, d.bottom)).length});
  const zahlen = n => ({gesamt: Math.pow(2, n), ziel: n < 2 ? 0 : Math.pow(2, n) - 2 * n});

  const tm = (laenge, gc) => 64.9 + 41 * (gc * laenge - 16.4) / laenge;
  const bewerte = (T, tmWert) => (T > tmWert ? "heiss" : (T >= tmWert - 10 ? "gut" : "kalt"));

  return {plan, erzeuge, start, neuUnten, neuOben, zyklus, zaehle, zahlen, tm, bewerte, KOMP};
})();
