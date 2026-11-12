// "Uang x5": ayam alone, a number that multiplies on the beat, each number buys a bigger thing and the world answers it.
// Timeline = the music's beat grid (episodes/<slug>/uang.json: bpm, offset, scenes[{id, nominal, label, bar, bars}]). Every frame is a pure function of t (plus the
// stepped character), so any chunk of a render looks identical.
//   ?ep=<slug>&shot=1&t=3.2&name=a.png     one still        ?ep=<slug>&capture=1&from=0&to=500   frames posted to serve.mjs
import * as THREE from 'three';

const q = new URLSearchParams(location.search);
const slug = q.get('ep') || 'uang-preview';
const BASE = '..', FPS = 30;
let seed = 777; const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const J = (u) => fetch(u).then((r) => r.json());
const TL = await J(`${BASE}/episodes/${slug}/uang.json`);
const CFG = await J(`${BASE}/characters/ayam/character.json`);
const W = innerWidth, H = innerHeight;
const BEAT = 60 / TL.bpm, OFF = TL.offset;
const B = (bar, beat = 0) => OFF + (bar * 4 + beat) * BEAT;   // seconds of a beat
const TOTAL = TL.total;

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, W / H, 0.1, 200); scene.add(camera);

const rigMod = await import(`${BASE}/characters/ayam/rig.js`);
const mul = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const ayam = rigMod.create(renderer, { rand: mul(11), W, H, config: CFG });
ayam.group.scale.setScalar(0.85); scene.add(ayam.group);

// ---- helpers
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 3);
const pop = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : 1 - Math.exp(-7 * u) * Math.cos(14 * u));   // springy 0 -> 1 with a little overshoot
const lerp = (a, b, k) => a + (b - a) * k;
const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, metalness: 0, ...o });
const bas = (c, o = {}) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false, ...o });
const mesh = (g, m, x = 0, y = 0, z = 0, p) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; (p || scene).add(o); return o; };
const tex = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); fn(g, w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return { t, c, g }; };
const gradTex = (a, b) => tex(2, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(0, 0, w, h); }).t;

// ---- lights
scene.add(new THREE.HemisphereLight('#FFF4E0', '#9AA0B8', 1.25));
const sun = new THREE.DirectionalLight('#FFF1D6', 2.4); sun.position.set(4, 8, 7); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -4, near: 1, far: 30 }); scene.add(sun);

// ---- backdrop: sky, ground, far buildings; the mood changes per scene
const sky = mesh(new THREE.PlaneGeometry(90, 60), new THREE.MeshBasicMaterial({ map: gradTex('#8FD3F4', '#FFE7C2'), toneMapped: false }), 0, 10, -26); sky.castShadow = sky.receiveShadow = false;
const ground = mesh(new THREE.PlaneGeometry(80, 60), mat('#B9B3A6', { roughness: 1 }), 0, 0, -8); ground.rotation.x = -Math.PI / 2; ground.castShadow = false;
const stripe = mesh(new THREE.PlaneGeometry(80, 0.3), mat('#F5F0E3'), 0, 0.01, -3.4); stripe.rotation.x = -Math.PI / 2; stripe.castShadow = false;
const far = new THREE.Group(); scene.add(far);
const rr = mul(5);
for (let i = 0; i < 14; i++) { const w = 2 + rr() * 2.4, h = 3 + rr() * 6; const m = mesh(new THREE.BoxGeometry(w, h, 1.5), mat(['#C9D3E6', '#D9C9D6', '#E6D8C2', '#BFD4D0'][i % 4], { roughness: 1 }), -14 + i * 2.3, h / 2, -15 - rr() * 3, far); m.castShadow = false; }
const MOODS = { // sky top, sky bottom, ground, light intensity
  day: ['#8FD3F4', '#FFE7C2', '#B9B3A6', 1], night: ['#1B1E4B', '#5B4B86', '#4A4D66', 0.45], dark: ['#06070D', '#0E1020', '#14151F', 0.18], gold: ['#FFB26B', '#FFE9A8', '#C9B58A', 1.05], neon: ['#2B1055', '#D04ED6', '#2A2044', 0.55],
};
const skyTex = {}; for (const [k, v] of Object.entries(MOODS)) skyTex[k] = gradTex(v[0], v[1]);

// ---- screen-space text (the nominal on top, the label below): planes glued to the camera, drawn by code
const HUD = new THREE.Group(); camera.add(HUD);
const HD = 3.2, HH = 2 * HD * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), HW = HH * (W / H);
function hudPlane(w, h, cw, ch, fn) { const T = tex(cw, ch, fn); const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: T.t, transparent: true, toneMapped: false, depthTest: false })); p.renderOrder = 10; p.position.z = -HD; HUD.add(p); p.userData = T; return p; }
const nomP = hudPlane(HW * 0.94, HW * 0.26, 1024, 288, () => {}); nomP.position.y = HH * 0.36;
const lblP = hudPlane(HW * 0.9, HW * 0.2, 1024, 224, () => {}); lblP.position.y = -HH * 0.38;
const tagP = hudPlane(HW * 0.3, HW * 0.3, 256, 256, () => {}); tagP.position.set(HW * 0.3, HH * 0.24, 0);
const hookP = hudPlane(HW * 0.94, HW * 0.62, 1024, 640, (g) => {});
{ const { g, c } = hookP.userData; g.clearRect(0, 0, c.width, c.height); g.fillStyle = 'rgba(27,27,47,0.88)'; g.beginPath(); g.roundRect(20, 20, 984, 600, 56); g.fill(); g.lineWidth = 10; g.strokeStyle = '#FFD84D'; g.stroke();
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const line = (txt, y, size, col) => { g.font = `900 ${size}px 'Arial Black', Impact, sans-serif`; const f = Math.min(size, size * 900 / g.measureText(txt).width); g.font = `900 ${f}px 'Arial Black', Impact, sans-serif`; g.fillStyle = col; g.fillText(txt, 512, y); };
  line('UANG Rp2.000', 150, 130, '#FFD84D'); line('kalau ×5 terus-terusan', 330, 92, '#FFFFFF'); line('bisa kebeli apa?', 490, 112, '#FF6B5A'); hookP.userData.t.needsUpdate = true; }
hookP.position.y = HH * 0.27; hookP.visible = false;
const fmt = (v) => 'Rp ' + Math.round(v).toLocaleString('id-ID');
function drawNominal(v, glow, hot) {
  const { g, c } = nomP.userData; g.clearRect(0, 0, c.width, c.height);
  g.textAlign = 'center'; g.textBaseline = 'middle'; const s = fmt(v);
  let f = 150; g.font = `900 ${f}px 'Arial Black', Impact, sans-serif`; const mw = g.measureText(s).width; f = Math.min(150, f * 940 / mw); g.font = `900 ${f}px 'Arial Black', Impact, sans-serif`;
  g.lineJoin = 'round'; g.lineWidth = 30; g.strokeStyle = '#1B1B2F'; g.strokeText(s, 512, 150);
  g.shadowColor = hot ? '#FF5A3D' : '#FFD84D'; g.shadowBlur = 26 * glow; g.fillStyle = hot ? '#FFF2D6' : '#FFD84D'; g.fillText(s, 512, 150); g.shadowBlur = 0;
  nomP.userData.t.needsUpdate = true;
}
function drawLabel(s, a) {
  const { g, c } = lblP.userData; g.clearRect(0, 0, c.width, c.height); if (!s || a <= 0) { lblP.userData.t.needsUpdate = true; return; }
  g.globalAlpha = a; g.textAlign = 'center'; g.textBaseline = 'middle'; let f = 96; g.font = `900 ${f}px 'Arial Black', Impact, sans-serif`; f = Math.min(96, f * 900 / g.measureText(s).width); g.font = `900 ${f}px 'Arial Black', Impact, sans-serif`;
  g.lineJoin = 'round'; g.lineWidth = 22; g.strokeStyle = '#1B1B2F'; g.strokeText(s, 512, 112); g.fillStyle = '#FFFFFF'; g.fillText(s, 512, 112); g.globalAlpha = 1;
  lblP.userData.t.needsUpdate = true;
}
function drawTag(txt) {
  const { g, c } = tagP.userData; g.clearRect(0, 0, c.width, c.height); if (!txt) { tagP.userData.t.needsUpdate = true; return; }
  g.translate(128, 128); g.rotate(-0.18); g.fillStyle = '#FF3D5A'; g.beginPath(); g.arc(0, 0, 100, 0, 6.283); g.fill(); g.lineWidth = 12; g.strokeStyle = '#1B1B2F'; g.stroke();
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = "900 96px 'Arial Black', Impact, sans-serif"; g.fillText(txt, 0, 6); g.setTransform(1, 0, 0, 1, 0, 0);
  tagP.userData.t.needsUpdate = true;
}

// ---- particles: bursts of little shapes, deterministic from (burst index, particle index)
const bursts = [];   // {t, o:[x,y,z], n, color, speed, size, g, up, life, spin, shape}
const pgeo = { box: new THREE.BoxGeometry(1, 1, 1), ball: new THREE.SphereGeometry(0.5, 8, 6) };
const POOL = []; for (let i = 0; i < 260; i++) { const m = new THREE.Mesh(pgeo.ball, bas('#fff')); m.visible = false; m.castShadow = false; scene.add(m); POOL.push(m); }
function burst(t, o, n, color, speed, size, opt = {}) { bursts.push({ t, o, n, color, speed, size, g: opt.g ?? 9, up: opt.up ?? 0.6, life: opt.life ?? 1.1, shape: opt.shape || 'ball', spin: opt.spin ?? 6, spread: opt.spread ?? 1, bounce: opt.bounce ?? false }); }
function updParticles(t) {
  let k = 0;
  bursts.forEach((b, bi) => {
    const u = t - b.t; if (u < 0 || u > b.life) return;
    for (let i = 0; i < b.n; i++) {
      if (k >= POOL.length) return; const m = POOL[k++];
      const a = Math.sin((bi + 1) * 91.7 + i * 12.9898) * 43758.5453, r1 = a - Math.floor(a), a2 = Math.sin((bi + 3) * 37.1 + i * 78.233) * 12345.678, r2 = a2 - Math.floor(a2), a3 = Math.sin((bi + 5) * 17.3 + i * 5.11) * 9876.54, r3 = a3 - Math.floor(a3);
      const ang = r1 * 6.283, sp = b.speed * (0.4 + r2 * 0.9);
      const vx = Math.cos(ang) * sp * b.spread, vz = Math.sin(ang) * sp * 0.5 * b.spread, vy = sp * (b.up + r3 * 0.8);
      let y = b.o[1] + vy * u - 0.5 * b.g * u * u; if (b.bounce && y < 0.05) y = 0.05 + Math.abs(Math.sin(u * 8)) * 0.05;
      m.visible = true; m.geometry = pgeo[b.shape]; m.material.color.set(Array.isArray(b.color) ? b.color[i % b.color.length] : b.color);
      m.position.set(b.o[0] + vx * u, y, b.o[2] + vz * u); const s = b.size * (0.6 + r3 * 0.8) * (1 - clamp(u / b.life) * 0.7); m.scale.setScalar(Math.max(0.001, s)); m.rotation.set(u * b.spin * r1, u * b.spin * r2, 0);
    }
  });
  for (; k < POOL.length; k++) POOL[k].visible = false;
}

// ---- the five sets. Each is built once and shown only inside its own time window.
const S = {};
const stall = (parent, x, z) => {   // a small food cart
  const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
  mesh(new THREE.BoxGeometry(2.4, 1.1, 1.2), mat('#9A6B43'), 0, 0.55, 0, g);
  mesh(new THREE.BoxGeometry(2.3, 0.7, 1.1), mat('#BFE3F2', { transparent: true, opacity: 0.55, roughness: 0.1 }), 0, 1.5, 0, g);
  const roof = mesh(new THREE.BoxGeometry(2.8, 0.18, 1.6), mat('#D0342C'), 0, 2.25, 0, g); roof.rotation.z = 0.05;
  for (const px of [-1.2, 1.2]) mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 8), mat('#6B4A2B'), px, 1.6, 0.6, g);
  for (let i = 0; i < 6; i++) { const f = mesh(new THREE.SphereGeometry(0.17, 10, 8), mat('#D98A2B'), -0.8 + i * 0.32, 1.28, 0.1, g); f.scale.set(1.2, 0.8, 1); }
  mesh(new THREE.BoxGeometry(2.5, 0.08, 1.3), mat('#7A5230'), 0, 1.12, 0, g);
  return g;
};
const items = {};   // hero props, by scene id

function build() {
  // ---------- S1: gorengan (bakwan) at a cart
  { const g = new THREE.Group(); scene.add(g); S.s1 = g; g.userData.cart = stall(g, 2.0, -3.0);
    const bw = new THREE.Group(); g.add(bw); mesh(new THREE.SphereGeometry(0.62, 18, 14), mat('#E0952E', { roughness: 0.5 }), 0, 0, 0, bw).scale.set(1.25, 0.82, 1);
    for (let i = 0; i < 9; i++) { const m = mesh(new THREE.SphereGeometry(0.16, 8, 6), mat(['#F4C15D', '#C77A1E', '#8FBF4D'][i % 3], { roughness: 0.6 }), -0.55 + (i % 5) * 0.28, 0.14 + (i % 3) * 0.1, 0.5 - (i % 2) * 0.1, bw); }
    items.s1 = bw; g.userData.bite = 0; }
  // ---------- S2: 1 liter bensin: a clear bottle with green liquid + a puddle
  { const g = new THREE.Group(); scene.add(g); S.s2 = g;
    const bt = new THREE.Group(); g.add(bt);
    mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.5, 20), mat('#CFEFFF', { transparent: true, opacity: 0.35, roughness: 0.05 }), 0, 0, 0, bt);
    const liq = mesh(new THREE.CylinderGeometry(0.38, 0.38, 1.2, 20), mat('#3DD672', { emissive: '#1B8F44', emissiveIntensity: 0.35, roughness: 0.3 }), 0, -0.14, 0, bt); g.userData.liq = liq;
    mesh(new THREE.CylinderGeometry(0.17, 0.3, 0.32, 16), mat('#CFEFFF', { transparent: true, opacity: 0.4 }), 0, 0.9, 0, bt); mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.16, 16), mat('#E8383D'), 0, 1.15, 0, bt);
    const lab = tex(256, 128, (c, w, h) => { c.fillStyle = '#FFF'; c.fillRect(0, 0, w, h); c.fillStyle = '#1B8F44'; c.font = "900 62px 'Arial Black'"; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('1 L', w / 2, h / 2); }).t;
    const lp = mesh(new THREE.PlaneGeometry(0.6, 0.3), new THREE.MeshBasicMaterial({ map: lab, toneMapped: false }), 0, -0.1, 0.43, bt); lp.castShadow = false;
    const pud = mesh(new THREE.CircleGeometry(1, 40), mat('#2FCB68', { transparent: true, opacity: 0.8, roughness: 0.15 }), 0, 0.02, 0.5, g); pud.rotation.x = -Math.PI / 2; pud.castShadow = false; g.userData.pud = pud;
    stall(g, 2.1, -3.2); items.s2 = bt; }
  // ---------- S3: tiket bioskop + a cinema screen that floods the scene with light
  { const g = new THREE.Group(); scene.add(g); S.s3 = g;
    const scr = mesh(new THREE.PlaneGeometry(9, 5.4), new THREE.MeshBasicMaterial({ color: '#CFE8FF', toneMapped: false }), 0, 3.4, -6.5, g); scr.castShadow = false; g.userData.scr = scr;
    for (let i = 0; i < 3; i++) for (let j = -2; j <= 2; j++) { const s = mesh(new THREE.BoxGeometry(0.9, 0.9, 0.7), mat('#8B1E2D'), j * 1.7, 0.45, -1.6 - i * 1.6, g); mesh(new THREE.BoxGeometry(0.9, 0.9, 0.2), mat('#6E1522'), j * 1.7, 1.1, -1.9 - i * 1.6, g); }
    const tk = new THREE.Group(); g.add(tk);
    const face = tex(512, 256, (c, w, h) => { c.fillStyle = '#F7E7A9'; c.fillRect(0, 0, w, h); c.strokeStyle = '#A87A12'; c.lineWidth = 10; c.strokeRect(10, 10, w - 20, h - 20); c.fillStyle = '#7A1620'; c.font = "900 92px 'Arial Black'"; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('TIKET', w / 2, 92); c.font = "900 46px 'Arial Black'"; c.fillStyle = '#1B1B2F'; c.fillText('1 ORANG', w / 2, 168); c.fillStyle = '#A87A12'; for (let y = 22; y < h - 10; y += 22) c.fillRect(w - 76, y, 4, 12); }).t;
    const tp = mesh(new THREE.BoxGeometry(1.8, 0.9, 0.04), [mat('#F7E7A9'), mat('#F7E7A9'), mat('#F7E7A9'), mat('#F7E7A9'), new THREE.MeshBasicMaterial({ map: face, toneMapped: false }), mat('#E9D58A')], 0, 0, 0, tk); tp.castShadow = false;
    items.s3 = tk; g.userData.beam = new THREE.PointLight('#CFE8FF', 0, 30, 1.2); g.userData.beam.position.set(0, 3.2, -3); g.add(g.userData.beam); }
  // ---------- S4: sepatu (a pair of sneakers) + a road for the sprint
  { const g = new THREE.Group(); scene.add(g); S.s4 = g;
    const shoe = (x) => { const s = new THREE.Group(); s.position.x = x; g.add(s); mesh(new THREE.BoxGeometry(0.62, 0.16, 1.5), mat('#F4F4F4'), 0, 0.08, 0, s); const up = mesh(new THREE.SphereGeometry(0.4, 14, 10), mat('#FF3D5A'), 0, 0.3, 0.18, s); up.scale.set(0.85, 0.62, 1.25); mesh(new THREE.BoxGeometry(0.46, 0.05, 0.5), mat('#FFFFFF'), 0, 0.5, 0.2, s); return s; };
    const L = shoe(-0.45), R = shoe(0.45); items.s4 = [L, R];
    for (let i = 0; i < 14; i++) { const m = mesh(new THREE.BoxGeometry(0.1, 0.02, 1.5), mat('#FFFFFF'), 0, 0.012, -i * 3 + 3, g); m.castShadow = false; g.userData['dash' + i] = m; } }
  // ---------- S5: HP (a phone that spews notifications)
  { const g = new THREE.Group(); scene.add(g); S.s5 = g;
    const ph = new THREE.Group(); g.add(ph);
    mesh(new THREE.BoxGeometry(1.0, 2.0, 0.12), mat('#1B1D2A', { roughness: 0.3 }), 0, 0, 0, ph);
    const sc = tex(256, 512, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#5B8CFF'); gr.addColorStop(1, '#C65BFF'); c.fillStyle = gr; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(255,255,255,.9)'; c.font = "900 64px 'Arial Black'"; c.textAlign = 'center'; c.fillText('12:00', w / 2, 120); }).t;
    const sp = mesh(new THREE.PlaneGeometry(0.88, 1.84), new THREE.MeshBasicMaterial({ map: sc, toneMapped: false }), 0, 0, 0.07, ph); sp.castShadow = false;
    items.s5 = ph; g.userData.notes = [];
    const cols = ['#FF3D5A', '#2FCB68', '#FFB020', '#3D8BFF', '#C65BFF'];
    for (let i = 0; i < 26; i++) { const T = tex(256, 128, (c, w, h) => { c.fillStyle = cols[i % 5]; c.beginPath(); c.roundRect(6, 6, w - 12, h - 12, 28); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(54, 64, 26, 0, 6.283); c.fill(); c.fillRect(100, 40, 110, 14); c.fillRect(100, 70, 76, 14); }); const p = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.6), new THREE.MeshBasicMaterial({ map: T.t, transparent: true, toneMapped: false })); p.castShadow = false; p.visible = false; scene.add(p); g.userData.notes.push(p); } }
}
build();
const car = new THREE.Group(); scene.add(car);
{ mesh(new THREE.BoxGeometry(2.4, 0.7, 1.1), mat('#E84D5C'), 0, 0.55, 0, car); mesh(new THREE.BoxGeometry(1.3, 0.55, 1.0), mat('#CFE8FF', { roughness: 0.2 }), -0.1, 1.15, 0, car); for (const x of [-0.8, 0.8]) { const w = mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.2, 14), mat('#1B1B2F'), x, 0.3, 0, car); w.rotation.x = Math.PI / 2; } }
const skid = mesh(new THREE.PlaneGeometry(1, 0.35), mat('#2B2B33'), -3.2, 0.02, 1.0); skid.rotation.x = -Math.PI / 2; skid.castShadow = false; skid.visible = false;

// ---- the story, scene by scene. A scene = TL.scenes[i]: { id, nominal, label, bar, bars }. The BIG hit is at beat 0 of its second half ("the kick").
const SC = TL.scenes.map((s) => ({ ...s, t0: B(s.bar), t1: B(s.bar + s.bars), hit: B(s.bar + s.bars / 2), mid: B(s.bar, 2) }));
const MOOD_OF = { s1: 'day', s2: 'gold', s3: 'dark', s4: 'day', s5: 'neon' };
const FACE = { s1: ['determined', 'delighted'], s2: ['squint', 'panic'], s3: ['neutral', 'shocked'], s4: ['determined', 'laugh'], s5: ['neutral', 'surprised'] };
const cueDone = new Set();
function cue(id, t, fn) { if (t >= 0 && !cueDone.has(id)) { cueDone.add(id); fn(); } }
let shakeAmp = 0, shakeT = -9, flashT = -9, flashDur = 0.12, flashAmp = 0.5;
const shake = (t, a) => { shakeT = t; shakeAmp = a; };
const flash = (t, d = 0.12, a = 0.55) => { flashT = t; flashDur = d; flashAmp = a; };
function sceneAt(t) { let c = SC[0]; for (const s of SC) if (t >= s.t0 - 1e-4) c = s; return c; }
function nominalAt(t) {   // rolls from the previous number to this one right after the downbeat
  let v = SC[0].nominal, prev = SC[0].nominal, hot = false, k = 1;
  for (const s of SC) if (t >= s.t0 - 1e-4) { prev = s.prevNominal ?? s.nominal / 5; v = s.nominal; k = clamp((t - s.t0) / 0.28); hot = true; }
  if (SC[0] && t < SC[0].t0 + 0.05) return { v: SC[0].nominal, k: 1, glow: 0.4 };
  const e = easeOut(k); const val = lerp(prev, v, e);
  return { v: val, k, glow: 0.4 + 1.2 * (1 - k) };
}

const HX = -0.85;   // ayam stands left, the thing it buys on the right
let curScene = null;
function stepFrame(f) {
  const t = f / FPS; ayam.update(1 / FPS);
  const sc = sceneAt(t), id = sc.id, u = t - sc.t0, uh = t - sc.hit;
  if (sc !== curScene) {   // a new scene begins on the downbeat: flash, the number rolls, the face changes
    curScene = sc; for (const k of Object.keys(S)) S[k].visible = k === id;
    const mk = MOOD_OF[id]; sky.material.map = skyTex[mk]; ground.material.color.set(MOODS[mk][2]); sun.intensity = 2.4 * MOODS[mk][3]; far.visible = mk !== 'dark';
    ayam.setExpression(FACE[id][0], 8); ayam.act('bounce', 0.5); if (sc !== SC[0]) flash(t, 0.1, 0.5);
    seed = 1000 + SC.indexOf(sc);
  }
  if (!SC.length) return;
  // generic cues per scene (once each)
  const K = id + ':';
  if (t >= sc.mid) cue(K + 'mid', 1, () => { ayam.setExpression(FACE[id][0], 8); });
  if (t >= sc.hit) cue(K + 'hit', 1, () => { ayam.setExpression(FACE[id][1], 6); hit(id, sc, t); });
  // ----- ayam transform and props
  const g = ayam.group; let ax = 0, ay = 0, az = 0, rz = 0, ry = 0, sx = 1, sy = 1;
  const camP = { x: 0, y: 1.9, z: 13.5, ly: 1.55, fov: 34 };
  const popIn = pop(u / 0.32);
  if (id === 's1') {
    const bw = items.s1; const prog = clamp((uh) / 0.5);
    { const fly = uh > 0 ? easeOut(uh / 0.3) : 0; bw.position.set(lerp(1.2, HX + 0.15, fly), lerp(1.7 + 0.08 * Math.sin(u * 5), 1.35, fly), 1.2); bw.scale.setScalar(Math.max(0.001, popIn) * 0.8 * (uh > 0.3 ? Math.max(0.001, 1 - (uh - 0.3) / 0.3) : 1)); bw.rotation.z = Math.sin(u * 4) * 0.08; }
    ay = 0.06 * Math.abs(Math.sin(u * 6)); if (uh > 0) { sy = 1 - 0.12 * Math.exp(-6 * uh) * Math.cos(uh * 18); sx = 2 - sy; }
    S.s1.userData.cart.rotation.z = uh > 0 ? 0.08 * Math.exp(-4 * uh) * Math.sin(uh * 26) : 0; S.s1.userData.cart.position.y = uh > 0 ? 0.25 * Math.exp(-5 * uh) * Math.abs(Math.sin(uh * 16)) : 0;
  } else if (id === 's2') {
    const bt = items.s2, liq = S.s2.userData.liq, pud = S.s2.userData.pud;
    const tip = uh > 0 ? ease(uh / 0.35) : 0;
    bt.position.set(1.25 - 0.5 * tip, lerp(1.2 + 0.1 * Math.sin(u * 5), 0.5, tip), 1.0); bt.scale.setScalar(Math.max(0.001, popIn)); bt.rotation.z = -1.5 * tip + 0.05 * Math.sin(u * 7);
    liq.scale.y = uh > 0 ? Math.max(0.05, 1 - ease(uh / 1.2) * 0.9) : 1;
    pud.scale.setScalar(uh > 0.2 ? 0.1 + easeOut((uh - 0.2) / 1.2) * 2.3 : 0.001); pud.position.set(0.3, 0.02, 1.0);
    if (uh > 0.25) { const sl = clamp((uh - 0.25) / 0.8); ax = 0.5 * sl * Math.exp(-2.2 * sl); rz = -0.55 * Math.sin(sl * 3.14) * (1 - sl * 0.2); ay = 0.5 * Math.sin(clamp(sl) * 3.14) * (1 - sl); }
    else ay = 0.05 * Math.abs(Math.sin(u * 6));
  } else if (id === 's3') {
    const tk = items.s3, scr = S.s3.userData.scr, bm = S.s3.userData.beam;
    tk.position.set(1.15 - (uh > 0 ? 1.5 * ease(uh / 0.4) : 0), 2.2 + 0.07 * Math.sin(u * 4) - (uh > 0 ? 0.6 * ease(uh / 0.4) : 0), 1.2); tk.scale.setScalar(Math.max(0.001, popIn) * 0.78 * (uh > 0 ? 1 + 0.15 * ease(uh / 0.4) : 1)); tk.rotation.set(0, Math.sin(u * 2.6) * 0.25, Math.sin(u * 3) * 0.07);
    const on = uh > 0 ? easeOut(uh / 0.25) : 0; scr.material.color.setScalar(0.25 + 0.75 * on); bm.intensity = 90 * on; const lvl = 0.18 + on * 2.6; sun.intensity = lvl;
    if (uh > 0) { ax = -0.35 * Math.exp(-2.4 * uh); sy = 1 + 0.06 * Math.exp(-5 * uh) * Math.cos(uh * 22); }
  } else if (id === 's4') {
    const [L, R] = items.s4; const run = uh > 0 ? uh : 0;
    L.position.set(HX - 0.45, 0.0, 1.3); R.position.set(HX + 0.45, 0.0, 1.3);
    const drop = clamp(u / 0.4); L.position.y = (1 - easeOut(drop)) * 3; R.position.y = (1 - easeOut(clamp((u - 0.08) / 0.4))) * 3; L.scale.setScalar(popIn); R.scale.setScalar(popIn);
    if (run > 0) { L.visible = R.visible = false; const out = run < 0.5 ? -Math.pow(run / 0.5, 2.2) * 6.5 : (run < 0.95 ? -6.5 : 6.5 * Math.pow(1 - clamp((run - 0.95) / 0.55), 2)); ax = out; ry = run < 0.95 ? -0.9 : 0.0; rz = 0.12 * Math.sin(run * 44) * (run < 1.5 ? 1 : 0); ay = run < 1.5 ? 0.2 * Math.abs(Math.sin(run * 36)) : 0; if (run > 1.5) { sy = 1 + 0.08 * Math.exp(-8 * (run - 1.5)) * Math.cos((run - 1.5) * 24); } }
    else { L.visible = R.visible = true; ay = 0; }
  } else if (id === 's5') {
    const ph = items.s5, notes = S.s5.userData.notes;
    ph.position.set(1.15, 2.0 + 0.05 * Math.sin(u * 4), 1.4); ph.scale.setScalar(Math.max(0.001, popIn) * 0.85 * (uh > 0 ? 1 + 0.4 * ease(uh / 0.5) : 1)); ph.rotation.set(0, Math.sin(u * 3) * 0.2, 0);
    notes.forEach((p, i) => {
      const dt = uh - i * 0.045; if (dt < 0 || uh < 0) { p.visible = false; return; }
      const ang = (i * 2.399) % 6.283, r = easeOut(dt / 0.9) * (1.2 + (i % 5) * 0.55); p.visible = true;
      p.position.set(ph.position.x + Math.cos(ang) * r * 0.9 - 0.2 * r, ph.position.y + Math.sin(ang) * r * 0.9, 1.8 + dt * 3.5); p.scale.setScalar(0.5 + dt * 1.4); p.rotation.z = (i % 2 ? 1 : -1) * dt * 0.8;
    });
    if (uh > 0) { camP.fov = 34 - 4 * easeOut(uh / 1.2); ay = 0.05 * Math.abs(Math.sin(u * 40)); sx = 1 + 0.03 * Math.sin(uh * 50) * Math.exp(-uh); } else ay = 0.04 * Math.abs(Math.sin(u * 6));
  }
  g.position.set(HX + ax, ay, az); g.rotation.z = rz; g.rotation.y = ry; g.scale.set(sx, sy, 1);
  ayam.lookAt?.(0, 0.1); // eyes toward the camera
  // ----- camera: slow push-in per scene, kick on the hit
  const push = clamp(u / (sc.t1 - sc.t0)); const dist = camP.z - 1.4 * easeOut(push) - (uh > 0 ? 0.35 * Math.exp(-5 * uh) : 0);
  let sxk = 0, syk = 0; { const s = t - shakeT; if (s >= 0 && s < 0.7) { const a = shakeAmp * Math.exp(-5 * s); sxk = Math.sin(s * 70) * a; syk = Math.cos(s * 83) * a * 0.7; } }
  camera.position.set(camP.x + sxk, camP.y + syk, dist); camera.lookAt(0, camP.ly, 0); camera.fov = camP.fov; camera.updateProjectionMatrix();
  // ----- hud
  const HOOK_END = B(1, 0); const inHook = id === 's1' && t < HOOK_END; hookP.visible = inHook; if (inHook) hookP.scale.setScalar(Math.max(0.01, pop(t / 0.35)) * (1 + 0.012 * Math.sin(t * 9))); nomP.visible = !inHook; lblP.visible = !inHook;
  const nm = nominalAt(t); drawNominal(nm.v, nm.glow, nm.k < 1); const uN = id === 's1' ? t - HOOK_END : u; const sNom = 1 + 0.18 * Math.exp(-9 * Math.max(0, uN)) * Math.cos(Math.max(0, uN) * 20); nomP.scale.setScalar(Math.max(0.5, sNom));
  drawLabel(sc.label, clamp((id === 's1' ? t - HOOK_END : u) / 0.12) * (1 - clamp((t - (sc.t1 - 0.1)) / 0.1)));
  { const tu = u - 0.0; if (tu >= 0 && tu < 0.9 && sc !== SC[0]) { drawTag('×5'); tagP.scale.setScalar(Math.max(0.01, pop(tu / 0.3))); tagP.visible = true; } else { tagP.visible = false; } }
  // environment that is always alive: a car crossing far behind, the skyline drifting, steam from the cart, skid marks after the sprint
  car.visible = id !== 's3'; car.position.set(((t * 3.2 + 6) % 26) - 13, 0, -6.5); far.position.x = -0.12 * t;
  skid.visible = id === 's4' && uh > 0.05; if (skid.visible) { const k = easeOut(uh / 0.5); skid.scale.set(Math.max(0.01, 6.5 * k), 1, 1); skid.position.x = HX - 3.0 * k; skid.rotation.z = 0; }
  if (id === 's1' || id === 's2') for (let k = 0; k < 8; k++) { const tb = sc.t0 + k * BEAT * 1; cue(`${id}steam${k}`, t >= tb ? 1 : -1, () => burst(tb, id === 's1' ? [2.0, 2.5, -3.0] : [1.0, 0.6, 1.0], 5, id === 's1' ? '#FFFFFF' : '#B6FFD0', 0.5, id === 's1' ? 0.28 : 0.2, { g: -0.3, up: 1.4, life: 1.5, spread: 0.3 })); }
  updParticles(t);
  // flash overlay via exposure bump
  const fu = (t - flashT) / flashDur; renderer.toneMappingExposure = 1.15 + (fu >= 0 && fu < 1 ? flashAmp * (1 - fu) * 3 : 0);
  // end fade
  const fade = clamp((TOTAL - t) / (TL.fadeOut ?? 0.8)); renderer.domElement.style.opacity = fade;
}
const registered = new Set();
function hit(id, sc, t) {   // the answer of the world (once per scene)
  const h = sc.hit;
  if (id === 's1') { burst(h, [HX + 0.4, 1.4, 1.4], 26, ['#FFC83D', '#E0952E', '#FFF3C4'], 4.2, 0.12, { life: 1.0 }); shake(h, 0.05); }
  if (id === 's2') { burst(h, [0.9, 0.7, 1.0], 28, ['#3DD672', '#B6FFD0', '#2FCB68'], 4.0, 0.14, { life: 1.2, g: 10 }); shake(h, 0.12); }
  if (id === 's3') { burst(h, [0, 2.5, -3], 18, ['#FFFFFF', '#CFE8FF'], 5, 0.12, { g: 1, life: 1.2 }); shake(h, 0.18); }
  if (id === 's4') { burst(h, [HX, 0.2, 0.9], 40, ['#E8D7B8', '#CDBA95', '#F5EDDC'], 5.5, 0.28, { g: 3, life: 1.2, up: 0.25 }); shake(h, 0.22); }
  if (id === 's5') { burst(h, [1.15, 2.0, 1.6], 40, ['#FF3D5A', '#2FCB68', '#FFB020', '#3D8BFF', '#C65BFF'], 6, 0.14, { g: 2, life: 1.4 }); shake(h, 0.28); }
}
// a scene's previous number (for the roll)
SC.forEach((s, i) => { s.prevNominal = i ? SC[i - 1].nominal : s.nominal / 5; });

window.uang = { stepFrame, ayam, scene, camera, SC, TOTAL };
const frames = Math.ceil(TOTAL * FPS);
const draw = () => renderer.render(scene, camera);
if (q.has('shot')) {
  const tt = Number(q.get('t') || 0); for (let f = 0; f <= Math.round(tt * FPS); f++) stepFrame(f); draw();
  renderer.domElement.toBlob((b) => fetch('/save?name=' + encodeURIComponent(q.get('name') || 'uang.png'), { method: 'POST', body: b }));
} else if (q.has('capture')) {
  const from = Number(q.get('from') || 0), to = Number(q.get('to') || frames - 1), t0 = performance.now();
  for (let f = 0; f <= to; f++) { stepFrame(f); if (f < from) continue; draw(); const blob = await new Promise((r) => renderer.domElement.toBlob(r, 'image/png')); await fetch(`/frame?ep=${slug}&n=${f}`, { method: 'POST', body: blob }); }
  await fetch(`/done?ep=${slug}&from=${from}&to=${to}&sec=${Math.round((performance.now() - t0) / 1000)}`, { method: 'POST', body: 'x' });
} else {
  let f = 0; (function loop() { stepFrame(f++ % frames); draw(); requestAnimationFrame(loop); })();
}
