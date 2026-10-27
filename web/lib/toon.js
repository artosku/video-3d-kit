// A cartoon restyle for any character, applied at render time (the character files are never changed):
//   const sync = toonify(group, { outline: '#0B4A52', px: 2.6, size: [W, H] });   // once, after the character is built
//   sync();                                                                        // every frame, before drawing (copies colours the rig changes, like a blush or a face texture)
// Lit parts become a few flat bands of light (MeshToonMaterial) and every solid part gets a thin dark edge of constant width on screen
// (an inflated back-face copy pushed outwards in clip space). Parts that already have an outline of their own (the chicken) only get the colour changed.
// outline: a colour ('#083A41'), 'auto' (every part gets a darker shade of its OWN colour: no black lines) or 'none' (no edge at all).
import * as THREE from 'three';

let gradient = null;
function bands(levels) {
  if (gradient) return gradient;
  const data = new Uint8Array(levels.map((v) => Math.round(v * 255)));
  gradient = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  gradient.minFilter = gradient.magFilter = THREE.NearestFilter; gradient.needsUpdate = true;
  return gradient;
}

export function toonify(root, { outline = '#0B4A52', px = 2.6, size = [1080, 1920], levels = [0.62, 0.82, 0.95, 1.0], skipOutline = [] } = {}) {
  const edge = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { uColor: { value: new THREE.Color(outline) }, uPx: { value: px }, uRes: { value: new THREE.Vector2(...size) } },
    vertexShader: `
      attribute vec3 aRadial;
      uniform float uPx; uniform vec2 uRes;
      void main() {
        vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * aRadial);
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
  const none = outline === 'none', auto = outline === 'auto', cache = new Map();
  const edgeFor = (c) => {   // 'auto': a darker, slightly richer shade of the part's own colour
    const hsl = {}; c.getHSL(hsl); const k = `${hsl.h.toFixed(2)}${hsl.s.toFixed(2)}${hsl.l.toFixed(2)}`;
    if (!cache.has(k)) { const m = edge.clone(); m.uniforms.uColor.value = new THREE.Color().setHSL(hsl.h, Math.min(1, hsl.s * 1.15 + 0.05), Math.max(0.12, hsl.l * 0.5)); cache.set(k, m); }
    return cache.get(k);
  };
  const pairs = [], hulls = [], seen = new Set();
  const radialGeo = (g) => {   // outward directions from the middle of the part: the corners of a box move outwards together, so the edge has no cracks
    if (g.userData.radial) return g.userData.radial;
    const c = g.clone(); c.computeBoundingBox(); const mid = new THREE.Vector3(); c.boundingBox.getCenter(mid);
    const p = c.attributes.position, r = new Float32Array(p.count * 3), v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).sub(mid).normalize(); r[i * 3] = v.x; r[i * 3 + 1] = v.y; r[i * 3 + 2] = v.z; }
    c.setAttribute('aRadial', new THREE.BufferAttribute(r, 3)); g.userData.radial = c; return c;
  };
  const meshes = []; root.traverse((o) => { if (o.isMesh) meshes.push(o); });
  for (const m of meshes) {
    if (m.userData.isHull) {
      if (none) { m.visible = false; continue; }
      const u = m.material.uniforms;
      if (auto) { const pm = m.parent.material; m.material = edgeFor(pm.color || new THREE.Color('#888888')); m.material.uniforms.uPx.value = px; continue; }
      if (u?.uColor) u.uColor.value.set(outline); if (u?.uPx) u.uPx.value = px; continue;
    }
    const old = m.material;
    if (!old || !old.isMeshStandardMaterial) continue;
    if (!seen.has(old)) {   // one toon material per original material
      seen.add(old);
      const nw = new THREE.MeshToonMaterial({ color: old.color.clone(), map: old.map || null, gradientMap: bands(levels), transparent: old.transparent, opacity: old.opacity, side: old.side });
      old.userData.toon = nw; pairs.push([old, nw]);
    }
    m.material = old.userData.toon;
    const lum = old.color.r * 0.3 + old.color.g * 0.59 + old.color.b * 0.11;
    const flat = m.geometry.type === 'CircleGeometry' || m.geometry.type === 'PlaneGeometry' || m.geometry.type === 'RingGeometry';
    const hasHull = m.children.some((c) => c.userData.isHull);
    if (!none && !flat && !hasHull && lum > 0.05 && !skipOutline.includes(m.name)) {
      const h = new THREE.Mesh(radialGeo(m.geometry), auto ? edgeFor(old.color) : edge); h.userData.isHull = true; h.name = m.name + '_toonedge'; m.add(h); hulls.push(h);
    }
  }
  return function sync() {
    for (const [old, nw] of pairs) { nw.color.copy(old.color); nw.map = old.map || null; nw.opacity = old.opacity; nw.transparent = old.transparent; nw.emissive.copy(old.emissive || new THREE.Color(0)); nw.emissiveIntensity = old.emissiveIntensity ?? 1; }
  };
}
