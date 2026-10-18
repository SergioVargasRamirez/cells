// 3D-Ansicht einer Doppelhelix oder eines Einzelstrangs mit Bedienelementen (Quelle: template/site/helix3d.js,
// von build.py in die Seiten kopiert). Braucht PALETTE, HELIX, HELIX_BAU und MOL3D.
//
// Erwartet im Markup der Seite diese Elemente (ids): gl3, ov3, d3text, legende3, sg-farbe3, b-enden, b-furchen,
// b-masse, schnitt, schnitt-o, b-scheibe, v-achse, v-seite und optional sg-laenge (Dein Stück 3 × wiederholt) und b-hb
// (Wasserstoffbrücken zwischen den Basen).
//
//   const d3 = HELIX3D.create({einfach: () => bool, namen: ["Strang 1", "Strang 2"], wiederholung: true, zoom: 1.2});
//   d3.zeige("CGCGAATTCGCG", "DNA");   // Sequenz des Strangs 1 von 5' nach 3'; Modus: "DNA" (B-Form), "RNA" (A-Form),
//                                      // "HYBRID" (DNA-Strang mit T und RNA-Strang, A-ähnlich), "RNA1" (nur der RNA-Strang)
const HELIX3D = (() => {
  "use strict";
  const GL = MOL3D.supported();
  const RAD3 = {C: 0.3, N: 0.3, O: 0.28, P: 0.4};
  const RUECKEN_NAMEN = new Set(["P", "OP1", "OP2", "O5'"]);
  const zahl = (x, n = 1) => x.toLocaleString("de-DE", {minimumFractionDigits: n, maximumFractionDigits: n});
  const lumi = h => { const v = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
  // Wasserstoffbrücken der Watson-Crick-Paare: [Atom der Purinbase, Atom der Pyrimidinbase]
  const HB_PAARE = {AT: [["N6", "O4"], ["N1", "N3"]], AU: [["N6", "O4"], ["N1", "N3"]], GC: [["N1", "N3"], ["N2", "O2"], ["O6", "N4"]]};
  const Rseite = MOL3D.rotX(-Math.PI / 2 + 0.2), Rachse = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

  function create(opt){
    opt = opt || {};
    const $ = id => document.getElementById(id);
    const einfach = opt.einfach || (() => false), namen = opt.namen || ["Strang 1", "Strang 2"];
    const V = {laenge: "lang", farbe: "nukleotid", enden: true, furchen: false, masse: false, hb: false, schnitt: 100, scheibe: true,
               viewer: null, schluessel: "", zmin: 0, zmax: 1, seq: "", modus: "DNA", eigen: 0, d: null, H: null};
    const weiss = "rgba(255,255,255,.92)";

    function farbe3(a, blass){
      let c;
      if (V.farbe === "element") c = PALETTE.rgb("el_" + a.el);
      else if (a.art === "base") c = PALETTE.rgb(a.base);
      else if (RUECKEN_NAMEN.has(a.name)) c = PALETTE.rgb("p5");
      else if (a.name === "O3'") c = PALETTE.rgb("oh3");
      else c = PALETTE.rgb("zucker");
      if (blass){   // Fortsetzung der Sequenz: zum Hintergrund hin aufgehellt
        const g = PALETTE.istDunkel() ? [0.16, 0.2, 0.19] : [0.88, 0.91, 0.9];
        c = c.map((v, i) => v * 0.45 + g[i] * 0.55);
      }
      return c;
    }
    const wiederholt = () => opt.wiederholung && V.laenge === "lang" && V.modus !== "RNA1";
    function baue3D(){
      const seq = wiederholt() ? V.seq.repeat(3) : V.seq;
      const form = V.modus === "DNA" ? "DNA" : "RNA", hybrid = V.modus === "HYBRID" || V.modus === "RNA1";
      let d = HELIX_BAU.bauen(seq, form, {hybrid});
      if (V.modus === "RNA1"){   // nur der RNA-Strang (Strang 2) bleibt übrig
        const idx = [], atome = [], index = {};
        d.atome.forEach((a, i) => { if (a.strang === 2){ idx[i] = atome.length; index[a.strang + ":" + a.bp + ":" + a.name] = atome.length; atome.push(a); } else idx[i] = -1; });
        d = {atome, bindungen: d.bindungen.filter(([i, j]) => idx[i] >= 0 && idx[j] >= 0).map(([i, j]) => [idx[i], idx[j]]), n: d.n, form: d.form, index};
      }
      const atome = d.atome.map(a => ({
        p: a.pos, c: farbe3(a, a.bp >= V.eigen), r: RAD3[a.el] || 0.3,
        tip: (einfach() ? "" : a.name + " · ") + (V.modus === "RNA1" ? "RNA" : namen[a.strang - 1]) + ", Position " + (a.bp + 1) + " (" + a.base + ")",
      }));
      const bindungen = d.bindungen.map(([i, j]) => ({a: i, b: j, r: 0.1}));
      if (V.hb && V.modus !== "RNA1"){   // gestrichelte Wasserstoffbrücken
        const farbeHB = PALETTE.rgb("hbruecke");
        for (let k = 0; k < d.n; k++){
          const x1 = d.atome[d.index["1:" + k + ":C1'"]].base, x2 = d.atome[d.index["2:" + k + ":C1'"]].base;
          const pur = "AG".includes(x1) ? 1 : 2, liste = HB_PAARE[("AG".includes(x1) ? x1 + x2 : x2 + x1)];
          if (!liste) continue;
          for (const [p, q] of liste){
            const i = d.index[(pur === 1 ? 1 : 2) + ":" + k + ":" + p], j = d.index[(pur === 1 ? 2 : 1) + ":" + k + ":" + q];
            if (i !== undefined && j !== undefined) bindungen.push({a: i, b: j, strich: true, r: 0.09, c: farbeHB});
          }
        }
      }
      let zmin = 1e9, zmax = -1e9;
      for (const a of atome){ zmin = Math.min(zmin, a.p[2]); zmax = Math.max(zmax, a.p[2]); }
      V.zmin = zmin - 0.5; V.zmax = zmax + 0.5; V.d = d; V.H = HELIX[form];
      return {atome, bindungen};
    }
    function beschriftungen3D(){
      const d = V.d, H = V.H, id = d.index, at = (st, k, n) => d.atome[id[st + ":" + k + ":" + n]], n = d.n, L = [], P = PALETTE.get;
      const einzel = V.modus === "RNA1", s1 = einzel ? 2 : 1;
      const tag = (pos, text, col, dx, dy) => { const h = P(col); L.push({p: pos, text, bg: h, border: h, color: lumi(h) > 0.55 ? "#111" : "#fff", dx: dx || 0, dy: dy || -20}); };
      if (V.enden){
        if (!einzel){ tag(at(1, 0, "P").pos, "5'", "p5", -16, -6); tag(at(1, n - 1, "O3'").pos, "3'", "oh3", -16, 8); }
        tag(at(2, n - 1, "P").pos, "5'", "p5", 16, -6); tag(at(2, 0, "O3'").pos, "3'", "oh3", 16, 8);
      }
      const mitte = Math.floor(n / 2), schritt = n >= 10 ? 2 : 1, b0 = Math.max(0, mitte - 3 * schritt + (schritt === 1 ? 1 : 0)), kk = j => Math.max(0, Math.min(n - 2, b0 + j * schritt));
      if (V.furchen && !einzel){
        const c1a = at(1, mitte, "C1'").pos, c1b = at(2, mitte, "C1'").pos;
        const m = [(c1a[0] + c1b[0]) / 2, (c1a[1] + c1b[1]) / 2, (c1a[2] + c1b[2]) / 2];
        let sx = 0, sy = 0, cnt = 0;
        for (const a of d.atome) if (a.bp === mitte && a.art === "base"){ sx += a.pos[0]; sy += a.pos[1]; cnt++; }
        let dx = sx / cnt - m[0], dy = sy / cnt - m[1]; const dl = Math.hypot(dx, dy); dx /= dl; dy /= dl;
        const punkt = (rx, ry, r) => { let t = 0; while (t < 30 && Math.hypot(m[0] + rx * t, m[1] + ry * t) < r) t += 0.1; return [m[0] + rx * t, m[1] + ry * t, m[2]]; };
        for (const [rx, ry, text, col] of [[dx, dy, "große Furche", "oh2"], [-dx, -dy, "kleine Furche", "p5"]]){
          const a = punkt(rx, ry, 6), b = punkt(rx, ry, 12.5);
          L.push({a, b, linie: true, text: "", color: P(col)});
          L.push({p: b, text, color: P(col), bg: weiss, border: P(col), dx: rx > 0 ? 50 : -50, dy: 0});
        }
      }
      if (V.masse){
        const zk = k => at(s1, k, "C1'").pos[2], ax = k => [0, 0, zk(k)];
        const k0 = kk(0), r0 = at(s1, k0, "C1'").pos, r1 = at(s1, k0 + 1, "C1'").pos;
        L.push({a: ax(k0), b: r0, linie: true, text: "", color: P("oh2")});
        L.push({a: ax(k0 + 1), b: r1, linie: true, text: zahl(H.drehung) + "° Drehung", color: P("oh2"), bg: weiss, dx: -64, dy: 6});
        if (!einzel){
          const c1a = at(1, kk(1), "C1'").pos, c1b = at(2, kk(1), "C1'").pos;
          L.push({a: c1a, b: c1b, linie: true, text: zahl(Math.hypot(c1a[0] - c1b[0], c1a[1] - c1b[1], c1a[2] - c1b[2])) + " Å (C1'–C1')", color: P("p5"), bg: weiss, dy: -14});
          const pa = at(1, kk(2), "P").pos;
          const pb = d.atome.filter(a => a.name === "P" && a.strang === 2).reduce((best, a) => {
            const l = Math.hypot(a.pos[0] - pa[0], a.pos[1] - pa[1], a.pos[2] - pa[2]);
            return l > best.dist && Math.abs(a.pos[2] - pa[2]) < 4 ? {dist: l, pos: a.pos} : best;
          }, {dist: 0, pos: pa});
          L.push({a: pa, b: pb.pos, linie: true, text: "P–P " + zahl(pb.dist) + " Å", color: P("oh3"), bg: weiss, dy: 12});
        }
        L.push({a: ax(kk(3)), b: ax(kk(3) + 1), linie: true, text: zahl(H.anstieg) + " Å Anstieg", color: P("schnitt"), bg: weiss, dx: 64});
      }
      return L;
    }
    function text3D(){
      const H = V.H, windung = 360 / H.drehung, ganghoehe = H.anstieg * windung, eig = einfach(), m = V.modus;
      const titel = {DNA: "DNA in der B-Form", RNA: "RNA-Doppelstrang in der A-Form", HYBRID: "DNA-RNA-Hybrid (A-ähnliche Form)", RNA1: "RNA-Einzelstrang"}[m];
      let liste;
      if (m === "DNA") liste = [
        "<b>B-Form:</b> So liegt DNA in der Zelle meist vor. Die Helix ist schlank und lang gestreckt.",
        "Eine volle Windung dauert etwa " + zahl(windung, 0) + " Basenpaare (" + zahl(ganghoehe, 0) + " Å).",
        "Die große und die kleine Furche sind verschieden breit: In der großen Furche liegen die Basen für Proteine gut zugänglich.",
      ];
      else if (m === "RNA") liste = [
        "<b>A-Form:</b> So liegen RNA-Doppelstränge vor, zum Beispiel in Haarnadeln oder in manchen Viren. Die Helix ist gedrungener und dicker als die B-Form.",
        "Eine volle Windung dauert etwa " + zahl(windung, 0) + " Basenpaare (" + zahl(ganghoehe, 0) + " Å), jedes Basenpaar steigt nur " + zahl(H.anstieg) + " Å an.",
        "Die Basenpaare sind geneigt und liegen neben der Achse: In der Mitte entsteht ein Loch. Die große Furche ist tief und eng.",
      ];
      else if (m === "HYBRID") liste = [
        "<b>DNA-RNA-Hybrid:</b> So liegt ein RNA-Strang an einer DNA-Vorlage. Hybride haben eine A-ähnliche Form: gedrungener und dicker als die B-Form.",
        "Eine volle Windung dauert etwa " + zahl(windung, 0) + " Basenpaare (" + zahl(ganghoehe, 0) + " Å), jedes Basenpaar steigt nur " + zahl(H.anstieg) + " Å an.",
        "Der RNA-Strang trägt 2'-OH-Gruppen, der DNA-Strang nicht.",
      ];
      else liste = [
        "<b>RNA-Einzelstrang:</b> So sieht die fertige RNA aus, nachdem sie sich von der DNA-Vorlage gelöst hat.",
        "Die Basen sind gestapelt gezeigt, in einer A-ähnlichen Anordnung wie in kurzen Abschnitten echter RNA. Längere RNA-Stränge falten sich meist weiter, zum Beispiel zur tRNA.",
        "Jedes Nukleotid trägt eine 2'-OH-Gruppe. Das 5'-Ende ist hier als einzelnes Phosphat gezeichnet.",
      ];
      if (!eig) liste.push("Schnitt: Schiebe den Regler und wähle „Blick entlang der Achse“. Mit „Nur eine Scheibe“ siehst du " + (m === "RNA1" ? "einzelne Basen" : "ein einzelnes Basenpaar") + " von oben, mit dem Rückgrat außen.");
      $("d3text").innerHTML = "<h3>" + titel + "</h3><ul>" + liste.map(x => "<li>" + x + "</li>").join("") + "</ul>";
    }
    function legende3(){
      const P = PALETTE.get, chip3 = (c, t) => '<span><i style="background:' + P(c) + '"></i>' + t + "</span>", m = V.modus;
      $("legende3").innerHTML = V.farbe === "nukleotid"
        ? chip3("A", "Adenin") + chip3("G", "Guanin") + chip3("C", "Cytosin") + (m !== "RNA" && m !== "RNA1" ? chip3("T", "Thymin") : "") + (m !== "DNA" ? chip3("U", "Uracil") : "") + chip3("p5", "Phosphat (5')") + chip3("oh3", "3'-O") + chip3("zucker", "Zucker") + (V.hb && m !== "RNA1" ? chip3("hbruecke", "Wasserstoffbrücke") : "")
        : "<span>Kohlenstoff, Stickstoff, Sauerstoff und Phosphor in den üblichen Elementfarben</span>";
    }
    function zeichne3D(neu){
      if (!V.viewer) return;
      V.viewer.setScene(baue3D(), {keepView: !neu});
      V.viewer.setLabels(beschriftungen3D());
      schnittAnwenden(); text3D(); legende3();
      for (const id of ["b-furchen", "b-hb"]){ const el = $(id), fl = el && el.closest("label"); if (fl) fl.hidden = V.modus === "RNA1"; }
    }
    function schnittAnwenden(){
      const f = V.schnitt / 100;
      $("schnitt-o").textContent = V.schnitt >= 100 ? "kein Schnitt" : Math.round(f * 100) + " % der Länge";
      const d = V.zmin + (V.zmax - V.zmin) * f;
      V.viewer.setClip(V.schnitt >= 100 ? null : {n: [0, 0, 1], d, min: V.scheibe ? d - 5 : undefined});
    }
    // seq: Strang 1 von 5' nach 3' (bei "RNA1": die Sequenz der Vorlage; gezeigt wird ihr Komplement als RNA)
    function zeige(seq, modus, eigen){
      V.seq = seq; V.modus = modus; V.eigen = eigen === undefined ? seq.length : eigen;
      if (!GL){
        $("gl3").hidden = $("ov3").hidden = true;
        if (!$("gl3").parentNode.querySelector(".keingl")) $("gl3").parentNode.insertAdjacentHTML("beforeend", '<div class="keingl">Das 3D-Bild braucht WebGL, das in diesem Browser nicht verfügbar ist.</div>');
        return;
      }
      const neu = !V.viewer;
      if (neu){ V.viewer = MOL3D.create($("gl3"), $("ov3"), {zoom: opt.zoom || 1.2}); V.viewer.setRotation(Rseite, true); }
      const key = seq + "|" + modus + "|" + V.eigen + "|" + V.laenge;
      if (neu || V.schluessel !== key){ V.schluessel = key; zeichne3D(true); }
    }
    function segment(id, schluessel, nach){
      const g = $(id); if (!g) return;
      g.addEventListener("click", e => {
        const bt = e.target.closest("button"); if (!bt) return;
        g.querySelectorAll("button").forEach(x => x.setAttribute("aria-checked", String(x === bt)));
        V[schluessel] = bt.dataset.wert; nach();
      });
    }
    segment("sg-laenge", "laenge", () => { V.schluessel = ""; if (V.viewer) zeige(V.seq, V.modus, V.eigen); });
    segment("sg-farbe3", "farbe", () => zeichne3D(false));
    for (const [id, k] of [["b-enden", "enden"], ["b-furchen", "furchen"], ["b-masse", "masse"]]) $(id).addEventListener("change", e => { V[k] = e.target.checked; if (V.viewer) V.viewer.setLabels(beschriftungen3D()); });
    if ($("b-hb")) $("b-hb").addEventListener("change", e => { V.hb = e.target.checked; zeichne3D(false); });
    $("b-scheibe").addEventListener("change", e => { V.scheibe = e.target.checked; if (V.viewer) schnittAnwenden(); });
    $("schnitt").addEventListener("input", e => { V.schnitt = +e.target.value; if (V.viewer) schnittAnwenden(); });
    $("v-achse").addEventListener("click", () => V.viewer && V.viewer.animateTo(Rachse, 700));
    $("v-seite").addEventListener("click", () => V.viewer && V.viewer.animateTo(Rseite, 700));
    if (window.matchMedia) matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (V.viewer) zeichne3D(false); });
    document.addEventListener("einfach-geaendert", () => { if (V.viewer) text3D(); });
    return {zeige, neuZeichnen: () => zeichne3D(false)};
  }
  return {create};
})();
