# Making a new world (the place where the two characters sit)

Two paths. Default to EASY. Tell the user once, before ADVANCED: "A fully custom place takes longer and uses more tokens."

## Words to the user
- Say "place" or "setting". Never "scene graph", "shader", "contract".
- Offer: keep the bedroom, or make a new place. The bedroom has a laptop screen, a phone and a window; a new simple place has none of those.

## EASY path (minutes, few tokens)
1. Ask 2 things in ONE message (with defaults):
   - Where is it? (forest, beach, rooftop, space...) The EASY template is a night outdoor spot: a log to sit on, trees, rocks, bushes, stars.
   - Time and colors? (night, dusk, dawn, moon yes/no)
2. Create it:
   `python tools/setup.py new-world <id> --name "Quiet forest" --sky-top #0A1238 --sky-bottom #4A5C9C --ground #2E4A3A --trees 14 --moon yes`
   - Copies `worlds/_template/` to `worlds/<id>/`. Edit `worlds/<id>/world.json` -> `look` for more: `fog`, `fogDensity`, `treeColor`, `bushes`, `rocks`, `stars`, `sun {color,size,x,y}`, `seatColor`.
3. Use it: `python tools/setup.py init ... --world <id>` (same other values), or set `world` in `project.json`.
4. Look at it:
   `python tools/setup.py preview-world <id>`  (one picture: wide, left and right34 shots, saved in `out/previews/`; add `--chars <a>,<b>` to pick the cast).
   Show that picture. Adjust and repeat until the user says yes.

## What a simple world can and cannot do
- It has: sky, ground, seat, props, light presets, camera shots.
- It does NOT have (unless you build them): a laptop `screen` with pages, a `phone`, a moment `outside` a window. With the template, `episode.json` must not use `pages`, `screen`, `phone`, `outside` (the validator says "this world has no ...").
- Light changes in a simple world need a written `cause` only (`lightCauseCheck: "text"`), not a visible one.

## ADVANCED path (slower, more tokens)
Copy `worlds/_template/` and edit `world.js` for a different place. The contract:
```
export async function createWorld(scene, cfg) -> {
  group,              // a THREE.Group already added to the scene
  stage,              // { y, z, scale, left: {x, yaw}, right: {x, yaw} }  where the two characters stand (y = top of the seat)
  shots,              // { wide, left, right, right34, ... }  camera shots { pos:[x,y,z], look:[x,y,z], fov }
  lighting,           // await createLighting(group, { base: cfg.base, face, light: cfg.light })  from web/lib/lighting.js
  update(t),          // every frame: wind, clouds, anything that moves (use t, never real time)
  screen?, phone?, outside?   // only if world.json features say so (copy worlds/bedroom/ to see them)
}
// cfg: { base, bg, light, pages, phone, wall, props, outside, episode }
```
- `face` for the light rig = a point at the lead character's face: `(stage.left.x, stage.y + 1.05, stage.z)`.
- Light presets live in `assets/lighting/presets.json` (shared by every world). Roles: `key`, `rim`, `fill`, `hemi` (the bedroom also has `screen`).
- Every frame must be identical on every run: use a seeded random (see `rng` in `worlds/_template/world.js`), never `Math.random`, and drive motion from `t`.
- `base` is the folder prefix for loading files (`${cfg.base}/path`). Load your own `world.json` with `new URL('./world.json', import.meta.url)`.
- Shots are framed for PORTRAIT. The kit narrows the lens for landscape (x0.55) and square (x0.82) by itself; do not add format code. Keep scenery beyond the camera edges so wide shots do not show the end of the world.
- Characters stand about 1.9 units tall. Keep the camera 10-14 units away for `wide`, 10-13 for close-ups with `fov` ~24.

## `world.json` fields
- `id`, `name`, `description`: shown by `python tools/episode.py characters`.
- `features`: `{screen, phone, outside, props, wall, lamp}` booleans. Absent = false. The validator rejects things the world lacks.
- `backgrounds`: `{name: description}` choices for `scene.bg` (empty = none). `defaultBackground` is used when an episode names none.
- `outsideTypes`: moments allowed in `outside.type`. `outsideSfx`: `{type: soundName}`.
- `propTypes`, `pageTypes`, `themes`: allowed values for `props[].type`, `pages[].type`, `pages[].theme`.
- `lightRoles`: roles a `lightEvents[].role` may name.
- `builtinShots`: shot names an episode may use (`wide`, `left`, `right`, `right34`, plus yours).
- `ambience`: `{background: soundName}` looped under the dialogue (names from `assets/sfx/library.json`). `{}` = none.
- `roomTone`: `true` adds a soft room hum (bedroom only by default).
- `lightCauseCheck`: `"strict"` = every light change must sit near something visible (a screen change, lamp flicker, phone, outside moment, a character turning). `"text"` = only the written `cause` is required.
- `look`: free numbers for your own `world.js` (the template reads colors and counts here).

## Testing
- Stills as above. Check: nothing floats, no black holes at the sides in `wide`, characters not buried in the seat, light on faces not too dark.
- Format check: set `format` to `landscape` in a temporary `project.json` and shoot `cam=wide` once; remove the temporary change after.
- Full check: a 2-line episode, `build`, `stills` (see `build-qa-deliver.md`).

## Common mistakes
- Characters sink or float: `stage.y` must be the TOP of the seat.
- Too dark: lights aim at `face`; if the seat is far from the origin, move `face` with it.
- Flicker between runs: unseeded random or real-time clock.
- Scenery in front of the camera: keep trees and rocks behind `stage.z`.
