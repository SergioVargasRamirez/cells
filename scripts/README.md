# Skripte

Skripte, die Daten für die Seiten erzeugen, zum Beispiel Sequenzen, Annotationen
oder Strukturen aus öffentlichen Datenbanken holen, auf das Nötige verkleinern und
als JavaScript nach `template/site/` schreiben. Von dort kopiert `build.py` sie in
die Seiten (siehe `SNIPPETS` in `build.py`).

Regeln:

- Ein Unterordner je Thema, zum Beispiel `scripts/sequenzen/`.
- Zwischenergebnisse und Rohdaten landen in `results/` und werden nicht
  eingecheckt (siehe `.gitignore`); eingecheckt werden nur die Skripte und die
  fertigen, kleinen Dateien unter `template/site/`.
- Jedes Skript nennt oben die Datenbank, die Kennungen der Einträge und die
  Lizenz der Quelle. Dieselben Angaben und das Abrufdatum kommen nach
  `quellen.html`.
- Die Seiten selbst laden nie etwas aus dem Netz; nur die Skripte tun das.
