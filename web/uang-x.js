// "Uang x5" part 2: scenes n5 .. n22 (ids s6 .. s23) + the outro (s24), the sky and the space around them. Loaded by uang.js: makeX(ctx) -> { X, world, buildPile }.
// X[id] = { mood: 'day' | 'sky' | 'space', face: [before, after], act, burst, shake, build(g), anim(u, uh, g, pi, t) -> { ay?, ax?, camY?, camLy?, sink?, space? } }
// u = seconds since the scene start, uh = seconds since its hit (negative before), pi = springy 0->1 pop of the prop.
export function makeX(C) {
  const { THREE, mesh, mat, bas, tex, signBoard, scene, clamp, ease, easeOut, easeIn, lerp, pop, HX, noteFace, sky, ground, far, applyLight, skyTex } = C;
  const X = {};
  const box = (p, w, h, d, c, x, y, z, o = {}) => mesh(new THREE.BoxGeometry(w, h, d), mat(c, o), x, y, z, p);
  const cyl = (p, rt, rb, h, c, x, y, z, o = {}, seg = 16) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(c, o), x, y, z, p);
  const sph = (p, r, c, x, y, z, sx = 1, sy = 1, sz = 1, o = {}) => { const m = mesh(new THREE.SphereGeometry(r, 18, 14), mat(c, o), x, y, z, p); m.scale.set(sx, sy, sz); return m; };
  const flat = (p, w, h, map, x, y, z) => { const m = mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map, toneMapped: false }), x, y, z, p); m.castShadow = false; return m; };
  const board = (g, lines, x, y, z, w = 1.7, h = 0.62) => { const b = signBoard(lines, w, h); b.position.set(x, y, z); g.add(b); return b; };
  const sc1 = (o, k) => o.scale.setScalar(Math.max(0.001, k));
  const rr = (i, s = 1) => { const a = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return a - Math.floor(a); };
  const GOLD = '#F2B134', RED = '#E53935';
  const winTex = (w, h, cols, rows, on = '#FFE9A8', off = '#5C6B86', bg = '#E6D5B8') => tex(w, h, (c, W2, H2) => { c.fillStyle = bg; c.fillRect(0, 0, W2, H2); for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) { c.fillStyle = ((r * 7 + k * 3) % 5 === 0) ? on : off; c.fillRect(W2 * (k + 0.2) / cols, H2 * (r + 0.2) / rows, W2 * 0.6 / cols, H2 * 0.6 / rows); } }).t;
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
  X.s14 = { mood: 'sky', earth: [-2.5, 2, -8, 5], face: ['determined', 'surprised'], act: 'wings_up', burst: { c: ['#FFD84D', '#FF8A1F', '#FFFFFF'], n: 40, p: [0.7, 0.3, -0.4], s: 6, z: 0.3 }, shake: 0.3,
    build(g) { const R = new THREE.Group(); g.add(R); g.userData.R = R; cyl(R, 0.4, 0.4, 2.6, '#F4F6FA', 0, 1.5, 0, { roughness: 0.4 }, 20); cyl(R, 0.0, 0.4, 0.95, RED, 0, 3.3, 0, {}, 20); for (let k = 0; k < 3; k++) { const f = box(R, 0.1, 0.8, 0.5, RED, Math.cos(k * 2.094) * 0.5, 0.45, Math.sin(k * 2.094) * 0.5); f.rotation.y = -k * 2.094; }
      const w = mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.1, 16), mat('#7FC8FF', { roughness: 0.2 }), 0, 2.3, 0.4, R); w.rotation.x = Math.PI / 2; const fl = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.5, 16), new THREE.MeshBasicMaterial({ color: '#FFB020', toneMapped: false })); fl.position.y = -0.15; fl.rotation.x = Math.PI; fl.visible = false; R.add(fl); g.userData.fl = fl;
      board(g, [['ROKET', 56, '#B3261E'], ['Rp1,34 T / peluncuran', 36, '#1B1B2F']], -0.9, 2.2, 1.3, 1.9, 0.62); g.userData.sign = g.children[g.children.length - 1]; },
    anim(u, uh, g, pi, t) { const R = g.userData.R, y = uh > 0 ? 14 * Math.pow(easeIn(clamp(uh / 0.85)), 1.2) : 0; const cd = uh < 0 && uh > -1.2 ? (1.2 + uh) / 1.2 : 0; R.position.set(0.75 + 0.025 * cd * Math.sin(u * 90), y, -0.6); R.rotation.z = uh > 0 ? 0.02 * Math.sin(uh * 60) : 0.02 * cd * Math.sin(u * 70); sc1(R, pi); g.userData.fl.visible = uh > -0.5; g.userData.fl.scale.set(1, 0.7 + 0.5 * Math.abs(Math.sin(t * 40)), 1); g.userData.sign.visible = uh < 0.05;
      return { ay: y, camY: 0.75 * y, camLy: 0.75 * y, space: uh > 0 ? easeOut(clamp(uh / 0.7)) : 0 }; } };

  // ---------- n14 pabrik mobil listrik BYD
  X.s15 = { mood: 'space', earth: [-2.0, -1.6, -9, 5.0], face: ['neutral', 'delighted'], act: 'nod', burst: { c: ['#FFFFFF', '#9DD8FF', '#6CFF9A'], n: 30, p: [1.0, 1.4, -0.8], s: 4, z: 0.16 }, shake: 0.14,
    build(g) { const F = new THREE.Group(); g.add(F); g.userData.F = F; box(F, 3.2, 1.5, 1.5, '#C8CDD6', 0, 0.75, 0); for (let i = 0; i < 4; i++) { const r = box(F, 0.8, 0.12, 1.6, '#8A94A6', -1.2 + i * 0.8, 1.62, 0); r.rotation.z = -0.35; } cyl(F, 0.16, 0.2, 1.1, '#9AA7B8', 1.3, 2.0, -0.3); cyl(F, 0.16, 0.2, 0.9, '#9AA7B8', 0.9, 1.9, -0.3);
      box(F, 0.9, 0.9, 0.08, '#2B2F3C', 0.9, 0.45, 0.78); const sb = signBoard([['BYD', 140, '#FFFFFF']], 1.9, 0.78, '#B3261E', '#1B1B2F'); sb.position.set(-0.3, 2.15, 0.8); F.add(sb); g.userData.cars = [miniCar(g, '#2FA8E0'), miniCar(g, '#F2B134'), miniCar(g, '#7BC96F')];
      board(g, [['PABRIK MOBIL LISTRIK', 36, '#1B1B2F'], ['Rp11,7 T', 62, '#B3261E']], 0.9, 3.6, 0.9, 2.0, 0.66); },
    anim(u, uh, g, pi) { g.userData.F.position.set(0.9, 0, -1.0); sc1(g.userData.F, pi); g.userData.cars.forEach((c, i) => { const k = uh > 0 ? clamp((uh - 0.1 * i) / 0.35) : 0; c.position.set(lerp(1.0, 4.2, easeIn(k)), 0.02, 0.9); c.visible = k > 0 && k < 1; c.scale.setScalar(0.9); }); return {}; } };

  // ---------- n15 satelit internet (SATRIA)
  X.s16 = { mood: 'space', earth: [-2.0, -1.6, -9, 4.6], face: ['determined', 'delighted'], act: 'wings_up', burst: { c: ['#8FD3FF', '#FFFFFF', '#FFD84D'], n: 30, p: [0.8, 1.6, 0.3], s: 4, z: 0.12 }, shake: 0.08,
    build(g) { g.userData.s = []; const pt = tex(128, 64, (c, w, h) => { c.fillStyle = '#2A4EC8'; c.fillRect(0, 0, w, h); c.strokeStyle = '#8FB0FF'; c.lineWidth = 2; for (let x = 0; x <= w; x += 16) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } for (let y = 0; y <= h; y += 16) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); } }).t;
      for (let i = 0; i < 7; i++) { const s = new THREE.Group(); g.add(s); box(s, 0.34, 0.34, 0.34, '#E8C066', 0, 0, 0, { roughness: 0.4, metalness: 0.4 }); for (const x of [-1, 1]) { const p = mesh(new THREE.BoxGeometry(0.62, 0.02, 0.3), new THREE.MeshBasicMaterial({ map: pt, toneMapped: false }), x * 0.5, 0, 0, s); } cyl(s, 0.0, 0.14, 0.12, '#EEF1F6', 0, 0.25, 0); g.userData.s.push(s); }
      board(g, [['SATELIT SATRIA', 40, '#1B1B2F'], ['Rp8 T / unit', 52, '#B3261E']], 0.9, 3.4, 0.9, 1.9, 0.66); },
    anim(u, uh, g, pi, t) { g.userData.s.forEach((s, i) => { sc1(s, pop((u - 0.045 * i) / 0.2)); s.position.set(0.15 + i * 0.36, 1.5 + 0.55 * Math.sin(i * 0.9 + t * 1.4), -0.3 - (i % 3) * 0.4); s.rotation.set(0.3, t * 0.6 + i, 0.2); }); return {}; } };

  // ---------- n16 kereta cepat (two of them)
  X.s17 = { mood: 'space', earth: [-2.0, -1.7, -9, 4.2], face: ['neutral', 'surprised'], act: 'jolt', burst: { c: ['#FFFFFF', '#CFE8FF', '#FF8FA3'], n: 30, p: [0.9, 1.0, 0.8], s: 5, z: 0.14 }, shake: 0.16,
    build(g) { g.userData.tr = []; for (let k = 0; k < 2; k++) { const T = new THREE.Group(); g.add(T); const body = mesh(new THREE.CylinderGeometry(0.4, 0.4, 3.6, 18), mat('#F4F6FA', { roughness: 0.35 }), 0, 0, 0, T); body.rotation.z = Math.PI / 2; const nose = sph(T, 0.4, '#F4F6FA', -1.8, 0, 0, 1.9, 0.9, 0.9); box(T, 3.4, 0.08, 0.82, RED, 0, -0.08, 0); box(T, 2.4, 0.16, 0.8, '#1B1B2F', 0.2, 0.14, 0); T.userData = { k }; g.userData.tr.push(T); }
      board(g, [['KERETA CEPAT', 44, '#B3261E'], ['Rp119,8 T', 58, '#1B1B2F']], 0.9, 3.5, 0.9, 1.9, 0.66); },
    anim(u, uh, g) { g.userData.tr.forEach((T, i) => { const k = clamp((u - 0.04 * i) / 0.8); T.position.set(lerp(7, -7, k), 0.95 + 1.1 * i, 0.4 - 1.6 * i); T.scale.setScalar(1); }); return {}; } };

  // ---------- n17 es teh untuk seluruh penduduk Indonesia (a sea of people)
  X.s18 = { mood: 'space', earth: [-2.0, -1.8, -9, 3.8], face: ['delighted', 'laugh'], act: 'cheer', burst: { c: ['#C97B2A', '#FFFFFF', '#FFD9A0'], n: 34, p: [0.9, 1.4, 1.6], s: 4, z: 0.12 }, shake: 0.1,
    build(g) { const N = 150; const cols = ['#E8586B', '#4BA3E3', '#F2B134', '#7BC96F', '#B07CE8', '#F58F5C'];
      const bodyM = new THREE.InstancedMesh(new THREE.ConeGeometry(0.2, 0.55, 10), mat('#FFFFFF'), N), headM = new THREE.InstancedMesh(new THREE.SphereGeometry(0.15, 10, 8), mat('#F1C9A5'), N), cupM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.045, 0.14, 8), mat('#C97B2A'), N);
      bodyM.castShadow = headM.castShadow = cupM.castShadow = true; g.add(bodyM, headM, cupM); g.userData.crowd = { bodyM, headM, cupM, N, p: [] };
      for (let i = 0; i < N; i++) { const row = Math.floor(i / 25), cI = i % 25; const z = 3.0 - row * 1.6, x = (cI - 12) * 0.32 + (rr(i) - 0.5) * 0.2 - 0.5 + (row % 2) * 0.16; g.userData.crowd.p.push([x + 1.0, z]); bodyM.setColorAt(i, new THREE.Color(cols[(i * 7) % 6])); }
      const gl = new THREE.Group(); g.add(gl); g.userData.gl = gl; cyl(gl, 0.4, 0.32, 1.2, '#CFEFFF', 0, 0.6, 0, { transparent: true, opacity: 0.3, roughness: 0.8 }); cyl(gl, 0.37, 0.3, 0.95, '#B5651D', 0, 0.5, 0); for (let k = 0; k < 4; k++) box(gl, 0.2, 0.2, 0.2, '#F4F8FF', -0.15 + (k % 2) * 0.3, 0.88, -0.1 + (k % 3) * 0.1, { transparent: true, opacity: 0.8 }); cyl(gl, 0.03, 0.03, 1.5, '#E8394D', 0.15, 0.9, 0).rotation.z = -0.15;
      board(g, [['ES TEH', 60, '#B3261E'], ['285 juta orang', 40, '#1B1B2F']], 0.9, 2.5, 1.6, 1.7, 0.62); },
    anim(u, uh, g, pi) { const c = g.userData.crowd, d = new THREE.Object3D(); for (let i = 0; i < c.N; i++) { const [x, z] = c.p[i], row = Math.floor(i / 25), k = pop((u - 0.015 * (5 - row) - 0.005 * (i % 25)) / 0.2), hop = uh > 0 ? 0.12 * Math.abs(Math.sin(uh * 14 + i)) : 0; d.scale.setScalar(Math.max(0.001, k)); d.position.set(x, 0.28 * k + hop, z); d.updateMatrix(); c.bodyM.setMatrixAt(i, d.matrix); d.position.set(x, 0.66 * k + hop, z); d.updateMatrix(); c.headM.setMatrixAt(i, d.matrix); d.position.set(x + 0.18, 0.5 * k + hop + (uh > 0 ? 0.25 : 0), z + 0.05); d.updateMatrix(); c.cupM.setMatrixAt(i, d.matrix); }
      c.bodyM.instanceMatrix.needsUpdate = c.headM.instanceMatrix.needsUpdate = c.cupM.instanceMatrix.needsUpdate = true; g.userData.gl.position.set(0.9, 0.9, 2.2); sc1(g.userData.gl, pi); return {}; } };

  // ---------- n18 seluruh APBN 2026: a stack of giant budget books
  X.s19 = { mood: 'space', earth: [-2.0, -1.9, -9, 3.4], face: ['neutral', 'surprised'], act: 'jolt', burst: { c: ['#FFD84D', '#FFFFFF', '#6CFF9A'], n: 36, p: [0.9, 2.0, 1.2], s: 4.5, z: 0.16 }, shake: 0.14,
    build(g) { const cv = tex(340, 460, (c, w, h) => { c.fillStyle = '#1F3A68'; c.fillRect(0, 0, w, h); c.strokeStyle = '#FFD84D'; c.lineWidth = 10; c.strokeRect(16, 16, w - 32, h - 32); c.fillStyle = '#FFD84D'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = "900 96px 'Arial Black'"; c.fillText('APBN', w / 2, 130); c.font = "900 80px 'Arial Black'"; c.fillText('2026', w / 2, 230); c.font = "900 44px 'Arial Black'"; c.fillStyle = '#FFFFFF'; c.fillText('Rp3.842,7', w / 2, 330); c.fillText('TRILIUN', w / 2, 385); }).t;
      g.userData.bk = []; for (let k = 0; k < 3; k++) { const b = mesh(new THREE.BoxGeometry(1.5, 2.1, 0.4), [mat('#F4EFE0'), mat('#F4EFE0'), mat('#F4EFE0'), mat('#F4EFE0'), new THREE.MeshBasicMaterial({ map: cv, toneMapped: false }), mat('#F4EFE0')], 0, 0, 0, g); g.userData.bk.push(b); } },
    anim(u, uh, g) { g.userData.bk.forEach((b, k) => { const kk = pop((u - 0.08 * k) / 0.24); b.position.set(1.0 + (k - 1) * 0.55, 1.05 * kk, 1.2 - k * 0.5); b.rotation.set(0, (k - 1) * -0.18, (k - 1) * 0.04); sc1(b, kk); }); return {}; } };

  // ---------- n19 lunasi utang negara: a chain around a padlock snaps and the debt is paid off
  X.s20 = { mood: 'space', earth: [-2.0, -2.0, -9, 3.0], face: ['determined', 'laugh'], act: 'wings_up', burst: { c: ['#6CFF9A', '#FFFFFF', '#FFD84D'], n: 40, p: [0.9, 1.3, 1.0], s: 5, z: 0.14 }, shake: 0.22,
    build(g) { g.userData.links = []; for (let i = 0; i < 7; i++) { const l = mesh(new THREE.TorusGeometry(0.24, 0.07, 10, 18), mat('#9AA3B5', { metalness: 0.5, roughness: 0.4 }), 0, 0, 0, g); l.scale.set(1.3, 1, 1); l.rotation.y = (i % 2) * Math.PI / 2; g.userData.links.push(l); }
      const lk = new THREE.Group(); g.add(lk); g.userData.lock = lk; box(lk, 0.8, 0.6, 0.3, '#2B2F3C', 0, 0, 0, { metalness: 0.4 }); const sh = mesh(new THREE.TorusGeometry(0.26, 0.06, 10, 18, Math.PI), mat('#9AA3B5', { metalness: 0.5 }), 0, 0.3, 0, lk);
      board(g, [['UTANG NEGARA', 42, '#B3261E'], ['Rp10.294 T', 62, '#1B1B2F']], 0.9, 2.4, 1.3, 1.9, 0.66); g.userData.deb = g.children[g.children.length - 1];
      const ok = signBoard([['LUNAS', 110, '#FFFFFF']], 1.9, 0.8, '#2FA84F', '#1B1B2F'); ok.position.set(0.9, 2.4, 1.3); g.add(ok); g.userData.ok = ok; },
    anim(u, uh, g) { const pp = pop(u / 0.3); g.userData.links.forEach((l, i) => { const x0 = 0.9 + (i - 3) * 0.4; if (uh <= 0) { l.position.set(x0, 1.1, 1.3); sc1(l, pp); l.rotation.x = 0; } else { const d = (i - 3), vx = d * 1.4, vy = 3 + Math.abs(d) * 0.4; l.position.set(x0 + vx * uh, 1.1 + vy * uh - 9 * uh * uh, 1.3); l.rotation.x = uh * 8 * (d || 1); } });
      const lk = g.userData.lock; lk.position.set(0.9, uh > 0 ? 1.1 - 6 * uh * uh : 1.1, 1.4); sc1(lk, pp); g.userData.deb.visible = uh <= 0; g.userData.ok.visible = uh > 0.05; sc1(g.userData.ok, pop(uh / 0.3)); return {}; } };

  // ---------- n20 kuliah S1 gratis untuk semua orang Indonesia: graduates throw their caps
  X.s21 = { mood: 'space', earth: [-2.0, -2.0, -9, 2.7], face: ['delighted', 'laugh'], act: 'cheer', burst: { c: ['#FFD84D', '#FFFFFF', '#FF6B5A', '#6CFF9A'], n: 40, p: [0.9, 1.6, 1.4], s: 5, z: 0.12, g: 3 }, shake: 0.12,
    build(g) { g.userData.gr = []; g.userData.caps = []; for (let i = 0; i < 10; i++) { const p = new THREE.Group(); g.add(p); cyl(p, 0.1, 0.24, 0.62, '#1B1B2F', 0, 0.31, 0, {}, 10); sph(p, 0.16, '#F1C9A5', 0, 0.74, 0); g.userData.gr.push(p);
        const c = new THREE.Group(); g.add(c); box(c, 0.46, 0.04, 0.46, '#1B1B2F', 0, 0, 0); cyl(c, 0.14, 0.14, 0.1, '#1B1B2F', 0, -0.06, 0); box(c, 0.02, 0.2, 0.02, GOLD, 0.2, -0.1, 0.2); g.userData.caps.push(c); }
      const dp = new THREE.Group(); g.add(dp); g.userData.dip = dp; const sc = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.9, 12), mat('#FFF3D6'), 0, 0, 0, dp); sc.rotation.z = Math.PI / 2; cyl(dp, 0.115, 0.115, 0.12, RED, 0, 0, 0).rotation.z = Math.PI / 2;
      board(g, [['KULIAH S1 GRATIS', 40, '#B3261E'], ['semua orang Indonesia', 34, '#1B1B2F']], 1.0, 2.0, 1.6, 1.9, 0.66); },
    anim(u, uh, g) { g.userData.gr.forEach((p, i) => { const k = pop((u - 0.03 * i) / 0.22); const x = 0.9 + (i - 4.5) * 0.45, z = 0.6 - (i % 2) * 0.7; p.position.set(x, 0, z); sc1(p, k); const c = g.userData.caps[i]; if (uh <= 0) { c.position.set(x, 0.92 * k, z); c.scale.setScalar(Math.max(0.001, k)); c.rotation.set(0, 0, 0); } else { const vy = 4 + (i % 3) * 0.8, vx = (i - 4.5) * 0.25; c.position.set(x + vx * uh, 0.92 + vy * uh - 6 * uh * uh, z); c.rotation.set(uh * 6, uh * 8, uh * 5); c.scale.setScalar(1); } });
      const d = g.userData.dip; d.position.set(0.9, 1.5 + 0.06 * Math.sin(u * 5), 1.9); sc1(d, pop(u / 0.3)); d.rotation.y = u * 1.5; return {}; } };

  // ---------- n21 HP burgundy untuk seluruh penduduk bumi: a swarm of phones circles the earth
  X.s22 = { mood: 'space', earth: [1.0, 1.4, -2.5, 1.5], face: ['neutral', 'delighted'], act: 'wings_up', burst: { c: ['#7B1E3A', '#FF8FA3', '#FFFFFF'], n: 40, p: [0.9, 1.5, 1.5], s: 5, z: 0.14 }, shake: 0.14,
    build(g) { const N = 320; const im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.2, 0.014), mat('#7B1E3A', { roughness: 0.4 }), N); im.castShadow = true; g.add(im); g.userData.im = im; g.userData.N = N;
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
    anim(u, uh, g, pi, t) { const im = g.userData.im, d = new THREE.Object3D(), N = g.userData.N; for (let i = 0; i < N; i++) { const ring = i % 4, a = (i / N) * 6.283 * 6 + t * (0.7 + ring * 0.18), r = 1.9 + ring * 0.45, k = pop((u - 0.0016 * i) / 0.2); d.position.set(1.0 + Math.cos(a) * r, 1.4 + Math.sin(a) * r * 0.32 + (ring - 1.5) * 0.15, -2.5 + Math.sin(a) * r * 0.5); d.rotation.set(a * 0.5, a, 0.3 * ring); d.scale.setScalar(Math.max(0.001, k)); d.updateMatrix(); im.setMatrixAt(i, d.matrix); } im.instanceMatrix.needsUpdate = true;
      const P = g.userData.P; P.position.set(1.0, 1.25 + 0.05 * Math.sin(t * 3), 2.6); sc1(P, pi * 2.1); P.rotation.y = (uh > 0 ? Math.PI * easeOut(clamp(uh / 0.5)) : 0) + 0.45 * Math.sin(u * 2.6); P.rotation.z = 0.08 * Math.sin(u * 2); return {}; } };

  // ---------- n22 beli dunia dan seisinya: the whole earth wrapped in money
  X.s23 = { mood: 'space', earth: [0.9, 1.5, -1.2, 1.8], face: ['neutral', 'laugh'], act: 'cheer', burst: { c: ['#FFD84D', '#FFFFFF', '#E4E8EE'], n: 44, p: [0.9, 1.5, 0.4], s: 5, z: 0.14 }, shake: 0.3,
    build(g) { const N = 260; const im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.62 * 0.5, 0.01, 0.29 * 0.5), [].concat([0, 1, 2, 3, 4, 5].map((i) => i === 2 ? new THREE.MeshStandardMaterial({ map: noteFace, roughness: 0.85 }) : new THREE.MeshStandardMaterial({ color: '#E4E8EE' }))), N); g.add(im); g.userData.im = im; g.userData.N = N;
      const st = signBoard([['DIBELI', 130, '#FFFFFF']], 2.2, 0.9, '#E53935', '#1B1B2F'); st.position.set(1.15, 3.0, 1.2); st.rotation.z = -0.08; st.scale.setScalar(0.85); g.add(st); g.userData.st = st; },
    anim(u, uh, g, pi, t) { const im = g.userData.im, d = new THREE.Object3D(), N = g.userData.N, k0 = easeOut(clamp(u / 0.5)); for (let i = 0; i < N; i++) { const ring = i % 3, a = (i / N) * 6.283 * 4 + t * (0.5 + ring * 0.12), r = lerp(7, 2.3 + ring * 0.35, k0); d.position.set(0.9 + Math.cos(a) * r, 1.5 + Math.sin(a * 1.0) * r * 0.28 + (ring - 1) * 0.3, -1.2 + Math.sin(a) * r * 0.5); d.rotation.set(0.4 * ring, a, 0.2); d.scale.setScalar(1.3); d.updateMatrix(); im.setMatrixAt(i, d.matrix); } im.instanceMatrix.needsUpdate = true;
      g.userData.st.visible = uh > 0; g.userData.st.scale.setScalar(Math.max(0.001, 0.85 * pop(uh / 0.3))); return {}; } };

  // ---------- outro: ayam floats in the stars (the card is drawn by uang.js)
  X.s24 = { mood: 'space', earth: [-1.5, -2.5, -8, 4.0], face: ['neutral', 'delighted'], act: 'nod', burst: { c: ['#FFFFFF', '#FFD84D'], n: 20, p: [0.9, 1.5, 1.0], s: 3, z: 0.1 }, shake: 0.0, build() {}, anim(u) { return { ay: 0.2 + 0.12 * Math.sin(u * 2.4) }; } };

  // ---------- the world around the scenes: pad (helipad / cloud / metal deck), clouds, stars, space backdrop, the earth
  const world = {};
  const spaceSky = mesh(new THREE.PlaneGeometry(90, 60), new THREE.MeshBasicMaterial({ map: skyTex.space, toneMapped: false, fog: false }), 0, 10, -27); spaceSky.castShadow = spaceSky.receiveShadow = false; spaceSky.visible = false;
  const stGeo = new THREE.BufferGeometry(), sp = []; for (let i = 0; i < 520; i++) sp.push((rr(i, 1) - 0.5) * 44, (rr(i, 2) - 0.2) * 34, -24 - rr(i, 3) * 2);
  stGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const stars = new THREE.Points(stGeo, new THREE.PointsMaterial({ color: '#FFFFFF', size: 0.14, sizeAttenuation: true, toneMapped: false, fog: false })); stars.visible = false; scene.add(stars);
  const eT = tex(512, 256, (c, w, h) => { c.fillStyle = '#2A6BD8'; c.fillRect(0, 0, w, h); c.fillStyle = '#3FA35A'; for (let i = 0; i < 26; i++) { const x = rr(i, 5) * w, y = (0.15 + rr(i, 6) * 0.7) * h, r = 14 + rr(i, 7) * 40; c.beginPath(); c.ellipse(x, y, r * 1.5, r, rr(i, 8) * 3, 0, 6.283); c.fill(); } c.fillStyle = 'rgba(255,255,255,0.55)'; for (let i = 0; i < 40; i++) { c.beginPath(); c.ellipse(rr(i, 9) * w, rr(i, 10) * h, 20 + rr(i, 11) * 38, 6 + rr(i, 12) * 8, 0, 0, 6.283); c.fill(); } }).t;
  const earth = mesh(new THREE.SphereGeometry(1, 40, 28), new THREE.MeshStandardMaterial({ map: eT, roughness: 0.9 }), 0, -5, -6, scene); earth.castShadow = false; earth.visible = false;
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(1.04, 40, 28), new THREE.MeshBasicMaterial({ color: '#7FB6FF', transparent: true, opacity: 0.18, toneMapped: false, side: THREE.BackSide })); earth.add(atmo);
  const padM = mat('#F4F8FF', { roughness: 0.9 }); const pad = mesh(new THREE.CylinderGeometry(7, 7, 0.3, 48), padM, 0, -0.16, 2, scene); pad.castShadow = false; pad.visible = false;
  const hT = tex(256, 256, (c, w, h) => { c.fillStyle = '#4A5160'; c.fillRect(0, 0, w, h); c.strokeStyle = '#FFFFFF'; c.lineWidth = 12; c.beginPath(); c.arc(128, 128, 100, 0, 6.283); c.stroke(); c.fillStyle = '#FFFFFF'; c.font = "900 140px 'Arial Black'"; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('H', 128, 134); }).t;
  const padTop = mesh(new THREE.CircleGeometry(2.4, 40), new THREE.MeshBasicMaterial({ map: hT, toneMapped: false }), 0.9, 0.0, 0.9, scene); padTop.rotation.x = -Math.PI / 2; padTop.castShadow = false; padTop.visible = false;
  const clouds = []; for (let i = 0; i < 12; i++) { const c = new THREE.Group(); scene.add(c); for (let k = 0; k < 3; k++) { const s = mesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshBasicMaterial({ color: '#FFFFFF', toneMapped: false, transparent: true, opacity: 0.92 }), (k - 1) * 0.9, (k === 1 ? 0.35 : 0), 0, c); s.scale.set(1.1, 0.7, 0.8); s.castShadow = false; } c.userData = { x: (rr(i, 20) - 0.5) * 22, y: -0.6 + rr(i, 21) * 5, z: -4 - rr(i, 22) * 12, sp: 0.3 + rr(i, 23) * 0.5, s: 0.8 + rr(i, 24) * 1.4 }; c.visible = false; clouds.push(c); }
  world.set = function (id, u, uh, t, ret) {
    const o = X[id], mood = o ? o.mood : 'day'; const spc = mood === 'space' ? 1 : (ret && ret.space) || 0, sk = mood === 'sky' || (id === 's14');
    const sink = (ret && ret.sink) || 0; const skyish = mood === 'sky' || id === 's14' || (id === 's10' && sink > 0.02);
    if (o) { ground.visible = (mood === 'day') && sink < 0.999; ground.position.y = -10 * sink; far.position.y = -10 * sink; far.visible = mood === 'day' && sink < 0.999 && id !== 's3'; }
    pad.visible = !!o && mood !== 'day' || id === 's10'; padTop.visible = id === 's10'; padM.color.set(spc > 0.5 ? '#9AA3B5' : '#F4F8FF');
    clouds.forEach((c) => { const d = c.userData; c.visible = skyish && spc < 0.6; c.position.set(((d.x + t * d.sp + 11) % 22) - 11, d.y, d.z); c.scale.setScalar(d.s); });
    stars.visible = spc > 0.02; stars.material.opacity = 1; spaceSky.visible = spc > 0.02; sky.material.transparent = true; sky.material.opacity = 1 - spc; sky.material.map = (skyish || spc > 0) ? skyTex.hi : sky.material.map;
    if (o && (id === 's10' ? sink > 0.02 : true) && spc <= 0) { sky.material.map = skyish ? skyTex.hi : sky.material.map; }
    applyLight(spc > 0.01 ? 'day' : 'day', spc > 0.01 ? 'space' : 'day', spc);
    earth.visible = !!(o && o.earth) && spc > 0.2; if (earth.visible) { const e = o.earth; earth.position.set(e[0], e[1], e[2]); earth.scale.setScalar(e[3]); earth.rotation.y = t * 0.05; }
  };
  return { X, world, buildPile, earth, stars, spaceSky, pad };
}
