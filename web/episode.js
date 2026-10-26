// The director of the 3D dialogue videos. It reads project.json (who the two characters are, which world, which format) and episodes/<slug>/episode.json (what happens when),
// and plays it in the world: characters/<id>/rig.js are the characters, worlds/<id>/world.js is the set.
//   ?ep=<slug>                          real-time preview with the voices (click to start)
//   ?ep=<slug>&shot=1&t=33.5&name=a.png one still at that moment (tools/shot.sh)
//   ?ep=<slug>&capture=1&from=0&to=1919 renders frames in order and posts them to serve.mjs (tools/capture.sh)
//   (no ep) a look preview of the set:  ?shot=1&bg=quiet&light=split&cam=left&left=sad&right=deadpan   (&chars=idLeft,idRight and &world=<id> override project.json)
// Times in episode.json: a number of seconds, or "L7.start-0.2" / "L22.end+0.5" (line 7 starts, line 22 ends), "end+0.9", "total-1".
// EVERY change of light must have a cause on screen: that is why lightEvents carry a "cause" text and the engine only offers causes that can be seen:
// a flickering desk-lamp bulb, a change of screen page, the phone rising, a moment outside, a character turning.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { extraShots } from './lib/shots.js';

const q = new URLSearchParams(location.search);
const slug = q.get('ep');
const shot = q.has('shot');
const capture = q.has('capture');
const BASE = '..';   // pages live in web/, everything else is one level up
const FPS = 30;

// the same random numbers every run, so every frame is identical no matter which process draws it (frames are rendered in parallel chunks)
let seed = 20261019;
Math.random = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };

const J = (url, fallback) => fetch(url).then((r) => (r.ok ? r.json() : fallback)).catch(() => fallback);
const PROJECT = (await J(`${BASE}/project.json`, null)) || (await J(`${BASE}/project.example.json`, {}));
const CHAR_IDS = q.get('chars') ? q.get('chars').split(',') : (PROJECT.characters || ['ayam', 'claude']);
const WORLD_ID = q.get('world') || PROJECT.world || 'bedroom';
const CHARS = await Promise.all(CHAR_IDS.slice(0, 2).map(async (id) => ({ id, cfg: await J(`${BASE}/characters/${id}/character.json`, null) })));
for (const c of CHARS) if (!c.cfg) throw new Error('characters/' + c.id + '/character.json not found');
const EP = slug ? await J(`${BASE}/episodes/${slug}/episode.json`, null) : { scene: {}, directions: [], pages: undefined };
if (slug && !EP) throw new Error('episodes/' + slug + '/episode.json not found');
if (EP && q.get('outside') && EP.outside) EP.outside = { ...EP.outside, type: q.get('outside'), ...(q.get('image') ? { image: q.get('image') } : {}) };   // preview of another moment outside, without editing the episode
const timings = slug ? await J(`${BASE}/episodes/${slug}/timings.json`, []) : [];
const lip = slug ? await J(`${BASE}/episodes/${slug}/lipsync.json`, { frames: [] }) : { frames: [] };
const lines = timings;
const N = lines.length;

// ---- time references
const lastEnd = N ? lines[N - 1].end : 0;
const TOTAL = EP.total ?? (lastEnd + (EP.tail ?? 4));
function T(x, fallback = 0) {
  if (x === undefined || x === null) return fallback;
  if (typeof x === 'number') return x;
  const m = /^(?:L(\d+)\.(start|end)|(end)|(total))\s*([+-]\s*\d+(?:\.\d+)?)?$/.exec(String(x).trim());
  if (!m) throw new Error('bad time reference: ' + x);
  const off = m[5] ? Number(m[5].replace(/\s/g, '')) : 0;
  if (m[1] !== undefined) { const ln = lines[Number(m[1])]; if (!ln) throw new Error('no line ' + m[1] + ' in ' + x); return ln[m[2]] + off; }
  return (m[3] ? lastEnd : TOTAL) + off;
}

// ---- the renderer
const W = window.innerWidth, H = window.innerHeight;
const LOOK = { exposure: 1.25, vignette: 0.42, vignetteStart: 0.3, vignetteEnd: 0.85, topShade: 0.3, bloom: [0.4, 0.7, 0.92], aperture: 0.0016, maxblur: 0.022, ...(EP.look || {}) };
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = LOOK.exposure;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const sc = EP.scene || {};
const pages = EP.pages || { idle: { type: 'code', theme: 'dark', lines: ['> ...'] } };
const worldMod = await import(`${BASE}/worlds/${WORLD_ID}/world.js`);
const NEON = EP.neon || (q.has('neon') ? { text: 'NEON' } : null);   // a neon sign on a building outside (the preview: &neon=<seconds since it switches on, negative = off>)
const studio = await worldMod.createWorld(scene, {
  neon: NEON, keys: !!EP.keys, counter: EP.counter || null, banner: EP.banner ? { ...EP.banner, alarmAt: EP.banner.alarmAt !== undefined ? T(EP.banner.alarmAt) : undefined } : null,
  base: BASE, bg: q.get('bg') || sc.bg, light: q.get('light') || sc.light || 'rembrandt',
  pages, phone: EP.phone, wall: EP.wall || [], props: EP.props || [], outside: EP.outside, episode: EP,
});
const ST = studio.stage;   // where the two characters stand: { y, z, scale, left: { x, yaw }, right: { x, yaw } }

// presets used by this episode: the base one plus every one a "preset" event blends into
const baseLight = q.get('light') || sc.light || 'rembrandt';
const events = (EP.lightEvents || []).map((e) => ({ ...e, at: T(e.at) })).sort((a, b) => a.at - b.at);
studio.lighting.prepare([baseLight, ...new Set(events.filter((e) => e.type === 'preset').map((e) => e.to))]);

const mulberry = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
async function makeChar(c, side, seed) {
  const mod = await import(`${BASE}/characters/${c.id}/${c.cfg.rig || 'rig.js'}`);
  const ch = mod.create(renderer, { rand: mulberry(seed), W, H, config: c.cfg });
  ch.group.position.set(ST[side].x, ST.y, ST.z);
  ch.group.rotation.y = ST[side].yaw;
  ch.group.scale.setScalar(ST.scale ?? 0.95);
  ch.setExpression(q.get(side) || c.cfg.defaultExpression || c.cfg.expressions[0], 100);
  scene.add(ch.group);
  return ch;
}
const left = await makeChar(CHARS[0], 'left', 11), right = CHARS[1] ? await makeChar(CHARS[1], 'right', 23) : null;   // the LEFT character is the lead: it hops, turns and daydreams at the end
for (const [n, p] of Object.entries(EP.expressions?.left || {})) left.defineExpression?.(n, p);   // an episode may invent its own faces: expressions: { left: { shock: { ...rig parameters } }, right: { ... } }
for (const [n, p] of Object.entries(EP.expressions?.right || {})) right?.defineExpression?.(n, p);
const ID_L = CHARS[0].id, ID_R = CHARS[1]?.id;
const DEF_L = CHARS[0].cfg.defaultExpression || CHARS[0].cfg.expressions[0];
const DEF_R = CHARS[1] ? (CHARS[1].cfg.defaultExpression || CHARS[1].cfg.expressions[0]) : null;

// ---- camera shots (portrait 9:16), relative to where the characters sit; an episode can add or override shots
const dy = ST.y - 0.2, dz = ST.z - 0.7;
const SHOTS = {   // a world gives its own; this is the fallback for a simple world
  ...extraShots(ST),
  wide: { pos: [0.0, 1.95 + dy + 0.5, 13.6], look: [0, 1.25 + dy + 0.9, dz], fov: 46 },
  left: { pos: [-0.3, 1.7 + dy, 10.5], look: [-1.35, 1.5 + dy, 0.7 + dz], fov: 24 },
  right: { pos: [0.8, 1.7 + dy, 13], look: [1.4, 1.1 + dy, 0.7 + dz], fov: 24 },
  right34: { pos: [4.8, 1.9 + dy, 10.5], look: [1.4, 1.0 + dy, 0.7 + dz], fov: 26 },
  ...(studio.shots || {}),
  ...(EP.shots || {}),
};
const FMT = PROJECT.format || 'portrait';
const FOV_SCALE = { portrait: 1, landscape: 0.55, square: 0.82 }[FMT] ?? 1;   // the shots are framed for portrait: a wider picture needs a narrower lens
const camera = new THREE.PerspectiveCamera(46 * FOV_SCALE, W / H, 0.1, 200);
const v3 = (a) => new THREE.Vector3(...a);
const smooth = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
const lerp = (a, b, k) => a + (b - a) * k;

// ---- post: depth of field, a soft glow, a thin visible vignette, a soft shade at the top where the subtitles sit, the fade. NO film grain (the owner dislikes the speckle)
const composer = new EffectComposer(renderer);
composer.setPixelRatio(1);
composer.setSize(W, H);
composer.addPass(new RenderPass(scene, camera));
const bokeh = new BokehPass(scene, camera, { focus: 8, aperture: LOOK.aperture, maxblur: LOOK.maxblur });
composer.addPass(bokeh);
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), ...LOOK.bloom));
const finish = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, amount: { value: LOOK.vignette }, v0: { value: LOOK.vignetteStart }, v1: { value: LOOK.vignetteEnd }, top: { value: LOOK.topShade }, fade: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: 'uniform sampler2D tDiffuse; uniform float amount; uniform float v0; uniform float v1; uniform float top; uniform float fade; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); float d = distance(vUv, vec2(0.5)); c.rgb *= 1.0 - amount * smoothstep(v0, v1, d); float t = smoothstep(0.58, 0.8, vUv.y) * (1.0 - smoothstep(0.88, 1.0, vUv.y)); c.rgb *= 1.0 - top * t; c.rgb *= fade; gl_FragColor = c; }',
});
composer.addPass(finish);
composer.addPass(new OutputPass());

// ---- the director's notes, per line
const D = Array.from({ length: N }, (_, i) => ({ cam: 'left', left: DEF_L, right: DEF_R, ...(EP.directions || [])[i] }));
const SEG = [];   // camera segments: { from, name, blend }
D.forEach((d, k) => { if (d.cam) SEG.push({ from: d.cut !== undefined ? T(d.cut) : lines[k].start - 0.3, name: d.cam, blend: d.blend ?? (k === 0 ? 1.1 : 0.08), move: d.move, roll: d.roll, focus: d.focus, dof: d.dof }); });
for (const c of EP.camExtra || []) SEG.push({ from: T(c.at), name: c.cam, blend: c.blend ?? 0.08, move: c.move, roll: c.roll, focus: c.focus, dof: c.dof });
SEG.sort((a, b) => a.from - b.from);
if (!SEG.length) SEG.push({ from: 0, name: q.get('cam') || 'wide', blend: 0.01 });
const screenEv = (EP.screen || []).map((s) => ({ at: T(s.at), page: s.page })).sort((a, b) => a.at - b.at);
const phoneAt = EP.phone ? T(EP.phone.at) : 1e9, phoneRise = EP.phone?.rise ?? 0.65;
const outAt = EP.outside ? T(EP.outside.at) : 1e9, outDur = EP.outside?.dur ?? 3.0;
// where the two characters stand: 'perch' (default) or places an episode defines: EP.places { name: { y, z, left: { x, yaw, pitch }, right: { x, yaw, pitch } } } and EP.stage [ { at, to } ] (they appear there at that moment: use it behind a camera cut)
const PLACES = { perch: { y: ST.y, z: ST.z, left: { x: ST.left.x, yaw: ST.left.yaw, pitch: 0 }, right: { x: ST.right?.x ?? 1.4, yaw: ST.right?.yaw ?? -0.18, pitch: 0 } }, ...(EP.places || {}) };
const STAGE = (EP.stage || []).map((s) => ({ at: T(s.at), to: s.to })).sort((a, b) => a.at - b.at);
let placeNow = 'perch';
// errands: each side can jump between its own spots on a timeline, e.g. EP.errands { right: [ { at, x, y, z, yaw } ] }. Every jump is an instant snap (a fast teleport), so put a camera cut or a camFx punch on it.
const ERRANDS = Object.fromEntries(Object.entries(EP.errands || {}).map(([side, list]) => [side, list.map((w) => ({ ...w, at: T(w.at) })).sort((a, b) => a.at - b.at)]));
const errandAt = (side, t) => { let w = null; for (const e of ERRANDS[side] || []) if (t >= e.at) w = e; return w; };
const end = EP.ending ? { turnAt: T(EP.ending.turnAt), lookUpAt: T(EP.ending.lookUpAt ?? EP.ending.turnAt), yaw: EP.ending.yaw ?? 3.0, pitch: EP.ending.pitch ?? -0.32, expression: EP.ending.expression ?? 'neutral', rate: EP.ending.rate ?? 1 } : null;

function poseOf(i, t) {   // a shot with a slow push-in while it lasts
  const sg = SEG[i], stop = i + 1 < SEG.length ? SEG[i + 1].from : TOTAL;
  const s = SHOTS[sg.name]; if (!s) throw new Error('unknown shot: ' + sg.name + ' (' + Object.keys(SHOTS).join(', ') + ')');
  const p = Math.min(1, Math.max(0, (t - sg.from) / Math.max(0.6, stop - sg.from)));
  const pos = v3(s.pos), look = v3(s.look), m = sg.move || {};   // move: { push (0.06 default, bigger = a stronger push-in), pull, orbit (degrees), rise (units), zoom, roll (radians) } over the length of the shot
  pos.lerp(look, ((m.push ?? 0.06) - (m.pull ?? 0)) * p);
  if (m.orbit) { const off = pos.clone().sub(look); off.applyAxisAngle(new THREE.Vector3(0, 1, 0), (m.orbit * Math.PI / 180) * p); pos.copy(look).add(off); }
  if (m.rise) pos.y += m.rise * p;
  return { pos, look, fov: s.fov * FOV_SCALE * (1 + (m.zoom || 0) * p), roll: (sg.roll || 0) + (m.roll || 0) * p, focus: sg.focus, dof: sg.dof };
}
function cameraAt(t) {
  let i = 0;
  for (let k = 0; k < SEG.length; k++) if (SEG[k].from <= t) i = k;
  const cur = poseOf(i, t);
  if (i > 0) {
    const prev = poseOf(i - 1, Math.min(t, SEG[i].from));
    const u = smooth((t - SEG[i].from) / SEG[i].blend);
    cur.pos.lerp(prev.pos, 1 - u); cur.look.lerp(prev.look, 1 - u); cur.fov = lerp(prev.fov, cur.fov, u); cur.roll = lerp(prev.roll, cur.roll, u);
  } else {
    const w = SHOTS.wide, u = smooth((t - SEG[0].from) / SEG[0].blend);
    cur.pos.lerp(v3(w.pos), 1 - u); cur.look.lerp(v3(w.look), 1 - u); cur.fov = lerp(w.fov * FOV_SCALE, cur.fov, u); cur.roll *= u;
  }
  cur.pos.x += Math.sin(t * 0.9) * 0.03; cur.pos.y += Math.sin(t * 1.3 + 1) * 0.02;   // a very small handheld drift
  return cur;
}

// ---- light: role factors from events, preset blends, the screen's own glow
const noise = (t) => 0.5 + 0.5 * Math.sin(t * 61) * Math.sin(t * 23.7 + 1.3);
function factorAt(role, t) {
  const ev = events.filter((e) => e.type !== 'preset' && (e.role ?? 'key') === role && e.at <= t);
  if (!ev.length) return 1;
  const e = ev[ev.length - 1];
  if (e.type === 'flicker') {
    const f = t - e.at, dur = e.dur ?? 1.7;
    return f < dur ? (e.floor ?? 0.12) + (e.amp ?? 0.55) * (noise(t) > 0.55 ? 1 : 0.15) : lerp(e.to ?? 0.42, 1, smooth((f - dur) / (e.recover ?? 9)));
  }
  if (e.type === 'level') { const start = factorAt(role, e.at - 1e-4); return lerp(start, e.to, smooth((t - e.at) / (e.over ?? 0.6))); }
  throw new Error('unknown light event: ' + e.type);
}
function presetsAt(t) {
  let a = baseLight, b = baseLight, k = 0;
  for (const e of events.filter((e) => e.type === 'preset')) {
    if (t < e.at) break;
    const u = (t - e.at) / (e.over ?? 1.0);
    if (u >= 1) { a = b = e.to; k = 0; } else { a = b; b = e.to; k = smooth(u); break; }
  }
  return [a, b, k];
}
let screenC = new THREE.Color('#8FB8FF'), screenI = 8;
const goalC = new THREE.Color();
function applyLights(t) {
  const [a, b, k] = presetsAt(t);
  const fk = factorAt('key', t);
  studio.lighting.apply(a, b, k, { key: fk, rim: factorAt('rim', t), fill: factorAt('fill', t), hemi: factorAt('hemi', t) });
  const ls = studio.lighting.role('screen');
  const g = studio.screen?.glow();
  if (ls && g) { goalC.set(g.c); screenC.lerp(goalC, 0.35); screenI = lerp(screenI, g.i, 0.35); ls.color.copy(screenC); ls.intensity = screenI * factorAt('screen', t); }
  if (EP.phone) studio.phone?.show(smooth((t - phoneAt) / phoneRise));
  if (EP.outside) studio.outside?.event(EP.outside.type, (t - outAt) / outDur);
  if (NEON) studio.neon?.show(q.has('neon') ? Number(q.get('neon')) : t - T(NEON.at));
}

const FX = (EP.camFx || []).map((f) => ({ ...f, at: T(f.at) }));
const tmpV = new THREE.Vector3(); let focusNow = null, dofNow = 1;
// ---- stepping through time (frame by frame, the same way for preview, still and capture)
let cur = 0, curLine = -2, hopStart = -9, yawNow = ST.left.yaw, yawGoal = ST.left.yaw, pitchNow = 0;
function lineAt(t) { let k = -1; for (let j = 0; j < N; j++) if (lines[j].start - 0.12 <= t) k = j; return k; }
const ACTS = (EP.acts || []).map((a) => ({ ...a, at: T(a.at), done: false })).sort((a, b) => a.at - b.at);   // gestures at a given moment: { at, who: 'left'|'right', name, dur, amp }
// ---- body acts. A rig may bring its own (rig.actNames: a wing flap, a shrug); every other act is a JSON recipe in assets/acts.json (+ episode.json actDefs) that works on ANY character.
const ACTLIB = { ...(await J(`${BASE}/assets/acts.json`, {})), ...(EP.actDefs || {}) }; delete ACTLIB._note;
const live = [];   // JSON acts playing now
const ZERO3 = [0, 0, 0], ONE3 = [1, 1, 1];
function doAct(side, name, dur, amp, t) {
  const ch = side === 'right' ? right : left; if (!ch || !name) return;
  if (ch.actNames?.includes(name)) { ch.act(name, dur); return; }
  const def = ACTLIB[name]; if (!def) throw new Error('unknown act: ' + name + ' (rig acts: ' + (ch.actNames || []).join(', ') + '; library: ' + Object.keys(ACTLIB).join(', ') + ')');
  live.push({ side, def, t0: t, dur: dur ?? def.dur, amp: amp ?? 1 });
}
function evalAct(a, t) {   // offsets { pos, rot, scl } of a JSON act, or null when it has finished
  const u = (t - a.t0) / a.dur; if (u >= 1) return null;
  if (u < 0) return { pos: ZERO3, rot: ZERO3, scl: ONE3 };
  const ks = a.def.keys, tt = u * a.def.dur;   // the keys are in the act's own seconds: they are stretched to the played duration
  let k = 0; while (k < ks.length - 2 && ks[k + 1].t <= tt) k++;
  const A = ks[k], B = ks[Math.min(k + 1, ks.length - 1)], e = smooth((tt - A.t) / Math.max(1e-6, B.t - A.t));
  const mix = (n, d) => (A[n] || d).map((x, j) => lerp(x, (B[n] || d)[j], e));
  return { pos: mix('pos', ZERO3).map((x) => x * a.amp), rot: mix('rot', ZERO3).map((x) => x * a.amp), scl: mix('scl', ONE3).map((x) => 1 + (x - 1) * a.amp) };
}
const ALIVE = EP.alive ?? PROJECT.alive ?? 1;   // 0 = off, 1 = normal, 1.5 = more energetic: a little life on top of every acting choice
let curWho = null, curLevel = 0;
function offsets(side, t) {
  const o = { pos: [0, 0, 0], rot: [0, 0, 0], scl: [1, 1, 1] };
  for (let n = live.length - 1; n >= 0; n--) {
    const a = live[n]; if (a.side !== side) continue;
    const e = evalAct(a, t); if (!e) { live.splice(n, 1); continue; }
    for (let j = 0; j < 3; j++) { o.pos[j] += e.pos[j]; o.rot[j] += e.rot[j]; o.scl[j] *= e.scl[j]; }
  }
  if (ALIVE > 0) {
    const ph = side === 'right' ? 1.7 : 0, speaking = (side === 'left' ? ID_L : ID_R) === curWho;
    if (speaking) { o.rot[2] += 0.03 * ALIVE * curLevel * Math.sin(t * 6.1 + ph); o.rot[0] += 0.03 * ALIVE * curLevel * Math.sin(t * 5.3 + ph); o.pos[1] += 0.02 * ALIVE * curLevel; }
    else { o.rot[2] += 0.012 * ALIVE * Math.sin(t * 0.9 + ph); o.rot[0] += 0.008 * ALIVE * Math.sin(t * 0.7 + ph); }   // listening: a slow sway, never frozen
  }
  return o;
}
function put(ch, B, o) {   // base pose + act offsets; act rotations pivot around the middle of the body, not the feet
  const sc = ST.scale ?? 0.95, er = new THREE.Euler(o.rot[0], o.rot[1], o.rot[2]), v = new THREE.Vector3(0, 0.9 * sc, 0), v2 = v.clone().applyEuler(er);
  ch.group.rotation.set(B.rx + o.rot[0], B.ry + o.rot[1], o.rot[2]);
  ch.group.scale.set(sc * o.scl[0], sc * o.scl[1], sc * o.scl[2]);
  ch.group.position.set(B.x + o.pos[0] * sc + (v.x - v2.x), B.y + o.pos[1] * sc + (v.y - v2.y), B.z + o.pos[2] * sc + (v.z - v2.z));
}
const ACTED = new Set();   // lines whose listener has an explicit act
function queueAct(side, name, dur, amp, at) { ACTS.push({ at, who: side, name, dur, amp, done: false }); }
if (EP.autoReact !== false && PROJECT.autoReact !== false) {   // the one who listens reacts a little at the end of a line, unless the episode already acts there
  for (let i = 0; i < N; i++) {
    const d = D[i], side = lines[i].who === ID_L ? 'right' : 'left';
    if ((side === 'left' ? d.leftAct : d.rightAct) || d.act?.[side] || i % 3 === 2 || !CHARS[1]) continue;
    const txt = lines[i].text || '', name = /\?\s*$/.test(txt) ? 'tilt_curious' : /!/.test(txt) ? 'recoil_small' : 'nod_small';
    queueAct(side, name, undefined, 0.9, Math.max(lines[i].start + 0.3, lines[i].end - 0.4));
  }
}
ACTS.sort((a, b) => a.at - b.at);
function stepFrame() {
  const t = cur / FPS;
  for (const a of ACTS) if (!a.done && t >= a.at) { a.done = true; doAct(a.who === 'right' ? 'right' : 'left', a.name, a.dur, a.amp, t); }
  for (const s of screenEv) if (t >= s.at) studio.screen?.setPage(s.page, s.at);
  const i = lineAt(t);
  if (i !== curLine) {
    curLine = i;
    if (i >= 0) { const d = D[i]; left.setExpression(d.left, 9); right?.setExpression(d.right, 9); if (d.hop) hopStart = t; left.setPose?.(d.leftPose || 'stand'); right?.setPose?.(d.rightPose || 'stand'); const act = d.act || {}, aL = d.leftAct || act.left, aR = d.rightAct || act.right; if (aL) queueAct('left', aL, d.leftActDur, d.leftActAmp, t + (d.actAt || 0)); if (aR) queueAct('right', aR, d.rightActDur, d.rightActAmp, t + (d.actAt || 0)); yawGoal = d.turn !== undefined ? d.turn : ST.left.yaw; }
  }
  if (end && t >= end.turnAt) yawGoal = end.yaw;
  const d = i >= 0 ? D[i] : { look: undefined };
  const f = lip.frames[Math.min(cur, lip.frames.length - 1)] || { who: null, level: 0 };
  curWho = f.who; curLevel = f.level;
  left.setTalkLevel(f.who === ID_L ? f.level : 0);
  right?.setTalkLevel(f.who === ID_R ? f.level : 0);
  const lk = d.look || [0.7, 0];
  left.look(f.who === ID_L ? lk[0] : 0.8, f.who === ID_L ? lk[1] : (d.look ? lk[1] * 0.4 : 0));   // the lead keeps looking at whoever speaks
  right?.look(f.who === ID_L ? -0.9 : -0.2, 0);
  if (end && t >= end.turnAt) left.setExpression(end.expression, 4);
  yawNow = lerp(yawNow, yawGoal, 1 - Math.exp(-4.5 * (end?.rate ?? 1) / FPS));   // ending.rate < 1 = a slower turn
  pitchNow = lerp(pitchNow, end && t >= end.lookUpAt ? end.pitch : 0, 1 - Math.exp(-3 * (end?.rate ?? 1) / FPS));   // looking up, daydreaming
  const hu = (t - hopStart) / 0.55;
  let LB = { x: ST.left.x, y: ST.y + (hu >= 0 && hu <= 1 ? 0.32 * Math.sin(Math.PI * hu) : 0), z: ST.z, ry: yawNow, rx: pitchNow };
  let RB = { x: ST.right?.x ?? 1.4, y: ST.y, z: ST.z, ry: ST.right?.yaw ?? -0.18, rx: 0 };
  if (STAGE.length) {
    let pn = 'perch'; for (const e of STAGE) if (t >= e.at) pn = e.to;
    const PL = PLACES[pn]; if (!PL) throw new Error('unknown place: ' + pn + ' (' + Object.keys(PLACES).join(', ') + ')');
    if (pn !== 'perch') {
      LB = { x: PL.left.x, y: PL.y + (LB.y - ST.y), z: PL.z, ry: PL.left.yaw, rx: PL.left.pitch || 0 }; RB = { x: PL.right.x, y: PL.y, z: PL.z, ry: PL.right.yaw, rx: PL.right.pitch || 0 };
      yawNow = yawGoal = PL.left.yaw;
    } else if (placeNow !== 'perch') { yawNow = yawGoal = ST.left.yaw; LB.ry = yawNow; }   // back to the perch
    placeNow = pn;
  }
  const wl = errandAt('left', t), wr = errandAt('right', t);   // an errand spot replaces the seat for that character only
  if (wl) LB = { ...LB, x: wl.x, y: wl.y ?? ST.y, z: wl.z ?? ST.z, ry: wl.yaw ?? 0, rx: 0 };
  if (wr) RB = { ...RB, x: wr.x, y: wr.y ?? ST.y, z: wr.z ?? ST.z, ry: wr.yaw ?? 0, rx: 0 };
  put(left, LB, offsets('left', t));
  if (right) put(right, RB, offsets('right', t));
  left.update(1 / FPS);
  right?.update(1 / FPS);
  studio.update(t);
  applyLights(t);
  const c = cameraAt(t);
  for (const f of FX) {   // camera effects: { type: 'shake' | 'punch' | 'roll', at, dur, amp | amount }
    const u = (t - f.at) / (f.dur ?? 0.4); if (u < 0 || u > 1) continue; const env = Math.sin(Math.PI * u);
    if (f.type === 'shake') { c.pos.x += (f.amp ?? 0.08) * env * Math.sin(t * 61); c.pos.y += (f.amp ?? 0.08) * env * Math.sin(t * 47 + 1); }
    else if (f.type === 'punch') c.fov *= 1 - (f.amount ?? 0.12) * env;
    else if (f.type === 'roll') c.roll += (f.amount ?? 0.1) * env;
  }
  camera.position.copy(c.pos); camera.lookAt(c.look); camera.rotateZ(c.roll || 0); camera.fov = c.fov; camera.updateProjectionMatrix();
  let wantFocus = c.pos.distanceTo(c.look);   // focus: 'left' | 'right' (rack focus on that character) or a distance
  if (c.focus === 'left' || c.focus === 'right') { const ch = c.focus === 'right' ? right : left; if (ch) { ch.group.getWorldPosition(tmpV); tmpV.y += 1.1 * (ST.scale ?? 0.95); wantFocus = c.pos.distanceTo(tmpV); } }
  else if (typeof c.focus === 'number') wantFocus = c.focus;
  focusNow = c.focus === undefined || focusNow === null ? wantFocus : lerp(focusNow, wantFocus, 1 - Math.exp(-9 / FPS));
  bokeh.uniforms.focus.value = focusNow;
  dofNow = lerp(dofNow, c.dof ?? 1, 1 - Math.exp(-6 / FPS)); bokeh.uniforms.aperture.value = LOOK.aperture * dofNow;   // dof > 1: shallower (a close-up), < 1: sharper
  finish.uniforms.fade.value = Math.min(1, Math.max(0, (TOTAL - t) / (EP.fadeOut ?? 1.3))) * Math.min(1, t / 0.5 + 0.2);
  cur++;
}

if (shot) {
  left.freeze?.(); right?.freeze?.();
  const tt = Number(q.get('t') || 0);
  while (cur / FPS < tt) stepFrame();
  if (!slug || q.get('cam')) {   // a look preview, or a still from a chosen shot
    const s = SHOTS[q.get('cam') || 'wide'];
    camera.position.set(...s.pos); camera.lookAt(...s.look); camera.fov = s.fov * FOV_SCALE; camera.updateProjectionMatrix();
    bokeh.uniforms.focus.value = camera.position.distanceTo(v3(s.look));
    for (let k = 0; k < 3; k++) { left.update(0.016); right?.update(0.016); studio.update(tt || 3); }
  }
  if (NEON && q.has('neon')) studio.neon?.show(Number(q.get('neon')));
  composer.render();
  renderer.domElement.toBlob((b) => fetch('/save?name=' + encodeURIComponent(q.get('name') || 'shot.png'), { method: 'POST', body: b }));
} else if (capture) {
  const from = Number(q.get('from') || 0), to = Number(q.get('to') || Math.ceil(TOTAL * FPS) - 1);
  const t0 = performance.now();
  for (let f = 0; f <= to; f++) {
    stepFrame();   // the state is always advanced, so a chunk starting at `from` is in exactly the same state as a full run
    if (f < from) continue;
    composer.render();
    const blob = await new Promise((r) => renderer.domElement.toBlob(r, 'image/png'));
    await fetch(`/frame?ep=${slug}&n=${f}`, { method: 'POST', body: blob });
  }
  await fetch(`/done?ep=${slug}&from=${from}&to=${to}&sec=${Math.round((performance.now() - t0) / 1000)}`, { method: 'POST', body: 'x' });
} else {
  const audio = new Audio(`${BASE}/episodes/${slug}/dialog.mp3`);
  const msg = document.createElement('div');
  msg.textContent = 'Click to play';
  msg.style.cssText = 'position:fixed;inset:0;display:grid;place-items:center;color:#fff;font:600 22px "Segoe UI",sans-serif;background:rgba(0,0,0,.5);cursor:pointer';
  document.body.appendChild(msg);
  msg.onclick = () => { msg.remove(); audio.play(); };
  (function loop() {
    const target = Math.floor(audio.currentTime * FPS);
    while (cur <= target && cur < TOTAL * FPS) stepFrame();
    composer.render();
    requestAnimationFrame(loop);
  })();
}
window.episode = { studio, left, right, stepFrame, EP };
