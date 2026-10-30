// Modell der Mitose: Zeitplan und Geometrie ohne DOM (gezeichnet wird in mitose.html).
// Quelle: template/site/mitose.js, wird von build.py in die Seite kopiert; Test: scripts/mitose/test_mitose.js.
//
//   MITOSE.PHASEN, GRUPPEN     Zeitplan 0 … 1: [{id, name, von, bis, gruppe}]; Gruppe = Phase in der Klasse-9-Ansicht
//   MITOSE.phaseBei(t)         Phase zum Zeitpunkt t
//   MITOSE.dnaGehalt(t)        DNA-Menge je Zelle in C (2 → 4, nach der Teilung 2)
//   MITOSE.zahlen(t)           {chromosomen, chromatiden}: Chromosomen (gezählt an den Centromeren) und Chromatiden einer Zelle
//   MITOSE.zustand(t)          alles, was die Zeichnung braucht: Zellwand, Vakuole, Kern, Chromatiden, Spindel, Zellplatte
//   MITOSE.verbund(c, rho)     Umriss aus zwei verschmelzenden Kreisen (Kern) als Liste von Polygonen
//   MITOSE.einfach             Klasse 5: Wachstum und Teilung einer Pflanzenzelle
// Koordinaten: Mitte der Zelle bei (0, 0), Spindelachse = x-Achse, Einheiten der Zeichnung.
const MITOSE = (() => {
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const glatt = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const fenster = (t, a, b) => clamp((t - a) / (b - a), 0, 1);

  // Die Zeit ist nicht maßstäblich: In der Zelle dauert die Interphase etwa 23 von 24 Stunden, die Mitose etwa eine.
  const PHASEN = [
    {id: "g1",      name: "G1-Phase",     von: 0.00, bis: 0.07, gruppe: "inter"},
    {id: "s",       name: "S-Phase",      von: 0.07, bis: 0.15, gruppe: "inter"},
    {id: "g2",      name: "G2-Phase",     von: 0.15, bis: 0.22, gruppe: "inter"},
    {id: "pro",     name: "Prophase",     von: 0.22, bis: 0.36, gruppe: "pro"},
    {id: "prometa", name: "Prometaphase", von: 0.36, bis: 0.46, gruppe: "pro"},
    {id: "meta",    name: "Metaphase",    von: 0.46, bis: 0.58, gruppe: "meta"},
    {id: "ana",     name: "Anaphase",     von: 0.58, bis: 0.72, gruppe: "ana"},
    {id: "telo",    name: "Telophase",    von: 0.72, bis: 0.86, gruppe: "telo"},
    {id: "cyto",    name: "Zellteilung",  von: 0.86, bis: 1.00, gruppe: "telo"}
  ];
  const GRUPPEN = [
    {id: "inter", name: "Interphase"}, {id: "pro", name: "Prophase"}, {id: "meta", name: "Metaphase"},
    {id: "ana", name: "Anaphase"}, {id: "telo", name: "Telophase"}
  ];
  const phase = id => PHASEN.find(p => p.id === id);
  const phaseBei = t => PHASEN.find(p => t < p.bis) || PHASEN[PHASEN.length - 1];
  const f = (t, id) => fenster(t, phase(id).von, phase(id).bis);
  const T_ANA = phase("ana").von, T_TEIL = 0.95;   // ab T_ANA sind die Schwesterchromatiden getrennt, ab T_TEIL gibt es zwei Zellen

  // Pflanzenzelle: rechteckig in der Zeichnung (Zellwand), die Zellplatte wächst in der Mitte von innen nach außen
  const W_ZELLE = 560, H_ZELLE = 400, R_KERN = 112, R_KERN_T = 78, X_ANA = 145, X_TOCHTER = W_ZELLE / 4;

  function dnaGehalt(t){ return 2 + 2 * glatt(f(t, "s")) - (t >= T_TEIL ? 2 : 0); }

  function zahlen(t){
    const getrennt = t >= T_ANA;
    const chromosomen = t >= T_TEIL ? 4 : getrennt ? 8 : 4;
    // Chromatiden: Zahl der DNA-Moleküle (je eine Chromatide); in der S-Phase wächst sie von 4 auf 8
    const chromatiden = t >= T_TEIL ? 4 : Math.round(4 + 4 * glatt(f(t, "s")));
    return {chromosomen, chromatiden, jeChromosom: getrennt ? 1 : (glatt(f(t, "s")) > 0.5 ? 2 : 1)};
  }

  // Vier Chromosomen (2n = 4): zwei Paare homologer Chromosomen, mütterlich (m) und väterlich (v), lang (L) und kurz (K).
  // p, q: Länge der beiden Arme; y, x0: Platz in der Metaphaseplatte; heim: Lage im Kern (in Kernradien).
  const CHROM = [
    {id: "Lm", herkunft: "m", p: 30, q: 44, y: -100, x0: -6, heim: [-0.38, -0.30]},
    {id: "Kv", herkunft: "v", p: 19, q: 28, y:  -28, x0:  5, heim: [ 0.38,  0.30]},
    {id: "Lv", herkunft: "v", p: 30, q: 44, y:   42, x0:  6, heim: [ 0.34, -0.36]},
    {id: "Km", herkunft: "m", p: 19, q: 28, y:  112, x0: -5, heim: [-0.30,  0.34]}
  ];

  // Form aus zwei verschmelzenden Kreisen (Radius rho, Mittelpunkte bei ±c auf der x-Achse) als Polygone:
  // c = 0 ein Kreis, dazwischen eine Erdnuss mit weicher Taille, ab c ≥ rho zwei getrennte Formen.
  function verbund(c, rho, n = 48){
    const eps = 0.05 * rho * rho;
    const h2 = x => {
      const a = rho * rho - (x - c) * (x - c), b = rho * rho - (x + c) * (x + c);
      return 0.5 * (a + b + Math.sqrt((a - b) * (a - b) + eps * eps) - eps);   // weiches Maximum (bei c = 0 genau ein Kreis)
    };
    const X = c + rho, polys = [];
    let akt = null;
    for (let i = 0; i <= 2 * n; i++){
      const x = -X * Math.cos(Math.PI * i / (2 * n));                       // dichter an den Enden
      const v = h2(x);
      if (v > 1e-4 * rho * rho){ if (!akt) polys.push(akt = []); akt.push([x, Math.sqrt(v)]); } else akt = null;
    }
    return polys.map(p => p.map(([x, y]) => [x, -y]).concat(p.slice().reverse().map(([x, y]) => [x, y])));
  }

  function zustand(t){
    t = clamp(t, 0, 1);
    const P = phaseBei(t);
    const z = {t, phase: P.id, gruppe: P.gruppe, dna: dnaGehalt(t), geteilt: t >= T_TEIL, zahlen: zahlen(t)};

    // Zelle: Die Zellwand bleibt, die Form ändert sich nicht. Zentrosomen gibt es nicht; die Spindelpole sind breite Kappen.
    z.zelle = {w: W_ZELLE, h: H_ZELLE};
    const polR = lerp(R_KERN + 14, 165, glatt(f(t, "prometa"))) + 25 * glatt(f(t, "ana"));
    // Präprophase-Band: Ring aus Mikrotubuli am Rand, markiert die spätere Teilungsebene (verschwindet in der Prophase)
    z.ppb = glatt(fenster(t, 0.10, 0.18)) * (1 - glatt(fenster(t, 0.28, 0.36)));
    // Vakuole: groß in der Interphase, wird zur Teilung klein (Zytoplasma sammelt sich in der Mitte), wächst nach der Teilung
    z.vakuole = t < 0.5 ? 1 - 0.7 * glatt(fenster(t, 0.16, 0.46)) : 0.3 + 0.25 * glatt(fenster(t, 0.86, 1));
    // Zellplatte (Vesikel aus dem Golgi-Apparat) und Phragmoplast (Mikrotubuli), die Platte wächst nach außen bis zur Seitenwand
    z.platte = {wachstum: glatt(fenster(t, 0.78, T_TEIL)), phragmoplast: glatt(fenster(t, 0.74, 0.80)) * (1 - glatt(fenster(t, 0.93, 0.99))), wand: glatt(fenster(t, 0.90, 1))};

    // Kern: Hülle löst sich am Ende der Prophase auf (Hüllenstücke und ER), nach der Anaphase bilden sich zwei neue
    const tel = glatt(fenster(t, 0.74, 0.90));
    z.kern = {
      r: R_KERN, huelle: 1 - glatt(fenster(t, 0.30, 0.44)), nukleolus: 1 - glatt(fenster(t, 0.24, 0.34)),
      tochter: {r: R_KERN_T, x: lerp(X_ANA, X_TOCHTER, tel), huelle: glatt(fenster(t, 0.76, 0.90)), nukleolus: glatt(fenster(t, 0.84, 0.96))}
    };
    z.pol = {x: polR, sichtbar: glatt(fenster(t, 0.24, 0.34)) * (1 - glatt(fenster(t, 0.76, 0.88)))};

    // Chromatiden. Jedes Chromosom hat zwei Chromatiden (seite −1 und +1); die zweite entsteht in der S-Phase.
    // kond: 0 = lockeres Chromatin, 1 = Transportform; zug: Anteil des Weges zu den Polen (Anaphase A)
    const dupl = glatt(f(t, "s"));                 // die zweite Chromatide wird in der S-Phase gebaut
    const kond = t < 0.5 ? glatt(fenster(t, 0.22, 0.40)) : 1 - glatt(fenster(t, 0.74, 0.92));
    const mitte = glatt(fenster(t, 0.36, 0.52)), zug = glatt(fenster(t, 0.58, 0.67));
    z.kond = kond; z.dupl = dupl; z.zug = zug;
    z.chromosomen = CHROM.map(c => {
      const chromatiden = [];
      for (const s of [-1, 1]){
        let x, y, winkel, laenge;
        if (t < T_ANA){
          const heim = [c.heim[0] * R_KERN, c.heim[1] * R_KERN];
          const mitteC = [lerp(heim[0], c.x0, mitte), lerp(heim[1], c.y, mitte)];
          x = mitteC[0] + s * lerp(1.5, 4.5, kond); y = mitteC[1];
          winkel = lerp(118, 104, mitte);              // > 90°: Spitze zur Mitte, die Schwestern bilden ein "X"
          laenge = s === -1 ? 1 : dupl;                 // die zweite Chromatide entsteht in der S-Phase
        } else {
          const x0 = c.x0 + s * 4.5;
          const xz = lerp(x0, s * X_ANA, zug), yz = c.y;
          const xk = s * z.kern.tochter.x + c.heim[0] * z.kern.tochter.r * 0.8, yk = c.heim[1] * z.kern.tochter.r * 0.8;
          x = lerp(xz, xk, tel); y = lerp(yz, yk, tel);
          winkel = lerp(104, 46, zug); laenge = 1;
        }
        chromatiden.push({seite: s, x, y, winkel, laenge});
      }
      return {id: c.id, herkunft: c.herkunft, p: c.p, q: c.q, chromatiden};
    });

    // Spindel (Anteile 0 … 1)
    z.spindel = {sichtbar: z.pol.sichtbar, fang: glatt(fenster(t, 0.38, 0.52)), ueberlapp: 1 - glatt(fenster(t, 0.62, 0.84))};
    return z;
  }

  // Klasse 5: Eine Pflanzenzelle (Rechteck mit Zellwand) wächst, teilt zuerst den Kern, bringt die Kerne an die Enden der langen Seite;
  // dann wächst in der Mitte eine neue Zellwand. L = lange Seite (Richtung der Kernwanderung), S = kurze Seite.
  const einfach = {
    kernR: S => 0.2 * S,
    teilung(u, L, S){
      const rn = this.kernR(S), rnT = rn / Math.SQRT2;
      const teilen = glatt(fenster(u, 0.0, 0.28)), wandern = glatt(fenster(u, 0.28, 0.70));
      return {kern: {c: lerp(rnT * teilen, L / 4, wandern), rho: lerp(rn, rnT, teilen)}, platte: glatt(fenster(u, 0.62, 1.0)), vakuole: 1 - glatt(fenster(u, 0.0, 0.4))};
    }
  };

  return {PHASEN, GRUPPEN, phaseBei, dnaGehalt, zahlen, zustand, verbund, einfach, CHROM, W_ZELLE, H_ZELLE, R_KERN, T_ANA, T_TEIL, glatt, fenster};
})();
