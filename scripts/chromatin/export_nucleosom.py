#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
export_nucleosom.py — schreibt template/site/nucleosom-data.js (Nucleosom für chromatin.html).

Quelle: RCSB PDB, Eintrag 1KX5 (Nucleosomen-Kernpartikel mit 147 bp DNA, 1,9 Å; Davey, Sargent, Luger,
Maeder und Richmond 2002, J. Mol. Biol. 319: 1097). Abruf 18.10.2026 von files.rcsb.org/download/1KX5.pdb
(Datei in results/chromatin/). Enthalten sind je Histonrest Cα, C und O (für den Cartoon) und die Mittellinie
der DNA (Mittelpunkt der C1'-Atome jedes Basenpaars, 147 Punkte). Beide Kopien jedes Histons (A–D und E–H).

Aufruf:  python3 scripts/chromatin/export_nucleosom.py
"""
import json
import os
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PDB = os.path.join(ROOT, "results", "chromatin", "1KX5.pdb")
OUT = os.path.join(ROOT, "template", "site", "nucleosom-data.js")
HISTONE = {"A": "H3", "E": "H3", "B": "H4", "F": "H4", "C": "H2A", "G": "H2A", "D": "H2B", "H": "H2B"}
DREI = {"ALA": "A", "ARG": "R", "ASN": "N", "ASP": "D", "CYS": "C", "GLN": "Q", "GLU": "E", "GLY": "G", "HIS": "H", "ILE": "I", "LEU": "L",
        "LYS": "K", "MET": "M", "PHE": "F", "PRO": "P", "SER": "S", "THR": "T", "TRP": "W", "TYR": "Y", "VAL": "V"}
ketten = {}; c1 = {"I": {}, "J": {}}
for z in open(PDB):
    if not z.startswith(("ATOM", "HETATM")): continue
    ch, name, rn, nr = z[21], z[12:16].strip(), z[17:20].strip(), int(z[22:26])
    if z[16] not in " A": continue
    p = [round(float(z[30:38]), 1), round(float(z[38:46]), 1), round(float(z[46:54]), 1)]
    if ch in HISTONE and name in ("CA", "C", "O") and rn in DREI:
        r = ketten.setdefault(ch, {}).setdefault(nr, {"nr": nr, "aa": DREI[rn]})
        r[name] = p
    if ch in c1 and name == "C1'": c1[ch][nr] = np.array(p)
saeulen = []
for ch in "ABCDEFGH":
    rs = [r for _, r in sorted(ketten[ch].items()) if all(k in r for k in ("CA", "C", "O"))]
    saeulen.append({"kette": ch, "histon": HISTONE[ch], "reste": [{"nr": r["nr"], "aa": r["aa"], "ca": r["CA"], "c": r["C"], "o": r["O"]} for r in rs]})
    print(ch, HISTONE[ch], rs[0]["nr"], "bis", rs[-1]["nr"], len(rs), "Reste")
I, J = c1["I"], c1["J"]; mitte = []
for k in sorted(I):
    j = min(J, key=lambda q: np.linalg.norm(J[q] - I[k]))
    mitte.append([round(float(v), 1) for v in (I[k] + J[j]) / 2])
print("Basenpaare:", len(mitte))
daten = {"quelle": "RCSB PDB 1KX5, Nucleosomen-Kernpartikel (Davey et al. 2002, J. Mol. Biol. 319: 1097)", "histone": saeulen, "dna": mitte}
with open(OUT, "w") as f:
    f.write("// Erzeugt von scripts/chromatin/export_nucleosom.py aus RCSB PDB 1KX5. Nicht von Hand ändern.\nconst NUC3D = ")
    json.dump(daten, f, separators=(",", ":"))
    f.write(";\n")
print("geschrieben:", round(os.path.getsize(OUT) / 1024), "KB")
