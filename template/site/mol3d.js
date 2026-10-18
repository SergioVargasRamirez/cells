// Kleine 3D-Ansicht für Moleküle (WebGL): Kugeln, Stäbe, gestrichelte Bindungen, Drehen/Zoomen,
// Achsenpfeile, Beschriftungen, Schnittebene, Auswahl per Maus. Quelle: template/site/mol3d.js,
// wird von build.py in die Seiten kopiert. Einheiten: Ångström, Farben als [r, g, b] von 0 bis 1.
//
//   const v = MOL3D.create(canvas, overlayCanvas, {onHover(i), onPick(i)});
//   v.setScene({atome: [{p:[x,y,z], c:[r,g,b], r:0.3}], bindungen: [{a, b, r:0.1, c:[r,g,b], strich:true}]});
//   Zusätzlich: scene.flaechen = [{p: [[x,y,z], …] (konvexes Vieleck), c: [r,g,b], rand: [r,g,b]}], scene.flaechenAlpha (Standard 0,38):
//   durchscheinende Flächen, zum Beispiel für eine Ebene.
//   v.setClip({n:[0,0,1], d:5, min:2})   // zeigt nur, was min <= dot(n, p) <= d erfüllt (min ist optional); null schaltet aus
//   v.setLabels([{p:[x,y,z], text:"5'", color:"#fff", bg:"#000"}, {a:[..], b:[..], text:"3,4 Å", linie:true}])
//   v.setAchsen(true); v.setRotation(R); v.animateTo(R, 600); v.resetView();
const MOL3D = (() => {
  "use strict";
  const M4 = {
    id(){ const o = new Float32Array(16); o[0] = o[5] = o[10] = o[15] = 1; return o; },
    mul(a, b){ const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++){ let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; },
    persp(fov, asp, n, f){ const t = 1 / Math.tan(fov / 2), o = new Float32Array(16); o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = 2 * f * n / (n - f); return o; },
    trans(x, y, z){ const o = M4.id(); o[12] = x; o[13] = y; o[14] = z; return o; },
    fromR(R){ const o = M4.id(); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o[j * 4 + i] = R[i][j]; return o; },
  };
  const I3 = () => [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const mul3 = (A, B) => A.map(r => [0, 1, 2].map(j => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
  const rotX3 = a => { const c = Math.cos(a), s = Math.sin(a); return [[1, 0, 0], [0, c, -s], [0, s, c]]; };
  const rotY3 = a => { const c = Math.cos(a), s = Math.sin(a); return [[c, 0, s], [0, 1, 0], [-s, 0, c]]; };
  const orthonorm = R => {   // gegen Rundungsfehler beim vielen Drehen
    let a = R[0], b = R[1];
    const n = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
    a = n(a); b = n([b[0] - (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) * a[0], b[1] - (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) * a[1], b[2] - (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) * a[2]]);
    return [a, b, [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]];
  };

  function supported(){
    try { return !!document.createElement("canvas").getContext("webgl"); } catch (e){ return false; }
  }

  // ---- Vorlagen: Kugel (Dreiecksliste, Einheitsradius) und Zylinder (Länge 1 entlang z, Radius 1) ----
  const SPHERE = (() => {
    const nLat = 9, nLon = 14, v = [];
    const pt = (i, j) => { const th = Math.PI * i / nLat, ph = 2 * Math.PI * j / nLon; return [Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), Math.cos(th)]; };
    for (let i = 0; i < nLat; i++) for (let j = 0; j < nLon; j++){
      const a = pt(i, j), b = pt(i + 1, j), c = pt(i + 1, j + 1), d = pt(i, j + 1);
      if (i > 0) v.push(a, b, d);
      if (i < nLat - 1) v.push(d, b, c);
    }
    return v;
  })();
  const SPHERE_LOW = (() => {   // gröbere Kugel für große Moleküle
    const nLat = 5, nLon = 8, v = [];
    const pt = (i, j) => { const th = Math.PI * i / nLat, ph = 2 * Math.PI * j / nLon; return [Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), Math.cos(th)]; };
    for (let i = 0; i < nLat; i++) for (let j = 0; j < nLon; j++){
      const a = pt(i, j), b = pt(i + 1, j), c = pt(i + 1, j + 1), d = pt(i, j + 1);
      if (i > 0) v.push(a, b, d);
      if (i < nLat - 1) v.push(d, b, c);
    }
    return v;
  })();
  const CYL = (() => {
    const n = 10, v = [];
    for (let j = 0; j < n; j++){
      const a0 = 2 * Math.PI * j / n, a1 = 2 * Math.PI * (j + 1) / n;
      const p = (a, z) => [Math.cos(a), Math.sin(a), z, Math.cos(a), Math.sin(a), 0];
      const A = p(a0, 0), B = p(a1, 0), C = p(a1, 1), D = p(a0, 1);
      v.push(A, B, D, D, B, C);
    }
    return v;
  })();

  const VS = `
    attribute vec3 aPos; attribute vec3 aNor; attribute vec3 aCol;
    uniform mat4 uMVP; uniform mat4 uRot;
    varying vec3 vNor; varying vec3 vCol; varying vec3 vWorld;
    void main(){ gl_Position = uMVP * vec4(aPos, 1.0); vNor = (uRot * vec4(aNor, 0.0)).xyz; vCol = aCol; vWorld = aPos; }`;
  const FS = `
    precision mediump float;
    varying vec3 vNor; varying vec3 vCol; varying vec3 vWorld;
    uniform vec4 uClip; uniform float uClipMin; uniform float uAlpha;
    void main(){
      if (uClip.w < 1.0e5 && (dot(uClip.xyz, vWorld) > uClip.w || dot(uClip.xyz, vWorld) < uClipMin)) discard;
      vec3 n = normalize(vNor);
      if (!gl_FrontFacing) n = -n;
      vec3 L = normalize(vec3(0.4, 0.55, 0.75));
      float d = max(dot(n, L), 0.0), sp = pow(max(dot(n, normalize(L + vec3(0.0, 0.0, 1.0))), 0.0), 40.0);
      vec3 c = vCol * (0.38 + 0.72 * d) + vec3(0.28) * sp;
      if (!gl_FrontFacing) c *= 0.7;
      gl_FragColor = vec4(c, uAlpha);
    }`;

  function create(canvas, overlay, opts){
    opts = opts || {};
    const gl = canvas.getContext("webgl", {antialias: true, alpha: true, premultipliedAlpha: false});
    if (!gl) throw new Error("kein WebGL");
    const octx = overlay.getContext("2d");
    const prog = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, FS]]){
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      gl.attachShader(prog, s);
    }
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    const loc = {aPos: gl.getAttribLocation(prog, "aPos"), aNor: gl.getAttribLocation(prog, "aNor"), aCol: gl.getAttribLocation(prog, "aCol"),
                 uMVP: gl.getUniformLocation(prog, "uMVP"), uRot: gl.getUniformLocation(prog, "uRot"), uClip: gl.getUniformLocation(prog, "uClip"), uClipMin: gl.getUniformLocation(prog, "uClipMin"), uAlpha: gl.getUniformLocation(prog, "uAlpha")};
    const bufs = {pos: gl.createBuffer(), nor: gl.createBuffer(), col: gl.createBuffer(), n: 0};
    const flb = {pos: gl.createBuffer(), nor: gl.createBuffer(), col: gl.createBuffer(), n: 0};   // durchscheinende Flächen

    const HOME_ZOOM = opts.zoom || 1;
    const S = {scene: {atome: [], bindungen: []}, R: I3(), R0: I3(), zoom: HOME_ZOOM, center: [0, 0, 0], radius: 5, clip: null,
               labels: [], achsen: true, screen: [], dirty: true, anim: null, w: 0, h: 0, dpr: 1, hover: -1};
    const FOV = (opts.fov || 28) * Math.PI / 180;

    function build(){
      const {atome, bindungen} = S.scene;
      const dashes = [];
      for (const b of bindungen){
        if (!b.strich) continue;
        const A = atome[b.a].p, B = atome[b.b].p, L = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]), seg = 0.16, gap = 0.12;
        for (let t = 0; t + seg <= L + 1e-6; t += seg + gap) dashes.push([b, t / L, (t + seg) / L]);
      }
      const solid = bindungen.filter(b => !b.strich);
      const SP = atome.length > 700 ? SPHERE_LOW : SPHERE;
      const flaechen = S.scene.flaechen || [];
      const kanten = flaechen.reduce((n, f) => n + (f.rand ? f.p.length : 0), 0);
      const nV = atome.length * SP.length + solid.length * 2 * CYL.length + dashes.length * CYL.length + kanten * CYL.length;
      const pos = new Float32Array(nV * 3), nor = new Float32Array(nV * 3), col = new Float32Array(nV * 3);
      let o = 0;
      const put = (px, py, pz, nx, ny, nz, c) => { pos[o] = px; pos[o + 1] = py; pos[o + 2] = pz; nor[o] = nx; nor[o + 1] = ny; nor[o + 2] = nz; col[o] = c[0]; col[o + 1] = c[1]; col[o + 2] = c[2]; o += 3; };
      for (const a of atome){
        const r = a.r || 0.3;
        for (const v of SP) put(a.p[0] + r * v[0], a.p[1] + r * v[1], a.p[2] + r * v[2], v[0], v[1], v[2], a.c);
      }
      const cyl = (A, B, r, c) => {
        const dx = B[0] - A[0], dy = B[1] - A[1], dz = B[2] - A[2], L = Math.hypot(dx, dy, dz);
        if (L < 1e-6) return;
        const w = [dx / L, dy / L, dz / L], t = Math.abs(w[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
        let u = [w[1] * t[2] - w[2] * t[1], w[2] * t[0] - w[0] * t[2], w[0] * t[1] - w[1] * t[0]];
        const lu = Math.hypot(...u); u = [u[0] / lu, u[1] / lu, u[2] / lu];
        const v2 = [w[1] * u[2] - w[2] * u[1], w[2] * u[0] - w[0] * u[2], w[0] * u[1] - w[1] * u[0]];
        for (const q of CYL){
          const x = q[0] * r, y = q[1] * r, z = q[2] * L;
          put(A[0] + u[0] * x + v2[0] * y + w[0] * z, A[1] + u[1] * x + v2[1] * y + w[1] * z, A[2] + u[2] * x + v2[2] * y + w[2] * z,
              u[0] * q[3] + v2[0] * q[4], u[1] * q[3] + v2[1] * q[4], u[2] * q[3] + v2[2] * q[4], c);
        }
      };
      for (const b of solid){
        const A = atome[b.a].p, B = atome[b.b].p, M = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2], r = b.r || 0.11;
        cyl(A, M, r, b.c || atome[b.a].c); cyl(M, B, r, b.c || atome[b.b].c);
      }
      for (const [b, t0, t1] of dashes){
        const A = atome[b.a].p, B = atome[b.b].p, at = t => [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t];
        cyl(at(t0), at(t1), b.r || 0.07, b.c || [0.5, 0.5, 0.5]);
      }
      for (const f of flaechen) if (f.rand) for (let i = 0; i < f.p.length; i++) cyl(f.p[i], f.p[(i + 1) % f.p.length], f.randR || 0.035, f.rand);
      for (const [k, arr] of [["pos", pos], ["nor", nor], ["col", col]]){ gl.bindBuffer(gl.ARRAY_BUFFER, bufs[k]); gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW); }
      bufs.n = nV;
      // Flächen (konvexe Vielecke) als Dreiecksfächer
      let nf = 0; for (const f of flaechen) nf += (f.p.length - 2) * 3;
      const fp = new Float32Array(nf * 3), fn = new Float32Array(nf * 3), fc = new Float32Array(nf * 3); let q = 0;
      for (const f of flaechen){
        const a = f.p[0], b = f.p[1], c = f.p[2];
        const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; const l = Math.hypot(...n) || 1; n = [n[0] / l, n[1] / l, n[2] / l];
        for (let k = 1; k < f.p.length - 1; k++) for (const P of [f.p[0], f.p[k], f.p[k + 1]]){
          fp[q] = P[0]; fp[q + 1] = P[1]; fp[q + 2] = P[2]; fn[q] = n[0]; fn[q + 1] = n[1]; fn[q + 2] = n[2]; fc[q] = f.c[0]; fc[q + 1] = f.c[1]; fc[q + 2] = f.c[2]; q += 3;
        }
      }
      for (const [k, arr] of [["pos", fp], ["nor", fn], ["col", fc]]){ gl.bindBuffer(gl.ARRAY_BUFFER, flb[k]); gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW); }
      flb.n = nf;
    }

    function fit(){
      const a = S.scene.atome;
      if (!a.length){ S.center = [0, 0, 0]; S.radius = 5; return; }
      const c = [0, 0, 0];
      for (const x of a) for (let i = 0; i < 3; i++) c[i] += x.p[i] / a.length;
      let r = 0;
      for (const x of a) r = Math.max(r, Math.hypot(x.p[0] - c[0], x.p[1] - c[1], x.p[2] - c[2]) + (x.r || 0.3));
      S.center = c; S.radius = r;
    }

    function resize(){
      const dpr = Math.min(window.devicePixelRatio || 1, 2), w = canvas.clientWidth, h = canvas.clientHeight;
      if (w === S.w && h === S.h && dpr === S.dpr) return;
      S.w = w; S.h = h; S.dpr = dpr;
      for (const c of [canvas, overlay]){ c.width = Math.max(1, Math.round(w * dpr)); c.height = Math.max(1, Math.round(h * dpr)); }
    }

    function matrices(){
      const asp = S.w / Math.max(1, S.h), dist = S.radius / Math.sin(Math.min(FOV / 2, FOV * asp / 2)) * 1.08 / S.zoom;
      const rot = M4.fromR(S.R);
      const mv = M4.mul(M4.trans(0, 0, -dist), M4.mul(rot, M4.trans(-S.center[0], -S.center[1], -S.center[2])));
      return {mvp: M4.mul(M4.persp(FOV, asp, Math.max(0.5, dist - S.radius * 1.5), dist + S.radius * 1.5), mv), rot, dist};
    }

    function project(p, mvp){
      const x = mvp[0] * p[0] + mvp[4] * p[1] + mvp[8] * p[2] + mvp[12], y = mvp[1] * p[0] + mvp[5] * p[1] + mvp[9] * p[2] + mvp[13];
      const w = mvp[3] * p[0] + mvp[7] * p[1] + mvp[11] * p[2] + mvp[15], z = mvp[2] * p[0] + mvp[6] * p[1] + mvp[10] * p[2] + mvp[14];
      return [(x / w * 0.5 + 0.5) * S.w, (0.5 - y / w * 0.5) * S.h, z / w];
    }

    function draw(){
      S.dirty = false;
      resize();
      const {mvp, rot} = matrices();
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.useProgram(prog);
      for (const [name, key] of [["aPos", "pos"], ["aNor", "nor"], ["aCol", "col"]]){
        gl.bindBuffer(gl.ARRAY_BUFFER, bufs[key]); gl.enableVertexAttribArray(loc[name]); gl.vertexAttribPointer(loc[name], 3, gl.FLOAT, false, 0, 0);
      }
      gl.uniformMatrix4fv(loc.uMVP, false, mvp); gl.uniformMatrix4fv(loc.uRot, false, rot);
      const c = S.clip; gl.uniform4f(loc.uClip, c ? c.n[0] : 0, c ? c.n[1] : 0, c ? c.n[2] : 0, c ? c.d : 1e6);
      gl.uniform1f(loc.uClipMin, c && c.min !== undefined ? c.min : -1e6);
      gl.uniform1f(loc.uAlpha, 1);
      gl.drawArrays(gl.TRIANGLES, 0, bufs.n);
      if (flb.n){   // durchscheinende Flächen zuletzt, ohne Tiefenschreiben
        for (const [name, key] of [["aPos", "pos"], ["aNor", "nor"], ["aCol", "col"]]){ gl.bindBuffer(gl.ARRAY_BUFFER, flb[key]); gl.vertexAttribPointer(loc[name], 3, gl.FLOAT, false, 0, 0); }
        gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
        gl.uniform1f(loc.uAlpha, S.scene.flaechenAlpha || 0.38);
        gl.drawArrays(gl.TRIANGLES, 0, flb.n);
        gl.depthMask(true); gl.disable(gl.BLEND);
      }
      S.screen = S.scene.atome.map(a => project(a.p, mvp));
      overlayDraw(mvp);
    }

    const abgeschnitten = p => { const c = S.clip; if (!c) return false; const v = c.n[0] * p[0] + c.n[1] * p[1] + c.n[2] * p[2]; return v > c.d || (c.min !== undefined && v < c.min); };
    function overlayDraw(mvp){
      const dpr = S.dpr, g = octx;
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, S.w, S.h);
      const css = getComputedStyle(canvas), ink = css.color;
      g.font = "600 13px 'Source Sans 3', system-ui, sans-serif"; g.textBaseline = "middle"; g.textAlign = "center";
      for (const L of S.labels){
        if (L.linie ? (abgeschnitten(L.a) || abgeschnitten(L.b)) : abgeschnitten(L.p)) continue;
        if (L.linie){
          const a = project(L.a, mvp), b = project(L.b, mvp);
          g.strokeStyle = L.color || ink; g.lineWidth = 1.5; g.setLineDash([5, 4]);
          g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); g.setLineDash([]);
          for (const e of [a, b]){ g.beginPath(); g.moveTo(e[0] + (a[0] === e[0] ? 0 : 0), e[1]); g.arc(e[0], e[1], 2.5, 0, 6.3); g.fillStyle = L.color || ink; g.fill(); }
          if (L.text) tag(g, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, L.text, L);
        } else {
          const q = project(L.p, mvp);
          tag(g, q[0] + (L.dx || 0), q[1] + (L.dy || 0), L.text, L);
        }
      }
      if (S.achsen) axes(g);
      if (S.hover >= 0 && S.screen[S.hover]){
        const q = S.screen[S.hover], a = S.scene.atome[S.hover];
        if (a.tip) tag(g, q[0], q[1] - 18, a.tip, {bg: css.getPropertyValue("--surface") || "#fff", color: ink, border: ink});
      }
    }
    function tag(g, x, y, text, L){
      const w = g.measureText(text).width + 12, h = 20;
      g.fillStyle = L.bg || "rgba(255,255,255,.85)"; g.strokeStyle = L.border || L.color || "rgba(0,0,0,.35)"; g.lineWidth = 1;
      g.beginPath(); g.roundRect ? g.roundRect(x - w / 2, y - h / 2, w, h, 6) : g.rect(x - w / 2, y - h / 2, w, h); g.fill(); g.stroke();
      g.fillStyle = L.color || "#000"; g.fillText(text, x, y + 0.5);
    }
    function axes(g){   // Achsenpfeile unten links; Länge ~ 34 px
      const ox = 62, oy = S.h - 54, len = 34, R = S.R;
      const A = [["x", [1, 0, 0], "#d93636"], ["y", [0, 1, 0], "#2e9d44"], ["z", [0, 0, 1], "#2f6bd9"]]
        .map(([n, v, c]) => {
          const x = R[0][0] * v[0] + R[0][1] * v[1] + R[0][2] * v[2], y = R[1][0] * v[0] + R[1][1] * v[1] + R[1][2] * v[2], z = R[2][0] * v[0] + R[2][1] * v[1] + R[2][2] * v[2];
          return {n, c, x, y: -y, z};
        }).sort((a, b) => a.z - b.z);
      g.lineWidth = 2.5; g.lineCap = "round"; g.textAlign = "center";
      for (const a of A){
        const ex = ox + a.x * len, ey = oy + a.y * len, d = Math.hypot(a.x, a.y);
        g.strokeStyle = a.c; g.fillStyle = a.c; g.beginPath(); g.moveTo(ox, oy); g.lineTo(ex, ey); g.stroke();
        if (d > 0.18){
          const ang = Math.atan2(a.y, a.x);
          g.beginPath(); g.moveTo(ex, ey); g.lineTo(ex - 8 * Math.cos(ang - 0.4), ey - 8 * Math.sin(ang - 0.4)); g.lineTo(ex - 8 * Math.cos(ang + 0.4), ey - 8 * Math.sin(ang + 0.4)); g.closePath(); g.fill();
        }
        g.font = "700 13px 'Source Sans 3', system-ui, sans-serif"; g.fillText(a.n, ox + a.x * (len + 11), oy + a.y * (len + 11));
      }
    }

    function request(){ S.dirty = true; if (!S.raf) S.raf = requestAnimationFrame(tick); }
    function tick(t){
      S.raf = 0;
      if (S.anim){
        const k = Math.min(1, (t - S.anim.t0) / S.anim.ms), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        S.R = orthonorm(S.anim.from.map((r, i) => r.map((v, j) => v + (S.anim.to[i][j] - v) * e)));
        if (k >= 1) S.anim = null; else S.dirty = true;
      }
      if (S.dirty){ draw(); if (S.anim) S.raf = requestAnimationFrame(tick); }
    }

    // ---- Eingaben ----
    const gedreht = () => { if (opts.onRotate) opts.onRotate(S.R.map(r => r.slice())); };
    const ptrs = new Map();
    let moved = 0, pinch = 0;
    canvas.style.touchAction = "none";
    canvas.addEventListener("pointerdown", e => { canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]); moved = 0; S.anim = null; if (ptrs.size === 2) pinch = 0; });
    canvas.addEventListener("pointermove", e => {
      const prev = ptrs.get(e.pointerId);
      if (!prev){ hover(e); return; }
      const dx = e.clientX - prev[0], dy = e.clientY - prev[1];
      ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      moved += Math.abs(dx) + Math.abs(dy);
      if (ptrs.size === 1){ S.R = orthonorm(mul3(mul3(rotX3(dy * 0.01), rotY3(dx * 0.01)), S.R)); gedreht(); request(); }
      else if (ptrs.size === 2){
        const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (pinch) S.zoom = Math.min(8, Math.max(0.3, S.zoom * d / pinch));
        pinch = d; request();
      }
    });
    const up = e => {
      const was = ptrs.has(e.pointerId); ptrs.delete(e.pointerId); pinch = 0;
      if (was && e.type === "pointerup" && moved < 5 && ptrs.size === 0 && opts.onPick){
        const i = nearest(e); if (i >= 0) opts.onPick(i);
      }
    };
    canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("pointerleave", () => { if (S.hover >= 0){ S.hover = -1; if (opts.onHover) opts.onHover(-1); request(); } });
    canvas.addEventListener("wheel", e => { e.preventDefault(); S.zoom = Math.min(8, Math.max(0.3, S.zoom * Math.exp(-e.deltaY * 0.0012))); request(); }, {passive: false});
    canvas.addEventListener("keydown", e => {
      const k = e.key, s = 0.12;
      if (k === "ArrowLeft") S.R = orthonorm(mul3(rotY3(-s), S.R));
      else if (k === "ArrowRight") S.R = orthonorm(mul3(rotY3(s), S.R));
      else if (k === "ArrowUp") S.R = orthonorm(mul3(rotX3(-s), S.R));
      else if (k === "ArrowDown") S.R = orthonorm(mul3(rotX3(s), S.R));
      else if (k === "+" || k === "=") S.zoom = Math.min(8, S.zoom * 1.15);
      else if (k === "-") S.zoom = Math.max(0.3, S.zoom / 1.15);
      else if (k === "0"){ S.R = S.R0.map(r => r.slice()); S.zoom = HOME_ZOOM; gedreht(); }
      else return;
      e.preventDefault(); gedreht(); request();
    });
    function nearest(e){
      const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      let best = -1, bd = 1e9;
      S.screen.forEach((q, i) => {
        const a = S.scene.atome[i]; if (a.stumm) return;
        if (S.clip && S.clip.n[0] * a.p[0] + S.clip.n[1] * a.p[1] + S.clip.n[2] * a.p[2] > S.clip.d) return;
        const d = Math.hypot(q[0] - x, q[1] - y) - 0 + q[2] * 3;
        if (Math.hypot(q[0] - x, q[1] - y) < 16 && d < bd){ bd = d; best = i; }
      });
      return best;
    }
    function hover(e){
      if (!opts.onHover && !S.scene.atome.some(a => a.tip)) return;
      const i = nearest(e);
      if (i !== S.hover){ S.hover = i; if (opts.onHover) opts.onHover(i); canvas.style.cursor = i >= 0 ? "pointer" : ""; request(); }
    }
    if (window.ResizeObserver) new ResizeObserver(() => request()).observe(canvas);

    return {
      setScene(scene, o){ S.scene = scene; build(); if (!o || !o.keepView){ fit(); } S.hover = -1; request(); },
      setClip(c){ S.clip = c; request(); },
      setLabels(l){ S.labels = l || []; request(); },
      setAchsen(on){ S.achsen = on; request(); },
      setRotation(R, home){ S.R = orthonorm(R); if (home) S.R0 = S.R.map(r => r.slice()); S.anim = null; request(); },
      getRotation(){ return S.R.map(r => r.slice()); },
      animateTo(R, ms){
        if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches){ S.R = orthonorm(R); request(); return; }
        S.anim = {from: S.R.map(r => r.slice()), to: R, t0: performance.now(), ms: ms || 600}; request();
      },
      setZoom(z){ S.zoom = z; request(); },
      resetView(){ S.R = S.R0.map(r => r.slice()); S.zoom = HOME_ZOOM; request(); },
      project(p){ return project(p, matrices().mvp); },
      redraw: request,
    };
  }
  return {create, supported, rotX: rotX3, rotY: rotY3, mul3};
})();
