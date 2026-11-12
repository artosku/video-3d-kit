// "Uang x5" part 2: scenes n5 .. n22 (ids s6 .. s23) + the outro (s24), the sky and the space around them. Loaded by uang.js: makeX(ctx) -> { X, world, buildPile }.
// X[id] = { mood: 'day' | 'sky' | 'space', face: [before, after], act, burst, shake, build(g), anim(u, uh, g, pi, t) -> { ay?, ax?, camY?, camLy?, sink?, space? } }
// u = seconds since the scene start, uh = seconds since its hit (negative before), pi = springy 0->1 pop of the prop.
import { WORLD, ID_PROV } from './maps.js';
export function makeX(C) {
  const { THREE, mesh, mat, bas, tex, signBoard, scene, clamp, ease, easeOut, easeIn, lerp, pop, HX, noteFace, sky, ground, far, applyLight, skyTex } = C;
  const X = {};
  const box = (p, w, h, d, c, x, y, z, o = {}) => mesh(new THREE.BoxGeometry(w, h, d), mat(c, o), x, y, z, p);
  const cyl = (p, rt, rb, h, c, x, y, z, o = {}, seg = 16) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(c, o), x, y, z, p);
  const sph = (p, r, c, x, y, z, sx = 1, sy = 1, sz = 1, o = {}) => { const m = mesh(new THREE.SphereGeometry(r, 18, 14), mat(c, o), x, y, z, p); m.scale.set(sx, sy, sz); return m; };
  const flat = (p, w, h, map, x, y, z) => { const m = mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map, toneMapped: false }), x, y, z, p); m.castShadow = false; return m; };
  const board = (g, lines, x, y, z, w = 1.7, h = 0.62) => { const b = signBoard(lines, w, h); b.position.set(x, y, z); if (g.userData.hideBoard) b.scale.setScalar(0.0001); g.add(b); return b; };
  const sc1 = (o, k) => o.scale.setScalar(Math.max(0.001, k));
  const rr = (i, s = 1) => { const a = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return a - Math.floor(a); };
  const GOLD = '#F2B134', RED = '#E53935';
  const winTex = (w, h, cols, rows, on = '#FFE9A8', off = '#5C6B86', bg = '#E6D5B8') => tex(w, h, (c, W2, H2) => { c.fillStyle = bg; c.fillRect(0, 0, W2, H2); for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) { c.fillStyle = ((r * 7 + k * 3) % 5 === 0) ? on : off; c.fillRect(W2 * (k + 0.2) / cols, H2 * (r + 0.2) / rows, W2 * 0.6 / cols, H2 * 0.6 / rows); } }).t;
  // ---- real map data (Natural Earth + Indonesian provinces, baked into maps.js): flat map boards that light up province by province
  const MB = { ID: { x0: 94.5, x1: 141.2, y0: -11.5, y1: 6.3 }, W: { x0: -180, x1: 180, y0: -58, y1: 84 } };
  const centroid = (rs) => { let b = rs[0]; for (const r of rs) if (r.length > b.length) b = r; let sx = 0, sy = 0; for (const [a, c] of b) { sx += a; sy += c; } return [sx / b.length, sy / b.length]; };
  const PROVS = ID_PROV.map((p) => ({ n: p.n, r: p.r, c: centroid(p.r) })).sort((a, b) => a.c[0] - b.c[0]);
  const ringsPath = (c, rings, b, w, h) => { c.beginPath(); for (const r of rings) { r.forEach(([lo, la], i) => { const px = (lo - b.x0) / (b.x1 - b.x0) * w, py = (b.y1 - la) / (b.y1 - b.y0) * h; if (i) c.lineTo(px, py); else c.moveTo(px, py); }); c.closePath(); } };
  const mixC = (a, b, k) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), Math.max(0, Math.min(1, k))).getHexString();
  function mapBoard(parent, which, wl, x, y, z, panel) {
    const b = MB[which], cw = 1024, ch = Math.round(cw * (b.y1 - b.y0) / (b.x1 - b.x0)), hl = wl * ch / cw, T = tex(cw, ch, () => {});
    const m = mesh(new THREE.PlaneGeometry(wl, hl), new THREE.MeshBasicMaterial({ map: T.t, transparent: true, toneMapped: false }), x, y, z, parent); m.castShadow = false;
    return { m, wl, hl, b, cw, ch, pos: (lo, la) => [x + ((lo - b.x0) / (b.x1 - b.x0) - 0.5) * wl, y + ((la - b.y0) / (b.y1 - b.y0) - 0.5) * hl],
      draw(fillFn, extra) { const c = T.g; c.clearRect(0, 0, cw, ch); if (panel) { c.fillStyle = panel; c.beginPath(); c.roundRect(2, 2, cw - 4, ch - 4, 36); c.fill(); }
        c.lineJoin = 'round'; c.lineWidth = 2.5; c.strokeStyle = 'rgba(255,255,255,0.9)';
        if (which === 'ID') PROVS.forEach((p, i) => { ringsPath(c, p.r, b, cw, ch); c.fillStyle = fillFn(i); c.fill(); c.stroke(); }); else { ringsPath(c, WORLD, b, cw, ch); c.fillStyle = fillFn(0); c.fill(); c.stroke(); }
        if (extra) extra(c, cw, ch, b); T.t.needsUpdate = true; } };
  }
  const ringBox = WORLD.map((r) => { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const [a, c] of r) { x0 = Math.min(x0, a); x1 = Math.max(x1, a); y0 = Math.min(y0, c); y1 = Math.max(y1, c); } return [x0, x1, y0, y1]; });
  const pip = (r, px, py) => { let ins = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) ins = !ins; } return ins; };
  const landPts = []; for (let i = 0; landPts.length < 260 && i < 8000; i++) { const lo = -168 + rr(i, 41) * 336, la = -50 + rr(i, 42) * 120; for (let k = 0; k < WORLD.length; k++) { const bb = ringBox[k]; if (lo < bb[0] || lo > bb[1] || la < bb[2] || la > bb[3]) continue; if (pip(WORLD[k], lo, la)) { landPts.push([lo, la]); break; } } }
  const miniCar = (p, col) => { const g = new THREE.Group(); p.add(g); box(g, 1.3, 0.38, 0.6, col, 0, 0.3, 0); box(g, 0.7, 0.3, 0.55, '#CFE8FF', 0.05, 0.62, 0, { roughness: 0.3 }); for (const x of [-0.4, 0.4]) { const w = mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.66, 12), mat('#1B1B2F'), x, 0.17, 0, g); w.rotation.x = Math.PI / 2; } return g; };

  // ---------- money piles: a column of Rp2.000 bundles ("gepok"), taller with every power
  function buildPile(n) {
    const g = new THREE.Group(), s = 0.5, BW = 0.62 * s, BH = 0.64 * s, BD = 0.29 * s;
    const hh = Math.min(0.45 + 0.045 * (n - 5), 1.1), layers = Math.max(2, Math.round(hh / BH)), per = 9;
    const side = new THREE.MeshStandardMaterial({ color: '#E4E8EE', roughness: 0.9, emissive: '#C9D0DE', emissiveIntensity: 0.55 }), top = new THREE.MeshStandardMaterial({ map: noteFace, roughness: 0.85, emissive: '#C9D0DE', emissiveIntensity: 0.55 });
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(BW, BH, BD), [side, side, top, side, side, side], layers * per);
    const bm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1 * s, BH + 0.004, BD + 0.004), new THREE.MeshStandardMaterial({ color: '#E8D9A8', roughness: 0.8 }), layers * per);
    const d = new THREE.Object3D();
    for (let l = 0; l < layers; l++) for (let i = 0; i < per; i++) { const k = l * per + i; d.position.set((i % 3 - 1) * (BW + 0.02), BH * (l + 0.5), (Math.floor(i / 3) - 1) * (BD + 0.02)); d.rotation.set(0, (rr(k, n) - 0.5) * 0.14, 0); d.updateMatrix(); im.setMatrixAt(k, d.matrix); bm.setMatrixAt(k, d.matrix); }
    im.castShadow = im.receiveShadow = true; bm.castShadow = false; g.add(im, bm); g.userData.count = Math.pow(5, n); g.userData.layers = layers; return g;
  }

  // ---------- n5 laptop
  X.s6 = { mood: 'day', face: ['neutral', 'delighted'], act: 'nod', burst: { c: ['#8FD3FF', '#FFFFFF', '#6CFF9A'], n: 28, p: [0.95, 1.2, 1.7], s: 4, z: 0.12 }, shake: 0.06,
    build(g) { const L = new THREE.Group(); g.add(L); g.userData.L = L;
      box(L, 1.5, 0.07, 1.0, '#C9CED8', 0, 0.035, 0, { roughness: 0.4 });
      const kt = tex(256, 170, (c, w, h) => { c.fillStyle = '#2A2F3C'; c.fillRect(0, 0, w, h); c.fillStyle = '#4A5160'; for (let r = 0; r < 5; r++) for (let k = 0; k < 12; k++) c.fillRect(8 + k * 20, 10 + r * 28, 16, 22); }).t;
      const kp = flat(L, 1.35, 0.55, kt, 0, 0.075, 0.12); kp.rotation.x = -Math.PI / 2;
      const hinge = new THREE.Group(); hinge.position.set(0, 0.07, -0.5); L.add(hinge); g.userData.hinge = hinge;
      box(hinge, 1.5, 0.05, 1.0, '#C9CED8', 0, 0.025, 0.5, { roughness: 0.4 });
      const dark = tex(256, 170, (c, w, h) => { c.fillStyle = '#0E1420'; c.fillRect(0, 0, w, h); }).t;
      const lit = tex(256, 170, (c, w, h) => { c.fillStyle = '#16203A'; c.fillRect(0, 0, w, h); const cl = ['#6CFF9A', '#8FD3FF', '#FFD84D', '#FF8FA3']; for (let r = 0; r < 9; r++) { c.fillStyle = cl[r % 4]; c.fillRect(14 + (r % 3) * 12, 14 + r * 15, 40 + ((r * 37) % 120), 7); } }).t;
      const scr = flat(hinge, 1.36, 0.88, dark, 0, -0.003, 0.5); scr.rotation.x = Math.PI / 2; g.userData.scr = scr; g.userData.dark = dark; g.userData.lit = lit;
      board(g, [['LAPTOP PELAJAR', 44, '#B3261E'], ['Rp6.250.000', 58, '#1B1B2F']], 0.95, 2.3, 1.7); },
    anim(u, uh, g, pi) { const L = g.userData.L; L.position.set(0.95, 0.1 + 0.04 * Math.sin(u * 4), 1.7); sc1(L, pi * 1.15); L.rotation.y = -0.4; g.userData.hinge.rotation.x = -1.75 * easeOut(clamp(u / 0.55)); g.userData.scr.material.map = uh > 0 ? g.userData.lit : g.userData.dark; return {}; } };

  // ---------- n6 motor matic (rides off to the left on the hit)
  X.s7 = { mood: 'day', face: ['determined', 'laugh'], act: 'cheer', burst: { c: ['#E8D7B8', '#CDBA95', '#F5EDDC'], n: 34, p: [0.9, 0.2, 1.6], s: 5, z: 0.26 }, shake: 0.14,
    build(g) { const M = new THREE.Group(); g.add(M); g.userData.M = M; g.userData.wh = [];
      for (const x of [-0.68, 0.68]) { const w = new THREE.Group(); w.position.set(x, 0.32, 0); M.add(w); mesh(new THREE.TorusGeometry(0.28, 0.085, 10, 24), mat('#1B1B2F'), 0, 0, 0, w); mesh(new THREE.SphereGeometry(0.1, 10, 8), mat('#C9CED8'), 0, 0, 0, w); const sp = mesh(new THREE.BoxGeometry(0.5, 0.02, 0.02), mat('#C9CED8'), 0, 0, 0, w); g.userData.wh.push(w); }
      box(M, 1.2, 0.12, 0.4, '#E8394D', 0, 0.42, 0); box(M, 0.12, 0.95, 0.42, '#E8394D', -0.58, 0.85, 0); box(M, 0.7, 0.4, 0.44, '#E8394D', 0.42, 0.64, 0); box(M, 0.62, 0.1, 0.36, '#2B2430', 0.35, 0.9, 0);
      cyl(M, 0.03, 0.03, 0.7, '#222', -0.62, 1.32, 0).rotation.x = Math.PI / 2; sph(M, 0.09, '#FFE9A8', -0.68, 1.05, 0.12, 1, 1, 1, { emissive: '#FFE9A8', emissiveIntensity: 0.6 });
      board(g, [['MOTOR MATIC', 48, '#B3261E'], ['Rp31.250.000', 58, '#1B1B2F']], 0.9, 2.2, 1.0); },
    anim(u, uh, g, pi) { const M = g.userData.M; let bx = 0.9; if (uh > 0) bx = 0.9 - 8 * Math.pow(uh / 0.55, 2); M.position.set(bx, 0.02 + 0.03 * Math.abs(Math.sin(u * 6)), 1.6); sc1(M, pi * 1.0); M.rotation.z = uh > 0 ? 0.12 : 0; g.userData.wh.forEach((w) => { w.rotation.z = -(uh > 0 ? uh * 30 : u * 2); }); return {}; } };

  // ---------- n7 mobil murah (LCGC)
  X.s8 = { mood: 'day', face: ['determined', 'delighted'], act: 'cheer', burst: { c: ['#FFFFFF', '#9DD8FF', '#E8D7B8'], n: 30, p: [0.9, 0.5, 1.6], s: 4.5, z: 0.2 }, shake: 0.12,
    build(g) { const c = new THREE.Group(); g.add(c); g.userData.car = c; box(c, 2.6, 0.7, 1.2, '#2FA8A0', 0, 0.55, 0); box(c, 1.4, 0.6, 1.1, '#CFE8FF', 0.1, 1.15, 0, { roughness: 0.2 }); box(c, 1.3, 0.1, 1.15, '#2FA8A0', 0.1, 1.5, 0);
      for (const x of [-0.85, 0.85]) { const w = mesh(new THREE.CylinderGeometry(0.34, 0.34, 1.3, 16), mat('#1B1B2F'), x, 0.34, 0, c); w.rotation.x = Math.PI / 2; mesh(new THREE.CylinderGeometry(0.17, 0.17, 1.32, 12), mat('#C9CED8'), x, 0.34, 0, c).rotation.x = Math.PI / 2; }
      for (const z of [-0.4, 0.4]) sph(c, 0.1, '#FFF2B0', -1.3, 0.6, z, 1, 1, 1, { emissive: '#FFF2B0', emissiveIntensity: 0.8 });
      board(g, [['MOBIL MURAH', 48, '#B3261E'], ['Rp156.250.000', 54, '#1B1B2F']], 1.0, 2.5, 0.4, 1.9, 0.62); },
    anim(u, uh, g, pi) { const c = g.userData.car; const x = lerp(6, 1.05, easeOut(clamp(u / 0.6))); c.position.set(x, 0, 1.2); sc1(c, 1); c.rotation.z = uh > 0 ? 0.03 * Math.exp(-6 * uh) * Math.sin(uh * 30) : 0; c.scale.y = uh > 0 ? 1 + 0.05 * Math.exp(-6 * uh) * Math.cos(uh * 26) : 1; return {}; } };

  // ---------- n8 rusun subsidi: a block of flats grows out of the ground
  X.s9 = { mood: 'day', face: ['neutral', 'surprised'], act: 'jolt', burst: { c: ['#E8D7B8', '#CDBA95', '#F5EDDC'], n: 40, p: [1.0, 0.2, -0.4], s: 5.5, z: 0.3 }, shake: 0.22,
    build(g) { const B = new THREE.Group(); g.add(B); g.userData.B = B; const wt = winTex(256, 512, 4, 10);
      const body = mesh(new THREE.BoxGeometry(1.7, 4.4, 1.3), [mat('#E6D5B8'), mat('#E6D5B8'), mat('#D9C7A5'), mat('#D9C7A5'), new THREE.MeshBasicMaterial({ map: wt, toneMapped: false }), mat('#E6D5B8')], 0, 2.2, 0, B);
      box(B, 1.9, 0.18, 1.5, '#8A6B54', 0, 4.5, 0); box(B, 0.5, 0.5, 0.5, '#9AA7B8', -0.5, 4.85, 0);
      board(g, [['RUSUN SUBSIDI', 44, '#B3261E'], ['maks Rp652.500.000', 38, '#1B1B2F']], 1.0, 2.0, 1.7, 1.9, 0.62); g.userData.sign = g.children[g.children.length - 1]; },
    anim(u, uh, g) { const B = g.userData.B; B.position.set(1.1, 0, -1.3); B.scale.set(1, uh > 0 ? Math.max(0.03, pop(uh / 0.55)) : 0.03, 1); g.userData.sign.visible = uh > 0.25; return {}; } };

  // ---------- n9 helicopter: lands, then lifts ayam and the whole ground sinks away
  X.s10 = { mood: 'day', pad: 'heli', face: ['determined', 'laugh'], act: 'cheer', burst: { c: ['#FFFFFF', '#CFE8FF', '#E8D7B8'], n: 34, p: [1.0, 0.4, 1.4], s: 5, z: 0.24 }, shake: 0.12,
    build(g) { const H = new THREE.Group(); g.add(H); g.userData.H = H; const R = new THREE.Group(); R.position.y = 1.1; H.add(R); g.userData.R = R;
      sph(H, 0.7, RED, 0, 0.6, 0, 1.15, 0.8, 0.8); sph(H, 0.42, '#CFE8FF', 0.45, 0.72, 0, 1, 0.9, 0.85, { roughness: 0.2 }); cyl(H, 0.07, 0.1, 1.7, RED, -1.2, 0.72, 0).rotation.z = Math.PI / 2; box(H, 0.06, 0.5, 0.16, RED, -2.0, 0.95, 0);
      cyl(H, 0.06, 0.06, 0.25, '#2B2430', 0, 1.0, 0); for (const z of [-0.45, 0.45]) { box(H, 1.5, 0.05, 0.06, '#2B2430', 0.05, 0.02, z); } for (const x of [-0.4, 0.5]) for (const z of [-0.4, 0.4]) cyl(H, 0.025, 0.025, 0.4, '#2B2430', x, 0.2, z);
      box(R, 3.4, 0.035, 0.16, '#2B2430', 0, 0, 0); box(R, 0.16, 0.035, 3.4, '#2B2430', 0, 0, 0); },
    anim(u, uh, g, pi) { const H = g.userData.H; const land = easeOut(clamp(u / 0.8)); H.position.set(lerp(4, 1.0, land), lerp(5, 0.05, land) + (uh > 0 ? 0.35 * easeOut(clamp(uh / 0.6)) : 0), 0.9); g.userData.R.rotation.y = u * 34; H.rotation.z = (1 - land) * 0.25; return { sink: uh > 0 ? easeIn(clamp(uh / 0.85)) : 0 }; } };

  // ---------- n10 emas batangan: a pyramid of gold bars
  X.s11 = { mood: 'sky', face: ['neutral', 'delighted'], act: 'nod', burst: { c: ['#FFE08A', '#FFFFFF', '#F2B134'], n: 36, p: [0.9, 1.3, 1.2], s: 4.5, z: 0.12 }, shake: 0.08,
    build(g) { const P = new THREE.Group(); g.add(P); g.userData.bars = []; let k = 0;
      for (let l = 0; l < 5; l++) for (let i = 0; i < 5 - l; i++) for (let d = 0; d < 2; d++) { const b = box(P, 0.5, 0.15, 0.27, GOLD, (i - (4 - l) / 2) * 0.54, 0.075 + l * 0.15, d * 0.3, { roughness: 0.3, metalness: 0.5, emissive: '#6B4500', emissiveIntensity: 0.35 }); g.userData.bars.push({ b, k: k++ }); }
      P.position.set(0.95, 0, 1.0); g.userData.P = P; board(g, [['EMAS ANTAM', 48, '#B3261E'], ['Rp2.546.000 / gram', 42, '#1B1B2F']], 0.95, 1.9, 1.2, 1.8, 0.62); },
    anim(u, uh, g) { g.userData.bars.forEach(({ b, k }) => { const kk = clamp((u - 0.04 * k) / 0.2); sc1(b, pop(kk)); }); return {}; } };

  // ---------- n11 dapur MBG: a row of community kitchens
  X.s12 = { mood: 'sky', face: ['determined', 'delighted'], act: 'cheer', burst: { c: ['#FFFFFF', '#CFEFFF', '#BFE3F2'], n: 34, p: [1.0, 1.0, -0.8], s: 3.5, z: 0.22 }, shake: 0.1,
    build(g) { g.userData.h = []; for (let i = 0; i < 5; i++) { const h = new THREE.Group(); h.position.set(-0.8 + i * 1.05, 0, -0.9 - (i % 2) * 0.4); g.add(h); box(h, 0.9, 0.7, 0.7, '#F1E7D0', 0, 0.35, 0); const r = box(h, 1.0, 0.1, 0.8, '#2FA84F', 0, 0.78, 0); r.rotation.z = 0.0; box(h, 0.26, 0.4, 0.04, '#6B4A2B', -0.2, 0.22, 0.37); cyl(h, 0.07, 0.07, 0.35, '#9AA7B8', 0.28, 0.95, -0.1); const sb = signBoard([['MBG', 80, '#2FA84F']], 0.7, 0.3); sb.position.set(0.1, 1.15, 0.38); h.add(sb); g.userData.h.push(h); } },
    anim(u, uh, g) { g.userData.h.forEach((h, i) => { sc1(h, pop((u - 0.06 * i) / 0.25)); }); return {}; } };

  // ---------- n12 setengah hari anggaran MBG: trays of free meals in a long line
  X.s13 = { mood: 'sky', face: ['neutral', 'surprised'], act: 'jolt', burst: { c: ['#F4C15D', '#8FBF4D', '#FFFFFF'], n: 34, p: [0.9, 0.5, 1.0], s: 4, z: 0.14 }, shake: 0.1,
    build(g) { g.userData.t = []; for (let r = 0; r < 12; r++) for (let c = 0; c < 2; c++) { const t = new THREE.Group(); t.position.set(0.2 + c * 1.3, 0.04, 3.4 - r * 1.1); g.add(t); box(t, 1.0, 0.06, 0.66, '#DDE3EA', 0, 0, 0); const cols = ['#FFFFFF', '#8FBF4D', '#E0952E', '#E8586B']; cols.forEach((cl, k) => box(t, 0.4, 0.05, 0.26, cl, -0.25 + (k % 2) * 0.5, 0.05, -0.15 + Math.floor(k / 2) * 0.3)); g.userData.t.push({ t, k: r * 2 + c }); } },
    anim(u, uh, g) { g.userData.t.forEach(({ t, k }) => { sc1(t, pop((u - 0.025 * k) / 0.2)); }); return {}; } };

  // ---------- n13 roket: ayam rides it out of the atmosphere
  X.s14 = { mood: 'day', noFar: true, noCrowd: true, face: ['determined', 'surprised'], act: 'wings_up', burst: { c: ['#FFD84D', '#FF8A1F', '#FFFFFF'], n: 40, p: [0.75, 0.3, -0.3], s: 6, z: 0.3 }, shake: 0.3,
    build(g) {
      const R = new THREE.Group(); g.add(R); g.userData.R = R; cyl(R, 0.4, 0.4, 2.6, '#F4F6FA', 0, 1.5, 0, { roughness: 0.4 }, 20); cyl(R, 0.0, 0.4, 0.95, RED, 0, 3.3, 0, {}, 20); for (let k = 0; k < 3; k++) { const f = box(R, 0.1, 0.8, 0.5, RED, Math.cos(k * 2.094) * 0.5, 0.45, Math.sin(k * 2.094) * 0.5); f.rotation.y = -k * 2.094; }
      const w = mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.1, 16), mat('#7FC8FF', { roughness: 0.2 }), 0, 2.3, 0.4, R); w.rotation.x = Math.PI / 2; const fl = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.5, 16), new THREE.MeshBasicMaterial({ color: '#FFB020', toneMapped: false })); fl.position.y = -0.15; fl.rotation.x = Math.PI; fl.visible = false; R.add(fl); g.userData.fl = fl;
      // launch site: concrete pad, gantry tower with a swing arm, the sea behind
      box(g, 2.2, 0.08, 1.8, '#B8BFCC', 0.75, 0.04, -0.6);
      for (const x2 of [1.72, 2.0]) box(g, 0.08, 3.6, 0.08, '#C0392B', x2, 1.8, -0.6); for (let i = 0; i < 7; i++) { const bb = box(g, 0.42, 0.05, 0.05, '#C0392B', 1.86, 0.3 + i * 0.5, -0.6); bb.rotation.z = (i % 2 ? 0.55 : -0.55); }
      g.userData.arm = box(g, 1.0, 0.1, 0.12, '#C0392B', 1.2, 2.3, -0.6);
      const sea = mesh(new THREE.PlaneGeometry(40, 5), mat('#2E9BDA', { roughness: 0.4 }), 0, 0.02, -6, g); sea.rotation.x = -Math.PI / 2; sea.castShadow = false;
      g.userData.cl = []; for (let i = 0; i < 12; i++) { const c = new THREE.Group(); g.add(c); for (let k = 0; k < 3; k++) { const s = mesh(new THREE.SphereGeometry(1, 12, 9), new THREE.MeshBasicMaterial({ color: '#FFFFFF', toneMapped: false, transparent: true, opacity: 0.92 }), (k - 1) * 0.8, k === 1 ? 0.3 : 0, 0, c); s.scale.set(1.1, 0.65, 0.8); s.castShadow = false; } c.position.set(-2.5 + rr(i, 51) * 6, 5 + i * 3.6, -3 - rr(i, 52) * 3); c.scale.setScalar(1 + rr(i, 53) * 0.9); c.visible = false; g.userData.cl.push(c); }
      g.userData.sm = []; for (let i = 0; i < 18; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0, toneMapped: false, depthWrite: false })); s.castShadow = false; g.add(s); g.userData.sm.push(s); } },
    anim(u, uh, g, pi, t) { const R = g.userData.R, kk = g.userData.kk || 1, y = uh > 0 ? (uh < 1.2 ? 9 * uh * uh : 13 + 21 * (uh - 1.2)) : 0; const cd = uh < 0 && uh > -1.2 ? (1.2 + uh) / 1.2 : 0;
      R.position.set(0.75 + 0.02 * cd * Math.sin(u * 90), y, -0.6); R.rotation.z = uh > 0 ? 0.015 * Math.sin(uh * 60) : 0.02 * cd * Math.sin(u * 70); sc1(R, pi); g.userData.fl.visible = uh > -0.5; g.userData.fl.scale.set(1, 0.7 + 0.5 * Math.abs(Math.sin(t * 40)) + (uh > 0 ? 0.6 : 0), 1);
      g.userData.arm.position.x = 1.2 + (uh > -0.6 ? 0.55 * easeOut(clamp((uh + 0.6) / 0.4)) : 0);
      const k = uh > -1.0 ? clamp((uh + 1.0) / 1.6) : 0; g.userData.sm.forEach((s, i) => { const a = i * 0.41, d = rr(i, 2), sp = 0.25 + 1.7 * k * (0.4 + d); s.position.set(0.75 + Math.cos(a) * sp, 0.15 + 0.2 * d + 0.55 * k * d, -0.6 + Math.sin(a) * sp * 0.8); s.scale.setScalar(k > 0 ? (0.14 + 0.4 * d) * (0.4 + 1.3 * k) : 0.001); s.material.opacity = k > 0 ? 0.88 * (1 - clamp((uh - 1.0) / 1.2)) : 0; });
      g.userData.cl.forEach((c) => { c.visible = uh > 0.2; });
      return { dy: 0.3 * y * kk, dly: 0.55 * y * kk, dz: 2 }; } };

  // ---------- n14 pabrik mobil listrik BYD: peresmian. Ayam melompat ke pita, gunting raksasa, SNIP di hit, pintu gulung naik, mobil keluar satu per satu
  X.s15 = { mood: 'day', noFar: true, noCrowd: true, face: ['determined', 'laugh'], act: 'cheer', burst: { c: ['#FF3B3B', '#FFD84D', '#FFFFFF', '#6CFF9A'], n: 50, p: [1.9, 0.9, 1.5], s: 5, z: 0.12, g: 5 }, shake: 0.16,
    build(g) {
      const FX = 1.9, F = new THREE.Group(); g.add(F); g.userData.F = F;
      F.position.z = 0.3;
      { const jb = ID_PROV.find((p) => p.n === 'JAWA BARAT'), ring = jb.r[0]; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const [a2, c2] of ring) { x0 = Math.min(x0, a2); x1 = Math.max(x1, a2); y0 = Math.min(y0, c2); y1 = Math.max(y1, c2); }
        const sx = 4.3 / (x1 - x0), sy = sx * 1.5, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, sh = new THREE.Shape(); ring.forEach(([a2, c2], i) => { const px = (a2 - cx) * sx, py = (c2 - cy) * sy; if (i) sh.lineTo(px, py); else sh.moveTo(px, py); });
        const eg = new THREE.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: false }); eg.rotateX(-Math.PI / 2); const slab = new THREE.Mesh(eg, [mat('#8FCB72', { roughness: 0.9 }), mat('#5E9A4A')]); slab.position.set(0.9, 0.0, 0.5); slab.receiveShadow = true; g.add(slab);
        const tb = signBoard([['JAWA BARAT', 70, '#FFFFFF']], 1.0, 0.2, '#3E7D3B', '#24501F'); tb.position.set(-0.2, 0.18, 2.05); g.add(tb); g.userData.tb = tb; }
      // forecourt + hall + blue base stripe
      box(F, 4.6, 0.03, 2.2, '#8C96A8', FX, 0.015, 0.9); for (let i = 0; i < 6; i++) box(F, 0.3, 0.032, 0.05, '#FFFFFF', FX - 1.9 + i * 0.76, 0.02, 1.7);
      box(F, 3.0, 1.3, 2.0, '#E4E9F1', FX, 0.65, -0.4); box(F, 3.02, 0.2, 2.02, '#2FA8E0', FX, 0.1, -0.4);
      // sawtooth roof with glass faces (two teeth), rooftop vents
      const tri = new THREE.Shape(); tri.moveTo(0, 0); tri.lineTo(1.0, 0); tri.lineTo(1.0, 0.5); tri.closePath();
      for (let j = 0; j < 2; j++) { const eg = new THREE.ExtrudeGeometry(tri, { depth: 3.0, bevelEnabled: false }); eg.translate(0, 0, -1.5); const p = mesh(eg, mat('#B7C1D1', { roughness: 0.6 }), FX, 1.3, -1.4 + j * 1.0, F); p.rotation.y = -Math.PI / 2; mesh(new THREE.PlaneGeometry(2.9, 0.48), new THREE.MeshBasicMaterial({ color: '#BFE6FF', toneMapped: false }), FX, 1.3 + 0.25, -0.4 + j * 1.0 + 0.012, F); }
      for (const dx of [-0.9, -0.3, 0.3]) cyl(F, 0.07, 0.07, 0.22, '#9AA7B8', FX + dx, 1.9, -0.9);
      // office tower behind-right with lit windows
      const win = tex(128, 320, (c, w, h) => { c.fillStyle = '#B9C6DA'; c.fillRect(0, 0, w, h); for (let r = 0; r < 12; r++) for (let q = 0; q < 4; q++) { c.fillStyle = (r * 5 + q * 3) % 7 < 4 ? '#FFE9A8' : '#5A7BA8'; c.fillRect(10 + q * 29, 10 + r * 25, 20, 16); } }).t;
      mesh(new THREE.BoxGeometry(0.95, 2.7, 0.95), [mat('#C8D2E0'), mat('#C8D2E0'), mat('#C8D2E0'), mat('#C8D2E0'), new THREE.MeshBasicMaterial({ map: win, toneMapped: false }), mat('#C8D2E0')], FX + 1.35, 1.35, -1.5, F);
      // gate: warm glow, roll-up door (hangs from the top edge), BYD sign above
      box(F, 1.0, 0.82, 0.04, '#14161C', FX, 0.43, 0.6); mesh(new THREE.PlaneGeometry(0.94, 0.78), new THREE.MeshBasicMaterial({ color: '#FFE9A8', toneMapped: false }), FX, 0.43, 0.63, F);
      const dt = tex(128, 128, (c, w, h) => { c.fillStyle = '#9AA3B5'; c.fillRect(0, 0, w, h); c.strokeStyle = '#6E788C'; c.lineWidth = 3; for (let y = 0; y < h; y += 14) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); } }).t;
      const Dr = new THREE.Group(); Dr.position.set(FX, 0.84, 0.66); F.add(Dr); g.userData.Dr = Dr; mesh(new THREE.PlaneGeometry(0.96, 0.8), new THREE.MeshBasicMaterial({ map: dt, toneMapped: false }), 0, -0.4, 0, Dr);
      const sb = signBoard([['BYD', 150, '#FFFFFF']], 1.5, 0.38, '#B3261E', '#1B1B2F'); sb.position.set(FX, 1.1, 0.62); F.add(sb); g.userData.sb = sb;
      { const bn = signBoard([['PABRIK MOBIL LISTRIK', 64, '#FFFFFF']], 2.6, 0.4, '#0E7C86', '#0B3A40'); bn.position.set(FX, 2.55, -0.3); F.add(bn); for (const px of [-1.0, 1.0]) cyl(F, 0.025, 0.025, 0.8, '#6E788C', FX + px, 2.1, -0.3); }
      // ribbon: two gold posts, a red ribbon in two halves (each pivots on its post), a bow in the middle
      const RY = 0.42, RZ = 1.35, PL = FX - 0.8, PR = FX + 0.8;
      for (const px of [PL, PR]) { cyl(F, 0.035, 0.045, RY + 0.12, GOLD, px, (RY + 0.12) / 2, RZ); sph(F, 0.06, GOLD, px, RY + 0.14, RZ); }
      const half = (px, dir) => { const R = new THREE.Group(); R.position.set(px, RY, RZ); F.add(R); box(R, 0.8, 0.11, 0.012, '#E53935', dir * 0.4, 0, 0); return R; };
      g.userData.RL = half(PL, 1); g.userData.RR = half(PR, -1);
      const bow = new THREE.Group(); bow.position.set(FX, RY, RZ + 0.01); F.add(bow); g.userData.bow = bow; sph(bow, 0.075, '#B3261E', -0.07, 0, 0, 1, 0.8, 0.5); sph(bow, 0.075, '#B3261E', 0.07, 0, 0, 1, 0.8, 0.5); sph(bow, 0.045, '#E53935', 0, 0, 0.02);
      // ceremonial giant scissors (two blades crossing at the pivot, gold handle rings)
      const Sc = new THREE.Group(); g.add(Sc); g.userData.Sc = Sc; g.userData.bl = [];
      for (const sgn of [1, -1]) { const B = new THREE.Group(); Sc.add(B); box(B, 0.5, 0.035, 0.02, '#D8DEE8', 0.25, 0, sgn * 0.012, { metalness: 0.7, roughness: 0.25 }); const rg = mesh(new THREE.TorusGeometry(0.06, 0.016, 8, 16), mat(GOLD, { metalness: 0.5 }), -0.1, sgn * 0.075, sgn * 0.012, B); g.userData.bl.push([B, sgn]); }
      // cars waiting inside the factory
      g.userData.cars = [miniCar(g, '#2FA8E0'), miniCar(g, '#F2B134'), miniCar(g, '#7BC96F')];
    },
    anim(u, uh, g, pi, t) {
      const U = g.userData, kk = U.kk || 1, FX = 1.9, tH = u - uh, s = Math.max(0.001, pi), HX0 = -0.95;
      U.F.scale.setScalar(s); U.F.position.x = FX * (1 - s);
      // the chicken hops to the ribbon (three hops), crouches (uang.js), then jumps for joy
      const w = clamp((u - 0.15) / Math.max(0.4, tH - 0.75 - 0.15)), we = easeOut(w);
      const ax = 1.95 * we, az = 1.65 * we;
      let ay = w < 1 ? 0.16 * Math.abs(Math.sin(w * 3 * Math.PI)) : (uh > 0 ? 0.28 * Math.exp(-3 * uh) * Math.abs(Math.sin(uh * 9)) : 0.03 * Math.abs(Math.sin(u * 6)));
      // scissors follow the chicken, open wide on the anticipation, SNAP on the hit
      const Sc = U.Sc, ayx = HX0 + ax; const lift = uh > 0.35 ? clamp((uh - 0.35) / 0.8) : 0;
      Sc.visible = u > 0.2 && uh < 1.2; Sc.position.set(ayx + 0.38 + 0.1 * lift, lerp(ay + 0.2, 0.42, we) + 1.2 * lift * lift, az + 0.04); Sc.rotation.set(0, 0, 0.12 * Math.sin(u * 9) * (1 - we) - 0.5 * lift); Sc.scale.setScalar(Math.max(0.001, pop((u - 0.2) / 0.25)) * (1 - 0.8 * lift));
      const open = uh < -0.07 ? 0.12 + 0.4 * easeOut(clamp((u - (tH - 1.1)) / 0.7)) + 0.04 * Math.sin(u * 28) * clamp((u - (tH - 0.5)) / 0.3) : (uh < 0 ? lerp(0.52, 0, clamp((uh + 0.07) / 0.07)) : 0);
      U.bl.forEach(([B, sg]) => { B.rotation.z = sg * open; });
      // the ribbon halves fall and flutter, the bow drops
      const a = uh > 0 ? 1.45 * easeOut(clamp(uh / 0.4)) + 0.1 * Math.sin(uh * 26) * Math.exp(-2.5 * uh) : 0;
      U.RL.rotation.z = -a; U.RR.rotation.z = a; U.bow.visible = uh < 0.7; U.bow.position.y = 0.42 - (uh > 0 ? 3.2 * uh * uh : 0); U.bow.rotation.z = uh > 0 ? uh * 6 : 0;
      // door rolls up with a little overshoot, sign blinks, cars roll out one by one
      const op = uh > 0.05 ? easeOut(clamp((uh - 0.05) / 0.5)) : 0; U.Dr.scale.y = Math.max(0.08, 1 - 0.92 * op);
      U.sb.scale.setScalar(1 + (uh > 0 ? 0.12 * Math.exp(-6 * uh) * Math.abs(Math.sin(uh * 20)) : 0));
      U.cars.forEach((c, i) => { const k = uh > 0 ? clamp((uh - 0.45 - 0.32 * i) / 1.1) : 0; const e = easeIn(k); c.visible = k > 0 && k < 1; c.position.set(FX + 4.6 * e + (k < 0.15 ? 0 : 0), 0.02, lerp(1.0, 1.35, clamp(k / 0.2))); c.scale.setScalar(0.62); c.rotation.set(0, 0, 0.03 * Math.sin(k * 40)); });
      // camera: wide on the whole site, pushes in on the ribbon, a small pull-back after the cut
      const pre = easeOut(clamp(u / Math.max(0.1, tH))), dz = 5 - 3 * (uh < 0 ? pre : 1 - 0.6 * easeOut(clamp(uh / 1.3)));
      return { ay, ax, az, dx: 1.2 * kk, dlx: 1.2 * kk, dz, dly: 0.2 * kk, dy: -0.5 * kk };
    } };

  // ---------- n15 satelit: stasiun bumi, 7 satelit diluncurkan satu per satu ke langit
  X.s16 = { mood: 'day', noFar: true, noCrowd: true, face: ['determined', 'delighted'], act: 'wings_up', burst: { c: ['#8FD3FF', '#FFFFFF', '#FFD84D'], n: 34, p: [1.4, 1.3, 0.3], s: 4, z: 0.12 }, shake: 0.08,
    build(g) {
      g.userData.s = [];
      g.userData.s = []; const pt = tex(128, 64, (c, w, h) => { c.fillStyle = '#2A4EC8'; c.fillRect(0, 0, w, h); c.strokeStyle = '#8FB0FF'; c.lineWidth = 2; for (let x = 0; x <= w; x += 16) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } for (let y = 0; y <= h; y += 16) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); } }).t;
      for (let i = 0; i < 7; i++) { const s = new THREE.Group(); g.add(s); box(s, 0.34, 0.34, 0.34, '#E8C066', 0, 0, 0, { roughness: 0.4, metalness: 0.4 }); for (const x of [-1, 1]) { const p = mesh(new THREE.BoxGeometry(0.62, 0.02, 0.3), new THREE.MeshBasicMaterial({ map: pt, toneMapped: false }), x * 0.5, 0, 0, s); } cyl(s, 0.0, 0.14, 0.12, '#EEF1F6', 0, 0.25, 0); g.userData.s.push(s); }
      g.userData.sat = g.userData.s.map((s) => { const tr = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.9, 8), new THREE.MeshBasicMaterial({ color: '#FFD84D', transparent: true, opacity: 0.85, toneMapped: false })); tr.rotation.x = Math.PI; tr.position.y = -0.55; s.add(tr); return { s, tr }; });
      const D = new THREE.Group(); g.add(D); D.position.set(1.15, 0, 0.2); cyl(D, 0.09, 0.14, 0.75, '#9AA7B8', 0, 0.38, 0); box(D, 0.5, 0.12, 0.5, '#7B8698', 0, 0.06, 0);
      const T = new THREE.Group(); T.position.set(0, 0.85, 0); T.rotation.z = -0.55; D.add(T); mesh(new THREE.SphereGeometry(0.62, 28, 14, 0, Math.PI * 2, Math.PI - 1.0, 1.0), new THREE.MeshStandardMaterial({ color: '#F4F6FA', side: THREE.DoubleSide, roughness: 0.45 }), 0, 0.62, 0, T); cyl(T, 0.015, 0.015, 0.6, '#CCD3DD', 0, 0.45, 0); sph(T, 0.05, '#FF5A4D', 0, 0.78, 0);
      box(g, 0.7, 0.45, 0.55, '#EEF1F6', -0.1, 0.225, -1.0); box(g, 0.78, 0.07, 0.62, '#3A6DBF', -0.1, 0.48, -1.0);
      g.userData.rings = [0, 1, 2].map(() => { const r = new THREE.Mesh(new THREE.TorusGeometry(1, 0.025, 8, 40), new THREE.MeshBasicMaterial({ color: '#8FD3FF', transparent: true, opacity: 0, toneMapped: false })); r.position.set(1.4, 1.3, 0.2); g.add(r); return r; }); },
    anim(u, uh, g, pi, t) {
      const tH = u - uh, S0 = [1.45, 1.35, 0.25], dt = Math.max(0.2, (tH - 0.5 - 0.9) / 6); let bump = 0;
      g.userData.sat.forEach(({ s, tr }, i) => { const tl = 0.45 + i * dt, k = clamp((u - tl) / 0.9), e = easeOut(k), sl = [-0.1 + i * 0.36, 2.35 + 0.3 * Math.sin(i * 0.9), -1.0 - (i % 2) * 0.6]; s.visible = k > 0;
        s.position.set(lerp(S0[0], sl[0], e), lerp(S0[1], sl[1], e) + 0.5 * Math.sin(Math.PI * k) + (k >= 1 ? 0.04 * Math.sin(t * 2 + i) : 0), lerp(S0[2], sl[2], e)); s.rotation.set(0.3, k < 1 ? k * 6 : t * 0.5 + i, 0.2); s.scale.setScalar(0.85 + (uh > 0 ? 0.3 * Math.exp(-5 * uh) * Math.abs(Math.sin(uh * 12 + i)) : 0)); tr.visible = k > 0 && k < 0.98; tr.scale.set(1, 1 - k * 0.6, 1); const v = u - tl; if (v > 0 && v < 0.3) bump = Math.max(bump, 0.14 * Math.sin(v / 0.3 * Math.PI)); });
      g.userData.rings.forEach((r, j) => { const q = clamp((uh - j * 0.14) / 0.9); r.visible = uh > 0 && q < 1; r.scale.setScalar(0.15 + 2.0 * easeOut(q)); r.material.opacity = 0.9 * (1 - q); });
      return { ay: 0.03 + bump, dly: 0.7 * (g.userData.kk || 1), dz: 1, dx: 0.3 * (g.userData.kk || 1), dlx: 0.3 * (g.userData.kk || 1) }; } };

  // ---------- n16 kereta cepat: stasiun, dua kereta masuk dari arah berlawanan dan berhenti tepat di hit
  X.s17 = { mood: 'day', noFar: true, noCrowd: true, face: ['neutral', 'surprised'], act: 'jolt', burst: { c: ['#FFFFFF', '#CFE8FF', '#FF8FA3'], n: 34, p: [0.5, 0.5, 0.3], s: 5, z: 0.14 }, shake: 0.16,
    build(g) {
      box(g, 5.0, 0.3, 1.1, '#C9CED8', 0.5, 0.15, 1.25); box(g, 5.0, 0.012, 0.09, '#F2C531', 0.5, 0.306, 0.82);
      for (const px of [-1.4, 0.2, 1.8]) cyl(g, 0.04, 0.04, 1.7, '#7B8698', px, 1.1, 1.65); box(g, 4.4, 0.07, 1.4, '#E8EBF1', 0.5, 1.98, 1.3); box(g, 4.4, 0.05, 0.05, '#2FA8E0', 0.5, 1.93, 2.0);
      const nb = signBoard([['STASIUN', 90, '#FFFFFF']], 1.1, 0.3, '#1F5FB0', '#0E2F58'); nb.position.set(0.5, 1.6, 1.78); g.add(nb);
      for (const z of [-0.2, -1.5]) { box(g, 7, 0.05, 0.9, '#8B8378', 0.5, 0.025, z); for (const dz of [-0.25, 0.25]) box(g, 7, 0.04, 0.045, '#6E788C', 0.5, 0.07, z + dz); for (let i = 0; i < 18; i++) box(g, 0.12, 0.03, 0.7, '#5A4A3A', -2.9 + i * 0.4, 0.055, z); }
      g.userData.tr = []; for (let k = 0; k < 2; k++) { const T = new THREE.Group(); g.add(T); const sg = k ? 1 : -1; box(T, 3.1, 0.62, 0.62, '#FFFFFF', 0, 0.56, 0); box(T, 3.12, 0.16, 0.64, k ? '#E53935' : '#1E88E5', 0, 0.33, 0); box(T, 2.7, 0.22, 0.64, '#20406E', -sg * 0.1, 0.68, 0); sph(T, 0.31, '#F4F6FA', sg * 1.55, 0.55, 0, 1.4, 0.95, 1); sph(T, 0.12, '#FFE9A8', sg * 1.8, 0.5, 0.2, 1, 1, 1); T.userData.sg = sg; g.userData.tr.push(T); } },
    anim(u, uh, g, pi, t) {
      const tH = u - uh; g.userData.tr.forEach((T, i) => { const k = clamp((u - 0.2 - 0.12 * i) / Math.max(0.3, tH - 0.2 - 0.12 * i)), e = easeOut(k), from = i ? -7 : 7.5, to = i ? 0.1 : 0.9; T.scale.setScalar(i ? 1.2 : 1); T.position.set(lerp(from, to, e), (i ? 0.3 : 0.08) + (uh > 0 ? 0.04 * Math.exp(-6 * uh) * Math.sin(uh * 30) : 0), i ? -1.5 : -0.2); T.scale.y *= uh > 0 ? 1 - 0.03 * Math.exp(-6 * uh) * Math.cos(uh * 25) : 1; });
      return { ay: 0.3 + (uh > 0 ? 0.25 * Math.exp(-3 * uh) * Math.abs(Math.sin(uh * 9)) : 0.02 * Math.abs(Math.sin(u * 6))), ax: 0.5, az: 1.2, dly: 0.3 * (g.userData.kk || 1), dz: 3, dx: 0.2 * (g.userData.kk || 1), dlx: 0.2 * (g.userData.kk || 1) }; } };

  // ---------- n17 es teh untuk semua orang Indonesia: peta Indonesia 2D menyala provinsi demi provinsi dengan warna teh
  X.s18 = { mood: 'day', noFar: true, noCrowd: true, face: ['delighted', 'laugh'], act: 'cheer', burst: { c: ['#C97B2A', '#FFFFFF', '#FFD9A0'], n: 40, p: [0.45, 1.6, 1.2], s: 4, z: 0.12 }, shake: 0.1,
    build(g) {
      g.userData.mb = mapBoard(g, 'ID', 3.9, 0.45, 2.55, -0.8, 'rgba(120,190,240,0.55)');
      const gl = new THREE.Group(); g.add(gl); g.userData.gl = gl; cyl(gl, 0.4, 0.32, 1.2, '#CFEFFF', 0, 0.6, 0, { transparent: true, opacity: 0.3, roughness: 0.8 }); cyl(gl, 0.37, 0.3, 0.95, '#B5651D', 0, 0.5, 0); for (let k = 0; k < 4; k++) box(gl, 0.2, 0.2, 0.2, '#F4F8FF', -0.15 + (k % 2) * 0.3, 0.88, -0.1 + (k % 3) * 0.1, { transparent: true, opacity: 0.8 }); cyl(gl, 0.03, 0.03, 1.5, '#E8394D', 0.15, 0.9, 0).rotation.z = -0.15;
    },
    anim(u, uh, g, pi, t) {
      const tH = u - uh, f = clamp((u - 0.45) / Math.max(0.3, tH + 0.4 - 0.45)), n = f * (PROVS.length + 3); g.userData.mb.draw((i) => { const k = clamp(n - i); return k <= 0 ? '#E6ECF5' : mixC('#E6ECF5', '#B8651D', Math.min(1, k * 1.4)); }); g.userData.mb.m.scale.setScalar(Math.max(0.001, pop(u / 0.25)));
      const gl = g.userData.gl; gl.position.set(0.45, 0, 1.2); sc1(gl, pi); gl.rotation.y = 0.35 * Math.sin(u * 2); gl.position.y = uh > 0 ? 0.08 * Math.exp(-4 * uh) * Math.abs(Math.sin(uh * 12)) : 0;
      return { dz: 0, dx: 0.2 * (g.userData.kk || 1), dlx: 0.2 * (g.userData.kk || 1), dly: 1.0 * (g.userData.kk || 1) }; } };

  // ---------- n18 seluruh APBN 2026: a stack of giant budget books
  X.s19 = { mood: 'day', face: ['neutral', 'surprised'], act: 'jolt', burst: { c: ['#FFD84D', '#FFFFFF', '#6CFF9A'], n: 36, p: [0.9, 2.0, 1.2], s: 4.5, z: 0.16 }, shake: 0.14,
    build(g) { const mkCv = (yr) => tex(340, 460, (c, w, h) => { c.fillStyle = '#1F3A68'; c.fillRect(0, 0, w, h); c.strokeStyle = '#FFD84D'; c.lineWidth = 10; c.strokeRect(16, 16, w - 32, h - 32); c.fillStyle = '#FFD84D'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = "900 96px 'Arial Black'"; c.fillText('APBN', w / 2, 130); c.font = "900 80px 'Arial Black'"; c.fillText(yr, w / 2, 230); c.font = "900 44px 'Arial Black'"; c.fillStyle = '#FFFFFF'; c.fillText('Rp3.842,7', w / 2, 330); c.fillText('TRILIUN', w / 2, 385); }).t;
      g.userData.bk = []; for (let k = 0; k < 2; k++) { const b = mesh(new THREE.BoxGeometry(1.2, 1.7, 0.35), [mat('#F4EFE0'), mat('#F4EFE0'), mat('#F4EFE0'), mat('#F4EFE0'), new THREE.MeshBasicMaterial({ map: mkCv(String(2026 + k)), toneMapped: false }), mat('#F4EFE0')], 0, 0, 0, g); g.userData.bk.push(b); } },
    anim(u, uh, g) { const tH = u - uh; g.userData.bk.forEach((b, k) => { const kk = pop((u - (k ? tH + 0.02 : 0.1)) / 0.26); b.position.set(0.55 + k * 1.35, 0.85 * kk + (k && uh > 0 ? 0.06 * Math.exp(-4 * uh) * Math.sin(uh * 22) : 0), 1.0); b.rotation.set(0, -0.12 + k * 0.2, 0); sc1(b, kk); }); return { dx: 0.8 * (g.userData.kk || 1), dlx: 0.8 * (g.userData.kk || 1) }; } };

  // ---------- n19 utang negara: peta Indonesia, "UTANG INDONESIA", ayam memotong rantai, jadi hijau dan "LUNAS"
  X.s20 = { mood: 'day', noFar: true, noCrowd: true, face: ['determined', 'laugh'], act: 'wings_up', burst: { c: ['#6CFF9A', '#FFFFFF', '#FFD84D'], n: 46, p: [0.7, 1.0, 1.6], s: 5, z: 0.14 }, shake: 0.22,
    build(g) {
      g.userData.mb = mapBoard(g, 'ID', 3.9, 0.45, 2.4, -0.8, 'rgba(70,40,40,0.35)');
      const d1 = signBoard([['UTANG INDONESIA', 80, '#FFFFFF']], 2.4, 0.42, '#B3261E', '#4A0E0E'); d1.position.set(0.45, 2.35, -0.6); g.add(d1); g.userData.d1 = d1;
      const d2 = signBoard([['LUNAS', 130, '#FFFFFF']], 2.0, 0.62, '#2FA84F', '#0F4A22'); d2.position.set(0.45, 2.35, -0.55); g.add(d2); g.userData.d2 = d2;
      const CY = 0.55, CZ = 1.0, PL = -0.2, PR = 1.7;
      for (const px of [PL, PR]) { cyl(g, 0.05, 0.06, CY + 0.15, '#A8B2C2', px, (CY + 0.15) / 2, CZ); sph(g, 0.08, '#A8B2C2', px, CY + 0.16, CZ); }
      const half = (px, dir) => { const R = new THREE.Group(); R.position.set(px, CY, CZ); g.add(R); for (let i = 0; i < 5; i++) { const l = mesh(new THREE.TorusGeometry(0.1, 0.03, 8, 14), new THREE.MeshBasicMaterial({ color: '#C3CBD8', toneMapped: false }), dir * (0.1 + i * 0.17), 0, 0, R); l.scale.set(1.5, 1, 1); l.rotation.x = (i % 2) * Math.PI / 2; } return R; };
      g.userData.CL = half(PL, 1); g.userData.CR = half(PR, -1);
      const Cu = new THREE.Group(); g.add(Cu); g.userData.Cu = Cu; g.userData.cj = [];
      for (const sg of [1, -1]) { const B = new THREE.Group(); Cu.add(B); box(B, 0.16, 0.05, 0.03, '#D8DEE8', 0.08, 0, sg * 0.012, { metalness: 0.7, roughness: 0.25 }); box(B, 0.66, 0.05, 0.03, '#C53030', -0.33, 0, sg * 0.012); g.userData.cj.push([B, sg]); } },
    anim(u, uh, g, pi, t) {
      const U = g.userData, kk = U.kk || 1, tH = u - uh, w = clamp((u - 0.15) / Math.max(0.4, tH - 0.75 - 0.15)), we = easeOut(w), ax = 1.2 * we, az = 1.3 * we, HX0 = -0.95;
      const ay = w < 1 ? 0.16 * Math.abs(Math.sin(w * 3 * Math.PI)) : (uh > 0 ? 0.28 * Math.exp(-3 * uh) * Math.abs(Math.sin(uh * 9)) : 0.03 * Math.abs(Math.sin(u * 6)));
      const ayx = HX0 + ax, lift = uh > 0.35 ? clamp((uh - 0.35) / 0.8) : 0, Cu = U.Cu; Cu.visible = u > 0.2 && uh < 1.2;
      Cu.position.set(lerp(ayx + 0.35, 0.55, we), lerp(ay + 0.2, 0.55, we) + 1.0 * lift * lift, lerp(az + 0.1, 1.2, we)); Cu.scale.setScalar(Math.max(0.001, pop((u - 0.2) / 0.25)) * (1 - 0.8 * lift)); Cu.rotation.z = -0.4 * lift;
      const open = uh < -0.07 ? 0.12 + 0.4 * easeOut(clamp((u - (tH - 1.1)) / 0.7)) + 0.04 * Math.sin(u * 28) * clamp((u - (tH - 0.5)) / 0.3) : (uh < 0 ? lerp(0.52, 0, clamp((uh + 0.07) / 0.07)) : 0); U.cj.forEach(([B, sg]) => { B.rotation.z = sg * open; });
      const a = uh > 0 ? 1.4 * easeOut(clamp(uh / 0.4)) + 0.1 * Math.sin(uh * 26) * Math.exp(-2.5 * uh) : 0, fall = uh > 0.4 ? 3 * (uh - 0.4) * (uh - 0.4) : 0; U.CL.rotation.z = -a; U.CR.rotation.z = a; U.CL.position.y = U.CR.position.y = 0.55 - fall; U.CL.visible = U.CR.visible = uh < 1.3;
      U.d1.visible = uh <= 0; U.d2.visible = uh > 0.02; U.d2.scale.setScalar(Math.max(0.001, pop(uh / 0.3)));
      const n = uh > 0 ? easeOut(clamp(uh / 0.9)) * (PROVS.length + 3) : 0; U.mb.draw((i) => { const k = clamp(n - i); return k <= 0 ? '#CF9A9A' : mixC('#CF9A9A', '#46C46B', Math.min(1, k * 1.4)); }); U.mb.m.scale.setScalar(Math.max(0.001, pop(u / 0.25)));
      return { ay, ax, az, dz: 3, dx: 0.2 * kk, dlx: 0.2 * kk }; } };

  // ---------- n20 kuliah S1 gratis semua orang Indonesia: tiap provinsi memunculkan topi wisuda, lalu dilempar
  X.s21 = { mood: 'day', noFar: true, noCrowd: true, face: ['delighted', 'laugh'], act: 'cheer', burst: { c: ['#FFD84D', '#FFFFFF', '#FF6B5A', '#6CFF9A'], n: 46, p: [0.45, 1.8, 1.4], s: 5, z: 0.12, g: 3 }, shake: 0.12,
    build(g) {
      g.userData.mb = mapBoard(g, 'ID', 3.9, 0.45, 2.35, -0.8, 'rgba(120,190,240,0.5)');
      g.userData.caps = PROVS.map(() => { const c = new THREE.Group(); g.add(c); box(c, 0.2, 0.02, 0.2, '#1B1B2F', 0, 0, 0); cyl(c, 0.06, 0.06, 0.04, '#1B1B2F', 0, -0.03, 0); box(c, 0.01, 0.1, 0.01, GOLD, 0.09, -0.06, 0.09); return c; });
      const dp = new THREE.Group(); g.add(dp); g.userData.dip = dp; const sc = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.9, 12), mat('#FFF3D6'), 0, 0, 0, dp); sc.rotation.z = Math.PI / 2; cyl(dp, 0.115, 0.115, 0.12, RED, 0, 0, 0).rotation.z = Math.PI / 2; },
    anim(u, uh, g, pi, t) {
      const U = g.userData, kk = U.kk || 1, tH = u - uh, st = (i) => 0.4 + i * Math.max(0.02, (tH - 0.4 - 0.25) / PROVS.length);
      U.mb.draw((i) => mixC('#E6ECF5', '#F2B134', clamp((u - st(i)) / 0.2))); U.mb.m.scale.setScalar(Math.max(0.001, pop(u / 0.25)));
      PROVS.forEach((p, i) => { const c = U.caps[i], k = pop((u - st(i)) / 0.15), [px, py] = U.mb.pos(p.c[0], p.c[1]); if (uh <= 0) { c.position.set(px, py + 0.06 * k, -0.7); c.rotation.set(-0.3, 0, 0); c.scale.setScalar(Math.max(0.001, k)); c.visible = k > 0.01; } else { const vy = 2.4 + (i % 4) * 0.5, vx = (i - 16) * 0.05; c.position.set(px + vx * uh, py + vy * uh - 4.5 * uh * uh, -0.7 + 1.2 * uh); c.rotation.set(uh * 6, uh * 8, uh * 5); c.scale.setScalar(Math.max(0.001, 1 - clamp((uh - 1.0) / 0.4))); c.visible = uh < 1.4; } });
      const d = U.dip; d.position.set(0.45, 0.7 + 0.06 * Math.sin(u * 5), 1.2); sc1(d, pop(u / 0.3)); d.rotation.y = u * 1.5;
      return { dz: 0, dx: 0.2 * kk, dlx: 0.2 * kk, dly: 1.0 * kk }; } };

  // ---------- n21 HP burgundy untuk semua orang di bumi: peta dunia 2D terisi titik HP, globe dengan HP mengorbit
  X.s22 = { mood: 'day', noFar: true, noCrowd: true, face: ['neutral', 'delighted'], act: 'wings_up', burst: { c: ['#7B1E3A', '#FF8FA3', '#FFFFFF'], n: 46, p: [0.5, 1.2, 1.4], s: 5, z: 0.14 }, shake: 0.14,
    build(g) {
      g.userData.mb = mapBoard(g, 'W', 3.9, 0.45, 2.85, -0.9, 'rgba(120,190,240,0.55)');
      const GL = new THREE.Group(); g.add(GL); g.userData.GL = GL; g.userData.gs = mesh(new THREE.SphereGeometry(0.55, 36, 26), new THREE.MeshStandardMaterial({ map: eT, roughness: 0.85 }), 0, 0, 0, GL);
      const N = 90, im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.2, 0.014), mat('#7B1E3A', { roughness: 0.4 }), N); im.castShadow = true; g.add(im); g.userData.im = im; g.userData.N = N;
      const P = new THREE.Group(); g.add(P); g.userData.P = P;
      // a burgundy phone modelled on the reference photo (Downloads/images.jpg): rounded slab, a raised rounded-square camera plateau with three lenses + flash, a pill cut-out and a swirl wallpaper on the front. No logo, no text.
      const rrect = (w, h, r) => { const sh = new THREE.Shape(), x = -w / 2, y = -h / 2; sh.moveTo(x + r, y); sh.lineTo(x + w - r, y); sh.quadraticCurveTo(x + w, y, x + w, y + r); sh.lineTo(x + w, y + h - r); sh.quadraticCurveTo(x + w, y + h, x + w - r, y + h); sh.lineTo(x + r, y + h); sh.quadraticCurveTo(x, y + h, x, y + h - r); sh.lineTo(x, y + r); sh.quadraticCurveTo(x, y, x + r, y); return sh; };
      const ext = (w, h, r, d, bev) => { const eg = new THREE.ExtrudeGeometry(rrect(w, h, r), { depth: d, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 3, curveSegments: 10 }); eg.translate(0, 0, -d / 2); return eg; };
      const BUR = '#6E1B33', body = mesh(ext(0.5, 1.04, 0.1, 0.05, 0.012), mat(BUR, { roughness: 0.32, metalness: 0.35 }), 0, 0, 0, P);
      const wp = tex(270, 560, (c, w, h) => { const gr = c.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#3E0F20'); gr.addColorStop(1, '#8A2A47'); c.fillStyle = gr; c.fillRect(0, 0, w, h); c.lineCap = 'round'; c.shadowColor = '#FF9DB4'; c.shadowBlur = 26;
        for (let k = 0; k < 4; k++) { c.strokeStyle = `rgba(255,${170 - k * 12},${190 - k * 10},${0.85 - k * 0.12})`; c.lineWidth = 11 - k * 1.5; c.beginPath(); c.moveTo(w * 0.25 + k * 14, h * (0.08 + k * 0.02)); c.bezierCurveTo(w * 0.95, h * (0.1 + k * 0.03), w * 0.95, h * (0.32 + k * 0.02), w * 0.35, h * (0.36 + k * 0.03)); c.bezierCurveTo(w * 0.05, h * (0.38 + k * 0.03), w * 0.05, h * (0.62 + k * 0.02), w * 0.75, h * (0.64 + k * 0.03)); c.stroke(); }
        c.shadowBlur = 0; c.fillStyle = '#07040A'; c.beginPath(); c.roundRect(w / 2 - 34, 18, 68, 22, 11); c.fill(); }).t;
      const scr = mesh(new THREE.PlaneGeometry(0.46, 1.0), new THREE.MeshBasicMaterial({ map: wp, toneMapped: false }), 0, 0, 0.042, P); scr.castShadow = false;
      const bump = mesh(ext(0.27, 0.27, 0.06, 0.02, 0.008), mat('#7C2540', { roughness: 0.3, metalness: 0.35 }), -0.09, 0.34, -0.05, P); bump.rotation.y = Math.PI;
      for (const [x, y] of [[-0.15, 0.4], [-0.03, 0.34], [-0.15, 0.28]]) { const ring = mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.026, 20), mat('#8A2D4A', { roughness: 0.25, metalness: 0.6 }), x, y, -0.072, P); ring.rotation.x = Math.PI / 2; const lens = mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.03, 20), mat('#120A10', { roughness: 0.15, metalness: 0.3 }), x, y, -0.075, P); lens.rotation.x = Math.PI / 2; }
      for (const [x, y, c2] of [[-0.03, 0.43, '#FFF6D8'], [-0.03, 0.26, '#1A1014']]) { const d2 = mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.02, 12), bas(c2), x, y, -0.07, P); d2.rotation.x = Math.PI / 2; d2.castShadow = false; }

    },
    anim(u, uh, g, pi, t) {
      const U = g.userData, kk = U.kk || 1, tH = u - uh, f = easeOut(clamp((u - 0.3) / Math.max(0.3, tH + 0.4 - 0.3))), n = Math.floor(landPts.length * f);
      U.mb.draw(() => '#DCE3EE', (c, cw, ch, b) => { for (let i = 0; i < n; i++) { const [lo, la] = landPts[i], px = (lo - b.x0) / (b.x1 - b.x0) * cw, py = (b.y1 - la) / (b.y1 - b.y0) * ch; c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(px, py, 9, 0, 6.283); c.fill(); c.fillStyle = '#7B1E3A'; c.beginPath(); c.arc(px, py, 6.5, 0, 6.283); c.fill(); } }); U.mb.m.scale.setScalar(Math.max(0.001, pop(u / 0.25)));
      const GL = U.GL; GL.position.set(0.3, 1.05, 0.9); sc1(GL, pop(u / 0.3)); U.gs.rotation.y = 2.7 + t * 0.4;
      const im = U.im, d = new THREE.Object3D(); for (let i = 0; i < U.N; i++) { const a = (i / U.N) * 6.283 * 3 + t * (0.9 + (i % 3) * 0.2), r = 0.85 + (i % 3) * 0.16, k = pop((u - 0.3 - i * 0.008) / 0.2); d.position.set(0.3 + Math.cos(a) * r, 1.05 + Math.sin(a) * r * 0.3 + (i % 3 - 1) * 0.1, 0.9 + Math.sin(a) * r * 0.6); d.rotation.set(a * 0.5, a, 0.3); d.scale.setScalar(Math.max(0.001, k)); d.updateMatrix(); im.setMatrixAt(i, d.matrix); } im.instanceMatrix.needsUpdate = true;
      const P = U.P; P.position.set(1.6, 0.62 + 0.04 * Math.sin(t * 3), 1.2); sc1(P, pi * 1.1); P.rotation.y = (uh > 0 ? Math.PI * easeOut(clamp(uh / 0.5)) : 0) + 0.45 * Math.sin(u * 2.6);
      return { dz: 0, dx: 0.2 * kk, dlx: 0.2 * kk, dly: 1.0 * kk }; } };

  // ---------- n22 beli dunia dan seisinya: the whole earth wrapped in money
  X.s23 = { mood: 'space', earth: [0.9, 1.3, -1.2, 1.25], face: ['neutral', 'laugh'], act: 'cheer', burst: { c: ['#FFD84D', '#FFFFFF', '#E4E8EE'], n: 44, p: [0.9, 1.5, 0.4], s: 5, z: 0.14 }, shake: 0.3,
    build(g) { const N = 260; const im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.62 * 0.5, 0.01, 0.29 * 0.5), [].concat([0, 1, 2, 3, 4, 5].map((i) => i === 2 ? new THREE.MeshStandardMaterial({ map: noteFace, roughness: 0.85 }) : new THREE.MeshStandardMaterial({ color: '#E4E8EE' }))), N); g.add(im); g.userData.im = im; g.userData.N = N;
      const st = signBoard([['DIBELI', 130, '#FFFFFF']], 2.2, 0.9, '#E53935', '#1B1B2F'); st.position.set(1.0, 1.4, 2.4); st.rotation.z = -0.22; st.scale.setScalar(0.85); g.add(st); g.userData.st = st; },
    anim(u, uh, g, pi, t) { const im = g.userData.im, d = new THREE.Object3D(), N = g.userData.N, k0 = easeOut(clamp(u / 0.5)); for (let i = 0; i < N; i++) { const ring = i % 3, a = (i / N) * 6.283 * 4 + t * (0.5 + ring * 0.12), r = lerp(7, 2.3 + ring * 0.35, k0); d.position.set(0.9 + Math.cos(a) * r, 1.5 + Math.sin(a * 1.0) * r * 0.28 + (ring - 1) * 0.3, -1.2 + Math.sin(a) * r * 0.5); d.rotation.set(0.4 * ring, a, 0.2); d.scale.setScalar(1.3); d.updateMatrix(); im.setMatrixAt(i, d.matrix); } im.instanceMatrix.needsUpdate = true;
      g.userData.st.visible = uh > 0; g.userData.st.scale.setScalar(Math.max(0.001, (1.3 - 0.45 * clamp(uh / 0.35)) * pop(uh / 0.3))); return { dx: 0.7 * (g.userData.kk || 1), dlx: 0.7 * (g.userData.kk || 1), dz: 4 }; } };

  // ---------- outro: ayam floats in the stars (the card is drawn by uang.js)
  X.s24 = { mood: 'space', earth: [-1.5, -2.5, -8, 4.0], face: ['neutral', 'delighted'], act: 'nod', burst: { c: ['#FFFFFF', '#FFD84D'], n: 20, p: [0.9, 1.5, 1.0], s: 3, z: 0.1 }, shake: 0.0, build() {}, anim(u) { return { ay: 0.2 + 0.12 * Math.sin(u * 2.4) }; } };

  // ---------- the world around the scenes: pad (helipad / cloud / metal deck), clouds, stars, space backdrop, the earth
  const world = {};
  sky.material.transparent = true; sky.material.needsUpdate = true;   // compiled non-opaque once, so its opacity really fades to space in the video
  const spaceSky = mesh(new THREE.PlaneGeometry(90, 60), new THREE.MeshBasicMaterial({ map: skyTex.space, toneMapped: false, fog: false }), 0, 10, -27); spaceSky.castShadow = spaceSky.receiveShadow = false; spaceSky.visible = false;
  const stGeo = new THREE.BufferGeometry(), sp = []; for (let i = 0; i < 520; i++) sp.push((rr(i, 1) - 0.5) * 44, (rr(i, 2) - 0.2) * 34, -24 - rr(i, 3) * 2);
  stGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const stars = new THREE.Points(stGeo, new THREE.PointsMaterial({ color: '#FFFFFF', size: 0.14, sizeAttenuation: true, toneMapped: false, fog: false })); stars.visible = false; scene.add(stars);
  const eT = tex(1024, 512, (c, w, h) => { c.fillStyle = '#2A6BD8'; c.fillRect(0, 0, w, h); ringsPath(c, WORLD, { x0: -180, x1: 180, y0: -90, y1: 90 }, w, h); c.fillStyle = '#3FA35A'; c.fill(); c.fillStyle = 'rgba(255,255,255,0.45)'; for (let i = 0; i < 40; i++) { c.beginPath(); c.ellipse(rr(i, 9) * w, rr(i, 10) * h, 24 + rr(i, 11) * 50, 7 + rr(i, 12) * 9, 0, 0, 6.283); c.fill(); } }).t;
  const earth = mesh(new THREE.SphereGeometry(1, 40, 28), new THREE.MeshStandardMaterial({ map: eT, roughness: 0.9 }), 0, -5, -6, scene); earth.castShadow = false; earth.visible = false;
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(1.04, 40, 28), new THREE.MeshBasicMaterial({ color: '#7FB6FF', transparent: true, opacity: 0.18, toneMapped: false, side: THREE.BackSide })); earth.add(atmo);
  const padM = mat('#F4F8FF', { roughness: 0.9 }); const pad = mesh(new THREE.CylinderGeometry(7, 7, 0.3, 48), padM, 0, -0.16, 2, scene); pad.castShadow = false; pad.visible = false;
  const hT = tex(256, 256, (c, w, h) => { c.fillStyle = '#4A5160'; c.fillRect(0, 0, w, h); c.strokeStyle = '#FFFFFF'; c.lineWidth = 12; c.beginPath(); c.arc(128, 128, 100, 0, 6.283); c.stroke(); c.fillStyle = '#FFFFFF'; c.font = "900 140px 'Arial Black'"; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('H', 128, 134); }).t;
  const padTop = mesh(new THREE.CircleGeometry(2.4, 40), new THREE.MeshBasicMaterial({ map: hT, toneMapped: false }), 0.9, 0.0, 0.9, scene); padTop.rotation.x = -Math.PI / 2; padTop.castShadow = false; padTop.visible = false;
  const clouds = []; for (let i = 0; i < 12; i++) { const c = new THREE.Group(); scene.add(c); for (let k = 0; k < 3; k++) { const s = mesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshBasicMaterial({ color: '#FFFFFF', toneMapped: false, transparent: true, opacity: 0.92 }), (k - 1) * 0.9, (k === 1 ? 0.35 : 0), 0, c); s.scale.set(1.1, 0.7, 0.8); s.castShadow = false; } c.userData = { x: (rr(i, 20) - 0.5) * 22, y: -0.6 + rr(i, 21) * 5, z: -4 - rr(i, 22) * 12, sp: 0.3 + rr(i, 23) * 0.5, s: 0.8 + rr(i, 24) * 1.4 }; c.visible = false; clouds.push(c); }
  // asteroids: irregular dark rocks drifting and tumbling at three depths (only in space)
  const asts = []; { const rock = (r, seed) => { const gm = new THREE.IcosahedronGeometry(r, 1), p = gm.attributes.position; for (let i = 0; i < p.count; i++) { const f = 0.72 + 0.5 * rr(Math.floor(p.getX(i) * 7 + p.getY(i) * 13 + p.getZ(i) * 5) + seed, 4); p.setXYZ(i, p.getX(i) * f, p.getY(i) * f * 0.85, p.getZ(i) * f); } gm.computeVertexNormals(); return gm; };
    for (let i = 0; i < 22; i++) { const far = i % 3; const a = mesh(rock(0.25 + rr(i, 31) * 0.6, i * 17), mat(['#A39BA8', '#B9B1BD', '#8C8494'][i % 3], { roughness: 1 }), 0, 0, 0, scene); a.castShadow = false; a.visible = false; a.userData = { x: (rr(i, 32) - 0.5) * 30, y: 1 + rr(i, 33) * 9, z: -4 - far * 5 - rr(i, 34) * 4, sp: 0.15 + rr(i, 35) * 0.35, s: 0.8 + far * 0.7, rx: rr(i, 36) * 1.5, ry: rr(i, 37) * 1.5 }; asts.push(a); } }
  world.set = function (id, u, uh, t, ret, kk = 1, hx = -0.95) {
    const o = X[id], mood = o ? o.mood : 'day'; const spc = mood === 'space' ? 1 : (ret && ret.space) || 0, sk = mood === 'sky' || (id === 's14');
    const sink = (ret && ret.sink) || 0; const skyish = mood === 'sky' || id === 's14' || (id === 's10' && sink > 0.02);
    if (o) { ground.visible = (mood === 'day') && sink < 0.999; ground.position.y = -10 * sink; far.position.y = -10 * sink; far.visible = mood === 'day' && sink < 0.999 && id !== 's3' && !o.noFar; }
    pad.visible = !!o && mood !== 'day' || id === 's10'; pad.scale.set(kk, 1, kk); pad.position.set(hx * (1 - kk), -0.16, 2 * kk); padTop.scale.setScalar(kk); padTop.position.set(hx * (1 - kk) + 0.9 * kk, 0.0, 0.9 * kk); padTop.visible = id === 's10'; padM.color.set(spc > 0.5 ? '#1E2433' : '#F4F8FF'); padM.roughness = spc > 0.5 ? 0.55 : 0.9; padM.metalness = spc > 0.5 ? 0.4 : 0;
    asts.forEach((a) => { const d = a.userData; a.visible = spc > 0.5; a.position.set(hx + kk * (((d.x + t * d.sp + 15) % 30) - 15), d.y * kk, d.z * kk); a.scale.setScalar(d.s * kk); a.rotation.set(t * d.rx, t * d.ry, 0); });
    clouds.forEach((c) => { const d = c.userData; c.visible = skyish && spc < 0.6; c.position.set(((d.x + t * d.sp + 11) % 22) - 11, d.y, d.z); c.scale.setScalar(d.s); });
    stars.visible = spc > 0.02; stars.material.opacity = 1; spaceSky.visible = spc > 0.02; sky.material.opacity = 1 - spc; sky.position.y = 10 + ((ret && ret.dly) || 0); sky.material.map = (skyish || spc > 0 || (o && o.noFar)) ? skyTex.hi : sky.material.map;
    if (o && (id === 's10' ? sink > 0.02 : true) && spc <= 0) { sky.material.map = skyish ? skyTex.hi : sky.material.map; }
    applyLight(spc > 0.01 ? 'day' : 'day', spc > 0.01 ? 'space' : 'day', spc);
    earth.visible = !!(o && o.earth) && spc > 0.2; if (earth.visible) { const e = o.earth; earth.position.set(hx + kk * (e[0] - hx), e[1] * kk, e[2] * kk); earth.scale.setScalar(e[3] * kk); earth.rotation.y = (o.spin ?? 2.7) + t * 0.05; }
  };
  return { X, world, buildPile, earth, stars, spaceSky, pad };
}
