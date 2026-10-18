// Doppelhelix aus einer Sequenz bauen (Quelle: template/site/helix.js, von build.py in die Seiten kopiert).
// Braucht HELIX aus nuc-data.js. Einheiten: Ångström. Die Helixachse ist die z-Achse.
// Jedes Basenpaar k liegt um k·Drehwinkel gedreht und k·Anstieg höher; Strang 1 läuft 5'→3' nach oben,
// Strang 2 (um die Dyade des Paares gedreht) nach unten.
const HELIX_BAU = (() => {
  const KOMP = {DNA: {A: "T", T: "A", G: "C", C: "G"}, RNA: {A: "U", U: "A", G: "C", C: "G"}};
  const RUECKEN = new Set(["P", "OP1", "OP2", "O5'", "C5'", "C4'", "O4'", "C3'", "O3'", "C2'", "C1'", "O2'"]);
  const PHOSPHAT = new Set(["P", "OP1", "OP2"]);

  // Gegenstrang, 5'→3' gelesen
  const gegenstrang = (seq, form) => [...seq].reverse().map(b => KOMP[form][b]).join("");
  const mul = (R, p) => [R[0][0]*p[0] + R[0][1]*p[1] + R[0][2]*p[2],
                         R[1][0]*p[0] + R[1][1]*p[1] + R[1][2]*p[2],
                         R[2][0]*p[0] + R[2][1]*p[1] + R[2][2]*p[2]];
  const rz = (grad) => { const a = grad * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [[c, -s, 0], [s, c, 0], [0, 0, 1]]; };
  const mm = (A, B) => A.map(r => [0, 1, 2].map(j => r[0]*B[0][j] + r[1]*B[1][j] + r[2]*B[2][j]));

  // Rückgabe: {atome, bindungen, n, form, strang1, strang2}
  // atom: {strang, bp, name, el, base, pos, art: "base"|"ruecken", rolle: "p5"|"oh3"|null}
  function bauen(seq, form) {
    const H = HELIX[form], n = seq.length, atome = [], bindungen = [], index = {};
    const bpIdx = [];
    for (let k = 0; k < n; k++) {
      const Rk = mm(rz(k * H.drehung), H.R);
      const Ok = mul(rz(k * H.drehung), H.O); Ok[2] += k * H.anstieg;
      for (const strang of [1, 2]) {
        const b = strang === 1 ? seq[k] : KOMP[form][seq[k]];
        const vorl = H.vorlage[b], von = atome.length;
        for (const [name, el, x, y, z] of vorl.atome) {
          const q = strang === 2 ? [x, -y, -z] : [x, y, z];
          const p = mul(Rk, q);
          const frei5 = PHOSPHAT.has(name) && ((strang === 1 && k === 0) || (strang === 2 && k === n - 1));
          const frei3 = name === "O3'" && ((strang === 1 && k === n - 1) || (strang === 2 && k === 0));
          index[strang + ":" + k + ":" + name] = atome.length;
          atome.push({strang, bp: k, name, el, base: b, pos: [p[0] + Ok[0], p[1] + Ok[1], p[2] + Ok[2]],
                      art: RUECKEN.has(name) ? "ruecken" : "base", rolle: frei5 ? "p5" : frei3 ? "oh3" : null});
        }
        for (const [i, j] of vorl.bindungen) bindungen.push([von + i, von + j]);
      }
    }
    // Phosphodiesterbindungen: O3' des Vorgängers an P des Nachfolgers
    for (let k = 0; k < n - 1; k++) {
      bindungen.push([index["1:" + k + ":O3'"], index["1:" + (k + 1) + ":P"]]);
      bindungen.push([index["2:" + (k + 1) + ":O3'"], index["2:" + k + ":P"]]);
    }
    return {atome, bindungen, n, form, strang1: seq, strang2: gegenstrang(seq, form), index};
  }

  const abstand = (a, b) => Math.hypot(a.pos[0] - b.pos[0], a.pos[1] - b.pos[1], a.pos[2] - b.pos[2]);
  return {bauen, gegenstrang, abstand, KOMP};
})();
