// "Uang x5": ayam alone, a number that multiplies on the beat, each number buys a bigger thing and the world answers it.
// Timeline = the music's beat grid (episodes/<slug>/uang.json: bpm, offset, scenes[{id, nominal, label, bar, bars}]). Every frame is a pure function of t (plus the
// stepped character), so any chunk of a render looks identical.
//   ?ep=<slug>&shot=1&t=3.2&name=a.png     one still        ?ep=<slug>&capture=1&from=0&to=500   frames posted to serve.mjs
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { makeX } from './uang-x.js';

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
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, W / H, 0.1, 200); scene.add(camera);

const rigMod = await import(`${BASE}/characters/ayam/rig.js`);
const mul = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const ayam = rigMod.create(renderer, { rand: mul(11), W, H, config: CFG });
ayam.group.scale.setScalar(0.72); scene.add(ayam.group);

// ---- helpers
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 3);
const pop = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : 1 - Math.exp(-7 * u) * Math.cos(14 * u));   // springy 0 -> 1 with a little overshoot
const lerp = (a, b, k) => a + (b - a) * k;
const easeIn = (k) => k * k;
const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, metalness: 0, ...o });
const bas = (c, o = {}) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false, ...o });
const mesh = (g, m, x = 0, y = 0, z = 0, p) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; (p || scene).add(o); return o; };
const tex = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); fn(g, w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return { t, c, g }; };
const gradTex = (a, b) => tex(2, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(0, 0, w, h); }).t;

// a small shop sign / price board in the world: lines = [[text, px, colour], ...]
function signBoard(lines, w = 1.9, h = 0.62, bg = '#FFF8E6', border = '#1B1B2F') {
  const cw = 512, ch = Math.round(512 * h / w);
  const T = tex(cw, ch, (g, W2, H2) => { g.fillStyle = bg; g.beginPath(); g.roundRect(4, 4, W2 - 8, H2 - 8, 26); g.fill(); g.lineWidth = 8; g.strokeStyle = border; g.stroke(); g.textAlign = 'center'; g.textBaseline = 'middle';
    const n = lines.length; lines.forEach(([txt, px, col], i) => { g.font = `900 ${px}px 'Segoe UI Black', 'Arial Black', sans-serif`; const f = Math.min(px, px * (W2 - 50) / g.measureText(txt).width); g.font = `900 ${f}px 'Segoe UI Black', 'Arial Black', sans-serif`; g.fillStyle = col; g.fillText(txt, W2 / 2, H2 * (i + 0.5) / n + 2); }); });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: T.t, toneMapped: false })); m.castShadow = false; return m;
}

// ---- lights
// light rig (skill/guides/light-theory.md): a warm KEY from the side-top that casts the shadow, a cool RIM from behind to separate ayam from the background, a low ambient, a cool FILL
// from the low left, depth haze (fog). Each scene has its own preset; a change of light always has a visible cause (sunset sky, the meter paid and the street lamps switching on).
const hemi = new THREE.HemisphereLight('#BFD9FF', '#8A7F72', 0.5); scene.add(hemi);
const key = new THREE.SpotLight('#FFE2B8', 700, 60, 0.55, 0.7, 2); key.position.set(5, 9, 8); key.target.position.set(-0.5, 1.2, 0); key.castShadow = true; key.shadow.mapSize.set(1536, 1536); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.camera.near = 2; key.shadow.camera.far = 40; scene.add(key, key.target);
const rim = new THREE.SpotLight('#BFD8FF', 450, 60, 0.6, 0.8, 2); rim.position.set(-5, 6, -7); rim.target.position.set(-0.5, 1.4, 0); scene.add(rim, rim.target);
const fillL = new THREE.PointLight('#9DB8FF', 6, 30, 2); fillL.position.set(-4, 1.5, 7); scene.add(fillL);
scene.fog = new THREE.FogExp2('#CFE0EA', 0.01);
const LT = {
  day: { key: { c: '#FFE2B8', i: 430, p: [5, 9, 8] }, rim: { c: '#BFD8FF', i: 220, p: [-5, 6, -7] }, hemi: { s: '#BFD9FF', g: '#8A7F72', i: 0.5 }, fill: { c: '#9DB8FF', i: 6 }, fog: { c: '#CFE0EA', d: 0.010 } },
  gold: { key: { c: '#FFB070', i: 480, p: [8, 5, 7] }, rim: { c: '#FFE3C0', i: 280, p: [-5, 4, -7] }, hemi: { s: '#FFC38A', g: '#7A5A44', i: 0.42 }, fill: { c: '#8FA6FF', i: 4 }, fog: { c: '#F2B98A', d: 0.014 } },
  dark: { key: { c: '#6F8CFF', i: 220, p: [-4, 9, 6] }, rim: { c: '#4E66C8', i: 260, p: [5, 6, -7] }, hemi: { s: '#1B2350', g: '#05060D', i: 0.18 }, fill: { c: '#4E66C8', i: 2 }, fog: { c: '#05060D', d: 0.02 } },
  space: { key: { c: '#FFF1DC', i: 520, p: [6, 6, 6] }, rim: { c: '#5B8CFF', i: 300, p: [-5, 4, -7] }, hemi: { s: '#2A3470', g: '#05060D', i: 0.4 }, fill: { c: '#7FA0FF', i: 4 }, fog: { c: '#05060D', d: 0.0015 } },
  night: { key: { c: '#FFC98A', i: 250, p: [3, 6, 7] }, rim: { c: '#6F8CFF', i: 130, p: [-5, 6, -7] }, hemi: { s: '#5A5C9A', g: '#2A2538', i: 0.28 }, fill: { c: '#8FA6FF', i: 2.5 }, fog: { c: '#2B2B55', d: 0.014 } },
};
LT.neon = LT.night;
const _a = new THREE.Color(), _b = new THREE.Color();
function applyLight(a, b = a, k = 0) {
  const A = LT[a], B = LT[b], L = (x, y) => x + (y - x) * k, mix = (t, c1, c2) => t.copy(_a.set(c1).lerp(_b.set(c2), k));
  mix(key.color, A.key.c, B.key.c); key.intensity = L(A.key.i, B.key.i); key.position.set(L(A.key.p[0], B.key.p[0]), L(A.key.p[1], B.key.p[1]), L(A.key.p[2], B.key.p[2]));
  mix(rim.color, A.rim.c, B.rim.c); rim.intensity = L(A.rim.i, B.rim.i); rim.position.set(L(A.rim.p[0], B.rim.p[0]), L(A.rim.p[1], B.rim.p[1]), L(A.rim.p[2], B.rim.p[2]));
  mix(hemi.color, A.hemi.s, B.hemi.s); mix(hemi.groundColor, A.hemi.g, B.hemi.g); hemi.intensity = L(A.hemi.i, B.hemi.i);
  mix(fillL.color, A.fill.c, B.fill.c); fillL.intensity = L(A.fill.i, B.fill.i);
  mix(scene.fog.color, A.fog.c, B.fog.c); scene.fog.density = L(A.fog.d, B.fog.d);
}
applyLight('day');

// ---- backdrop: sky, ground, far buildings; the mood changes per scene
const sky = mesh(new THREE.PlaneGeometry(90, 60), new THREE.MeshBasicMaterial({ map: gradTex('#8FD3F4', '#FFE7C2'), toneMapped: false, fog: false }), 0, 10, -26); sky.castShadow = sky.receiveShadow = false;
const ground = mesh(new THREE.PlaneGeometry(80, 60), mat('#B9B3A6', { roughness: 1 }), 0, 0, -8); ground.rotation.x = -Math.PI / 2; ground.castShadow = false;
const stripe = mesh(new THREE.PlaneGeometry(80, 0.3), mat('#F5F0E3'), 0, 0.01, -3.4); stripe.rotation.x = -Math.PI / 2; stripe.castShadow = false;
const far = new THREE.Group(); scene.add(far);
const rr = mul(5);
for (let i = 0; i < 14; i++) { const w = 2 + rr() * 2.4, h = 3 + rr() * 6; const m = mesh(new THREE.BoxGeometry(w, h, 1.5), mat(['#C9D3E6', '#D9C9D6', '#E6D8C2', '#BFD4D0'][i % 4], { roughness: 1 }), -14 + i * 2.3, h / 2, -15 - rr() * 3, far); m.castShadow = false; }
const MOODS = { // sky top, sky bottom, ground, light intensity
  day: ['#8FD3F4', '#FFE7C2', '#B9B3A6', 1], night: ['#1B1E4B', '#5B4B86', '#4A4D66', 0.45], dark: ['#06070D', '#0E1020', '#14151F', 0.18], gold: ['#FFB26B', '#FFE9A8', '#C9B58A', 1.05], neon: ['#2B1055', '#D04ED6', '#2A2044', 0.55],
};
const skyTex = {}; for (const [k, v] of Object.entries(MOODS)) skyTex[k] = gradTex(v[0], v[1]);
skyTex.hi = gradTex('#4FA8F0', '#DDF0FF'); skyTex.space = gradTex('#02030A', '#0B1030');

// ---- screen-space text (the nominal on top, the label below): planes glued to the camera, drawn by code
const hudScene = new THREE.Scene(); const hudCam = new THREE.PerspectiveCamera(34, W / H, 0.1, 50); hudScene.add(hudCam);
const HUD = new THREE.Group(); hudCam.add(HUD);
const HD = 3.2, HH = 2 * HD * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), HW = HH * (W / H);
function hudPlane(w, h, cw, ch, fn) { const T = tex(cw, ch, fn); const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: T.t, transparent: true, toneMapped: false, depthTest: false })); p.renderOrder = 10; p.position.z = -HD; HUD.add(p); p.userData = T; return p; }
const PW = HW * 0.8;   // all info planes share one width and one left edge
const LX = -HW * 0.06;   // the block sits near the left edge (about 4% margin)
const nomP = hudPlane(PW, PW * 130 / 1024, 1024, 130, () => {}); nomP.position.y = HH * 0.3015; nomP.position.x = LX;
const lblP = hudPlane(PW, PW * 90 / 1024, 1024, 90, () => {}); lblP.position.y = HH * 0.2042; lblP.position.x = LX;
const tagP = hudPlane(HW * 0.16, HW * 0.16, 256, 256, () => {}); tagP.position.set(HW * 0.3, HH * 0.3, 0);
const hookP = hudPlane(HW * 0.8, HW * 0.58, 1024, 742, () => {});
function drawHook(t) {
  const { g, c } = hookP.userData; g.clearRect(0, 0, c.width, c.height); g.fillStyle = 'rgba(27,27,47,0.92)'; g.beginPath(); g.roundRect(20, 20, 984, 560, 56); g.fill(); g.lineWidth = 10; g.strokeStyle = '#FFD84D'; g.stroke();
  g.textAlign = 'center'; g.textBaseline = 'middle';
  // two appearances: (1) the real Rp2.000 bill + "Rp 2.000" + "kalau di x5 terus-terusan", (2) "bisa kebeli apa aja?" (compact line spacing)
  const F = "'Bahnschrift', 'Segoe UI', sans-serif", fit = (tx, sz, mw, w = 700) => { g.font = `${w} ${sz}px ${F}`; return Math.min(sz, sz * mw / g.measureText(tx).width); };
  const k1 = clamp((t - B(0, 0.5)) / 0.16), e1 = easeOut(k1);
  if (k1 > 0) {
    g.save(); g.globalAlpha = k1; g.translate(512, 130); g.scale(0.85 + 0.15 * e1, 0.85 + 0.15 * e1); g.rotate(-0.04); g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 20; g.drawImage(noteFace.image, -200, -94, 400, 188); g.restore();
    g.save(); g.globalAlpha = k1; g.font = `700 ${fit('Rp 2.000', 112, 800)}px ${F}`; g.fillStyle = '#FFD84D'; g.fillText('Rp 2.000', 512, 292 + (1 - e1) * 16); g.restore();
    g.save(); g.globalAlpha = k1; { const fs2 = fit('kalau di ×5 terus-terusan', 70, 880); g.font = `700 ${fs2}px ${F}`; g.textAlign = 'left'; const segs = [['kalau di ', '#FFFFFF'], ['×5', '#FF6B5A'], [' terus-terusan', '#FFFFFF']]; const tw = segs.reduce((a, q) => a + g.measureText(q[0]).width, 0); let xx = 512 - tw / 2; for (const [tx, col] of segs) { g.fillStyle = col; g.fillText(tx, xx, 380 + (1 - e1) * 16); xx += g.measureText(tx).width; } } g.restore();
  }
  const k2 = clamp((t - B(0, 2.0)) / 0.16), e2 = easeOut(k2);
  if (k2 > 0) { g.save(); g.globalAlpha = k2; g.translate(512, 470); g.scale(0.9 + 0.1 * e2, 0.9 + 0.1 * e2); g.font = `700 ${fit('bisa kebeli apa aja?', 92, 880)}px ${F}`; g.fillStyle = '#FFFFFF'; g.fillText('bisa kebeli apa aja?', 0, 0); g.restore(); }
  g.globalAlpha = 1; hookP.userData.t.needsUpdate = true;
}
const outP = hudPlane(HW * 0.86, HW * 0.62, 1024, 740, () => {}); outP.visible = false; outP.position.set(-HW * 0.04, HH * 0.16, -HD);
function drawOut(t, t0) {
  const { g, c } = outP.userData; g.clearRect(0, 0, c.width, c.height); g.textAlign = 'center'; g.textBaseline = 'middle'; const F = "'Bahnschrift', 'Segoe UI', sans-serif";
  const line = (txt, y, px, col, a0) => { const k = clamp((t - t0 - a0) / 0.18); if (k <= 0) return; g.save(); g.globalAlpha = k; g.translate(512, y + (1 - easeOut(k)) * 20); g.font = `700 ${px}px ${F}`; const f = Math.min(px, px * 940 / g.measureText(txt).width); g.font = `700 ${f}px ${F}`; g.shadowColor = 'rgba(10,10,30,0.8)'; g.shadowBlur = 16; g.fillStyle = col; g.fillText(txt, 0, 0); g.restore(); };
  line('Sudah sampai angkasa…', 150, 84, '#FFFFFF', 0.1); line('masih mau ×5 lagi?', 290, 96, '#FF6B5A', 1.2);
  const k = clamp((t - t0 - 2.4) / 0.2); if (k > 0) { g.save(); g.globalAlpha = k; g.fillStyle = 'rgba(27,27,47,0.9)'; g.beginPath(); g.roundRect(212, 400, 600, 150, 40); g.fill(); g.lineWidth = 8; g.strokeStyle = '#FFD84D'; g.stroke(); g.font = `800 92px ${F}`; g.fillStyle = '#FFD84D'; g.fillText('Artosku', 512, 478); g.restore(); }
  outP.userData.t.needsUpdate = true;
}
const fmP = hudPlane(PW, PW * 220 / 1024, 1024, 220, () => {});
const FIRE = ['#FFC83D', '#FFC83D', '#FFB020', '#FF8A1F', '#FF5A1A', '#FF2A12'];
function flame(g, cx, by, h, wd, ph, col) {   // one flickering teardrop flame (drawn normally, under the digit)
  const sw = Math.sin(ph * 0.8) * wd * 0.5, gr = g.createLinearGradient(0, by, 0, by - h); gr.addColorStop(0, 'rgba(255,240,150,0.98)'); gr.addColorStop(0.45, col); gr.addColorStop(1, 'rgba(255,50,10,0)');
  g.fillStyle = gr; g.beginPath(); g.moveTo(cx - wd, by); g.quadraticCurveTo(cx - wd * 0.7 + sw, by - h * 0.55, cx + sw, by - h); g.quadraticCurveTo(cx + wd * 0.7 + sw, by - h * 0.55, cx + wd, by); g.closePath(); g.fill();
}
const LAND = 0;   // seconds after the scene start when the giant exponent has landed in the formula
const expP = hudPlane(HW * 0.5, HW * 0.5, 512, 512, () => {}); expP.renderOrder = 12; expP.visible = false;
function drawGiant(n, tt) {   // pops in huge and burning, rolls from n-1 to n, holds, then flies into the formula
  const { g, c } = expP.userData; g.clearRect(0, 0, c.width, c.height); g.textAlign = 'center'; g.textBaseline = 'middle';
  const col = FIRE[Math.min(n, 5)], fl = 0.85 + 0.15 * Math.sin(tt * 16), roll = easeOut(clamp((tt - 0.12) / 0.4)), px = 330;
  for (let k = 0; k < 9; k++) flame(g, 256 + (k - 4) * 34, 372, (120 + 30 * n) * (0.55 + 0.45 * Math.abs(Math.sin(tt * 12 + k * 1.7))), 30, tt * 12 + k * 1.9, col);
  g.save(); g.beginPath(); g.rect(0, 40, 512, 440); g.clip(); g.font = `900 ${px}px ${UI}`; g.lineJoin = 'round'; g.lineWidth = 34; g.strokeStyle = '#3A0D00'; g.shadowColor = col; g.shadowBlur = 60 * fl;
  for (const [dg, off] of [[n - 1, -roll], [n, 1 - roll]]) { if (dg < 1) continue; const yy = 262 + off * 330; g.globalAlpha = 1 - Math.abs(off) * 0.6; g.strokeText(String(dg), 256, yy); g.fillStyle = tt < 0.1 ? '#FFFFFF' : col; g.fillText(String(dg), 256, yy); }
  g.restore(); expP.userData.t.needsUpdate = true;
}
function drawFormula(n, b, tt = 9, bv = b, bp = 0) {   // Rp 2.000 x 5^n = Rp b : on every new power the exponent appears BIG and burning, then shrinks into place
  const { g, c } = fmP.userData; g.clearRect(0, 0, c.width, c.height); g.textBaseline = 'middle'; g.textAlign = 'left'; SH(g, 8);
  const Y = 186, col = FIRE[Math.min(n, 5)], fl = 0.85 + 0.15 * Math.sin(tt * 15 + n);
  let x = 28; const put = (tx, cl, px, y) => { g.font = `600 ${px}px ${UI}`; g.fillStyle = cl; g.fillText(tx, x, y); x += g.measureText(tx).width; };
  put(fmt(2000), '#FFD84D', 44, Y); put(' ×', '#FF6B5A', 44, Y);
  const burn = n >= 2; g.font = `600 44px ${UI}`; const x5 = x + g.measureText(' ').width, w5 = g.measureText('5').width;
  g.save(); if (burn) { g.shadowColor = col; g.shadowBlur = (10 + 6 * n) * fl; }
  put(' 5', burn ? col : '#FF6B5A', 44, Y); g.restore();
  if (n > 1) {   // the exponent: pops and rolls n-1 -> n on arrival, glows in its colour, pulses on every beat (no flames)
    const pop = 1 + 0.7 * Math.exp(-7 * tt), px = 33 * pop * (1 + 0.3 * bp), cy = Y - 26 - 8 * (pop - 1), roll = easeOut(clamp(tt / 0.3));
    g.font = `800 ${px}px ${UI}`; const w = g.measureText(String(n)).width; fmP.userData.expPos = { x: x + w / 2, cy };
    g.save(); g.beginPath(); g.rect(x - 4, cy - px * 0.8, w + 8, px * 1.6); g.clip(); g.lineJoin = 'round'; g.lineWidth = Math.max(4, px * 0.14); g.strokeStyle = '#3A0D00'; g.shadowColor = col; g.shadowBlur = (10 + 6 * n) * (0.8 + 0.4 * bp);
    for (const [dg, off] of [[n - 1, -roll], [n, 1 - roll]]) { if (dg < 1) continue; const yy = cy + off * px * 1.1; g.globalAlpha = 1 - Math.abs(off) * 0.6; g.strokeText(String(dg), x, yy); g.fillStyle = tt < 0.08 ? '#FFFFFF' : col; g.fillText(String(dg), x, yy); }
    g.restore(); x += w;
  }
  SH(g, 8); put(' = ', '#FFFFFF', 44, Y); put(fmt(bv), '#FFD84D', 44, Y);
  fmP.userData.t.needsUpdate = true;
}
hookP.position.y = HH * 0.03; hookP.position.x = -HW * 0.06; hookP.visible = false; fmP.position.y = HH * 0.2783; fmP.position.x = LX; fmP.visible = false;
const UI = "'Bahnschrift', 'Segoe UI', 'Trebuchet MS', sans-serif", SH = (g, b = 10) => { g.shadowColor = 'rgba(10,10,30,0.75)'; g.shadowBlur = b; g.shadowOffsetX = 0; g.shadowOffsetY = 3; };
const fmt = (v) => { if (v < 1e12) return 'Rp ' + Math.round(v).toLocaleString('id-ID'); const T = v / 1e12; if (T >= 1e6) return 'Rp ' + (T / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 2 }) + ' juta T'; if (T >= 1000) return 'Rp ' + Math.round(T).toLocaleString('id-ID') + ' T'; return 'Rp ' + T.toLocaleString('id-ID', { maximumFractionDigits: 2 }) + ' T'; };
function drawNominal(v, glow, hot) {
  const { g, c } = nomP.userData; g.clearRect(0, 0, c.width, c.height); g.textAlign = 'left'; g.textBaseline = 'middle'; const t = fmt(v);
  g.font = `700 118px ${UI}`; const f = Math.min(118, 118 * 960 / g.measureText(t).width); g.font = `700 ${f}px ${UI}`;
  g.shadowColor = hot ? '#FF5A3D' : 'rgba(10,10,30,0.8)'; g.shadowBlur = hot ? 30 * glow : 12; g.shadowOffsetY = hot ? 0 : 4; g.fillStyle = hot ? '#FFF2D6' : '#FFD84D'; g.fillText(t, 28, 66); g.shadowBlur = 0;
  nomP.userData.t.needsUpdate = true;
}
const FACT = { s1: 'Gorengan Rp2.000 / biji', s2: 'Pertalite Rp10.000 / liter', s3: 'Token PLN Rp50.000 ÷ Rp1.444,70/kWh', s4: 'Sepatu lokal Rp250.000', s5: 'Sepeda Rp1.250.000' };
function drawLabel(sc, a) {
  const { g, c } = lblP.userData; g.clearRect(0, 0, c.width, c.height); if (!sc || a <= 0) { lblP.userData.t.needsUpdate = true; return; }
  g.globalAlpha = a; g.textAlign = 'left'; g.textBaseline = 'middle';
  const line = (txt, y, px, col, wgt) => { g.font = `${wgt} ${px}px ${UI}`; const f = Math.min(px, px * 960 / g.measureText(txt).width); g.font = `${wgt} ${f}px ${UI}`; SH(g, 8); g.fillStyle = col; g.fillText(txt, 28, y); };
  line(sc.item, 46, 44, '#FFFFFF', 700);   // short: the scene itself shows what the money buys g.globalAlpha = 1;
  lblP.userData.t.needsUpdate = true;
}
function drawTag(txt) {
  const { g, c } = tagP.userData; g.clearRect(0, 0, c.width, c.height); if (!txt) { tagP.userData.t.needsUpdate = true; return; }
  g.translate(128, 128); g.rotate(-0.18); g.fillStyle = '#FF3D5A'; g.beginPath(); g.arc(0, 0, 100, 0, 6.283); g.fill(); g.lineWidth = 12; g.strokeStyle = '#1B1B2F'; g.stroke();
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = "900 96px 'Segoe UI Black', 'Arial Black', sans-serif"; g.fillText(txt, 0, 6); g.setTransform(1, 0, 0, 1, 0, 0);
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
const stall = (parent, x, z, sign) => {   // a small food cart
  const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
  mesh(new THREE.BoxGeometry(2.4, 1.1, 1.2), mat('#9A6B43'), 0, 0.55, 0, g);
  mesh(new THREE.BoxGeometry(2.3, 0.7, 1.1), mat('#BFE3F2', { transparent: true, opacity: 0.45, roughness: 0.7 }), 0, 1.5, 0, g);
  const roof = mesh(new THREE.BoxGeometry(2.8, 0.18, 1.6), mat('#D0342C'), 0, 2.25, 0, g); roof.rotation.z = 0.05;
  for (const px of [-1.2, 1.2]) mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 8), mat('#6B4A2B'), px, 1.6, 0.6, g);
  for (let i = 0; i < 6; i++) { const f = mesh(new THREE.SphereGeometry(0.17, 10, 8), mat('#D98A2B'), -0.8 + i * 0.32, 1.28, 0.1, g); f.scale.set(1.2, 0.8, 1); }
  mesh(new THREE.BoxGeometry(2.5, 0.08, 1.3), mat('#7A5230'), 0, 1.12, 0, g);
  if (sign) { const sb = signBoard(sign, 2.1, 0.66); sb.position.set(0, 2.95, 0.5); g.add(sb); for (const px of [-0.8, 0.8]) mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 8), mat('#6B4A2B'), px, 2.5, 0.4, g); }
  return g;
};
const items = {};   // hero props, by scene id

function build() {
  // ---------- S1: gorengan (bakwan) at a cart
  { const g = new THREE.Group(); scene.add(g); S.s1 = g; g.userData.cart = stall(g, 1.15, -3.0, [['GORENGAN', 78, '#B3261E'], ['Rp2.000 / biji', 56, '#1B1B2F']]);
    const bw = new THREE.Group(); g.add(bw); mesh(new THREE.SphereGeometry(0.62, 18, 14), mat('#E0952E', { roughness: 0.5 }), 0, 0, 0, bw).scale.set(1.25, 0.82, 1);
    for (let i = 0; i < 9; i++) { const m = mesh(new THREE.SphereGeometry(0.16, 8, 6), mat(['#F4C15D', '#C77A1E', '#8FBF4D'][i % 3], { roughness: 0.6 }), -0.55 + (i % 5) * 0.28, 0.14 + (i % 3) * 0.1, 0.5 - (i % 2) * 0.1, bw); }
    items.s1 = bw; g.userData.bite = 0; }
  // ---------- S2: 1 liter bensin: a clear bottle with green liquid + a puddle
  { const g = new THREE.Group(); scene.add(g); S.s2 = g;
    const bt = new THREE.Group(); g.add(bt);
    mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.5, 20), mat('#CFEFFF', { transparent: true, opacity: 0.25, roughness: 0.8 }), 0, 0, 0, bt);
    const liq = mesh(new THREE.CylinderGeometry(0.38, 0.38, 1.2, 20), mat('#3DD672', { roughness: 0.6 }), 0, -0.14, 0, bt); g.userData.liq = liq;
    mesh(new THREE.CylinderGeometry(0.17, 0.3, 0.32, 16), mat('#CFEFFF', { transparent: true, opacity: 0.3, roughness: 0.8 }), 0, 0.9, 0, bt); mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.16, 16), mat('#E8383D'), 0, 1.15, 0, bt);
    const lab = tex(256, 128, (c, w, h) => { c.fillStyle = '#FFF'; c.fillRect(0, 0, w, h); c.fillStyle = '#1B8F44'; c.font = "900 62px 'Arial Black'"; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('1 L', w / 2, h / 2); }).t;
    const lp = mesh(new THREE.PlaneGeometry(0.6, 0.3), new THREE.MeshBasicMaterial({ map: lab, toneMapped: false }), 0, -0.1, 0.43, bt); lp.castShadow = false;
    const pud = mesh(new THREE.CircleGeometry(1, 40), mat('#2FCB68', { transparent: true, opacity: 0.8, roughness: 0.7 }), 0, 0.02, 0.5, g); pud.rotation.x = -Math.PI / 2; pud.castShadow = false; g.userData.pud = pud;
    { const pump = new THREE.Group(); pump.position.set(1.25, 0, -1.6); g.add(pump); mesh(new THREE.BoxGeometry(0.95, 1.9, 0.6), mat('#E24B4B'), 0, 0.95, 0, pump); mesh(new THREE.BoxGeometry(0.75, 0.5, 0.05), mat('#1B1B2F'), 0, 1.35, 0.32, pump); mesh(new THREE.BoxGeometry(1.05, 0.14, 0.7), mat('#FFFFFF'), 0, 1.97, 0, pump);
      const hose = mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.0, 8), mat('#1B1B2F'), 0.55, 0.9, 0.2, pump); hose.rotation.z = 0.15;
      const sb = signBoard([['PERTALITE', 64, '#1B8F44'], ['Rp10.000 / liter', 52, '#1B1B2F']], 1.7, 0.6); sb.position.set(-0.1, 2.75, 0.2); pump.add(sb); }
    items.s2 = bt; }
  // ---------- S3: token listrik (Rp50.000): a meter box on a pole; the street lamps and the skyline light up when it is paid
  { const g = new THREE.Group(); scene.add(g); S.s3 = g;
    const mb = new THREE.Group(); g.add(mb);
    mesh(new THREE.BoxGeometry(0.95, 1.2, 0.35), mat('#C9CED8', { roughness: 0.5 }), 0, 0, 0, mb); mesh(new THREE.BoxGeometry(0.75, 0.38, 0.05), mat('#102018'), 0, 0.3, 0.2, mb);
    const dsp = tex(256, 96, (c, w, h) => { c.fillStyle = '#0B1A12'; c.fillRect(0, 0, w, h); c.fillStyle = '#6CFF9A'; c.font = "900 56px 'Arial Black'"; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('50.000', w / 2, h / 2 + 2); }).t;
    const dp = mesh(new THREE.PlaneGeometry(0.7, 0.3), new THREE.MeshBasicMaterial({ map: dsp, toneMapped: false }), 0, 0.3, 0.23, mb); dp.castShadow = false;
    for (let i = 0; i < 4; i++) mesh(new THREE.BoxGeometry(0.16, 0.1, 0.05), mat('#4A5160'), -0.3 + i * 0.2, -0.25, 0.2, mb);
    { const sb = signBoard([['TOKEN LISTRIK', 46, '#B3261E'], ['Rp50.000', 62, '#1B1B2F']], 1.7, 0.62); sb.position.set(0, 0.92, 0.1); mb.add(sb); }
    items.s3 = mb; const lamps = [];
    for (const lx of [-2.3, 0.2, 2.6]) { mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.6, 8), mat('#2A2F3C'), lx, 1.8, -3.2, g); const bulb = mesh(new THREE.SphereGeometry(0.22, 12, 10), bas('#FFE9A8'), lx + 0.35, 3.6, -3.2, g); bulb.visible = false; mesh(new THREE.BoxGeometry(0.8, 0.08, 0.08), mat('#2A2F3C'), lx + 0.18, 3.62, -3.2, g); const light = new THREE.PointLight('#FFD9A0', 0, 16, 1.4); light.position.set(lx + 0.35, 3.3, -2.6); g.add(light); lamps.push({ bulb, light }); }
    g.userData.lamps = lamps; }
  // ---------- S4: sepatu (a pair of sneakers) + a road for the sprint
  { const g = new THREE.Group(); scene.add(g); S.s4 = g;
    const shoe = () => { const s = new THREE.Group(); g.add(s); const e = (geo, m, x, y, z, sx, sy, sz, r = 0) => { const o = mesh(geo, m, x, y, z, s); o.scale.set(sx, sy, sz); o.rotation.z = r; return o; }, SPH = new THREE.SphereGeometry(1, 16, 12), BOX = new THREE.BoxGeometry(1, 1, 1);
      const red = mat('#E8394D', { roughness: 0.65 }), white = mat('#F6F6F2', { roughness: 0.7 }), dark = mat('#2B2430', { roughness: 0.9 });
      e(BOX, white, 0, 0.07, 0, 1.0, 0.13, 0.4); e(SPH, white, 0.5, 0.07, 0, 0.1, 0.065, 0.2);          // rubber sole + rounded toe of the sole
      e(SPH, red, -0.02, 0.27, 0, 0.5, 0.21, 0.19);                                                      // upper
      e(SPH, red, -0.3, 0.31, 0, 0.2, 0.25, 0.185);                                                      // heel
      e(SPH, white, 0.36, 0.2, 0, 0.24, 0.12, 0.17);                                                     // toe cap
      e(SPH, dark, -0.17, 0.46, 0, 0.17, 0.05, 0.12);                                                    // opening
      e(BOX, white, -0.02, 0.5, 0, 0.17, 0.05, 0.14, -0.35);                                             // tongue
      for (let k = 0; k < 3; k++) e(BOX, white, 0.06 + k * 0.1, 0.43 - k * 0.02, 0, 0.04, 0.025, 0.23, -0.3);   // laces
      e(BOX, white, 0.0, 0.2, 0.197, 0.5, 0.045, 0.012, 0.0); e(BOX, white, 0.0, 0.2, -0.197, 0.5, 0.045, 0.012, 0.0);   // side stripe (both sides)
      s.scale.setScalar(1.05); return s; };
    const L = shoe(), R = shoe(); items.s4 = [L, R];
    { const sb = signBoard([['SEPATU LOKAL', 56, '#B3261E'], ['Rp250.000', 62, '#1B1B2F']], 1.6, 0.58); sb.position.set(1.2, 1.75, 0.85); g.add(sb); mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.75, 8), mat('#6B4A2B'), 1.2, 0.875, 0.7, g);  }
    for (let i = 0; i < 14; i++) { const m = mesh(new THREE.BoxGeometry(0.1, 0.02, 1.5), mat('#FFFFFF'), 0, 0.012, -i * 3 + 3, g); m.castShadow = false; g.userData['dash' + i] = m; } }
  // ---------- S5: sepeda (Rp1.250.000): it rides across the frame, spins its bell, comes back and skids to a stop
  { const g = new THREE.Group(); scene.add(g); S.s5 = g;
    const bk = new THREE.Group(); g.add(bk); g.userData.wheels = [];
    const bar = (a, b, r, c) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy); const m = mesh(new THREE.CylinderGeometry(r, r, L, 8), mat(c), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0, bk); m.rotation.z = Math.atan2(dx, -dy) * -1 + Math.PI; m.rotation.z = -Math.atan2(dx, dy); return m; };
    for (const x of [-0.8, 0.8]) { const w = new THREE.Group(); w.position.set(x, 0.55, 0); bk.add(w); mesh(new THREE.TorusGeometry(0.55, 0.06, 10, 30), mat('#1B1B2F'), 0, 0, 0, w); mesh(new THREE.SphereGeometry(0.09, 10, 8), mat('#C9CED8'), 0, 0, 0, w); for (let k = 0; k < 6; k++) { const sp = mesh(new THREE.BoxGeometry(1.04, 0.018, 0.018), mat('#C9CED8'), 0, 0, 0, w); sp.rotation.z = k * Math.PI / 6; } g.userData.wheels.push(w); }
    const red = '#E53935'; bar([-0.8, 0.55], [-0.15, 1.15], 0.05, red); bar([-0.15, 1.15], [0.62, 1.15], 0.05, red); bar([0.62, 1.15], [0.8, 0.55], 0.05, red); bar([-0.8, 0.55], [0.1, 0.55], 0.05, red); bar([0.1, 0.55], [-0.15, 1.15], 0.05, red); bar([0.1, 0.55], [0.62, 1.15], 0.05, red);
    bar([0.62, 1.15], [0.55, 1.5], 0.04, '#222'); mesh(new THREE.BoxGeometry(0.1, 0.05, 0.6), mat('#222'), 0.55, 1.52, 0, bk); mesh(new THREE.BoxGeometry(0.42, 0.09, 0.2), mat('#222'), -0.2, 1.28, 0, bk);
    const bell = mesh(new THREE.SphereGeometry(0.07, 10, 8), mat('#F5C518'), 0.55, 1.6, 0.15, bk);
    items.s5 = bk; { const sb = signBoard([['SEPEDA', 52, '#B3261E'], ['Rp1.250.000', 56, '#1B1B2F']], 1.6, 0.58); sb.position.set(0.85, 1.95, 1.3); g.add(sb); g.userData.sign = sb; } }
}
build();
const crowd = [];
{ const cols = ['#E8586B', '#4BA3E3', '#F2B134', '#7BC96F', '#B07CE8', '#F58F5C']; for (let i = 0; i < 8; i++) { const f = new THREE.Group(); scene.add(f); mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.8, 10), mat(cols[i % 6]), 0, 0.5, 0, f); mesh(new THREE.SphereGeometry(0.21, 12, 10), mat('#F1C9A5'), 0, 1.12, 0, f); f.userData = { sp: 0.45 + 0.2 * (i % 3), off: i * 3.1, z: -5.4 - (i % 3) * 0.45, dir: i % 2 ? 1 : -1 }; crowd.push(f); } }
// speed streaks glued to the camera (the sprint and the bike)
const streaks = []; for (let i = 0; i < 16; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(HW * 0.55, 0.012), new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.55, toneMapped: false, depthTest: false })); m.renderOrder = 9; m.position.z = -HD * 0.98; m.visible = false; HUD.add(m); streaks.push(m); }
const note = new THREE.Group(); scene.add(note);
const noteFace = tex(640, 300, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#AEB9C6'); gr.addColorStop(0.55, '#9AA7B8'); gr.addColorStop(1, '#8794A8'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(70,85,110,0.35)'; g.lineWidth = 2; for (let k = -h; k < w; k += 16) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + h, h); g.stroke(); }
  g.strokeStyle = '#4B5A74'; g.lineWidth = 8; g.strokeRect(14, 14, w - 28, h - 28); g.lineWidth = 3; g.strokeRect(30, 30, w - 60, h - 60);
  g.fillStyle = 'rgba(255,255,255,0.3)'; g.beginPath(); g.ellipse(w - 150, h / 2, 82, 100, 0, 0, 6.283); g.fill(); g.strokeStyle = '#4B5A74'; g.lineWidth = 4; g.stroke();
  g.fillStyle = '#2B3A55'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = "900 120px 'Arial Black'"; g.fillText('2000', 250, h / 2 - 22); g.font = "900 34px 'Arial Black'"; g.fillText('DUA RIBU RUPIAH', 250, h - 66);
  g.font = "900 40px 'Arial Black'"; g.textAlign = 'left'; g.fillText('2000', 44, 62); g.textAlign = 'right'; g.fillText('2000', w - 44, h - 50); }).t;
{ const face = noteFace;
  const m = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.8, 0.03), [mat('#8F98A6'), mat('#8F98A6'), mat('#8F98A6'), mat('#8F98A6'), new THREE.MeshBasicMaterial({ map: face, toneMapped: false }), mat('#8F98A6')]); m.castShadow = false; note.add(m); }
// real-scale money in the world: how Rp2.000 bills pile up (100 bills = one bundle "gepok" with a paper band)
function buildCash(count) {
  const g = new THREE.Group(); const BW = 0.62, BD = 0.29, TH = 0.0064;
  const side = new THREE.MeshStandardMaterial({ color: '#E4E8EE', roughness: 0.9 });
  const mats = [side, side, new THREE.MeshStandardMaterial({ map: noteFace, roughness: 0.85 }), side, side, side];
  const bill = new THREE.BoxGeometry(BW, TH, BD);
  const bundles = Math.floor(count / 100), rest = count - bundles * 100;
  const band = new THREE.MeshStandardMaterial({ color: '#E8D9A8', roughness: 0.8 });
  for (let b = 0; b < bundles; b++) {
    const cx = (b % 3 - 1) * (BW + 0.05), cz = -Math.floor(b / 3) * (BD + 0.05);
    const bm = new THREE.Mesh(new THREE.BoxGeometry(BW, 100 * TH, BD), mats); bm.position.set(cx, 50 * TH, cz); bm.castShadow = bm.receiveShadow = true; g.add(bm);
    const bd = new THREE.Mesh(new THREE.BoxGeometry(0.1, 100 * TH + 0.006, BD + 0.006), band); bd.position.set(cx, 50 * TH, cz); g.add(bd);
  }
  const rx = bundles ? (3 - 1) * (BW + 0.05) * 0.5 + BW + 0.12 : 0;
  if (rest > 0 && rest <= 6) {   // a few loose bills, fanned out flat
    for (let k = 0; k < rest; k++) { const m = new THREE.Mesh(bill, mats); m.position.set(0.03 * k - 0.05, TH * (k + 0.5) + 0.002, 0.08 * (k % 2) - 0.04); m.rotation.y = (k - rest / 2) * 0.35; m.castShadow = m.receiveShadow = true; g.add(m); }
  } else if (rest > 0) {   // a neat pile (one block, slightly staggered)
    const m = new THREE.Mesh(new THREE.BoxGeometry(BW, rest * TH, BD), mats); m.position.set(rx, rest * TH / 2, 0); m.rotation.y = 0.12; m.castShadow = m.receiveShadow = true; g.add(m);
    const bd = new THREE.Mesh(new THREE.BoxGeometry(0.1, rest * TH + 0.006, BD + 0.006), band); bd.position.copy(m.position); bd.rotation.y = 0.12; g.add(bd);
  }
  g.userData.count = count; return g;
}
const CASHN = { s1: 1, s2: 5, s3: 25, s4: 125, s5: 625 }; const cashG = {};
for (const k of Object.keys(CASHN)) { const c = buildCash(CASHN[k]); c.scale.setScalar(k === 's5' ? 0.62 : k === 's4' ? 0.8 : 1.05); c.position.set(k === 's5' ? -0.5 : -0.2, 0, k === 's5' ? 6.0 : 5.6); c.rotation.y = 0.25; S[k].add(c); cashG[k] = c; }

const XM = makeX({ THREE, mesh, mat, bas, tex, signBoard, scene, clamp, ease, easeOut, easeIn, lerp, pop, HX: -0.95, noteFace, sky, ground, far, applyLight, skyTex });
const X = XM.X, world = XM.world;
for (const id of Object.keys(X)) { const g = new THREE.Group(); scene.add(g); S[id] = g; X[id].build(g); g.visible = false; const n = Number(id.slice(1)) - 1; if (n >= 5 && n <= 22) { const c = XM.buildPile(n); c.position.set(0.4, 0, 5.3); c.rotation.y = 0.15; g.add(c); cashG[id] = c; } }
const car = new THREE.Group(); scene.add(car);
{ mesh(new THREE.BoxGeometry(2.4, 0.7, 1.1), mat('#E84D5C'), 0, 0.55, 0, car); mesh(new THREE.BoxGeometry(1.3, 0.55, 1.0), mat('#CFE8FF', { roughness: 0.2 }), -0.1, 1.15, 0, car); for (const x of [-0.8, 0.8]) { const w = mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.2, 14), mat('#1B1B2F'), x, 0.3, 0, car); w.rotation.x = Math.PI / 2; } }
const skid = mesh(new THREE.PlaneGeometry(1, 0.35), mat('#2B2B33'), -3.2, 0.02, 1.0); skid.rotation.x = -Math.PI / 2; skid.castShadow = false; skid.visible = false;

// ---- the story, scene by scene. A scene = TL.scenes[i]: { id, nominal, label, bar, bars }. The BIG hit is at beat 0 of its second half ("the kick").
const SC = TL.scenes.map((s) => ({ ...s, t0: B(s.bar), t1: B(s.bar + s.bars), hit: B(s.bar + s.bars / 2), mid: B(s.bar, 2) }));
const MOOD_OF = { s1: 'day', s2: 'day', s3: 'dark', s4: 'day', s5: 'day' };   // dark ONLY for the power cut in s3 (lights up after the token); every other scene is bright   // s1-s2 same place = same light; s3 power cut at night; s4-s5 stay at night (continues)
const FACE = { s1: ['determined', 'delighted'], s2: ['squint', 'panic'], s3: ['neutral', 'surprised'], s4: ['determined', 'laugh'], s5: ['neutral', 'surprised'] };
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

const HX = -0.95;   // ayam stands left, the thing it buys on the right
let curScene = null;
function stepFrame(f) {
  const t = f / FPS; ayam.update(1 / FPS);
  const sc = sceneAt(t), id = sc.id, u = t - sc.t0, uh = t - sc.hit;
  if (sc !== curScene) {   // a new scene begins on the downbeat: flash, the number rolls, the face changes
    curScene = sc; for (const k of Object.keys(S)) S[k].visible = k === id;
    const mk = MOOD_OF[id] || 'day'; sky.material.map = skyTex[mk]; ground.material.color.set(MOODS[mk][2]); applyLight(mk); far.visible = mk !== 'dark';
    const FC0 = FACE[id] || X[id].face; ayam.setExpression(FC0[0], 8); ayam.act('bounce', 0.5);
    seed = 1000 + SC.indexOf(sc);
  }
  if (!SC.length) return;
  // generic cues per scene (once each)
  const K = id + ':';
  if (id === 's4' && t >= sc.t0 + 0.55) cue(K + 'catch', 1, () => { ayam.act('wings_up', 0.7); });
  if (t >= sc.mid) cue(K + 'mid', 1, () => { ayam.setExpression((FACE[id] || X[id].face)[0], 8); ayam.act('tilt', 0.6); });
  if (t >= sc.hit) cue(K + 'hit', 1, () => { ayam.setExpression((FACE[id] || X[id].face)[1], 6); hit(id, sc, t); });
  // ----- ayam transform and props
  const g = ayam.group; let ax = 0, ay = 0, az = 0, rz = 0, ry = 0, sx = 1, sy = 1;
  const camP = { x: 0, y: 1.5, z: 13.5, ly: 0.65, fov: 34 };
  const popIn = pop(u / 0.32);
  if (id === 's1') {
    const bw = items.s1; const prog = clamp((uh) / 0.5);
    { const fly = uh > 0 ? easeOut(uh / 0.3) : 0; bw.position.set(lerp(0.85, HX + 0.15, fly), lerp(1.45 + 0.1 * Math.sin(u * 5), 1.35, fly), 1.2); bw.scale.setScalar(Math.max(0.001, popIn) * 0.8 * (uh > 0.3 ? Math.max(0.001, 1 - (uh - 0.3) / 0.3) : 1)); bw.rotation.z = Math.sin(u * 4) * 0.08; }
    ay = 0.06 * Math.abs(Math.sin(u * 6)); if (uh > 0) { sy = 1 - 0.12 * Math.exp(-6 * uh) * Math.cos(uh * 18); sx = 2 - sy; }
    S.s1.userData.cart.rotation.z = uh > 0 ? 0.08 * Math.exp(-4 * uh) * Math.sin(uh * 26) : 0; S.s1.userData.cart.position.y = uh > 0 ? 0.25 * Math.exp(-5 * uh) * Math.abs(Math.sin(uh * 16)) : 0;
  } else if (id === 's2') {
    const bt = items.s2, liq = S.s2.userData.liq, pud = S.s2.userData.pud;
    const tip = uh > 0 ? ease(uh / 0.35) : 0;
    bt.position.set(0.85 - 0.4 * tip, lerp(1.2 + 0.1 * Math.sin(u * 5), 0.5, tip), 1.0); bt.scale.setScalar(Math.max(0.001, popIn)); bt.rotation.z = -1.5 * tip + 0.05 * Math.sin(u * 7);
    liq.scale.y = uh > 0 ? Math.max(0.05, 1 - ease(uh / 1.2) * 0.9) : 1;
    pud.scale.setScalar(uh > 0.2 ? 0.1 + easeOut((uh - 0.2) / 1.2) * 2.3 : 0.001); pud.position.set(0.3, 0.02, 1.0);
    if (uh > 0.25) { const sl = clamp((uh - 0.25) / 0.8); ax = 0.5 * sl * Math.exp(-2.2 * sl); rz = -0.55 * Math.sin(sl * 3.14) * (1 - sl * 0.2); ay = 0.5 * Math.sin(clamp(sl) * 3.14) * (1 - sl); }
    else ay = 0.05 * Math.abs(Math.sin(u * 6));
  } else if (id === 's3') {
    const mb = items.s3, lamps = S.s3.userData.lamps; const on = uh > 0 ? easeOut(uh / 0.4) : 0;
    mb.position.set(0.85, 1.05 + 0.06 * Math.sin(u * 4), 1.2); mb.scale.setScalar(Math.max(0.001, popIn) * 0.95 * (uh > 0 ? 1 + 0.1 * Math.exp(-6 * uh) * Math.cos(uh * 24) : 1)); mb.rotation.y = Math.sin(u * 2.6) * 0.18;
    lamps.forEach((l, i2) => { const lit = uh > i2 * 0.14; l.bulb.visible = lit; l.light.intensity = lit ? 14 : 0; });
    sky.material.map = on > 0.05 ? skyTex.gold : skyTex.dark; ground.material.color.set(on > 0.05 ? MOODS.gold[2] : MOODS.dark[2]); far.visible = on > 0.05; applyLight('dark', 'gold', on);
    if (uh > 0) { ay = 0.1 * Math.exp(-5 * uh) * Math.abs(Math.sin(uh * 16)); sy = 1 + 0.05 * Math.exp(-6 * uh) * Math.cos(uh * 20); sx = 2 - sy; } else ay = 0.04 * Math.abs(Math.sin(u * 6));
  } else if (id === 's4') {
    const [L, R] = items.s4; const run = uh > 0 ? uh : 0;
    // the pair falls from above (staggered), ayam catches them in its wings at u = 0.55 and holds them
    const fall = (k, d) => clamp((u - d) / 0.4), yc = 0.72, held = 0.04 * Math.sin(u * 7);
    const yL = u < 0.15 ? 6 : lerp(6, yc, easeIn(fall(0, 0.15))) + (fall(0, 0.15) >= 1 ? held : 0), yR = u < 0.25 ? 6 : lerp(6, yc - 0.12, easeIn(fall(1, 0.25))) + (fall(1, 0.25) >= 1 ? held : 0);
    L.position.set(HX + 1.0, yL, 1.5); R.position.set(HX + 1.45, yR, 1.35);
    L.rotation.set(0, -0.35, (1 - fall(0, 0.15)) * 3.2 + 0.1); R.rotation.set(0, -0.35, (1 - fall(1, 0.25)) * -3.2 + 0.05);
    L.visible = R.visible = u > 0.12;
    if (run > 0) { const feet = run < 1.6; L.visible = R.visible = feet; L.scale.setScalar(0.45); R.scale.setScalar(0.45); L.rotation.set(0, 0, 0); R.rotation.set(0, 0, 0); const ox = HX + ax; L.position.set(ox - 0.17, ay + 0.02, 0.4); R.position.set(ox + 0.17, ay + 0.02, 0.4); } else { L.scale.setScalar(1.05); R.scale.setScalar(1.05); }
    if (run > 0) { const out = run < 0.5 ? -Math.pow(run / 0.5, 2.2) * 6.5 : (run < 0.95 ? -6.5 : 6.5 * Math.pow(1 - clamp((run - 0.95) / 0.55), 2)); ax = out; ry = run < 0.95 ? -0.9 : 0.0; rz = 0.12 * Math.sin(run * 44) * (run < 1.5 ? 1 : 0); ay = run < 1.5 ? 0.2 * Math.abs(Math.sin(run * 36)) : 0; if (run > 1.5) { sy = 1 + 0.08 * Math.exp(-8 * (run - 1.5)) * Math.cos((run - 1.5) * 24); } }
    else { ay = 0; }
  } else if (id === 's5') {
    const bk = items.s5, wh = S.s5.userData.wheels; let bx = 0.85, spin = 0;
    if (uh > 0) { if (uh < 0.8) bx = 0.85 - 7.2 * Math.pow(uh / 0.8, 2); else if (uh < 1.0) bx = -6.5; else bx = lerp(6.5, 0.85, easeOut(clamp((uh - 1.0) / 0.65))); }
    bk.position.set(bx, 0, 1.7 - (uh > 0 && uh < 0.9 ? 0.5 : 0)); bk.scale.setScalar(Math.max(0.001, popIn) * 0.9); bk.rotation.z = (uh > 0.8 && uh < 1.65) ? 0.0 : (uh > 0 ? -0.06 : 0); spin = -bx * 2.2; wh.forEach((w) => { w.rotation.z = spin; });
    S.s5.userData.sign.visible = !(uh > 0.05 && uh < 1.5); bk.position.y = uh > 0 ? 0.05 * Math.abs(Math.sin(uh * 30)) : 0.04 * Math.abs(Math.sin(u * 5));
    if (uh > 0.8 && uh < 1.7) { camP.fov = 34; }
    if (uh > 0) { ax = 0.15 * Math.exp(-3 * uh); sx = 1 + 0.03 * Math.sin(uh * 30) * Math.exp(-uh); }
    
  }
  let xr = {};
  if (X[id]) { xr = X[id].anim(u, uh, S[id], pop(u / 0.32), t) || {}; ay = xr.ay !== undefined ? xr.ay : 0.05 * Math.abs(Math.sin(u * 6)) + (uh > 0 ? 0.1 * Math.exp(-5 * uh) * Math.abs(Math.sin(uh * 16)) : 0); if (uh > 0 && id !== 's14') { sy = 1 + 0.06 * Math.exp(-6 * uh) * Math.cos(uh * 20); sx = 2 - sy; } world.set(id, u, uh, t, xr); }
  { const bp = Math.exp(-9 * ((((t - OFF) % BEAT) + BEAT) % BEAT)); sy *= 1 + 0.035 * bp; sx *= 1 - 0.015 * bp; }
  g.position.set(HX + ax, ay, az); g.rotation.z = rz; g.rotation.y = ry; g.scale.set(sx, sy, 1);
  ayam.lookAt?.(0, 0.1); // eyes toward the camera
  // ----- camera: slow push-in per scene, kick on the hit
  const push = clamp(u / (sc.t1 - sc.t0)), Z0 = camP.z;
  const cam = { x: 0, y: camP.y, z: Z0, lx: 0, ly: camP.ly, fov: camP.fov, roll: 0 };
  if (id === 's1') { const p = uh > 0 ? Math.exp(-3.2 * uh) : 0; cam.z = Z0 - 2.2 * easeOut(push) - 2.4 * p; cam.x = -0.5 + 0.7 * push; cam.fov = 34 - 6 * p; cam.lx = -0.5 * p; cam.ly = lerp(camP.ly, 1.15, p); }
  if (id === 's2') { cam.y = 0.9 + 0.8 * easeOut(push); cam.ly = 1.5; cam.z = Z0 - 1.0 * push; const sl = uh > 0.2 ? clamp((uh - 0.2) / 0.9) : 0; cam.roll = 0.09 * Math.sin(sl * Math.PI); cam.x = 0.4 * sl; }
  if (id === 's3') { const p = uh > 0 ? easeOut(uh / 0.7) : 0; cam.z = Z0 - 0.8 + 3.0 * p; cam.y = camP.y + 1.0 * p; cam.fov = 32 + 4 * p; }
  if (id === 's4') { cam.z = Z0 - 1.2 * easeOut(push); if (uh > 0 && uh < 1.0) { const p = clamp(uh / 0.5); cam.x = -2.6 * easeOut(p) * (uh < 0.6 ? 1 : 1 - clamp((uh - 0.6) / 0.4)); cam.fov = 34 + 3 * Math.sin(Math.min(1, uh) * Math.PI); } }
  if (id === 's5') { const bxp = items.s5.position.x; cam.x = uh > 0 ? clamp(bxp * 0.5, -3.2, 1.5) * 0.7 : 0.2 * push; cam.lx = cam.x; cam.z = Z0 - 1.5 * easeOut(push); cam.roll = uh > 0 && uh < 0.9 ? -0.05 : 0; }
  if (X[id]) { cam.z = Z0 - 1.0 * easeOut(push); cam.y = camP.y + (xr.camY || 0); cam.ly = camP.ly + (xr.camLy || 0); if (uh > 0 && uh < 0.3) cam.fov = 34 + 2 * Math.sin(uh / 0.3 * Math.PI); }
  let sxk = 0, syk = 0; { const s = t - shakeT; if (s >= 0 && s < 0.7) { const a = shakeAmp * Math.exp(-5 * s); sxk = Math.sin(s * 70) * a; syk = Math.cos(s * 83) * a * 0.7; } }
  camera.position.set(cam.x + sxk, cam.y + syk, cam.z); camera.lookAt(cam.lx, cam.ly + 0.7, 0); camera.rotateZ(cam.roll); camera.fov = cam.fov; camera.updateProjectionMatrix();
  { const on = (id === 's4' && uh > 0 && uh < 1.0) || (id === 's5' && uh > 0 && uh < 0.95); streaks.forEach((m, i2) => { m.visible = on; if (!on) return; const k = (t * 11 + i2 * 0.37) % 2.4; m.position.x = (k - 1.2) * HW; m.position.y = (((i2 * 0.6180339) % 1) - 0.5) * HH * 0.8; m.scale.x = 0.6 + 0.8 * ((i2 * 0.31) % 1); }); }
  // ----- hud
  const HOOK_END = SC[0].t0; const inHook = t < HOOK_END; hookP.visible = inHook; if (inHook) { drawHook(t); hookP.scale.setScalar(Math.max(0.01, pop(t / 0.35)) * (1 - 0.9 * clamp((t - (HOOK_END - 0.2)) / 0.2))); } const isOut = id === 's24'; nomP.visible = !inHook && !isOut; lblP.visible = !inHook && !isOut; fmP.visible = !inHook && !isOut && SC.indexOf(sc) >= 1; outP.visible = !inHook && isOut; if (isOut) drawOut(t, sc.t0); for (const k of Object.keys(S)) S[k].visible = !inHook && k === id; ayam.group.visible = !inHook; car.visible = !inHook && id !== 's3' && !X[id];
  const nm = nominalAt(t); drawNominal(nm.v, nm.glow, nm.k < 1); const uN = u; const sNom = 1 + 0.18 * Math.exp(-9 * Math.max(0, uN)) * Math.cos(Math.max(0, uN) * 20); nomP.scale.setScalar(Math.max(0.5, sNom));
  drawLabel(sc, clamp((u - 0.2) / 0.15) * (1 - clamp((t - (sc.t1 - 0.1)) / 0.1))); if (!inHook && fmP.userData.lastScene !== sc.id) { fmP.userData.lastScene = sc.id; const ix = SC.indexOf(sc); if (ix >= 1) drawFormula(ix, sc.nominal); }
  { const ix = SC.indexOf(sc); const bp = Math.exp(-8 * ((((t - OFF) % BEAT) + BEAT) % BEAT)), tt = t - sc.t0; if (!inHook && ix >= 1) drawFormula(ix, sc.nominal, tt, sc.nominal, bp);
    const giant = !inHook && ix >= 2 && tt >= 0 && tt < LAND; expP.visible = giant;
    if (giant) { drawGiant(ix, tt); const ep = fmP.userData.expPos || { x: 300, cy: 160 }, k = easeIn(clamp((tt - 0.78) / (LAND - 0.78))), pp = easeOut(clamp(tt / 0.14)), sc2 = lerp(1, 0.1, k), K = PW / 1024;
      const tx = fmP.position.x - PW / 2 + ep.x * K, ty = fmP.position.y + (110 - ep.cy) * K, sx = -HW * 0.02, sy = HH * 0.1; expP.position.set(lerp(sx, tx, k), lerp(sy, ty, k), -HD); expP.scale.setScalar(Math.max(0.01, sc2 * (0.4 + 0.6 * pp))); }  }
  { const tu = u - 0.0; if (tu >= 0 && tu < 0.9 && sc !== SC[0] && id !== 's24') { drawTag('×5'); tagP.scale.setScalar(Math.max(0.01, pop(tu / 0.3))); tagP.visible = true; } else { tagP.visible = false; } }
  { const nu = t - SC[0].t0; note.visible = nu >= 0 && nu < 0.5; const fl = clamp((nu - 0.2) / 0.28); note.position.set(lerp(0.85, 1.2, easeOut(fl)), lerp(1.7, 1.3, easeOut(fl)) + 0.06 * Math.sin(t * 4), lerp(1.2, -2.2, easeOut(fl))); note.scale.setScalar(Math.max(0.001, 0.8 * pop(nu / 0.2) * (1 - fl * 0.85))); note.rotation.set(0, Math.sin(t * 2.4) * 0.2, Math.sin(t * 3) * 0.06 + fl * 1.5); }
  crowd.forEach((f, i2) => { const d = f.userData; const x = ((((t * d.sp * d.dir + d.off) % 24) + 24) % 24) - 12; f.position.set(x, 0.05 * Math.abs(Math.sin(t * 9 + i2)) + (uh > 0 && uh < 0.7 ? 0.28 * Math.abs(Math.sin(uh * 14 + i2)) : 0), d.z); f.visible = !inHook && (id !== 's3' || uh > 0.2) && (!X[id] || (X[id].mood === 'day' && id !== 's10')); });
  // environment that is always alive: a car crossing far behind, the skyline drifting, steam from the cart, skid marks after the sprint
  car.visible = !inHook && id !== 's3' && !X[id]; car.position.set(((t * 3.2 + 6) % 26) - 13, 0, -6.5); far.position.x = -0.12 * t;
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
  { const cg = cashG[id]; if (cg) { const cu = clamp((t - sc.t0 - 0.15) / 0.3); cg.visible = t >= SC[0].t0 && cu > 0; cg.scale.y = cg.userData.sy = 1; const bs = (cg.userData.base ||= cg.scale.x); cg.scale.setScalar(bs * (cu < 1 ? easeOut(cu) * 1.1 : 1 + 0.08 * Math.exp(-6 * Math.max(0, t - sc.hit)) * Math.sin(Math.max(0, t - sc.hit) * 30))); } }
  const h = sc.hit; const A = { s1: 'nod', s2: 'panic', s3: 'wings_up', s4: 'cheer', s5: 'jolt' }; ayam.act(A[id] || X[id].act, 0.9);
  if (X[id]) { const b = X[id].burst; burst(h, b.p, b.n, b.c, b.s, b.z, { life: 1.1, g: b.g ?? 9 }); if (X[id].shake) shake(h, X[id].shake); flash(h, 0.12, 0.1); }
  if (id === 's1') { burst(h, [HX + 0.4, 1.4, 1.4], 26, ['#FFC83D', '#E0952E', '#FFF3C4'], 4.2, 0.12, { life: 1.0 }); shake(h, 0.05); }
  if (id === 's2') { burst(h, [0.9, 0.7, 1.0], 28, ['#3DD672', '#B6FFD0', '#2FCB68'], 4.0, 0.14, { life: 1.2, g: 10 }); shake(h, 0.12); }
  if (id === 's3') { burst(h, [0.85, 1.5, 1.4], 26, ['#FFE9A8', '#FFFFFF', '#6CFF9A'], 4.5, 0.12, { g: 3, life: 1.2 }); shake(h, 0.1); flash(h, 0.15, 0.12); }
  if (id === 's4') { burst(h, [HX, 0.2, 0.9], 40, ['#E8D7B8', '#CDBA95', '#F5EDDC'], 5.5, 0.28, { g: 3, life: 1.2, up: 0.25 }); shake(h, 0.22); }
  if (id === 's5') { burst(h, [0.4, 0.2, 1.4], 40, ['#E8D7B8', '#CDBA95', '#F5EDDC'], 5.5, 0.26, { g: 3, life: 1.2, up: 0.3 }); burst(h + 1.65, [0.85, 0.2, 1.4], 30, ['#E8D7B8', '#CDBA95', '#F5EDDC'], 4, 0.22, { g: 3, life: 1.0, up: 0.3 }); shake(h, 0.12); }
}
// a scene's previous number (for the roll)
SC.forEach((s, i) => { s.prevNominal = i ? SC[i - 1].nominal : s.nominal; });

window.uang = { stepFrame, ayam, scene, camera, SC, TOTAL };
const frames = Math.ceil(TOTAL * FPS);
const composer = new EffectComposer(renderer); composer.setPixelRatio(1); composer.setSize(W, H);
composer.addPass(new RenderPass(scene, camera));
const bokeh = new BokehPass(scene, camera, { focus: 13, aperture: 0.0016, maxblur: 0.02 }); composer.addPass(bokeh);
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 0.14, 0.5, 0.97));
composer.addPass(new ShaderPass({
  uniforms: { tDiffuse: { value: null }, amount: { value: 0.45 }, v0: { value: 0.3 }, v1: { value: 0.88 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: 'uniform sampler2D tDiffuse; uniform float amount; uniform float v0; uniform float v1; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); float d = distance(vUv, vec2(0.5)); c.rgb *= 1.0 - amount * smoothstep(v0, v1, d); gl_FragColor = c; }',
}));
composer.addPass(new OutputPass());
const FOCUS = new THREE.Vector3();
const draw = () => { bokeh.uniforms.focus.value = camera.position.distanceTo(FOCUS.set(HX, 1.2, 0)); composer.render(); renderer.autoClear = false; renderer.render(hudScene, hudCam); renderer.autoClear = true; };
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
