# Directing the scene: everything in `episode.json`

`episodes/<slug>/episode.json` tells the engine (`web/episode.js`) what happens when. No code is written for a new episode, only this JSON. Reference episode: `episodes/ep01-cuma-lima/episode.json`.
**Which features exist depends on the world** (`worlds/<id>/world.json` → `features`, `backgrounds`, `outsideTypes`, `propTypes`, `pageTypes`, `builtinShots`). `validate` rejects anything the world does not have. The bedroom world has screen, phone, outside, props, wall and lamp; simple worlds have none of them.

## 1. Time references
A number of seconds, or text: `"L7.start-0.2"` (line 7 starts, minus 0.2 s), `"L22.end+0.5"`, `"end+1.4"` (end of the last line), `"total-1"`. Line indexes start at 0 (order in `script.json`).

## 2. Main fields
```json
{ "title": "My video", "scene": { "bg": "quiet", "light": "rembrandt" }, "total": 64, "tail": 4.0, "fadeOut": 1.3,
  "ambience": true, "music": { "mood": "sad" }, "facts": [], "pages": {}, "screen": [], "directions": [], "camExtra": [],
  "lightEvents": [], "phone": {}, "outside": {}, "ending": {}, "props": [], "wall": [], "shots": {}, "look": {}, "sfx": [] }
```
- `scene.bg`: a key of the world's `backgrounds` (bedroom: `quiet`, `street`, `moon`, `rain`). `scene.light`: a preset (`light-theory.md`), default `rembrandt`.
- `total`: video length in seconds; if absent = end of the last line + `tail` (default 4). `fadeOut`: seconds of fade at the end (default 1.3).
- `ambience`: `true` (the world's ambience for `bg`), `false`, or a sound name from the library.
- `music.mood`: `sad` (default), `calm`, `cheerful`; or `{ "file": "episodes/<slug>/audio/song.mp3", "rms": 330 }`; or `{ "enabled": false }`.
- `facts`: `[ { "claim": "...", "source": "user" } ]`. Required only when `project.json` → `rules.numbersNeedFacts` is on and the script has numbers.

## 3. `directions`: one entry per script line (same order)
`python tools/episode.py directions <slug>` fills defaults (camera follows the speaker). Then edit by judgement:
| field | meaning |
|---|---|
| `cam` | shot while the line is spoken: `wide`, `left` (close-up of the lead), `right`, `right34` (partner from the side), plus world shots (bedroom: `phone`, `window`) or your own in `shots`. `null` = no automatic shot (use `camExtra`) |
| `cut` | when the shot starts (default 0.3 s before the line). First line: usually `1.0` (an automatic slow blend from `wide`) |
| `blend` | seconds of transition (default 0.08 = a fast cut). **Keep it fast between close-ups** or the camera passes through objects. 1.2 is fine for a slow pull-back at the end |
| `left` / `right` | expression of that character (names from its `character.json` → `expressions`) |
| `look` | `[x, y]` (-1..1): where the lead's eyes look while the lead speaks, e.g. `[0, -0.7]` = down. When not speaking the lead looks at the speaker |
| `hop` | `true` = the lead jumps proudly when the line starts |
| `turn` | body angle of the lead (default = the world's stage yaw, `1.95` = faces the window). A turn is a **cause of light** |
Mix the shots: not five close-ups in a row; use `wide` in the middle and `right34` on sarcastic lines.

## 4. `camExtra`: extra camera segments
`[ { "at": "L22.start-0.55", "cam": "phone", "blend": 0.08 }, { "at": "L22.end+0.1", "cam": "wide", "blend": 1.2 } ]`. Use with `cam: null` or to add moves inside a long line.

## 5. Screen (bedroom world): `pages` + `screen`
- `pages` defines pages, `screen` switches them: `[ { "at": "L2.start-0.25", "page": "viral", "sfx": "soft_pop" } ]` (`sfx` optional; default `soft_click`; `false` = silent). The first page of `pages` shows at the start. **A page change is a cause of light** and plays a click.
- Page types and fields: `code` `{ "theme":"dark","lines":[{"t":"> cmd","c":"#9CC4FF"},"plain line"],"full":false,"request":"> typed text","spinner":true }`; `number` `{ "value":199,"unit":"K","caption":"views","count":true,"hearts":true,"sub":["small text"],"layout":"right","bars":true }`; `profile` `{ "name":"account","followers":"330 followers","bio":"","link":"link: (empty)" }`; `image` `{ "src":"episodes/<slug>/images/x.png","fit":"contain","caption":"..." }` (auto-dimmed to brightness 0.5, set `brightness` for dark images); `text` `{ "title":"Title","lines":["a","b"] }`.
- `theme`: `dark` (neutral), `dim` (empty/failed, dim blue), `warm` (success), `bright` (exposed, cold white). Each tints the light on the characters; override with `"glow":{"c":"#hex","i":11}` and `"brightness":0.5`.
- Emotion → page: success = `warm` number with `count`; failure = `dim` number, small value; exposure/shame = `bright` profile; work = `code` with `request`+`spinner`.

## 6. Phone, moment outside, ending (bedroom world)
- `phone`: `{ "image":"assets/images/x.jpg","at":"L22.start-0.55","rise":0.65,"light":1.5 }`: a phone rises between the characters showing the image and lighting the partner. The image must be a screenshot the user provides. `sfx` default `phone_rise`.
- `outside`: **always** `{ "type":"star","at":"end+1.4","dur":3.0 }` (a falling star) unless the user explicitly asks for another. Do not ask about it or mention it. Placed right after the lead looks up. Types (only for an explicit request):
  | type | what | extra fields |
  |---|---|---|
  | `star` | falling star (default) | |
  | `car` | small rocket sports car, no logo | |
  | `ufo` | small saucer | |
  | `santa` | sleigh silhouette | |
  | `ketupat` | ketupat-shaped shooting star | |
  | `firework` | 3 bursts | `colors: ["#hex",..]` |
  | `lantern` | rising sky lanterns | |
  | `sprite` | any transparent PNG | `image`, `size`, `path` (`cross`, `cross_back`, `rise`, `fall`, `drift`), `height`, `x`, `glow` "r,g,b", `light`, `lightIntensity`, `sfx` |
  | `constellation` | stars joining into a line with a label | `text`, `price`, `change`, `points`, `scale`, `x`, `y`, `z`, `halo`, `labelX`, `labelY`, `labelSize`, `highSky` (needs a camera that looks up: see `shots`) |
  Optional: `label`, `confirmed` (needed only if `rules.confirmOutside`), `repeatOk` (only if `rules.noRepeatOutside`). Sound is automatic (`outsideSfx` in `world.json`); `"sfx": false` = silent.
- `ending`: `{ "turnAt":"L22.end+0.5","lookUpAt":"L22.end+1.1","yaw":3.0,"pitch":-0.32,"expression":"neutral" }`: the lead turns to the window, then looks up and daydreams. The standard closing of every video.

## 7. `lightEvents` (each needs `cause`)
See `light-theory.md`. Example: `{ "type":"flicker","at":"L7.start-0.2","dur":1.7,"floor":0.12,"amp":0.55,"to":0.42,"recover":9,"cause":"the lamp bulb flickers when the lead says the painful word" }`.

## 8. `props`, `wall`, `shots`, `look`, `sfx`
- `props` (types from `propTypes`: `mug plant cactus trophy books notebook duck ketupat tree lantern gift`): `{ "type":"plant","x":-7.4,"on":"sill" }`. `on`: `lid` (default, the top corner of the laptop, `x` about ±3), `sill` (window sill, `x` up to ±5), anything else = the desk (`z` -4..2). Also `scale`, `rot`, `color`.
- `wall`: pictures hung at the window: `{ "src":"episodes/<slug>/images/photo.jpg","mount":"string","x":-3,"w":1.4 }` (`mount`: `string` = polaroid on the lights, otherwise on the glass; also `y`, `h`, `rot`, `frame:false`).
- `shots`: your own camera shots `{ "name": { "pos":[x,y,z], "look":[x,y,z], "fov":24 } }`, coordinates relative to the world. To look outside the window (e.g. for a constellation) define shots whose `look` points far and up.
- `look` (render look): `{ "exposure":1.25,"vignette":0.42,"vignetteStart":0.3,"vignetteEnd":0.85,"topShade":0.3,"bloom":[0.4,0.7,0.92],"aperture":0.0016,"maxblur":0.022 }`. Leave it alone unless the user asks. There is no film grain on purpose.
- `sfx`: extra sounds `{ "at":"L21.start-0.1","name":"keyboard_typing","gain":1.0 }` or `{ "at":"...","file":"episodes/<slug>/audio/x.mp3","rms":1200 }`. Automatic sounds already exist for lamp flicker, phone, moment outside and page change.

## 9. Check the result
`python tools/episode.py validate <slug>`, then `stills <slug>` (one contact sheet), then fix `episode.json` and repeat. `stills <slug> --at 12.5,33` for chosen moments. Never render the full video before the stills are right.
