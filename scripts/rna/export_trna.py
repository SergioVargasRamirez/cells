#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
export_trna.py — schreibt template/site/trna-data.js (tRNA-Phe aus Hefe für rna-typen.html).

Quelle: RCSB PDB, Eintrag 1EHZ (Hefe-tRNA-Phe, Röntgenstruktur, 1,93 Å; Shi und Moore 2000, RNA 6: 1091).
Abruf 18.10.2026 von files.rcsb.org/download/1EHZ.pdb (Datei in results/rna/). Enthalten sind die schweren Atome
der 76 Nucleotide der Kette A (ohne Wasser und Ionen). Modifizierte Basen werden ihrer Grundbase zugeordnet.
Die Basenpaare der vier Stämme stehen fest (Standardnummerierung) und werden gegen die Koordinaten geprüft.

Aufruf:  python3 scripts/rna/export_trna.py
"""
import json
import os
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PDB = os.path.join(ROOT, "results", "rna", "1EHZ.pdb")
OUT = os.path.join(ROOT, "template", "site", "trna-data.js")
GRUND = {"A": "A", "C": "C", "G": "G", "U": "U", "1MA": "A", "2MG": "G", "M2G": "G", "OMG": "G", "YYG": "G", "7MG": "G",
         "5MC": "C", "OMC": "C", "H2U": "U", "PSU": "U", "5MU": "U"}
STAEMME = {"Akzeptor": ([1, 2, 3, 4, 5, 6, 7], [72, 71, 70, 69, 68, 67, 66]), "D": ([10, 11, 12, 13], [25, 24, 23, 22]),
           "Anticodon": ([27, 28, 29, 30, 31], [43, 42, 41, 40, 39]), "T": ([49, 50, 51, 52, 53], [65, 64, 63, 62, 61])}
PAARE = [(a, b, n) for n, (x, y) in STAEMME.items() for a, b in zip(x, y)]

reste = {}
modell = None
for z in open(PDB):
    if z.startswith("MODEL"): modell = int(z.split()[1])
    if modell not in (None, 1): continue
    if not z.startswith(("ATOM", "HETATM")) or z[21] != "A" or z[17:20].strip() == "HOH": continue
    name, rn, nr = z[12:16].strip(), z[17:20].strip(), int(z[22:26])
    if rn not in GRUND: continue
    if z[16] not in " A": continue
    r = reste.setdefault(nr, {"nr": nr, "name": rn, "base": GRUND[rn], "atome": []})
    r["atome"].append([name, round(float(z[30:38]), 2), round(float(z[38:46]), 2), round(float(z[46:54]), 2)])
liste = [reste[k] for k in sorted(reste)]
seq = "".join(r["base"] for r in liste)
assert len(liste) == 76, len(liste)
print("Sequenz:", seq)

# Prüfung der Paare: Abstand N1(A/G) bzw. N3(C/U) zum Partner (Watson-Crick: N1···N3 etwa 2,8 bis 3,2 Å; G·U: N1···O2/O4)
def pos(nr, name):
    for a in reste[nr]["atome"]:
        if a[0] == name: return np.array(a[1:])
ok = 0
for a, b, n in PAARE:
    ba, bb = reste[a]["base"], reste[b]["base"]
    lookup = {"A": "N1", "G": "N1", "C": "N3", "U": "N3"}
    d = np.linalg.norm(pos(a, lookup[ba]) - pos(b, lookup[bb]))
    paar = ba + bb
    gut = d < 3.4
    ok += gut
    if not gut: print("  Paar", a, b, paar, "Abstand", round(d, 2))
print("Paare mit Abstand < 3,4 Å:", ok, "von", len(PAARE))

# Wasserstoffbrücken der Stammpaare: alle N/O-Paare der Basen mit Abstand bis 3,3 Å
BASENATOME = {"N1", "N2", "N3", "N4", "N6", "N7", "O2", "O4", "O6"}
bruecken = []
for a, b, n in PAARE:
    for x in reste[a]["atome"]:
        for y in reste[b]["atome"]:
            if x[0] in BASENATOME and y[0] in BASENATOME and np.linalg.norm(np.array(x[1:]) - np.array(y[1:])) <= 3.3:
                bruecken.append([a, x[0], b, y[0]])
print("Wasserstoffbrücken:", len(bruecken))
daten = {"quelle": "RCSB PDB 1EHZ, Hefe-tRNA-Phe (Shi und Moore 2000, RNA 6: 1091)", "seq": seq,
         "paare": [[a, b, n] for a, b, n in PAARE], "bruecken": bruecken,
         "reste": liste}
with open(OUT, "w") as f:
    f.write("// Erzeugt von scripts/rna/export_trna.py aus RCSB PDB 1EHZ (Hefe-tRNA-Phe). Nicht von Hand ändern.\nconst TRNA = ")
    json.dump(daten, f, separators=(",", ":"), ensure_ascii=False)
    f.write(";\n")
print("geschrieben:", OUT, round(os.path.getsize(OUT) / 1024), "KB")
