// Basenpaarung und Synthese eines neuen Strangs, für basenpaarung.html (DNA → DNA) und
// transkription.html (DNA → RNA). Quelle: template/site/paarung.js, wird von build.py in die Seiten kopiert.
// Braucht PALETTE, HELIX, DNA2D, HELIX_BAU und MOL3D (aus den anderen Snippets) und das Markup der Seiten.
//
// Regeln der Übung:
//  - Die Vorlage steht immer links, der neue Strang rechts. Bei jeder neuen Sequenz wird das Bild zufällig senkrecht
//    gespiegelt: Die Vorlage hat dann ihr 5'-Ende oben oder unten; der neue Strang entsteht antiparallel (5' → 3').
//  - Das erste Nukleotid gehört an das Ende der Vorlage, an dem die Synthese beginnt; danach lässt sich ein Nukleotid
//    nur an das 3'-Ende der wachsenden Kette anfügen. Alles andere wird ohne Hinweis zurückgewiesen.
//  - Im Vorrat liegen die Nukleosidtriphosphate. Beim Anfügen reagiert das 3'-OH der Kette mit dem
//    α-Phosphat (Leuchten); Pyrophosphat und Wasser werden freigesetzt, bleiben einige Sekunden und verschwinden.
const PAARUNG = (() => {
  "use strict";

  function start(cfg){
    const $ = id => document.getElementById(id);
    const svg = $("leiter");
    const NS = "http://www.w3.org/2000/svg";
    const RNA = cfg.art === "rna";
    const ROWS = 8, PITCH = 3.4, XL = -3.714, XR = 3.714;
    const POOL_SKALA = 0.62, POOL_Y = [-2.9, -8.4, -13.9, -19.4], CHIP_X = 4.8, CHIP_Y = 2.0;
    const ZEIT = {glut: 1700, ppiStart: 500, ppiWeg: 2700, ppiAus: 5200, ende: 6200};
    const FORM_NEU = RNA ? "RNA" : "DNA", GEOM = RNA ? "RNA" : "DNA";
    const KOMP = RNA ? {A: "U", T: "A", G: "C", C: "G"} : {A: "T", T: "A", G: "C", C: "G"};
    const POOL_BASEN = RNA ? ["A", "C", "G", "U"] : ["A", "C", "G", "T"];
    const NAMEN = {A: "Adenin", C: "Cytosin", G: "Guanin", T: "Thymin", U: "Uracil"};
    // hoch3 = false: Vorlage mit 5'-Ende oben, der neue Strang wächst nach oben. hoch3 = true: Vorlage mit 3'-Ende oben, der neue Strang wächst nach unten.
    const Z = {seq: [], placed: [], sel: null, drag: null, hoch3: false, sep: 0, trennTimer: 0};
    const TRENN_DX = 6.2;   // so weit rückt die fertige RNA von der Vorlage weg
    const einfach = () => $("einfach").checked;
    const D3 = HELIX3D.create({einfach, namen: ["Vorlage", RNA ? "RNA" : "neuer Strang"], wiederholung: !RNA, zoom: 1.2});
    const yRow = i => -i * PITCH;
    const dim = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const tr = (x, y, s) => `translate(${x.toFixed(3)},${(-y).toFixed(3)})${s ? " scale(" + s + ")" : ""}`;
    const lumi = h => { const v = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
    const reduziert = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

    svg.innerHTML = '<defs><radialGradient id="glut"><stop offset="0" stop-color="#fff3b0" stop-opacity=".95"/><stop offset=".45" stop-color="#ffc400" stop-opacity=".55"/><stop offset="1" stop-color="#ff9100" stop-opacity="0"/></radialGradient></defs><g id="szene"></g><g id="fx" pointer-events="none"></g>';
    const szene = svg.querySelector("#szene"), fx = svg.querySelector("#fx");

    /* ---------- Zustand ---------- */
    const anzahl = () => Z.placed.filter(Boolean).length;
    const xV = () => XL, xN = () => XR;   // die Vorlage steht immer links
    const startZeile = () => Z.hoch3 ? 0 : ROWS - 1, richtung = () => Z.hoch3 ? 1 : -1;
    const naechste = () => { const n = anzahl(); return n >= ROWS ? -1 : startZeile() + richtung() * n; };   // Feld am 3'-Ende der Kette
    const ende3 = () => { const n = anzahl(); return n === 0 ? -1 : startZeile() + richtung() * (n - 1); };    // Zeile des 3'-Endes der Kette
    const wachstum = () => Array.from({length: ROWS}, (_, k) => startZeile() + richtung() * k);               // Reihenfolge, in der gebaut wird
    function neueSequenz(){
      const al = ["A", "C", "G", "T"];
      let seq;
      do { seq = Array.from({length: ROWS}, () => al[Math.floor(Math.random() * 4)]); }
      while (!seq.some(b => b === "G" || b === "C") || !seq.some(b => b === "A" || b === "T") || new Set(seq).size < 3);
      Z.seq = seq; Z.placed = Array(ROWS).fill(null); Z.sel = null; Z.hoch3 = Math.random() < 0.5;
    }
    const kachelV = i => DNA2D.kachel(Z.seq[i], "DNA", "l", {geometrie: GEOM, frei3: i === (Z.hoch3 ? 0 : ROWS - 1), flip: Z.hoch3});
    const kachelN = (b, opt) => DNA2D.kachel(b, FORM_NEU, "r", Object.assign({geometrie: GEOM, flip: Z.hoch3}, opt || {}));
    const brueckenV = (vT, vPos, nT, nPos) => DNA2D.bruecken(vT, vPos, nT, nPos);
    const chip = (b, x, y, k) => {   // Buchstabe der Base am Rand
      const c = PALETTE.get(b), l = lumi(c), r = (k || 1) * 0.46;
      return `<circle cx="${x}" cy="${-y}" r="${r.toFixed(3)}" fill="${c}" stroke="var(--surface)" stroke-width="0.08"/><text x="${x}" y="${-y}" text-anchor="middle" dominant-baseline="central" font-size="${((k || 1) * 0.6).toFixed(3)}" font-weight="800" fill="${l > 0.55 ? "#111" : "#fff"}">${b}</text>`;
    };
    // Verbindung O3' (cyan) – P (magenta) zwischen zwei Nukleotiden
    function verbinder(o3, p){
      const m = [(o3[0] + p[0]) / 2, (o3[1] + p[1]) / 2], c = PALETTE.get("oh3"), q = PALETTE.get("p5");
      const ln = (a, b, col) => `<line x1="${a[0].toFixed(3)}" y1="${(-a[1]).toFixed(3)}" x2="${b[0].toFixed(3)}" y2="${(-b[1]).toFixed(3)}" stroke="${col}" stroke-width="0.12" stroke-linecap="round"/>`;
      return ln(o3, m, c) + ln(m, p, q);
    }
    const bondLinien = (liste, klasse) => liste.map(q => `<line class="${klasse}" x1="${q.von[0].toFixed(3)}" y1="${(-q.von[1]).toFixed(3)}" x2="${q.nach[0].toFixed(3)}" y2="${(-q.nach[1]).toFixed(3)}" stroke="${PALETTE.get("hbruecke")}" stroke-width="0.11" stroke-dasharray="0.2 0.16" stroke-linecap="round"/>`).join("");

    /* ---------- Zeichnen ---------- */
    const kopfText = (x, y, txt, col) => `<text x="${x.toFixed(3)}" y="${(-y).toFixed(3)}" text-anchor="middle" font-size="0.9" font-weight="800" fill="${col}">${txt}</text>`;
    // Verbinder und Enden (5'/3') eines Strangs; tiles[i] gehört zu Zeile i, seite "l" oder "r", x = Ort der C1'-Atome
    function strang(tiles, abwaerts, x){   // abwaerts: 5'-Ende oben, 3'-Ende unten
      const P = PALETTE.get, vorhanden = tiles.map((t, i) => t ? i : -1).filter(i => i >= 0);
      let unten = "", marken = "";
      for (let i = 0; i < ROWS; i++){
        if (abwaerts && i > 0 && tiles[i] && tiles[i - 1])
          unten += verbinder([x + tiles[i - 1].atome["O3'"][0], yRow(i - 1) + tiles[i - 1].atome["O3'"][1]], [x + tiles[i].atome["P"][0], yRow(i) + tiles[i].atome["P"][1]]);
        if (!abwaerts && i < ROWS - 1 && tiles[i] && tiles[i + 1])
          unten += verbinder([x + tiles[i + 1].atome["O3'"][0], yRow(i + 1) + tiles[i + 1].atome["O3'"][1]], [x + tiles[i].atome["P"][0], yRow(i) + tiles[i].atome["P"][1]]);
      }
      if (!vorhanden.length) return {unten, marken};
      const oben = vorhanden[0], tief = vorhanden[vorhanden.length - 1];
      if (abwaerts){
        if (oben === 0) marken += kopfText(x + tiles[0].atome["P"][0] - 0.2, yRow(0) + tiles[0].atome["P"][1] + 1.0, "5'", P("p5"));
        marken += kopfText(x + tiles[tief].atome["O3'"][0] + 0.1, yRow(tief) + tiles[tief].atome["O3'"][1] - 1.15, "3'", P("oh3"));
      } else {
        marken += kopfText(x + tiles[oben].atome["O3'"][0] + 0.2, yRow(oben) + tiles[oben].atome["O3'"][1] + 0.85, "3'", P("oh3"));
        if (tief === ROWS - 1) marken += kopfText(x + tiles[tief].atome["P"][0] + 0.1, yRow(tief) + tiles[tief].atome["P"][1] - 1.25, "5'", P("p5"));
      }
      return {unten, marken};
    }
    const slotRahmen = () => `<rect class="rahmen" x="-3.9" y="${Z.hoch3 ? -0.3 : -3.2}" width="7.0" height="3.5" rx="0.5"/>`;
    const poolRahmen = () => `<rect class="rahmen" x="-4.4" y="${Z.hoch3 ? -4.4 : -3.7}" width="11.2" height="8.1" rx="0.6"/>`;
    const poolX = () => 15.8;

    function render(){
      const P = PALETTE.get, ende = ende3(), fertig = Z.placed.every(Boolean);
      const V_ = Z.seq.map((b, i) => kachelV(i));
      const N_ = Z.placed.map((b, i) => b ? kachelN(b, {frei3: i === ende, tri: i === startZeile()}) : null);   // das erste Nukleotid behält sein Triphosphat
      const xv = xV(), xn = xN();
      let tV = "", tN = "", hb = "", tP = "";
      const kopfY = Z.hoch3 ? 6.6 : 4.6;   // Überschriften: bei gespiegeltem Bild höher, weil oben das 5'-Ende des neuen Strangs mit Triphosphat sitzt
      tV += `<text x="${xv}" y="${-(yRow(0) + kopfY)}" text-anchor="middle" font-size="0.8" font-weight="700" fill="currentColor">Vorlage (DNA)</text>`;
      tN += `<text x="${xn}" y="${-(yRow(0) + kopfY)}" text-anchor="middle" font-size="0.8" font-weight="700" fill="currentColor">${RNA ? "neue RNA" : "neuer Strang"}</text>`;
      const chipX = x => x + (x < 0 ? -CHIP_X : CHIP_X), chipY = CHIP_Y * (Z.hoch3 ? -1 : 1);
      for (let i = 0; i < ROWS; i++){
        const y = yRow(i);
        tV += `<g transform="${tr(xv, y)}">${V_[i].svg}</g>` + chip(Z.seq[i], chipX(xv), y + chipY);
        const R = N_[i];
        if (R){
          const entfernbar = i === ende && Z.sep === 0;
          tN += `<g class="gesetzt${entfernbar ? " entfernbar" : ""}" data-zeile="${i}" ${entfernbar ? 'tabindex="0" role="button" aria-label="Zeile ' + (i + 1) + ': ' + NAMEN[Z.placed[i]] + ' gesetzt. Eingabetaste entfernt es wieder."' : 'role="img" aria-label="Zeile ' + (i + 1) + ': ' + NAMEN[Z.placed[i]] + ' gesetzt"'} transform="${tr(xn, y)}">${R.svg}</g>` + chip(Z.placed[i], chipX(xn), y + chipY);
          hb += bondLinien(brueckenV(V_[i], [xv, y], R, [xn, y]).liste, "hb");
        } else {
          tN += `<g class="platz" data-zeile="${i}" tabindex="0" role="button" aria-label="Leeres Feld in Zeile ${i + 1}, Partner für ${NAMEN[Z.seq[i]]}. Ein ausgewähltes Nukleotid mit der Eingabetaste hier einsetzen." transform="${tr(xn, y)}">${slotRahmen()}</g>`;
        }
      }
      const sv = strang(V_, !Z.hoch3, xv), sn = strang(N_, Z.hoch3, xn);   // Vorlage läuft abwärts, wenn ihr 5'-Ende oben liegt
      if (!fertig){   // Vorrat: Nukleosidtriphosphate (verschwindet, wenn der Strang fertig ist)
        const px = poolX();
        tP += `<text x="${px + 0.6}" y="${-(yRow(0) + kopfY)}" text-anchor="middle" font-size="0.8" font-weight="700" fill="currentColor">Vorrat (${RNA ? "NTPs" : "dNTPs"})</text>`;
        POOL_BASEN.forEach((b, k) => {
          const R = kachelN(b, {frei3: true, tri: true});
          tP += `<g class="vorrat" data-base="${b}" tabindex="0" role="button" aria-pressed="${Z.sel === b}" aria-label="${RNA ? "Ribonukleosidtriphosphat" : "Desoxyribonukleosidtriphosphat"} mit ${NAMEN[b]} (${b}). Ziehen oder mit der Eingabetaste auswählen." transform="${tr(px, POOL_Y[k], POOL_SKALA)}">${poolRahmen()}${R.svg}</g>` + chip(b, px - 3.5, POOL_Y[k], 0.85);
        });
      }
      const x0 = -10.6, x1 = fertig ? 11.2 + (cfg.trennen ? TRENN_DX : 0) : poolX() + 6.0;
      svg.setAttribute("viewBox", `${x0} ${(-(kopfY + 1.2)).toFixed(1)} ${(x1 - x0).toFixed(1)} ${(kopfY + 1.2 + (ROWS - 1) * PITCH + 5.4).toFixed(1)}`);
      const dx = (Z.sep * TRENN_DX).toFixed(3);
      szene.innerHTML = `<g id="vstrang">${sv.unten}${tV}${sv.marken}</g><g id="nstrang" transform="translate(${dx},0)">${sn.unten}${tN}${sn.marken}</g><g id="hbgrp" opacity="${(1 - Z.sep).toFixed(3)}">${hb}</g>${tP}`;
      if (Z.sep) fx.setAttribute("transform", `translate(${dx},0)`); else fx.removeAttribute("transform");
      // Ereignisse
      szene.querySelectorAll(".vorrat").forEach(g => {
        g.addEventListener("pointerdown", e => starteZiehen(e, g));
        g.addEventListener("keydown", e => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault(); Z.sel = Z.sel === g.dataset.base ? null : g.dataset.base; render();
          const n = szene.querySelector(`.vorrat[data-base="${g.dataset.base}"]`); if (n) n.focus();
          if (Z.sel) status(einfach() ? "Wähle jetzt ein leeres Feld aus." : "Ausgewählt: " + NAMEN[Z.sel] + ". Wähle mit Tab ein leeres Feld und drücke die Eingabetaste.");
        });
      });
      szene.querySelectorAll(".platz").forEach(g => {
        g.addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && Z.sel){ e.preventDefault(); setze(+g.dataset.zeile, Z.sel); } });
        g.addEventListener("click", () => { if (Z.sel) setze(+g.dataset.zeile, Z.sel); });
      });
      szene.querySelectorAll(".gesetzt.entfernbar").forEach(g => {
        const weg = () => { trennReset(); Z.placed[+g.dataset.zeile] = null; render(); status("Das Feld ist wieder frei."); };
        g.addEventListener("click", weg);
        g.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " "){ e.preventDefault(); weg(); } });
      });
      $("z-richtung").hidden = einfach();
      $("r-gegen").hidden = einfach();
      aktualisiere3D();
    }
    // Die fertige RNA löst sich von der Vorlage (nur bei der Transkription)
    function trennReset(){ clearTimeout(Z.trennTimer); Z.trennTimer = 0; Z.sep = 0; fx.removeAttribute("transform"); }
    function trenne(){
      Z.trennTimer = 0;
      if (!cfg.trennen || !Z.placed.every(Boolean)) return;
      status(cfg.getrenntext);
      const t0 = performance.now(), dauer = reduziert() ? 1 : 1700;
      const f = now => {
        if (!Z.placed.every(Boolean)) return;
        const k = Math.min(1, (now - t0) / dauer), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        Z.sep = e;
        const n = szene.querySelector("#nstrang"), h = szene.querySelector("#hbgrp"), tx = `translate(${(e * TRENN_DX).toFixed(3)},0)`;
        if (n) n.setAttribute("transform", tx);
        if (h) h.setAttribute("opacity", (1 - e).toFixed(3));
        fx.setAttribute("transform", tx);
        if (k < 1) requestAnimationFrame(f);
      };
      requestAnimationFrame(f);
    }
    function status(txt){ $("status2").innerHTML = txt; }
    const grundtext = () => cfg.grundtext;

    /* ---------- Effekte: Leuchten, Pyrophosphat und Wasser ---------- */
    function el(name, attrs){ const e = document.createElementNS(NS, name); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; }
    function reaktion(i, b){
      // 3'-OH der Kette (Zeile davor, in Wachstumsrichtung) und α-Phosphat des neuen Nukleotids (Zeile i) reagieren
      const vor = i - richtung(), xn = xN(), sg = 1;
      const Ku = kachelN(Z.placed[vor], {}), Kn = kachelN(b, {tri: true}), P = PALETTE.get;
      const o3 = [xn + Ku.atome["O3'"][0], yRow(vor) + Ku.atome["O3'"][1]], pa = [xn + Kn.atome["P"][0], yRow(i) + Kn.atome["P"][1]];
      const J = [(o3[0] + pa[0]) / 2, (o3[1] + pa[1]) / 2];
      const abs = n => [xn + Kn.atome[n][0], yRow(i) + Kn.atome[n][1]];
      const pb = abs("PB"), pg = abs("PG"), ob = abs("O3B"), o3a = abs("O3A");
      const g = el("g", {}); fx.appendChild(g);
      const glow = [0, 1].map(() => { const c = el("circle", {cx: J[0], cy: -J[1], r: 0.1, fill: "url(#glut)", opacity: 0}); g.appendChild(c); return c; });
      const ppi = el("g", {opacity: 0}); g.appendChild(ppi);
      const ln = (a, c) => ppi.appendChild(el("line", {x1: a[0] - pb[0], y1: -(a[1] - pb[1]), x2: c[0] - pb[0], y2: -(c[1] - pb[1]), stroke: P("p5"), "stroke-width": 0.09, "stroke-linecap": "round"}));
      ln(pb, ob); ln(ob, pg);
      for (const q of [pb, pg]){
        ppi.appendChild(el("circle", {cx: q[0] - pb[0], cy: -(q[1] - pb[1]), r: 0.36, fill: P("p5")}));
        const tx = el("text", {x: q[0] - pb[0], y: -(q[1] - pb[1]), "text-anchor": "middle", "dominant-baseline": "central", "font-size": 0.46, "font-weight": 800, fill: "#fff"}); tx.textContent = "P"; ppi.appendChild(tx);
      }
      ppi.appendChild(el("circle", {cx: ob[0] - pb[0], cy: -(ob[1] - pb[1]), r: 0.13, fill: P("p5")}));
      const mid = [(o3a[0] + pa[0]) / 2, (o3a[1] + pa[1]) / 2];
      const marke = el("polyline", {points: [[-0.2, 0.14], [0, -0.14], [0.2, 0.14]].map(q => (mid[0] + q[0]).toFixed(2) + "," + (-mid[1] + q[1]).toFixed(2)).join(" "), fill: "none", stroke: P("schnitt"), "stroke-width": 0.12, "stroke-linecap": "round", "stroke-linejoin": "round", opacity: 0});
      g.appendChild(marke);
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
        ppi.setAttribute("transform", `translate(${(pb[0] + sg * 2.6 * w).toFixed(3)},${(-pb[1]).toFixed(3)})`);
        ppi.setAttribute("opacity", sicht.toFixed(3));
        wasser.setAttribute("x", (J[0] + sg * 2.2 * w).toFixed(3)); wasser.setAttribute("y", (-J[1] + (Z.hoch3 ? -1.3 : 1.3) * w).toFixed(3));
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
      const b = g.dataset.base, k = POOL_BASEN.indexOf(b), p = svgPunkt(e), R = kachelN(b, {frei3: true, tri: true});
      const elm = el("g", {class: "zieh", "pointer-events": "none", opacity: 0.93});
      elm.innerHTML = R.svg;
      const live = el("g", {});
      svg.appendChild(live); svg.appendChild(elm);
      const off = [R.mitte[0], R.mitte[1]], pos = [p[0] - off[0], p[1] - off[1]];
      Z.drag = {b, R, el: elm, live, off, pos, zeile: -1, id: e.pointerId, ursprung: [poolX(), POOL_Y[k]]};
      elm.setAttribute("transform", tr(pos[0], pos[1]));
      svg.setPointerCapture(e.pointerId);
      status("Bewege den Baustein zu einer Base der Vorlage.");
    }
    svg.addEventListener("pointermove", e => {
      const d = Z.drag; if (!d || e.pointerId !== d.id) return;
      const p = svgPunkt(e), pos = [p[0] - d.off[0], p[1] - d.off[1]], xn = xN(), xv = xV();
      let best = -1, bd = 1e9;
      for (let i = 0; i < ROWS; i++) if (!Z.placed[i]){ const q = dim(pos, [xn, yRow(i)]); if (q < bd){ bd = q; best = i; } }
      d.zeile = bd < 5 ? best : -1;
      if (d.zeile >= 0 && bd < 1.5){ pos[0] = xn; pos[1] = yRow(d.zeile); }   // magnetisch einrasten
      d.pos = pos; d.el.setAttribute("transform", tr(pos[0], pos[1]));
      szene.querySelectorAll(".platz").forEach(g => g.classList.toggle("nah", +g.dataset.zeile === d.zeile));
      if (d.zeile >= 0){
        const r = brueckenV(kachelV(d.zeile), [xv, yRow(d.zeile)], d.R, pos);
        d.live.innerHTML = bondLinien(r.liste, "live");
      } else d.live.innerHTML = "";
    });
    function beendeZiehen(e){
      const d = Z.drag; if (!d || e.pointerId !== d.id) return;
      Z.drag = null;
      d.live.remove();
      szene.querySelectorAll(".platz").forEach(g => g.classList.remove("nah"));
      const ziel = d.zeile >= 0 && dim(d.pos, [xN(), yRow(d.zeile)]) < 2.0;
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
      const L = kachelV(i), R = kachelN(b), r = brueckenV(L, [xV(), yRow(i)], R, [xN(), yRow(i)]);
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
      if (anzahl() > 1) reaktion(i, b);   // Phosphodiesterbindung zur Kette: Leuchten, Pyrophosphat und Wasser
      if (Z.placed.every(Boolean)){ status(cfg.fertigtext); if (cfg.trennen) Z.trennTimer = setTimeout(trenne, 2600); }
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
      const soll = wachstum().map(i => KOMP[Z.seq[i]]).join(""), gleich = soll.split("").reverse().join("");   // soll: in der Reihenfolge, in der gebaut wird (5' → 3')
      if (!eingabe){ out.className = "rueck"; out.textContent = "Trage die Sequenz ein."; return; }
      out.className = "rueck" + (eingabe === soll ? " ok" : "");
      out.textContent = eingabe === soll ? "Richtig. Der neue Strang ist antiparallel zur Vorlage: Er wird von 5' nach 3' gelesen, die Vorlage von 3' nach 5'."
        : eingabe === gleich ? "Die Basen stimmen, aber die Richtung nicht. Lies den neuen Strang von seinem 5'-Ende zu seinem 3'-Ende."
        : "Das stimmt noch nicht. Welche Base steht jeweils gegenüber? Beginne am 5'-Ende des neuen Strangs.";
    });
    $("neu").addEventListener("click", () => { trennReset(); neueSequenz(); render(); status(grundtext()); $("t-gegen").value = ""; $("r-gegen").textContent = ""; $("r-hb").textContent = ""; });
    $("leeren").addEventListener("click", () => { trennReset(); Z.placed = Array(ROWS).fill(null); Z.sel = null; render(); status(grundtext()); });
    $("einfach").addEventListener("change", render);
    if (window.matchMedia) matchMedia("(prefers-color-scheme: dark)").addEventListener("change", render);

    /* ---------- Dein Molekül in 3D (erscheint neben der Zeichnung, sobald der Strang fertig ist) ---------- */
    function aktualisiere3D(){
      const fertig = Z.placed.every(Boolean);
      $("arbeit").classList.toggle("fertig", fertig); $("d3").hidden = !fertig;
      if (!fertig) return;
      const v53 = (Z.hoch3 ? Z.seq.slice().reverse() : Z.seq).join("");   // Vorlage von 5' nach 3' gelesen
      D3.zeige(v53, RNA ? "RNA1" : "DNA", Z.seq.length);   // bei der Transkription nur die RNA, nicht das Hybrid
    }

    neueSequenz(); render(); status(grundtext());
  }
  return {start};
})();
