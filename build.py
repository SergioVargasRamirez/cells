#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build.py — copies the shared parts of the site into every page, so that each
page stays a single, self-contained HTML file:

  - the embedded font (template/site/font.css),
  - the side menu (template/site/nav.html + nav.css),
  - shared scripts and data between /*__MARKE__*/ markers (see SNIPPETS).

Usage:
    python3 build.py

Before writing anything it checks that every link in the menu points to an
existing page and that every page is reachable from the menu. Any problem is
reported with the exact file, and no page is changed.
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.join(ROOT, "template", "site")

# Seiten, die absichtlich nicht im Menü stehen (die Startseite erreicht man über den Titel).
NOT_IN_MENU = {"index.html"}


def read_file(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def pages():
    return sorted(f for f in os.listdir(ROOT) if f.endswith(".html"))


def write_if_changed(path, old, new, changed):
    if new != old:
        with open(path, "w", encoding="utf-8") as f:
            f.write(new)
        changed.append(os.path.relpath(path, ROOT))


# ---------------------------------------------------------------------------
# Schrift und Seitenmenü
# ---------------------------------------------------------------------------
# Quelle: template/site/font.css (Source Sans 3 als woff2, base64),
# template/site/nav.html (Markup) und template/site/nav.css (Stil).
# Alles wird in jede Seite kopiert; der Menüpunkt der eigenen Seite bekommt
# aria-current="page". Schrift und Menü-CSS stehen direkt vor </head>.

NAV_BLOCK_RE = re.compile(r'<!--SITENAV-->.*?<!--/SITENAV-->\n?', re.S)
NAV_CSS_RE = re.compile(r'<style id="sitenav-css">.*?</style>\n?', re.S)
FONT_CSS_RE = re.compile(r'<style id="font-css">.*?</style>\n?', re.S)


def sync_font_and_nav():
    font = read_file(os.path.join(SITE, "font.css")).strip()
    nav = read_file(os.path.join(SITE, "nav.html")).strip()
    css = read_file(os.path.join(SITE, "nav.css")).strip()
    changed = []
    for name in pages():
        path = os.path.join(ROOT, name)
        html = read_file(path)
        href = "./" if name == "index.html" else name
        own = nav.replace(f'href="{href}"', f'href="{href}" aria-current="page"', 1)
        block = f"<!--SITENAV-->\n{own}\n<!--/SITENAV-->\n"
        new = NAV_BLOCK_RE.sub("", html)
        new, n = re.subn(r"(<body[^>]*>\n?)", lambda m: m.group(1) + block, new, count=1)
        if not n:
            print(f"FEHLER: {name}: kein <body> gefunden", file=sys.stderr)
            sys.exit(1)
        new = NAV_CSS_RE.sub("", FONT_CSS_RE.sub("", new))
        if "</head>" not in new:
            print(f"FEHLER: {name}: kein </head> gefunden", file=sys.stderr)
            sys.exit(1)
        new = new.replace("</head>", f'<style id="font-css">\n{font}\n</style>\n'
                                     f'<style id="sitenav-css">\n{css}\n</style>\n</head>', 1)
        write_if_changed(path, html, new, changed)
    print(f"Schrift und Menü: {len(pages())} Seiten geprüft, aktualisiert: {', '.join(changed) if changed else 'keine'}.")


# ---------------------------------------------------------------------------
# Gemeinsame Skripte und Daten
# ---------------------------------------------------------------------------
# Seiten, die zwischen /*__MARKE__*/ und /*__/MARKE__*/ stehen haben, bekommen
# dort den aktuellen Inhalt der Quelldatei aus template/site/ eingesetzt.
# Neuer Eintrag: (MARKE, Dateiname, Bezeichnung), zum Beispiel
#   ("DNA", "dna.js", "DNA-Zeichnung")

SNIPPETS = []


def sync_snippet(tag, source, label):
    code = read_file(os.path.join(SITE, source)).rstrip() + "\n"
    pattern = re.compile(rf"(/\*__{tag}__\*/\n).*?(/\*__/{tag}__\*/)", re.S)
    changed, users = [], 0
    for name in pages():
        path = os.path.join(ROOT, name)
        html = read_file(path)
        if f"/*__{tag}__*/" not in html:
            continue
        users += 1
        if f"/*__/{tag}__*/" not in html:
            print(f"FEHLER: {name}: Marke /*__{tag}__*/ ohne passende Endmarke", file=sys.stderr)
            sys.exit(1)
        new = pattern.sub(lambda m: m.group(1) + code + m.group(2), html)
        write_if_changed(path, html, new, changed)
    print(f"{label}: {users} Seiten, aktualisiert: {', '.join(changed) if changed else 'keine'}.")


# ---------------------------------------------------------------------------
# Prüfen
# ---------------------------------------------------------------------------

def check_menu():
    nav = re.search(r"<nav\b.*?</nav>", read_file(os.path.join(SITE, "nav.html")), re.S).group(0)
    targets = {h.split("#")[0] for h in re.findall(r'href="([^"]+)"', nav)
               if not h.startswith(("http:", "https:", "mailto:"))}
    targets = {"index.html" if t in ("./", "") else t for t in targets}
    errors = [f"template/site/nav.html: Link auf '{t}', die Seite gibt es nicht"
              for t in sorted(targets) if not os.path.isfile(os.path.join(ROOT, t))]
    errors += [f"{p}: steht nicht im Menü (template/site/nav.html)"
               for p in pages() if p not in targets and p not in NOT_IN_MENU]
    if errors:
        print(f"build.py: {len(errors)} Fehler gefunden:\n", file=sys.stderr)
        for e in errors:
            print(" - " + e, file=sys.stderr)
        sys.exit(1)


def main():
    check_menu()
    for tag, source, label in SNIPPETS:
        sync_snippet(tag, source, label)
    sync_font_and_nav()
    print("OK.")


if __name__ == "__main__":
    main()
