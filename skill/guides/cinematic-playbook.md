# Cinematic playbook: the standard every video must meet

A flat video = the same two close-ups cutting left and right, faces that never change, nobody moving, one light all video. That is a failure, even when the script is good. Follow this playbook EVERY time. Do not skip steps; `validate` fails a flat plan.

Where the ideas come from (honest note): established film grammar and character-animation practice, not a fresh web search. Film grammar: cover a dialogue from several angles (wide, medium, close-up, over-the-shoulder), shot/reverse shot, low angle = power, high angle = weak or small, extreme close-up for peak emotion, push in on feeling, tilt (dutch angle) for unease, rack focus. Animation: the 12 principles, mainly anticipation, squash and stretch, follow-through, secondary action, timing, exaggeration, staging, appeal.

## The director pass (mandatory, in this order)
1. **Beats.** For EVERY line write one note: the feeling, who the camera should favour, what the listener feels. (Keep it in your head or in the work notes; do not show the user.)
2. **First plan.** `python tools/episode.py directions <slug>`. It fills `episode.json` with a varied plan (shots, faces, acts, camera moves, light changes). It is a starting point. NEVER ship it unchanged.
3. **Line by line.** For each line decide: shot and angle, the face of BOTH characters (the listener reacts too), a body act on at least the key beats, a camera move, the light. Use the recipe table below. Fields: `skill/guides/direction.md`; light: `skill/guides/light-theory.md`.
4. **Screen and sound beats.** If the story has a computer or a phone, give the screen something to do (simulation, see "Beyond the assets") and add thin sound effects on what is visible.
5. **Check.** `python tools/episode.py review <slug>` must print `cinematic check: OK`, then `python tools/episode.py validate <slug>` must pass.
6. **Look.** `python tools/episode.py stills <slug>`, open `out/<slug>/stills/contact.png` (one picture) and go through the visual checklist at the end. Fix `episode.json`, repeat.
7. **Only then** render (`video`). Never render the full video before steps 5 and 6 are clean.

## Recipes per beat (starting points, change them to fit the scene)
Shots: `left`/`right` close-up, `*_low` looks up, `*_high` looks down, `*_ecu` extreme close-up, `over_left`/`over_right` over-the-shoulder (the camera stands behind that character and shows the OTHER one), `two`, `wide`, `wide_low`, `wide_high`, `right34`, `phone`, `window`. Camera: `move` `{ "push": 0.2 }` (slowly closer), `{ "orbit": 6 }` (degrees), `{ "rise": 0.5 }`, `{ "zoom": -0.1 }`, `roll` (radians, a tilt), `focus` `"left"|"right"` (rack focus), `dof` > 1 (shallower).

| beat | shot / angle | faces (ayam / claude) | act (speaker / listener) | camera | light and sound |
|---|---|---|---|---|---|
| confident but wrong | `right_low` or `over_left` | claude `smug` / ayam `determined` | `lean` / `nod_small` | `push` 0.08 | steady key light |
| fake praise ("You are right!") | `right` then cut to the listener | claude `fakewow` / ayam `delighted` or `neutral` | `proud` (claude) / `recoil_small` | `push` 0.1 | soft pop on the screen |
| fear, "oh no" | `left_ecu` or `wide_high` | ayam `dread` or `panic` / claude `worried` or `guilty` | `jolt` or `shiver` / `lean_back` | `roll` 0.1, camFx `punch` | flicker the lamp |
| despair, giving up | `left_high` | ayam `tired` or `dread` / claude `worried` | `slump` / `lean_in` | slow `push` 0.2 | `level` key to 0.5 with a visible cause (the lead turns away) |
| pleading | `left_high` or `left` | ayam `pleading` / claude `deadeye` | `tilt_curious` / `recoil_small` | `push` 0.14 | warm, close |
| shock | `left_ecu` or `wide_low` | ayam `shocked` / claude `smug` | `jolt` / `recoil` | camFx `punch` 0.1, maybe `roll` | a sharp sound (`soft_pop`) |
| pride, joy | `left_low` | ayam `delighted` or `laugh` / claude `proud` | `cheer` or `wings_up` / `nod` | `rise` | `warm` preset, `sparkle` |
| punchline (after a long pause) | `*_ecu` of who delivers it, `dof` 1.6, `focus` that character | embarrassed `sheepish`, listener `smug` | `slump` / `lean_in` | `push` 0.2 | the lamp flickers on the line before |
| relief | `two` | both soften (`happy` / `deadpan`) | `bounce` / `nod` | `orbit` 6 | light comes back to 1 |
| sarcasm | `right34` or `over_left` | claude `skeptical` or `deadeye` | `tilt_other` / `shake_small` | `push` 0.06 | none |
| working, typing | `wide` of the laptop screen, both look down | claude `deadpan`, ayam `neutral` | claude `type` / ayam `lean` | `orbit` | screen simulation + `keyboard_typing` (gain 0.4) |
| the reveal | `wide_low` or `window` | both `surprised` / `wow` | `gasp` / `gasp` | slow `push` | light change with a cause, `bell` or `sparkle` |

## Pacing rules
- Never more than 2 identical shots in a row. Change the angle, cut to the listener, or move the camera.
- Long lines (8+ words): cut to the listener's face near the end with `camExtra` `{ "at": "L<k>.end-0.55", "cam": "<listener>", "blend": 0.08 }`.
- A wide or two-shot about every 6 lines, so the viewer sees the place again.
- Tight shots (`*_ecu`, close-ups) for short lines and punchlines; wider for exchanges.
- Silence is allowed: no dialogue while a screen simulation plays, only soft sounds and music.
- Length follows the story. Do not pad or cut to hit a number.

## Going BEYOND the shipped assets (you are expected to improve per scene)
The shipped faces, acts and shots are a palette, not a limit. When a scene needs more, make it:
- **New face, no code:** `characters/<id>/character.json` → `expressionParams: { "name": { ...numbers of that rig... } }` and add `"name"` to its `expressions`. Or only for one episode: `episode.json` → `expressions: { "left": { "name": {...} }, "right": { ... } }` (still list the name in `character.json` `expressions`, validate checks it). Rig numbers: ayam `lidLow lidTop browY browTilt mouth beak cheek eyeS pupil lookX lookY` (see `EXPRESSIONS` in `characters/ayam/rig.js`); claude `eyeH eyeW eyeAsym eyeGap tilt lean arm squash` (eye width and height, one eye taller for a raised brow).
- **New gesture, as JSON:** `episode.json` → `actDefs: { "name": { "dur": 0.8, "keys": [ { "t": 0 }, { "t": 0.3, "pos": [0, 0.2, 0], "rot": [0.1, 0, 0], "scl": [1, 1.1, 1] }, { "t": 0.8 } ] } }`; use it in `directions[i].act` (`{ "left": "name" }`), `leftAct`/`rightAct`, or the timeline `acts: [ { "at": "L5.start+0.3", "who": "left", "name": "name", "dur": 0.8, "amp": 1.2 } ]`. A character's own acts (wings, arms) win over the library: ayam `jolt bounce shake slump panic nod tilt lean cheer wings_up`, claude `jolt bounce shrug nod shake lean lean_back panic proud type`. Library: `assets/acts.json` (nod, recoil, jump, slump, puff, gasp, shiver, wiggle, spin, look_away, ...).
- **New shot:** `episode.json` → `shots: { "name": { "pos": [x,y,z], "look": [x,y,z], "fov": 24 } }`, then use `"cam": "name"`.
- **Characters change place or look down at the laptop:** `places: { "peek": { "y": .., "z": .., "left": { "x": .., "yaw": .., "pitch": 0.35 }, "right": { ... } } }` and `stage: [ { "at": "L4.start", "to": "peek" }, { "at": "L9.start", "to": "perch" } ]` (hide the jump behind a camera cut).
- **Screen simulations (bedroom world, `pages` + `screen`):** types `code`, `number`, `profile`, `image`, `text`, `video` (a screen recording: numbered frames `{ "type": "video", "dir": "episodes/<slug>/video", "count": 232, "fps": 30 }` named `f_0001.jpg`, made with ffmpeg), `loginapp` (`hide` a button at `at` seconds, `restore` it, all words in `texts`), `gitdiff` (`total` files racing up, `texts`). Make the screen show the story (a login page whose buttons vanish, a diff counting up), not a chat window.
- **More world:** `neon: { "text": "OPEN", "at": "end+1.2" }` (a sign that flickers on; only the letters glow), `keys: true` (real keycaps), `alive` (0-2, energy of the idle life), `autoReact` (listener nods, default on).
- **Something missing in a rig** (a wing, a tail, a new body part): you may edit that character's `rig.js`, then re-run `stills` and look. Never leave a character half-broken.
- **Sound, thin:** `sfx: [ { "at": "L7.start", "name": "keyboard_typing", "gain": 0.4 } ]`; every sound belongs to something visible. Pick a line's voice with `python tools/episode.py variants <slug> <line>` and pin it with `lock`.

## What flat looks like, and the fix
| mistake seen in a real run | fix |
|---|---|
| left the `directions` defaults (camera follows the speaker, faces always neutral/deadpan) | do the director pass; `review` fails this |
| one light preset all video, no `lightEvents` | add at least 2, each with a visible cause (a screen change, a lamp flicker, a character turning); prefer `level` events |
| the same close-up cutting between the two speakers | alternate angles; use `over_*`, `*_low`, `*_high`, a reaction cut |
| characters always facing the camera, nobody reacts | `turn`, `look`, `places` with `pitch`; give the listener an act |
| subtitles cover the heads in wide or high shots | `subtitles: { "pos": "auto" }` (default: bottom in wide/two/high shots) or `directions[i].subs: "bottom"` |
| `screen` light preset puts a big glow in front of the lens | the lamp is now hidden when the key light is in front; still prefer `level` events |
| light with no visible source (a round glow around the neon) | only the letters glow; no halo sprite |

## Visual checklist (look at `out/<slug>/stills/contact.png`)
- [ ] Many different angles; no run of the same shot.
- [ ] Faces change from line to line, for both characters.
- [ ] Nobody stands still: tilts, leans, hops are visible in the stills.
- [ ] Nothing cut off in a bad way (a head half out of frame, an extreme close-up on nothing).
- [ ] Subtitles readable and not over a face.
- [ ] Every light change has a cause you can see in the picture.
- [ ] No noise or speckle, no shiny characters.
