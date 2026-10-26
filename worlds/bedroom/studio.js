// The bedroom set of the 3D dialogue videos, built in layers so there is real depth:
//   camera -> the open laptop (the two characters sit on the top edge of its lid) -> the desk -> the wall with a REAL window
//   (frame, panes, glass, a thick wall reveal, a sill, curtains) -> the outside in layers (close roof or trees, middle blocks, far sky).
// The light is a rig placed by angle around the chicken's face (assets/lighting/presets.json). Presets can be blended in time, and every
// change of light must have a visible cause in the scene (the screen changes page, the desk lamp flickers, the phone lights up, an event outside).
//
//   const studio = await createStudio(scene, { base: '..', bg: 'quiet', light: 'rembrandt', pages, phone: {image}, wall: [], props: [] });
//   studio.update(t);   studio.screen.setPage('viral', t);   studio.phone.show(0..1);   studio.outside.event('car'|'star'|'ufo', 0..1);
//   studio.lighting.prepare(['rembrandt','split']);  studio.lighting.apply('rembrandt','split', k, factors);   studio.perch  // top edge of the lid
import * as THREE from 'three';

const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const std = (color, rough = 0.9, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, ...extra });
const glow = (color, k = 2.2) => { const m = new THREE.MeshBasicMaterial({ color, toneMapped: false }); m.color.multiplyScalar(k); return m; };
const smoothstep = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const lerp = (a, b, k) => a + (b - a) * k;

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return { c, g, t };
}
function softDot(color = '255,235,200') {
  return canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, `rgba(${color},1)`); gr.addColorStop(1, `rgba(${color},0)`); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }).t;
}
const loadImage = (url) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('image not found: ' + url)); i.src = url; });

export const BACKGROUNDS = { sepi: 'kota sepi (menara lampu merah, atap tetangga, bulan)', jalan: 'lampu jalan, pohon, mobil jauh', bulan: 'bulan besar, bintang, awan, atap', hujan: 'kaca basah hujan, bokeh lampu' };
export const OUTSIDE_EVENTS = ['car', 'star', 'ufo'];

// ---- screen themes: what each kind of page looks like and how it lights the characters (the glow bounces off the keyboard deck)
const THEMES = {
  dark: { bg: '#15182A', tabBg: '#0E1020', tabFg: '#DDE6FF', tabMute: '#7C86A4', num: '#8FA2D8', cap: '#5C6A9A', ink: '#9AA3B8', bright: 1.15, glow: { c: '#8FB8FF', i: 8 } },
  dim: { bg: '#0F1220', tabBg: '#0E1020', tabFg: '#DDE6FF', tabMute: '#7C86A4', num: '#8FA2D8', cap: '#5C6A9A', ink: '#7C86A4', bright: 1.1, glow: { c: '#6F8FD8', i: 3 } },
  warm: { bg: '#FFF4DA', tabBg: '#E9EEF8', tabFg: '#27304A', tabMute: '#6B7590', num: '#FF8A2A', cap: '#6B4A27', ink: '#27304A', bright: 0.5, glow: { c: '#FFE3A8', i: 15 } },
  bright: { bg: '#F5F8FF', tabBg: '#E9EEF8', tabFg: '#27304A', tabMute: '#6B7590', num: '#27304A', cap: '#6B7590', ink: '#1B2236', bright: 0.42, glow: { c: '#EAF2FF', i: 17 } },
};
const FONT = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';
const MONO = 'Consolas, "DejaVu Sans Mono", "Courier New", monospace';

export async function createStudio(scene, cfg = {}) {
  const base = cfg.base ?? '..';
  const bg = cfg.bg ?? 'quiet';
  const PRESETS = (await fetch(`${base}/assets/lighting/presets.json`).then((r) => r.json())).presets;
  const group = new THREE.Group();
  group.name = 'Studio-' + bg;
  scene.add(group);
  const R = rng(4242);
  const updaters = [];
  scene.background = new THREE.Color('#04061A');
  scene.fog = new THREE.FogExp2('#06091E', 0.011);

  // ---------------------------------------------------------------- the desk
  const wood = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#3B2A22'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 220; i++) { g.strokeStyle = `rgba(0,0,0,${0.04 + R() * 0.06})`; g.lineWidth = 1 + R() * 2; const y = R() * h; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y + (R() - 0.5) * 10); g.stroke(); }
  });
  wood.t.wrapS = wood.t.wrapT = THREE.RepeatWrapping; wood.t.repeat.set(3, 2);
  const desk = new THREE.Mesh(new THREE.BoxGeometry(40, 0.4, 24), std('#ffffff', 0.9, { map: wood.t }));
  desk.position.set(0, 0, 2); desk.receiveShadow = true; group.add(desk);

  // ---------------------------------------------------------------- the laptop: the characters sit on the top edge of the lid
  const metal = std('#2B2F3A', 0.55);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.2, 4.7), metal); deck.position.set(0, 0.3, 3.0); deck.castShadow = deck.receiveShadow = true; group.add(deck);
  const kb = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 2.6), std('#14161F', 0.7, { emissive: '#1E2C55', emissiveIntensity: 0.6 })); kb.rotation.x = -Math.PI / 2; kb.position.set(0, 0.405, 3.3); group.add(kb);
  if (cfg.keys) {   // real keycaps on the deck (only when the episode asks: cfg.keys), a faint backlight, a long space bar and a trackpad
    const capM = std('#1A1D29', 0.55, { emissive: '#27386E', emissiveIntensity: 0.55 });
    const spec = []; const pitch = 0.46, zs = [2.35, 2.78, 3.21, 3.64];
    zs.forEach((z) => { for (let i = 0; i < 13; i++) spec.push([-2.76 + i * pitch, z, 0.38]); });
    for (let i = 0; i < 3; i++) spec.push([-2.76 + i * 0.5, 4.07, 0.44]); for (let i = 0; i < 3; i++) spec.push([1.45 + i * 0.5, 4.07, 0.44]); spec.push([-0.1, 4.07, 2.2]);
    const caps = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.1, 0.34), capM, spec.length); const m4 = new THREE.Matrix4();
    spec.forEach(([x, z, w], i) => { m4.makeScale(w, 1, 1); m4.setPosition(x, 0.47, z); caps.setMatrixAt(i, m4); }); caps.castShadow = true; group.add(caps);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.03, 0.62), std('#222637', 0.4, { emissive: '#1B2850', emissiveIntensity: 0.4 })); pad.position.set(0, 0.425, 4.42); group.add(pad);
  }
  const hinge = new THREE.Group(); hinge.position.set(0, 0.4, 0.7); hinge.rotation.x = -0.2; group.add(hinge);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(7.2, 4.8, 0.14), metal); lid.position.set(0, 2.4, 0); lid.castShadow = true; hinge.add(lid);
  const scr = canvasTex(1024, 640, () => {});
  const sm = new THREE.MeshBasicMaterial({ map: scr.t, toneMapped: false }); sm.color.setScalar(1.15);
  const display = new THREE.Mesh(new THREE.PlaneGeometry(6.8, 4.25), sm); display.position.set(0, 2.4, 0.075); hinge.add(display);
  const perch = { y: 0.4 + 4.8 * Math.cos(0.2) + 0.07, z: 0.7 - 4.8 * Math.sin(0.2) };   // the top edge of the lid: where the characters sit

  // ---------------------------------------------------------------- the laptop screen: pages, each one with a theme and a glow
  const specs = cfg.pages || { idle: { type: 'text', theme: 'dark', title: '', lines: [] } };
  const imgs = {};
  for (const [name, p] of Object.entries(specs)) if (p.type === 'image' && p.src) imgs[name] = await loadImage(`${base}/${p.src}`);
  const vids = {};   // a video page: numbered frames dir/f_0001.jpg ... played from the moment the page is switched to (p.fps, default 30), the last frame stays
  for (const [name, p] of Object.entries(specs)) if (p.type === 'video') vids[name] = await Promise.all(Array.from({ length: p.count }, (_, i) => loadImage(`${base}/${p.dir}/f_${String(i + 1).padStart(4, '0')}.jpg`)));
  const tabsOf = (g, p, th) => {
    const tabs = p.tabs ?? ['Home', 'Notes', 'Browser'];
    if (!tabs.length) return;
    g.fillStyle = th.tabBg; g.fillRect(0, 0, 1024, 48);
    g.font = `600 20px ${FONT}`;
    let x = 24;
    tabs.forEach((n, i) => { const px = tabs.length === 3 ? [24, 150, 290][i] : x; g.fillStyle = i === 0 ? th.tabFg : th.tabMute; g.fillText(n, px, 32); x += g.measureText(n).width + 46; });
  };
  const wrapText = (g, text, x, y, maxW, lh) => { const words = String(text).split(' '); let line = ''; for (const w of words) { const t2 = line ? line + ' ' + w : w; if (g.measureText(t2).width > maxW && line) { g.fillText(line, x, y); y += lh; line = w; } else line = t2; } if (line) g.fillText(line, x, y); return y + lh; };
  const DRAW = {
    code: (g, p, th, t, lt) => {   // lines typed one after another; optionally a last request typed with a spinner
      g.fillStyle = th.bg; g.fillRect(0, 0, 1024, 640); tabsOf(g, p, th);
      const lines = (p.lines || []).map((l, i) => (typeof l === 'string' ? { t: l, c: i === 0 ? '#9CC4FF' : th.ink } : l));
      g.font = `24px ${MONO}`;
      lines.forEach((ln, i) => { const n = p.full ? ln.t.length : Math.min(ln.t.length, Math.max(0, Math.floor((lt - (p.delay ?? 0.4) - i * (p.step ?? 1.0)) * (p.speed ?? 22)))); g.fillStyle = ln.c || th.ink; g.fillText(ln.t.slice(0, n), 40, 110 + i * 44); });
      if (p.request) {
        const n = Math.min(p.request.length, Math.max(0, Math.floor(lt * (p.requestSpeed ?? 14))));
        g.fillStyle = '#9CC4FF'; g.fillText(p.request.slice(0, n) + (n < p.request.length && Math.floor(lt * 3) % 2 ? '▌' : ''), 40, 110 + lines.length * 44);
        if (p.spinner && n >= p.request.length) { g.lineWidth = 9; g.lineCap = 'round'; g.strokeStyle = 'rgba(120,180,255,0.25)'; g.beginPath(); g.arc(850, 470, 46, 0, 6.28); g.stroke(); g.strokeStyle = '#8FC4FF'; g.beginPath(); g.arc(850, 470, 46, lt * 4, lt * 4 + 4.2); g.stroke(); }
      }
    },
    number: (g, p, th, t, lt) => {  // a big number (counting up if asked), a caption, optional bars or floating hearts, optional lines of small text
      g.fillStyle = th.bg; g.fillRect(0, 0, 1024, 640); tabsOf(g, p, th);
      const val = p.count ? Math.min(p.value, Math.floor(lt * (p.countSpeed ?? 110))) : p.value;
      const right = p.layout === 'right';
      if (p.bars) { g.fillStyle = '#31406E'; for (let i = 0; i < 14; i++) { const h = i === 13 ? 36 : 6 + (i % 3) * 4; g.fillRect(70 + i * 58, 540 - h, 36, h); } }
      g.fillStyle = th.num; g.font = `700 ${right ? 220 : 190}px ${FONT}`; g.fillText(val + (p.unit || ''), right ? 440 : 70, right ? 400 : 330);
      g.fillStyle = th.cap; g.font = `600 34px ${FONT}`; g.fillText(p.caption || '', right ? 440 : 80, right ? 450 : 385);
      if (p.hearts) for (let i = 0; i < 5; i++) { const y = 470 - ((lt * 90 + i * 70) % 330) + 160; g.fillStyle = `rgba(255,90,120,${Math.max(0, 0.9 - (y - 140) / 500)})`; g.font = '44px sans-serif'; g.fillText('♥', 640 + (i % 3) * 90 + Math.sin(lt * 3 + i) * 10, y); }
      g.fillStyle = th.ink; g.font = `28px ${FONT}`; (p.sub || []).forEach((s, i) => g.fillText(s, 70, 470 + i * 45));
    },
    profile: (g, p, th, t, lt) => {  // a social profile: round avatar, name, followers, a bio box (empty = dashed box with a blinking cursor), a link
      g.fillStyle = th.bg; g.fillRect(0, 0, 1024, 640); tabsOf(g, p, th);
      g.fillStyle = '#FFEBC2'; g.beginPath(); g.arc(150, 190, 70, 0, 6.28); g.fill(); g.fillStyle = '#2A1B14'; g.fillRect(120, 170, 14, 20); g.fillRect(166, 170, 14, 20); g.fillStyle = '#FFB62D'; g.fillRect(138, 200, 24, 14);
      g.fillStyle = th.ink; g.font = `700 46px ${FONT}`; g.fillText(p.name || '', 260, 170); g.fillStyle = th.tabMute; g.font = `30px ${FONT}`; g.fillText(p.followers || '', 260, 215);
      if (!p.bio) { g.strokeStyle = '#B7C0D8'; g.setLineDash([12, 10]); g.lineWidth = 3; g.strokeRect(70, 300, 880, 130); g.setLineDash([]); g.fillStyle = '#9AA6C4'; g.font = `28px ${FONT}`; g.fillText(p.bioLabel || 'Bio', 90, 340); if (Math.floor(lt * 2) % 2 === 0) { g.fillStyle = th.tabFg; g.fillRect(90, 360, 3, 40); } }
      else { g.fillStyle = th.ink; g.font = `28px ${FONT}`; wrapText(g, p.bio, 70, 330, 880, 40); }
      g.fillStyle = '#B7C0D8'; g.font = `26px ${FONT}`; g.fillText(p.link || '', 70, 490);
    },
    image: (g, p, th, t, lt, name) => {  // a picture (screenshot, photo, chart) fitted into the screen
      g.fillStyle = p.bgColor || th.bg; g.fillRect(0, 0, 1024, 640); tabsOf(g, p, th);
      const im = imgs[name]; if (!im) return;
      const top = p.tabs && p.tabs.length === 0 ? 0 : 48, H = 640 - top, k = (p.fit === 'cover' ? Math.max : Math.min)(1024 / im.width, H / im.height);
      g.drawImage(im, (1024 - im.width * k) / 2, top + (H - im.height * k) / 2, im.width * k, im.height * k);
      if (p.caption) { g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(0, 590, 1024, 50); g.fillStyle = '#fff'; g.font = `600 26px ${FONT}`; g.fillText(p.caption, 24, 624); }
    },
    video: (g, p, th, t, lt, name) => {   // numbered frames of a screen recording, fitted like an image
      g.fillStyle = p.bgColor || th.bg; g.fillRect(0, 0, 1024, 640); tabsOf(g, p, th);
      const fr = vids[name], im = fr[Math.max(0, Math.min(fr.length - 1, Math.floor(lt * (p.fps ?? 30))))];
      const top = p.tabs && p.tabs.length === 0 ? 0 : 48, H = 640 - top, k = (p.fit === 'cover' ? Math.max : Math.min)(1024 / im.width, H / im.height);
      g.drawImage(im, (1024 - im.width * k) / 2, top + (H - im.height * k) / 2, im.width * k, im.height * k);
    },
    loginapp: (g, p, th, t, lt) => {   // a login page in a browser: p.hide 'login'|'daftar' (a button vanishes p.at s after the page starts, with a console error); p.restore 'login'|'daftar'|'both' (it pops back in with a green "fixed")
      const norm = (v) => (v === 'register' ? 'daftar' : v); p = { ...p, hide: norm(p.hide), restore: norm(p.restore) };   // 'register' = 'daftar'
      const X = { title: 'Welcome', sub: 'Sign in or create an account', email: 'email@example.com', login: 'Login', register: 'Sign up', fixed: 'Fixed', url: 'localhost:3000/login', ...(p.texts || {}) };   // every text of the page can be changed (and translated) with p.texts
      const cl = (x) => Math.max(0, Math.min(1, x)), rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
      g.fillStyle = '#EAEEF7'; g.fillRect(0, 0, 1024, 640);
      g.fillStyle = '#D7DDEB'; g.fillRect(0, 0, 1024, 56); g.fillStyle = '#FFFFFF'; rr(150, 10, 724, 36, 18); g.fill(); g.fillStyle = '#6B7488'; g.font = `20px ${FONT}`; g.fillText(X.url, 178, 34);
      g.fillStyle = 'rgba(40,50,90,0.12)'; rr(318, 108, 400, 460, 22); g.fill();
      g.fillStyle = '#FFFFFF'; rr(312, 96, 400, 460, 22); g.fill();
      g.fillStyle = '#1B2240'; g.font = `700 34px ${FONT}`; g.textAlign = 'center'; g.fillText(X.title, 512, 160); g.fillStyle = '#7A839B'; g.font = `20px ${FONT}`; g.fillText(X.sub, 512, 192);
      g.fillStyle = '#F2F4FA'; rr(352, 222, 320, 50, 12); g.fill(); rr(352, 288, 320, 50, 12); g.fill();
      g.fillStyle = '#A6AEC4'; g.font = `20px ${FONT}`; g.textAlign = 'left'; g.fillText(X.email, 372, 253); g.fillText('••••••••', 372, 319);
      const state = (name) => {   // scale of a button 0..1 (+ overshoot when it pops back)
        let sc = 1;
        if (p.restore && (p.restore === name || p.restore === 'both')) { const u = cl(lt / 0.4); sc = u < 1 ? 1 + 2.7 * Math.pow(u - 1, 3) + 1.7 * Math.pow(u - 1, 2) : 1; sc = Math.max(0, sc * (u > 0 ? 1 : 0)); if (u === 0) sc = 0; }
        if (p.hide === name) { const a = p.at ?? 0.6; sc = lt < a ? 1 : 1 - cl((lt - a) / 0.22); }
        return sc;
      };
      const btn = (name, label, y, fill, ink, stroke) => {
        const sc = state(name), w = 320, h = 56, cx = 512, cy = y + h / 2;
        if (sc > 0.01) { g.save(); g.translate(cx, cy); g.scale(sc, sc); g.globalAlpha = Math.min(1, sc); if (fill) { g.fillStyle = fill; rr(-w / 2, -h / 2, w, h, 14); g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = 3; rr(-w / 2, -h / 2, w, h, 14); g.stroke(); } g.fillStyle = ink; g.font = `700 24px ${FONT}`; g.textAlign = 'center'; g.fillText(label, 0, 8); g.restore(); }
        else { g.save(); g.strokeStyle = '#D5DAEA'; g.setLineDash([8, 8]); g.lineWidth = 2; rr(cx - w / 2, y, w, h, 14); g.stroke(); g.restore(); }
        if (p.hide === name && lt >= (p.at ?? 0.6) && lt < (p.at ?? 0.6) + 0.4) {   // a little puff where it was
          const u = (lt - (p.at ?? 0.6)) / 0.4; g.save(); g.globalAlpha = 1 - u; g.strokeStyle = '#8FA3FF'; g.lineWidth = 4; for (let k = 0; k < 8; k++) { const a = k * 0.785 + 0.3, r1 = 30 + 90 * u; g.beginPath(); g.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1 * 0.5); g.lineTo(cx + Math.cos(a) * (r1 + 14), cy + Math.sin(a) * (r1 + 14) * 0.5); g.stroke(); } g.restore();
        }
      };
      btn('login', X.login, 366, '#3B6CF6', '#FFFFFF', null);
      btn('daftar', X.register, 440, null, '#3B6CF6', '#3B6CF6');
      g.textAlign = 'left';
      const hiddenNow = p.hide && lt >= (p.at ?? 0.6);
      if (hiddenNow) { const u = cl((lt - (p.at ?? 0.6)) / 0.2); g.fillStyle = `rgba(30,12,18,${0.92 * u})`; g.fillRect(0, 590, 1024, 50); g.fillStyle = `rgba(255,110,120,${u})`; g.font = `600 22px ${FONT}`; g.fillText(`Uncaught ReferenceError: ${p.hide} is not defined`, 24, 622); }
      if (p.restore && lt > 0.25 && lt < 2.2) { const u = cl((lt - 0.25) / 0.2) * (1 - cl((lt - 1.8) / 0.4)); g.fillStyle = `rgba(32,160,90,${u})`; rr(736, 80, 240, 52, 14); g.fill(); g.fillStyle = `rgba(255,255,255,${u})`; g.font = `700 22px ${FONT}`; g.fillText('✓ ' + X.fixed, 756, 114); }
    },
    installchart: (g, p, th, t, lt) => {   // an install chart: a green line grows from 0 to p.value (the y axis goes up to p.target, so it looks small), then a faint grey dashed projection climbs to a target flag
      const cl = (x) => Math.max(0, Math.min(1, x)), ease = (x) => 1 - Math.pow(1 - x, 3);
      const T = { title: 'Install aplikasi', target: 'Target 10.000 install', xlabel: '30 hari terakhir', ...(p.texts || {}) };
      const val = p.value ?? 450, tgt = p.target ?? 10000, dur = p.dur ?? 2.2, X0 = 130, X1 = 930, Y0 = 520, Y1 = 150, tipX = X0 + (X1 - X0) * 0.36;
      const yOf = (v) => Y0 - (Y0 - Y1) * v / tgt, fmt = (n) => Math.round(n).toLocaleString('id-ID');
      g.fillStyle = '#0A0E19'; g.fillRect(0, 0, 1024, 640);
      g.textAlign = 'left'; g.fillStyle = '#C9D3F2'; g.font = `700 34px ${FONT}`; g.fillText(T.title, 70, 84);
      g.font = `20px ${FONT}`; g.fillStyle = '#6F7A99'; for (let k = 0; k <= 4; k++) { const y = Y0 - (Y0 - Y1) * k / 4; g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(X0, y, X1 - X0, 1.5); g.fillStyle = '#6F7A99'; g.textAlign = 'right'; g.fillText(fmt(tgt * k / 4), X0 - 14, y + 7); }
      g.textAlign = 'center'; g.fillText(T.xlabel, (X0 + X1) / 2, 575);
      const u = ease(cl(lt / dur)), N = 48, last = Math.floor(N * u), pts = [];
      for (let i = 0; i <= last; i++) { const f = i / N, v = val * Math.pow(f, 1.5) * (1 + 0.06 * Math.sin(i * 1.9)) * (i === N ? 1 / (1 + 0.06 * Math.sin(N * 1.9)) : 1); pts.push([X0 + (tipX - X0) * f, yOf(Math.min(val, v))]); }
      if (pts.length > 1) {
        const gr = g.createLinearGradient(0, Y1, 0, Y0); gr.addColorStop(0, 'rgba(77,219,145,0.35)'); gr.addColorStop(1, 'rgba(77,219,145,0)');
        g.beginPath(); g.moveTo(pts[0][0], Y0); pts.forEach(([x, y]) => g.lineTo(x, y)); g.lineTo(pts[pts.length - 1][0], Y0); g.closePath(); g.fillStyle = gr; g.fill();
        g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.strokeStyle = '#4DDB91'; g.lineWidth = 7; g.lineJoin = 'round'; g.shadowColor = '#4DDB91'; g.shadowBlur = 18; g.stroke(); g.shadowBlur = 0;
        const [tx, ty] = pts[pts.length - 1]; g.fillStyle = '#4DDB91'; g.beginPath(); g.arc(tx, ty, 11, 0, 6.28); g.fill();
        g.textAlign = 'left'; g.fillStyle = '#EAFBF2'; g.font = `800 76px ${FONT}`; g.fillText(fmt(val * u), Math.min(tx + 22, 700), Math.max(ty - 24, 200));
      }
      const q = cl((lt - dur - 0.25) / 1.6);   // the faint projection, drawn after the green line stops
      if (q > 0) {
        const yTip = yOf(val); g.save(); g.setLineDash([14, 12]); g.strokeStyle = 'rgba(170,182,205,0.5)'; g.lineWidth = 5; g.beginPath(); g.moveTo(tipX, yTip);
        for (let k = 1; k <= 40; k++) { const sf = (k / 40) * q; g.lineTo(tipX + (X1 - tipX) * sf, yTip - (yTip - Y1) * Math.pow(sf, 2.3)); } g.stroke(); g.restore();
        if (q >= 1) { g.strokeStyle = 'rgba(190,200,222,0.55)'; g.lineWidth = 4; g.beginPath(); g.moveTo(X1, Y1 - 38); g.lineTo(X1, Y1 + 8); g.stroke(); g.fillStyle = 'rgba(190,200,222,0.5)'; g.beginPath(); g.moveTo(X1, Y1 - 38); g.lineTo(X1 - 26, Y1 - 28); g.lineTo(X1, Y1 - 18); g.closePath(); g.fill(); g.textAlign = 'right'; g.font = `600 22px ${FONT}`; g.fillStyle = 'rgba(190,200,222,0.65)'; g.fillText(T.target, X1 - 36, Y1 - 24); }
      }
      g.textAlign = 'left';
    },
    pipeline: (g, p, th, t, lt) => {   // a terminal: a command typed at p.typeAt (p.cmd, wraps), output lines appearing at p.out[i].at, and a progress bar p.bar { at, dur, label, done, restartAt, restartDur, restartLabel }
      const cl = (x) => Math.max(0, Math.min(1, x)), MONO = "'Cascadia Mono', Consolas, 'Courier New', monospace";
      const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
      g.fillStyle = '#0D1117'; g.fillRect(0, 0, 1024, 640);
      g.fillStyle = '#161B22'; g.fillRect(0, 0, 1024, 60); ['#FF5F56', '#FFBD2E', '#27C93F'].forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(34 + i * 30, 30, 9, 0, 6.28); g.fill(); });
      g.textAlign = 'left'; g.fillStyle = '#8B949E'; g.font = `600 22px ${MONO}`; g.fillText(p.title || 'terminal', 150, 38);
      const cmd = p.cmd || '', size = p.cmdSize ?? 30, ta = p.typeAt ?? 0.3, td = p.typeDur ?? Math.max(0.6, cmd.length * 0.05);
      const n = Math.floor(cl((lt - ta) / td) * cmd.length), shown = cmd.slice(0, n);
      g.font = `700 ${size}px ${MONO}`; const maxW = 940 - g.measureText('$ ').width, words = shown.split(' '), lines = []; let cur = '';
      for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (g.measureText(t2).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t2; } lines.push(cur);
      lines.forEach((ln, i) => { g.fillStyle = '#7EE787'; if (i === 0) g.fillText('$', 40, 130); g.fillStyle = '#F0F6FC'; g.fillText(ln, 40 + g.measureText('$ ').width, 130 + i * (size + 10)); });
      const caretOn = lt < ta + td + 0.4 || Math.floor(lt * 2) % 2 === 0;
      if (caretOn && !(p.noCaret)) { const last = lines[lines.length - 1]; g.fillStyle = '#F0F6FC'; g.fillRect(40 + g.measureText('$ ').width + g.measureText(last).width + 4, 130 + (lines.length - 1) * (size + 10) - size + 6, 14, size); }
      const y0 = 130 + lines.length * (size + 10) + 40;
      (p.out || []).forEach((o, i) => { if (lt >= o.at) { const u = cl((lt - o.at) / 0.25); g.globalAlpha = u; g.fillStyle = o.c || '#7EE787'; g.font = `700 ${p.outSize ?? 34}px ${MONO}`; g.fillText(o.t, 40, y0 + i * 58 + (1 - u) * 10); g.globalAlpha = 1; } });
      if (p.bar) {
        const b = p.bar; let u = lt < b.at ? 0 : cl((lt - b.at) / b.dur), label = b.label || 'Render';
        if (b.restartAt !== undefined && lt >= b.restartAt) { u = cl((lt - b.restartAt) / (b.restartDur || b.dur)); label = b.restartLabel || 'Render ulang'; }
        const by = 540, bx = 40, bw = 944;
        g.fillStyle = '#C9D1D9'; g.font = `700 40px ${MONO}`; g.fillText(`${label}  ${Math.round(u * 100)}%`, bx, by - 20);
        g.fillStyle = '#21262D'; rr(bx, by, bw, 34, 17); g.fill();
        if (u > 0.01) { const gr = g.createLinearGradient(bx, 0, bx + bw, 0); gr.addColorStop(0, '#2EA043'); gr.addColorStop(1, '#7EE787'); g.fillStyle = gr; rr(bx, by, Math.max(34, bw * u), 34, 17); g.fill(); }
        if (u >= 1) { g.textAlign = 'right'; g.fillStyle = '#7EE787'; g.font = `700 34px ${MONO}`; g.fillText(b.done || '\u2713 selesai', bx + bw, by - 18); g.textAlign = 'left'; }
      }
    },
    commentfeed: (g, p, th, t, lt0) => {   // a comment thread: praise cards slide in one by one (p.items [{at,name,text,c}]), then a red maintainer card (p.author {at,name,text}) hits, then p.chaosAt: tiny angry or confused cards flood the whole screen (p.chaos [texts]); p.shift continues the clock from an earlier page
      const lt = lt0 + (p.shift || 0), cl = (x) => Math.max(0, Math.min(1, x)), ez = (u) => u * u * (3 - 2 * u), MONO = "'Cascadia Mono', Consolas, 'Courier New', monospace";
      const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
      g.fillStyle = '#0D1117'; g.fillRect(0, 0, 1024, 640);
      g.fillStyle = '#161B22'; g.fillRect(0, 0, 1024, 64); g.fillStyle = '#F0F6FC'; g.font = `700 28px ${FONT}`; g.textAlign = 'left'; g.fillText(p.title || 'ZapPlay  ·  Komentar', 28, 42);
      const items = (p.items || []).filter((it) => lt >= it.at), n = items.length;
      const fade = p.author && lt >= p.author.at ? 0.35 : 1;
      items.forEach((it, i) => {
        const u = ez(cl((lt - it.at) / 0.35)), slot = n - 1 - i; if (slot > 3) return;
        const yy = 456 - slot * 112 + (1 - u) * 50;
        g.globalAlpha = u * fade; g.fillStyle = '#161B22'; rr(28, yy, 968, 98, 18); g.fill();
        g.fillStyle = it.c || '#4C8DFF'; g.beginPath(); g.arc(80, yy + 49, 30, 0, 6.283); g.fill();
        g.fillStyle = '#C9D1D9'; g.font = `700 24px ${FONT}`; g.fillText(it.name, 130, yy + 38); g.fillStyle = '#F0F6FC'; g.font = `600 30px ${FONT}`; g.fillText(it.text, 130, yy + 78);
        g.fillStyle = '#FF5A7A'; g.font = `700 30px ${FONT}`; g.textAlign = 'right'; g.fillText('♥', 970, yy + 62); g.textAlign = 'left'; g.globalAlpha = 1;
      });
      if (p.author && lt >= p.author.at) {   // the maintainer card: it drops in with a hit and shakes
        const a = p.author, u = cl((lt - a.at) / 0.22), pop = 0.7 + 0.3 * ez(u) + 0.06 * Math.sin(Math.PI * Math.min(1, u * 1.6)), sh = lt - a.at < 0.5 ? Math.sin(lt * 90) * 6 * (1 - (lt - a.at) / 0.5) : 0;
        g.save(); g.translate(512 + sh, 290); g.scale(pop, pop);
        g.fillStyle = '#2A0F12'; rr(-470, -105, 940, 210, 22); g.fill(); g.strokeStyle = '#FF4B3E'; g.lineWidth = 6; rr(-470, -105, 940, 210, 22); g.stroke();
        g.fillStyle = '#FF6A5E'; g.font = `700 26px ${FONT}`; g.fillText(a.name + '  ·  ' + (a.role || 'pemelihara proyek asli'), -430, -52);
        g.fillStyle = '#FFFFFF'; g.font = `800 52px ${FONT}`; g.fillText(a.text, -430, 30); g.restore();
      }
      if (p.chaosAt !== undefined && lt >= p.chaosAt) {   // the flood
        const ct = lt - p.chaosAt, cnt = Math.min(90, Math.floor(ct * 14)), texts = p.chaos || ['???', '!!!'], cols = ['#FF4B3E', '#FFB020', '#4C8DFF', '#B06CFF', '#2BB673'];
        let sd = 31; const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
        for (let i = 0; i < cnt; i++) {
          const x = 30 + rnd() * 720, y = 80 + rnd() * 500, w = 190 + rnd() * 150, rot = (rnd() - 0.5) * 0.35, c = cols[(rnd() * 5) | 0], tx = texts[(rnd() * texts.length) | 0], born = i / 14, u = ez(cl((ct - born) / 0.18));
          g.save(); g.translate(x + w / 2, y + 30); g.rotate(rot); g.scale(u, u); g.globalAlpha = 0.97; g.fillStyle = '#1B1F27'; rr(-w / 2, -30, w, 60, 14); g.fill(); g.strokeStyle = c; g.lineWidth = 3; rr(-w / 2, -30, w, 60, 14); g.stroke();
          g.fillStyle = c; g.beginPath(); g.arc(-w / 2 + 24, 0, 11, 0, 6.283); g.fill(); g.fillStyle = '#F0F6FC'; g.font = `700 24px ${FONT}`; g.textAlign = 'left'; g.fillText(tx, -w / 2 + 44, 9); g.restore();
        }
        g.fillStyle = `rgba(255,60,50,${0.12 + 0.05 * Math.sin(lt * 14)})`; g.fillRect(0, 0, 1024, 640);
        g.fillStyle = '#FF6A5E'; g.font = `800 34px ${MONO}`; g.textAlign = 'right'; g.fillText(`${Math.min(999, Math.floor(ct * 37))} komentar baru`, 996, 44); g.textAlign = 'left';
      }
      g.textAlign = 'left';
    },
    filevanish: (g, p, th, t, lt0) => {   // a terminal command (p.cmd) deletes an app: p.files tiles pop out one by one from p.vanishAt (every p.interval s) until the folder is empty
      const cl = (x) => Math.max(0, Math.min(1, x)), MONO = "'Cascadia Mono', Consolas, 'Courier New', monospace";
      const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
      g.fillStyle = '#0D1117'; g.fillRect(0, 0, 1024, 640);
      g.fillStyle = '#161B22'; g.fillRect(0, 0, 1024, 60); ['#FF5F56', '#FFBD2E', '#27C93F'].forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(34 + i * 30, 30, 9, 0, 6.28); g.fill(); });
      g.textAlign = 'left'; g.fillStyle = '#8B949E'; g.font = `600 22px ${MONO}`; g.fillText(p.title || '~/ZapPlay', 150, 38);
      const lt = lt0 + (p.shift || 0), cmd = p.cmd || '', ta = p.typeAt ?? 0.3, td = p.typeDur ?? Math.max(0.6, cmd.length * 0.07), nch = Math.floor(cl((lt - ta) / td) * cmd.length);
      g.font = `700 32px ${MONO}`; g.fillStyle = '#7EE787'; g.fillText('$', 40, 120); g.fillStyle = '#F0F6FC'; g.fillText(cmd.slice(0, nch), 40 + g.measureText('$ ').width, 120);
      const files = p.files || [], iv = p.interval ?? 0.15, va = p.vanishAt ?? 2.0, cols = 4, tw = 215, th2 = 120;
      let left = 0;
      files.forEach((f, i) => {
        const order = (i * 5) % files.length, gone = va + order * iv, k = cl((lt - gone) / 0.28);
        if (k >= 1) return; left++;
        const x = 40 + (i % cols) * (tw + 14), y = 170 + Math.floor(i / cols) * (th2 + 14), s = (1 + 0.25 * Math.sin(Math.PI * Math.min(1, k * 1.5)) * (1 - k)) * (1 - k * 0.8);
        g.save(); g.translate(x + tw / 2, y + th2 / 2); g.scale(s, s); g.globalAlpha = 1 - k; g.fillStyle = f.dir ? '#1F3A5F' : '#1B222C'; rr(-tw / 2, -th2 / 2, tw, th2, 14); g.fill(); g.strokeStyle = f.dir ? '#58A6FF' : '#30363D'; g.lineWidth = 3; rr(-tw / 2, -th2 / 2, tw, th2, 14); g.stroke();
        g.fillStyle = f.dir ? '#58A6FF' : '#8B949E'; g.font = `700 40px ${FONT}`; g.textAlign = 'center'; g.fillText(f.dir ? '▣' : '▤', 0, -6); g.fillStyle = '#F0F6FC'; g.font = `600 22px ${MONO}`; g.fillText(f.name, 0, 36); g.restore();
        if (k > 0 && k < 0.3) { g.fillStyle = `rgba(255,255,255,${0.5 * (1 - k / 0.3)})`; g.beginPath(); g.arc(x + tw / 2, y + th2 / 2, 40 + k * 120, 0, 6.283); g.fill(); }
      });
      g.textAlign = 'left'; g.fillStyle = left > 0 ? '#FF7B72' : '#6E7681'; g.font = `700 32px ${MONO}`;
      if (lt >= va) g.fillText(left > 0 ? `Menghapus ... ${left} file tersisa` : 'Folder kosong.', 40, 600);
      if (left === 0 && lt >= va) { g.textAlign = 'center'; g.fillStyle = 'rgba(139,148,158,0.55)'; g.font = `700 54px ${FONT}`; g.fillText('kosong', 512, 340); g.textAlign = 'left'; }
    },
    limitboard: (g, p, th, t, lt) => {   // a usage dashboard: a big counter p.value (blocks light up, a pop when it changes from p.from), a stuck task bar, a lock + "limit reached" and a reopening time typed in at p.revealAt
      const cl = (x) => Math.max(0, Math.min(1, x)), rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
      const T = { label: 'Sisa pesan', limit: 'Batas tercapai', reopen: 'Dibuka lagi pukul 03.00', task: 'Tugas', deadline: 'Deadline: besok pagi', ...(p.texts || {}) };
      const v = p.value ?? 3, max = p.max ?? 3, COL = { 3: '#5B8CFF', 2: '#FFC14D', 1: '#FF5A5A', 0: '#6B7280' }, col = COL[v] ?? '#5B8CFF';
      g.fillStyle = '#0A0E19'; g.fillRect(0, 0, 1024, 640);
      g.fillStyle = 'rgba(255,255,255,0.04)'; rr(40, 40, 944, 560, 28); g.fill();
      // the stuck task bar (top left)
      g.textAlign = 'left'; g.fillStyle = '#8D97B3'; g.font = `600 22px ${FONT}`; g.fillText(`${T.task}  ${p.progress ?? 5}%`, 80, 96);
      g.fillStyle = '#1B2236'; rr(80, 112, 360, 16, 8); g.fill(); g.fillStyle = '#4DDB91'; rr(80, 112, Math.max(10, 360 * (p.progress ?? 5) / 100), 16, 8); g.fill();
      if (T.deadline) { g.fillStyle = 'rgba(255,90,90,0.16)'; rr(80, 144, 260, 36, 18); g.fill(); g.fillStyle = '#FF7A7A'; g.font = `600 20px ${FONT}`; g.fillText(T.deadline, 98, 169); }
      // label + the big number
      g.textAlign = 'center'; g.fillStyle = '#8D97B3'; g.font = `600 30px ${FONT}`; g.fillText(T.label, 512, 262);
      let pop = 1, flash = 0; if (p.from !== undefined && p.from !== v) { const u = cl(lt / 0.3); pop = 1 + 0.45 * Math.sin(Math.PI * Math.min(1, u * 1.2)) * (1 - u * 0.4); flash = 1 - u; }
      const beat = v === 1 && p.pulse !== false ? 1 + 0.07 * Math.sin(lt * 7) : 1;
      g.save(); g.translate(512, 400); g.scale(pop * beat, pop * beat);
      g.shadowColor = col; g.shadowBlur = v === 0 ? 0 : 36 + 30 * flash; g.fillStyle = col; g.font = `800 230px ${FONT}`; g.fillText(String(v), 0, 80); g.restore();
      // blocks
      for (let i = 0; i < max; i++) { const on = i < v, x = 512 + (i - (max - 1) / 2) * 88 - 34; g.fillStyle = on ? col : '#1B2236'; if (on && v === 1) g.globalAlpha = 0.6 + 0.4 * Math.sin(lt * 7 + i); rr(x, 500, 68, 22, 8); g.fill(); g.globalAlpha = 1; }
      // locked: a padlock, "limit reached", and the reopening time typed in
      if (p.locked || (v === 0 && lt > 0.35)) {
        const u = cl((lt - 0.35) / 0.3); g.save(); g.globalAlpha = p.locked ? 1 : u; g.fillStyle = 'rgba(10,14,25,0.55)'; g.fillRect(40, 220, 944, 380);
        g.strokeStyle = '#9AA3BD'; g.lineWidth = 12; g.beginPath(); g.arc(512, 338, 44, Math.PI, 0); g.stroke(); g.fillStyle = '#9AA3BD'; rr(452, 336, 120, 92, 14); g.fill(); g.fillStyle = '#0A0E19'; g.beginPath(); g.arc(512, 376, 11, 0, 6.28); g.fill(); g.fillRect(508, 380, 8, 28);
        g.fillStyle = '#E4E9F7'; g.font = `800 52px ${FONT}`; g.fillText(T.limit, 512, 496);
        const ra = p.revealAt ?? 99, n = p.revealed ? T.reopen.length : Math.floor(Math.max(0, lt - ra) * 28), shown = T.reopen.slice(0, n);
        if (shown) { g.fillStyle = '#FFC14D'; g.font = `700 34px ${FONT}`; g.fillText(shown + (n < T.reopen.length && Math.floor(lt * 4) % 2 ? '|' : ''), 512, 552); }
        g.restore();
      }
      // fade to near black at the end, only the clock stays
      if (p.dim) { g.fillStyle = `rgba(4,6,12,${0.82 * cl(lt / (p.dim === true ? 2.5 : p.dim))})`; g.fillRect(0, 0, 1024, 640); }
      if (p.clock) { g.textAlign = 'right'; g.fillStyle = '#C9D3F2'; g.font = `700 44px ${FONT}`; const c = Math.floor(lt * 1.2) % 2 ? p.clock.replace(':', ' ').replace('.', ' ') : p.clock; g.fillText(c, 960, 590); }
      g.textAlign = 'left';
    },
    gitdiff: (g, p, th, t, lt) => {   // git diff --stat: a counter that races up to p.total files, a scrolling file list with +/- and red/green bars
      const cl = (x) => Math.max(0, Math.min(1, x)), MONO = "'Cascadia Mono', Consolas, 'Courier New', monospace";
      const FILES = ['src/components/LoginButton.tsx', 'src/components/RegisterForm.tsx', 'src/pages/index.tsx', 'src/utils/auth.ts', 'package-lock.json', 'yarn.lock', 'src/styles/global.css', 'README.md', 'tsconfig.json', 'src/hooks/useSession.ts', 'src/api/users.ts', 'src/api/login.ts', '.env.example', 'jest.config.js', 'src/components/Navbar.tsx', 'src/layout/Footer.tsx', 'public/logo.svg', 'src/store/index.ts', 'src/types/user.d.ts', 'prisma/schema.prisma', 'src/middleware.ts', 'docker-compose.yml', 'src/lib/db.ts', '.github/workflows/ci.yml'];
      const H = (i, k) => ((Math.imul(i + 7, 2654435761) ^ Math.imul(k + 13, 40503)) >>> 0) % 100;
      const total = p.total ?? 1056, dur = p.dur ?? 3.0, u = cl(lt / dur), e = 1 - Math.pow(1 - u, 3), count = Math.floor(total * e);
      g.fillStyle = '#0D1117'; g.fillRect(0, 0, 1024, 640);
      g.fillStyle = '#161B22'; g.fillRect(0, 0, 1024, 48); g.fillStyle = '#8B949E'; g.font = `600 20px ${MONO}`; g.fillText(p.texts?.path ?? '~/project/login-app  (main)', 24, 31);
      g.fillStyle = '#8B949E'; g.font = `24px ${MONO}`; g.fillText('$ git diff --stat', 40, 92);
      g.fillStyle = u < 1 ? '#FF7B72' : '#FF5555'; g.font = `700 108px ${MONO}`; g.fillText(String(count), 40, 196);
      g.fillStyle = '#C9D1D9'; g.font = `600 34px ${MONO}`; g.fillText(p.texts?.label ?? 'files changed', 40 + String(count).length * 65 + 14, 190);
      const ins = Math.floor(count * 46.4), del = Math.floor(count * 48.9);
      g.font = `700 26px ${MONO}`; g.fillStyle = '#3FB950'; g.fillText('+' + ins.toLocaleString('en-US'), 44, 240); g.fillStyle = '#FF7B72'; g.fillText('-' + del.toLocaleString('en-US'), 44 + 190, 240);
      const speed = 420 + 900 * (1 - u), sc = lt * speed, rowH = 34, i0 = Math.floor(sc / rowH), off = sc % rowH;
      g.save(); g.beginPath(); g.rect(0, 262, 1024, 378); g.clip();
      for (let r = 0; r < 13; r++) {
        const i = i0 + r, y = 276 + r * rowH - off, name = FILES[(i * 5) % FILES.length], a = H(i, 1) + 1, d = H(i, 2) % 80;
        g.fillStyle = r % 2 ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0)'; g.fillRect(0, y - 24, 1024, rowH);
        g.fillStyle = '#C9D1D9'; g.font = `22px ${MONO}`; g.fillText(name, 40, y);
        g.fillStyle = '#3FB950'; g.fillText('+' + a, 640, y); g.fillStyle = '#FF7B72'; g.fillText('-' + d, 740, y);
        const n = 10, gn = Math.round(n * a / Math.max(1, a + d)); for (let k = 0; k < n; k++) { g.fillStyle = k < gn ? '#3FB950' : '#FF7B72'; g.fillRect(840 + k * 16, y - 16, 12, 16); }
      }
      g.restore();
      g.fillStyle = 'rgba(13,17,23,0.9)'; g.fillRect(0, 262, 1024, 4);
    },
    text: (g, p, th, t, lt) => {  // a title and a few lines
      g.fillStyle = th.bg; g.fillRect(0, 0, 1024, 640); tabsOf(g, p, th);
      g.fillStyle = th.num; g.font = `700 64px ${FONT}`; wrapText(g, p.title || '', 60, 150, 900, 76);
      g.fillStyle = th.ink; g.font = `32px ${FONT}`; (p.lines || []).forEach((s, i) => g.fillText(s, 60, 330 + i * 52));
    },
  };
  let page = Object.keys(specs)[0], pageT0 = 0;
  const themeOf = (p) => THEMES[p.theme || 'dark'];
  updaters.push((t) => {
    const p = specs[page], th = themeOf(p);
    DRAW[p.type](scr.g, p, th, t, t - pageT0, page);
    sm.color.setScalar(p.brightness ?? (p.type === 'image' || p.type === 'video' ? 0.5 : th.bright));
    scr.t.needsUpdate = true;
  });
  const screen = {
    setPage: (name, t) => { if (specs[name] && name !== page) { page = name; pageT0 = t; } },
    get page() { return page; },
    glow: () => ({ ...themeOf(specs[page]).glow, ...(specs[page].type === 'image' || specs[page].type === 'video' ? { c: '#EAF2FF', i: 12 } : {}), ...(specs[page].glow || {}) }),
    has: (name) => !!specs[name],
  };

  // ---------------------------------------------------------------- the wall and a real window
  const WIN = { w: 21, h: 10.5, y0: 1.6, z: -9 };            // the opening
  const WALL_T = 1.4;                                           // the wall is thick: you see the inside faces of the opening (the reveal)
  const wallM = std('#34294E', 1, { emissive: '#1C1634', emissiveIntensity: 0.7 }), revealM = std('#463C62', 1, { emissive: '#241C3C', emissiveIntensity: 0.5 });
  const wallBox = (bw, bh, x, y) => { const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, WALL_T), wallM); b.position.set(x, y, WIN.z); b.receiveShadow = true; group.add(b); };
  wallBox(60, WIN.y0 + 0.2, 0, (WIN.y0 - 0.2) / 2 - 0.2);
  wallBox(60, 30, 0, WIN.y0 + WIN.h + 15);
  wallBox(30 - WIN.w / 2, WIN.h, -WIN.w / 2 - (30 - WIN.w / 2) / 2, WIN.y0 + WIN.h / 2);
  wallBox(30 - WIN.w / 2, WIN.h, WIN.w / 2 + (30 - WIN.w / 2) / 2, WIN.y0 + WIN.h / 2);
  const rv = (bw, bh, bd, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), revealM); b.position.set(x, y, z); b.receiveShadow = true; group.add(b); };
  rv(WIN.w, 0.12, WALL_T, 0, WIN.y0, WIN.z); rv(WIN.w, 0.12, WALL_T, 0, WIN.y0 + WIN.h, WIN.z);
  rv(0.12, WIN.h, WALL_T, -WIN.w / 2, WIN.y0 + WIN.h / 2, WIN.z); rv(0.12, WIN.h, WALL_T, WIN.w / 2, WIN.y0 + WIN.h / 2, WIN.z);
  const sill = new THREE.Mesh(new THREE.BoxGeometry(WIN.w + 1.6, 0.34, 1.9), std('#4A3E58', 0.8)); sill.position.set(0, WIN.y0 + 0.05, WIN.z + 1.3); sill.receiveShadow = sill.castShadow = true; group.add(sill);
  const frameM = std('#0E1124', 0.7), fz = WIN.z + 0.1, fw = 0.4;
  const bar = (bw, bh, x, y) => { const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.42), frameM); b.position.set(x, y, fz); b.castShadow = true; group.add(b); };
  bar(WIN.w, fw, 0, WIN.y0 + fw / 2); bar(WIN.w, fw, 0, WIN.y0 + WIN.h - fw / 2);
  bar(fw, WIN.h, -WIN.w / 2 + fw / 2, WIN.y0 + WIN.h / 2); bar(fw, WIN.h, WIN.w / 2 - fw / 2, WIN.y0 + WIN.h / 2);
  for (let i = 1; i <= 2; i++) bar(0.3, WIN.h, -WIN.w / 2 + (WIN.w * i) / 3, WIN.y0 + WIN.h / 2);
  bar(WIN.w, 0.3, 0, WIN.y0 + WIN.h / 2);
  const gl = canvasTex(512, 256, (g, w, h) => { g.clearRect(0, 0, w, h); const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, 'rgba(255,255,255,0.0)'); gr.addColorStop(0.35, 'rgba(180,200,255,0.10)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.0)'); gr.addColorStop(0.8, 'rgba(255,190,120,0.07)'); gr.addColorStop(1, 'rgba(255,255,255,0.0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(WIN.w, WIN.h), new THREE.MeshBasicMaterial({ map: gl.t, transparent: true, depthWrite: false, toneMapped: false }));
  glass.position.set(0, WIN.y0 + WIN.h / 2, fz + 0.24); group.add(glass);
  for (const sx of [-1, 1]) for (let k = 0; k < 6; k++) {   // curtains: pleated slats at both sides
    const c = new THREE.Mesh(new THREE.PlaneGeometry(0.9, WIN.h + 3), std(k % 2 ? '#3A2748' : '#2A1B36', 1));
    c.position.set(sx * (WIN.w / 2 + 0.2 - k * 0.55 + (k % 2) * 0.1), WIN.y0 + WIN.h / 2 + 0.6, WIN.z + 0.9 + (k % 2) * 0.12); group.add(c);
  }
  // fairy lights along the top of the window (they warm the wall); things can hang from this string
  const STRING_Y = WIN.y0 + WIN.h + 0.9, stringX = (u) => -WIN.w / 2 - 1 + (WIN.w + 2) * u;
  const stringY = (x) => { const u = (x + WIN.w / 2 + 1) / (WIN.w + 2); return STRING_Y - 1.1 * 4 * u * (1 - u); };
  const bulbs = [];
  for (let i = 0; i < 22; i++) { const u = i / 21; const b = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), glow('#FFC27A', 3)); b.position.set(stringX(u), stringY(stringX(u)), WIN.z + 0.9); b.userData.ph = R() * 6.28; group.add(b); bulbs.push(b); }
  updaters.push((t) => bulbs.forEach((b) => b.scale.setScalar(0.8 + 0.2 * Math.sin(t * 1.3 + b.userData.ph))));
  const wash = new THREE.PointLight('#FFB27A', 26, 22, 2); wash.position.set(0, WIN.y0 + WIN.h + 0.5, WIN.z + 2.2); group.add(wash);

  // ---------------------------------------------------------------- things on the desk and the sill (attached by the episode)
  const deskTop = 0.2;
  const PROPS = {
    mug: (c = '#C9D3E8') => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.4, 0.8, 24), std(c, 0.6)); b.position.y = 0.4; const h = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.06, 8, 16, Math.PI), std(c, 0.6)); h.position.set(0.5, 0.42, 0); h.rotation.z = -Math.PI / 2; g.add(b, h); return g; },
    plant: (c = '#B5654A') => { const g = new THREE.Group(); const p = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.3, 0.6, 14), std(c)); p.position.y = 0.3; g.add(p); for (let i = 0; i < 6; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), std('#2F7A4B')); l.scale.set(0.4, 1.4, 0.25); l.position.set((R() - 0.5) * 0.5, 1.0 + R() * 0.5, 0); l.rotation.z = (R() - 0.5) * 1.1; g.add(l); } return g; },
    cactus: (c = '#B5654A') => { const g = new THREE.Group(); const p = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.28, 0.5, 14), std(c)); p.position.y = 0.25; const b = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 1.1, 12), std('#3E8A58')); b.position.y = 1.0; const a1 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.5, 8), std('#3E8A58')); a1.position.set(0.3, 1.1, 0); const a2 = a1.clone(); a2.position.set(-0.3, 0.85, 0); g.add(p, b, a1, a2); return g; },
    trophy: (c = '#F6C431') => { const g = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.4, metalness: 0.3 }); const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.2, 20), m); base.position.y = 0.1; const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.7, 12), m); stem.position.y = 0.55; const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.2, 0.7, 20), m); cup.position.y = 1.1; g.add(base, stem, cup); return g; },
    books: (c = '#C2452D') => { const g = new THREE.Group(); const cols = [c, '#3F6FD0', '#E2B33C']; cols.forEach((col, i) => { const b = new THREE.Mesh(new THREE.BoxGeometry(1.3 - i * 0.12, 0.28, 0.95), std(col, 0.8)); b.position.set(0, 0.14 + i * 0.28, 0); b.rotation.y = (i - 1) * 0.12; g.add(b); }); return g; },
    notebook: (c = '#5A3FA0') => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 2.4), std(c, 0.7)); b.position.y = 0.06; b.rotation.y = 0.25; g.add(b); return g; },
    duck: (c = '#FFD23C') => { const g = new THREE.Group(); const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), std(c, 0.6)); body.scale.set(1.2, 0.9, 1); body.position.y = 0.4; const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 10), std(c, 0.6)); head.position.set(0.32, 0.88, 0); const beak = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.2, 8), std('#FF8A2A', 0.6)); beak.rotation.z = -Math.PI / 2; beak.position.set(0.6, 0.86, 0); g.add(body, head, beak); return g; },
    ketupat: (c = '#7FB04A') => { const g = new THREE.Group(); const m = std(c, 0.75); const d = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.62), m); d.rotation.set(0.0, 0.0, Math.PI / 4); d.position.y = 0.55; g.add(d); const wv = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.64, 0.05), std('#B7D77A', 0.8)); wv.rotation.z = Math.PI / 4; wv.position.set(0, 0.55, 0.31); g.add(wv); const t = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6), std('#C9A66B')); t.position.y = 1.15; g.add(t); return g; },
    tree: (c = '#2F8A4F') => { const g = new THREE.Group(); for (let i = 0; i < 3; i++) { const k = new THREE.Mesh(new THREE.ConeGeometry(0.8 - i * 0.18, 0.9, 14), std(c, 0.9)); k.position.y = 0.7 + i * 0.6; g.add(k); } const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.3, 8), std('#6B4A32')); tr.position.y = 0.15; g.add(tr); const st = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), glow('#FFD84D', 2.4)); st.position.y = 2.55; g.add(st); for (let i = 0; i < 8; i++) { const a = i * 0.9, h = 0.6 + (i % 4) * 0.5, rr = 0.62 - (i % 4) * 0.14; const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), glow(['#FF5A5A', '#FFD84D', '#5AB4FF', '#FF8AE0'][i % 4], 2.6)); b.position.set(Math.cos(a) * rr, h, Math.sin(a) * rr); g.add(b); } return g; },
    lantern: (c = '#E8483A') => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.6, roughness: 0.7 })); b.scale.set(1, 0.85, 1); b.position.y = 0.7; g.add(b); for (const y of [1.18, 0.22]) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.08, 10), std('#F6C431', 0.5)); cap.position.y = y; g.add(cap); } const tas = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.05, 0.4, 6), std('#F6C431', 0.6)); tas.position.y = 0.0; g.add(tas); return g; },
    gift: (c = '#C2452D') => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.9), std(c, 0.7)); b.position.y = 0.35; g.add(b); const r1 = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.72, 0.16), std('#F6C431', 0.5)); r1.position.y = 0.35; const r2 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.72, 0.95), std('#F6C431', 0.5)); r2.position.y = 0.35; const bow = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.06, 8, 14), std('#F6C431', 0.5)); bow.position.y = 0.82; bow.rotation.x = Math.PI / 2; g.add(r1, r2, bow); return g; },
  };
  for (const p of cfg.props || []) {
    const make = PROPS[p.type]; if (!make) throw new Error('unknown prop: ' + p.type + ' (' + Object.keys(PROPS).join(', ') + ')');
    const g = make(p.color); g.scale.setScalar(p.scale ?? 1); g.rotation.y = p.rot ?? 0;
    // the portrait frame only shows |x| < about 3.2 at the desk and < 5 at the window sill, so props are mounted where they can be SEEN:
    //   on: 'lid' (default) = on the top edge of the laptop lid, at the far left or right (x about +-2.6..3.3), small; 'sill' = on the window sill (x within +-4.5); 'desk' = on the desk in front (rarely visible)
    const on = p.on ?? 'lid';
    if (on === 'lid') { g.scale.setScalar((p.scale ?? 1) * 0.55); g.position.set(p.x ?? 3.0, perch.y, perch.z + 0.1); }
    else if (on === 'sill') g.position.set(p.x ?? -3, WIN.y0 + 0.22, WIN.z + 1.5);
    else g.position.set(p.x ?? 5, deskTop, p.z ?? 0.5);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; }); group.add(g);
  }
  // pictures: taped to the glass (visible in the middle of the window) or hung from the fairy-light string with a clip (polaroids)
  for (const w of cfg.wall || []) {
    const im = await loadImage(`${base}/${w.src}`);
    const tex = new THREE.CanvasTexture(im); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const ww = w.w ?? 1.6, hh = w.h ?? ww * (im.height / im.width);
    const frame = w.frame === false ? 0 : (w.mount === 'string' ? 0.12 : 0.06);
    const g = new THREE.Group();
    if (frame) { const f = new THREE.Mesh(new THREE.PlaneGeometry(ww + frame * 2, hh + frame * 2 + (w.mount === 'string' ? 0.25 : 0)), new THREE.MeshBasicMaterial({ color: '#F4EEE2' })); f.position.set(0, w.mount === 'string' ? -0.12 : 0, -0.005); g.add(f); }
    g.add(new THREE.Mesh(new THREE.PlaneGeometry(ww, hh), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: new THREE.Color(0.8, 0.8, 0.8) })));
    if (w.mount === 'string') { const x = w.x ?? 0; g.position.set(x, stringY(x) - hh / 2 - 0.35, WIN.z + 0.85); const clip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.05), std('#C9A66B')); clip.position.set(0, hh / 2 + 0.2, 0.03); g.add(clip); g.rotation.z = w.rot ?? (R() - 0.5) * 0.14; }
    else { g.position.set(w.x ?? 0, w.y ?? WIN.y0 + WIN.h / 2, fz + 0.3); g.rotation.z = w.rot ?? 0; }
    group.add(g);
  }

  if (cfg.counter) {   // a sheet of paper taped to the wall above the window, written by hand in marker: a title, "value / target" (the previous value crossed out), a hand-drawn progress bar and a note. An ordinary thing to find in a bedroom
    const cc = cfg.counter, PW = cc.w ?? 4.4, PH = cc.h ?? 3.1, sy = cc.y ?? WIN.y0 + WIN.h + 2.5, sx = cc.x ?? 0.2, zf = WIN.z + WALL_T / 2;
    const fmt = (n) => Number(n).toLocaleString('id-ID');
    const HAND = "'Segoe Print', 'Ink Free', 'Bradley Hand', 'Comic Sans MS', cursive";
    let sd = 7; const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };   // one fixed hand: the same scribble in every frame
    const tex = canvasTex(880, Math.round(880 * PH / PW), (c, w, h) => {
      c.fillStyle = '#EEE8D6'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 1400; i++) { c.fillStyle = `rgba(120,100,60,${0.02 + rnd() * 0.04})`; c.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 3, 2 + rnd() * 3); }   // paper grain
      c.fillStyle = 'rgba(90,80,50,0.10)'; c.fillRect(0, h * 0.5 - 2, w, 4); c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(0, h * 0.5 + 2, w, 3);   // a fold
      const line = (x1, y1, x2, y2, col, lw) => { c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'round'; c.beginPath(); c.moveTo(x1, y1); c.quadraticCurveTo((x1 + x2) / 2 + (rnd() - 0.5) * 6, (y1 + y2) / 2 + (rnd() - 0.5) * 6, x2 + (rnd() - 0.5) * 3, y2 + (rnd() - 0.5) * 3); c.stroke(); };
      const ink = '#1B2A6E', red = '#C0281F', blk = '#16181F';
      c.textAlign = 'left'; c.textBaseline = 'alphabetic';
      c.fillStyle = ink; c.font = `700 ${h * 0.12}px ${HAND}`; c.save(); c.translate(w * 0.07, h * 0.2); c.rotate(-0.025); c.fillText(cc.label || 'install', 0, 0); c.restore();
      line(w * 0.07, h * 0.235, w * 0.6, h * 0.225, ink, 4);
      c.fillStyle = blk; c.font = `800 ${h * 0.22}px ${HAND}`; c.save(); c.translate(w * 0.06, h * 0.58); c.rotate(-0.02);
      const vs = fmt(cc.value); c.fillText(vs, 0, 0); const vw = c.measureText(vs).width; c.font = `700 ${h * 0.125}px ${HAND}`; c.fillText(' / ' + fmt(cc.target), vw, 0); c.restore();
      if (cc.prev) { c.fillStyle = 'rgba(40,40,60,0.8)'; c.font = `600 ${h * 0.09}px ${HAND}`; c.fillText(fmt(cc.prev), w * 0.72, h * 0.2); line(w * 0.7, h * 0.165, w * 0.88, h * 0.205, red, 4); }
      const bx = w * 0.07, by = h * 0.72, bw2 = w * 0.84, bh2 = h * 0.1;
      line(bx, by, bx + bw2, by, ink, 4); line(bx + bw2, by, bx + bw2, by + bh2, ink, 4); line(bx + bw2, by + bh2, bx, by + bh2, ink, 4); line(bx, by + bh2, bx, by, ink, 4);
      const fillW = Math.max(14, bw2 * cc.value / cc.target); c.strokeStyle = red; c.lineWidth = 3;
      for (let x = bx + 5; x < bx + fillW; x += 9) { c.beginPath(); c.moveTo(x, by + bh2 - 3); c.lineTo(x + 8, by + 4); c.stroke(); }
      c.fillStyle = red; c.font = `700 ${h * 0.085}px ${HAND}`; c.save(); c.translate(w * 0.42, h * 0.95); c.rotate(-0.03); c.fillText(cc.note || 'target!! kapan??', 0, 0); c.restore();
      line(w * 0.42, h * 0.965, w * 0.88, h * 0.955, red, 3);
    }).t;
    const grp = new THREE.Group(); grp.position.set(sx, sy, zf + 0.02); grp.rotation.z = cc.rot ?? -0.035; group.add(grp);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(PW * 1.02, PH * 1.02), new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.3, depthWrite: false })); shadow.position.set(0.09, -0.1, 0); grp.add(shadow);
    const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }); mat.color.setScalar(cc.bright ?? 0.7);
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), mat); sheet.position.z = 0.012; grp.add(sheet);
    for (const k of [-1, 1]) { const tape = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.3), new THREE.MeshBasicMaterial({ color: '#CDBE92', transparent: true, opacity: 0.78, toneMapped: false })); tape.position.set(k * PW * 0.4, PH / 2 - 0.03, 0.03); tape.rotation.z = -k * 0.55; grp.add(tape); }
  }

  // ---------------------------------------------------------------- what is outside, in layers
  const OUT = new THREE.Group(); group.add(OUT);
  const skyTex = canvasTex(32, 512, (g) => { const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#0A1238'); gr.addColorStop(0.55, '#223470'); gr.addColorStop(1, '#4A5C9C'); g.fillStyle = gr; g.fillRect(0, 0, 32, 512); });
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(200, 110), new THREE.MeshBasicMaterial({ map: skyTex.t, toneMapped: false })); sky.position.set(0, 14, -80); OUT.add(sky);
  const nStars = 200, starPos = new Float32Array(nStars * 3);
  for (let i = 0; i < nStars; i++) { starPos[i * 3] = -60 + R() * 120; starPos[i * 3 + 1] = 5 + R() * 34; starPos[i * 3 + 2] = -78; }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  OUT.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: '#FFFFFF', size: 0.32, transparent: true, opacity: 0.8, depthWrite: false })));
  const blackM = () => new THREE.MeshBasicMaterial({ color: '#0A0F26' });
  function skyline(z, n, lit, hMin, hMax, spread = 70) {   // sparse: only a handful of lit windows, a quiet night and not a wall of squares
    const wins = [];
    for (let i = 0; i < n; i++) { const w = 3 + R() * 6, h = hMin + R() * (hMax - hMin); const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 3), blackM()); b.position.set(-spread / 2 + (i / n) * spread + (R() - 0.5) * 3, h / 2 - 6, z - R() * 3); OUT.add(b); wins.push({ b, w, h }); }
    for (let k = 0; k < lit; k++) { const { b, w, h } = wins[(R() * wins.length) | 0]; const q = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.8), glow(R() > 0.3 ? '#FFC870' : '#BFD8FF', 1.7)); q.position.set(b.position.x + (R() - 0.5) * (w - 1), b.position.y + (R() - 0.25) * (h - 2), b.position.z + 1.52); OUT.add(q); q.userData = { ph: R() * 6.28 }; updaters.push((t) => { q.visible = Math.sin(t * 0.07 + q.userData.ph) > -0.97; }); }
  }
  function blinkTower(x, y, z) { const t = new THREE.Mesh(new THREE.BoxGeometry(1.2, 22, 1.2), blackM()); t.position.set(x, y, z); OUT.add(t); const l = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), glow('#FF3B30', 3)); l.position.set(x, y + 11.4, z + 0.8); OUT.add(l); updaters.push((tt) => { l.visible = (tt % 1.6) < 0.55; }); }
  function glowSprite(x, y, z, size, color, op = 0.9, parent = OUT) { const s = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: softDot(color), transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); s.position.set(x, y, z); parent.add(s); return s; }
  function tree(x, y, z, s = 1) { const g = new THREE.Group(); const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * s, 0.32 * s, 5 * s, 8), blackM()); trunk.position.y = 2.5 * s; g.add(trunk); for (let i = 0; i < 6; i++) { const c = new THREE.Mesh(new THREE.SphereGeometry((1.6 + R()) * s, 10, 8), blackM()); c.position.set((R() - 0.5) * 3 * s, (5.5 + R() * 2.2) * s, (R() - 0.5) * 1.5); g.add(c); } g.position.set(x, y, z); OUT.add(g); const ph = R() * 6.28; updaters.push((t) => { g.rotation.z = Math.sin(t * 0.7 + ph) * 0.012; }); }
  function roof(x, y, z, w, h) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 6), blackM()); b.position.set(x, y + h / 2, z); OUT.add(b); const r = new THREE.Mesh(new THREE.ConeGeometry(w * 0.62, 2.2, 4), blackM()); r.position.set(x, y + h + 1.1, z); r.rotation.y = Math.PI / 4; r.scale.set(1, 1, 0.55); OUT.add(r); }
  if (bg === 'quiet') {
    skyline(-48, 12, 14, 14, 30); skyline(-30, 6, 6, 8, 16, 60); blinkTower(10, 12, -55);
    const moon = new THREE.Mesh(new THREE.CircleGeometry(3.0, 40), glow('#F4F0E0', 1.4)); moon.position.set(9, 15, -78); OUT.add(moon); glowSprite(9, 15, -77, 26, '190,210,255', 0.5);
    roof(-10, -3.5, -16, 9, 6);
    const w = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.1), glow('#FFC870', 2)); w.position.set(-10, 0.4, -12.95); OUT.add(w); glowSprite(-10, 0.4, -12.9, 4, '255,200,120', 0.5);
  } else if (bg === 'street') {
    skyline(-46, 9, 8, 10, 22); tree(-9, -6, -15, 1.3); tree(7, -6, -17, 1.1);
    const lx = 3, ly = 2.2, lz = -13;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 9, 8), blackM()); pole.position.set(lx, ly - 2.8, lz); OUT.add(pole);
    const lh = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), glow('#FFD9A0', 3.2)); lh.position.set(lx, ly + 1.6, lz); OUT.add(lh); glowSprite(lx, ly + 1.6, lz + 0.2, 9, '255,205,140', 0.8);
    const street = new THREE.PointLight('#FFC27A', 60, 28, 2); street.position.set(lx, ly + 1.2, lz + 3); group.add(street); updaters.push((t) => { street.intensity = 60 * (1 + 0.03 * Math.sin(t * 9) * Math.sin(t * 1.3)); });
    for (let i = 0; i < 5; i++) { const c = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.3), glow(i % 2 ? '#FF3B30' : '#FFE9C0', 3)); c.position.set(-30 + R() * 60, -3.2, -26); c.userData = { x: c.position.x, v: (i % 2 ? 1 : -1) * (1.2 + R()) }; OUT.add(c); updaters.push((t) => { c.position.x = (((c.userData.x + c.userData.v * t + 30) % 60) + 60) % 60 - 30; }); }
  } else if (bg === 'moon') {
    const moon = new THREE.Mesh(new THREE.CircleGeometry(3.4, 48), glow('#F4F0E0', 1.5)); moon.position.set(-5, 11, -60); OUT.add(moon); glowSprite(-5, 11, -59, 28, '190,210,255', 0.55);
    const cl = canvasTex(256, 128, (g) => { const gr = g.createRadialGradient(128, 64, 8, 128, 64, 90); gr.addColorStop(0, 'rgba(120,140,200,0.32)'); gr.addColorStop(1, 'rgba(120,140,200,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 128); });
    const clouds = []; for (let i = 0; i < 6; i++) { const c = new THREE.Mesh(new THREE.PlaneGeometry(30 + R() * 16, 10), new THREE.MeshBasicMaterial({ map: cl.t, transparent: true, depthWrite: false, toneMapped: false })); c.position.set(-50 + i * 18, 6 + R() * 14, -64 + R() * 4); c.userData = { v: 0.4 + R() * 0.4, x: c.position.x }; OUT.add(c); clouds.push(c); }
    updaters.push((t) => clouds.forEach((c) => { c.position.x = ((c.userData.x + c.userData.v * t + 70) % 140) - 70; }));
    skyline(-40, 7, 4, 8, 16, 80); roof(-9, -4, -17, 10, 6); roof(8, -5, -19, 12, 7);
    const ant = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3, 0.1), blackM()); ant.position.set(-9, 2.5, -17); OUT.add(ant);
  } else if (bg === 'rain') {
    skyline(-40, 8, 5, 10, 22);
    for (const [bx, by, col] of [[-9, 4, '255,90,80'], [-3, 8, '90,160,255'], [4, 3, '255,190,90'], [9, 7, '110,255,180'], [-13, 9, '255,110,220']]) glowSprite(bx, by, -30, 3.2, col, 0.9);
    const gw = canvasTex(1344, 704, () => {});
    const drops = Array.from({ length: 150 }, () => ({ x: R() * 1344, y: R() * 704, v: 60 + R() * 220, l: 20 + R() * 70 }));
    const beads = Array.from({ length: 300 }, () => [R() * 1344, R() * 704, 1 + R() * 2.4]);
    const wm = new THREE.MeshBasicMaterial({ map: gw.t, transparent: true, depthWrite: false, toneMapped: false }); wm.color.setScalar(1.4);
    const wp = new THREE.Mesh(new THREE.PlaneGeometry(WIN.w, WIN.h), wm); wp.position.set(0, WIN.y0 + WIN.h / 2, fz + 0.26); group.add(wp);
    updaters.push((t) => { const g = gw.g; g.clearRect(0, 0, 1344, 704); g.fillStyle = 'rgba(190,215,255,0.3)'; beads.forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, 0, 6.28); g.fill(); }); g.strokeStyle = 'rgba(210,230,255,0.22)'; g.lineWidth = 1.6; g.lineCap = 'round'; drops.forEach((d) => { const y = (d.y + d.v * t) % 780 - 40; g.beginPath(); g.moveTo(d.x, y - d.l * 0.7); g.lineTo(d.x, y); g.stroke(); g.fillStyle = 'rgba(225,238,255,0.5)'; g.beginPath(); g.arc(d.x, y, 2.2, 0, 6.28); g.fill(); }); gw.t.needsUpdate = true; });
    roof(-9, -4, -18, 10, 6);
  } else throw new Error('unknown background: ' + bg + ' (' + Object.keys(BACKGROUNDS).join(', ') + ')');

  // dust in the air of the room
  const nd = 60, dpos = new Float32Array(nd * 3), dph = [];
  for (let i = 0; i < nd; i++) { dpos[i * 3] = -9 + R() * 18; dpos[i * 3 + 1] = 1 + R() * 10; dpos[i * 3 + 2] = -6 + R() * 11; dph.push(R() * 6.28); }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  group.add(new THREE.Points(dg, new THREE.PointsMaterial({ map: softDot(), color: '#FFD9A8', size: 0.14, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending })));
  updaters.push((t) => { const a = dg.attributes.position; for (let i = 0; i < nd; i++) { a.array[i * 3] += Math.sin(t * 0.4 + dph[i]) * 0.0022; a.array[i * 3 + 1] += 0.0015 + Math.sin(t * 0.6 + dph[i]) * 0.0008; if (a.array[i * 3 + 1] > 11) a.array[i * 3 + 1] = 1; } a.needsUpdate = true; });

  // ---------------------------------------------------------------- ONE moment outside the window, tiny and far: a rocket sports car, a shooting star or a small UFO
  const car = new THREE.Group(); OUT.add(car); car.visible = false; car.scale.setScalar(0.75);
  car.add(new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.32, 0.7), new THREE.MeshBasicMaterial({ color: '#E8483A', toneMapped: false })));   // generic open sports car, no logos
  const carCab = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.22, 0.55), new THREE.MeshBasicMaterial({ color: '#BFD8FF', toneMapped: false })); carCab.position.set(0.1, 0.26, 0); car.add(carCab);
  for (const wx of [-0.55, 0.6]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.8, 10), new THREE.MeshBasicMaterial({ color: '#0B0D14' })); w.rotation.x = Math.PI / 2; w.position.set(wx, -0.16, 0); car.add(w); }
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.2, 1.5, 10), glow('#FF9A3C', 3)); flame.rotation.z = Math.PI / 2; flame.position.set(-1.55, 0, 0); car.add(flame);
  glowSprite(-1.6, 0, 0.1, 4.2, '255,160,60', 0.9, car);
  const trail = new THREE.Mesh(new THREE.PlaneGeometry(9, 0.5), new THREE.MeshBasicMaterial({ map: canvasTex(256, 16, (g, w, h) => { const gr = g.createLinearGradient(w, 0, 0, 0); gr.addColorStop(0, 'rgba(255,170,80,0.75)'); gr.addColorStop(1, 'rgba(255,170,80,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }).t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); trail.position.set(-6.2, 0, 0); car.add(trail);
  const carLight = new THREE.PointLight('#FFB070', 0, 40, 2); group.add(carLight);

  const star = new THREE.Group(); OUT.add(star); star.visible = false;
  glowSprite(0, 0, 0, 2.2, '255,255,255', 1, star);
  const starTail = new THREE.Mesh(new THREE.PlaneGeometry(10, 0.26), new THREE.MeshBasicMaterial({ map: canvasTex(256, 16, (g, w, h) => { const gr = g.createLinearGradient(w, 0, 0, 0); gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(1, 'rgba(160,200,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }).t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); starTail.position.set(5, 0, 0); star.add(starTail);
  const starLight = new THREE.PointLight('#BFD8FF', 0, 40, 2); group.add(starLight);

  const ufo = new THREE.Group(); OUT.add(ufo); ufo.visible = false; ufo.scale.setScalar(0.9);
  const disc = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10), new THREE.MeshBasicMaterial({ color: '#7D88A8', toneMapped: false })); disc.scale.set(1.8, 0.35, 1.8); ufo.add(disc);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#BFE8FF', toneMapped: false })); dome.position.y = 0.18; ufo.add(dome);
  const ufoLamps = []; for (let i = 0; i < 6; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), glow(['#FF5A5A', '#FFD23C', '#5AFF9A', '#5AB4FF', '#C86BFF', '#FFFFFF'][i], 3)); ufo.add(l); ufoLamps.push(l); }
  const beam = new THREE.Mesh(new THREE.ConeGeometry(1.5, 4, 20, 1, true), new THREE.MeshBasicMaterial({ color: '#9CFFD0', transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false })); beam.position.y = -2.1; ufo.add(beam);
  const ufoLight = new THREE.PointLight('#8CFFC8', 0, 40, 2); group.add(ufoLight);


  // ---------------------------------------------------------------- a neon sign on a building outside: always there, dark, and it flickers on when the episode says so (built ONLY when cfg.neon is set)
  let neon = null;
  if (cfg.neon) {
    const nc = cfg.neon, txt = nc.text || 'NEON', col = nc.color || '#7CFFB4', colRgb = nc.rgb || '124,255,180';
    const g = new THREE.Group(); g.position.set(nc.x ?? 0.2, nc.y ?? 0, nc.z ?? -22); OUT.add(g);
    const bh = nc.height ?? 20, bw = nc.width ?? 11;
    const body = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 3), blackM()); body.position.set(0, bh / 2 - 6, 0); g.add(body);
    const top = new THREE.Mesh(new THREE.BoxGeometry(bw * 0.7, 1.2, 2.6), blackM()); top.position.set(0, bh - 6 + 0.6, 0); g.add(top);
    const sy = nc.signY ?? 10.5, sw = bw * 0.9, sh = sw * 0.25;
    const draw = (on) => canvasTex(1024, 256, (c, w, h) => {
      c.clearRect(0, 0, w, h); c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = "bold 150px 'Arial Rounded MT Bold', 'Trebuchet MS', Arial, sans-serif"; c.lineJoin = 'round';
      if (on) { c.shadowColor = col; c.shadowBlur = 22; c.strokeStyle = col; c.lineWidth = 15; c.strokeText(txt, w / 2, h / 2 + 6); c.shadowBlur = 0; c.strokeStyle = '#C9FFE2'; c.lineWidth = 3; c.strokeText(txt, w / 2, h / 2 + 6); }
      else { c.strokeStyle = '#26324A'; c.lineWidth = 9; c.strokeText(txt, w / 2, h / 2 + 6); c.strokeStyle = '#141B2E'; c.lineWidth = 3; c.strokeText(txt, w / 2, h / 2 + 6); }
    }).t;
    const bmat = new THREE.MeshBasicMaterial({ color: '#0A0F26' });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(sw * 1.05, sh * 1.2), bmat); board.position.set(0, sy, 1.53); g.add(board);
    const offM = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), new THREE.MeshBasicMaterial({ map: draw(false), transparent: true, toneMapped: false })); offM.position.set(0, sy, 1.56); g.add(offM);
    const onMat = new THREE.MeshBasicMaterial({ map: draw(true), transparent: true, toneMapped: false, opacity: 0 }); onMat.color.multiplyScalar(0.8);
    const onM = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), onMat); onM.position.set(0, sy, 1.6); g.add(onM);
    // the "pret-pret" start: [from, to, level] seconds after the switch-on; after the last one it stays on
    const seq = nc.flicker || [[0.0, 0.1, 0.55], [0.1, 0.28, 0], [0.28, 0.38, 0.8], [0.38, 0.7, 0], [0.7, 0.8, 0.6], [0.8, 0.92, 0], [0.92, 1.08, 1], [1.08, 1.2, 0.15], [1.2, 1.28, 1], [1.28, 1.4, 0.3]];
    const lvl = (s) => { if (s < 0) return 0; for (const [a, b, l] of seq) if (s >= a && s < b) return l; return s >= seq[seq.length - 1][1] ? 1 : 0; };
    neon = { show(s) { const l = lvl(s) * (s > 2 ? 1 + 0.02 * Math.sin(s * 40) : 1); onMat.opacity = Math.min(1, l);  } };
    neon.show(-1);
  }

  // ---------------------------------------------------------------- a protest banner hung down the face of a building outside (built ONLY when cfg.banner is set): colours and lettering only, no logo
  if (cfg.banner && cfg.banner.style !== 'led') {
    const bc = cfg.banner, lines = bc.lines || ['BENCANA', 'MAKIN PARAH', 'HIDUP', 'MAKIN SUSAH', 'APA KERJA', 'PEMERINTAH?'];
    const g = new THREE.Group(); g.position.set(bc.x ?? -1.2, 0, bc.z ?? -23); OUT.add(g);
    const bh = bc.height ?? 22, bw = bc.width ?? 11, roofY = bh - 6;
    const body = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 3), blackM()); body.position.set(0, bh / 2 - 6, 0); g.add(body);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(bw * 1.04, 0.5, 3.2), blackM()); cap.position.set(0, roofY + 0.25, 0); g.add(cap);
    const BW = bc.w ?? 3.9, BH = bc.h ?? 10.4, top = roofY - 0.4;
    const tex = canvasTex(512, 1352, (c, w, h) => {
      c.fillStyle = bc.color || '#F4C80F'; c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(0,0,0,0.10)'; c.fillRect(0, 0, 14, h); c.fillRect(w - 14, 0, 14, h);
      c.fillStyle = '#111'; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.font = `900 ${bc.font ?? 78}px Impact, 'Arial Black', 'Arial Narrow', sans-serif`;
      lines.forEach((ln, i) => { c.fillText(ln, w / 2, 112 + i * (bc.step ?? 92) + Math.floor(i / 2) * 40); });
      // a black figure holding a paper, hatched ground: the same feeling as the photo, drawn from scratch
      c.save(); c.translate(0, 820); c.fillStyle = '#111';
      c.beginPath(); c.ellipse(200, 120, 70, 82, 0, 0, 6.28); c.fill();
      c.fillRect(150, 190, 100, 40); c.beginPath(); c.moveTo(60, 520); c.quadraticCurveTo(70, 270, 200, 235); c.quadraticCurveTo(330, 270, 340, 520); c.closePath(); c.fill();
      c.fillStyle = bc.color || '#F4C80F'; c.save(); c.translate(235, 360); c.rotate(-0.28); c.fillRect(-60, -48, 120, 96); c.restore();
      c.strokeStyle = '#111'; c.lineWidth = 5; for (let i = 0; i < 26; i++) { c.beginPath(); c.moveTo(330 + i * 6, 260 + (i % 5) * 18); c.lineTo(470, 300 + i * 9); c.stroke(); }
      c.restore();
    }).t;
    const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }); mat.color.setScalar(bc.night ?? 0.5);   // night: the yellow is dim
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(BW, BH), mat); plane.position.set(bc.dx ?? 0.9, top - BH / 2, 1.58); g.add(plane);
    const rope = (x) => { const r = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.9, 0.05), blackM()); r.position.set((bc.dx ?? 0.9) + x, top + 0.4, 1.6); g.add(r); };
    rope(-BW / 2 + 0.2); rope(BW / 2 - 0.2);
    const lamps = [];
    for (const fx of [-3.2, 3.2]) { const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), glow('#FFE6B0', 2.4)); lamp.position.set((bc.dx ?? 0.9) + fx * 0.5, roofY + 0.7, 1.9); g.add(lamp); lamps.push(lamp); }   // two small floodlamps on the roof edge: the visible source of the light on the banner
    if (bc.alarmAt !== undefined) {   // alarmAt (seconds, resolved by episode.js): the floodlamps switch on, the banner brightens and red roof beacons blink in sync
      const dark = bc.night ?? 0.5, lit = bc.lit ?? 0.9, beacons = [];
      for (const [bx, bz, top] of (bc.beacons ?? [[-7, -30, 13], [6, -34, 15], [-1, -40, 18], [11, -44, 17]])) {
        const mast = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7, 0.5), blackM()); mast.position.set(bx, top - 3.5, bz); OUT.add(mast);
        const bl = new THREE.Mesh(new THREE.SphereGeometry(0.38, 10, 8), glow('#FF3B30', 3.4)); bl.position.set(bx, top + 0.2, bz + 0.6); OUT.add(bl); beacons.push(bl);
      }
      updaters.push((t) => {
        const u = Math.max(0, Math.min(1, (t - bc.alarmAt) / 0.8)), e = u * u * (3 - 2 * u);
        mat.color.setScalar(dark + (lit - dark) * e); lamps.forEach((l) => { l.visible = t >= bc.alarmAt; });
        const on = t >= bc.alarmAt + 0.3 && ((t - bc.alarmAt - 0.3) % 1.0) < 0.5; beacons.forEach((b) => { b.visible = on; });
      });
      lamps.forEach((l) => { l.visible = false; }); beacons.forEach((b) => { b.visible = false; });
    }
  }

  // ---------------------------------------------------------------- a digital LED board mounted on a building outside (cfg.banner with style 'led'): the building has a facade with windows, turns a little so a side wall shows, the board is a boxed sign on its wall; dark until alarmAt (seconds), then it flickers on and spills light on the wall; red beacons (also on this roof) blink in sync. Lettering only, no logo
  if (cfg.banner && cfg.banner.style === 'led') {
    const bc = cfg.banner, lines = bc.lines || ['ALERT'], cols = bc.colors || ['#FFFFFF', '#FF5A4D', '#FFD24D'];
    const g = new THREE.Group(); g.position.set(bc.x ?? 1.4, 0, bc.z ?? -23); g.rotation.y = bc.yaw ?? 0.5; OUT.add(g);
    const bh = bc.height ?? 22, bw = bc.width ?? 12, bd = bc.depth ?? 8, roofY = bh - 6, fz = bd / 2;
    const facade = (cols2, rows, seed) => canvasTex(512, Math.round(512 * bh / (cols2 > 6 ? bw : bd)), (c, w, h) => {
      c.fillStyle = '#1B2347'; c.fillRect(0, 0, w, h);
      const cw = w / cols2, rh = h / rows;
      for (let r = 0; r < rows; r++) for (let k = 0; k < cols2; k++) {
        const lit = ((r * 7 + k * 13 + seed) % 9) === 0, cool = ((r * 5 + k * 11 + seed) % 17) === 0;
        c.fillStyle = lit ? '#FFC870' : cool ? '#BFD8FF' : '#0C1226'; c.fillRect(k * cw + cw * 0.2, r * rh + rh * 0.22, cw * 0.6, rh * 0.5);
      }
      c.fillStyle = 'rgba(0,0,0,0.25)'; for (let r = 0; r <= rows; r++) c.fillRect(0, r * rh - 2, w, 4);
    }).t;
    const mk = (tex, k) => { const m = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, fog: false }); m.color.setScalar(k); return m; };
    const front = mk(facade(8, 18, 0), 0.62), side = mk(facade(5, 18, 4), 0.42), roofM = new THREE.MeshBasicMaterial({ color: '#0E1328', toneMapped: false, fog: false });
    const body = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), [side, side, roofM, roofM, front, roofM]); body.position.set(0, bh / 2 - 6, 0); g.add(body);
    const ledge = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.6, 0.6, bd + 0.6), roofM); ledge.position.set(0, roofY + 0.3, 0); g.add(ledge);
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 1.8, 14), roofM); tank.position.set(-3.2, roofY + 1.5, -1); g.add(tank);
    for (const lx of [-3.8, -2.6]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.9, 0.15), roofM); leg.position.set(lx, roofY + 0.7, -1); g.add(leg); }
    const ant = new THREE.Mesh(new THREE.BoxGeometry(0.14, 4.5, 0.14), roofM); ant.position.set(3.4, roofY + 2.5, 0.5); g.add(ant);
    const PW = bc.w ?? 9, PH = bc.h ?? 5.2, py = bc.y ?? 9.6, TH = 0.6;
    // light spilling on the wall around the sign (the sign is the source; a soft rectangle, not a round halo)
    const spill = new THREE.Mesh(new THREE.PlaneGeometry(PW * 1.5, PH * 1.7), new THREE.MeshBasicMaterial({
      map: canvasTex(256, 160, (c, w, h) => { c.clearRect(0, 0, w, h); c.shadowColor = '#FF4B3E'; c.shadowBlur = 38; c.fillStyle = '#FF4B3E'; c.fillRect(w * 0.27, h * 0.27, w * 0.46, h * 0.46); }).t,
      transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false })); spill.position.set(0, py, fz + 0.04); g.add(spill);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(PW + 0.5, PH + 0.5, TH), new THREE.MeshBasicMaterial({ color: '#10131F', toneMapped: false, fog: false })); frame.position.set(0, py, fz + TH / 2); g.add(frame);
    for (const lx of [-PW / 2 + 0.6, PW / 2 - 0.6]) for (const ly of [py - PH / 2 - 0.9, py + PH / 2 + 0.9]) { const br = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.5), roofM); br.position.set(lx, ly, fz + 0.25); g.add(br); const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, Math.abs(ly - py) - PH / 2 + 0.2, 0.16), roofM); arm.position.set(lx, (ly + py + (ly < py ? -PH / 2 : PH / 2)) / 2, fz + 0.3); g.add(arm); }
    const tex = canvasTex(1024, Math.round(1024 * PH / PW), (c, w, h) => {
      c.fillStyle = '#07080C'; c.fillRect(0, 0, w, h);
      c.strokeStyle = bc.border || '#FF3B30'; c.lineWidth = 10; c.strokeRect(14, 14, w - 28, h - 28);
      c.textAlign = 'center'; c.textBaseline = 'middle';
      const step = (h - 80) / lines.length;
      lines.forEach((ln, i) => {
        c.font = "900 100px 'Arial Black', Impact, sans-serif"; const f = Math.min(step * 0.8, 100 * (w - 130) / c.measureText(ln).width);
        c.font = `900 ${f}px 'Arial Black', Impact, sans-serif`; const col = cols[i] || '#FFFFFF';
        c.shadowColor = col; c.shadowBlur = 14; c.fillStyle = col; c.fillText(ln, w / 2, 40 + step * (i + 0.5));
      });
      c.shadowBlur = 0; c.fillStyle = 'rgba(0,0,0,0.36)';
      for (let y = 3; y < h; y += 8) for (let x = 3; x < w; x += 8) { c.beginPath(); c.arc(x, y, 2.6, 0, 6.28); c.fill(); }
    }).t;
    const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, fog: false }); mat.color.setScalar(bc.night ?? 0.05);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), mat); panel.position.set(0, py, fz + TH + 0.02); g.add(panel);
    const beacons = [];
    const own = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), glow('#FF3B30', 3.4)); own.position.set(3.4, roofY + 4.9, 0.5); own.visible = false; g.add(own); beacons.push(own);
    for (const [bx, bz, top] of (bc.beacons ?? [[-7, -30, 13], [6, -34, 15], [-1, -40, 18], [11, -44, 17]])) {
      const mast = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7, 0.5), blackM()); mast.position.set(bx, top - 3.5, bz); OUT.add(mast);
      const bl = new THREE.Mesh(new THREE.SphereGeometry(0.38, 10, 8), glow('#FF3B30', 3.4)); bl.position.set(bx, top + 0.2, bz + 0.6); bl.visible = false; OUT.add(bl); beacons.push(bl);
    }
    const seq = [[0, 0.1, 0.7], [0.1, 0.25, 0], [0.25, 0.38, 1], [0.38, 0.5, 0.15], [0.5, 0.6, 1], [0.6, 0.72, 0.3]];
    const lvl = (s2) => { if (s2 < 0) return 0; for (const [a2, b2, l] of seq) if (s2 >= a2 && s2 < b2) return l; return 1; };
    if (bc.alarmAt !== undefined) updaters.push((t) => {
      const s2 = t - bc.alarmAt, dark = bc.night ?? 0.05, lit = bc.lit ?? 1.0, L = lvl(s2) * (s2 > 1 ? 1 + 0.05 * Math.sin(s2 * 7) : 1);
      mat.color.setScalar(dark + (lit - dark) * L); spill.material.opacity = 0.55 * Math.min(1, L);
      const on = s2 >= 0.4 && ((s2 - 0.4) % 1.0) < 0.5; beacons.forEach((b3) => { b3.visible = on; });
    });
  }

  // ---------------------------------------------------------------- extra moments outside the window, built ONLY when the episode asks for them (so older episodes stay identical)
  // each one: { group, update(u, e) }  u: 0..1 progress, e: a smooth 0..1..0 bell of u. Colours are black silhouettes or soft glows, tiny and far, no logos.
  const ox = cfg.outside || {};
  const extra = {};
  const blk = () => new THREE.MeshBasicMaterial({ color: '#04060E' });
  const mkLight = (col) => { const l = new THREE.PointLight(col, 0, 40, 2); l.userData.extra = true; group.add(l); return l; };
  if (ox.type === 'santa') {   // a sleigh with reindeer crossing the sky in front of the moon, seen as a silhouette, with a warm glow and tiny sleigh bells
    const g = new THREE.Group(); OUT.add(g); g.visible = false; g.scale.setScalar(0.8);
    const add = (geo, x, y, rz = 0, sx = 1, sy = 1) => { const m = new THREE.Mesh(geo, blk()); m.position.set(x, y, 0); m.rotation.z = rz; m.scale.set(sx, sy, 1); g.add(m); return m; };
    add(new THREE.BoxGeometry(2.0, 0.55, 0.2), 0, 0); add(new THREE.CylinderGeometry(0.34, 0.4, 0.2, 14, 1, false, 0, Math.PI), 1.05, 0.1, Math.PI / 2, 1, 1);   // sleigh body and curled front
    add(new THREE.BoxGeometry(2.3, 0.07, 0.1), 0.1, -0.42, 0); add(new THREE.SphereGeometry(0.42, 12, 10), -0.1, 0.62, 0, 1, 1.15); add(new THREE.ConeGeometry(0.26, 0.55, 10), -0.1, 1.2, 0.18);   // runner, Santa, hat
    for (let i = 0; i < 3; i++) {   // three reindeer, each: body, neck, head, antlers, legs
      const x = 2.3 + i * 1.55;
      add(new THREE.SphereGeometry(0.4, 12, 10), x, 0.05, 0, 1.5, 0.8); add(new THREE.BoxGeometry(0.16, 0.5, 0.1), x + 0.55, 0.38, -0.5); add(new THREE.SphereGeometry(0.17, 10, 8), x + 0.72, 0.62, 0, 1.3, 1);
      add(new THREE.BoxGeometry(0.05, 0.4, 0.05), x + 0.7, 0.92, 0.5); add(new THREE.BoxGeometry(0.05, 0.4, 0.05), x + 0.82, 0.92, -0.2);
      add(new THREE.BoxGeometry(0.07, 0.5, 0.07), x - 0.3, -0.38, 0.5); add(new THREE.BoxGeometry(0.07, 0.5, 0.07), x + 0.3, -0.38, -0.5);
      add(new THREE.BoxGeometry(1.3, 0.025, 0.05), x - 0.78, 0.0, 0);   // the rein
    }
    const gs = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ map: softDot('255,200,120'), transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); gs.position.set(2.4, 0.2, -0.2); g.add(gs);
    const l = mkLight('#FFC27A');
    extra.santa = { group: g, update(u, e) { const x = -24 + 48 * u, y = perch.y + 7.3 + 0.9 * Math.sin(u * 4.0) + 1.2 * u; g.position.set(x, y, -34); g.rotation.z = 0.06 * Math.sin(u * 6); l.intensity = 10 * e; l.position.set(x * 0.35, y * 0.9, -20); } };
  } else if (ox.type === 'ketupat') {   // a shooting star shaped like a ketupat (a green woven diamond) with a glowing tail
    const g = new THREE.Group(); OUT.add(g); g.visible = false;
    const tex = canvasTex(160, 160, (c, w, h) => { c.clearRect(0, 0, w, h); c.save(); c.translate(w / 2, h / 2); c.rotate(Math.PI / 4); c.fillStyle = '#7FD06A'; c.fillRect(-46, -46, 92, 92); c.strokeStyle = '#2F8A3F'; c.lineWidth = 6; for (let i = -40; i <= 40; i += 16) { c.beginPath(); c.moveTo(i, -46); c.lineTo(i, 46); c.stroke(); c.beginPath(); c.moveTo(-46, i); c.lineTo(46, i); c.stroke(); } c.strokeStyle = '#E8F7B0'; c.lineWidth = 5; c.strokeRect(-46, -46, 92, 92); c.restore(); });
    const body = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9), new THREE.MeshBasicMaterial({ map: tex.t, transparent: true, toneMapped: false })); g.add(body);
    glowSprite(0, 0, -0.05, 5.5, '170,255,140', 0.7, g);
    const tail = new THREE.Mesh(new THREE.PlaneGeometry(10, 0.5), new THREE.MeshBasicMaterial({ map: canvasTex(256, 16, (c, w, h) => { const gr = c.createLinearGradient(w, 0, 0, 0); gr.addColorStop(0, 'rgba(190,255,150,0.85)'); gr.addColorStop(1, 'rgba(190,255,150,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); }).t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); tail.position.set(5.6, 0, -0.1); g.add(tail);
    const l = mkLight('#B8FF9A');
    extra.ketupat = { group: g, update(u, e) { const x = -16 + 34 * u, y = perch.y + 10.5 - 6.5 * u; g.position.set(x, y, -40); g.rotation.z = Math.atan2(-6.5, 34); body.rotation.z = u * 5; g.scale.setScalar(0.7 + 0.5 * e); l.intensity = 9 * e; l.position.set(x * 0.4, y * 0.85, -20); } };
  } else if (ox.type === 'firework') {   // three bursts of soft sparks high above the roofs, one after the other
    const g = new THREE.Group(); OUT.add(g); g.visible = false;
    const cols = ox.colors || ['#FF5A7A', '#FFD84D', '#5AC8FF'], N = 70, bursts = [];
    cols.forEach((col, k) => { const pos = new Float32Array(N * 3), dirs = []; for (let i = 0; i < N; i++) { const a = R() * 6.283, b = Math.acos(2 * R() - 1), s = 3 + R() * 4; dirs.push([Math.sin(b) * Math.cos(a) * s, Math.sin(b) * Math.sin(a) * s, Math.cos(b) * s * 0.3]); } const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: softDot('255,255,255'), color: col, size: 0.55, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); g.add(pts); bursts.push({ geo, pts, dirs, cx: -9 + k * 9 + (R() - 0.5) * 3, cy: perch.y + 9.5 + (k % 2) * 2.2 }); });
    const l = mkLight('#FFB7A0');
    extra.firework = { group: g, update(u, e) { bursts.forEach((b, k) => { const s = (u - k * 0.22) / 0.42; const on = s > 0 && s < 1; b.pts.visible = on; if (!on) return; const a = b.geo.attributes.position; for (let i = 0; i < b.dirs.length; i++) { const t = 1 - (1 - s) * (1 - s); a.array[i * 3] = b.cx + b.dirs[i][0] * t; a.array[i * 3 + 1] = b.cy + b.dirs[i][1] * t - 2.2 * s * s; a.array[i * 3 + 2] = -38 + b.dirs[i][2] * t; } a.needsUpdate = true; b.pts.material.opacity = Math.sin(Math.PI * Math.min(1, s * 1.1)) * 0.95; }); l.intensity = 14 * e; l.position.set(0, perch.y + 5, -22); } };
  } else if (ox.type === 'lantern') {   // sky lanterns rising slowly, warm and swaying
    const g = new THREE.Group(); OUT.add(g); g.visible = false; const items = [];
    for (let i = 0; i < 7; i++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.26, 0.55, 10), glow('#FFB45A', 2.2)); const gl = glowSprite(0, 0, -0.1, 2.4, '255,170,90', 0.7, m); m.userData = { x: -12 + i * 4 + (R() - 0.5) * 2, y0: perch.y + 0.5 + R() * 3, sp: 7 + R() * 5, ph: R() * 6.28 }; g.add(m); items.push(m); }
    const l = mkLight('#FFB45A');
    extra.lantern = { group: g, update(u, e) { items.forEach((m) => { const d = m.userData; m.position.set(d.x + Math.sin(u * 5 + d.ph) * 0.8, d.y0 + u * d.sp, -34 - (d.ph % 4)); m.scale.setScalar(0.8 + 0.25 * Math.sin(d.ph)); }); l.intensity = 8 * e; l.position.set(0, perch.y + 6, -20); } };
  } else if (ox.type === 'sprite') {   // any transparent PNG the owner or the script gives: it crosses, rises, falls or drifts, with an optional glow
    const im = await loadImage(`${base}/${ox.image}`); const tex = new THREE.CanvasTexture(im); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const g = new THREE.Group(); OUT.add(g); g.visible = false; const w = ox.size ?? 2.6;
    g.add(new THREE.Mesh(new THREE.PlaneGeometry(w, w * (im.height / im.width)), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, depthWrite: false })));
    if (ox.glow) glowSprite(0, 0, -0.1, w * 2.2, ox.glow, 0.6, g);
    const l = mkLight(ox.light || '#FFFFFF'); const path = ox.path || 'cross', y0 = perch.y + (ox.height ?? 7.5);
    extra.sprite = { group: g, update(u, e) {
      let x = 0, y = y0, rz = 0;
      if (path === 'cross') { x = -22 + 44 * u; y = y0 + 1.0 * Math.sin(u * 3); rz = 0.1; }
      else if (path === 'cross_back') { x = 22 - 44 * u; y = y0 + 1.0 * Math.sin(u * 3); rz = -0.1; }
      else if (path === 'rise') { x = ox.x ?? 0; y = y0 - 5 + 12 * u; rz = 0.05 * Math.sin(u * 8); }
      else if (path === 'fall') { x = (ox.x ?? 0) + 4 * u; y = y0 + 6 - 12 * u; rz = u * 3; }
      else { x = (ox.x ?? 0) + 3 * Math.sin(u * 6); y = y0 + 1.5 * Math.sin(u * 4); rz = 0.12 * Math.sin(u * 5); }   // drift
      g.position.set(x, y, -30); g.rotation.z = rz; g.scale.setScalar(0.85 + 0.15 * e); l.intensity = (ox.lightIntensity ?? 5) * e; l.position.set(x * 0.35, y * 0.9, -20);
    } };
  } else if (ox.type === 'constellation') {   // stars that join into a zigzag line going down (a falling chart), then a label glows beside it; it stays until the end of the video
    const g = new THREE.Group(); OUT.add(g); g.visible = false;
    if (ox.highSky) { sky.scale.y = 1.9; const n2 = 220, p2 = new Float32Array(n2 * 3); for (let i = 0; i < n2; i++) { p2[i * 3] = -70 + R() * 140; p2[i * 3 + 1] = 36 + R() * 40; p2[i * 3 + 2] = -78; } const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.BufferAttribute(p2, 3)); OUT.add(new THREE.Points(g2, new THREE.PointsMaterial({ color: '#FFFFFF', size: 0.32, transparent: true, opacity: 0.8, depthWrite: false }))); }
    const sc = ox.scale ?? 1, Z = ox.z ?? -36, cx = ox.x ?? 0, cy = ox.y ?? perch.y + (ox.height ?? 7.0);
    const P = (ox.points || [[-9, 6.6], [-6.4, 4.2], [-4.4, 5.6], [-1.4, 2.6], [0.6, 3.9], [3.4, 1.0], [5.2, 2.2], [8.0, -1.0]]).map(([x, y]) => [cx + x * sc, cy + y * sc]);
    const stars = P.map(([x, y], i) => { const grp = new THREE.Group(); grp.position.set(x, y, Z); glowSprite(0, 0, 0, (ox.halo ?? 0.8) * sc, '190,215,255', 0.55, grp); const core = new THREE.Mesh(new THREE.CircleGeometry(0.2 * sc, 16), glow('#FFFFFF', 1.6)); grp.add(core); g.add(grp); return { grp, ph: i * 1.7 }; });
    const segs = [];
    for (let i = 0; i < P.length - 1; i++) {
      const [x1, y1] = P[i], [x2, y2] = P[i + 1], len = Math.hypot(x2 - x1, y2 - y1);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.14 * sc), new THREE.MeshBasicMaterial({ color: '#BCD6FF', transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      m.position.set(x1, y1, Z - 0.05); m.rotation.z = Math.atan2(y2 - y1, x2 - x1); g.add(m); segs.push({ m, x1, y1, x2, y2, len });
    }
    const label = ox.text ?? 'IHSG', price = ox.price ?? '', change = ox.change ?? '';
    const lt = canvasTex(768, 384, (c, w, h) => {
      c.clearRect(0, 0, w, h); c.textBaseline = 'alphabetic'; c.shadowColor = 'rgba(160,200,255,0.95)'; c.shadowBlur = 26;
      c.fillStyle = '#EAF2FF'; c.font = '700 150px "Segoe UI", Arial, sans-serif'; c.fillText(label, 24, 160);
      c.shadowBlur = 16; c.font = '600 74px "Segoe UI", Arial, sans-serif'; c.fillStyle = '#CFE0FF'; if (price) c.fillText(price, 28, 252);
      c.fillStyle = '#FF7A7A'; c.shadowColor = 'rgba(255,100,100,0.9)'; c.font = '700 64px "Segoe UI", Arial, sans-serif'; if (change) c.fillText(change, 28, 332);
    });
    const lw = ox.labelSize ?? 7.2;
    const lm = new THREE.Mesh(new THREE.PlaneGeometry(lw, lw / 2), new THREE.MeshBasicMaterial({ map: lt.t, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
    lm.position.set(cx + (ox.labelX ?? -8.2) * sc + lw / 2, cy + (ox.labelY ?? 8.6) * sc, Z); g.add(lm);
    const l = mkLight('#A8C8FF');
    extra.constellation = { group: g, update(u, e) {
      const n = P.length, a = Math.min(1, u / 0.68) * (n - 1);   // 0..n-1: how far the line has been drawn
      stars.forEach((s, i) => { const k = Math.min(1, Math.max(0, a - i + 1)); s.grp.visible = k > 0; s.grp.scale.setScalar((0.4 + 0.6 * k) * (1 + 0.12 * Math.sin(u * 30 + s.ph))); });
      segs.forEach((sg, i) => { const k = Math.min(1, Math.max(0, a - i)); sg.m.visible = k > 0; sg.m.scale.x = Math.max(0.001, sg.len * k); sg.m.position.set(sg.x1 + (sg.x2 - sg.x1) * k / 2, sg.y1 + (sg.y2 - sg.y1) * k / 2, Z - 0.05); });
      lm.material.opacity = Math.min(1, Math.max(0, (u - 0.5) / 0.22));
      l.intensity = 6 * Math.min(1, u / 0.3); l.position.set(cx * 0.35, cy, -20);
    } };
  }

  const outside = {
    event(type, u) {   // u: 0..1 progress of the moment; outside that range nothing is visible and no light is cast
      const on = u > 0 && u < 1, e = Math.sin(Math.PI * Math.max(0, Math.min(1, u)));
      car.visible = type === 'car' && on; star.visible = type === 'star' && on; ufo.visible = type === 'ufo' && on;
      carLight.intensity = 0; starLight.intensity = 0; ufoLight.intensity = 0;
      if (type === 'car') {   // from the left edge of the sky to the right, nose up, a gentle bob, the rocket flares
        const x = -22 + 44 * u, y = perch.y + 3.6 + 1.0 * Math.sin(u * 3.0) + 1.6 * u;
        car.position.set(x, y, -24); car.rotation.z = 0.16; flame.scale.set(1 + 0.25 * Math.sin(u * 160), 1, 1);
        carLight.intensity = 22 * e; carLight.position.set(x * 0.3, y * 0.9, -18);
      } else if (type === 'star') {   // a quick diagonal streak across the upper sky
        const x = -16 + 34 * u, y = perch.y + 10.5 - 6.5 * u;
        star.position.set(x, y, -40); star.rotation.z = Math.atan2(-6.5, 34); star.scale.setScalar(0.7 + 0.5 * e);
        starLight.intensity = 9 * e; starLight.position.set(x * 0.4, y * 0.85, -20);
      } else if (type === 'ufo') {   // a slow, wobbling saucer drifting right to left, blinking lamps
        const x = 20 - 40 * u, y = perch.y + 7.5 + 0.7 * Math.sin(u * 9) + 1.2 * u;
        ufo.position.set(x, y, -36); ufo.rotation.z = 0.12 * Math.sin(u * 9);
        ufoLamps.forEach((l, i) => { const a = u * 40 + (i / 6) * 6.283; l.position.set(Math.cos(a) * 1.5, -0.02, Math.sin(a) * 1.5); });
        beam.material.opacity = 0.12 * (0.6 + 0.4 * Math.sin(u * 60)); ufoLight.intensity = 12 * e; ufoLight.position.set(x * 0.35, y * 0.9, -22);
      }
      for (const [k, o] of Object.entries(extra)) { o.group.visible = type === k && on; if (type === k && on) o.update(u, e); }
      if (!on) for (const l of group.children) if (l.isPointLight && l.userData.extra) l.intensity = 0;
    },
  };

  // ---------------------------------------------------------------- the phone: rises from behind the lid between the two characters, shows an image, and lights Claude's face
  const phone = new THREE.Group(); phone.visible = false; group.add(phone);
  const phoneBody = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.0, 0.1), std('#101218', 0.5)); phoneBody.castShadow = true; phone.add(phoneBody);
  const phoneScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 1.9), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.55, 0.55), toneMapped: false })); phoneScreen.position.z = 0.055; phone.add(phoneScreen);
  const phoneLight = new THREE.PointLight('#DDE8FF', 0, 5.5, 2);   // a short reach: it lights Claude's face, not the room
  group.add(phoneLight);
  let phoneLoaded = false;
  if (cfg.phone && cfg.phone.image) {
    const im = await loadImage(`${base}/${cfg.phone.image}`); const tex = new THREE.CanvasTexture(im); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    phoneScreen.material.map = tex; phoneScreen.material.needsUpdate = true; phoneLoaded = true;
  }
  const phoneApi = {
    show(u) { if (!phoneLoaded) return; const e = smoothstep(u); phone.visible = u > 0.002; phone.scale.setScalar(cfg.phone.scale ?? 1); phone.position.set(cfg.phone.x ?? 0, perch.y - 1.2 + 2.25 * e + (cfg.phone.y ?? 0), perch.z - 0.35 + 0.55 * e + (cfg.phone.z ?? 0)); phone.rotation.set(-0.06 * e, -0.1 * e, 0); phoneLight.position.set(0.55, perch.y + 0.9, perch.z + 1.4); phoneLight.intensity = (cfg.phone.light ?? 6) * e; },
    group: phone, light: phoneLight,
  };

  // ---------------------------------------------------------------- the desk lamp: an articulated arm, its head above the laptop aimed at the characters. Its head IS the key light
  const lampMat = std('#2A2F3A', 0.6);
  const headMat = new THREE.MeshStandardMaterial({ color: '#2A2F3A', emissive: '#FFB070', emissiveIntensity: 1.6, roughness: 0.6, side: THREE.DoubleSide });
  const deskLamp = new THREE.Group(); group.add(deskLamp);
  const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.95, 0.22, 28), lampMat); lampBase.castShadow = true;
  const limbA = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1, 10), lampMat), limbB = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1, 10), lampMat);
  const joint = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), lampMat);
  const head = new THREE.Group(); const coneGeo = new THREE.CylinderGeometry(0.25, 0.95, 1.1, 28, 1, true); coneGeo.rotateX(-Math.PI / 2);
  head.add(new THREE.Mesh(coneGeo, headMat)); const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 12), new THREE.MeshBasicMaterial({ color: '#FFE2B0', toneMapped: false })); bulb.position.z = 0.1; head.add(bulb);
  const lampGlow = glowSprite(0, 0, 0.5, 5, '255,200,130', 0.75, head);
  deskLamp.add(lampBase, limbA, limbB, joint, head);
  const placeLimb = (m, a, b) => { const d = new THREE.Vector3().subVectors(b, a); m.scale.set(1, d.length(), 1); m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()); m.castShadow = true; };
  function poseLamp(hp, target) {
    const baseP = new THREE.Vector3(hp.x + 2.6, 0.2, hp.z - 1.5), elbow = new THREE.Vector3(hp.x + 3.1, hp.y * 0.6, hp.z - 1.2);
    lampBase.position.set(baseP.x, 0.31, baseP.z); placeLimb(limbA, new THREE.Vector3(baseP.x, 0.4, baseP.z), elbow); placeLimb(limbB, elbow, hp);
    joint.position.copy(elbow); head.position.copy(hp); head.lookAt(target);
  }

  // ---------------------------------------------------------------- the light rig
  const hemi = new THREE.HemisphereLight('#2A3C78', '#150E18', 0.3); group.add(hemi);
  const rig = new THREE.Group(); group.add(rig);
  const face = new THREE.Vector3(-1.35, perch.y + 1.05, perch.z);
  const place = (o) => { const az = (o.az * Math.PI) / 180, el = (o.el * Math.PI) / 180; return new THREE.Vector3(face.x + o.d * Math.sin(az) * Math.cos(el), face.y + o.d * Math.sin(el), face.z + o.d * Math.cos(az) * Math.cos(el)); };
  const roles = new Map();   // role -> { light, specs: { presetName: spec } }
  function prepare(names) {
    while (rig.children.length) { const c = rig.children.pop(); if (c.target) rig.remove(c.target); }
    roles.clear();
    for (const name of names) {
      const p = PRESETS[name]; if (!p) throw new Error('no lighting preset: ' + name + ' (' + Object.keys(PRESETS).join(', ') + ')');
      for (const o of p.lights) {
        if (!roles.has(o.role)) {
          let L;
          if (o.type === 'spot') { L = new THREE.SpotLight(o.color, 0, 80, o.angle, 0.9, 2); L.target.position.copy(face); rig.add(L.target); }
          else L = new THREE.PointLight(o.color, 0, 40, 2);
          L.userData = { role: o.role }; rig.add(L); roles.set(o.role, { light: L, specs: {} });
        }
        roles.get(o.role).specs[name] = o;
      }
    }
    for (const r of roles.values()) { const sh = Object.values(r.specs).some((s) => s.shadow); if (sh && r.light.isSpotLight) { r.light.castShadow = true; r.light.shadow.mapSize.set(1024, 1024); r.light.shadow.bias = -0.0005; r.light.shadow.radius = 5; } }
  }
  const tmpA = new THREE.Color(), tmpB = new THREE.Color();
  // blend preset a into preset b by k (0..1); factors multiplies each role's intensity (the story's own causes: a flicker, a dimming, a page of the screen)
  function apply(a, b, k, factors = {}) {
    for (const [role, r] of roles) {
      const sa = r.specs[a] ?? r.specs[b], sb = r.specs[b] ?? r.specs[a];
      if (!sa) { r.light.intensity = 0; continue; }   // this role belongs to a preset that is not in play right now: the light is simply off
      const ia = r.specs[a] ? r.specs[a].i : 0, ib = r.specs[b] ? r.specs[b].i : 0;
      const pa = place(sa), pb = place(sb);
      r.light.position.lerpVectors(pa, pb, k);
      tmpA.set(sa.color); tmpB.set(sb.color); r.light.color.copy(tmpA).lerp(tmpB, k);
      r.light.intensity = lerp(ia, ib, k) * (factors[role] ?? 1) * (factors.all ?? 1);
      if (r.light.isSpotLight && sa.angle) r.light.angle = lerp(sa.angle, sb.angle ?? sa.angle, k);
    }
    const pa = PRESETS[a], pb = PRESETS[b]; hemi.intensity = lerp(pa.hemi, pb.hemi, k) * (factors.hemi ?? 1);
    const key = roles.get('key');
    deskLamp.visible = !!key;
    deskLamp.visible = !!key && key.light.position.y < 8.5 && key.light.position.z < face.z + 2.5;   // a key light in FRONT of the characters (preset 'screen') would put the lamp head and its glow in front of the lens
    if (key) { poseLamp(key.light.position, face); const kf = factors.key ?? 1; headMat.emissiveIntensity = 1.6 * Math.min(1.6, kf); lampGlow.material.opacity = 0.75 * Math.min(1.4, kf); }
  }
  const lighting = {
    prepare, apply, presets: PRESETS,
    role: (r) => (roles.get(r) ? roles.get(r).light : null),
    use(name) { prepare([name]); apply(name, name, 0); },
  };
  lighting.use(cfg.light ?? 'rembrandt');

  return {
    group, perch, face, lighting, screen, phone: phoneApi, outside, neon, lamp: { head: headMat, glow: lampGlow }, window: WIN,
    update: (t) => updaters.forEach((u) => u(t)),
  };
}
