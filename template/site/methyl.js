// Das Modell der DNA-Methylierung: CpG-Stellen, Wirkung auf Transkriptionsfaktor und MBD-Proteine, Weitergabe bei der Teilung
// (Quelle: template/site/methyl.js, wird von build.py in die Seiten kopiert; Test: scripts/methylierung/test_methyl.js).
//
// Gezeigt ist ein erfundener Abschnitt mit 14 CpG-Stellen: 10 im Promotor (Stelle 0 … 9), 4 im Genkörper (10 … 13).
// Zwei benachbarte Stellen im Promotor (4 und 5) liegen mitten in der Bindestelle eines Transkriptionsfaktors (TF).
// Eine CpG-Stelle besteht aus zwei Cytosinen, je eines in jedem Strang (5'-CG-3' oben, 3'-GC-5' unten).
// Zustand: {oben: [0|1, …], unten: [0|1, …]}; 1 = das Cytosin dieses Strangs trägt eine Methylgruppe.
//   ganz methyliert: beide Stränge 1. hemimethyliert: ein Strang 1 (so sieht eine Stelle direkt nach der Replikation aus).
//
// Spielzeugmodell mit drei Annahmen (siehe „Modell und Grenzen“ auf der Seite):
//   1. TF-Bindung: jede Methylgruppe in der Bindestelle senkt die Bindung; eine ganz methylierte Stelle auf 20 %.
//   2. MBD-Proteine (binden methylierte CpG-Stellen im Promotor) wirken kooperativ: wenige Stellen bewirken wenig,
//      viele Stellen bewirken viel (Hill-Funktion mit n = 3, Mitte bei 5 Stellen). Sie verdichten das Chromatin.
//   3. Genkörper: Methylierung dort ändert hier nichts an der Ablesung.
const METHYL = (() => {
  const N = 14;
  const SITES = [];
  for (let i = 0; i < N; i++) SITES.push({i, region: i < 10 ? "promotor" : "koerper", motif: i === 4 || i === 5});

  const K_MBD = 5, HILL = 3, REP_MAX = 0.95, TF_HEMM = 0.8;

  const neu = () => ({oben: new Array(N).fill(0), unten: new Array(N).fill(0)});
  const kopie = s => ({oben: s.oben.slice(), unten: s.unten.slice()});
  const setze = (s, i, wert) => { s.oben[i] = wert ? 1 : 0; s.unten[i] = wert ? 1 : 0; return s; };
  const gewicht = (s, i) => (s.oben[i] + s.unten[i]) / 2;   // 0, ½ (hemi) oder 1 (ganz)

  const nEff = s => { let n = 0; for (const x of SITES) if (x.region === "promotor") n += gewicht(s, x.i); return n; };
  const tf = s => { let p = 1; for (const x of SITES) if (x.motif) p *= 1 - TF_HEMM * gewicht(s, x.i); return p; };
  const mbd = s => { const n = nEff(s); return n === 0 ? 0 : Math.pow(n, HILL) / (Math.pow(n, HILL) + Math.pow(K_MBD, HILL)); };
  const repression = s => REP_MAX * mbd(s);
  const expression = s => tf(s) * (1 - repression(s));

  const zahlen = s => {
    let voll = 0, halb = 0;
    for (let i = 0; i < N; i++){ const w = gewicht(s, i); if (w === 1) voll++; else if (w > 0) halb++; }
    return {tf: tf(s), mbd: mbd(s), rep: repression(s), expr: expression(s), voll, halb, nEff: nEff(s)};
  };

  // Teilung: Tochter A erbt den oberen Elternstrang, Tochter B den unteren; der andere Strang ist neu und unmethyliert.
  // Die Erhaltungsmethyltransferase (DNMT1) methyliert an hemimethylierten Stellen den neuen Strang, jeweils mit der Wirksamkeit eff (0 … 1).
  const teile = (s, eff, zufall) => {
    const A = neu(), B = neu();
    for (let i = 0; i < N; i++){
      A.oben[i] = s.oben[i];
      B.unten[i] = s.unten[i];
      if (A.oben[i] && zufall() < eff) A.unten[i] = 1;
      if (B.unten[i] && zufall() < eff) B.oben[i] = 1;
    }
    return [A, B];
  };

  const zufallsmuster = (zufall, p = 0.5) => { const s = neu(); for (let i = 0; i < N; i++) if (zufall() < p) setze(s, i, 1); return s; };
  const alle = wert => { const s = neu(); for (let i = 0; i < N; i++) setze(s, i, wert); return s; };
  const ganzeStellen = s => { let n = 0; for (let i = 0; i < N; i++) if (gewicht(s, i) === 1) n++; return n; };

  return {N, SITES, neu, kopie, setze, gewicht, tf, mbd, repression, expression, zahlen, teile, zufallsmuster, alle, ganzeStellen};
})();
