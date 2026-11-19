// Das Modell der Blutbildung: Transkriptionsfaktoren als Schalter, aus denen sich ein Zelltyp ergibt
// (Quelle: template/site/blutbildung.js, wird von build.py in die Seiten kopiert; Test: scripts/blutbildung/test_blut.js).
//
// Boolesches Netzwerk: jeder Faktor ist aktiv (true) oder inaktiv (false). Ein Faktor ändert seinen Zustand nach einer Regel,
// die nur von anderen Faktoren abhängt. Aktualisiert wird immer ein einzelner Faktor, in zufälliger Reihenfolge (asynchron), bis sich nichts mehr ändert.
// Eingriff: {Faktor: "an"} hält den Faktor dauerhaft aktiv (Überexpression), {Faktor: "aus"} hält ihn dauerhaft inaktiv (Knock-out).
//
// Modell "experte": die 11 Faktoren des Netzwerks von Krumsiek, Marr, Schroeder und Theis (2011), PLoS ONE 6(8): e22649 (Maus, myeloide Blutbildung).
//   Regeln und Anfangszustand folgen dem Aufsatz; Hemmung von C/EBPα: jeder der Faktoren GATA-1, FOG-1 und SCL genügt (Annahme der Autoren).
// Modell "einfach": vier Faktoren, abgeleitet aus dem Netzwerk (GATA-1, PU.1, EKLF, Fli-1); der Anfangszustand mit beiden aktiv steht für
//   die geringe gleichzeitige Bildung beider Faktoren in Vorläuferzellen.
const BLUT = (() => {
  const NAME = {GATA2:"GATA-2", GATA1:"GATA-1", FOG1:"FOG-1", EKLF:"EKLF", Fli1:"Fli-1", SCL:"SCL", CEBPa:"C/EBPα", PU1:"PU.1", cJun:"cJun", EgrNab:"EgrNab", Gfi1:"Gfi-1"};

  const TYP = {
    vor:    {name:"Vorläuferzelle", text:"Noch nicht festgelegt."},
    ery:    {name:"Erythrozyt", text:"Rotes Blutkörperchen: transportiert Sauerstoff mit Hämoglobin. Reife Erythrozyten des Menschen haben keinen Zellkern."},
    mk:     {name:"Megakaryozyt", text:"Große Knochenmarkzelle mit vielfach gelapptem Kern. Sie schnürt Blutplättchen (Thrombozyten) ab."},
    mono:   {name:"Monozyt", text:"Weiße Blutzelle mit bohnenförmigem Kern. Sie nimmt Krankheitserreger durch Phagozytose auf und kann zum Makrophagen werden."},
    gran:   {name:"Granulozyt", text:"Weiße Blutzelle mit segmentiertem Kern und Granula. Sie wehrt vor allem Bakterien ab."},
    gm:     {name:"Granulozyt oder Monozyt", text:"Zelle der Granulozyten-Monozyten-Linie. Das einfache Modell unterscheidet beide nicht."},
    misch:  {name:"Mischzustand", text:"Die Schalter passen zu keinem bekannten Zelltyp: Faktoren verschiedener Linien sind gemeinsam aktiv, oder ein nötiger Partner fehlt."},
    block:  {name:"Differenzierungsblock", text:"Weder GATA-1 noch PU.1 ist aktiv. Die Zelle erreicht keinen reifen Zelltyp."},
    aus:    {name:"Keine Linie aktiv", text:"Kein Faktor ist aktiv. Die Zelle bleibt unspezifisch."}
  };

  const MODELLE = {
    einfach: {
      faktoren: ["GATA1", "PU1", "EKLF", "Fli1"],
      start: {GATA1:true, PU1:true, EKLF:false, Fli1:false},
      startText: "GATA-1 und PU.1 sind beide in geringer Menge vorhanden (vereinfacht als aktiv).",
      regel: s => ({
        GATA1: (s.GATA1 || s.Fli1) && !s.PU1,
        PU1:   s.PU1 && !s.GATA1,
        EKLF:  s.GATA1 && !s.Fli1,
        Fli1:  s.GATA1 && !s.EKLF
      }),
      typ: s => {
        if (s.GATA1 && s.PU1) return "misch";
        if (s.GATA1){ if (s.EKLF && !s.Fli1) return "ery"; if (s.Fli1 && !s.EKLF) return "mk"; return "misch"; }
        if (s.PU1) return "gm";
        return "aus";
      },
      gruppen: [["ery", "mk"], ["gm"]],
      tabelle: [
        ["GATA-1", "GATA-1 (selbst), Fli-1", "PU.1"],
        ["PU.1", "PU.1 (selbst)", "GATA-1"],
        ["EKLF", "GATA-1", "Fli-1"],
        ["Fli-1", "GATA-1", "EKLF"]
      ]
    },
    experte: {
      faktoren: ["GATA2", "GATA1", "FOG1", "EKLF", "Fli1", "SCL", "CEBPa", "PU1", "cJun", "EgrNab", "Gfi1"],
      start: {GATA2:true, GATA1:false, FOG1:false, EKLF:false, Fli1:false, SCL:false, CEBPa:true, PU1:true, cJun:false, EgrNab:false, Gfi1:false},
      startText: "GATA-2, C/EBPα und PU.1 sind aktiv, alle anderen Faktoren inaktiv.",
      regel: s => ({
        GATA2:  s.GATA2 && !(s.GATA1 && s.FOG1) && !s.PU1,
        GATA1:  (s.GATA1 || s.GATA2 || s.Fli1) && !s.PU1,
        FOG1:   s.GATA1,
        EKLF:   s.GATA1 && !s.Fli1,
        Fli1:   s.GATA1 && !s.EKLF,
        SCL:    s.GATA1 && !s.PU1,
        CEBPa:  s.CEBPa && !s.GATA1 && !s.FOG1 && !s.SCL,
        PU1:    (s.CEBPa || s.PU1) && !s.GATA1 && !s.GATA2,
        cJun:   s.PU1 && !s.Gfi1,
        EgrNab: s.PU1 && s.cJun && !s.Gfi1,
        Gfi1:   s.CEBPa && !s.EgrNab
      }),
      typ: s => {
        if (!Object.values(s).some(Boolean)) return "aus";
        if (s.GATA1 && s.PU1) return "misch";
        if (s.GATA1){ if (s.EKLF && !s.Fli1) return "ery"; if (s.Fli1 && !s.EKLF) return "mk"; return "misch"; }
        if (s.PU1){
          if (!s.CEBPa) return "misch";
          if (s.Gfi1 && !s.EgrNab) return "gran";
          if (s.EgrNab && !s.Gfi1) return "mono";
          return "misch";
        }
        return "block";
      },
      gruppen: [["ery", "mk"], ["gran", "mono"]],
      tabelle: [
        ["GATA-2", "GATA-2 (selbst)", "PU.1; GATA-1 und FOG-1 gemeinsam"],
        ["GATA-1", "GATA-1 (selbst), GATA-2, Fli-1", "PU.1"],
        ["FOG-1", "GATA-1", "–"],
        ["EKLF", "GATA-1", "Fli-1"],
        ["Fli-1", "GATA-1", "EKLF"],
        ["SCL", "GATA-1", "PU.1"],
        ["C/EBPα", "C/EBPα (selbst)", "GATA-1, FOG-1, SCL (jeder einzeln)"],
        ["PU.1", "C/EBPα, PU.1 (selbst)", "GATA-1, GATA-2"],
        ["cJun", "PU.1", "Gfi-1"],
        ["EgrNab", "PU.1 und cJun gemeinsam", "Gfi-1"],
        ["Gfi-1", "C/EBPα", "EgrNab"]
      ]
    }
  };

  // Zustand: {Faktor: true|false}. Eingriffe halten Faktoren fest.
  const neu = modell => Object.assign({}, MODELLE[modell].start);
  const festhalten = (modell, z, eingriff) => {
    for (const f of MODELLE[modell].faktoren){
      if (eingriff[f] === "an") z[f] = true;
      else if (eingriff[f] === "aus") z[f] = false;
    }
    return z;
  };
  // Faktoren, die sich jetzt ändern würden (festgehaltene ausgenommen)
  const kandidaten = (modell, z, eingriff) => {
    const m = MODELLE[modell], r = m.regel(z);
    return m.faktoren.filter(f => !eingriff[f] && r[f] !== z[f]);
  };
  // Ein Schritt: ein zufällig gewählter Faktor folgt seiner Regel. Ergebnis: sein Name oder null, wenn sich nichts mehr ändert.
  const schritt = (modell, z, eingriff, zufall) => {
    const k = kandidaten(modell, z, eingriff);
    if (!k.length) return null;
    const f = k[Math.min(k.length - 1, Math.floor(zufall() * k.length))];
    z[f] = MODELLE[modell].regel(z)[f];
    return f;
  };
  // Bis zum stabilen Zustand durchlaufen; Ergebnis: Liste der geänderten Faktoren
  const lauf = (modell, z, eingriff, zufall, max = 500) => {
    const verlauf = [];
    for (let i = 0; i < max; i++){ const f = schritt(modell, z, eingriff, zufall); if (f === null) break; verlauf.push(f); }
    return verlauf;
  };
  const typ = (modell, z) => MODELLE[modell].typ(z);
  // n Differenzierungen aus dem Anfangszustand mit den gegebenen Eingriffen; Ergebnis: {Zelltyp: Anzahl}
  const haeufigkeit = (modell, eingriff, n, zufall) => {
    const c = {};
    for (let i = 0; i < n; i++){
      const z = festhalten(modell, neu(modell), eingriff);
      lauf(modell, z, eingriff, zufall);
      const t = typ(modell, z); c[t] = (c[t] || 0) + 1;
    }
    return c;
  };
  // Alle stabilen Zustände (Zustände, in denen sich kein Faktor ändern würde), ohne Eingriffe
  const stabile = modell => {
    const m = MODELLE[modell], out = [], n = m.faktoren.length;
    for (let b = 0; b < (1 << n); b++){
      const z = {}; m.faktoren.forEach((f, i) => { z[f] = !!(b & (1 << i)); });
      const r = m.regel(z);
      if (m.faktoren.every(f => r[f] === z[f])) out.push(z);
    }
    return out;
  };

  // Entscheidungsbaum: n Differenzierungen aus dem Anfangszustand; ein Knoten ist "festgelegt", sobald von einem Zustand aus
  // nur noch Zelltypen seiner Gruppe erreichbar sind. Ergebnis: Liste von Knoten (Wurzel zuerst).
  //   {id, eltern, typen, p (Anteil der Läufe), t (mittlere Zeit der Festlegung, in Schritten), an (Anteil aktiv je Faktor),
  //    ausloeser {Faktor: {an:Anzahl, aus:Anzahl}}, blatt}
  const baum = (modell, eingriff, n, zufall) => {
    const m = MODELLE[modell], F = m.faktoren;
    const kk = z => F.map(f => z[f] ? 1 : 0).join("");
    const st = k => { const z = {}; F.forEach((f, i) => { z[f] = k[i] === "1"; }); return z; };
    const s0 = festhalten(modell, neu(modell), eingriff), k0 = kk(s0);
    const adj = {}, queue = [k0], seen = new Set(queue);
    const folgen = k => { const z = st(k), r = m.regel(z); return kandidaten(modell, z, eingriff).map(f => { const w = Object.assign({}, z); w[f] = r[f]; return [f, kk(w)]; }); };
    while (queue.length){
      const k = queue.shift(); adj[k] = folgen(k);
      for (const [, nx] of adj[k]) if (!seen.has(nx)){ seen.add(nx); queue.push(nx); }
    }
    const FS = {};
    for (const k in adj) FS[k] = new Set(adj[k].length ? [] : [typ(modell, st(k))]);
    for (let ch = true; ch;){
      ch = false;
      for (const k in adj) for (const [, nx] of adj[k]) for (const x of FS[nx]) if (!FS[k].has(x)){ FS[k].add(x); ch = true; }
    }
    const alle = [...FS[k0]];
    const knoten = [{id: "wurzel", eltern: null, typen: alle, blatt: false}];
    for (const g of m.gruppen){
      const t = g.filter(x => alle.includes(x));
      if (!t.length) continue;
      const gid = "g:" + t.join("+");
      if (t.length > 1) knoten.push({id: gid, eltern: "wurzel", typen: t, blatt: false});
      for (const x of t) knoten.push({id: "b:" + x, eltern: t.length > 1 ? gid : "wurzel", typen: [x], blatt: true});
    }
    if (alle.length === 1) knoten[0].blatt = true;
    for (const nd of knoten) Object.assign(nd, {anzahl: 0, tsum: 0, an: F.map(() => 0), ausloeser: {}, kante: F.map(() => 0)});
    const index = {}; knoten.forEach(nd => { index[nd.id] = nd; });
    for (let i = 0; i < n; i++){
      let k = k0, t = 0, ausl = null;
      const stand = {wurzel: {k, t: 0}};
      const pruefen = () => {
        for (const nd of knoten){
          if (stand[nd.id]) continue;
          if ([...FS[k]].every(x => nd.typen.includes(x))) stand[nd.id] = {k, t, f: ausl};
        }
      };
      pruefen();
      for (;;){
        const a = adj[k]; if (!a.length) break;
        const [f, nx] = a[Math.min(a.length - 1, Math.floor(zufall() * a.length))];
        t++; ausl = {f, an: nx[F.indexOf(f)] === "1"}; k = nx; pruefen();
      }
      for (const nd of knoten){
        const sd = stand[nd.id]; if (!sd) continue;
        nd.anzahl++; nd.tsum += sd.t;
        const profil = nd.blatt ? k : sd.k;
        [...profil].forEach((c, j) => { nd.an[j] += +c; });
        if (sd.f && nd.eltern){
          const ps = stand[nd.eltern];
          if (ps.t === sd.t && sd.f && nd.blatt && index[nd.eltern].blatt === false && ps.k === sd.k){ /* gleichzeitig: Auslöser steht beim Elternknoten */ }
          else { const o = nd.ausloeser[sd.f.f] = nd.ausloeser[sd.f.f] || {an: 0, aus: 0}; o[sd.f.an ? "an" : "aus"]++; }
        }
        if (nd.eltern){ const ps = stand[nd.eltern]; [...sd.k].forEach((c, j) => { nd.kante[j] += (+c) - (+ps.k[j]); }); }
      }
    }
    for (const nd of knoten){
      nd.p = nd.anzahl / n; nd.t = nd.anzahl ? nd.tsum / nd.anzahl : 0;
      nd.an = nd.an.map(x => nd.anzahl ? x / nd.anzahl : 0);
      nd.kante = nd.kante.map(x => nd.anzahl ? x / nd.anzahl : 0);
    }
    return knoten.filter(nd => nd.id === "wurzel" || nd.anzahl > 0);
  };

  return {NAME, TYP, MODELLE, neu, festhalten, kandidaten, schritt, lauf, typ, haeufigkeit, stabile, baum};
})();
