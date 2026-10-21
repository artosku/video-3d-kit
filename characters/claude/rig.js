// The Claude mascot ("Clawd") as a three.js rig, built from its pixel sprite so the proportions match the original.
// Flat faces and sharp edges on purpose: it is a pixel character pushed out into 3D, not a rounded toy.
//
// Sprite grid (12 x 8 cells, one cell = U units), from the open ClawdMoji sprite:
//   ..########..      body: 8 wide, 6 tall (rows 0-5)
//   ..#O####O#..      eyes: one cell each, row 1 (the video makes them tall rectangles)
//   ############      arms: the side bumps, 2 cells wide, rows 2-3
//   ############
//   ..########..
//   ..########..
//   ..#.#..#.#..      legs: 4, one cell wide, 2 tall (columns 2, 4, 7, 9)
//   ..#.#..#.#..
// The character belongs to Anthropic; this is an unofficial fan model.
//
//   const claude = createClaude();
//   scene.add(claude.group);
//   claude.setExpression('deadpan');   // deadpan | smug | worried | wow | sleepy
//   claude.talk(true);                 // small bounces and arm wiggles while "speaking"
//   claude.look(x, y);                 // eyes, -1..1
//   claude.update(dt);
import * as THREE from 'three';

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;

export const CLAUDE_EXPRESSIONS = {
  deadpan: { eyeH: 1.0, eyeGap: 1.0, tilt: 0, lean: 0, arm: 0.0, squash: 1 },
  smug: { eyeH: 0.55, eyeGap: 1.04, tilt: 0.04, lean: 0.02, arm: 0.2, squash: 1 },
  worried: { eyeH: 1.25, eyeGap: 0.94, tilt: -0.05, lean: -0.04, arm: -0.05, squash: 0.97 },
  wow: { eyeH: 1.45, eyeGap: 1.0, tilt: 0, lean: 0.0, arm: 0.7, squash: 1.04 },
  sleepy: { eyeH: 0.3, eyeGap: 1.0, tilt: 0.06, lean: -0.04, arm: 0.0, squash: 0.96 },
};

const U = 0.25;           // one sprite cell
const BODY_W = 8 * U, BODY_H = 6 * U, BODY_D = 5 * U;
const LEG_H = 2 * U;

export function createClaude({ rand = Math.random } = {}) {   // rand: a seeded generator, so the blinks never depend on how many objects were created
  const group = new THREE.Group();
  group.name = 'Claude';
  const root = new THREE.Group();
  group.add(root);

  // matte, flat colours: no gloss, no environment reflections
  const mat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0, flatShading: true, envMapIntensity: 0 });
  const orange = mat('#DA7758');
  const black = mat('#0B0A0D');
  const box = (w, h, d, m, castShadow = true) => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    o.castShadow = castShadow;
    o.receiveShadow = true;
    return o;
  };

  // body, arms and eyes move together (squash and lean around the hips)
  const bodyPivot = new THREE.Group();
  bodyPivot.position.y = LEG_H;
  root.add(bodyPivot);
  const body = box(BODY_W, BODY_H, BODY_D, orange);
  body.position.y = BODY_H / 2;
  bodyPivot.add(body);

  // eyes: sprite cell is square; the video draws them as tall rectangles, so 1 cell wide and 1.5 tall
  const eyes = [];
  for (const s of [-1, 1]) {
    const e = box(U, 1.5 * U, 0.05, black, false);
    e.position.set(s * 2.5 * U, BODY_H - 1.75 * U, BODY_D / 2 + 0.024);
    bodyPivot.add(e);
    eyes.push(e);
  }

  // arms: 2 cells wide, 2 tall, hinged at the shoulder
  const arms = [];
  for (const s of [-1, 1]) {
    const piv = new THREE.Group();
    piv.position.set(s * BODY_W / 2, BODY_H - 3 * U, 0);
    const a = box(2 * U, 2 * U, 3 * U, orange);
    a.position.x = s * U;
    piv.add(a);
    bodyPivot.add(piv);
    arms.push({ piv, s });
  }

  // four legs: columns 2, 4, 7, 9 of the 12-cell row
  const legs = [];
  for (const cx of [-3.5, -1.5, 1.5, 3.5]) {
    const l = box(U, LEG_H, 1.5 * U, orange);
    l.position.set(cx * U, LEG_H / 2, 0);
    root.add(l);
    legs.push(l);
  }

  const st = { ...CLAUDE_EXPRESSIONS.deadpan };
  let target = { ...CLAUDE_EXPRESSIONS.deadpan };
  let t = 0;
  let talking = false;
  let level = null; // loudness of the real voice (0..1); null = off
  let blink = 0;
  let blinkAt = 3.1;
  const gaze = { x: 0, y: 0 };

  function update(dt) {
    t += dt;
    const k = 1 - Math.exp(-9 * dt);
    for (const key in st) st[key] = lerp(st[key], target[key], k);
    if (t > blinkAt) { blink = 1; blinkAt = t + 2.5 + rand() * 3.5; }
    blink = Math.max(0, blink - dt / 0.12);
    const breathe = 1 + 0.01 * Math.sin(t * 2.0);
    const talkK = level !== null ? level : (talking ? 0.5 + 0.5 * Math.abs(Math.sin(t * 9.5) * Math.sin(t * 3.7 + 1)) : 0);
    const sy = st.squash * breathe * (1 - 0.03 * talkK);
    bodyPivot.scale.set(1 / Math.sqrt(st.squash), sy, 1 / Math.sqrt(st.squash));
    bodyPivot.rotation.z = st.tilt;
    bodyPivot.rotation.x = st.lean;
    bodyPivot.position.y = LEG_H + 0.025 * talkK; // a small bounce on each syllable
    for (const e of eyes) {
      const h = Math.max(0.06, st.eyeH * (1 - 0.92 * blink));
      e.scale.set(1, h, 1);
      e.position.x = Math.sign(e.position.x) * 2.5 * U * st.eyeGap + gaze.x * 0.06;
      e.position.y = BODY_H - 1.75 * U + gaze.y * 0.05;
    }
    for (const a of arms) {
      const wig = talkK > 0.05 ? Math.sin(t * 8.0 + a.s) * 0.16 * talkK : Math.sin(t * 1.5 + a.s) * 0.02;
      a.piv.rotation.z = a.s * (st.arm + wig);
    }
  }

  return {
    group, root, parts: { bodyPivot, eyes, arms, legs },
    update,
    setExpression: (name) => { target = { ...CLAUDE_EXPRESSIONS[name] }; },
    talk: (on) => { talking = !!on; },
    setTalkLevel: (v) => { level = v === null ? null : clamp(v); },
    look: (x, y) => { gaze.x = clamp(x, -1, 1); gaze.y = clamp(y, -1, 1); },
    get state() { return { ...st, talking }; },
  };
}


// the kit's character contract: create(renderer, { rand, W, H }) -> { group, setExpression(name, speed), setTalkLevel(0..1), look(x, y), update(dt), freeze?() }
export function create(renderer, { rand }) {
  return createClaude({ rand });
}
