// A round cream chicken mascot as a three.js rig.
// Same proportions as the Blender model (1 unit = 100 app units). Blender is z-up and the chicken faces -Y;
// three.js is y-up and the chicken faces +Z, so every Blender coordinate goes through B().
//
//   const chicken = createChicken(renderer);
//   scene.add(chicken.group);
//   chicken.setExpression('happy');         // neutral | happy | sad | determined | surprised | sleepy
//   chicken.setPose('fly');                 // stand | fly | cheer
//   chicken.talk(true);                     // moves the beak while "speaking" (for the dialogue video)
//   chicken.update(dt);                     // every frame
import * as THREE from 'three';

const B = (x, y, z) => new THREE.Vector3(x, z, -y);

export const EXPRESSIONS = {
  neutral: { lidLow: 0, lidTop: 0, browY: 0, browTilt: 0, mouth: 0, beak: 0, cheek: 1, eyeS: 1, pupil: 1, lookX: 0, lookY: 0 },
  happy: { lidLow: 1, lidTop: 0, browY: 0.12, browTilt: 0, mouth: 0.6, beak: 0.3, cheek: 1.5, eyeS: 1.05, pupil: 1, lookX: 0, lookY: 0 },
  sad: { lidLow: 0, lidTop: 0.12, browY: 0.02, browTilt: 0.55, mouth: 0, beak: 0, cheek: 0.9, eyeS: 1.1, pupil: 1.15, lookX: -0.3, lookY: -0.4 },
  determined: { lidLow: 0, lidTop: 0.22, browY: -0.02, browTilt: -0.5, mouth: 0, beak: 0, cheek: 1, eyeS: 1, pupil: 1, lookX: 0, lookY: 0.2 },
  surprised: { lidLow: 0, lidTop: 0, browY: 0.2, browTilt: 0, mouth: 0.5, beak: 0.35, cheek: 1, eyeS: 1.25, pupil: 0.8, lookX: 0, lookY: 0 },
  sleepy: { lidLow: 0, lidTop: 0.65, browY: -0.03, browTilt: 0.15, mouth: 0, beak: 0, cheek: 1, eyeS: 1, pupil: 1, lookX: 0, lookY: -0.2 },
};

const COLOR = {
  cream: '#FFF3D8', wing: '#FFE7B8', white: '#FFFFFF', dark: '#2A1B14', red: '#EE3B45', beak: '#FFB62D',
  gold: '#F6C431', goldDark: '#B8860B', leg: '#F3A21F', cheek: '#FF9FA8', slot: '#8C6A3F', mouth: '#7A1220',
  tongue: '#FF6B7A', brow: '#5A3B22', orange: '#FF8A2A', pink: '#E23F82', teal: '#14B3A3', outline: '#6B4A27',
};

const lerp = (a, b, k) => a + (b - a) * k;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));

export function createChicken(renderer, { outlinePx = 2.0, matte = true, rand = Math.random } = {}) {   // rand: a seeded generator, so the blinks never depend on how many objects were created
  const group = new THREE.Group();
  group.name = 'Chicken';
  const root = new THREE.Group(); // hops, squash, yaw
  group.add(root);
  const body = new THREE.Group(); // breathing
  root.add(body);

  const mats = {};
  // matte: like the reference, nothing shines. Roughness is pushed to the top and metal is taken away; only the pupils keep a little gloss for the eye highlight
  const std = (key, color, rough = 0.6, metal = 0) => (mats[key] = new THREE.MeshStandardMaterial({ color, roughness: matte && key !== 'dark' ? Math.max(rough, 0.92) : rough, metalness: matte ? Math.min(metal, 0.05) : metal, envMapIntensity: matte ? 0.15 : 1 }));
  std('cream', COLOR.cream, 0.7); std('wing', COLOR.wing, 0.7); std('white', COLOR.white, 0.25); std('dark', COLOR.dark, 0.15);
  std('red', COLOR.red, 0.45); std('beak', COLOR.beak, 0.4); std('gold', COLOR.gold, 0.3, 0.6); std('leg', COLOR.leg, 0.5);
  std('cheek', COLOR.cheek, 0.8); std('slot', COLOR.slot, 0.7); std('mouth', COLOR.mouth, 0.5); std('tongue', COLOR.tongue, 0.5);
  std('brow', COLOR.brow, 0.7); std('orange', COLOR.orange, 0.5); std('pink', COLOR.pink, 0.5); std('teal', COLOR.teal, 0.5);

  // one thin dark edge around the solid parts, constant width on screen (an inflated back-face copy pushed outwards in clip space)
  const outlineMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { uColor: { value: new THREE.Color(COLOR.outline) }, uPx: { value: outlinePx }, uRes: { value: new THREE.Vector2(1, 1) } },
    vertexShader: `
      uniform float uPx; uniform vec2 uRes;
      void main() {
        vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * normal);
        vec2 dir = (projectionMatrix * vec4(n, 0.0)).xy;
        dir = length(dir) > 1e-5 ? normalize(dir) : vec2(0.0);
        clip.xy += dir * uPx * 2.0 / uRes * clip.w;
        gl_Position = clip;
      }`,
    fragmentShader: `
      uniform vec3 uColor;
      void main() {
        gl_FragColor = vec4(uColor, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const hulls = [];

  const sphereGeo = new THREE.SphereGeometry(1, 48, 32);
  const featherGeo = sphereGeo.clone().translate(0, 1, 0); // base at the origin, long axis +y

  function mesh(parent, name, { geo = sphereGeo, mat, at = [0, 0, 0], scale = [1, 1, 1], rot = null, hull = false, shadow = true }) {
    const m = new THREE.Mesh(geo, mat);
    m.name = name;
    m.position.set(...at);
    m.scale.set(...scale);
    if (rot) m.rotation.set(...rot);
    m.castShadow = shadow;
    parent.add(m);
    if (hull) {
      const h = new THREE.Mesh(geo, outlineMat);
      h.name = name + '_outline';
      h.userData.isHull = true;
      m.add(h);
      hulls.push(h);
    }
    return m;
  }
  const at = (x, y, z) => B(x, y, z).toArray();

  // ---- body, face
  const bodyMesh = mesh(body, 'Body', { mat: mats.cream, at: at(0, 0, 0.95), scale: [0.84, 0.84, 0.80], hull: true });
  const eye = {};
  for (const s of [-1, 1]) {
    const k = s < 0 ? 'R' : 'L'; // the chicken's own right is -X
    eye['white' + k] = mesh(body, 'EyeWhite' + k, { mat: mats.white, at: at(s * 0.29, -0.70, 1.17), scale: [0.17, 0.20, 0.08], shadow: false });
    eye['pupil' + k] = mesh(body, 'Pupil' + k, { mat: mats.dark, at: at(s * 0.29, -0.76, 1.16), scale: [0.105, 0.12, 0.05], shadow: false });
    eye['glint' + k] = mesh(body, 'Glint' + k, { mat: mats.white, at: at(s * 0.255, -0.80, 1.22), scale: [0.03, 0.03, 0.02], shadow: false });
    eye['cheek' + k] = mesh(body, 'Cheek' + k, { mat: mats.cheek, at: at(s * 0.52, -0.62, 0.96), scale: [0.14, 0.09, 0.04], rot: [0, s * 0.35, 0], shadow: false });
    eye['lidLow' + k] = mesh(body, 'LidLow' + k, { mat: mats.cream, shadow: false });
    eye['lidTop' + k] = mesh(body, 'LidTop' + k, { mat: mats.cream, shadow: false });
    eye['brow' + k] = mesh(body, 'Brow' + k, { mat: mats.brow, scale: [0.15, 0.035, 0.035], shadow: false });
  }

  // ---- wings (pivot at the shoulder)
  const wingP = {};
  for (const s of [-1, 1]) {
    const k = s < 0 ? 'R' : 'L';
    const p = new THREE.Group();
    p.name = 'WingPivot' + k;
    p.position.set(...at(s * 0.80, -0.05, 1.25));
    body.add(p);
    mesh(p, 'Wing' + k, { mat: mats.wing, at: [s * 0.06, -0.30, 0], scale: [0.13, 0.38, 0.30], hull: true });
    wingP[k] = p;
    mesh(body, 'Foot' + k, { mat: mats.leg, at: at(s * 0.30, -0.28, 0.07), scale: [0.20, 0.10, 0.32], hull: true });
  }

  // ---- beak (hinged at its base), mouth, wattle
  const beakGeo = new THREE.ConeGeometry(0.21, 0.34, 32).translate(0, 0.17, 0).rotateX(Math.PI / 2); // base at the origin, tip +z
  const beakP = new THREE.Group();
  beakP.position.set(...at(0, -0.74, 0.90));
  body.add(beakP);
  mesh(beakP, 'Beak', { geo: beakGeo, mat: mats.beak, scale: [1, 0.72, 1], hull: true });
  const mouth = mesh(body, 'Mouth', { mat: mats.mouth, at: at(0, -0.88, 0.80), shadow: false });
  const tongue = mesh(body, 'Tongue', { mat: mats.tongue, at: at(0, -0.98, 0.79), shadow: false });
  mesh(body, 'Wattle', { mat: mats.red, at: at(0, -0.80, 0.66), scale: [0.07, 0.13, 0.05] });

  // ---- coin with the R
  const coin = new THREE.Group();
  coin.position.set(...at(0, -0.78, 0.38));
  body.add(coin);
  mesh(coin, 'Coin', { geo: new THREE.CylinderGeometry(0.26, 0.26, 0.06, 64).rotateX(Math.PI / 2), mat: mats.gold, hull: true });
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = COLOR.gold;
  g.beginPath(); g.arc(128, 128, 126, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#E0A51B'; g.lineWidth = 10; g.beginPath(); g.arc(128, 128, 104, 0, Math.PI * 2); g.stroke();
  g.fillStyle = COLOR.goldDark; g.font = '700 150px Impact, "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('R', 128, 138);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.255, 64), new THREE.MeshStandardMaterial({ map: tex, roughness: matte ? 0.92 : 0.35, metalness: matte ? 0.05 : 0.45, envMapIntensity: matte ? 0.15 : 1 }));
  face.position.z = 0.0305;
  face.name = 'CoinFace';
  coin.add(face);

  // ---- comb and coin slot
  const combP = new THREE.Group();
  combP.position.set(...at(0, -0.02, 1.62));
  body.add(combP);
  const comb0 = combP.position.clone();
  const rel = (x, y, z) => B(x, y, z).sub(comb0).toArray();
  mesh(combP, 'CombC', { mat: mats.red, at: rel(0, -0.02, 1.84), scale: [0.27, 0.27, 0.24], hull: true });
  mesh(combP, 'CombL', { mat: mats.red, at: rel(-0.27, -0.02, 1.72), scale: [0.21, 0.21, 0.20], hull: true });
  mesh(combP, 'CombR', { mat: mats.red, at: rel(0.27, -0.02, 1.72), scale: [0.21, 0.21, 0.20], hull: true });
  // the coin slot is a hole, not a part that sticks out: a dark slit lying flat on the head, tilted along the curve of the skull, next to the comb
  {
    const px = -0.27, pz = 0.34;                                                    // where on the head (three.js x, z)
    const py = 0.95 + 0.84 * Math.sqrt(1 - (px / 0.84) ** 2 - (pz / 0.80) ** 2);    // the surface of the head there
    const nrm = new THREE.Vector3(px / (0.84 * 0.84), (py - 0.95) / (0.84 * 0.84), pz / (0.80 * 0.80)).normalize();
    const holeM = new THREE.MeshStandardMaterial({ color: '#1C0F07', roughness: 1, metalness: 0 });
    const slit = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), holeM);
    slit.scale.set(0.2, 0.02, 0.05);                                                // long, flat, narrow
    slit.name = 'CoinSlot';
    slit.position.copy(new THREE.Vector3(px, py, pz).addScaledVector(nrm, -0.006)); // almost flush with the skin
    slit.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), nrm);
    slit.rotateY(0.5);                                                              // the slit runs diagonally, like in the drawing
    body.add(slit);
  }

  // ---- tail: three feathers on a pivot at the back
  const tailP = new THREE.Group();
  tailP.position.set(...at(0, 0.62, 1.12));
  body.add(tailP);
  const tail0 = tailP.position.clone();
  const X = new THREE.Vector3(1, 0, 0);
  for (const [name, key, d, base] of [
    ['Orange', 'orange', B(0, 0.30, 0.95), B(0, 0.62, 1.25)],
    ['Pink', 'pink', B(0.70, 0.50, 0.55), B(0.10, 0.62, 1.15)],
    ['Teal', 'teal', B(-0.70, 0.60, 0.40), B(-0.10, 0.62, 1.05)],
  ]) {
    const y = d.clone().normalize();
    const x = X.clone().addScaledVector(y, -X.dot(y)).normalize(); // broad face turned toward the sides
    const z = new THREE.Vector3().crossVectors(x, y);
    const f = mesh(tailP, 'Tail' + name, { geo: featherGeo, mat: mats[key], at: base.sub(tail0).toArray(), scale: [0.22, 0.80, 0.10], hull: true });
    f.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  }

  // ---- state
  const st = { ...EXPRESSIONS.neutral };       // what is shown now
  let target = { ...EXPRESSIONS.neutral };     // where it is heading
  let speed = 10;                               // how fast it eases (1/s)
  let pose = 'stand';
  let talking = false;
  let level = null; // mouth driven by the loudness of the real voice (0..1); null = off
  let frozen = false;
  let t = 0;
  let blinkAt = 2.2;
  let blink = 0;
  const look = { x: 0, y: 0 };

  function applyFace() {
    const eyeS = st.eyeS * (1 - 0.92 * blink);
    for (const s of [-1, 1]) {
      const k = s < 0 ? 'R' : 'L';
      eye['white' + k].scale.set(0.17 * eyeS, 0.20 * eyeS, 0.08);
      eye['pupil' + k].scale.set(0.105 * eyeS * st.pupil, 0.12 * eyeS * st.pupil, 0.05);
      eye['glint' + k].scale.set(0.03 * eyeS, 0.03 * eyeS, 0.02);
      const lx = st.lookX + look.x, ly = st.lookY + look.y;
      eye['pupil' + k].position.set(s * 0.29 + lx * 0.045, 1.16 + ly * 0.05, 0.76);
      eye['glint' + k].position.set(s * 0.255 + lx * 0.045, 1.22 + ly * 0.05, 0.80);
      eye['cheek' + k].scale.set(0.14 * st.cheek, 0.09 * st.cheek, 0.04);
      // flat caps over the eye: the lower one makes the happy squint, the upper one the heavy or determined lid
      const hh = 0.12 * st.lidLow;
      const low = eye['lidLow' + k];
      low.visible = st.lidLow > 0.01;
      low.scale.set(0.185, Math.max(hh, 1e-4), 0.045);
      low.position.set(s * 0.29, 1.17 - 0.2 + hh, 0.752);
      const th = 0.2 * st.lidTop;
      const top = eye['lidTop' + k];
      top.visible = st.lidTop > 0.01;
      top.scale.set(0.185, Math.max(th, 1e-4), 0.045);
      top.position.set(s * 0.29, 1.17 + 0.2 - th, 0.752);
      const br = eye['brow' + k];
      br.position.set(s * 0.30, 1.45 + st.browY, 0.74);
      br.rotation.z = -s * st.browTilt; // positive = sad (inner ends up), negative = angry
    }
    const m = st.mouth;
    mouth.visible = m > 0.02;
    mouth.scale.set(0.20 * m, 0.10 * m, 0.10 * Math.min(1, m * 2));
    tongue.visible = m > 0.25;
    tongue.scale.set(0.11 * m, 0.05 * m, 0.06 * Math.min(1, m * 2));
    beakP.rotation.x = -0.314 * st.beak;
  }

  function update(dt) {
    t += dt;
    const k = 1 - Math.exp(-speed * dt);
    for (const key in st) st[key] = lerp(st[key], target[key], k);
    if (level !== null) {
      st.mouth = Math.max(st.mouth, level > 0.06 ? 0.12 + 0.8 * level : 0);
      st.beak = Math.max(st.beak, 0.55 * level);
    } else if (talking) {
      const v = clamp(0.15 + 0.85 * Math.abs(Math.sin(t * 13.0) * Math.sin(t * 5.1 + 1)), 0, 1);
      st.mouth = Math.max(st.mouth, 0.15 + 0.6 * v);
      st.beak = Math.max(st.beak, 0.5 * v);
    }
    if (!frozen) {
      if (t > blinkAt) { blink = 1; blinkAt = t + 2 + rand() * 3; }
      blink = Math.max(0, blink - dt / 0.14);
    }
    const flying = pose === 'fly', cheer = pose === 'cheer';
    const flap = Math.sin(t * Math.PI * 2 * (flying ? 2.6 : 3.0));
    const wingA = flying ? 0.96 + 0.96 * flap : cheer ? 1.75 + 0.38 * flap : 0.2 + 0.05 * Math.sin(t * 2.2);
    wingP.R.rotation.z = -wingA;
    wingP.L.rotation.z = wingA;
    tailP.rotation.x = flying ? -0.35 : cheer ? 0.1 : 0;
    tailP.rotation.z = Math.sin(t * (flying || cheer ? 5 : 2)) * (flying || cheer ? 0.12 : 0.04);
    combP.rotation.x = Math.sin(t * 5.5) * 0.05;
    combP.rotation.z = Math.sin(t * 3.1) * 0.04;
    const breathe = 1 + 0.018 * Math.sin(t * 2.2);
    body.scale.set(1, breathe, 1);
    // hops on the beat when cheering, a bob when flying
    let hop = 0, sq = 1;
    if (cheer) {
      const ph = (t * 2) % 1;
      hop = Math.abs(Math.sin(Math.PI * ph)) * 0.9;
      const land = ph < 0.16 ? 1 - ph / 0.16 : 0;
      sq = 1 - 0.18 * land + 0.1 * Math.sin(Math.PI * ph);
    } else if (flying) {
      hop = 0.25 + 0.08 * Math.sin(t * 2.6 * Math.PI * 2);
    }
    root.position.y = hop;
    root.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    root.rotation.x = flying ? -0.45 : 0;
    applyFace();
  }

  function setExpression(name, ease = 10) {
    target = { ...EXPRESSIONS[name] };
    speed = ease;
  }

  function setViewport(w, h) {
    outlineMat.uniforms.uRes.value.set(w, h);
  }
  function setOutline(px) {
    outlineMat.uniforms.uPx.value = px;
    for (const h of hulls) h.visible = px > 0;
  }

  group.traverse((o) => { if (o.isMesh) o.receiveShadow = false; });
  applyFace();

  return {
    group, root, parts: { body: bodyMesh, wingP, tailP, combP, beakP, eye, mouth }, EXPRESSIONS,
    update, setExpression, setViewport, setOutline,
    setPose: (p) => { pose = p; },
    talk: (on) => { talking = !!on; },
    setTalkLevel: (v) => { level = v === null ? null : clamp(v); },
    lookAt: (x, y) => { look.x = clamp(x, -1, 1); look.y = clamp(y, -1, 1); },
    freeze: (on = true) => { frozen = on; blink = 0; },
    // everything that exports: no outline hulls (they are a screen-space trick), the current face as it is
    exportRoot: () => { for (const h of hulls) h.visible = false; return group; },
    restoreOutline: () => { for (const h of hulls) h.visible = outlineMat.uniforms.uPx.value > 0; },
    get state() { return { ...st, pose, talking }; },
  };
}


// the kit's character contract: create(renderer, { rand, W, H }) -> { group, setExpression(name, speed), setTalkLevel(0..1), look(x, y), update(dt), freeze?() }
export function create(renderer, { rand, W, H }) {
  const c = createChicken(renderer, { rand });
  c.setViewport(W, H);
  c.setOutline(1.4);
  c.look = c.lookAt;
  return c;
}
