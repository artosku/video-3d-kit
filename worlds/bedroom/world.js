// The bedroom world: a night room, the characters sit on the top edge of an open laptop, a real window behind them.
// The kit's world contract: createWorld(scene, cfg) -> { group, stage, shots, lighting, update(t), screen?, phone?, outside? }   (worlds/_template/ explains each part)
import { createStudio } from './studio.js';
import { extraShots } from '../../web/lib/shots.js';

export async function createWorld(scene, cfg) {
  const w = await createStudio(scene, cfg);
  const P = w.perch, dy = P.y - 0.2, dz = P.z - 0.7;
  w.stage = { y: P.y, z: P.z, scale: 0.95, left: { x: -1.35, yaw: 0.35 }, right: { x: 1.4, yaw: -0.18 } };
  w.shots = {   // camera shots, relative to where the characters sit
    ...extraShots(w.stage),
    wide: { pos: [0.0, 1.95 + dy + 0.5, 13.6], look: [0, 1.25 + dy + 0.9, dz], fov: 46 },
    left: { pos: [-0.3, 1.7 + dy, 10.5], look: [-1.35, 1.5 + dy, 0.7 + dz], fov: 24 },
    right: { pos: [0.8, 1.7 + dy, 13], look: [1.4, 1.1 + dy, 0.7 + dz], fov: 24 },
    right34: { pos: [4.8, 1.9 + dy, 10.5], look: [1.4, 1.0 + dy, 0.7 + dz], fov: 26 },
    phone: { pos: [0.2, 1.8 + dy, 9.0], look: [0.0, P.y + 0.9, P.z + 0.2], fov: 24 },
    window: { pos: [0.0, 2.6 + dy, 11.0], look: [0, 3.2 + dy, -6], fov: 40 },   // looks past the characters to the window (for a moment outside)
  };
  return w;
}
