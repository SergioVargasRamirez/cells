// Test für template/site/cartoon.js und die Daten von Ubiquitin: Aufruf  node scripts/protein/test_cartoon.js
const fs = require("fs"), path = require("path"), vm = require("vm");
const site = path.join(__dirname, "..", "..", "template", "site");
const ctx = {}; vm.createContext(ctx);
vm.runInContext(["ubq-data.js", "cartoon.js"].map(f => fs.readFileSync(path.join(site, f), "utf8")).join("\n") + "\nglobalThis.U = UBQ; globalThis.C = CARTOON;", ctx);
const {U, C} = ctx;
let fehler = 0; const pruefe = (ok, t) => { if (!ok){ fehler++; console.log("FEHLER:", t); } };
const R = U.reste, at = (r, n) => r.atome.find(a => a[0] === n).slice(1);
pruefe(R.length === 76, "76 Reste");
pruefe(R.map(r => r.aa).join(",").startsWith("Met,Gln,Ile,Phe,Val,Lys"), "Sequenz beginnt mit MQIFVK");
const m = C.bauen({ca: R.map(r => at(r, "CA")), c: R.map(r => at(r, "C")), o: R.map(r => at(r, "O")), ss: R.map(r => r.ss), farbe: R.map(() => [0.5, 0.5, 0.5])});
let nan = 0; for (const a of [m.pos, m.nor, m.col]) for (const v of a) if (!Number.isFinite(v)) nan++;
pruefe(nan === 0, "Netz enthält " + nan + " ungültige Zahlen");
pruefe(m.pos.length % 9 === 0, "ganze Dreiecke");
let ln = 0; for (let i = 0; i < m.nor.length; i += 3){ const l = Math.hypot(m.nor[i], m.nor[i + 1], m.nor[i + 2]); if (Math.abs(l - 1) > 1e-3) ln++; }
pruefe(ln === 0, ln + " Normalen sind nicht normiert");
// Ausdehnung des Netzes ≈ Ausdehnung der Cα-Atome (± Bandbreite)
const ext = a => { const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; for (let i = 0; i < a.length; i += 3) for (let k = 0; k < 3; k++){ mn[k] = Math.min(mn[k], a[i + k]); mx[k] = Math.max(mx[k], a[i + k]); } return mx.map((v, k) => v - mn[k]); };
const eCa = ext(R.flatMap(r => at(r, "CA"))), eNetz = ext(m.pos);
pruefe(eCa.every((v, k) => Math.abs(eNetz[k] - v) < 6), "Netz passt nicht zu den Cα: " + eCa.map(x => x.toFixed(0)) + " / " + eNetz.map(x => x.toFixed(0)));
const ssn = {}; R.forEach(r => ssn[r.ss] = (ssn[r.ss] || 0) + 1);
console.log(`Cartoon: ${m.ringe} Ringe, ${m.pos.length / 9} Dreiecke; Ausdehnung Cα ${eCa.map(x => x.toFixed(0))} Å; Sekundärstruktur`, JSON.stringify(ssn));
const kern = [3, 5, 13, 15, 26, 30, 43, 50, 56, 61, 67, 69];
pruefe(kern.every(n => R[n - 1].rsa < 0.2), "der bekannte hydrophobe Kern ist vergraben");
const u = new Set(["Ala", "Val", "Leu", "Ile", "Met", "Phe", "Trp"]), gel = new Set(["Asp", "Glu", "Lys", "Arg"]);
const mw = a => a.reduce((x, y) => x + y, 0) / a.length;
const mu = mw(R.filter(r => u.has(r.aa)).map(r => r.rsa)), mg = mw(R.filter(r => gel.has(r.aa)).map(r => r.rsa));
pruefe(mu < mg, "unpolare Reste sind im Mittel weniger zugänglich als geladene");
console.log(`mittlere relative Zugänglichkeit: unpolar ${mu.toFixed(2)}, geladen ${mg.toFixed(2)}`);
console.log(fehler ? fehler + " Fehler" : "OK: Cartoon und Ubiquitin-Daten stimmen.");
process.exit(fehler ? 1 : 0);
