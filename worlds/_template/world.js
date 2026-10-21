// A simple outdoor world built ONLY from the numbers in world.json "look": ground, sky, trees, bushes, rocks, a sun or moon, stars, and a log the two characters sit on.
// Copy this whole folder to worlds/<your-id>/, edit world.json, and (only for something different, like a beach or a spaceship) edit this file.
//
// The kit's world contract: export async function createWorld(scene, cfg) -> {
//   group,                     // everything of the world (a THREE.Group already added to the scene)
//   stage: { y, z, scale, left: { x, yaw }, right: { x, yaw } },   // where the two characters stand (y = the top of what they sit on)
//   shots: { wide, left, right, right34, ... },                     // camera shots { pos, look, fov } (optional; a fallback exists)
//   lighting,                  // from createLighting(group, { base: cfg.base, face, light: cfg.light })   (web/lib/lighting.js)
//   update(t),                 // every frame: wind, clouds, anything that moves
//   // optional features, only if world.json "features" says so: screen, phone, outside
// }
// cfg: { base, bg, light, pages, phone, wall, props, outside, episode }
import * as THREE from 'three';
import { extraShots } from '../../web/lib/shots.js';
import { createLighting } from '../../web/lib/lighting.js';

const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const std = (color, rough = 0.95) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 });

export async function createWorld(scene, cfg) {
  const info = await fetch(new URL('./world.json', import.meta.url)).then((r) => r.json());
  const K = { groundColor: '#2E4A3A', skyTop: '#0A1238', skyBottom: '#4A5C9C', fog: '#10182E', fogDensity: 0.012, trees: 14, treeColor: '#14281E', bushes: 10, rocks: 6, sun: null, stars: 160, seatColor: '#5A3E2B', ...(info.look || {}) };
  const group = new THREE.Group(); scene.add(group);
  const R = rng(777);
  const updaters = [];
  scene.background = new THREE.Color(K.skyTop);
  scene.fog = new THREE.FogExp2(K.fog, K.fogDensity);

  const ground = new THREE.Mesh(new THREE.CircleGeometry(80, 48), std(K.groundColor)); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; group.add(ground);
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(260, 120), new THREE.MeshBasicMaterial({ map: gradientTexture(K.skyTop, K.skyBottom), toneMapped: false })); sky.position.set(0, 30, -90); group.add(sky);
  if (K.stars) {
    const n = K.stars, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = -90 + R() * 180; pos[i * 3 + 1] = 12 + R() * 50; pos[i * 3 + 2] = -88; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    group.add(new THREE.Points(g, new THREE.PointsMaterial({ color: '#FFFFFF', size: 0.4, transparent: true, opacity: 0.85, depthWrite: false })));
  }
  if (K.sun) { const d = new THREE.Mesh(new THREE.CircleGeometry(K.sun.size ?? 5, 40), new THREE.MeshBasicMaterial({ color: K.sun.color ?? '#F4F0E0', toneMapped: false })); d.position.set(K.sun.x ?? 22, K.sun.y ?? 24, -85); group.add(d); }

  // the log the characters sit on: its top is the stage
  const SEAT_Y = 0.9;
  const log = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 7, 24), std(K.seatColor)); log.rotation.z = Math.PI / 2; log.position.set(0, SEAT_Y - 0.9, 0.5); log.castShadow = log.receiveShadow = true; group.add(log);

  for (let i = 0; i < K.trees; i++) {   // a ring of tree silhouettes, never in front of the stage
    const x = -45 + R() * 90, z = -12 - R() * 50, s = 0.8 + R() * 1.4;
    const t = new THREE.Group(); t.position.set(x, 0, z);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25 * s, 0.35 * s, 3 * s, 8), std('#2A1E16')); trunk.position.y = 1.5 * s; t.add(trunk);
    for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(new THREE.ConeGeometry((2.2 - k * 0.5) * s, 3 * s, 10), std(K.treeColor)); c.position.y = (3.2 + k * 1.6) * s; c.castShadow = true; t.add(c); }
    group.add(t); const ph = R() * 6.28; updaters.push((tt) => { t.rotation.z = Math.sin(tt * 0.6 + ph) * 0.012; });
  }
  for (let i = 0; i < K.bushes; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.6 + R() * 0.7, 12, 10), std(K.treeColor)); b.position.set(-12 + R() * 24, 0.3, -3 - R() * 8); b.scale.y = 0.7; group.add(b); }
  for (let i = 0; i < K.rocks; i++) { const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4 + R() * 0.5), std('#4A4F5C')); r.position.set(-10 + R() * 20, 0.2, -1 - R() * 7); r.rotation.set(R() * 3, R() * 3, R() * 3); r.castShadow = true; group.add(r); }

  const stage = { y: SEAT_Y, z: 0.5, scale: 0.95, left: { x: -1.35, yaw: 0.35 }, right: { x: 1.4, yaw: -0.18 } };
  const face = new THREE.Vector3(stage.left.x, stage.y + 1.05, stage.z);
  const lighting = await createLighting(group, { base: cfg.base, face, light: cfg.light });
  const dy = stage.y - 0.2, dz = stage.z - 0.7;
  // the one small moment of the story: a falling star across the sky (episode.json "outside": { "type": "star", "at": "end+1.4", "dur": 3.0 })
  const starG = new THREE.Group(); starG.visible = false; group.add(starG);
  const dot = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), new THREE.MeshBasicMaterial({ map: radial('255,255,255'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); starG.add(dot);
  const tail = new THREE.Mesh(new THREE.PlaneGeometry(12, 0.3), new THREE.MeshBasicMaterial({ map: trail(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); tail.position.x = 6; starG.add(tail);
  const starLight = new THREE.PointLight('#BFD8FF', 0, 60, 2); group.add(starLight);
  const outside = {
    event(type, u) {
      const on = u > 0 && u < 1, e = Math.sin(Math.PI * Math.max(0, Math.min(1, u)));
      starG.visible = type === 'star' && on; starLight.intensity = 0;
      if (starG.visible) { const x = -26 + 54 * u, y = 24 - 9 * u; starG.position.set(x, y, -75); starG.rotation.z = Math.atan2(-9, 54); starG.scale.setScalar(0.7 + 0.5 * e); starLight.intensity = 9 * e; starLight.position.set(x * 0.4, y * 0.6, -30); }
    },
  };
  return {
    group, stage, lighting, outside,
    shots: {
      ...extraShots(stage),
      wide: { pos: [0.0, 1.95 + dy + 0.5, 13.6], look: [0, 1.25 + dy + 0.9, dz], fov: 46 },
      left: { pos: [-0.3, 1.7 + dy, 10.5], look: [-1.35, 1.5 + dy, 0.7 + dz], fov: 24 },
      right: { pos: [0.8, 1.7 + dy, 13], look: [1.4, 1.1 + dy, 0.7 + dz], fov: 24 },
      right34: { pos: [4.8, 1.9 + dy, 10.5], look: [1.4, 1.0 + dy, 0.7 + dz], fov: 26 },
    },
    update: (t) => updaters.forEach((u) => u(t)),
  };
}

function gradientTexture(top, bottom) {
  const c = document.createElement('canvas'); c.width = 32; c.height = 512;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, top); gr.addColorStop(1, bottom); g.fillStyle = gr; g.fillRect(0, 0, 32, 512);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function radial(rgb) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function trail() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 16;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 256, 0); gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(1, 'rgba(160,200,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 16);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
