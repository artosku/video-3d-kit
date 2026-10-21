// Camera shots every world can share, framed relative to where the two characters stand (stage: y of the seat, z of the seat).
// Names: left / right = medium close-up of that character; *_low looks UP at them (power, pride, threat); *_high looks DOWN (small, sad, embarrassed);
// *_ecu = extreme close-up (the eyes, a punchline, a shock); over_left / over_right = over-the-shoulder: the camera stands behind that character and shows the OTHER one (use it for a dialogue exchange);
// two = both in one medium shot; wide_low / wide_high = the whole scene from below / above.
// A world may add or replace any of them; an episode may add its own in episode.json "shots".
export function extraShots(stage) {
  const dy = stage.y - 0.2, dz = stage.z - 0.7;
  return {
    two: { pos: [0.0, 1.75 + dy, 11.6], look: [0.0, 1.3 + dy, 0.4 + dz], fov: 33 },
    left_low: { pos: [-0.3, 0.55 + dy, 9.2], look: [-1.35, 1.85 + dy, 0.7 + dz], fov: 27 },
    right_low: { pos: [0.8, 0.5 + dy, 11.2], look: [1.4, 1.5 + dy, 0.7 + dz], fov: 26 },
    left_high: { pos: [-0.3, 3.7 + dy, 9.6], look: [-1.35, 1.2 + dy, 0.7 + dz], fov: 27 },
    right_high: { pos: [0.8, 3.5 + dy, 11.6], look: [1.4, 1.0 + dy, 0.7 + dz], fov: 26 },
    left_ecu: { pos: [-1.0, 1.3 + dy, 7.6], look: [-1.35, 1.2 + dy, 0.7 + dz], fov: 17 },
    right_ecu: { pos: [1.15, 1.72 + dy, 9.6], look: [1.4, 1.62 + dy, 0.7 + dz], fov: 23 },
    over_left: { pos: [-3.1, 2.15 + dy, 8.6], look: [1.4, 1.3 + dy, 0.7 + dz], fov: 28 },
    over_right: { pos: [3.7, 2.2 + dy, 9.2], look: [-1.35, 1.35 + dy, 0.7 + dz], fov: 28 },
    wide_low: { pos: [0.0, 0.6 + dy, 13.2], look: [0, 1.9 + dy, dz], fov: 48 },
    wide_high: { pos: [0.0, 5.2 + dy, 12.4], look: [0, 0.9 + dy, dz], fov: 46 },
  };
}
