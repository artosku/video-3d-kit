// An overlay world: nothing is drawn but the characters and a soft contact shadow, on a TRANSPARENT picture (world.json "transparent": true).
// tools/episode.py encode lays the frames over the episode's background video (episode.json "overlay": { "video": "path.mp4" }).
// The characters stand low in the picture but ABOVE the bottom 35% (TikTok and Instagram put the caption and buttons there), small, with 120 px at the sides and clear of the right-hand button column: feet at 36% from the bottom, ayam x about 22%, claude x about 72%.
import * as THREE from 'three';

export async function createWorld(scene, cfg) {
  const group = new THREE.Group(); scene.add(group);
  scene.background = null;
  const ov = cfg.episode?.overlayLook || {};
  const stage = { y: 0, z: 0, scale: ov.scale ?? 1.0, left: { x: ov.leftX ?? -4.15, yaw: 0.3 }, right: { x: ov.rightX ?? 4.05, yaw: -0.3 } };

  // a floor that only shows the shadow (transparent everywhere else)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), new THREE.ShadowMaterial({ opacity: ov.shadow ?? 0.2, color: '#06333A' }));
  floor.material.depthWrite = false; floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0.01, 0); floor.receiveShadow = true; group.add(floor);

  // light: a soft key from the front-left (casts the shadow), a cool rim from behind, an even sky so nothing goes black
  const hemi = new THREE.HemisphereLight(ov.sky ?? '#FFF1DC', ov.ground ?? '#8A6A98', ov.hemi ?? 0.7); group.add(hemi);
  const key = new THREE.DirectionalLight(ov.keyColor ?? '#FFE9C8', ov.keyI ?? 1.55); key.position.set(-1.5, 11, 9); key.target.position.set(0, 1, 0); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 30 });
  group.add(key, key.target);
  const rim = new THREE.DirectionalLight(ov.rimColor ?? '#8FE3EA', ov.rimI ?? 1.1); rim.position.set(6, 4, -6); group.add(rim);
  const fill = new THREE.DirectionalLight(ov.fillColor ?? '#FFD9C0', ov.fillI ?? 0.25); fill.position.set(5, 3, 9); group.add(fill);
  const base = { key: key.intensity, rim: rim.intensity, fill: fill.intensity, hemi: hemi.intensity };
  const lighting = {
    prepare() {},
    apply(a, b, k, f = {}) { key.intensity = base.key * (f.key ?? 1) * (f.all ?? 1); rim.intensity = base.rim * (f.rim ?? 1); fill.intensity = base.fill * (f.fill ?? 1); hemi.intensity = base.hemi * (f.hemi ?? 1); },
    role() { return null; },
  };

  // camera: a fixed, almost flat view; the feet sit near the bottom of the frame. h = how much of the world fits in the picture height
  const dist = ov.dist ?? 24, h = 2 * dist * Math.tan((46 / 2) * Math.PI / 180), lookY = (ov.feet ?? 0.36) * -1 * h + h / 2;
  // the camera stands at the characters' own eye level, looking straight ahead (never down at them: no top of the head), and the picture is SHIFTED up with a lens shift so they sit low in the frame
  const eyeY = ov.eye ?? 0.9, viewShift = (lookY - eyeY) / h;
  const shot = (cx, d, fov) => ({ pos: [cx, eyeY, d], look: [cx, eyeY, 0], fov });
  // ---- outro: a cartoon whirlpool that covers the picture from the edges and drains in the middle, then an iris opens onto a blue end card
  const O = cfg.episode?.outro; let outro = null, tick = () => {}, tick2 = () => {};
  const AR = 1080 / 1920, vw = h * AR * 1.2, vh = h * 1.2, px = (xp, yp) => [(xp / 1080 - 0.5) * h * AR, lookY + (0.5 - yp / 1920) * h];
  if (O) {
    const vs = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
    const vortex = new THREE.Mesh(new THREE.PlaneGeometry(vw, vh), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: { uT: { value: -1 }, uAsp: { value: AR } }, vertexShader: vs,
      fragmentShader: `
        uniform float uT; uniform float uAsp; varying vec2 vUv;
        void main() {
          vec2 p = (vUv - 0.5) * vec2(uAsp, 1.0) * 2.0 / 1.2;
          float r = length(p), a = atan(p.y, p.x), t = max(uT, 0.0);
          float edge = 1.5 - 1.85 * smoothstep(0.0, 1.0, t / 1.0);
          float hole = 0.045;
          float spin = a + 2.6 / (r + 0.28) - t * (2.2 + 0.9 * t);
          float s = sin(spin * 3.0 + sin(r * 7.0 - t * 3.0) * 0.5);
          vec3 base = vec3(0.07, 0.46, 0.80), light = vec3(0.27, 0.72, 0.95), foam = vec3(0.92, 0.98, 1.0), deep = vec3(0.04, 0.22, 0.46);
          vec3 c = base;
          c = mix(c, light, smoothstep(-0.10, -0.04, s));
          c = mix(c, foam, smoothstep(0.62, 0.68, s));
          c = mix(c, deep, smoothstep(0.35, 0.0, r) * 0.5);
          c = mix(c, foam, smoothstep(0.045, 0.0, abs(r - edge - 0.02)));
          c = mix(c, vec3(0.03, 0.12, 0.28), smoothstep(hole + 0.02, hole - 0.01, r));
          c = mix(c, foam, smoothstep(0.02, 0.0, abs(r - hole - 0.012)));
          float alpha = smoothstep(edge - 0.01, edge + 0.03, r) * step(0.001, uT + 1.0) * (uT < 0.0 ? 0.0 : 1.0);
          gl_FragColor = vec4(c, alpha);
        }`,
    }));
    vortex.position.set(0, lookY, -1.4); vortex.renderOrder = 5; group.add(vortex);
    // the end card: a canvas picture (blue, the offer, the Play Store badge) revealed by a circle growing from the middle
    const cv = document.createElement('canvas'); cv.width = 1080; cv.height = 1920; const g = cv.getContext('2d'), T = { title: 'Title', pill: '', sub: '', dl: '', store: '', badge: 'none', color: '#2A7BFF', color2: '#0F3BB8', accent: '#FFD84A', ...(O.texts || {}) };   // outro.texts: title, pill (a yellow tag), sub, dl + store (the button text), badge 'play' draws a simplified store mark, 'none' draws only the button; colours
    
    const gr = g.createLinearGradient(0, 0, 0, 1920); gr.addColorStop(0, T.color); gr.addColorStop(1, T.color2); g.fillStyle = gr; g.fillRect(0, 0, 1080, 1920);
    g.fillStyle = 'rgba(255,255,255,0.07)'; [[180, 300, 260], [930, 620, 340], [120, 1500, 300], [980, 1700, 240]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill(); });
    const F = '"Segoe UI", "Helvetica Neue", Arial, sans-serif'; g.textAlign = 'center';
    g.fillStyle = '#FFFFFF'; g.font = `800 170px ${F}`; g.fillText(T.title, 540, 360);
    if (T.pill) { const pw = 640, ph = 120; g.fillStyle = T.accent; g.beginPath(); g.roundRect(540 - pw / 2, 420, pw, ph, 60); g.fill(); g.fillStyle = T.color2; g.font = `800 74px ${F}`; g.fillText(T.pill, 540, 505); }
    g.fillStyle = '#D5E6FF'; g.font = `600 58px ${F}`; if (T.sub) g.fillText(T.sub, 540, 635);
    // the button: a rounded white tile with the words; badge "play" adds a simplified four-colour store mark on its left (a real brand: only when the owner wants it)
    if (T.store || T.dl) {
      const bx = 150, by = 960, bw = 780, bh = 150, mark = T.badge === 'play', tx0 = mark ? bx + 190 : bx + 60; g.fillStyle = '#FFFFFF'; g.beginPath(); g.roundRect(bx, by, bw, bh, 36); g.fill();
      if (mark) {
        const tx = bx + 40, ty = by + 22, tw = 100, th = 106, mx = tx + tw * 0.5, my = ty + th / 2;
        const tri = (pts, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); g.fill(); };
        tri([tx, ty, mx, my, tx, ty + th], '#00C2FF'); tri([tx, ty, tx + tw, my, mx, my], '#00E676'); tri([tx, ty + th, tx + tw, my, mx, my], '#FF3D57'); tri([tx + tw * 0.74, my - th * 0.13, tx + tw, my, tx + tw * 0.74, my + th * 0.13], '#FFD000');
      }
      g.textAlign = 'left'; g.fillStyle = '#5B6475'; g.font = `600 40px ${F}`; if (T.dl) g.fillText(T.dl, tx0, by + 62); g.fillStyle = '#111827'; g.font = `800 66px ${F}`; g.fillText(T.store, tx0, T.dl ? by + 126 : by + 100);
    }
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.NoColorSpace;
    const card = new THREE.Mesh(new THREE.PlaneGeometry(vw / 1.2, vh / 1.2), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: { uTex: { value: tex }, uIris: { value: 0 }, uAsp: { value: AR } }, vertexShader: vs,
      fragmentShader: 'uniform sampler2D uTex; uniform float uIris; uniform float uAsp; varying vec2 vUv; void main(){ vec2 p = (vUv - 0.5) * vec2(uAsp, 1.0) * 2.0; float a = smoothstep(uIris, uIris - 0.05, length(p)); gl_FragColor = vec4(texture2D(uTex, vUv).rgb, a); }',
    }));
    card.position.set(0, lookY, -0.9); card.renderOrder = 7; group.add(card);
    const cardBg = new THREE.Mesh(new THREE.PlaneGeometry(vw * 1.4 / 1.2, vh * 1.4 / 1.2), new THREE.ShaderMaterial({   // the same blue, much bigger than the picture, so no edge of the whirlpool or the video shows around the card
      transparent: true, depthWrite: false, uniforms: { uIris: { value: 0 }, uAsp: { value: AR } }, vertexShader: vs,
      fragmentShader: 'uniform float uIris; uniform float uAsp; varying vec2 vUv; void main(){ vec2 p = (vUv - 0.5) * vec2(uAsp, 1.0) * 2.0 * 1.4; float a = smoothstep(uIris, uIris - 0.05, length(p)); float v = clamp(0.5 + (vUv.y - 0.5) * 1.4, 0.0, 1.0); gl_FragColor = vec4(mix(vec3(0.059, 0.231, 0.722), vec3(0.165, 0.482, 1.0), v), a); }',
    }));
    cardBg.position.set(0, lookY, -0.95); cardBg.renderOrder = 6; group.add(cardBg);
    tick = (t) => {
      vortex.material.uniforms.uT.value = t < O.vortexAt ? -1 : t - O.vortexAt;
      const iris = t < O.cardAt - 0.2 ? 0 : Math.min(2.4, (t - O.cardAt + 0.2) * 6);
      card.material.uniforms.uIris.value = iris; cardBg.material.uniforms.uIris.value = iris; vortex.visible = t < O.cardAt + 0.45;
    };
    outro = { center: [0, lookY], px };
  }
  // ---- intro: the blue screen is rolled UP out of the way like a roller shutter pulled down from the top: the video appears above a rod that the characters hold while they pull it down
  const IN = cfg.episode?.intro; let intro = null;
  if (IN) {
    const dz = -0.5, f = 1, rodPx = IN.rodPx ?? 34, endPx = 1920 + rodPx + 90, smooth01 = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
    const edgePx = (t) => smooth01((t - IN.pullAt) / IN.pullDur) * endPx;                       // where the rod's lower edge is, in pixels from the top
    const yAt = (yp) => px(0, yp)[1];
    const yPlane = (y0) => eyeY + (y0 - eyeY) * f;                                               // the panel sits a little behind the characters: same place on the picture
    const bd = IN.backdrop ? await new THREE.TextureLoader().loadAsync(`${cfg.base}/${IN.backdrop}`) : null;   // a picture of a set (episode folder), shown on the screen that is rolled away
    if (bd) bd.colorSpace = THREE.NoColorSpace;
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: bd }, uHas: { value: bd ? 1 : 0 }, uCropU: { value: bd ? (1080 / 1920) / (bd.image.width / bd.image.height) : 1 }, uHalfW: { value: h * AR / 2 }, uEdge: { value: 0 }, uTop: { value: yPlane(yAt(0)) }, uBot: { value: yPlane(yAt(1920)) }, uRod: { value: (rodPx / 1920) * h * f } },
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `
        uniform sampler2D uTex; uniform float uHas; uniform float uCropU; uniform float uHalfW; uniform float uEdge; uniform float uTop; uniform float uBot; uniform float uRod; varying vec3 vW;
        void main() {
          float y = vW.y;
          if (y > uEdge + uRod) discard;
          float v = clamp((y - uBot) / (uTop - uBot), 0.0, 1.0);
          vec3 c = mix(vec3(0.059, 0.231, 0.722), vec3(0.165, 0.482, 1.0), v);
          float ar = 0.5625, x = vW.x / (uTop - uBot) / ar;
          c += 0.05 * smoothstep(0.17, 0.15, length(vec2((x + 0.32) * ar, v - 0.80))) + 0.05 * smoothstep(0.24, 0.22, length(vec2((x - 0.36) * ar, v - 0.38)));
          if (uHas > 0.5) { vec2 tuv = vec2(0.5 + (vW.x / (2.0 * uHalfW)) * uCropU, v); c = texture2D(uTex, tuv).rgb; }
          if (y > uEdge) {
            float r = (y - uEdge) / uRod;
            c = mix(vec3(0.03, 0.10, 0.26), vec3(0.45, 0.62, 0.95), smoothstep(0.55, 0.9, r) * (1.0 - smoothstep(0.9, 1.0, r)));
            c = mix(c, vec3(0.02, 0.07, 0.18), smoothstep(0.85, 1.0, r));
          } else {
            c *= 1.0 - 0.30 * smoothstep(0.55, 0.0, uEdge - y);
          }
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(vw * 1.7, vh * 1.7), mat);
    panel.position.set(0, lookY, dz); panel.renderOrder = -1; group.add(panel);
    tick2 = (t) => { mat.uniforms.uEdge.value = yPlane(yAt(edgePx(t))); panel.visible = t < IN.pullAt + IN.pullDur + 0.1; };
    intro = { worldY: yAt, rodY: (t) => yAt(edgePx(t) - rodPx * 0.5), edgePx };
  }
  return {
    group, stage, lighting, outro, intro, viewShift, orthoHeight: h,
    shots: {
      wide: shot(0, dist, 46),
      two: shot(0, dist, 46),
      left: shot(0, dist, 46),
      right: shot(0, dist, 46),
      right34: shot(0, dist, 46),
    },
    update(t) { tick(t); tick2(t); },
  };
}
