// Test für template/site/gen.js: Aufruf  node scripts/transkription/test_gen.js
// Prüft die erzeugten Gene, geht alle Anordnungen für 2, 3 und 4 Exons durch, prüft Vorrat und Spleißen.
const fs = require("fs"), path = require("path"), vm = require("vm");
const ctx = {}; vm.createContext(ctx);
const site = n => fs.readFileSync(path.join(__dirname, "..", "..", "template", "site", n), "utf8");
vm.runInContext(site("code.js") + "\n" + site("gen.js") + "\nglobalThis.G = GEN; globalThis.C = GENCODE;", ctx);
const G = ctx.G, C = ctx.C;
let fehler = 0;
const pruefe = (ok, text) => { if (!ok){ fehler++; console.log("FEHLER:", text); } };
const fak = n => n <= 1 ? 1 : n * fak(n - 1);

// Erzeugte Gene
const verteilung = {}, längen = {exon: new Set(), intron: new Set()};
for (let i = 0; i < 2000; i++){
  const g = G.erzeuge(Math.random);
  verteilung[g.k] = (verteilung[g.k] || 0) + 1;
  const b = g.bausteine;
  pruefe(g.k >= 2 && g.k <= 4 && g.n === 2 * g.k + 1 && b.length === g.n, "Anzahl der Bausteine passt zu k=" + g.k);
  pruefe(b[0].key === "prom" && b[0].seq === "TATAAA" && b[0].tata.join() === "0,5", "Promotor mit TATA-Box");
  pruefe(b[g.n - 1].key === "term" && b[g.n - 1].seq === "TTTTTT", "Terminator ist ein Poly-U-Stück");
  pruefe(g.soll.join() === ["prom", ...Array.from({length: g.k}, (_, j) => j < g.k - 1 ? ["exon", "intron"] : ["exon"]).flat(), "term"].join(), "Typenfolge des Gens");
  for (const x of b) pruefe(/^[ACGT]+$/.test(x.seq), x.name + ": nur ACGT");
  for (const x of b.filter(x => x.key === "intron")){ pruefe(/^GT[ACGT]{3,6}AG$/.test(x.seq) && x.seq.length >= 7 && x.seq.length <= 10, "Intron GU…AG, 7 bis 10 Basen: " + x.seq); längen.intron.add(x.seq.length); }
  for (const x of b.filter(x => x.key === "exon")){ pruefe(x.seq.length >= 4 && x.seq !== "TTTTTT" && x.seq !== "TATAAA", "Exon mindestens 4 Basen, nicht mit Terminator oder TATA-Box verwechselbar: " + x.seq); längen.exon.add(x.seq.length); }
  // Die Exons ergeben zusammen die mRNA mit dem Miniprotein
  const exons = b.filter(x => x.key === "exon").map(x => x.seq), mrna = exons.join("").replace(/T/g, "U");
  pruefe(mrna === g.mrna, "Exons ergeben zusammen die mRNA");
  const tr = G.uebersetze(g.mrna);
  pruefe(tr.kurz === g.peptid && tr.stopp && tr.aa[0] === "Met", "Translation ergibt das Peptid " + g.peptid + ": " + tr.kurz);
  pruefe(g.peptid.length >= 11, "Peptid hat mindestens 10 Aminosäuren (plus Met): " + g.peptid.length);
  pruefe(tr.start >= 1 && tr.start <= 2 && g.mrna.length - (tr.start + 3 * (tr.aa.length + 1)) >= 1 && g.mrna.length - (tr.start + 3 * (tr.aa.length + 1)) <= 2, "UTR vorn und hinten 1 bis 2 Basen");
  pruefe(!g.mrna.slice(0, tr.start).includes("AUG"), "kein AUG vor dem Startcodon");
  pruefe(G.breite(g, 872, 6) >= 9, "volle Reihe passt mit Basenbreite >= 9 (k=" + g.k + "): " + G.breite(g, 872, 6));
  if (g.k === 4) pruefe(g.peptidName === "Chignolin", "bei vier Exons das kürzere Peptid");
}
pruefe(längen.exon.size >= 15 && längen.intron.size === 4, "Längen sind verschieden: Exons " + [...längen.exon].sort((a, b) => a - b) + ", Introns " + [...längen.intron].sort());
pruefe([2, 3, 4].every(k => verteilung[k] > 400), "Zahl der Exons ist zufällig verteilt: " + JSON.stringify(verteilung));

// Alle Anordnungen für jede Exon-Zahl
const perm = (a) => a.length <= 1 ? [a] : a.flatMap((x, i) => perm([...a.slice(0, i), ...a.slice(i + 1)]).map(r => [x, ...r]));
for (const k of [2, 3, 4]){
  const g = G.erzeuge(Math.random, k), alle = perm(g.bausteine.map((b, i) => i));
  const richtige = alle.filter(a => G.analysiere(g, a).ok);
  pruefe(richtige.length === fak(k - 1), `k=${k}: ${fak(k - 1)} richtige Anordnungen von ${alle.length} (Exons in der Reihenfolge ihrer Nummern, Introns austauschbar), gefunden ${richtige.length}`);
  pruefe(richtige.every(a => G.rna(g, G.analysiere(g, a).teile.filter(id => g.bausteine[id].key === "exon")) === g.mrna), `k=${k}: richtige Anordnungen ergeben die mRNA des Gens`);
  pruefe(richtige.every(a => a.map(id => g.bausteine[id].key).join() === g.soll.join()), `k=${k}: richtige Anordnungen haben die Typenfolge des Gens`);
  for (const a of richtige){
    const sp = G.spleisse(g, G.analysiere(g, a).teile);
    if (sp.entfernt.length !== k - 1 || sp.rest.length !== k || !sp.rest.every(id => g.bausteine[id].key === "exon") || sp.abgespalten !== g.n - 1){ pruefe(false, "Spleißen einer richtigen Anordnung"); break; }
  }
  for (const a of alle){
    const r = G.analysiere(g, a);
    if (r.vonPlatz !== r.p + 1 || r.bisPlatz < r.vonPlatz || r.bisPlatz > g.n) { pruefe(false, "Grenzen der Anordnung " + a.join("")); break; }
  }
}

// Nebeneinander: zwei Exons oder zwei Introns sind nicht erlaubt, leere Plätze trennen
for (const k of [2, 3, 4]){
  const g = G.erzeuge(Math.random, k), alle = perm(g.bausteine.map((b, i) => i));
  const typ = id => g.bausteine[id].key;
  const erlaubt = alle.filter(a => G.erlaubt(g, a));
  pruefe(alle.filter(a => G.analysiere(g, a).ok).every(a => G.erlaubt(g, a)), `k=${k}: jede richtige Anordnung ist erlaubt`);
  pruefe(erlaubt.every(a => a.every((id, s) => s === 0 || !(typ(id) === typ(a[s - 1]) && (typ(id) === "exon" || typ(id) === "intron")))), `k=${k}: erlaubte Anordnungen haben nie zwei gleiche Typen (Exon, Intron) nebeneinander`);
  pruefe(erlaubt.length > 0 && erlaubt.length < alle.length, `k=${k}: ${erlaubt.length} von ${alle.length} Anordnungen sind erlaubt`);
  const leer = Array(g.n).fill(null);
  pruefe(G.erlaubt(g, leer), "leere DNA ist erlaubt");
  const ex = g.bausteine.map((b, i) => i).filter(i => typ(i) === "exon");
  const zwei = leer.slice(); zwei[0] = ex[0]; zwei[1] = ex[1];
  const getrennt = leer.slice(); getrennt[0] = ex[0]; getrennt[2] = ex[1];
  pruefe(!G.erlaubt(g, zwei) && G.erlaubt(g, getrennt), `k=${k}: zwei Exons nebeneinander nicht, mit Lücke schon`);
  // Man kann aus jedem erlaubten Zustand eine richtige Anordnung erreichen (Bausteine lassen sich auch wieder wegnehmen); hier: jeder richtige Aufbau von links nach rechts bleibt erlaubt
  const ok = alle.find(a => G.analysiere(g, a).ok);
  for (let m = 0; m <= g.n; m++) pruefe(G.erlaubt(g, ok.map((id, s) => s < m ? id : null)), `k=${k}: Aufbau von links nach rechts bleibt erlaubt (${m} gelegt)`);
}

// Einzelfälle (k = 3: Bausteine 0 Promotor, 1 Exon, 2 Intron, 3 Exon, 4 Intron, 5 Exon, 6 Terminator)
const g = G.erzeuge(Math.random, 3), a = p => G.analysiere(g, p);
pruefe(a([1, 2, 3, 4, 5, 6, 0]).teile.length === 0 && a([1, 2, 3, 4, 5, 6, 0]).bisPlatz === 7, "Promotor ganz hinten: nichts abzuschreiben");
pruefe(a([1, 0, 2, 3, 4, 5, 6]).teile.join() === "2,3,4,5,6", "Baustein vor dem Promotor wird nicht abgeschrieben");
pruefe(a([0, 6, 1, 2, 3, 4, 5]).teile.join() === "6" && a([0, 6, 1, 2, 3, 4, 5]).bisPlatz === 2, "Terminator direkt hinter dem Promotor");
pruefe(!a([6, 0, 1, 2, 3, 4, 5]).stopp && a([6, 0, 1, 2, 3, 4, 5]).bisPlatz === 7, "Terminator vor dem Promotor: bis zum Ende der DNA");
pruefe(!a([0, 2, 1, 4, 3, 5, 6]).ok, "Intron direkt hinter dem Promotor ist nicht richtig");
pruefe(!a([0, 1, 3, 2, 4, 5, 6]).ok, "zwei Exons hintereinander sind nicht richtig");
pruefe(a([0, 1, 2, 3, 4, 5, 6]).ok && a([0, 1, 4, 3, 2, 5, 6]).ok && !a([0, 3, 2, 1, 4, 5, 6]).ok, "Exons nur in der Reihenfolge ihrer Nummern, Introns vertauschbar");
const s1 = G.spleisse(g, [2, 1, 3, 4, 5, 6]);   // Intron am Anfang bleibt, Intron 4 zwischen Exons geht
pruefe(s1.entfernt.join() === "4" && s1.rest.join() === "2,1,3,5" && s1.abgespalten === 6, "Spleißen: Intron am Anfang bleibt, das zwischen Exons geht, Terminator wird abgespalten");
const s2 = G.spleisse(g, [1, 2, 3, 4]);          // Intron am Ende ohne Exon dahinter bleibt
pruefe(s2.entfernt.join() === "2" && s2.rest.join() === "1,3,4" && s2.abgespalten === null, "Spleißen: Intron am Ende bleibt");
pruefe(G.spleisse(g, []).rest.length === 0 && G.rna(g, [0]).length === 6 && G.rna(g, [1]).length === g.bausteine[1].seq.length && !G.rna(g, [0]).includes("T") && G.rna(g, [6]) === "UUUUUU", "RNA mit U");

// Translation
pruefe(G.uebersetze("GGGAUGUUUUAAGG").kurz === "MF" && G.uebersetze("GGGAUGUUUUAAGG").stopp, "Translation bis zum Stopp");
pruefe(G.uebersetze("CCCUUUGGG").start === -1 && G.uebersetze("CCCUUUGGG").kurz === "", "ohne AUG kein Peptid");
pruefe(!G.uebersetze("AUGUUUGG").stopp && G.uebersetze("AUGUUUGG").kurz === "MF", "ohne Stopp bis zum Ende, unvollständiges Codon bleibt weg");
pruefe(C.TABELLE["AUG"] === "Met", "Codon-Tabelle geladen");
// Wird die Reihenfolge der Exons vertauscht, ändert sich das Peptid (oder es bricht ab)
{
  const gg = G.erzeuge(Math.random, 3), ex = [1, 3, 5], richtig = G.uebersetze(G.rna(gg, [1, 3, 5])).kurz;
  const anders = G.uebersetze(G.rna(gg, [5, 3, 1])).kurz;
  pruefe(richtig === gg.peptid, "richtige Reihenfolge der Exons gibt das Peptid");
  pruefe(anders !== gg.peptid, "umgekehrte Reihenfolge der Exons gibt ein anderes Ergebnis");
}

// Vorrat
const gesehen = new Set();
for (const k of [2, 3, 4]){
  const gg = G.erzeuge(Math.random, k);
  for (let i = 0; i < 1500; i++){
    const v = G.vorrat(gg, Math.random);
    pruefe(v.slice().sort((x, y) => x - y).join() === gg.bausteine.map((b, j) => j).join(), "Vorrat enthält jeden Baustein genau einmal");
    pruefe(v.every((id, s) => gg.bausteine[id].key !== gg.soll[s]), "kein Baustein an einer Stelle, die dem fertigen Gen entspricht: " + v.join(""));
    gesehen.add(k + ":" + v.join(""));
  }
}
pruefe(gesehen.size > 300, "viele verschiedene Reihenfolgen im Vorrat: " + gesehen.size);
console.log(fehler ? fehler + " Fehler." : "OK (alle Anordnungen für 2, 3 und 4 Exons, " + gesehen.size + " Vorräte).");
process.exit(fehler ? 1 : 0);
