// A city park at night: grass, a path, a bench (the two characters sit on it), trees, lamp posts, and a closed takoyaki shop with a rolling shutter.
// The shutter rises at look.openAt seconds, and the shop light comes on with it (that is the visible cause of the light change).
import * as THREE from 'three';
import { extraShots } from '../../web/lib/shots.js';
import { createLighting } from '../../web/lib/lighting.js';

const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const std = (color, rough = 0.95) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 });

export async function createWorld(scene, cfg) {
  const info = await fetch(new URL('./world.json', import.meta.url)).then((r) => r.json());
  const K = { groundColor: '#3F6B3A', skyTop: '#101C40', skyBottom: '#3A4A7A', fog: '#18244A', fogDensity: 0.01, trees: 10, treeColor: '#23472E', bushes: 8, stars: 90, seatColor: '#7A5230', shopWall: '#E9DCC3', awning: '#D0342C', openAt: 26, ...(info.look || {}) };
  const group = new THREE.Group(); scene.add(group);
  const R = rng(777);
  const updaters = [];
  scene.background = new THREE.Color(K.skyTop);
  scene.fog = new THREE.FogExp2(K.fog, K.fogDensity);

  const ground = new THREE.Mesh(new THREE.CircleGeometry(80, 48), std(K.groundColor)); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; group.add(ground);
  const path = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 24), std('#CDB89A')); path.rotation.x = -Math.PI / 2; path.position.set(0, 0.01, -6); path.receiveShadow = true; group.add(path);
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(260, 120), new THREE.MeshBasicMaterial({ map: gradientTexture(K.skyTop, K.skyBottom), toneMapped: false })); sky.position.set(0, 30, -90); group.add(sky);
  if (K.stars) {
    const n = K.stars, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = -90 + R() * 180; pos[i * 3 + 1] = 14 + R() * 50; pos[i * 3 + 2] = -88; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    group.add(new THREE.Points(g, new THREE.PointsMaterial({ color: '#FFFFFF', size: 0.4, transparent: true, opacity: 0.85, depthWrite: false })));
  }

  // daylight: a bright sky light from above and a sun light from the sun's side, so the park reads as a sunny afternoon
  group.add(new THREE.HemisphereLight('#DDEFFF', '#8DB56A', 1.0));
  const sun = new THREE.DirectionalLight('#FFF2D6', 0.45); sun.position.set(20, 26, -20); group.add(sun);

  // the bench: a plank on two legs; its top is the stage
  const SEAT_Y = 0.9;
  const plank = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.22, 1.3), std(K.seatColor)); plank.position.set(0, SEAT_Y - 0.11, 0.5); plank.castShadow = plank.receiveShadow = true; group.add(plank);
  for (const x of [-2.6, 2.6]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.25, SEAT_Y - 0.22, 1.1), std('#3E2A1A')); leg.position.set(x, (SEAT_Y - 0.22) / 2, 0.5); leg.castShadow = true; group.add(leg); }

  // the takoyaki shop: a real room, open to the front. Back wall: sink (left) and the takoyaki griddle (right). Front right: the cash counter. Front left: the broom. Two small tables for customers.
  const shop = new THREE.Group(); shop.position.set(0, 0, -12); group.add(shop);
  const cream = std(K.shopWall), wood = new THREE.MeshStandardMaterial({ map: woodTex('#9A6B43'), roughness: 0.7 }), dark = std('#2A2A2E', 0.5), steel = std('#B9C2CC', 0.4), beam = std('#3B2618', 0.7);
  const paper = new THREE.MeshStandardMaterial({ map: shojiTex(), roughness: 0.9 }), tile = new THREE.MeshStandardMaterial({ map: tileTex(), roughness: 0.6 });
  const floorM = new THREE.Mesh(new THREE.PlaneGeometry(12, 3.4), new THREE.MeshStandardMaterial({ map: woodTex('#C89A66', 6), roughness: 0.75 })); floorM.rotation.x = -Math.PI / 2; floorM.position.set(0, 0.02, -1.0); floorM.receiveShadow = true; shop.add(floorM);
  const back = new THREE.Mesh(new THREE.BoxGeometry(12, 6.5, 0.4), [cream, cream, cream, cream, paper, cream]); back.position.set(0, 3.25, -2.8); back.receiveShadow = true; shop.add(back);
  for (const x of [-6.2, 6.2]) { const side = new THREE.Mesh(new THREE.BoxGeometry(0.4, 6.5, 3.6), cream); side.position.set(x, 3.25, -1.0); side.castShadow = true; shop.add(side); }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(12.8, 0.5, 3.8), tile); roof.position.set(0, 6.5, -1.0); roof.castShadow = true; roof.visible = !K.roofOff; shop.add(roof);
  const menu = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.5), new THREE.MeshBasicMaterial({ map: menuTexture(), toneMapped: false })); menu.position.set(0, 4.7, -2.58); shop.add(menu);
  // an easter egg that belongs in a shop: a sheet of paper taped beside the menu, hand-written in marker (the install count of the day)
  const note = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.15), new THREE.MeshBasicMaterial({ map: noteTexture(), toneMapped: false })); note.position.set(-3.1, 3.5, -2.55); note.rotation.z = -0.05; shop.add(note);
  for (const tx of [-0.7, 0.7]) { const tape = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.16), new THREE.MeshBasicMaterial({ color: '#E7D9A8', transparent: true, opacity: 0.8, toneMapped: false })); tape.position.set(-3.1 + tx * 0.8, 4.1, -2.53); tape.rotation.z = -0.3; shop.add(tape); }
  // back left: sink
  const sinkBase = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.0, 0.9), cream); sinkBase.position.set(-2.6, 0.5, -2.1); sinkBase.castShadow = true; shop.add(sinkBase);
  const sinkTop = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 1.0), steel); sinkTop.position.set(-2.6, 1.06, -2.1); shop.add(sinkTop);
  const tap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 8), steel); tap.position.set(-2.6, 1.45, -2.45); shop.add(tap);
  // back right: takoyaki griddle counter with pans
  const griddleC = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.1, 1.0), wood); griddleC.position.set(2.8, 0.55, -2.0); griddleC.castShadow = griddleC.receiveShadow = true; shop.add(griddleC);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.1, 0.9), dark); plate.position.set(2.8, 1.15, -2.0); shop.add(plate);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) { const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 16), std('#E0A040', 0.6)); pan.position.set(1.8 + i * 0.66, 1.22, -2.2 + j * 0.4); shop.add(pan); }
  // front right: cash counter with register
  const counter = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.1, 0.8), wood); counter.position.set(3.4, 0.55, 0.1); counter.castShadow = counter.receiveShadow = true; shop.add(counter);
  const reg = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.6), std('#1F7A6E', 0.5)); reg.position.set(3.4, 1.4, 0.1); reg.castShadow = true; shop.add(reg);
  // front left: broom leaning on the wall
  const broom = new THREE.Group(); broom.position.set(-4.6, 0, -1.9); shop.add(broom);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 6), std('#8A5A3A')); handle.position.set(0, 1.1, 0); broom.add(handle);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.2), std('#D9B45A')); head.position.set(0.25, 0.09, 0); broom.add(head);
  // two small customer tables with stools
  for (const [tx, tz] of [[-1.6, -0.6], [1.2, 0.4]]) {
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.1, 24), wood); top.position.set(tx, 1.0, tz); top.castShadow = true; shop.add(top);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.0, 8), dark); leg.position.set(tx, 0.5, tz); shop.add(leg);
    for (const sx of [-0.7, 0.7]) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.08, 16), std('#C0392B', 0.6)); st.position.set(tx + sx, 0.5, tz + 0.2); shop.add(st); }
  }
  // Japanese details: dark wood posts and beams, a terrace of planks in front, a noren curtain over the front, and a red paper lantern
  const terrace = new THREE.Mesh(new THREE.BoxGeometry(12.4, 0.2, 2.2), new THREE.MeshStandardMaterial({ map: woodTex('#8A5C36', 4), roughness: 0.8 })); terrace.position.set(0, 0.1, 1.7); terrace.receiveShadow = true; shop.add(terrace);
  for (const x of [-6.1, -2.0, 2.0, 6.1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.35, 6.6, 0.35), beam); post.position.set(x, 3.3, 0.6); post.castShadow = true; shop.add(post); }
  const eave = new THREE.Mesh(new THREE.BoxGeometry(13.6, 0.35, 2.4), beam); eave.position.set(0, 6.2, 0.4); shop.add(eave);
  const beamTop = new THREE.Mesh(new THREE.BoxGeometry(12.2, 0.3, 0.3), beam); beamTop.position.set(0, 6.1, -2.5); shop.add(beamTop);
  const noren = new THREE.Mesh(new THREE.PlaneGeometry(9.6, 1.5), new THREE.MeshStandardMaterial({ map: norenTex(), roughness: 0.9, side: THREE.DoubleSide })); noren.position.set(0, 5.4, 0.85); shop.add(noren);
  const chochin = new THREE.Group(); chochin.position.set(-4.2, 4.6, 1.2); shop.add(chochin);
  const lanternM = new THREE.MeshStandardMaterial({ color: '#D2302A', emissive: '#FF5A3A', emissiveIntensity: 0.6, roughness: 0.6 });
  const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 18), lanternM); lantern.scale.set(1, 1.2, 1); chochin.add(lantern);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 16), beam); cap.position.y = 0.72; chochin.add(cap);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.2, 4), beam); cord.position.y = 1.4; chochin.add(cord);
  // the lamp inside, and the shutter across the open front; its sign rises with it
  const lampGlow = new THREE.MeshBasicMaterial({ color: '#FFD9A0', toneMapped: false });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 12), lampGlow); lamp.position.set(0, 5.6, -1.0); shop.add(lamp);
  const inside = new THREE.PointLight('#FFC27A', 0, 24, 1.2); inside.position.set(0, 4.5, -0.6); shop.add(inside);
  const shutter = new THREE.Group(); shutter.position.set(0, 3.7, 0.7); shop.add(shutter);
  const slats = new THREE.Mesh(new THREE.PlaneGeometry(11.2, 4.4), std('#6B7078')); shutter.add(slats);
  for (let k = 0; k < 8; k++) { const slat = new THREE.Mesh(new THREE.PlaneGeometry(11.2, 0.05), std('#4E535B')); slat.position.set(0, -2 + k * 0.5, 0.01); shutter.add(slat); }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.1), new THREE.MeshBasicMaterial({ map: signTexture('TAKOYAKI'), toneMapped: false })); sign.position.set(0, 1.5, 0.02); shutter.add(sign);
  // ---- the build: before Claude says "Aku bikinin Mode Bisnis", there is no shop. Then planks, posts, walls and the roof fly in from the sides and snap into place, with smoke puffs rising from the ground
  const buildAt = K.buildAt ?? 18.2, buildLen = 3.0;
  const parts = shop.children.filter((o) => o.isMesh && o !== shutter);
  const from = parts.map((o) => ({ o, base: o.position.clone(), rot: o.rotation.clone(), off: new THREE.Vector3((R() - 0.5) * 14, 4 + R() * 6, (R() - 0.5) * 8), spin: (R() - 0.5) * 2.4, delay: R() * 1.2 }));
  const dustB = new THREE.MeshBasicMaterial({ color: '#E9E0CF', transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  const buildSmoke = [];
  for (let i = 0; i < 16; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), dustB.clone()); shop.add(m); buildSmoke.push({ m, a: R(), x: (R() - 0.5) * 11, z: -0.4 + (R() - 0.5) * 2.5 }); }
  updaters.push((t) => {
    const b = t - buildAt;
    shop.visible = b >= 0;   // before the build there is only the empty ground: the whole shop, lantern and all, is hidden
    shutter.visible = b >= 0;
    for (const f of from) {
      const k = b < 0 ? 0 : (() => { const u = Math.min(1, Math.max(0, (b - f.delay) / (buildLen - 1.2))); return u * u * (3 - 2 * u); })();
      f.o.visible = b >= 0;
      f.o.position.set(f.base.x + f.off.x * (1 - k), f.base.y + f.off.y * (1 - k), f.base.z + f.off.z * (1 - k));
      f.o.rotation.set(f.rot.x + f.spin * (1 - k), f.rot.y, f.rot.z + f.spin * (1 - k) * 0.5);
    }
    for (const p of buildSmoke) {
      const u = b < 0 || b > buildLen ? 0 : (b / buildLen + p.a * 0.3) % 1;
      p.m.position.set(p.x, 0.6 + u * 3.2, p.z);
      p.m.scale.setScalar(0.6 + u * 2.2);
      p.m.material.opacity = b < 0 || b > buildLen ? 0 : 0.55 * Math.sin(Math.PI * u) * (1 - b / buildLen * 0.7);
    }
  });

  // ---- little moving details (all driven by t, so every frame repeats exactly)
  const steamMat = new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  const puffs = [];
  for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), steamMat.clone()); shop.add(m); puffs.push({ m, a: R(), x: 1.8 + (i % 4) * 0.66, z: -2.2 + (i % 2) * 0.4 }); }
  const bubMat = new THREE.MeshBasicMaterial({ color: '#F4FBFF', transparent: true, opacity: 0.9, toneMapped: false });
  const bubbles = [];
  for (let i = 0; i < 12; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.06 + R() * 0.05, 8, 6), bubMat); shop.add(m); bubbles.push({ m, a: R(), x: -2.6 + (R() - 0.5) * 1.4, z: -2.1 + (R() - 0.5) * 0.6 }); }
  const dustMat = new THREE.MeshBasicMaterial({ color: '#D8C7A5', transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  const dust = [];
  for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.06 + R() * 0.04, 6, 5), dustMat.clone()); shop.add(m); dust.push({ m, a: R(), z: -1.9 + (R() - 0.5) * 0.8 }); }
  updaters.push((t) => {
    const open = Math.min(1, Math.max(0, (t - K.openAt) / 1.2)), e = open * open * (3 - 2 * open);   // the shutter rolls up in 1.2 s
    shutter.position.y = 3.7 + 4.6 * e;
    inside.intensity = 18 * e;
    lampGlow.color.set('#FFD9A0').multiplyScalar(0.2 + 0.8 * e);
    for (const p of puffs) {
      const u = (t * 0.45 + p.a) % 1;
      p.m.position.set(p.x + Math.sin(u * 6 + p.a) * 0.12, 1.4 + u * 2.4, p.z);
      p.m.scale.setScalar(0.5 + u * 1.5);
      p.m.material.opacity = e * 0.3 * Math.sin(Math.PI * u);
    }
    for (const b of bubbles) {
      const u = (t * 0.6 + b.a) % 1;
      b.m.position.set(b.x + Math.sin(u * 9 + b.a * 6) * 0.05, 1.2 + u * 0.7, b.z);
      b.m.scale.setScalar(Math.max(0.2, Math.sin(Math.PI * u)));
    }
    const sw = Math.sin(t * 3.2);   // the sweep: side to side along the floor
    broom.position.x = -4.6 + sw * 0.5; broom.rotation.z = -0.12 * sw;
    for (const d of dust) {
      const u = (t * 0.8 + d.a) % 1;
      d.m.position.set(-4.6 + sw * 0.5 + 0.4 + Math.sin(u * 5 + d.a * 9) * 0.2, 0.1 + u * 0.6, d.z);
      d.m.material.opacity = e * 0.6 * Math.sin(Math.PI * u);
    }
  });

  // ---- the customers: small chickens with no tail (so they read as NOT the main character). They queue at the counter, sit at the tables, and wander between the stall and the bench. They appear once the shop is open (look.openAt).
  const crowdColors = ['#7FD8C2', '#FF9EC4', '#B9A4FF', '#8ECBFF', '#B8E986', '#FFE066'];
  const chickMat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 });
  const combM = new THREE.MeshStandardMaterial({ color: '#FF5C8A', roughness: 0.6 }), beakM = new THREE.MeshStandardMaterial({ color: '#F29A2E', roughness: 0.5 }), eyeM = new THREE.MeshBasicMaterial({ color: '#16181F' });
  function makeChick(color) {
    const c = new THREE.Group();
    const body = new THREE.Group(); c.add(body);
    const bodyM = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 16), chickMat(color)); bodyM.scale.set(1, 0.95, 0.95); bodyM.position.y = 0.45; bodyM.castShadow = true; body.add(bodyM);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), chickMat(color)); head.position.set(0, 0.95, 0.08); head.castShadow = true; body.add(head);
    const comb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), combM); comb.position.set(0, 1.18, 0.08); body.add(comb);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 8), beakM); beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.93, 0.34); body.add(beak);
    for (const x of [-0.1, 0.1]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), eyeM); eye.position.set(x * 2.2, 1.0, 0.27); body.add(eye); }
    const wings = [];
    for (const x of [-0.42, 0.42]) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.26), chickMat(color)); w.position.set(x, 0.5, 0); body.add(w); wings.push(w); }
    const legs = [];
    for (const x of [-0.14, 0.14]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 6), beakM); leg.position.set(x, 0.15, 0); c.add(leg); legs.push(leg); }
    c.userData = { body, wings };
    return c;
  }
  // [start, end] paths and a seat: each customer walks between two spots (ping-pong) or sits still
  const crowd = [
    { c: makeChick(crowdColors[0]), a: [2.6, 0, 3.0], b: [2.6, 0, 3.0], face: Math.PI, sit: false, ph: 0.0 },
    { c: makeChick(crowdColors[1]), a: [3.4, 0, 3.6], b: [3.4, 0, 3.6], face: Math.PI, sit: false, ph: 1.7 },
    { c: makeChick(crowdColors[2]), a: [4.2, 0, 3.1], b: [4.2, 0, 3.1], face: Math.PI, sit: false, ph: 3.1 },
    { c: makeChick(crowdColors[3]), a: [-1.6, 0, -12.6], b: [-1.6, 0, -12.6], face: 0, sit: true, ph: 4.2 },
    { c: makeChick(crowdColors[4]), a: [1.2, 0, -12.8], b: [1.2, 0, -12.8], face: 0, sit: true, ph: 2.4 },
    { c: makeChick(crowdColors[5]), a: [-3.6, 0, -9.2], b: [-0.8, 0, -10.8], face: 0, sit: false, ph: 5.2 },
  ];
  for (const cu of crowd) { cu.c.scale.setScalar(0.9); cu.c.visible = false; group.add(cu.c); }
  updaters.push((t) => {
    for (const cu of crowd) {
      const on = t >= K.openAt;
      cu.c.visible = on;
      const k = 0.5 + 0.5 * Math.sin(t * 0.35 + cu.ph);
      const x = cu.a[0] + (cu.b[0] - cu.a[0]) * k, z = cu.a[2] + (cu.b[2] - cu.a[2]) * k;
      const walking = cu.a !== cu.b;
      cu.c.position.set(x, cu.sit ? 0.5 : 0, z);
      cu.c.rotation.y = walking ? (k > 0.5 ? Math.PI / 2 : -Math.PI / 2) + Math.sin(t * 0.7 + cu.ph) * 0.2 : cu.face + Math.sin(t * 0.5 + cu.ph) * 0.25;
      cu.c.userData.body.position.y = (cu.sit ? 0.0 : 0) + 0.02 * Math.sin(t * 3 + cu.ph);
      cu.c.userData.wings.forEach((w, i) => { w.rotation.z = (i ? 1 : -1) * (0.05 + 0.08 * Math.sin(t * 2.4 + cu.ph)); });
    }
  });

  // a daytime city far behind the park: hazy building silhouettes, a tall obelisk with a gold top, and a road in between
  const hazy = '#9FBCD4';
  for (let i = 0; i < 16; i++) {
    const h = 6 + R() * 16, w = 3 + R() * 4;
    const b2 = new THREE.Mesh(new THREE.BoxGeometry(w, h, 4), std(hazy, 1)); b2.position.set(-60 + i * 8 + R() * 3, h / 2, -70 - R() * 10); group.add(b2);
  }
  const obelisk = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 4.0, 40, 4), std('#D9D2B8', 1)); obelisk.position.set(22, 18, -80); obelisk.rotation.y = Math.PI / 4; group.add(obelisk);
  const topGold = new THREE.Mesh(new THREE.ConeGeometry(2.2, 4, 4), std('#E8B53A', 0.4)); topGold.position.set(22, 39.2, -80); topGold.rotation.y = Math.PI / 4; group.add(topGold);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(160, 9), std('#5E6168')); road.rotation.x = -Math.PI / 2; road.position.set(0, 0.02, -48); group.add(road);

  for (let i = 0; i < K.trees; i++) {   // a ring of trees beyond the shop, never in front of it
    const x = -45 + R() * 90, z = -22 - R() * 40, s = 0.9 + R() * 1.3;
    const t = new THREE.Group(); t.position.set(x, 0, z);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25 * s, 0.35 * s, 3 * s, 8), std('#2A1E16')); trunk.position.y = 1.5 * s; t.add(trunk);
    for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(new THREE.ConeGeometry((2.2 - k * 0.5) * s, 3 * s, 10), std(K.treeColor)); c.position.y = (3.2 + k * 1.6) * s; c.castShadow = true; t.add(c); }
    group.add(t); const ph = R() * 6.28; updaters.push((tt) => { t.rotation.z = Math.sin(tt * 0.6 + ph) * 0.012; });
  }
  for (let i = 0; i < K.bushes; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.6 + R() * 0.6, 12, 10), std(K.treeColor)); b.position.set(-10 + R() * 20, 0.3, -4 - R() * 6); b.scale.y = 0.7; group.add(b); }

  const stage = { y: SEAT_Y, z: 0.5, scale: 0.95, left: { x: -1.35, yaw: 0.35 }, right: { x: 1.4, yaw: -0.18 } };
  const face = new THREE.Vector3(stage.left.x, stage.y + 1.05, stage.z);
  const lighting = await createLighting(group, { base: cfg.base, face, light: cfg.light });
  const dy = stage.y - 0.2, dz = stage.z - 0.7;
  return {
    group, stage, lighting,
    shots: {
      ...extraShots(stage),
      wide: { pos: [0.0, 1.95 + dy + 0.5, 13.6], look: [0, 1.25 + dy + 0.9, dz - 4], fov: 46 },
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
function signTexture(text) {
  const c = document.createElement('canvas'); c.width = 768; c.height = 170;
  const g = c.getContext('2d'); g.fillStyle = '#FFF3D6'; g.fillRect(0, 0, 768, 170);
  g.fillStyle = '#D0342C'; g.font = "900 110px 'Arial Black', Impact, sans-serif"; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 384, 92);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function menuTexture() {
  const c = document.createElement('canvas'); c.width = 768; c.height = 280;
  const g = c.getContext('2d'); g.fillStyle = '#1E2A33'; g.fillRect(0, 0, 768, 280);
  g.fillStyle = '#FFF3D6'; g.font = "900 96px 'Arial Black', Impact, sans-serif"; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('TAKOYAKI', 384, 110);
  g.font = "700 46px 'Segoe UI', Arial, sans-serif"; g.fillStyle = '#F6C431'; g.fillText('MENU', 384, 210);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function woodTex(base, rep = 3) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512;
  const g = c.getContext('2d'); g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  const cols = 4;
  for (let i = 0; i < cols; i++) { const x = (i / cols) * 512; g.fillStyle = 'rgba(40,20,8,0.45)'; g.fillRect(x, 0, 3, 512); g.fillStyle = 'rgba(255,230,190,0.12)'; g.fillRect(x + 3, 0, 2, 512); }
  for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(60,30,10,${0.05 + (k % 3) * 0.03})`; g.fillRect((k * 97) % 512, (k * 53) % 512, 60 + (k % 5) * 20, 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); return t;
}
function tileTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d'); g.fillStyle = '#3A4150'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(200,210,225,0.35)'; g.lineWidth = 4;
  for (let y = 0; y <= 256; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
  for (let x = 0; x <= 256; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 1); return t;
}
function shojiTex() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512;
  const g = c.getContext('2d'); g.fillStyle = '#F4EBD6'; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = '#7A5230'; g.lineWidth = 10; g.strokeRect(6, 6, 500, 500);
  g.lineWidth = 5; for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(i * 128, 0); g.lineTo(i * 128, 512); g.stroke(); g.beginPath(); g.moveTo(0, i * 128); g.lineTo(512, i * 128); g.stroke(); }
  g.lineWidth = 2; for (let i = 1; i < 16; i++) { g.strokeStyle = 'rgba(122,82,48,0.5)'; g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, 512); g.stroke(); g.beginPath(); g.moveTo(0, i * 32); g.lineTo(512, i * 32); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function norenTex() {
  const c = document.createElement('canvas'); c.width = 768; c.height = 180;
  const g = c.getContext('2d'); g.fillStyle = '#1F2A4A'; g.fillRect(0, 0, 768, 180);
  for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#1F2A4A' : '#2B3A63'; g.fillRect(i * 128, 0, 128, 180); }
  g.fillStyle = '#F4EBD6'; g.beginPath(); g.arc(384, 90, 34, 0, 6.283); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function noteTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 340;
  const g = c.getContext('2d'); g.fillStyle = '#FBF6E6'; g.fillRect(0, 0, 512, 340);
  g.fillStyle = 'rgba(120,100,60,0.12)'; g.fillRect(0, 170, 512, 3);
  g.fillStyle = '#1B2A6E'; g.font = "700 46px 'Segoe Print', 'Ink Free', 'Comic Sans MS', cursive"; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('install hari ini', 256, 70);
  g.fillStyle = '#C0281F'; g.font = "800 150px 'Segoe Print', 'Ink Free', 'Comic Sans MS', cursive"; g.fillText('734', 256, 230);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
