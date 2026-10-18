// Strukturformeln als SVG (Quelle: template/site/dna2d.js, von build.py in die Seiten kopiert).
// Braucht HELIX aus nuc-data.js und PALETTE aus palette.js.
//
// Die Basen werden nicht von Hand gezeichnet, sondern aus den Koordinaten der Helix-Vorlagen
// in die Ebene des Basenpaares projiziert: waagerecht die lange Achse des Paares, senkrecht die
// Dyade (Base oben, Zucker unten, Watson-Crick-Kante rechts). So stimmen Zeichnung und 3D überein,
// und die Wasserstoffbrücken-Partner liegen genau gegenüber.
const DNA2D = (() => {
  "use strict";
  const SK = 1.4;                           // Å pro Zeicheneinheit (Bindungslänge ≈ 1)
  const rad = d => d * Math.PI / 180;
  const dir = (x, y, len, deg) => [x + len * Math.cos(rad(deg)), y + len * Math.sin(rad(deg))];

  const BASE_ATOME = {
    A: ["N1", "C2", "N3", "C4", "C5", "C6", "N6", "N7", "C8", "N9"],
    G: ["N1", "C2", "N3", "C4", "C5", "C6", "O6", "N2", "N7", "C8", "N9"],
    C: ["N1", "C2", "O2", "N3", "C4", "N4", "C5", "C6"],
    T: ["N1", "C2", "O2", "N3", "C4", "O4", "C5", "C7", "C6"],
    U: ["N1", "C2", "O2", "N3", "C4", "O4", "C5", "C6"],
  };
  // Doppelbindungen (Kekulé-Formel)
  const DOPPELT = {
    A: [["C6", "N1"], ["C2", "N3"], ["C4", "C5"], ["N7", "C8"]],
    G: [["C2", "N3"], ["C4", "C5"], ["N7", "C8"], ["C6", "O6"]],
    C: [["C2", "O2"], ["N3", "C4"], ["C5", "C6"]],
    T: [["C2", "O2"], ["C4", "O4"], ["C5", "C6"]],
    U: [["C2", "O2"], ["C4", "O4"], ["C5", "C6"]],
  };
  const BESCHRIFTUNG = {   // Atomname → Text; Ring-C bleibt unbeschriftet
    A: {N1: "N", N3: "N", N6: "NH2", N7: "N", N9: "N"},
    G: {N1: "NH", N3: "N", N2: "NH2", O6: "O", N7: "N", N9: "N"},
    C: {N1: "N", N3: "N", N4: "NH2", O2: "O"},
    T: {N1: "N", N3: "NH", O2: "O", O4: "O", C7: "CH3"},
    U: {N1: "N", N3: "NH", O2: "O", O4: "O"},
  };
  const GLYKO = {A: "N9", G: "N9", C: "N1", T: "N1", U: "N1"};
  const form = (b, art) => art === "dNTP" ? "DNA" : "RNA";

  // Rohe Projektion in die Basenpaar-Ebene (Å): u waagerecht (Strang 1 links), v senkrecht (Base oben)
  function plan(b, f){
    const vorl = HELIX[f].vorlage[b], erlaubt = new Set(BASE_ATOME[b].concat(["C1'"])), pos = {};
    for (const [n, , x, y] of vorl.atome) if (erlaubt.has(n)) pos[n] = [y, -x];
    const bind = [];
    for (const [i, j] of vorl.bindungen){
      const a = vorl.atome[i][0], c = vorl.atome[j][0];
      if (erlaubt.has(a) && erlaubt.has(c)) bind.push([a, c]);
    }
    return {pos, bind};
  }

  // NH2 → NH₂ (Ziffer tiefgestellt), O⁻ (Minus hochgestellt)
  const fmt = t => t.replace(/(\d)$/, '<tspan dy="0.12" font-size="0.36">$1</tspan>').replace("⁻", '<tspan dy="-0.2" font-size="0.36">−</tspan>');

  // Zeichnung eines Nukleosidtriphosphats. art: "dNTP" | "NTP"; opt.hervor: Menge aus "c2", "c5", "schnitt"
  // (werden farbig hervorgehoben); 5'-Phosphat und 3'-OH sind immer farbig.
  function nukleotid(b, art, opt){
    opt = opt || {};
    const hv = opt.hervor || new Set(), f = form(b, art), P = PALETTE.get;
    const ink = "currentColor", pl = plan(b, f);
    const A = {};                          // Atomname → [x, y] (y nach oben)
    const beta = Math.atan2(pl.pos[GLYKO[b]][1] - pl.pos["C1'"][1], pl.pos[GLYKO[b]][0] - pl.pos["C1'"][0]) * 180 / Math.PI;   // Richtung C1'→N
    const R = 0.8507;                      // Umkreisradius des regelmäßigen Fünfecks mit Seitenlänge 1
    const c1 = dir(0, 0, 0, 0);            // C1' im Ursprung
    const ctr = dir(c1[0], c1[1], -R, beta);
    A["C1'"] = c1;
    A["C2'"] = dir(ctr[0], ctr[1], R, beta - 72);
    A["C3'"] = dir(ctr[0], ctr[1], R, beta - 144);
    A["C4'"] = dir(ctr[0], ctr[1], R, beta + 144);
    A["O4'"] = dir(ctr[0], ctr[1], R, beta + 72);
    A["X2"] = dir(A["C2'"][0], A["C2'"][1], 1, beta - 72);        // Substituent an C2': H oder OH
    A["O3'"] = dir(A["C3'"][0], A["C3'"][1], 1, beta - 144);
    A["C5'"] = dir(A["C4'"][0], A["C4'"][1], 1, beta + 144);
    // Basis
    for (const n of BASE_ATOME[b]) A[n] = [c1[0] + pl.pos[n][0] / SK - pl.pos["C1'"][0] / SK, c1[1] + pl.pos[n][1] / SK - pl.pos["C1'"][1] / SK];
    // Kette: C5' – O5' – Pα – O – Pβ – O – Pγ, abwechselnd nach links oben (150°) und links unten (210°)
    const kette = ["O5'", "PA", "O3A", "PB", "O3B", "PG"];
    let prev = A["C5'"];
    kette.forEach((n, i) => { A[n] = dir(prev[0], prev[1], 1, i % 2 === 0 ? 150 : 210); prev = A[n]; });
    for (const [p, o1, o2] of [["PA", "O1A", "O2A"], ["PB", "O1B", "O2B"]]){
      A[o1] = dir(A[p][0], A[p][1], 1, 270); A[o2] = dir(A[p][0], A[p][1], 1, 90);
    }
    A["O1G"] = dir(A["PG"][0], A["PG"][1], 1, 270); A["O2G"] = dir(A["PG"][0], A["PG"][1], 1, 90); A["O3G"] = dir(A["PG"][0], A["PG"][1], 1, 150);

    const farbe = {base: P(b), p5: P("p5"), oh3: P("oh3"), oh2: P("oh2"), schnitt: P("schnitt")};
    const S = [], T = [], H = [], Z = [];   // S: Linien, T: Beschriftungen, H: Treffer, Z: Hintergrund
    const line = (a, c, col, w, extra) => S.push(`<line x1="${a[0].toFixed(3)}" y1="${(-a[1]).toFixed(3)}" x2="${c[0].toFixed(3)}" y2="${(-c[1]).toFixed(3)}" stroke="${col}" stroke-width="${w || 0.07}" stroke-linecap="round"${extra || ""}/>`);
    const kurz = (a, c, ta, tc) => {       // Bindung an beschrifteten Atomen kürzen
      const dx = c[0] - a[0], dy = c[1] - a[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
      return [[a[0] + (ta ? 0.3 : 0) * ux, a[1] + (ta ? 0.3 : 0) * uy], [c[0] - (tc ? 0.3 : 0) * ux, c[1] - (tc ? 0.3 : 0) * uy]];
    };
    const doppel = (a, c, ring, col) => {  // zweite Linie, bei Ringbindungen nach innen
      const dx = c[0] - a[0], dy = c[1] - a[1], L = Math.hypot(dx, dy);
      let nx = -dy / L, ny = dx / L;
      if (ring){
        const m = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2];
        if (nx * (ring[0] - m[0]) + ny * (ring[1] - m[1]) < 0){ nx = -nx; ny = -ny; }
        return [[a[0] + nx * 0.17 + dx * 0.12, a[1] + ny * 0.17 + dy * 0.12], [c[0] + nx * 0.17 - dx * 0.12, c[1] + ny * 0.17 - dy * 0.12]];
      }
      return [[a[0] + nx * 0.07, a[1] + ny * 0.07], [c[0] + nx * 0.07, c[1] + ny * 0.07]];
    };
    const label = (n, text, col, extra) => {   // erster Buchstabe sitzt auf dem Atom, Hintergrund passt sich dem Text an
      const [x, y] = A[n], w = 0.34 * text.replace(/[\d⁻]/g, "").length + (/[\d⁻]/.test(text) ? 0.2 : 0) + 0.12;
      Z.push(`<rect x="${(x - 0.28).toFixed(3)}" y="${(-y - 0.3).toFixed(3)}" width="${w.toFixed(3)}" height="0.6" rx="0.22" fill="var(--surface)"/>`);
      T.push(`<text x="${(x - 0.17).toFixed(3)}" y="${(-y).toFixed(3)}" text-anchor="start" dominant-baseline="central" font-size="0.5" font-weight="600" fill="${col}"${extra || ""}>${fmt(text)}</text>`);
    };

    const sechser = ["N1", "C2", "N3", "C4", "C5", "C6"].map(m => A[m]);
    const mitte = [sechser.reduce((s, p) => s + p[0], 0) / 6, sechser.reduce((s, p) => s + p[1], 0) / 6];
    const BL = BESCHRIFTUNG[b], istDoppelt = (a, c) => DOPPELT[b].some(([x, y]) => (x === a && y === c) || (x === c && y === a));
    const imRing = new Set(["N1", "C2", "N3", "C4", "C5", "C6", "N7", "C8", "N9"]);
    for (const [a, c] of pl.bind){
      if (a === "C1'" || c === "C1'"){ line(A["C1'"], A[GLYKO[b]], P("zucker"), 0.08); continue; }
      const [p, q] = kurz(A[a], A[c], BL[a], BL[c]);
      line(p, q, farbe.base, 0.09);
      if (istDoppelt(a, c)){
        const fuenf = ["C4", "C5", "N7", "C8", "N9"];
        const ringBindung = imRing.has(a) && imRing.has(c);
        const zentrum = ringBindung && fuenf.includes(a) && fuenf.includes(c) && !(["C4", "C5"].includes(a) && ["C4", "C5"].includes(c)) ? [(A["C4"][0] + A["C5"][0] + A["N7"][0] + A["C8"][0] + A["N9"][0]) / 5, (A["C4"][1] + A["C5"][1] + A["N7"][1] + A["C8"][1] + A["N9"][1]) / 5] : mitte;
        const [p2, q2] = doppel(p, q, ringBindung ? zentrum : null);
        line(p2, q2, farbe.base, 0.09);
      }
    }
    for (const n of BASE_ATOME[b]) if (BL[n]) label(n, BL[n], ink);
    // Zucker
    const zucker = [["C1'", "C2'"], ["C2'", "C3'"], ["C3'", "C4'"], ["C4'", "O4'"], ["O4'", "C1'"]];
    const bei = ["O4'"];
    for (const [a, c] of zucker){ const [p, q] = kurz(A[a], A[c], bei.includes(a), bei.includes(c)); line(p, q, P("zucker"), 0.08); }
    label("O4'", "O", ink);
    // 2'-Position
    const c2farbe = hv.has("c2") ? farbe.oh2 : ink;
    const c2text = art === "NTP" ? "OH" : "H";
    { const [p, q] = kurz(A["C2'"], A["X2"], false, true); line(p, q, hv.has("c2") ? farbe.oh2 : P("zucker"), 0.09); label("X2", c2text, c2farbe, ' font-weight="700"'); }
    // 3'-OH (immer farbig)
    { const [p, q] = kurz(A["C3'"], A["O3'"], false, true); line(p, q, farbe.oh3, 0.09); label("O3'", "OH", farbe.oh3, ' font-weight="700"'); }
    // 5'-Seite: C5' neutral, ab O5' Triphosphat farbig (5'-Phosphat)
    { const [p, q] = kurz(A["C4'"], A["C5'"], false, false); line(p, q, P("zucker"), 0.08); }
    const folge = [["C5'", "O5'"], ["O5'", "PA"], ["PA", "O3A"], ["O3A", "PB"], ["PB", "O3B"], ["O3B", "PG"]];
    for (const [a, c] of folge){
      const la = /^[OP]/.test(a), lc = /^[OP]/.test(c), [p, q] = kurz(A[a], A[c], la, lc);
      line(p, q, a === "C5'" ? P("zucker") : farbe.p5, a === "C5'" ? 0.08 : 0.07);
    }
    for (const [p, dp, o] of [["PA", true, "O1A"], ["PB", true, "O1B"], ["PG", true, "O1G"]]){
      const [x, y] = kurz(A[p], A[o], true, true);
      line(x, y, farbe.p5, 0.07);
      const dx = y[0] - x[0], dy = y[1] - x[1], L = Math.hypot(dx, dy);
      line([x[0] - dy / L * 0.09, x[1] + dx / L * 0.09], [y[0] - dy / L * 0.09, y[1] + dx / L * 0.09], farbe.p5, 0.07);
    }
    for (const [p, o] of [["PA", "O2A"], ["PB", "O2B"], ["PG", "O2G"], ["PG", "O3G"]]){ const [x, y] = kurz(A[p], A[o], true, true); line(x, y, farbe.p5, 0.07); }
    for (const n of ["PA", "PB", "PG"]) label(n, "P", farbe.p5, ' font-weight="800"');
    for (const n of ["O5'", "O3A", "O3B", "O1A", "O1B", "O1G"]) label(n, "O", farbe.p5);
    for (const n of ["O2A", "O2B", "O2G", "O3G"]) label(n, "O⁻", farbe.p5);
    if (opt.nummern){   // Kohlenstoffatome des Zuckers nummerieren (1' bis 5')
      const num = (n, x, y) => T.push(`<text x="${x.toFixed(3)}" y="${(-y).toFixed(3)}" text-anchor="middle" dominant-baseline="central" font-size="0.34" fill="var(--muted)">${n}'</text>`);
      ["C1'", "C2'", "C3'", "C4'"].forEach((n, i) => {
        const q = A[n], dx = ctr[0] - q[0], dy = ctr[1] - q[1], L = Math.hypot(dx, dy);
        num(i + 1, q[0] + dx / L * 0.36, q[1] + dy / L * 0.36);
      });
      num(5, A["C5'"][0], A["C5'"][1] - 0.42);
    }
    // Spaltstelle
    if (hv.has("schnitt")){
      const a = A["PA"], c = A["O3A"], m = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2], dx = c[0] - a[0], dy = c[1] - a[1], L = Math.hypot(dx, dy);
      const nx = -dy / L, ny = dx / L, bx = dx / L, by = dy / L;
      const pts = [[-0.5, 0], [-0.17, 0.2], [0.17, -0.2], [0.5, 0]].map(([s, t]) => [m[0] + nx * s + bx * t * 0.7, m[1] + ny * s + by * t * 0.7]);
      S.push(`<polyline points="${pts.map(q => q[0].toFixed(3) + "," + (-q[1]).toFixed(3)).join(" ")}" fill="none" stroke="${farbe.schnitt}" stroke-width="0.14" stroke-linecap="round" stroke-linejoin="round"/>`);
    }
    // 5-Position: Methyl (T) bzw. H (U) hervorheben
    if (hv.has("c5") && (b === "T" || b === "U")){
      const q = b === "T" ? A["C7"] : A["C5"];
      Z.push(`<circle cx="${(b === "T" ? q[0] : q[0] - 0.0).toFixed(3)}" cy="${(-q[1]).toFixed(3)}" r="0.62" fill="none" stroke="${farbe.oh2}" stroke-width="0.1" stroke-dasharray="0.2 0.16"/>`);
    }
    if (hv.has("c2")){
      const q = A["X2"];
      Z.push(`<circle cx="${q[0].toFixed(3)}" cy="${(-q[1]).toFixed(3)}" r="0.55" fill="none" stroke="${farbe.oh2}" stroke-width="0.1" stroke-dasharray="0.2 0.16"/>`);
    }
    // Trefferflächen (unsichtbar) zum Anklicken
    const treffer = (region, pts, r) => pts.forEach(p => H.push(`<circle class="treffer" data-region="${region}" cx="${p[0].toFixed(3)}" cy="${(-p[1]).toFixed(3)}" r="${r}" fill="transparent"/>`));
    treffer("base", BASE_ATOME[b].filter(n => !(b === "T" && n === "C7") && !(n === "C5")).map(n => A[n]), 0.55);
    treffer("c5", [b === "T" ? A["C7"] : A["C5"]], 0.6);
    treffer("c2", [A["X2"]], 0.7);
    treffer("oh3", [A["O3'"]], 0.7);
    treffer("zucker", [A["C1'"], A["C2'"], A["C3'"], A["C4'"], A["O4'"], A["C5'"]], 0.5);
    treffer("tri", ["O5'", "PA", "O3A", "PB", "O3B", "PG", "O1A", "O1B", "O1G", "O2A", "O2B", "O2G", "O3G"].map(n => A[n]), 0.55);

    const alle = Object.values(A).filter(Array.isArray);
    const x0 = Math.min(...alle.map(p => p[0])) - 0.9, x1 = Math.max(...alle.map(p => p[0])) + 0.9;
    const y0 = Math.min(...alle.map(p => -p[1])) - 0.9, y1 = Math.max(...alle.map(p => -p[1])) + 0.9;
    const svg = `<svg class="struktur" viewBox="${x0.toFixed(2)} ${y0.toFixed(2)} ${(x1 - x0).toFixed(2)} ${(y1 - y0).toFixed(2)}" role="img" aria-label="${opt.beschreibung || "Strukturformel"}" style="font-family:inherit">${Z.join("")}${S.join("")}${T.join("")}${H.join("")}</svg>`;
    return {svg, atome: A, breite: x1 - x0, hoehe: y1 - y0};
  }

  // ---------------------------------------------------------------------------------------------
  // Kacheln für die Basenpaarung. Ein Nukleotid mit der Base in echter Geometrie, schematischem Zucker,
  // 5'-Phosphat (P, magenta) und 3'-OH (cyan). Ursprung (0, 0) ist C1'; y zeigt nach oben.
  // seite "l": Strang 1 (links; 5' oben, 3' unten). seite "r": Gegenstrang (rechts; Base gespiegelt,
  // 5' unten, 3' oben). Links und rechts zusammen ergeben genau die Lage der Atome im Basenpaar,
  // sodass die Wasserstoffbrücken-Partner (Spender/Empfänger) gegenüberliegen.
  const HB_STELLEN = {   // Wasserstoffbrücken-Spender und -Empfänger an der Watson-Crick-Kante
    A: {don: ["N6"], akz: ["N1"]}, G: {don: ["N1", "N2"], akz: ["O6"]},
    C: {don: ["N4"], akz: ["N3", "O2"]}, T: {don: ["N3"], akz: ["O2", "O4"]}, U: {don: ["N3"], akz: ["O2", "O4"]},
  };

  function kachel(b, f, seite, opt){
    opt = opt || {};
    const P = PALETTE.get, rechts = seite === "r", pl = plan(b, opt.geometrie || f), A = {}, ink = "currentColor";   // f: Zucker (DNA/RNA), geometrie: woher die Basenkoordinaten stammen
    const c1 = pl.pos["C1'"], sp = rechts ? -1 : 1, R = 0.8507;
    for (const n of BASE_ATOME[b]) A[n] = [sp * (pl.pos[n][0] - c1[0]) / SK, (pl.pos[n][1] - c1[1]) / SK];
    A["C1'"] = [0, 0];
    const N = A[GLYKO[b]], beta = Math.atan2(N[1], N[0]) * 180 / Math.PI;
    if (!rechts){            // Ring unten links, C3' unten (3'-Ende unten), C4' links, 5'-Kette nach oben
      const ctr = dir(0, 0, -R, beta);
      A["C2'"] = dir(ctr[0], ctr[1], R, beta - 72); A["C3'"] = dir(ctr[0], ctr[1], R, beta - 144);
      A["C4'"] = dir(ctr[0], ctr[1], R, beta - 216); A["O4'"] = dir(ctr[0], ctr[1], R, beta - 288);
      A["X2"] = dir(A["C2'"][0], A["C2'"][1], 0.9, beta - 72);
      A["O3'"] = dir(A["C3'"][0], A["C3'"][1], 1, beta - 144);
      A["C5'"] = dir(A["C4'"][0], A["C4'"][1], 1, beta - 216);
      A["O5'"] = dir(A["C5'"][0], A["C5'"][1], 1, 100); A["P"] = dir(A["O5'"][0], A["O5'"][1], 1, 85);
    } else {                 // Ring rechts von C1', C3' oben (3'-Ende oben), C4' unten, 5'-Kette nach unten
      const ctr = [R, 0];
      A["C2'"] = dir(ctr[0], ctr[1], R, 108); A["C3'"] = dir(ctr[0], ctr[1], R, 36);
      A["C4'"] = dir(ctr[0], ctr[1], R, -36); A["O4'"] = dir(ctr[0], ctr[1], R, -108);
      A["X2"] = dir(A["C2'"][0], A["C2'"][1], 1.0, 85);
      A["O3'"] = dir(A["C3'"][0], A["C3'"][1], 1, 75);
      A["C5'"] = dir(A["C4'"][0], A["C4'"][1], 1, -60);
      A["O5'"] = dir(A["C5'"][0], A["C5'"][1], 1, -90); A["P"] = dir(A["O5'"][0], A["O5'"][1], 1, -90);
    }
    const farbe = {base: P(b), p5: P("p5"), oh3: P("oh3")};
    const S = [], T = [], Z = [];
    const xy = q => q[0].toFixed(3) + "," + (-q[1]).toFixed(3);
    const line = (a, c, col, w) => S.push(`<line x1="${a[0].toFixed(3)}" y1="${(-a[1]).toFixed(3)}" x2="${c[0].toFixed(3)}" y2="${(-c[1]).toFixed(3)}" stroke="${col}" stroke-width="${w || 0.07}" stroke-linecap="round"/>`);
    const kurz = (a, c, ta, tc) => {
      const dx = c[0] - a[0], dy = c[1] - a[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
      return [[a[0] + (ta ? 0.3 : 0) * ux, a[1] + (ta ? 0.3 : 0) * uy], [c[0] - (tc ? 0.3 : 0) * ux, c[1] - (tc ? 0.3 : 0) * uy]];
    };
    const doppel = (a, c, ring) => {
      const dx = c[0] - a[0], dy = c[1] - a[1], L = Math.hypot(dx, dy);
      let nx = -dy / L, ny = dx / L;
      if (ring){
        const m = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2];
        if (nx * (ring[0] - m[0]) + ny * (ring[1] - m[1]) < 0){ nx = -nx; ny = -ny; }
        return [[a[0] + nx * 0.17 + dx * 0.12, a[1] + ny * 0.17 + dy * 0.12], [c[0] + nx * 0.17 - dx * 0.12, c[1] + ny * 0.17 - dy * 0.12]];
      }
      return [[a[0] + nx * 0.07, a[1] + ny * 0.07], [c[0] + nx * 0.07, c[1] + ny * 0.07]];
    };
    const label = (n, text, col, extra) => {
      const [x, y] = A[n], w = 0.34 * text.replace(/[\d⁻]/g, "").length + (/[\d⁻]/.test(text) ? 0.2 : 0) + 0.12;
      // Bei der rechten Kachel stehen mehrbuchstabige Beschriftungen nach links, damit sie nicht ins Paar ragen
      const links = rechts && text.length > 1 && !/^O⁻?$/.test(text);
      Z.push(`<rect x="${(links ? x - w + 0.28 : x - 0.28).toFixed(3)}" y="${(-y - 0.3).toFixed(3)}" width="${w.toFixed(3)}" height="0.6" rx="0.22" fill="var(--surface)"/>`);
      T.push(`<text x="${(links ? x + 0.17 : x - 0.17).toFixed(3)}" y="${(-y).toFixed(3)}" text-anchor="${links ? "end" : "start"}" dominant-baseline="central" font-size="0.5" font-weight="600" fill="${col}"${extra || ""}>${fmt(text)}</text>`);
    };
    const sechser = ["N1", "C2", "N3", "C4", "C5", "C6"].map(m => A[m]);
    const mitte = [sechser.reduce((q, p) => q + p[0], 0) / 6, sechser.reduce((q, p) => q + p[1], 0) / 6];
    const BL = BESCHRIFTUNG[b], istDoppelt = (a, c) => DOPPELT[b].some(([x, y]) => (x === a && y === c) || (x === c && y === a));
    const imRing = new Set(["N1", "C2", "N3", "C4", "C5", "C6", "N7", "C8", "N9"]), fuenf = ["C4", "C5", "N7", "C8", "N9"];
    for (const [a, c] of pl.bind){
      if (a === "C1'" || c === "C1'"){ const [p, q] = kurz(A["C1'"], A[GLYKO[b]], false, BL[GLYKO[b]]); line(p, q, P("zucker"), 0.08); continue; }
      const [p, q] = kurz(A[a], A[c], BL[a], BL[c]);
      line(p, q, farbe.base, 0.09);
      if (istDoppelt(a, c)){
        const ringB = imRing.has(a) && imRing.has(c);
        const z5 = ringB && fuenf.includes(a) && fuenf.includes(c) && !(["C4", "C5"].includes(a) && ["C4", "C5"].includes(c));
        const zentrum = z5 ? [fuenf.reduce((q, n) => q + A[n][0], 0) / 5, fuenf.reduce((q, n) => q + A[n][1], 0) / 5] : mitte;
        const [p2, q2] = doppel(p, q, ringB ? zentrum : null);
        line(p2, q2, farbe.base, 0.09);
      }
    }
    for (const n of BASE_ATOME[b]) if (BL[n]) label(n, BL[n], ink);
    // Zucker (schematisch), 2'-Substituent klein
    for (const [a, c] of [["C1'", "C2'"], ["C2'", "C3'"], ["C3'", "C4'"], ["C4'", "O4'"], ["O4'", "C1'"]]){
      const [p, q] = kurz(A[a], A[c], a === "O4'", c === "O4'"); line(p, q, P("zucker"), 0.08);
    }
    label("O4'", "O", ink);
    { const [p, q] = kurz(A["C2'"], A["X2"], false, true); line(p, q, P("zucker"), 0.08); label("X2", f === "RNA" ? "OH" : "H", P("oh2"), ' font-weight="700"'); }
    // 3'-OH (cyan) und 5'-Phosphat (magenta)
    const frei3 = opt.frei3 !== false;
    { const [p, q] = kurz(A["C3'"], A["O3'"], false, true); line(p, q, farbe.oh3, 0.09);
      if (frei3) label("O3'", "OH", farbe.oh3, ' font-weight="700"');
      else S.push(`<circle cx="${A["O3'"][0].toFixed(3)}" cy="${(-A["O3'"][1]).toFixed(3)}" r="0.15" fill="${farbe.oh3}"/>`); }
    { const [p, q] = kurz(A["C4'"], A["C5'"], false, false); line(p, q, P("zucker"), 0.08); }
    { const [p, q] = kurz(A["C5'"], A["O5'"], false, true); line(p, q, P("zucker"), 0.08); label("O5'", "O", farbe.p5); }
    { const [p, q] = kurz(A["O5'"], A["P"], true, true); line(p, q, farbe.p5, 0.07); }
    const pScheibe = n => {
      S.push(`<circle cx="${A[n][0].toFixed(3)}" cy="${(-A[n][1]).toFixed(3)}" r="0.36" fill="${farbe.p5}"/>`);
      T.push(`<text x="${A[n][0].toFixed(3)}" y="${(-A[n][1]).toFixed(3)}" text-anchor="middle" dominant-baseline="central" font-size="0.46" font-weight="800" fill="#fff">P</text>`);
    };
    if (opt.tri){   // Triphosphat: Pα–O–Pβ–O–Pγ als Zickzack nach außen (rechte Kachel: nach rechts, linke: nach links)
      const w = a => rechts ? a : 180 - a;
      A["O3A"] = dir(A["P"][0], A["P"][1], 1, w(-30)); A["PB"] = dir(A["O3A"][0], A["O3A"][1], 1, w(30));
      A["O3B"] = dir(A["PB"][0], A["PB"][1], 1, w(-30)); A["PG"] = dir(A["O3B"][0], A["O3B"][1], 1, w(30));
      for (const [a, c] of [["P", "O3A"], ["O3A", "PB"], ["PB", "O3B"], ["O3B", "PG"]]) line(A[a], A[c], farbe.p5, 0.07);
      for (const n of ["O3A", "O3B"]) S.push(`<circle cx="${A[n][0].toFixed(3)}" cy="${(-A[n][1]).toFixed(3)}" r="0.13" fill="${farbe.p5}"/>`);
      pScheibe("PB"); pScheibe("PG");
    }
    pScheibe("P");
    const st = HB_STELLEN[b];
    return {svg: Z.join("") + S.join("") + T.join(""), atome: A, mitte, don: st.don, akz: st.akz, base: b, seite};
  }

  // Wasserstoffbrücken zwischen einer linken und einer rechten Kachel (beide in derselben Zeichenebene).
  // posL und posR sind die Orte der C1'-Atome. Eine Brücke zählt, wenn Spender und Empfänger zwischen
  // 2,4 und 3,3 Å auseinanderliegen. Rückgabe: {liste: [{von, nach, laenge}], klirr: kleinster Abstand
  // zweier Basenatome in Å}. Unter 2,3 Å überlappen die Basen (zum Beispiel zwei Purine): keine Paarung.
  const HB_MIN = 2.4, HB_MAX = 3.3, KLIRR = 2.3;
  function bruecken(links, posL, rechts, posR){
    const liste = [], ort = (t, n, o) => [t.atome[n][0] + o[0], t.atome[n][1] + o[1]];
    const test = (a, b) => {
      const p = ort(links, a, posL), q = ort(rechts, b, posR), d = Math.hypot(p[0] - q[0], p[1] - q[1]) * SK;
      if (d >= HB_MIN && d <= HB_MAX) liste.push({von: p, nach: q, laenge: d, a, b});
    };
    for (const a of links.don) for (const b of rechts.akz) test(a, b);
    for (const a of links.akz) for (const b of rechts.don) test(a, b);
    let klirr = 99;
    for (const a of BASE_ATOME[links.base]) for (const b of BASE_ATOME[rechts.base]){
      const p = ort(links, a, posL), q = ort(rechts, b, posR);
      klirr = Math.min(klirr, Math.hypot(p[0] - q[0], p[1] - q[1]) * SK);
    }
    return {liste, klirr, passt: klirr >= KLIRR && liste.length >= 2};
  }

  return {nukleotid, kachel, bruecken, plan, BASE_ATOME, GLYKO, SK};

})();
