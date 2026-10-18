#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
export_ubq.py — schreibt template/site/ubq-data.js (Ubiquitin für proteinstruktur.html).

Quelle: RCSB PDB, Eintrag 1UBQ (Ubiquitin, Röntgenstruktur, 1,8 Å; Vijay-Kumar, Bugg und Cook 1987,
J. Mol. Biol. 194: 531). Abruf 18.10.2026 von files.rcsb.org/download/1UBQ.pdb (Datei in results/protein/).
Enthalten sind die schweren Atome der 76 Reste der Kette A (ohne Wasser) und die Sekundärstruktur
aus den HELIX- und SHEET-Zeilen der Datei: H = α-Helix, G = 3₁₀-Helix, E = β-Strang, C = Schleife.

Aufruf:  python3 scripts/protein/export_ubq.py
"""
import json
import os
import urllib.request
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PDB = os.path.join(ROOT, "results", "protein", "1UBQ.pdb")
OUT = os.path.join(ROOT, "template", "site", "ubq-data.js")
DREI = {"ALA": "Ala", "ARG": "Arg", "ASN": "Asn", "ASP": "Asp", "CYS": "Cys", "GLN": "Gln", "GLU": "Glu", "GLY": "Gly", "HIS": "His", "ILE": "Ile",
        "LEU": "Leu", "LYS": "Lys", "MET": "Met", "PHE": "Phe", "PRO": "Pro", "SER": "Ser", "THR": "Thr", "TRP": "Trp", "TYR": "Tyr", "VAL": "Val"}


# Maximale Zugänglichkeit einer Aminosäure im Tripeptid Gly-X-Gly (Å², theoretische Werte nach Tien et al. 2013, PLoS ONE 8: e80635)
MAX_ASA = {"Ala": 129, "Arg": 274, "Asn": 195, "Asp": 193, "Cys": 167, "Gln": 225, "Glu": 223, "Gly": 104, "His": 224, "Ile": 197,
           "Leu": 201, "Lys": 236, "Met": 224, "Phe": 240, "Pro": 159, "Ser": 155, "Thr": 172, "Trp": 285, "Tyr": 263, "Val": 174}
RADIUS = {"C": 1.70, "N": 1.55, "O": 1.52, "S": 1.80}


def zugaenglichkeit(reste, punkte=400, sonde=1.4):
    """Shrake-Rupley: Lösungsmittel-zugängliche Oberfläche je Rest (nur schwere Atome des Proteins), relativ zum Maximalwert."""
    xyz, rad, res = [], [], []
    for i, r in enumerate(reste):
        for name, x, y, z in r["atome"]:
            xyz.append([x, y, z]); rad.append(RADIUS[name[0]] + sonde); res.append(i)
    xyz, rad, res = np.array(xyz), np.array(rad), np.array(res)
    # Kugelpunkte nach der Fibonacci-Spirale
    k = np.arange(punkte) + 0.5; phi = np.arccos(1 - 2 * k / punkte); th = np.pi * (1 + 5 ** 0.5) * k
    kugel = np.stack([np.cos(th) * np.sin(phi), np.sin(th) * np.sin(phi), np.cos(phi)], axis=1)
    asa = np.zeros(len(reste))
    d = np.linalg.norm(xyz[:, None] - xyz[None], axis=2)
    for a in range(len(xyz)):
        nahe = np.where((d[a] < rad[a] + rad + 1e-9) & (np.arange(len(xyz)) != a))[0]
        p = xyz[a] + rad[a] * kugel
        frei = np.ones(punkte, bool)
        for b in nahe:
            frei &= np.linalg.norm(p - xyz[b], axis=1) >= rad[b]
        asa[res[a]] += frei.sum() / punkte * 4 * np.pi * rad[a] ** 2
    return [float(asa[i] / MAX_ASA[r["aa"]]) for i, r in enumerate(reste)]


def main():
    if not os.path.isfile(PDB):
        os.makedirs(os.path.dirname(PDB), exist_ok=True)
        urllib.request.urlretrieve("https://files.rcsb.org/download/1UBQ.pdb", PDB)
    zeilen = open(PDB).read().splitlines()
    res, atome = [], {}
    for z in zeilen:
        if z.startswith("ATOM") and z[21] == "A":
            nr = int(z[22:26]); name = z[12:16].strip()
            if z[16] not in " A": continue
            if nr not in atome:
                atome[nr] = []; res.append((nr, DREI[z[17:20]]))
            atome[nr].append([name, round(float(z[30:38]), 2), round(float(z[38:46]), 2), round(float(z[46:54]), 2)])
    ss = {nr: "C" for nr, _ in res}
    for z in zeilen:
        if z.startswith("HELIX"):
            a, b, klasse = int(z[21:25]), int(z[33:37]), int(z[38:40])
            for k in range(a, b + 1): ss[k] = "H" if klasse == 1 else "G"
        elif z.startswith("SHEET"):
            a, b = int(z[22:26]), int(z[33:37])
            for k in range(a, b + 1): ss[k] = "E"
    rsa = zugaenglichkeit([{"aa": aa, "atome": atome[nr]} for nr, aa in res])
    daten = {"quelle": "RCSB PDB 1UBQ, Ubiquitin, Abruf 18.10.2026",
             "reste": [{"nr": nr, "aa": aa, "ss": ss[nr], "rsa": round(rsa[i], 2), "atome": atome[nr]} for i, (nr, aa) in enumerate(res)]}
    kopf = ("// Ubiquitin (1UBQ), erzeugt von scripts/protein/export_ubq.py, nicht von Hand ändern.\n"
            "// Quelle: RCSB PDB 1UBQ (Vijay-Kumar, Bugg und Cook 1987), Abruf 18.10.2026; schwere Atome der Kette A, ohne Wasser.\n")
    js = kopf + "const UBQ = " + json.dumps(daten, separators=(",", ":"), ensure_ascii=False) + ";\n"
    with open(OUT, "w", encoding="utf-8") as f: f.write(js)
    n = sum(len(r["atome"]) for r in daten["reste"])
    print(f"{os.path.relpath(OUT, ROOT)}: {len(daten['reste'])} Reste, {n} Atome, {len(js) / 1024:.1f} KiB; Sekundärstruktur: " +
          ", ".join(f"{k} {sum(1 for v in ss.values() if v == k)}" for k in "HGEC"))
    print("Sequenz:", "".join({v: k for k, v in {"A": "Ala", "R": "Arg", "N": "Asn", "D": "Asp", "C": "Cys", "Q": "Gln", "E": "Glu", "G": "Gly", "H": "His", "I": "Ile", "L": "Leu", "K": "Lys", "M": "Met", "F": "Phe", "P": "Pro", "S": "Ser", "T": "Thr", "W": "Trp", "Y": "Tyr", "V": "Val"}.items()}[aa] for _, aa in res))


if __name__ == "__main__":
    main()
