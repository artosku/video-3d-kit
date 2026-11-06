// UjangGPT: a puffy cloud with a dark terminal screen for a face (teal ">_" chip, two bar eyes, a bar mouth). Matte, no film grain, built only from shapes + numbers (same contract as the template rig).
import * as THREE from 'three';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;

// lid 0..1 (the bars squash), tilt (+ sad, - angry), eye size, mouth open 0..1, wide (mouth width), smile (+ ends up, - ends down), look in x/y done by look()
export const EXPRESSIONS = {
  neutral: { lid: 0.0, tilt: 0.0, eye: 1.0, mouth: 0.0, wide: 1.0, smile: 0.25 },
  happy: { lid: 0.1, tilt: 0.0, eye: 1.05, mouth: 0.0, wide: 1.5, smile: 0.9 },
  proud: { lid: 0.3, tilt: -0.1, eye: 1.0, mouth: 0.0, wide: 1.6, smile: 1.0 },
  blank: { lid: 0.0, tilt: 0.0, eye: 1.25, mouth: 0.08, wide: 0.6, smile: 0.0 },
  shocked: { lid: 0.0, tilt: 0.0, eye: 1.5, mouth: 0.85, wide: 0.8, smile: 0.0 },
  sad: { lid: 0.25, tilt: 0.6, eye: 1.1, mouth: 0.0, wide: 0.8, smile: -0.7 },
  smug: { lid: 0.5, tilt: -0.2, eye: 1.0, mouth: 0.0, wide: 1.4, smile: 0.7 },
  dread: { lid: 0.0, tilt: 0.7, eye: 1.3, mouth: 0.3, wide: 0.8, smile: -0.4 },
  sleepy: { lid: 0.7, tilt: 0.1, eye: 1.0, mouth: 0.0, wide: 0.9, smile: 0.0 },
};

export function create(renderer, { rand = Math.random, config = {} } = {}) {
  const L = { bodyColor: '#E6ECFF', bellyColor: '#F5F8FF', accentColor: '#2DD4BF', screenColor: '#0E1428', ...(config.look || {}) };
  const group = new THREE.Group();
  const mat = (c, r = 0.9) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0 });
  const glowM = (c, k = 1.5) => { const m = new THREE.MeshBasicMaterial({ color: c, toneMapped: false }); m.color.multiplyScalar(k); return m; };
  const body = mat(L.bodyColor), belly = mat(L.bellyColor), screenM = new THREE.MeshStandardMaterial({ color: L.screenColor, roughness: 0.6, metalness: 0, emissive: '#0A1230', emissiveIntensity: 0.6 }), shade = mat('#C9D3F0');
  const add = (geo, m, x, y, z, sx = 1, sy = 1, sz = 1, parent = group) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = true; parent.add(o); return o; };
  const sph = new THREE.SphereGeometry(1, 40, 28), box = new THREE.BoxGeometry(1, 1, 1), cap = new THREE.CapsuleGeometry(0.5, 1, 6, 14);
  const root = new THREE.Group(); group.add(root);
  // the cloud: one soft body and bumps on the top and sides
  add(sph, body, 0, 0.95, 0, 0.98, 0.84, 0.82, root);
  for (const [x, y, z, r] of [[-0.62, 1.52, 0.0, 0.42], [-0.05, 1.7, -0.02, 0.5], [0.58, 1.55, 0.0, 0.42], [-0.92, 1.1, 0.05, 0.36], [0.94, 1.12, 0.05, 0.36]]) add(sph, body, x, y, z, r, r * 0.95, r * 0.9, root);
  add(sph, shade, 0, 0.35, 0.02, 0.8, 0.14, 0.7, root);   // a soft shadow band at the base
  add(sph, body, -0.35, 0.14, 0.18, 0.24, 0.13, 0.3, root); add(sph, body, 0.35, 0.14, 0.18, 0.24, 0.13, 0.3, root);   // feet
  const armL = add(sph, body, -1.08, 0.78, 0.12, 0.17, 0.27, 0.2, root), armR = add(sph, body, 1.08, 0.78, 0.12, 0.17, 0.27, 0.2, root);
  // the terminal screen
  const scr = add(box, screenM, 0, 0.98, 0.76, 1.42, 0.92, 0.1, root); scr.scale.set(1.42, 0.92, 0.12);
  const face = new THREE.Group(); face.position.set(0, 0.98, 0.84); root.add(face);
  const chev = new THREE.Group(); chev.position.set(-0.42, 0.34, 0.01); face.add(chev);   // the ">_" chip on the top left of the screen
  for (const s of [-1, 1]) { const b = add(box, glowM(L.accentColor, 1.1), 0.0, s * 0.045, 0, 0.14, 0.032, 0.012, chev); b.rotation.z = -s * 0.7; b.position.set(-0.01, s * 0.045, 0); b.castShadow = false; }
  const us = add(box, glowM(L.accentColor, 1.1), 0.17, -0.07, 0, 0.13, 0.03, 0.012, face); us.position.set(-0.42 + 0.17, 0.34 - 0.07, 0.01); us.castShadow = false;
  const eyes = [-1, 1].map((s) => { const g = new THREE.Group(); g.position.set(s * 0.33, 0.1, 0.01); face.add(g); const bar = add(cap, glowM(L.accentColor, 1.5), 0, 0, 0, 0.16, 0.2, 0.05, g); bar.castShadow = false; return { g, s, bar }; });
  const mouthG = new THREE.Group(); mouthG.position.set(0, -0.23, 0.01); face.add(mouthG);
  const segs = [-1, 1].map((s) => { const m = add(box, glowM(L.accentColor, 1.4), s * 0.09, 0, 0, 0.18, 0.045, 0.012, mouthG); m.castShadow = false; return { m, s }; });
  const openM = add(sph, glowM('#0A0F1E', 1), 0, 0, 0.004, 0.12, 0.02, 0.01, mouthG); openM.castShadow = false;
  const rim = add(sph, glowM(L.accentColor, 1.3), 0, 0, 0.002, 0.15, 0.03, 0.008, mouthG); rim.castShadow = false;

  let target = { ...EXPRESSIONS.neutral }, st = { ...EXPRESSIONS.neutral }, rate = 9, talk = 0, gx = 0, gy = 0, blink = 0, nextBlink = 2 + rand() * 2, t = 0, frozen = false;
  const exprs = { ...EXPRESSIONS };
  function setExpression(name, speed = 9) { const e = exprs[name]; if (!e) throw new Error(`unknown expression '${name}' (${Object.keys(exprs).join(', ')})`); target = { ...EXPRESSIONS.neutral, ...e }; rate = speed >= 100 ? 1000 : speed; }
  function defineExpression(name, params) { exprs[name] = { ...EXPRESSIONS.neutral, ...params }; }
  function update(dt) {
    t += dt; const k = 1 - Math.exp(-rate * dt);
    for (const key of Object.keys(target)) st[key] = lerp(st[key], target[key], k);
    if (!frozen) { nextBlink -= dt; if (nextBlink <= 0) { blink = 1; nextBlink = 2.2 + rand() * 3; } blink = Math.max(0, blink - dt * 9); }
    const closed = Math.max(st.lid, blink > 0 ? Math.sin(Math.min(1, blink) * Math.PI) : 0);
    for (const e of eyes) { e.g.scale.set(st.eye, st.eye * (1 - closed * 0.88), 1); e.g.position.x = e.s * 0.33 + gx * 0.05; e.g.position.y = 0.1 + gy * 0.05; e.g.rotation.z = -e.s * st.tilt * 0.55; }
    const open = clamp(Math.max(st.mouth, talk));
    const wide = st.wide;
    for (const sgm of segs) { sgm.m.visible = open < 0.18; sgm.m.scale.set(0.18 * wide, 0.045, 0.012); sgm.m.rotation.z = sgm.s * st.smile * 0.5; sgm.m.position.set(sgm.s * 0.09 * wide, -st.smile * 0.0 + Math.abs(sgm.s) * -0.0, 0); sgm.m.position.y = -Math.abs(st.smile) * 0.0 + (st.smile > 0 ? -0.01 * st.smile : 0.012); }
    openM.visible = rim.visible = open >= 0.18; openM.scale.set(0.11 * wide, 0.02 + 0.13 * open, 0.01); rim.scale.set(0.14 * wide, 0.035 + 0.15 * open, 0.008);
    if (!frozen) { root.position.y = 0.025 * Math.sin(t * 1.9); armL.rotation.z = 0.12 * Math.sin(t * 1.3); armR.rotation.z = -0.12 * Math.sin(t * 1.3 + 1); }
  }
  return { group, setExpression, defineExpression, setTalkLevel(v) { talk = clamp(v); }, look(x, y) { gx = clamp(x, -1, 1); gy = clamp(y, -1, 1); }, update, freeze() { frozen = true; blink = 0; }, setSpeaker() {}, setEyeStyle() {}, actNames: [] };
}
