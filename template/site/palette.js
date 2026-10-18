// Farbtabelle für alle Ansichten (Kacheln, Zeichnungen, 3D, Tabellen, Diagramme).
// Quelle: template/site/palette.js, wird von build.py in die Seiten kopiert.
// Eine Farbe pro Baustein: Wer eine Base in der Kachel gesehen hat, erkennt sie im 3D-Bild wieder.
const PALETTE = (() => {
  const hell = {
    A:"#2f5bea", T:"#e69f00", U:"#dcae1c", G:"#009e73", C:"#e07bb0",
    zucker:"#9aa7a0",
    el_C:"#8a929a", el_H:"#e3e8eb", el_N:"#3a5fcd", el_O:"#d6342a", el_P:"#e68a00",   // Elementfarben (CPK-ähnlich)
    p5:"#d81b60",   // 5'-Phosphat (Hervorhebung)
    oh3:"#17b8c9",  // 3'-OH (Hervorhebung)
    oh2:"#7b1fa2",  // 2'-OH bzw. 2'-H (Unterschied RNA/DNA)
    schnitt:"#d32f2f", // Bindung, die bei der Polymerisation gespalten wird
    hbruecke:"#53675e",
    aa_unpolar:"#b9822a", aa_polar:"#1f8f86", aa_sauer:"#d1495b", aa_basisch:"#3d6fd6", aa_sonder:"#8a63b8",
    peptid:"#e8590c", ebene2:"#1f8f86"   // Eigenschaft der Aminosäure-Seitenkette
  };
  const dunkel = {
    A:"#7d9bff", T:"#f5b83a", U:"#f7d77f", G:"#2fd1a0", C:"#f0a0c8",
    zucker:"#8fa199",
    el_C:"#aab3ba", el_H:"#f2f5f7", el_N:"#6f8cff", el_O:"#ff6b5e", el_P:"#ffa733",
    p5:"#ff5c8d", oh3:"#4fd8e6", oh2:"#c27be0", schnitt:"#ff6b6b", hbruecke:"#b3c5bd",
    aa_unpolar:"#e0a84a", aa_polar:"#4fcfc2", aa_sauer:"#ff7d8d", aa_basisch:"#7da2ff", aa_sonder:"#b99ae0",
    peptid:"#ff9a5c", ebene2:"#4fcfc2"
  };
  const istDunkel = () => {
    const r = document.documentElement.getAttribute("data-theme");
    if (r) return r === "dark";
    return window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches;
  };
  const get = (name) => (istDunkel() ? dunkel : hell)[name];
  const rgb = (name) => {
    const h = get(name);
    return [parseInt(h.slice(1,3),16)/255, parseInt(h.slice(3,5),16)/255, parseInt(h.slice(5,7),16)/255];
  };
  return {hell, dunkel, get, rgb, istDunkel};
})();
