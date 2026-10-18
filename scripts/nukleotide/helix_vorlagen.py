#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
helix_vorlagen.py — schneidet aus zwei Kristallstrukturen je eine Nukleotid-Vorlage
pro Base aus und bestimmt die Schraubenparameter der Helix.

Quellen (wwPDB, Daten frei nutzbar, CC0):
  1BNA  B-DNA, CGCGAATTCGCG, 1,9 Å (Drew et al. 1981, PNAS 78, 2179)
        Ketten A (1-12) und B (13-24), Paar A i <-> B 25-i
  1QC0  A-RNA, 19 bp, 1,55 Å (Klosterman et al. 2004, NAR 32, 2342)
        Ketten C (101-119) und D (120-138), Paar C 101+i <-> D 138-i
Abruf: 18.10.2026 von files.rcsb.org (Dateien liegen in results/nukleotide/).

Vorgehen
 1. Je Basenpaar ein Koordinatensystem: Ursprung in der Mitte der beiden C1'-Atome,
    y entlang C1'->C1', z senkrecht zur Basenebene (Richtung 5'->3' von Strang 1),
    x = y × z. Die Pseudo-Dyade des Paares ist die x-Achse (180°-Drehung tauscht die Stränge).
 2. Alle Reste werden in dieses System gerechnet; Reste des zweiten Strangs werden um x
    um 180° gedreht, sehen dann wie Reste des ersten Strangs aus.
 3. Pro Base wird der "mittlere" echte Rest gewählt (kleinste Summe der Abstände zu den
    anderen), nicht ein Mittel, damit Bindungslängen echt bleiben.
 4. Schraube: Aus den Übergängen zwischen aufeinanderfolgenden Paaren (innere Paare)
    Drehwinkel, Anstieg, Achse; daraus Lage des ersten Paares zur Achse.

Aufruf: python3 scripts/nukleotide/helix_vorlagen.py   (schreibt results/nukleotide/vorlagen.json)
"""
import json
import os
import sys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA = os.path.join(ROOT, "results", "nukleotide")

BACKBONE = ["P", "OP1", "OP2", "O5'", "C5'", "C4'", "O4'", "C3'", "O3'", "C2'", "C1'", "O2'"]


def lies_pdb(name):
    res = {}
    for line in open(os.path.join(DATA, name + ".pdb")):
        if not line.startswith("ATOM"):
            continue
        atom = line[12:16].strip().replace("*", "'")
        atom = {"O1P": "OP1", "O2P": "OP2"}.get(atom, atom)
        if line[16] not in " A":
            continue
        key = (line[21], int(line[22:26]))
        d = res.setdefault(key, {"resn": line[17:20].strip(), "atoms": {}})
        d["atoms"][atom] = np.array([float(line[30:38]), float(line[38:46]), float(line[46:54])])
    return res


def basenname(resn):
    return resn[-1]  # DA -> A, U -> U


def paare(name):
    """Liste von (rest1, rest2) in Reihenfolge 5'->3' von Strang 1."""
    res = lies_pdb(name)
    out = []
    if name == "1BNA":
        for i in range(1, 13):
            out.append((res[("A", i)], res[("B", 25 - i)]))
    elif name == "1QC0":
        for i in range(19):
            out.append((res[("C", 101 + i)], res[("D", 138 - i)]))
    return out


def basis_atome(r):
    return [v for k, v in r["atoms"].items() if k not in BACKBONE and not k.startswith("H")]


def rahmen(paare_liste):
    """Koordinatensystem je Paar als (R, O); z in Richtung der Helix."""
    teil = []
    for r1, r2 in paare_liste:
        pts = np.array(basis_atome(r1) + basis_atome(r2))
        c = pts.mean(axis=0)
        n = np.linalg.svd(pts - c)[2][2]
        o = (r1["atoms"]["C1'"] + r2["atoms"]["C1'"]) / 2
        teil.append([n, o])
    achse = teil[-1][1] - teil[0][1]
    out = []
    for n, o in teil:
        if np.dot(n, achse) < 0:
            n = -n
        out.append((n, o))
    rahm = []
    for (n, o), (r1, r2) in zip(out, paare_liste):
        y = r2["atoms"]["C1'"] - r1["atoms"]["C1'"]
        y = y - np.dot(y, n) * n
        y /= np.linalg.norm(y)
        x = np.cross(y, n)
        rahm.append((np.array([x, y, n]).T, o))
    return rahm


RX = np.diag([1.0, -1.0, -1.0])


def lokal(rest, R, O, zweiter):
    out = {}
    for k, v in rest["atoms"].items():
        if k.startswith("H"):
            continue
        p = R.T @ (v - O)
        out[k] = RX @ p if zweiter else p
    return out


def vorlagen(name, innen):
    pl = paare(name)
    rah = rahmen(pl)
    kandidaten = {}
    for i, ((r1, r2), (R, O)) in enumerate(zip(pl, rah)):
        if i < innen or i >= len(pl) - innen:
            continue
        for rest, zw in ((r1, False), (r2, True)):
            a = lokal(rest, R, O, zw)
            if not all(k in a for k in ("P", "OP1", "OP2", "O5'", "O3'", "C1'")):
                continue
            kandidaten.setdefault(basenname(rest["resn"]), []).append(a)
    ergebnis = {}
    for b, liste in kandidaten.items():
        gemeinsam = sorted(set.intersection(*[set(a) for a in liste]))
        m = np.array([[a[k] for k in gemeinsam] for a in liste])
        d = np.array([[np.sqrt(((m[i] - m[j]) ** 2).sum(axis=1).mean()) for j in range(len(m))] for i in range(len(m))])
        best = int(d.sum(axis=1).argmin())
        ergebnis[b] = (liste[best], len(liste), float(d[best].mean()))
    return ergebnis, pl, rah, kandidaten


def rot_mittel(Rs):
    u, _, vt = np.linalg.svd(np.mean(Rs, axis=0))
    return u @ vt


def schraube(rah, innen):
    Rs, ts = [], []
    for k in range(innen, len(rah) - innen - 1):
        (R0, O0), (R1, O1) = rah[k], rah[k + 1]
        RS = R1 @ R0.T
        Rs.append(RS)
        ts.append(O1 - RS @ O0)
    RS = rot_mittel(Rs)
    t = np.mean(ts, axis=0)
    w, v = np.linalg.eig(RS)
    u = np.real(v[:, np.argmin(abs(w - 1))])
    u /= np.linalg.norm(u)
    # Drehwinkel um u
    cos = (np.trace(RS) - 1) / 2
    sin = np.dot(u, [RS[2, 1] - RS[1, 2], RS[0, 2] - RS[2, 0], RS[1, 0] - RS[0, 1]]) / 2
    theta = np.degrees(np.arctan2(sin, cos))
    if np.dot(u, t) < 0:
        u = -u
        theta = -theta
    h = float(np.dot(u, t))
    tp = t - h * u
    # Punkt c auf der Achse: (I - RS) c = tp (in der Ebene senkrecht zu u)
    c = np.linalg.lstsq(np.eye(3) - RS, tp, rcond=None)[0]
    c = c - np.dot(c, u) * u
    return u, c, float(theta), h


def achsensystem(u):
    z = u / np.linalg.norm(u)
    a = np.array([1.0, 0, 0]) if abs(z[0]) < 0.9 else np.array([0, 1.0, 0])
    x = np.cross(a, z)
    x /= np.linalg.norm(x)
    y = np.cross(z, x)
    return np.array([x, y, z])  # Zeilen: Weltachsen in der Schraubenachsen-Basis


def rz(deg):
    a = np.radians(deg)
    return np.array([[np.cos(a), -np.sin(a), 0], [np.sin(a), np.cos(a), 0], [0, 0, 1]])


def lage_zur_achse(rah, u, c, theta, h, innen):
    M = achsensystem(u)
    Rb, Ob = [], []
    for k, (R, O) in enumerate(rah):
        if k < innen or k >= len(rah) - innen:
            continue
        Rk = M @ R
        Ok = M @ (O - c)
        kk = k - innen
        Rb.append(rz(-kk * theta) @ Rk)
        Ob.append(rz(-kk * theta) @ (Ok - np.array([0, 0, kk * h])))
    return rot_mittel(Rb), np.mean(Ob, axis=0), M


def bauen(seq1, seq2, form):
    """Atome eines Duplex: Liste (strang, index, name, element, xyz). seq2 liest man 5'->3' gegen den Strang."""
    V = FORM[form]
    out = []
    n = len(seq1)
    for k in range(n):
        R = rz(k * V["theta"]) @ V["Rb"]
        O = rz(k * V["theta"]) @ V["Ob"] + np.array([0, 0, k * V["h"]])
        for strang, b in ((1, seq1[k]), (2, seq2[n - 1 - k])):
            tmpl = V["vorlage"][b]
            for name, p in tmpl.items():
                q = RX @ p if strang == 2 else p
                out.append((strang, k, name, R @ q + O))
    return out


FORM = {}

GERUEST = ["P", "OP1", "OP2", "O5'", "C5'", "C4'", "O4'", "C3'", "O3'", "C2'", "C1'"]


def gemeinsames_geruest(kandidaten, rna):
    """Ein Zucker-Phosphat-Gerüst für alle Basen (echter Rest, der dem Mittel am nächsten liegt);
    nur die Base unterscheidet sich. So ist der O3'-P-Abstand unabhängig von der Sequenz."""
    namen = GERUEST + (["O2'"] if rna else [])
    alle = [a for liste in kandidaten.values() for a in liste if all(k in a for k in namen)]
    m = np.array([[a[k] for k in namen] for a in alle])
    mittel = m.mean(axis=0)
    best = int(np.argmin(((m - mittel) ** 2).sum(axis=(1, 2))))
    geruest = {k: alle[best][k] for k in namen}
    vorl = {}
    for b, liste in kandidaten.items():
        gem = sorted(set.intersection(*[set(a) for a in liste]))
        mm = np.array([[a[k] for k in gem] for a in liste])
        d = np.array([[np.sqrt(((mm[i] - mm[j]) ** 2).sum(axis=1).mean()) for j in range(len(mm))] for i in range(len(mm))])
        a = liste[int(d.sum(axis=1).argmin())]
        versatz = geruest["C1'"] - a["C1'"]
        t = dict(geruest)
        for k, v in a.items():
            if k not in BACKBONE:
                t[k] = v + versatz
        vorl[b] = t
    return vorl


def rotvec(v):
    from scipy.spatial.transform import Rotation
    return Rotation.from_rotvec(v).as_matrix()


def lage_anpassen(form, theta, h, ziel=1.60):
    """Drehwinkel und Anstieg fest (Lehrbuchwerte), nur die Lage der Basenpaare zur Achse
    (Verschiebung, Kippung) so klein wie möglich ändern, bis O3'-P in beiden Strängen 1,60 Å misst."""
    from scipy.optimize import least_squares
    F = FORM[form]
    F["theta_gemessen"], F["h_gemessen"] = F["theta"], F["h"]
    F["theta"], F["h"] = theta, h
    Rb0, Ob0 = F["Rb"].copy(), F["Ob"].copy()
    tm = F["vorlage"]["A"]

    def links(x):
        Rb, Ob = rotvec(x[0:3]) @ Rb0, Ob0 + x[3:6]
        R1, O1 = rz(theta) @ Rb, rz(theta) @ Ob + np.array([0, 0, h])
        d1 = np.linalg.norm((Rb @ tm["O3'"] + Ob) - (R1 @ tm["P"] + O1))
        d2 = np.linalg.norm((R1 @ (RX @ tm["O3'"]) + O1) - (Rb @ (RX @ tm["P"]) + Ob))
        return d1, d2

    r = least_squares(lambda x: [links(x)[0] - ziel, links(x)[1] - ziel, 0.2 * np.linalg.norm(x[0:3]),
                                 0.01 * np.linalg.norm(x[3:6])], np.zeros(6))
    x = r.x
    F["Rb"], F["Ob"] = rotvec(x[0:3]) @ Rb0, Ob0 + x[3:6]
    print(f"   Lage angepasst: Verschiebung {np.linalg.norm(x[3:6]):.2f} Å, Kippung {np.degrees(np.linalg.norm(x[0:3])):.1f}°, "
          f"O3'-P {links(x)[0]:.2f}/{links(x)[1]:.2f} Å (Strang 1/2)")


def kette_abstaende(atoms, n):
    """O3'(k)-P(k+1) im Strang 1 und O3'(k+1)-P(k) im Strang 2."""
    d = {(s, k, name): p for s, k, name, p in atoms}
    out1 = [np.linalg.norm(d[(1, k, "O3'")] - d[(1, k + 1, "P")]) for k in range(n - 1)]
    out2 = [np.linalg.norm(d[(2, k + 1, "O3'")] - d[(2, k, "P")]) for k in range(n - 1)]
    return out1, out2


def main():
    zusammen = {}
    lehrbuch = {"DNA": (36.0, 3.4), "RNA": (32.7, 2.6)}
    for name, form, innen, rna in (("1BNA", "DNA", 2, False), ("1QC0", "RNA", 2, True)):
        verg, pl, rah, kand = vorlagen(name, innen)
        u, c, theta, h = schraube(rah, innen)
        Rb, Ob, M = lage_zur_achse(rah, u, c, theta, h, innen)
        FORM[form] = {"theta": theta, "h": h, "Rb": Rb, "Ob": Ob, "vorlage": gemeinsames_geruest(kand, rna)}
        lage_anpassen(form, *lehrbuch[form])
        print(f"{form} ({name}) gemessen: Drehwinkel {theta:.2f}°, Anstieg {h:.2f} Å, {360 / abs(theta):.2f} bp/Windung; "
              f"verwendet: {lehrbuch[form][0]}°, {lehrbuch[form][1]} Å")
        for b, (t, anz, ab) in verg.items():
            print(f"   Vorlage {b}: aus {anz} Resten, mittlere Abweichung {ab:.2f} Å, {len(t)} Atome")
        zusammen[form] = verg

    rng = np.random.default_rng(1)
    for form, alph in (("DNA", "ACGT"), ("RNA", "ACGU")):
        comp = {"A": "T" if form == "DNA" else "U", "T": "A", "U": "A", "G": "C", "C": "G"}
        alle1, alle2 = [], []
        for _ in range(40):
            s1 = "".join(rng.choice(list(alph), 12))
            s2 = "".join(comp[x] for x in s1[::-1])  # 5'->3' des Gegenstrangs
            at = bauen(s1, s2, form)
            a, b = kette_abstaende(at, 12)
            alle1 += a
            alle2 += b
        al = np.array(alle1 + alle2)
        print(f"{form}: O3'-P-Abstand (Soll 1,60 Å): Mittel {al.mean():.2f}, Min {al.min():.2f}, Max {al.max():.2f}, "
              f"Anteil innerhalb ±0,3 Å: {np.mean(abs(al - 1.6) < 0.3):.0%}")


if __name__ == "__main__":
    main()
