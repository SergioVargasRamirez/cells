#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
nuc_daten.py — erzeugt template/site/nuc-data.js (Nukleotid-Daten für dna-rna.html u. a.).

Quellen (Abruf 18.10.2026, files.rcsb.org; Dateien in results/nukleotide/):
  wwPDB Chemical Component Dictionary (CC0), ideale Koordinaten ("pdbx_model_Cartn_*_ideal"):
    dATP = DTP, dTTP = TTP, dGTP = DGT, dCTP = DCP, ATP, UTP, GTP, CTP
  Helix-Vorlagen: 1BNA (B-DNA), 1QC0 (A-RNA), verarbeitet in helix_vorlagen.py

Zuerst die Dateien holen (siehe unten "holen"), dann:
    python3 scripts/nukleotide/nuc_daten.py
"""
import json
import os
import shlex
import sys
import urllib.request
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helix_vorlagen as H  # noqa: E402

ROOT = H.ROOT
DATA = H.DATA
OUT = os.path.join(ROOT, "template", "site", "nuc-data.js")

KOMPONENTEN = {
    "dNTP": {"A": "DTP", "T": "TTP", "G": "DGT", "C": "DCP"},
    "NTP": {"A": "ATP", "U": "UTP", "G": "GTP", "C": "CTP"},
}
ORDNUNG = {"SING": 1, "DOUB": 2, "TRIP": 3}


def holen():
    os.makedirs(DATA, exist_ok=True)
    for ids in KOMPONENTEN.values():
        for cid in ids.values():
            ziel = os.path.join(DATA, cid + ".cif")
            if not os.path.isfile(ziel):
                urllib.request.urlretrieve(f"https://files.rcsb.org/ligands/download/{cid}.cif", ziel)
    for pdb in ("1BNA", "1QC0"):
        ziel = os.path.join(DATA, pdb + ".pdb")
        if not os.path.isfile(ziel):
            urllib.request.urlretrieve(f"https://files.rcsb.org/download/{pdb}.pdb", ziel)


def lies_cif(cid):
    atome, bindungen = [], []
    for line in open(os.path.join(DATA, cid + ".cif"), encoding="utf-8"):
        if not line.startswith(cid + " "):
            continue
        t = shlex.split(line)
        if len(t) >= 17 and t[3].isalpha() and "." in t[12]:  # Atomzeile
            atome.append((t[1], t[3].upper(), np.array([float(t[12]), float(t[13]), float(t[14])])))
        elif len(t) == 7 and t[3] in ORDNUNG:  # Bindungszeile
            bindungen.append((t[1], t[2], ORDNUNG[t[3]]))
    return atome, bindungen


def kabsch(P, Q):
    """Rotation R und Verschiebung, die P auf Q legen (Zeilen = Punkte)."""
    pc, qc = P.mean(axis=0), Q.mean(axis=0)
    u, _, vt = np.linalg.svd((P - pc).T @ (Q - qc))
    d = np.sign(np.linalg.det(vt.T @ u.T))
    R = vt.T @ np.diag([1, 1, d]) @ u.T
    return R, qc - R @ pc, pc


ZUCKER = ["C1'", "C2'", "C3'", "C4'", "O4'", "C5'", "O5'", "O3'"]


def nukleotide():
    daten = {}
    mol = {}
    for typ, ids in KOMPONENTEN.items():
        for b, cid in ids.items():
            mol[(typ, b)] = lies_cif(cid)
    # Bezug: ATP. Alle acht Moleküle werden auf den Zucker von ATP gelegt und dann so gedreht, dass
    # die Basenebene in der Zeichenebene liegt (Blick von vorn), das Triphosphat links und die Base
    # rechts, und die Base von derselben Seite zu sehen ist wie in der Strukturformel (dna2d.js).
    ref_atome = {n: p for n, _, p in mol[("NTP", "A")][0]}
    ref = np.array([ref_atome[n] for n in ZUCKER])
    ref_c = ref.mean(axis=0)
    ring = np.array([ref_atome[n] for n in ("N9", "C8", "N7", "C5", "C6", "N1", "C2", "N3", "C4")])
    cb = ring.mean(axis=0)
    z = np.linalg.svd(ring - cb)[2][2]
    v = cb - ref_atome["PB"]
    x = v - np.dot(v, z) * z
    x /= np.linalg.norm(x)
    y = np.cross(z, x)
    if np.dot(y, ref_atome["N6"] - cb) < 0:   # N6 (Wasserstoffbrücken-Kante) soll oben liegen wie in der Zeichnung
        z, y = -z, -y
    Rref = np.array([x, y, z])  # Zeilen: neue Achsen
    for (typ, b), (atome, bind) in mol.items():
        namen = {n: p for n, _, p in atome}
        P = np.array([namen[n] for n in ZUCKER])
        Q = ref
        R, t, pc = kabsch(P, Q)
        neu = []
        for n, el, p in atome:
            q = Rref @ (R @ p + t - ref_c)
            neu.append([n, el, round(float(q[0]), 3), round(float(q[1]), 3), round(float(q[2]), 3)])
        idx = {a[0]: i for i, a in enumerate(neu)}
        bonds = [[idx[a], idx[c], o] for a, c, o in bind]
        daten.setdefault(typ, {})[b] = {"id": ids_of(typ, b), "atome": neu, "bindungen": bonds}
    return daten


def ids_of(typ, b):
    return KOMPONENTEN[typ][b]


def helixdaten():
    out = {}
    lehrbuch = {"DNA": (36.0, 3.4), "RNA": (32.7, 2.6)}
    for name, form, innen, rna in (("1BNA", "DNA", 2, False), ("1QC0", "RNA", 2, True)):
        verg, pl, rah, kand = H.vorlagen(name, innen)
        u, c, theta, h = H.schraube(rah, innen)
        Rb, Ob, M = H.lage_zur_achse(rah, u, c, theta, h, innen)
        H.FORM[form] = {"theta": theta, "h": h, "Rb": Rb, "Ob": Ob, "vorlage": H.gemeinsames_geruest(kand, rna)}
        H.lage_anpassen(form, *lehrbuch[form])
        F = H.FORM[form]
        if form == "RNA":
            # Thymin in der A-Form-Geometrie (für DNA-Vorlage in einem DNA-RNA-Hybrid): Uracil plus Methylgruppe an C5
            atome = F["vorlage"]["U"]
            pos = {n: np.array(p) for n, p in atome.items()}
            ring = (pos["C4"] + pos["C6"]) / 2
            ri = pos["C5"] - ring
            ri /= np.linalg.norm(ri)
            t = dict(atome)
            t["C7"] = pos["C5"] + 1.50 * ri
            F["vorlage"]["T"] = t
        vorl = {}
        for b, atome in F["vorlage"].items():
            namen = list(atome)
            pts = np.array([atome[n] for n in namen])
            bonds = []
            for i in range(len(namen)):
                for j in range(i + 1, len(namen)):
                    if np.linalg.norm(pts[i] - pts[j]) < 1.85:
                        bonds.append([i, j])
            vorl[b] = {"atome": [[n, n[0], *[round(float(v), 3) for v in atome[n]]] for n in namen], "bindungen": bonds}
        out[form] = {
            "drehung": F["theta"], "anstieg": F["h"],
            "R": [[round(float(v), 5) for v in row] for row in F["Rb"]],
            "O": [round(float(v), 3) for v in F["Ob"]],
            "vorlage": vorl,
        }
    return out


def main():
    holen()
    daten = {"NUKLEOTIDE": nukleotide(), "HELIX": helixdaten()}
    kopf = ("// Nukleotid-Daten (erzeugt von scripts/nukleotide/nuc_daten.py, nicht von Hand ändern).\n"
            "// Quellen: wwPDB Chemical Component Dictionary (DTP, TTP, DGT, DCP, ATP, UTP, GTP, CTP), CC0;\n"
            "// Strukturen 1BNA (B-DNA) und 1QC0 (A-RNA). Abruf 18.10.2026.\n")
    js = kopf + "".join(f"const {k} = {json.dumps(v, separators=(',', ':'), ensure_ascii=False)};\n" for k, v in daten.items())
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(js)
    print(f"{os.path.relpath(OUT, ROOT)}: {len(js) / 1024:.1f} KiB")


if __name__ == "__main__":
    main()
