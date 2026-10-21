// A simple, good-enough character built ONLY from the numbers in character.json "look" (no code to write for a basic character).
// Copy this whole folder to characters/<your-id>/, edit character.json, and (only if you want a different shape) edit this file.
//
// The kit's character contract (every rig, simple or fancy, exports this):
//   export function create(renderer, { rand, W, H, config }) -> {
//     group,                          // a THREE.Group, its origin at the feet, about 1.9 units tall (the world scales it)
//     setExpression(name, speed),     // one of character.json "expressions"
//     setTalkLevel(v),                // 0..1, how open the mouth is right now (the kit sets it every frame from the voice)
//     look(x, y),                     // -1..1 where the eyes look
//     update(dt),                     // every frame (blink, breathing)
//     freeze?()                       // optional: stop random motion (used for stills)
//   }
import * as THREE from 'three';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;

// what each expression does to the face: lid 0..1 (the eye closes), brow (raise) and tilt (negative = angry, positive = sad), mouth (open) and wide, eye size
export const EXPRESSIONS = {
  neutral: { lid: 0.0, brow: 0.0, tilt: 0.0, mouth: 0.0, wide: 1.0, eye: 1.0 },
  happy: { lid: 0.25, brow: 0.12, tilt: 0.0, mouth: 0.35, wide: 1.4, eye: 1.0 },
  sad: { lid: 0.3, brow: 0.05, tilt: 0.5, mouth: 0.0, wide: 0.7, eye: 1.1 },
  angry: { lid: 0.35, brow: -0.05, tilt: -0.55, mouth: 0.0, wide: 1.1, eye: 0.95 },
  surprised: { lid: 0.0, brow: 0.22, tilt: 0.0, mouth: 0.55, wide: 0.8, eye: 1.25 },
  sleepy: { lid: 0.65, brow: -0.02, tilt: 0.15, mouth: 0.0, wide: 0.9, eye: 1.0 },
};

export function create(renderer, { rand = Math.random, config = {} } = {}) {
  const L = { bodyColor: '#F2C9A0', bellyColor: '#FFE9CF', accentColor: '#E8645A', eyeColor: '#1B1B26', width: 0.85, height: 0.85, ears: 'round', tail: true, cheeks: true, ...(config.look || {}) };
  const group = new THREE.Group();
  const mat = (c, r = 0.9) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0 });   // matte on purpose: shiny characters look cheap
  const body = mat(L.bodyColor), belly = mat(L.bellyColor), accent = mat(L.accentColor), dark = mat(L.eyeColor, 0.4), white = mat('#FFFFFF', 0.5);
  const add = (geo, m, x, y, z, sx = 1, sy = 1, sz = 1, parent = group) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = true; parent.add(o); return o; };
  const sph = new THREE.SphereGeometry(1, 40, 28), cone = new THREE.ConeGeometry(1, 1, 24);

  const root = new THREE.Group(); group.add(root);   // breathes and bobs
  const torso = add(sph, body, 0, 0.95, 0, L.width, L.height, L.width * 0.95, root);
  add(sph, belly, 0, 0.78, L.width * 0.55, L.width * 0.62, L.height * 0.62, L.width * 0.4, root);
  if (L.cheeks) { add(sph, accent, -0.5 * L.width, 0.92, 0.62 * L.width, 0.13, 0.08, 0.05, root).material = mat(L.accentColor, 1); add(sph, accent, 0.5 * L.width, 0.92, 0.62 * L.width, 0.13, 0.08, 0.05, root); }
  add(sph, body, -0.32, 0.12, 0.2, 0.22, 0.12, 0.3, root); add(sph, body, 0.32, 0.12, 0.2, 0.22, 0.12, 0.3, root);   // feet
  add(sph, body, -L.width * 0.98, 0.8, 0.1, 0.16, 0.26, 0.2, root); add(sph, body, L.width * 0.98, 0.8, 0.1, 0.16, 0.26, 0.2, root);   // arms
  if (L.ears === 'round') { add(sph, body, -0.48, 1.62, -0.05, 0.22, 0.26, 0.14, root); add(sph, body, 0.48, 1.62, -0.05, 0.22, 0.26, 0.14, root); }
  else if (L.ears === 'pointy') { const a = add(cone, body, -0.42, 1.78, -0.02, 0.2, 0.55, 0.14, root); a.rotation.z = 0.25; const b = add(cone, body, 0.42, 1.78, -0.02, 0.2, 0.55, 0.14, root); b.rotation.z = -0.25; }
  if (L.tail) add(sph, accent, 0, 0.55, -L.width * 0.95, 0.18, 0.18, 0.28, root);

  // the face
  const eyes = [-1, 1].map((s) => {
    const g = new THREE.Group(); g.position.set(s * 0.32, 1.12, 0.7 * L.width); root.add(g);
    const ball = add(sph, white, 0, 0, 0, 0.215, 0.25, 0.1, g);
    const pupil = add(sph, dark, 0, 0, 0.09, 0.115, 0.14, 0.05, g);
    const brow = add(sph, dark, 0, 0.3, 0.06, 0.13, 0.026, 0.03, g);
    return { g, s, ball, pupil, brow };
  });
  const mouth = add(sph, dark, 0, 0.78, 0.84 * L.width, 0.1, 0.02, 0.04, root);
  mouth.castShadow = false;

  let target = { ...EXPRESSIONS.neutral }, st = { ...EXPRESSIONS.neutral }, rate = 9, talk = 0, gx = 0, gy = 0, blink = 0, nextBlink = 2 + rand() * 2, t = 0, frozen = false;
  function setExpression(name, speed = 9) {
    const e = EXPRESSIONS[name];
    if (!e) throw new Error(`unknown expression '${name}' (${Object.keys(EXPRESSIONS).join(', ')})`);
    target = { ...e }; rate = speed >= 100 ? 1000 : speed;
  }
  function update(dt) {
    t += dt;
    const k = 1 - Math.exp(-rate * dt);
    for (const key of Object.keys(target)) st[key] = lerp(st[key], target[key], k);
    if (!frozen) { nextBlink -= dt; if (nextBlink <= 0) { blink = 1; nextBlink = 2.2 + rand() * 3; } blink = Math.max(0, blink - dt * 9); }
    const closed = Math.max(st.lid, blink > 0 ? Math.sin(Math.min(1, blink) * Math.PI) : 0);
    for (const e of eyes) {
      e.g.scale.set(st.eye, st.eye * (1 - closed * 0.9), st.eye);   // a closing eye is a squashed one: simple and it reads well
      e.pupil.position.x = gx * 0.08; e.pupil.position.y = gy * 0.07;
      e.brow.position.y = 0.34 + st.brow * 0.6;
      e.brow.scale.y = 0.026 / Math.max(0.2, 1 - closed * 0.9);   // keep the brow's thickness while the eye squashes
      e.brow.rotation.z = -e.s * st.tilt * 0.6;
    }
    const open = clamp(Math.max(st.mouth, talk * 0.9));
    mouth.scale.set(0.13 * st.wide, 0.025 + open * 0.14, 0.05);
    if (!frozen) { root.position.y = Math.sin(t * 1.6) * 0.012; root.rotation.z = Math.sin(t * 0.8) * 0.01; }
    torso.scale.y = L.height * (1 + Math.sin(t * 1.6) * (frozen ? 0 : 0.006));
    root.rotation.y = lerp(root.rotation.y, gx * 0.12, 1 - Math.exp(-6 * dt));
  }
  return {
    group, EXPRESSIONS, update, setExpression,
    setTalkLevel: (v) => { talk = clamp(v ?? 0); },
    look: (x, y) => { gx = clamp(x, -1, 1); gy = clamp(y, -1, 1); },
    freeze: (on = true) => { frozen = on; blink = 0; },
  };
}
