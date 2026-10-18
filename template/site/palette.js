// Farbtabelle für alle Ansichten (Kacheln, Zeichnungen, 3D, Tabellen, Diagramme).
// Quelle: template/site/palette.js, wird von build.py in die Seiten kopiert.
// Eine Farbe pro Baustein: Wer eine Base in der Kachel gesehen hat, erkennt sie im 3D-Bild wieder.
const PALETTE = (() => {
  const hell = {
    A:"#2f5bea", T:"#e69f00", U:"#f0c14b", G:"#009e73", C:"#e07bb0",
    zucker:"#9aa7a0",
    el_C:"#8a929a", el_H:"#e3e8eb", el_N:"#3a5fcd", el_O:"#d6342a", el_P:"#e68a00",   // Elementfarben (CPK-ähnlich)
    p5:"#d81b60",   // 5'-Phosphat (Hervorhebung)
    oh3:"#17b8c9",  // 3'-OH (Hervorhebung)
    oh2:"#7b1fa2",  // 2'-OH bzw. 2'-H (Unterschied RNA/DNA)
    schnitt:"#d32f2f", // Bindung, die bei der Polymerisation gespalten wird
    hbruecke:"#53675e"
  };
  const dunkel = {
    A:"#7d9bff", T:"#f5b83a", U:"#f7d77f", G:"#2fd1a0", C:"#f0a0c8",
    zucker:"#8fa199",
    el_C:"#aab3ba", el_H:"#f2f5f7", el_N:"#6f8cff", el_O:"#ff6b5e", el_P:"#ffa733",
    p5:"#ff5c8d", oh3:"#4fd8e6", oh2:"#c27be0", schnitt:"#ff6b6b", hbruecke:"#b3c5bd"
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
