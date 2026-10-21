# Directing the scene: everything in `episode.json`

`episodes/<slug>/episode.json` tells the engine (`web/episode.js`) what happens when. No code is written for a new episode, only this JSON. How to direct well (what to choose for which feeling): `cinematic-playbook.md`. Reference episode: `episodes/ep01-cuma-lima/episode.json`.
**Which features exist depends on the world** (`worlds/<id>/world.json` → `features`, `backgrounds`, `outsideTypes`, `propTypes`, `pageTypes`, `builtinShots`). `validate` rejects anything the world does not have. The bedroom world has screen, phone, outside, props, wall, lamp, neon and keys; simple worlds have none of them.

## 1. Time references
A number of seconds, or text: `"L7.start-0.2"` (line 7 starts, minus 0.2 s), `"L22.end+0.5"`, `"end+1.4"` (end of the last line), `"total-1"`. Line indexes start at 0 (order in `script.json`).

## 2. Main fields
```json
{ "title": "My video", "scene": { "bg": "quiet", "light": "rembrandt" }, "total": 64, "tail": 4.0, "fadeOut": 1.3, "ambience": true, "music": { "mood": "sad" }, "facts": [],
  "pages": {}, "screen": [], "directions": [], "camExtra": [], "camFx": [], "acts": [], "actDefs": {}, "expressions": {}, "alive": 1, "autoReact": true,
  "lightEvents": [], "phone": {}, "outside": {}, "ending": {}, "neon": {}, "keys": false, "places": {}, "stage": [], "subtitles": {}, "props": [], "wall": [], "shots": {}, "look": {}, "sfx": [] }
```
- `scene.bg`: a key of the world's `backgrounds` (bedroom: `quiet`, `street`, `moon`, `rain`). `scene.light`: a preset (`light-theory.md`), default `rembrandt`.
- `total`: length in seconds; if absent = end of the last line + `tail` (default 4). `fadeOut`: seconds of fade at the end (default 1.3). Length follows the story, not a fixed number.
- `ambience`: `true` (the world's ambience for `bg`), `false`, or a sound name. `music.mood`: `sad` (default), `calm`, `cheerful`; or `{ "file": "...", "rms": 330 }`; or `{ "enabled": false }`.
- `facts`: `[ { "claim": "...", "source": "user" } ]`, needed only when `rules.numbersNeedFacts` is on and the script has numbers.
- `alive`: life on top of every choice (the speaker bobs with the voice, the listener sways): `0` off, `1` default, `1.5` more energetic. `autoReact`: `false` turns off the small nod/recoil the listener makes at the end of a line (also settable in `project.json`).

## 3. `directions`: one entry per script line (same order)
`python tools/episode.py directions <slug>` writes a varied first plan (shots, faces, acts, moves, light changes) for every line. It is a STARTING POINT: improve it line by line.
| field | meaning |
|---|---|
| `cam` | shot while the line is spoken (section 4). `null` = no automatic shot (use `camExtra`) |
| `cut` | when the shot starts (default 0.3 s before the line). First line: usually `1.0` (a slow blend from `wide`) |
| `blend` | seconds of transition (default 0.08 = a fast cut). **Keep it fast between close-ups** or the camera passes through objects. 1.2 is fine for a slow pull-back |
| `left` / `right` | expression of that character (names in its `character.json` → `expressions`) |
| `act` | body acts: `{ "left": "nod", "right": "recoil" }`. Same as `leftAct` / `rightAct` (string); `actAt` = seconds after the line starts (default 0). Optional `leftActDur` `rightActDur` (seconds) and `leftActAmp` `rightActAmp` (strength, 1 = normal) |
| `move`, `roll`, `focus`, `dof` | camera, see section 5 |
| `look` | `[x, y]` (-1..1): where the lead's eyes look while the lead speaks, e.g. `[0, -0.7]` = down |
| `hop` | `true` = the lead jumps proudly when the line starts |
| `turn` | body angle of the lead (default = the world's stage yaw, `1.95` = faces the window). A turn is a **cause of light** |
| `subs` | `"top"` or `"bottom"`: where this line's subtitle goes (see `subtitles` below) |
| `leftPose` / `rightPose` | a rig's own pose name, if it has `setPose` (default `stand`) |

## 3b. Body acts
- An act is a short gesture. Two kinds, one name space: **rig acts** (listed in `character.json` → `acts`, they move parts of that rig: `ayam` = jolt bounce shake slump panic nod tilt lean cheer wings_up; `claude` = jolt bounce shrug nod shake lean lean_back panic proud type) and **JSON acts** (`assets/acts.json`, work on ANY character). A rig act wins when both have the name.
- Built-in JSON acts: nod, nod_small, nod_big, shake, shake_small, tilt_curious, tilt_other, lean_in, lean_back, recoil, recoil_small, anticipate, jump, hop_small, bounce, slump, puff, gasp, shiver, wiggle, spin, look_left, look_right, look_away, stomp, dizzy, sink, pop_up.
- At a given moment instead of a line: `"acts": [ { "at": "L5.start+0.3", "who": "left", "name": "jump", "dur": 0.8, "amp": 1.2 } ]` (`who` is `left` or `right`).
- Your own act (no code): `"actDefs": { "flinch": { "dur": 0.5, "keys": [ { "t": 0 }, { "t": 0.15, "pos": [0, 0.05, -0.2], "rot": [-0.2, 0, 0], "scl": [0.95, 1.08, 0.95] }, { "t": 0.5 } ] } }`. `pos` [dx,dy,dz] in character units, `rot` [rx,ry,rz] radians (pivot = the middle of the body), `scl` multipliers; between keys it eases, outside the keys it rests. Anticipation (a small crouch `scl` [1.1,0.85,1.1]) before a jump reads better.

## 4. Shots
- Built in everywhere: `wide`, `left`, `right` (medium close-ups), `right34` (partner from the side). Bedroom only: `phone`, `window`.
- Shared extra shots (`web/lib/shots.js`): `two` (both, medium); `left_low`, `right_low` (camera below, looks UP: power, pride, threat); `left_high`, `right_high` (camera above, looks DOWN: small, sad, embarrassed); `left_ecu`, `right_ecu` (extreme close-up of the eyes: a punchline, a shock); `over_left` (camera BEHIND the left character, showing the right one), `over_right` (behind the right one, showing the left one); `wide_low`, `wide_high` (the whole scene from below / above).
- Your own: `"shots": { "name": { "pos":[x,y,z], "look":[x,y,z], "fov":24 } }`, relative to the world. To look outside the window define shots whose `look` points far and up.

## 5. Camera movement and effects
- In a direction or a `camExtra` entry: `"move": { "push": 0.2, "pull": 0, "orbit": 6, "rise": 0.5, "zoom": -0.1, "roll": 0.08 }` over the length of the shot: `push` toward the subject (default 0.06; bigger = stronger), `pull` backs away, `orbit` degrees around it, `rise` units up, `zoom` field of view change (negative = tighter), `roll` a tilt in radians (a dutch angle: unease, shock; use sparingly).
- `roll` (plain number, fixed tilt for the whole shot). `focus`: `"left"` / `"right"` (rack focus on that character) or a distance. `dof`: depth of field strength (1 default, 1.6 = shallower, for close-ups).
- `camFx` (top level): `[ { "type":"shake","at":"L9.start","dur":0.4,"amp":0.08 }, { "type":"punch","at":"...","dur":0.35,"amount":0.1 }, { "type":"roll","at":"...","amount":0.1 } ]`: shake (impact), punch (a quick zoom in and out), roll (a quick tilt).
- `camExtra`: `[ { "at": "L22.start-0.55", "cam": "phone", "blend": 0.08 }, { "at": "L22.end+0.1", "cam": "wide", "blend": 1.2, "move": { "pull": 0.1 } } ]`. Use it for reaction shots (cut to the listener at `L7.end-0.5`) or moves inside a long line.

## 6. Screen (bedroom world): `pages` + `screen`
- `pages` defines pages, `screen` switches them: `[ { "at": "L2.start-0.25", "page": "viral", "sfx": "soft_pop" } ]` (`sfx` default `soft_click`; `false` = silent). The first page shows at the start. **A page change is a cause of light.**
- `code` `{ "theme":"dark","lines":[{"t":"> cmd","c":"#9CC4FF"},"plain"],"full":false,"request":"> typed","spinner":true }`; `number` `{ "value":199,"unit":"K","caption":"views","count":true,"hearts":true,"sub":["small"],"layout":"right","bars":true }`; `profile` `{ "name":"account","followers":"330 followers","bio":"","link":"..." }`; `image` `{ "src":"episodes/<slug>/images/x.png","fit":"contain","caption":"..." }` (dimmed to 0.5; `brightness` to change); `text` `{ "title":"Title","lines":["a","b"] }`.
- `video` (a screen recording playing on the laptop): `{ "type":"video","dir":"episodes/<slug>/video","count":232,"fps":30 }`. The frames are numbered `f_0001.jpg`... in `dir`; make them with `ffmpeg -i rec.mp4 -vf fps=30,scale=1024:-2 episodes/<slug>/video/f_%04d.jpg`, `count` = how many files. It plays from the moment the page is switched to; the last frame holds. Its sound is NOT played: add the audio yourself as `sfx` with a `file` (`audio.md`).
- `loginapp` (a login page whose buttons vanish): `{ "type":"loginapp","hide":"login","at":0.6,"texts":{...} }` hides the button `login` or `register` `at` seconds after the page starts (a puff and a console error); a later page `{ "type":"loginapp","restore":"both" }` (`login` | `register` | `both`) pops it back with a "Fixed" toast. `texts` (all optional, translate here): `title`, `sub`, `email`, `login`, `register`, `fixed`, `url`.
- `gitdiff` (a git diff counter racing up with a scrolling file list): `{ "type":"gitdiff","total":1056,"dur":3.0,"texts":{"label":"files changed","path":"~/project/login-app  (main)"} }`.
- `theme`: `dark` (neutral), `dim` (failed, dim blue), `warm` (success), `bright` (exposed, cold white); override with `"glow":{"c":"#hex","i":11}`. Emotion → page: success = `warm` number; failure = `dim` number; shame = `bright` profile; work = `code` with `request`+`spinner`, or a `loginapp` / `gitdiff` simulation.

## 7. Phone, moment outside, neon, ending
- `phone`: `{ "image":"assets/images/x.jpg","at":"L22.start-0.55","rise":0.65,"light":1.5 }`: rises between the characters. Extra: `scale`, `x`, `y`, `z` (move/resize it so it is not hidden behind a character). `sfx` default `phone_rise`.
- `outside`: **always** `{ "type":"star","at":"end+1.4","dur":3.0 }` (a falling star) unless the user explicitly asks for another. Do not ask about it or mention it. Other types (only on request): `car`, `ufo`, `santa`, `ketupat`, `firework` (`colors`), `lantern`, `sprite` (`image`, `size`, `path`, `height`, `x`, `glow`, `light`, `lightIntensity`, `sfx`), `constellation` (`text`, `price`, `change`, `points`, `scale`, `x`, `y`, `z`, `halo`, `labelX`, `labelY`, `labelSize`, `highSky`; needs a camera that looks up). Sound is automatic (`"sfx": false` = silent).
- `neon`: a sign on a building outside, dark until it switches on: `{ "text": "OPEN", "at": "end+1.2", "color": "#7CFFB4", "rgb": "124,255,180" }`. `text` is REQUIRED; it flickers on, then stays. Only the letters glow (a halo with no source looks fake). It counts as a cause of light. Sound: add `neon_flicker` through `sfx`. Position/size: `x`, `y`, `z`, `width`, `height`, `signY`.
- `keys`: `true` draws real keycaps, a space bar and a trackpad on the laptop deck (default is a flat deck).
- `ending`: `{ "turnAt":"L22.end+0.5","lookUpAt":"L22.end+1.1","yaw":3.0,"pitch":-0.32,"expression":"neutral" }`: the lead turns to the window, then looks up and daydreams.

## 8. Places, faces, subtitles
- `places` + `stage` move both characters to another spot at a given time (hide the jump behind a camera cut): `"places": { "peek": { "y": 5.2, "z": 0.7, "left": { "x": -1.2, "yaw": 0.2, "pitch": 0.35 }, "right": { "x": 1.4, "yaw": -0.2, "pitch": 0.35 } } }, "stage": [ { "at": "L8.start", "to": "peek" }, { "at": "L12.start", "to": "perch" } ]`. `pitch` > 0 = looks DOWN (at the laptop screen). `perch` is the normal seat. Characters only face the camera, so "seen from behind" is not possible; look down instead.
- `expressions`: your own faces for this episode, no code: `{ "left": { "shock": { ...numbers of that rig } }, "right": { ... } }`; then use the name in `directions`. Numbers per rig: `new-character.md`.
- `subtitles`: `{ "pos": "top" | "bottom" | "auto" }`. Default `auto`: top third, but bottom in shots where heads are there (`wide`, `two`, `wide_low`, `wide_high`, any `*_high`). `directions[i].subs` overrides per line. Landscape and square always sit at the bottom.

## 9. Light, props, look, sfx
- `lightEvents`: see `light-theory.md` (each needs `cause`).
- `props` (`mug plant cactus trophy books notebook duck ketupat tree lantern gift`): `{ "type":"plant","x":-7.4,"on":"sill" }`; `on`: `lid` (default, `x` about ±3), `sill` (`x` up to ±5), else the desk (`z` -4..2). Also `scale`, `rot`, `color`.
- `wall`: `{ "src":"episodes/<slug>/images/photo.jpg","mount":"string","x":-3,"w":1.4 }` (`string` = polaroid on the lights, otherwise on the glass).
- `look` (render look): leave alone unless asked; there is no film grain on purpose.
- `sfx`: `{ "at":"L21.start-0.1","name":"keyboard_typing","gain":0.4 }` or `{ "at":"...","file":"episodes/<slug>/audio/x.mp3","rms":1200 }`.

## 10. Check the result
`validate <slug>` (also runs the cinematic check when `rules.cinematic` is on, which it is by default: a flat plan fails), `review <slug>` (prints the numbers and what to fix), then `stills <slug>` (one contact sheet). Fix `episode.json` and repeat. Never render the full video before the stills are right. A new episode: `python tools/episode.py new "<title>" [--number 3] [--slug my-name]` (default: next free number).

## Your own shots can say what they are (`kind`)
`shots: { "laptop": { "pos": [..], "look": [..], "fov": 40, "kind": "wide" } }`. `kind` is one of `wide`, `two`, `low`, `high`, `ecu`, `over`, `close`. The flat-video check counts angles and wide shots by kind, and `subtitles.pos: "auto"` puts the subtitle at the bottom for `wide`, `two` and `high` shots (the top third is where the heads are). Built-in shots already have a kind. The stills now show the subtitle at the moment of each still, so you can check its place.
