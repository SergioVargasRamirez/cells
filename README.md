# Biologie-Werkzeuge für den Unterricht

Interaktive Seiten für den Biologie-Unterricht mit den Schwerpunkten Genetik,
Genomik und Biochemie: Erbgänge und Stammbäume, von der DNA zum Protein,
Sequenzen vergleichen, Enzyme und Proteine. Jede Seite ist eine einzelne,
selbstständige HTML-Datei auf GitHub Pages — keine externen Anfragen, auch
Schriften und Daten (Sequenzen, Strukturen) sind eingebettet.

Online: https://cells.biodatum.io · Schwesterprojekt für die Chemie:
[atoms](https://github.com/SergioVargasRamirez/atoms) (https://atoms.biodatum.io)

| Datei | Inhalt | Entstehung |
|---|---|---|
| `index.html` | Startseite mit Karten zu den Werkzeugen, nach Themen gruppiert | von Hand |
| `dna-rna.html` | DNA und RNA: dNTP/NTP in Zeichnung und 3D, Unterschiede finden (weitere Teile folgen, siehe `OFFENE_PUNKTE.txt`) | von Hand, Daten aus `scripts/nukleotide` |
| `basenpaarung.html` | DNA-Synthese: neuen Strang aus dNTPs bauen (Richtung 5'→3', Pyrophosphat), Wasserstoffbrücken entdecken, 3D | Gerüst von Hand, Übung in `template/site/paarung.js` |
| `doppelhelix.html` | Doppelhelix in 3D: beliebige Sequenz eingeben (Text, Datei, Bausteine ziehen), DNA, RNA oder Hybrid | von Hand, Modul `template/site/helix3d.js` |
| `transkription.html` | Transkription: RNA an einer DNA-Vorlage aufbauen (NTPs, Hybrid-Helix in 3D) | wie `basenpaarung.html` |
| `quellen.html` | Quellen und Danksagung, Mitmachen (`#mitmachen`) | von Hand |
| `impressum.html` | Impressum, Haftungsausschluss, Lizenz, Einbetten | von Hand |
| `datenschutz.html` | Datenschutz (keine Cookies, kein Tracking, keine genetischen Daten, Hosting GitHub Pages) | von Hand |

## Gemeinsame Teile: `template/site/` und `build.py`

Was auf allen Seiten gleich ist, steht **an einer Stelle** und wird von
`python3 build.py` in jede Seite kopiert, damit jede Seite eine einzelne,
selbstständige Datei bleibt:

| Quelle | Ziel in jeder Seite |
|---|---|
| `template/site/nav.html` | Seitenmenü (links, auf dem Handy oben mit „Menü“-Knopf), direkt nach `<body>` zwischen `<!--SITENAV-->` und `<!--/SITENAV-->`; die eigene Seite bekommt `aria-current="page"` |
| `template/site/nav.css` | `<style id="sitenav-css">` vor `</head>` |
| `template/site/palette.js`, `nuc-data.js`, `helix.js`, `mol3d.js`, `dna2d.js` | Farbtabelle, Nukleotid-Daten, Helix-Bau, 3D-Ansicht, Strukturformeln: zwischen `/*__MARKE__*/` in `dna-rna.html` und `basenpaarung.html` |
| `template/site/font.css` | `<style id="font-css">` vor `</head>`: Source Sans 3 als woff2, normal und kursiv |

Diese Blöcke in den Seiten nicht von Hand bearbeiten, sie werden beim
nächsten Build überschrieben. Neue Seiten schreibt man ohne sie; `build.py`
fügt sie ein.

**Gemeinsame Skripte und Daten:** Brauchen mehrere Seiten denselben Code
(zum Beispiel eine DNA-Zeichnung oder eine Sequenztabelle), kommt er nach
`template/site/` und in die Liste `SNIPPETS` in `build.py`. Die Seiten
markieren die Stelle mit `/*__MARKE__*/` und `/*__/MARKE__*/`; `build.py`
setzt dazwischen den aktuellen Inhalt der Quelldatei ein. Änderungen also in
`template/site/` machen, nicht in den Seiten.

## Neue Seite

1. `seite.html` anlegen: `<!DOCTYPE html>`, `lang="de"`, `<title>`,
   `<meta name="description">`, eigene Farben als Variablen auf `:root` mit
   hellem und dunklem Schema (Vorlage: `index.html` oder `impressum.html`).
   Ohne Menü und Schrift.
2. Eintrag in der passenden Themengruppe von `template/site/nav.html`
   ergänzen (neue Gruppe mit `<p class="sidenav-group">…</p>` über
   „Über die Seiten“).
3. In `index.html` die Karte der Seite verlinken (`<a class="card" href="…">`
   statt `<div class="card soon">`) bzw. eine neue Karte ergänzen.
4. Quellen der Daten und Modelle in `quellen.html` eintragen: Datenbank,
   Kennung des Eintrags, Abrufdatum, Lizenz der Quelle.
5. Zeile in der Tabelle oben ergänzen.
6. `python3 build.py` ausführen.

Jede Seite mit einer Simulation hat einen Abschnitt „Modell und Grenzen“:
Was zeigt das Modell, wo weicht es von der Wirklichkeit ab? Der
Haftungsausschluss im Impressum verweist darauf.

## Validierung durch `build.py`

Bevor etwas geschrieben wird, prüft `build.py`:

- jeder Link im Menü zeigt auf eine vorhandene Seite,
- jede Seite (außer `index.html`) steht im Menü.

Jeder Fehler nennt die betroffene Datei; dann wird keine Seite verändert.
Außerdem bricht `build.py` ab, wenn einer Seite `</head>` oder `<body>`
fehlt oder eine Marke `/*__MARKE__*/` keine Endmarke hat. Ein zweiter Lauf
ohne Änderungen schreibt nichts.

## Workflow

1. Seite oder `template/site/` bearbeiten.
2. `python3 build.py` ausführen.
3. Seite im Browser öffnen und prüfen (hell und dunkel, schmales Fenster).
4. Änderungen committen und pushen (Quelle unter `template/` und die
   aktualisierten Seiten gehören zusammen in einen Commit).

Ein GitHub-Action-Workflow (`.github/workflows/build.yml`) führt `build.py`
bei jedem Push auf `main`, der Seiten, `template/` oder `build.py` ändert,
zusätzlich aus und committet die aktualisierten Seiten, falls man das selbst
vergisst — der lokale Lauf vorher bleibt aber der schnellere Weg, um Fehler
sofort zu sehen.

## Rechenskripte

`scripts/` ist für Skripte gedacht, die Daten für die Seiten erzeugen
(zum Beispiel Sequenzen oder Strukturen aus öffentlichen Datenbanken holen
und verkleinern). Sie gehören nicht zu den Seiten; Ergebnisse landen in
`results/` und werden nicht eingecheckt. Details in `scripts/README.md`.

## Schrift

Alle Seiten nutzen Source Sans 3 (SIL Open Font License), als variable
woff2-Schrift (normal und kursiv) aus `template/site/font.css` direkt im
`<style>` eingebettet.

## Ordnerstruktur

```
.github/
  FUNDING.yml         — „Sponsor“-Knopf auf GitHub (Buy Me a Coffee)
  workflows/build.yml — führt build.py bei jedem Push aus
template/site/
  nav.html            — Seitenmenü (Einträge nach Themen gruppiert, Schutz vor Einbetten)
  nav.css             — Aussehen des Menüs
  font.css            — eingebettete Schrift
scripts/              — Skripte, die Daten für die Seiten erzeugen (nukleotide/: Nukleotid- und Helixdaten, Test mit node)
build.py              — kopiert Menü, Schrift und gemeinsame Skripte in jede Seite
CNAME                 — Domain für GitHub Pages (cells.biodatum.io)
*.html                — die Seiten, werden von GitHub Pages ausgeliefert
```

## Offen / nächste Schritte

- Die Karten auf der Startseite (Erbgänge, Stammbäume, Von der DNA zum
  Protein, Sequenzen vergleichen, Enzyme bei der Arbeit, Proteine falten)
  sind Vorschläge und als „In Vorbereitung“ markiert; noch keine davon ist
  umgesetzt.
- Jahrgangsstufen (`<span class="tag">`) und Lehrplanbezug ergänzen, sobald
  die Seiten feststehen.
- GitHub Pages für das Repository einschalten und den DNS-Eintrag für
  `cells.biodatum.io` setzen.

## Lizenz

© 2026 Dr. Sergio Vargas, biodatum.io. Seiten, Texte, Abbildungen, Quellcode
und Daten stehen unter [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.de)
(Namensnennung – Nicht kommerziell – Weitergabe unter gleichen Bedingungen),
vollständiger Text in `LICENSE`. Zur Namensnennung gehört verbindlich der
Verweis auf https://cells.biodatum.io: „Biologie-Werkzeuge für den Unterricht“,
Dr. Sergio Vargas, biodatum.io, https://cells.biodatum.io, CC BY-NC-SA 4.0.
Kommerzielle Nutzung nur mit gesonderter Lizenz: info@biodatum.io.
Ausgenommen sind die eingebettete Schrift Source Sans 3 (SIL Open Font
License 1.1) und Daten aus öffentlichen Datenbanken, die die Bedingungen
ihrer Quelle behalten (siehe `quellen.html`). Die Inhalte werden ohne Gewähr
bereitgestellt; siehe `impressum.html` (Haftungsausschluss) und
`datenschutz.html`.

## Mitmachen

Fehler und Wünsche bitte als Issue melden:
https://github.com/SergioVargasRamirez/cells/issues. Fachliche Fehler am
besten mit Quelle (Kennung des Datenbankeintrags oder Fachartikel).
Verbesserungen gern als Pull Request. Ohne GitHub-Konto: info@biodatum.io.

Wer das Projekt unterstützen möchte:
[Kaffee spendieren](https://buymeacoffee.com/sergiovargasramirez).

Die Seiten dürfen nicht in andere Webseiten eingebettet werden. GitHub Pages
kann keine HTTP-Header wie `X-Frame-Options` setzen; deshalb blendet ein
Skript im Seitenmenü (`template/site/nav.html`) die Seite in fremden Rahmen
aus und zeigt nur einen Link.
