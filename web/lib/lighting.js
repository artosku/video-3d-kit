// The light rig every world can reuse: lights placed by angle around the lead character's face, from assets/lighting/presets.json.
// Presets can be blended in time. The director (web/episode.js) calls prepare() once, then apply() every frame.
//
//   const lighting = await createLighting(group, { base: '..', face: new THREE.Vector3(x, y, z), light: 'rembrandt' });
//   lighting.prepare(['rembrandt', 'split']);  lighting.apply('rembrandt', 'split', k, { key: 0.5 });  lighting.role('screen')  // a light by role, or null
import * as THREE from 'three';

const lerp = (a, b, k) => a + (b - a) * k;

export async function createLighting(group, { base = '..', face, light = 'rembrandt', onApply } = {}) {
  const PRESETS = (await fetch(`${base}/assets/lighting/presets.json`).then((r) => r.json())).presets;
  const hemi = new THREE.HemisphereLight('#2A3C78', '#150E18', 0.3); group.add(hemi);
  const rig = new THREE.Group(); group.add(rig);
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
    for (const r of roles.values()) {
      const sh = Object.values(r.specs).some((s) => s.shadow);
      if (sh && r.light.isSpotLight) { r.light.castShadow = true; r.light.shadow.mapSize.set(1024, 1024); r.light.shadow.bias = -0.0005; }
    }
  }
  const tmpA = new THREE.Color(), tmpB = new THREE.Color();
  // blend preset a into preset b by k (0..1); factors multiplies each role's intensity (the story's own causes: a flicker, a dimming, a change of scene)
  function apply(a, b, k, factors = {}) {
    for (const [role, r] of roles) {
      const sa = r.specs[a] ?? r.specs[b], sb = r.specs[b] ?? r.specs[a];
      if (!sa) { r.light.intensity = 0; continue; }
      const ia = r.specs[a] ? r.specs[a].i : 0, ib = r.specs[b] ? r.specs[b].i : 0;
      r.light.position.lerpVectors(place(sa), place(sb), k);
      tmpA.set(sa.color); tmpB.set(sb.color); r.light.color.copy(tmpA).lerp(tmpB, k);
      r.light.intensity = lerp(ia, ib, k) * (factors[role] ?? 1) * (factors.all ?? 1);
      if (r.light.isSpotLight && sa.angle) r.light.angle = lerp(sa.angle, sb.angle ?? sa.angle, k);
    }
    const pa = PRESETS[a], pb = PRESETS[b]; hemi.intensity = lerp(pa.hemi, pb.hemi, k) * (factors.hemi ?? 1);
    if (onApply) onApply(roles, factors);
  }
  const lighting = {
    prepare, apply, presets: PRESETS, hemi,
    role: (r) => (roles.get(r) ? roles.get(r).light : null),
    use(name) { prepare([name]); apply(name, name, 0); },
  };
  lighting.use(light);
  return lighting;
}
