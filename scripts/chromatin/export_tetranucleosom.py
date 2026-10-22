#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
export_tetranucleosom.py — schreibt template/site/tetranucleosom-data.js (vier Nucleosomen für chromatin.html: Stufe 3 und 3D-Ansicht).

Quelle: RCSB PDB, Eintrag 1ZBB (Tetranucleosom aus vier Nucleosomen mit je 167 bp DNA-Wiederholung, 9 Å; Schalch, Duda,
Sargent und Richmond 2005, Nature 436: 138). Abruf 22.10.2026 von files.rcsb.org/download/1ZBB.pdb (Datei in results/chromatin/).
Die asymmetrische Einheit enthält nur zwei Nucleosomen (Ketten A–H und a–h) mit 347 bp DNA (Ketten I, J). Die beiden anderen
entstehen durch die 2-zählige Symmetrie aus REMARK 350 (BIOMT 2: x -> -x + 127,675; z -> -z + 237,126). Beide DNA-Kopien
treffen sich am Basenpaar 1 (Abstand 2,5 Å), dort werden sie zu einem Strang verbunden: 347 + 346 = 693 Basenpaare.
Geschrieben wird nur die asymmetrische Einheit (347 Basenpaare, zwei Nucleosomen); die Seite erzeugt die anderen beiden mit
"spiegel" und "versatz" und setzt die DNA zusammen (Kopie 2 rückwärts, dann Kopie 1 ab Basenpaar 2). Enthalten sind je Histonrest
Cα, C und O (für den Cartoon; bei 9 Å sind Seitenketten nicht aufgelöst) und die Mittellinie der DNA (Mittelpunkt der C1'-Atome
jedes Basenpaars; Paar k der Kette I mit 348-k der Kette J). Reste: [Nummer, Cα(xyz), C(xyz), O(xyz)].

Aufruf:  python3 scripts/chromatin/export_tetranucleosom.py
"""
import json
import os
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PDB = os.path.join(ROOT, "results", "chromatin", "1ZBB.pdb")
OUT = os.path.join(ROOT, "template", "site", "tetranucleosom-data.js")
HISTONE = {"A": "H3", "E": "H3", "B": "H4", "F": "H4", "C": "H2A", "G": "H2A", "D": "H2B", "H": "H2B"}
SPIEGEL = np.diag([-1.0, 1.0, -1.0]); VERSATZ = np.array([127.675, 0.0, 237.126])   # BIOMT 2 (auch in der Ausgabe)

ketten = {}; c1 = {"I": {}, "J": {}}
for z in open(PDB):
    if not z.startswith("ATOM"): continue
    ch, name, nr = z[21], z[12:16].strip(), int(z[22:26])
    if z[16] not in " A": continue
    p = [round(float(z[30:38]), 1), round(float(z[38:46]), 1), round(float(z[46:54]), 1)]
    if ch in c1 and name == "C1'": c1[ch][nr] = np.array(p)
    if ch.upper() in HISTONE and name in ("CA", "C", "O"): ketten.setdefault(ch, {}).setdefault(nr, {})[name] = p
assert len(c1["I"]) == len(c1["J"]) == 347
mitte = np.array([(c1["I"][k] + c1["J"][348 - k]) / 2 for k in range(1, 348)])
mitte2 = mitte @ SPIEGEL.T + VERSATZ
assert np.linalg.norm(mitte[0] - mitte2[0]) < 4, "Kopien treffen sich nicht am Basenpaar 1"
nucs = []
for gruppe in (str.upper, str.lower):   # Ketten A–H, dann a–h
    liste = []
    for ch in "ABCDEFGH":
        c = gruppe(ch)
        reste = [[nr] + r["CA"] + r["C"] + r["O"] for nr, r in sorted(ketten[c].items()) if all(k in r for k in ("CA", "C", "O"))]
        liste.append({"histon": HISTONE[ch], "reste": reste})
        print(c, HISTONE[ch], reste[0][0], "bis", reste[-1][0], len(reste), "Reste")
    nucs.append(liste)
daten = {"quelle": "RCSB PDB 1ZBB, Tetranucleosom (Schalch et al. 2005, Nature 436: 138)",
         "spiegel": [-1, 1, -1], "versatz": [127.675, 0.0, 237.126],
         "dna": [[round(float(v), 1) for v in p] for p in mitte], "nucleosomen": nucs}
with open(OUT, "w") as fh:
    fh.write("// Erzeugt von scripts/chromatin/export_tetranucleosom.py aus RCSB PDB 1ZBB. Nicht von Hand ändern.\nconst TETRA3D = ")
    json.dump(daten, fh, separators=(",", ":"))
    fh.write(";\n")
print("geschrieben:", round(os.path.getsize(OUT) / 1024), "KB")
