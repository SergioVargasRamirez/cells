// Basenpaarung und Synthese eines neuen Strangs, für basenpaarung.html (DNA → DNA) und
// transkription.html (DNA → RNA). Quelle: template/site/paarung.js, wird von build.py in die Seiten kopiert.
// Braucht PALETTE, HELIX, DNA2D, HELIX_BAU und MOL3D (aus den anderen Snippets) und das Markup der Seiten.
//
// Regeln der Übung:
//  - Links steht die Matrize (5' oben). Der neue Strang entsteht rechts von unten nach oben (5' → 3').
//  - Ein Nukleotid lässt sich nur an das 3'-Ende der wachsenden Kette anfügen, also in das Feld direkt über
//    dem zuletzt gesetzten. Alles andere wird ohne Hinweis zurückgewiesen.
//  - Im Vorrat liegen die Nukleosidtriphosphate. Beim Anfügen reagiert das 3'-OH der Kette mit dem
//    α-Phosphat (Leuchten); Pyrophosphat und Wasser werden freigesetzt, bleiben einige Sekunden und verschwinden.
const PAARUNG = (() => {
  "use strict";

  function start(cfg){
    const $ = id => document.getElementById(id);
    const svg = $("leiter");
    const NS = "http://www.w3.org/2000/svg";
    const RNA = cfg.art === "rna";
    const ROWS = 5, PITCH = 4.0, XL = -3.714, XR = 3.714, SK = DNA2D.SK;
    const POOL_SKALA = 0.78, POOL = [[18.2, -1.2], [27.6, -1.2], [18.2, -8.6], [27.6, -8.6]];
    const ZEIT = {glut: 1700, ppiStart: 500, ppiWeg: 2700, ppiAus: 5200, ende: 6200};
    const FORM_NEU = RNA ? "RNA" : "DNA", GEOM = RNA ? "RNA" : "DNA";
    const KOMP = RNA ? {A: "U", T: "A", G: "C", C: "G"} : {A: "T", T: "A", G: "C", C: "G"};
    const POOL_BASEN = RNA ? ["A", "C", "G", "U"] : ["A", "C", "G", "T"];
    const NAMEN = {A: "Adenin", C: "Cytosin", G: "Guanin", T: "Thymin", U: "Uracil"};
    const Z = {seq: [], placed: [], sel: null, drag: null};
    const einfach = () => $("einfach").checked;
    const yRow = i => -i * PITCH;
    const dim = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const tr = (x, y, s) => `translate(${x.toFixed(3)},${(-y).toFixed(3)})${s ? " scale(" + s + ")" : ""}`;
    const lumi = h => { const v = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
    const reduziert = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

    svg.innerHTML = '<defs><radialGradient id="glut"><stop offset="0" stop-color="#fff3b0" stop-opacity=".95"/><stop offset=".45" stop-color="#ffc400" stop-opacity=".55"/><stop offset="1" stop-color="#ff9100" stop-opacity="0"/></radialGradient></defs><g id="szene"></g><g id="fx" pointer-events="none"></g>';
    const szene = svg.querySelector("#szene"), fx = svg.querySelector("#fx");

    /* ---------- Zustand ---------- */
    const anzahl = () => Z.placed.filter(Boolean).length;
    const naechste = () => { const n = anzahl(); return n >= ROWS ? -1 : ROWS - 1 - n; };   // Feld direkt über dem 3'-Ende der Kette
    function neueSequenz(){
      const al = ["A", "C", "G", "T"];
      let seq;
      do { seq = Array.from({length: ROWS}, () => al[Math.floor(Math.random() * 4)]); }
      while (!seq.some(b => b === "G" || b === "C") || !seq.some(b => b === "A" || b === "T"));
      Z.seq = seq; Z.placed = Array(ROWS).fill(null); Z.sel = null;
      if (cfg.primer) Z.placed[ROWS - 1] = KOMP[seq[ROWS - 1]];
    }
    const istPrimer = i => cfg.primer && i === ROWS - 1;
    const kachelL = (i) => DNA2D.kachel(Z.seq[i], "DNA", "l", {geometrie: GEOM, frei3: i === ROWS - 1});
    const kachelR = (b, opt) => DNA2D.kachel(b, FORM_NEU, "r", Object.assign({geometrie: GEOM}, opt || {}));
    const chip = (b, x, y) => {
      const c = PALETTE.get(b), l = lumi(c);
      return `<circle cx="${x}" cy="${-y}" r="0.46" fill="${c}" stroke="var(--surface)" stroke-width="0.08"/><text x="${x}" y="${-y}" text-anchor="middle" dominant-baseline="central" font-size="0.6" font-weight="800" fill="${l > 0.55 ? "#111" : "#fff"}">${b}</text>`;
    };
    // Verbindung O3' (cyan) – P (magenta) zwischen zwei Nukleotiden
    function verbinder(o3, p){
      const m = [(o3[0] + p[0]) / 2, (o3[1] + p[1]) / 2], c = PALETTE.get("oh3"), q = PALETTE.get("p5");
      const ln = (a, b, col) => `<line x1="${a[0].toFixed(3)}" y1="${(-a[1]).toFixed(3)}" x2="${b[0].toFixed(3)}" y2="${(-b[1]).toFixed(3)}" stroke="${col}" stroke-width="0.12" stroke-linecap="round"/>`;
      return ln(o3, m, c) + ln(m, p, q);
    }
    const bondLinien = (liste, klasse) => liste.map(q => `<line class="${klasse}" x1="${q.von[0].toFixed(3)}" y1="${(-q.von[1]).toFixed(3)}" x2="${q.nach[0].toFixed(3)}" y2="${(-q.nach[1]).toFixed(3)}" stroke="${PALETTE.get("hbruecke")}" stroke-width="0.11" stroke-dasharray="0.2 0.16" stroke-linecap="round"/>`).join("");

    /* ---------- Zeichnen ---------- */
    function render(){
      const P = PALETTE.get, links = Z.seq.map((b, i) => kachelL(i));
      const oben = ROWS - anzahl();   // oberste gesetzte Zeile = 3'-Ende der Kette
      const rechts = Z.placed.map((b, i) => {
        if (!b) return null;
        const erstes = i === ROWS - 1;
        return kachelR(b, {frei3: i === oben, tri: erstes && !istPrimer(i)});   // das erste Nukleotid behält sein Triphosphat (ohne Primer)
      });
      let t = "", unten = "";
      const kopf = (x, y, txt, col) => `<text x="${x}" y="${-y}" text-anchor="middle" font-size="0.9" font-weight="800" fill="${col}">${txt}</text>`;
      t += `<text x="${XL}" y="${-(yRow(0) + 4.6)}" text-anchor="middle" font-size="0.8" font-weight="700" fill="currentColor">Matrize (DNA)</text>`;
      t += `<text x="${XR + 1}" y="${-(yRow(0) + 4.6)}" text-anchor="middle" font-size="0.8" font-weight="700" fill="currentColor">${RNA ? "neue RNA" : "neuer Strang"}</text>`;
      for (let i = 0; i < ROWS; i++){
        const L = links[i], y = yRow(i);
        t += `<g transform="${tr(XL, y)}">${L.svg}${chip(Z.seq[i], L.mitte[0], L.mitte[1])}</g>`;
        if (i > 0){
          const K0 = links[i - 1];
          unten += verbinder([XL + K0.atome["O3'"][0], yRow(i - 1) + K0.atome["O3'"][1]], [XL + L.atome["P"][0], y + L.atome["P"][1]]);
        }
      }
      t += kopf(XL + links[0].atome["P"][0] - 0.2, yRow(0) + links[0].atome["P"][1] + 1.0, "5'", P("p5"));
      const l3 = links[ROWS - 1].atome["O3'"];
      t += kopf(XL + l3[0] + 0.1, yRow(ROWS - 1) + l3[1] - 1.15, "3'", P("oh3"));
      const next = naechste();
      for (let i = 0; i < ROWS; i++){
        const y = yRow(i), R = rechts[i];
        if (R){
          const entfernbar = i === oben && !istPrimer(i);
          t += `<g class="gesetzt${entfernbar ? " entfernbar" : ""}" data-zeile="${i}" ${entfernbar ? 'tabindex="0" role="button" aria-label="Zeile ' + (i + 1) + ': ' + NAMEN[Z.placed[i]] + ' gesetzt. Eingabetaste entfernt es wieder."' : 'role="img" aria-label="Zeile ' + (i + 1) + ': ' + NAMEN[Z.placed[i]] + ' gesetzt"'} transform="${tr(XR, y)}">${R.svg}${chip(Z.placed[i], R.mitte[0], R.mitte[1])}</g>`;
          t += bondLinien(DNA2D.bruecken(links[i], [XL, y], R, [XR, y]).liste, "hb");
          if (i < ROWS - 1 && rechts[i + 1]){
            const R1 = rechts[i + 1];
            unten += verbinder([XR + R1.atome["O3'"][0], yRow(i + 1) + R1.atome["O3'"][1]], [XR + R.atome["P"][0], y + R.atome["P"][1]]);
          }
        } else {
          t += `<g class="platz" data-zeile="${i}" tabindex="0" role="button" aria-label="Leeres Feld in Zeile ${i + 1}, Partner für ${NAMEN[Z.seq[i]]}. Ein ausgewähltes Nukleotid mit der Eingabetaste hier einsetzen." transform="${tr(XR, y)}"><rect class="rahmen" x="-3.9" y="-3.5" width="7.0" height="3.9" rx="0.5"/></g>`;
        }
      }
      const first = rechts[0], last = rechts[ROWS - 1];
      if (first && oben === 0) t += kopf(XR + first.atome["O3'"][0] + 0.2, yRow(0) + first.atome["O3'"][1] + 0.85, "3'", P("oh3"));
      else if (rechts[oben]) { const q = rechts[oben]; t += kopf(XR + q.atome["O3'"][0] + 0.2, yRow(oben) + q.atome["O3'"][1] + 0.85, "3'", P("oh3")); }
      if (last) t += kopf(XR + last.atome["P"][0] + 0.1, yRow(ROWS - 1) + last.atome["P"][1] - 1.25, "5'", P("p5"));
      // Vorrat: Nukleosidtriphosphate
      t += `<text x="${(POOL[0][0] + POOL[1][0]) / 2 + 0.4}" y="${-(yRow(0) + 4.6)}" text-anchor="middle" font-size="0.8" font-weight="700" fill="currentColor">Vorrat (${RNA ? "NTPs" : "dNTPs"})</text>`;
      POOL_BASEN.forEach((b, k) => {
        const R = kachelR(b, {frei3: true, tri: true}), o = POOL[k];
        t += `<g class="vorrat" data-base="${b}" tabindex="0" role="button" aria-pressed="${Z.sel === b}" aria-label="${RNA ? "Ribonukleosidtriphosphat" : "Desoxyribonukleosidtriphosphat"} mit ${NAMEN[b]} (${b}). Ziehen oder mit der Eingabetaste auswählen." transform="${tr(o[0], o[1], POOL_SKALA)}"><rect class="rahmen" x="-4.4" y="-3.7" width="11.2" height="8.1" rx="0.6"/>${R.svg}${chip(b, R.mitte[0], R.mitte[1])}</g>`;
      });
      svg.setAttribute("viewBox", `-7.6 -5.8 41.4 ${(5.8 + (ROWS - 1) * PITCH + 5.4).toFixed(1)}`);
      szene.innerHTML = unten + t;
      // Ereignisse
      szene.querySelectorAll(".vorrat").forEach(g => {
        g.addEventListener("pointerdown", e => starteZiehen(e, g));
        g.addEventListener("keydown", e => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault(); Z.sel = Z.sel === g.dataset.base ? null : g.dataset.base; render();
          const n = szene.querySelector(`.vorrat[data-base="${g.dataset.base}"]`); if (n) n.focus();
          if (Z.sel) status(einfach() ? "Wähle jetzt ein leeres Feld rechts aus." : "Ausgewählt: " + NAMEN[Z.sel] + ". Wähle mit Tab ein leeres Feld und drücke die Eingabetaste.");
        });
      });
      szene.querySelectorAll(".platz").forEach(g => {
        g.addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && Z.sel){ e.preventDefault(); setze(+g.dataset.zeile, Z.sel); } });
        g.addEventListener("click", () => { if (Z.sel) setze(+g.dataset.zeile, Z.sel); });
      });
      szene.querySelectorAll(".gesetzt.entfernbar").forEach(g => {
        const weg = () => { Z.placed[+g.dataset.zeile] = null; render(); status("Das Feld ist wieder frei."); };
        g.addEventListener("click", weg);
        g.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " "){ e.preventDefault(); weg(); } });
      });
      $("z-richtung").hidden = einfach();
      $("r-gegen").hidden = einfach();
      aktualisiere3D();
    }
    function status(txt){ $("status2").innerHTML = txt; }
    const grundtext = () => cfg.grundtext;

    /* ---------- Effekte: Leuchten, Pyrophosphat und Wasser ---------- */
    function el(name, attrs){ const e = document.createElementNS(NS, name); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; }
    function reaktion(i, b){
      // 3'-OH der Kette (Zeile i+1) und α-Phosphat des neuen Nukleotids (Zeile i) reagieren
      const Ku = kachelR(Z.placed[i + 1], {}), Kn = kachelR(b, {tri: true}), P = PALETTE.get;
      const o3 = [XR + Ku.atome["O3'"][0], yRow(i + 1) + Ku.atome["O3'"][1]], pa = [XR + Kn.atome["P"][0], yRow(i) + Kn.atome["P"][1]];
      const J = [(o3[0] + pa[0]) / 2, (o3[1] + pa[1]) / 2];
      const pb = [XR + Kn.atome["PB"][0], yRow(i) + Kn.atome["PB"][1]], pg = [XR + Kn.atome["PG"][0], yRow(i) + Kn.atome["PG"][1]], ob = [XR + Kn.atome["O3B"][0], yRow(i) + Kn.atome["O3B"][1]];
      const o3a = [XR + Kn.atome["O3A"][0], yRow(i) + Kn.atome["O3A"][1]];
      const g = el("g", {}); fx.appendChild(g);
      // Leuchten am reagierenden Paar
      const glow = [0, 1].map(() => { const c = el("circle", {cx: J[0], cy: -J[1], r: 0.1, fill: "url(#glut)", opacity: 0}); g.appendChild(c); return c; });
      // Pyrophosphat: zwei P-Kreise mit Brücken-O, von der Bindungsstelle gelöst
      const ppi = el("g", {opacity: 0}); g.appendChild(ppi);
      const ln = (a, c) => ppi.appendChild(el("line", {x1: a[0] - pb[0], y1: -(a[1] - pb[1]), x2: c[0] - pb[0], y2: -(c[1] - pb[1]), stroke: P("p5"), "stroke-width": 0.09, "stroke-linecap": "round"}));
      ln(pb, ob); ln(ob, pg);
      for (const q of [pb, pg]){
        ppi.appendChild(el("circle", {cx: q[0] - pb[0], cy: -(q[1] - pb[1]), r: 0.36, fill: P("p5")}));
        const tx = el("text", {x: q[0] - pb[0], y: -(q[1] - pb[1]), "text-anchor": "middle", "dominant-baseline": "central", "font-size": 0.46, "font-weight": 800, fill: "#fff"}); tx.textContent = "P"; ppi.appendChild(tx);
      }
      ppi.appendChild(el("circle", {cx: ob[0] - pb[0], cy: -(ob[1] - pb[1]), r: 0.13, fill: P("p5")}));
      // Spaltmarke an der gelösten Bindung Pα–O
      const marke = el("polyline", {points: [[-0.2, 0.14], [0, -0.14], [0.2, 0.14]].map(q => ((o3a[0] + pa[0]) / 2 + q[0]).toFixed(2) + "," + (-((o3a[1] + pa[1]) / 2) + q[1]).toFixed(2)).join(" "), fill: "none", stroke: P("schnitt"), "stroke-width": 0.12, "stroke-linecap": "round", "stroke-linejoin": "round", opacity: 0});
      g.appendChild(marke);
      // Wasser
      const wasser = el("text", {x: J[0], y: -J[1], "text-anchor": "middle", "dominant-baseline": "central", "font-size": 0.78, "font-weight": 700, fill: "currentColor", stroke: "var(--surface)", "stroke-width": 0.22, "paint-order": "stroke", opacity: 0});
      wasser.textContent = cfg.wasser === false ? "" : "H₂O"; g.appendChild(wasser);   // cfg.wasser: false blendet das Wasser aus
      const t0 = performance.now(), still = reduziert();
      const ease = k => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);
      const schritt = now => {
        const t = now - t0;
        if (t > ZEIT.ende){ g.remove(); return; }
        glow.forEach((c, k) => {
          const u = (t - k * 600) / ZEIT.glut * 1.5;
          if (u < 0 || u > 1){ c.setAttribute("opacity", 0); return; }
          c.setAttribute("r", (0.35 + 1.9 * u).toFixed(3)); c.setAttribute("opacity", (0.95 * (1 - u)).toFixed(3));
        });
        const aus = t < ZEIT.ppiAus ? 1 : 1 - (t - ZEIT.ppiAus) / (ZEIT.ende - ZEIT.ppiAus);
        const sicht = t >= ZEIT.ppiStart ? aus : 0, w = still ? 0 : ease((t - ZEIT.ppiStart) / (ZEIT.ppiWeg - ZEIT.ppiStart));
        ppi.setAttribute("transform", `translate(${(pb[0] + 3.2 * w).toFixed(3)},${(-pb[1] + 1.6 * w).toFixed(3)})`);
        ppi.setAttribute("opacity", sicht.toFixed(3));
        wasser.setAttribute("x", (J[0] + 3.6 * w).toFixed(3)); wasser.setAttribute("y", (-J[1] - 2.4 * w).toFixed(3));
        wasser.setAttribute("opacity", (t >= ZEIT.ppiStart + 200 ? aus : 0).toFixed(3));
        marke.setAttribute("opacity", t < 1500 ? "1" : "0");
        requestAnimationFrame(schritt);
      };
      requestAnimationFrame(schritt);
    }

    /* ---------- Ziehen ---------- */
    function svgPunkt(e){
      const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
      const p = pt.matrixTransform(svg.getScreenCTM().inverse());
      return [p.x, -p.y];
    }
    function starteZiehen(e, g){
      if (e.button > 0 || Z.drag) return;
      e.preventDefault();
      const b = g.dataset.base, k = POOL_BASEN.indexOf(b), p = svgPunkt(e), R = kachelR(b, {frei3: true, tri: true});
      const elm = el("g", {class: "zieh", "pointer-events": "none", opacity: 0.93});
      elm.innerHTML = R.svg + chip(b, R.mitte[0], R.mitte[1]);
      const live = el("g", {});
      svg.appendChild(live); svg.appendChild(elm);
      const off = [R.mitte[0], R.mitte[1]], pos = [p[0] - off[0], p[1] - off[1]];
      Z.drag = {b, R, el: elm, live, off, pos, zeile: -1, id: e.pointerId, ursprung: POOL[k]};
      elm.setAttribute("transform", tr(pos[0], pos[1]));
      svg.setPointerCapture(e.pointerId);
      status("Bewege den Baustein zu einer Base des linken Strangs.");
    }
    svg.addEventListener("pointermove", e => {
      const d = Z.drag; if (!d || e.pointerId !== d.id) return;
      const p = svgPunkt(e), pos = [p[0] - d.off[0], p[1] - d.off[1]];
      let best = -1, bd = 1e9;
      for (let i = 0; i < ROWS; i++) if (!Z.placed[i]){ const q = dim(pos, [XR, yRow(i)]); if (q < bd){ bd = q; best = i; } }
      d.zeile = bd < 6 ? best : -1;
      if (d.zeile >= 0 && bd < 1.8){ pos[0] = XR; pos[1] = yRow(d.zeile); }   // magnetisch einrasten
      d.pos = pos; d.el.setAttribute("transform", tr(pos[0], pos[1]));
      szene.querySelectorAll(".platz").forEach(g => g.classList.toggle("nah", +g.dataset.zeile === d.zeile));
      if (d.zeile >= 0){
        const r = DNA2D.bruecken(kachelL(d.zeile), [XL, yRow(d.zeile)], d.R, pos);
        d.live.innerHTML = bondLinien(r.liste, "live");
      } else d.live.innerHTML = "";
    });
    function beendeZiehen(e){
      const d = Z.drag; if (!d || e.pointerId !== d.id) return;
      Z.drag = null;
      d.live.remove();
      szene.querySelectorAll(".platz").forEach(g => g.classList.remove("nah"));
      const ziel = d.zeile >= 0 && dim(d.pos, [XR, yRow(d.zeile)]) < 2.4;
      status(grundtext());
      if (ziel && setze(d.zeile, d.b)){ d.el.remove(); return; }
      zurueck(d);
    }
    svg.addEventListener("pointerup", beendeZiehen);
    svg.addEventListener("pointercancel", beendeZiehen);
    function zurueck(d){   // abgewiesenes Nukleotid fliegt in den Vorrat zurück
      const von = d.pos.slice(), nach = d.ursprung.slice(), t0 = performance.now(), dauer = reduziert() ? 1 : 260;
      const f = now => {
        const k = Math.min(1, (now - t0) / dauer), e = 1 - Math.pow(1 - k, 3);
        d.el.setAttribute("transform", tr(von[0] + (nach[0] - von[0]) * e, von[1] + (nach[1] - von[1]) * e, 1 - (1 - POOL_SKALA) * e));
        d.el.setAttribute("opacity", (0.93 * (1 - k * 0.6)).toFixed(2));
        if (k < 1) requestAnimationFrame(f); else d.el.remove();
      };
      requestAnimationFrame(f);
    }

    /* ---------- Setzen ---------- */
    function setze(i, b){
      if (Z.placed[i] || i !== naechste()) return false;   // nur am 3'-Ende der Kette: ohne Meldung
      const L = kachelL(i), R = kachelR(b), r = DNA2D.bruecken(L, [XL, yRow(i)], R, [XR, yRow(i)]);
      if (r.klirr < 2.3){
        status("Das passt nicht: Die beiden Basen sind zu groß und überlappen sich." + (einfach() ? "" : " Zwei Purine (A, G) mit zwei Ringen passen nicht gegenüber."));
        return false;
      }
      if (!r.passt){
        status("Das passt nicht: Die beiden Basen liegen gegenüber, bilden aber keine stabile Paarung. Probiere einen anderen Baustein.");
        return false;
      }
      Z.placed[i] = b; Z.sel = null;
      render();
      if (Z.placed[i + 1]) reaktion(i, b);   // Phosphodiesterbindung zur Kette: Leuchten, Pyrophosphat und Wasser
      if (Z.placed.every(Boolean)) status(cfg.fertigtext);
      else status("Das passt! Schau dir die gestrichelten Linien zwischen den beiden Basen an.");
      return true;
    }

    /* ---------- Fragen ---------- */
    $("p-hb").addEventListener("click", () => {
      const a = $("n-at").value, g = $("n-gc").value, out = $("r-hb");
      if (a === "" || g === ""){ out.className = "rueck"; out.textContent = "Trage beide Zahlen ein."; return; }
      const okA = +a === 2, okG = +g === 3;
      out.className = "rueck" + (okA && okG ? " ok" : "");
      out.textContent = okA && okG ? "Richtig: " + cfg.paarAT + " hat 2, G–C hat 3 Wasserstoffbrücken. G–C-Paare halten also fester zusammen."
        : "Noch nicht ganz. Zähle die gestrichelten Linien zwischen den Basen eines gesetzten " + (okA ? "G–C" : okG ? cfg.paarAT : "Paars") + "-Paares noch einmal.";
    });
    $("p-gegen").addEventListener("click", () => {
      const eingabe = $("t-gegen").value.toUpperCase().replace(/[^A-Z]/g, ""), out = $("r-gegen");
      const komplement = Z.seq.map(b => KOMP[b]);
      const soll = komplement.slice().reverse().join(""), gleich = komplement.join("");
      if (!eingabe){ out.className = "rueck"; out.textContent = "Trage die Sequenz ein."; return; }
      out.className = "rueck" + (eingabe === soll ? " ok" : "");
      out.textContent = eingabe === soll ? "Richtig. Der neue Strang ist antiparallel zur Matrize: Von 5' nach 3' gelesen steht er in umgekehrter Reihenfolge."
        : eingabe === gleich ? "Die Basen stimmen, aber die Richtung nicht: Oben im Bild liegt beim neuen Strang das 3'-Ende. Lies von 5' nach 3'."
        : "Das stimmt noch nicht. Welche Base steht jeweils gegenüber? Beginne am 5'-Ende des neuen Strangs.";
    });
    $("neu").addEventListener("click", () => { neueSequenz(); V.schluessel = ""; render(); status(grundtext()); $("t-gegen").value = ""; $("r-gegen").textContent = ""; $("r-hb").textContent = ""; });
    $("leeren").addEventListener("click", () => { Z.placed = Array(ROWS).fill(null); if (cfg.primer) Z.placed[ROWS - 1] = KOMP[Z.seq[ROWS - 1]]; Z.sel = null; render(); status(grundtext()); });
    $("einfach").addEventListener("change", render);
    if (window.matchMedia) matchMedia("(prefers-color-scheme: dark)").addEventListener("change", render);

    /* ---------- Dein Molekül in 3D ---------- */
    const V = {laenge: "lang", farbe: "nukleotid", enden: true, furchen: false, masse: false, schnitt: 100, scheibe: true, viewer: null, schluessel: "", zmin: 0, zmax: 1};
    const GL = MOL3D.supported();
    const RAD3 = {C: 0.3, N: 0.3, O: 0.28, P: 0.4};
    const Rseite = MOL3D.rotX(-Math.PI / 2 + 0.2);
    const Rachse = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    const zahl = (x, n = 1) => x.toLocaleString("de-DE", {minimumFractionDigits: n, maximumFractionDigits: n});
    const RUECKEN_NAMEN = new Set(["P", "OP1", "OP2", "O5'"]);
    const helixForm = RNA ? "RNA" : "DNA";   // beim Hybrid (DNA-Matrize, RNA) liegt die A-Form vor

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
    function baue3D(){
      const eigen = Z.seq.length, seq = V.laenge === "lang" ? Z.seq.join("").repeat(3) : Z.seq.join("");
      const d = HELIX_BAU.bauen(seq, helixForm, {hybrid: RNA}), H = HELIX[helixForm];
      const atome = d.atome.map(a => ({
        p: a.pos, c: farbe3(a, a.bp >= eigen), r: RAD3[a.el] || 0.3,
        tip: (einfach() ? "" : a.name + " · ") + (a.strang === 1 ? "Matrize" : (RNA ? "RNA" : "neuer Strang")) + ", Basenpaar " + (a.bp + 1) + " (" + a.base + ")",
      }));
      const bindungen = d.bindungen.map(([i, j]) => ({a: i, b: j, r: 0.1}));
      let zmin = 1e9, zmax = -1e9;
      for (const a of atome){ zmin = Math.min(zmin, a.p[2]); zmax = Math.max(zmax, a.p[2]); }
      V.zmin = zmin - 0.5; V.zmax = zmax + 0.5; V.d = d; V.H = H;
      return {atome, bindungen};
    }
    function beschriftungen3D(){
      const d = V.d, H = V.H, id = d.index, at = (st, k, n) => d.atome[id[st + ":" + k + ":" + n]], n = d.n, L = [];
      const P = PALETTE.get;
      const tag = (pos, text, col, dx, dy) => { const h = P(col); L.push({p: pos, text, bg: h, border: h, color: lumi(h) > 0.55 ? "#111" : "#fff", dx: dx || 0, dy: dy || -20}); };
      if (V.enden){
        tag(at(1, 0, "P").pos, "5'", "p5", -16, -6); tag(at(1, n - 1, "O3'").pos, "3'", "oh3", -16, 8);
        tag(at(2, n - 1, "P").pos, "5'", "p5", 16, -6); tag(at(2, 0, "O3'").pos, "3'", "oh3", 16, 8);
      }
      const mitte = Math.floor(n / 2), schritt = n >= 10 ? 2 : 1, b0 = Math.max(0, mitte - 3 * schritt + (schritt === 1 ? 1 : 0)), kk = j => Math.min(n - 2, b0 + j * schritt), weiss = "rgba(255,255,255,.92)";
      if (V.furchen){
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
        const zk = k => at(1, k, "C1'").pos[2], ax = k => [0, 0, zk(k)];
        const k0 = kk(0), r0 = at(1, k0, "C1'").pos, r1 = at(1, k0 + 1, "C1'").pos;
        L.push({a: ax(k0), b: r0, linie: true, text: "", color: P("oh2")});
        L.push({a: ax(k0 + 1), b: r1, linie: true, text: zahl(H.drehung) + "° Drehung", color: P("oh2"), bg: weiss, dx: -64, dy: 6});
        const c1a = at(1, kk(1), "C1'").pos, c1b = at(2, kk(1), "C1'").pos;
        L.push({a: c1a, b: c1b, linie: true, text: zahl(Math.hypot(c1a[0] - c1b[0], c1a[1] - c1b[1], c1a[2] - c1b[2])) + " Å (C1'–C1')", color: P("p5"), bg: weiss, dy: -14});
        const pa = at(1, kk(2), "P").pos;
        const pb = d.atome.filter(a => a.name === "P" && a.strang === 2).reduce((best, a) => {
          const l = Math.hypot(a.pos[0] - pa[0], a.pos[1] - pa[1], a.pos[2] - pa[2]);
          return l > best.dist && Math.abs(a.pos[2] - pa[2]) < 4 ? {dist: l, pos: a.pos} : best;
        }, {dist: 0, pos: pa});
        L.push({a: pa, b: pb.pos, linie: true, text: "P–P " + zahl(pb.dist) + " Å", color: P("oh3"), bg: weiss, dy: 12});
        L.push({a: ax(kk(3)), b: ax(kk(3) + 1), linie: true, text: zahl(H.anstieg) + " Å Anstieg", color: P("schnitt"), bg: weiss, dx: 64});
      }
      return L;
    }
    function text3D(){
      const H = V.H, windung = 360 / H.drehung, ganghoehe = H.anstieg * windung, eig = einfach();
      const liste = !RNA ? [
        "<b>B-Form:</b> So liegt DNA in der Zelle meist vor. Die Helix ist schlank und lang gestreckt.",
        "Eine volle Windung dauert etwa " + zahl(windung, 0) + " Basenpaare (" + zahl(ganghoehe, 0) + " Å).",
        "Die große und die kleine Furche sind verschieden breit: In der großen Furche liegen die Basen für Proteine gut zugänglich.",
      ] : [
        "<b>DNA-RNA-Hybrid:</b> So liegt der neue RNA-Strang kurz an der DNA-Matrize an, solange die RNA-Polymerase ihn herstellt. Hybride haben eine A-ähnliche Form: gedrungener und dicker als die B-Form.",
        "Eine volle Windung dauert etwa " + zahl(windung, 0) + " Basenpaare (" + zahl(ganghoehe, 0) + " Å), jedes Basenpaar steigt nur " + zahl(H.anstieg) + " Å an.",
        "Die Basenpaare sind geneigt und liegen neben der Achse: In der Mitte entsteht ein Loch. Der RNA-Strang trägt 2'-OH-Gruppen, die DNA-Matrize nicht.",
      ];
      if (!eig) liste.push("Schnitt: Schiebe den Regler und wähle „Blick entlang der Achse“. Mit „Nur eine Scheibe“ siehst du ein einzelnes Basenpaar von oben, mit dem Rückgrat außen.");
      $("d3text").innerHTML = "<h3>" + (RNA ? "DNA-RNA-Hybrid (A-ähnliche Form)" : "DNA in der B-Form") + "</h3><ul>" + liste.map(x => "<li>" + x + "</li>").join("") + "</ul>";
    }
    function legende3(){
      const P = PALETTE.get, chip3 = (c, t) => '<span><i style="background:' + P(c) + '"></i>' + t + "</span>";
      $("legende3").innerHTML = V.farbe === "nukleotid"
        ? chip3("A", "Adenin") + chip3("G", "Guanin") + chip3("C", "Cytosin") + chip3("T", "Thymin") + (RNA ? chip3("U", "Uracil") : "") + chip3("p5", "Phosphat (5')") + chip3("oh3", "3'-O") + chip3("zucker", "Zucker")
        : "<span>Kohlenstoff, Stickstoff, Sauerstoff und Phosphor in den üblichen Elementfarben</span>";
    }
    function zeichne3D(neu){
      if (!V.viewer) return;
      V.viewer.setScene(baue3D(), {keepView: !neu});
      V.viewer.setLabels(beschriftungen3D());
      schnittAnwenden(); text3D(); legende3();
    }
    function schnittAnwenden(){
      const f = V.schnitt / 100;
      $("schnitt-o").textContent = V.schnitt >= 100 ? "kein Schnitt" : Math.round(f * 100) + " % der Länge";
      const d = V.zmin + (V.zmax - V.zmin) * f;
      V.viewer.setClip(V.schnitt >= 100 ? null : {n: [0, 0, 1], d, min: V.scheibe ? d - 5 : undefined});
    }
    function aktualisiere3D(){
      const fertig = Z.placed.every(Boolean);
      $("d3").hidden = !fertig; $("d3-leer").hidden = fertig;
      if (!fertig) return;
      if (!GL){ $("gl3").hidden = $("ov3").hidden = true; if (!$("gl3").parentNode.querySelector(".keingl")) $("gl3").parentNode.insertAdjacentHTML("beforeend", '<div class="keingl">Das 3D-Bild braucht WebGL, das in diesem Browser nicht verfügbar ist.</div>'); return; }
      const neu = !V.viewer;
      if (neu){ V.viewer = MOL3D.create($("gl3"), $("ov3"), {zoom: 1.2}); V.viewer.setRotation(Rseite, true); }
      const key = Z.seq.join("") + Z.placed.join("");
      if (neu || V.schluessel !== key){ V.schluessel = key; zeichne3D(true); }
    }
    function segment(id, schluessel, nach){
      $(id).addEventListener("click", e => {
        const bt = e.target.closest("button"); if (!bt) return;
        $(id).querySelectorAll("button").forEach(x => x.setAttribute("aria-checked", String(x === bt)));
        V[schluessel] = bt.dataset.wert; nach();
      });
    }
    segment("sg-laenge", "laenge", () => zeichne3D(true));
    segment("sg-farbe3", "farbe", () => zeichne3D(false));
    for (const [id, k] of [["b-enden", "enden"], ["b-furchen", "furchen"], ["b-masse", "masse"]]) $(id).addEventListener("change", e => { V[k] = e.target.checked; if (V.viewer) V.viewer.setLabels(beschriftungen3D()); });
    $("b-scheibe").addEventListener("change", e => { V.scheibe = e.target.checked; if (V.viewer) schnittAnwenden(); });
    $("schnitt").addEventListener("input", e => { V.schnitt = +e.target.value; if (V.viewer) schnittAnwenden(); });
    $("v-achse").addEventListener("click", () => V.viewer && V.viewer.animateTo(Rachse, 700));
    $("v-seite").addEventListener("click", () => V.viewer && V.viewer.animateTo(Rseite, 700));
    if (window.matchMedia) matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (V.viewer && !$("d3").hidden) zeichne3D(false); });

    neueSequenz(); render(); status(grundtext());
  }
  return {start};
})();
