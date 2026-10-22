#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
export_tetranucleosom.py — schreibt template/site/tetranucleosom-data.js (Zickzack-Faser für chromatin.html, Stufe 3).

Quelle: RCSB PDB, Eintrag 1ZBB (Tetranucleosom aus vier Nucleosomen mit je 167 bp DNA-Wiederholung, 9 Å; Schalch, Duda,
Sargent und Richmond 2005, Nature 436: 138). Abruf 22.10.2026 von files.rcsb.org/download/1ZBB.pdb (Datei in results/chromatin/).
Die asymmetrische Einheit enthält nur zwei Nucleosomen (Ketten A–H und a–h) mit 347 bp DNA (Ketten I, J). Die beiden anderen
entstehen durch die 2-zählige Symmetrie aus REMARK 350 (BIOMT 2: x -> -x + 127,675; z -> -z + 237,126). Beide DNA-Kopien
treffen sich am Basenpaar 1 (Abstand 2,5 Å), dort werden sie zu einem Strang verbunden: 347 + 346 = 693 Basenpaare.
Enthalten sind je Histonrest nur Cα (bei 9 Å sind Seitenketten nicht aufgelöst) und die Mittellinie der DNA (Mittelpunkt der
C1'-Atome jedes Basenpaars; Paar k der Kette I mit 348-k der Kette J).

Aufruf:  python3 scripts/chromatin/export_tetranucleosom.py
"""
import json
import os
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PDB = os.path.join(ROOT, "results", "chromatin", "1ZBB.pdb")
OUT = os.path.join(ROOT, "template", "site", "tetranucleosom-data.js")
HISTONE = {"A": "H3", "E": "H3", "B": "H4", "F": "H4", "C": "H2A", "G": "H2A", "D": "H2B", "H": "H2B"}
SPIEGEL = np.diag([-1.0, 1.0, -1.0]); VERSATZ = np.array([127.675, 0.0, 237.126])   # BIOMT 2
NUC = {"A": 0, "B": 0, "C": 0, "D": 0, "E": 0, "F": 0, "G": 0, "H": 0, "a": 1, "b": 1, "c": 1, "d": 1, "e": 1, "f": 1, "g": 1, "h": 1}

ca = {}; c1 = {"I": {}, "J": {}}
for z in open(PDB):
    if not z.startswith("ATOM"): continue
    ch, name, nr = z[21], z[12:16].strip(), int(z[22:26])
    if z[16] not in " A": continue
    p = np.array([float(z[30:38]), float(z[38:46]), float(z[46:54])])
    if name == "CA" and ch in NUC: ca.setdefault(ch, []).append((nr, p))
    if name == "C1'" and ch in c1: c1[ch][nr] = p
assert len(c1["I"]) == len(c1["J"]) == 347
mitte = np.array([(c1["I"][k] + c1["J"][348 - k]) / 2 for k in range(1, 348)])
mitte2 = mitte @ SPIEGEL.T + VERSATZ
assert np.linalg.norm(mitte[0] - mitte2[0]) < 4, "Kopien treffen sich nicht am Basenpaar 1"
# Reihenfolge entlang der DNA: Kopie 2 rückwärts (Basenpaar 347 bis 1), dann Kopie 1 (2 bis 347)
dna = np.vstack([mitte2[::-1], mitte[1:]])
s = np.linalg.norm(np.diff(dna, axis=0), axis=1)
print("Basenpaare:", len(dna), "größter Schritt", round(float(s.max()), 1), "Å")

def kopie(zweite):
    return lambda p: p @ SPIEGEL.T + VERSATZ if zweite else p
nucs = []   # Reihenfolge entlang der DNA: Kopie 2 (a–h), Kopie 2 (A–H), Kopie 1 (A–H), Kopie 1 (a–h)
for zweite, gruppe in ((True, 1), (True, 0), (False, 0), (False, 1)):
    f = kopie(zweite); ketten = []
    for ch in "ABCDEFGH":
        c = ch.lower() if gruppe else ch
        ketten.append({"histon": HISTONE[ch], "reste": [[nr] + [round(float(v), 1) for v in f(p)] for nr, p in ca[c]]})
    nucs.append(ketten)
    mitt = np.mean([r[1:] for k in ketten for r in k["reste"]], axis=0)
    print("Nucleosom", len(nucs), "Zentrum", np.round(mitt, 0))
daten = {"quelle": "RCSB PDB 1ZBB, Tetranucleosom (Schalch et al. 2005, Nature 436: 138)",
         "dna": [[round(float(v), 1) for v in p] for p in dna], "nucleosomen": nucs}
with open(OUT, "w") as fh:
    fh.write("// Erzeugt von scripts/chromatin/export_tetranucleosom.py aus RCSB PDB 1ZBB. Nicht von Hand ändern.\nconst TETRA3D = ")
    json.dump(daten, fh, separators=(",", ":"))
    fh.write(";\n")
print("geschrieben:", round(os.path.getsize(OUT) / 1024), "KB")
