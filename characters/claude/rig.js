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
  deadpan: { eyeH: 1.0, eyeW: 1.0, eyeAsym: 0, eyeGap: 1.0, tilt: 0, lean: 0, arm: 0.0, squash: 1 },   // eyeW: eye width, eyeAsym: one eye taller than the other (a raised eyebrow)
  smug: { eyeH: 0.55, eyeGap: 1.04, tilt: 0.04, lean: 0.02, arm: 0.2, squash: 1 },
  worried: { eyeH: 1.25, eyeGap: 0.94, tilt: -0.05, lean: -0.04, arm: -0.05, squash: 0.97 },
  wow: { eyeH: 1.45, eyeGap: 1.0, tilt: 0, lean: 0.0, arm: 0.7, squash: 1.04 },
  sleepy: { eyeH: 0.3, eyeGap: 1.0, tilt: 0.06, lean: -0.04, arm: 0.0, squash: 0.96 },
  // added for acting: bigger swings of the eyes, arms and body so the feeling reads from far away
  shocked: { eyeH: 1.75, eyeGap: 0.9, tilt: 0, lean: -0.07, arm: 0.95, squash: 1.07 },
  fakewow: { eyeH: 1.35, eyeGap: 1.07, tilt: 0.03, lean: 0.05, arm: 0.55, squash: 1.03 },
  guilty: { eyeH: 0.8, eyeGap: 0.94, tilt: -0.07, lean: -0.08, arm: -0.12, squash: 0.94 },
  panic: { eyeH: 1.6, eyeGap: 0.88, tilt: 0, lean: -0.1, arm: 1.0, squash: 1.0 },
  proud: { eyeH: 0.7, eyeGap: 1.05, tilt: -0.03, lean: 0.07, arm: 0.35, squash: 1.05 },
  squint: { eyeH: 0.3, eyeW: 1.7, eyeGap: 1.0, tilt: 0.02, lean: 0.03, arm: 0.0, squash: 1 },
  skeptical: { eyeH: 0.85, eyeAsym: 0.55, eyeGap: 1.0, tilt: 0.06, lean: 0.03, arm: 0.1, squash: 1 },
  annoyed: { eyeH: 0.5, eyeW: 1.3, eyeGap: 1.04, tilt: -0.05, lean: 0.05, arm: -0.1, squash: 0.98 },
  sad: { eyeH: 1.15, eyeW: 0.9, eyeGap: 0.95, tilt: 0.08, lean: -0.1, arm: -0.1, squash: 0.95 },
  glee: { eyeH: 0.45, eyeW: 1.6, eyeGap: 1.02, tilt: 0, lean: 0.04, arm: 0.95, squash: 1.06 },
  deadeye: { eyeH: 0.45, eyeGap: 1.0, tilt: 0, lean: 0.0, arm: -0.05, squash: 0.98 },
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
  let act = null;   // a short gesture: { name, t0, dur }
  const PLATEAU = (u) => Math.max(0, Math.min(1, u / 0.22, (1 - u) / 0.22));
  function actOff() {
    const o = { y: 0, lean: 0, tilt: 0, yaw: 0, arm: 0 };
    if (!act) return o;
    const u = (t - act.t0) / act.dur;
    if (u >= 1) { act = null; return o; }
    const e = Math.sin(Math.PI * u), pl = PLATEAU(u);
    switch (act.name) {
      case 'jolt': o.lean = -0.28 * e; o.y = 0.4 * e; o.arm = 0.9 * e; break;
      case 'bounce': o.y = 0.34 * Math.abs(Math.sin(Math.PI * 3 * u)) * (1 - 0.3 * u); o.arm = 0.55 * e; break;
      case 'shrug': o.arm = 0.85 * pl; o.tilt = 0.09 * Math.sin(Math.PI * 2 * u); o.y = 0.08 * pl; break;
      case 'nod': o.lean = 0.2 * Math.sin(Math.PI * 4 * u) * (1 - u); break;
      case 'shake': o.yaw = 0.4 * Math.sin(Math.PI * 6 * u) * (1 - u); break;
      case 'lean': o.lean = 0.24 * pl; break;
      case 'lean_back': o.lean = -0.2 * pl; o.y = 0.06 * pl; break;
      case 'panic': o.arm = 0.8 + 0.5 * Math.sin(t * 32); o.tilt = 0.05 * Math.sin(t * 41); o.y = 0.1 * Math.abs(Math.sin(t * 24)); break;
      case 'proud': o.lean = 0.14 * pl; o.arm = 0.5 * pl; o.y = 0.14 * pl; break;
      case 'type': o.arm = 0.3 + 0.28 * Math.sin(t * 26); o.lean = 0.12 * pl; break;
    }
    return o;
  }

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
    const A = actOff();
    bodyPivot.rotation.z = st.tilt + A.tilt;
    bodyPivot.rotation.x = st.lean + A.lean;
    bodyPivot.rotation.y = A.yaw;
    bodyPivot.position.y = LEG_H + 0.025 * talkK + A.y; // a small bounce on each syllable
    for (const e of eyes) {
      const h = Math.max(0.06, st.eyeH * (1 - 0.92 * blink) * (1 + (e.position.x < 0 ? 1 : -0.5) * st.eyeAsym));
      e.scale.set(st.eyeW, h, 1);
      e.position.x = Math.sign(e.position.x) * 2.5 * U * st.eyeGap + gaze.x * 0.06;
      e.position.y = BODY_H - 1.75 * U + gaze.y * 0.05;
    }
    for (const a of arms) {
      const wig = talkK > 0.05 ? Math.sin(t * 8.0 + a.s) * 0.16 * talkK : Math.sin(t * 1.5 + a.s) * 0.02;
      a.piv.rotation.z = a.s * (st.arm + wig + A.arm);
    }
  }

  return {
    group, root, parts: { bodyPivot, eyes, arms, legs },
    update,
    setExpression: (name) => { if (!CLAUDE_EXPRESSIONS[name]) throw new Error('unknown expression: ' + name); target = { ...CLAUDE_EXPRESSIONS.deadpan, ...CLAUDE_EXPRESSIONS[name] }; },
    defineExpression: (name, params) => { CLAUDE_EXPRESSIONS[name] = { ...CLAUDE_EXPRESSIONS.deadpan, ...params }; },
    actNames: ['jolt', 'bounce', 'shrug', 'nod', 'shake', 'lean', 'lean_back', 'panic', 'proud', 'type'],   // acts that move the arms; any other act comes from assets/acts.json
    talk: (on) => { talking = !!on; },
    act: (name, dur = 0.9) => { act = { name, t0: t, dur }; },
    setTalkLevel: (v) => { level = v === null ? null : clamp(v); },
    look: (x, y) => { gaze.x = clamp(x, -1, 1); gaze.y = clamp(y, -1, 1); },
    get state() { return { ...st, talking }; },
  };
}


// the kit's character contract: create(renderer, { rand, W, H }) -> { group, setExpression(name, speed), setTalkLevel(0..1), look(x, y), update(dt), freeze?() }
export function create(renderer, { rand, config }) {
  const c = createClaude({ rand });
  for (const [n, p] of Object.entries(config?.expressionParams || {})) c.defineExpression(n, p);   // faces defined in character.json (expressionParams) need no code
  return c;
}
