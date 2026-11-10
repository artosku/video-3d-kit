# KIT_CHANGELOG.md: what this copy has that the plain GitHub repo does not (read once, then use it)

## Engine (`web/episode.js`)
- **Three characters.** `episode.json` → `"characters": ["ayam","claude","ujang"]` (left, right, MIDDLE) and `"layout": { "scale": 0.8, "left": -1.95, "mid": 0, "right": 2.0 }`. Per line: `directions[i].mid` (face), `directions[i].act.mid`, `focus: "mid"`, `expressions.mid`. Without `characters` an episode uses the first two project characters as before.
- **`headroom`** (episode.json, e.g. `0.13`): raises every non-`fixed` shot so the characters sit lower and the top-of-frame captions are above their heads. Shots can carry `"fixed": true` and `"kind"`.
- **`camFx` additions:** `shake` with `"ramp": true, "amp", "amp1"` grows over its duration; `fall` (`drop`, `roll`, `dx`) drops and tips the camera and keeps it down. **`blackout`** (episode.json `{ "at": seconds, "dur": 0.05 }`): the picture cuts to black and `tools/audio.py` mutes everything from that second.
- **`layout`/`shots`** let an episode define its own seats and cameras (see ep05 for a full set: `trio`, `mid`, `mid_ecu`, `over_l`, `over_r`, ...). Screen shots used in tutorials: `screen`, `screen2`, `screen3` (fixed high shots looking down at the laptop screen).

## World (`worlds/bedroom/studio.js`)
- **Cloth banner on a building outside:** `"banner": { "style": "fabric", "image": "...albedo.png", "bump": "...bump.png", "x", "z", "height", "ambient" }`: a swaying printed cloth with ropes, grommets and two floodlamps that really light it. The albedo/bump are made from any picture with a small Pillow script (weave, hem stitches, brass grommets); see `episodes/ep02..ep06/images/`.
- **Neon sign:** multi-line text with `\n`, auto-fit, `color`, `core`, `bright`, `max`, `off1`/`off2` (ep03 "BINANCE / KENA HACK").
- **Stickman duel:** `"duel": { "x","y","z","breakAt" }`: two stickmen joined chest to chest by a chain of fire; the chain crumbles at `breakAt` (ep05).
- **Police siren:** `"siren": { "at", "power", "period" }`: red and blue lights pulse in turn over the room, window and skyline (ep06 ending, with `episodes/ep06.../audio/siren.wav` and `thud.wav` made in code).
- **New laptop screen page types** (all in `world.json` → `pageTypes`): `promptdoc` (an editor with typed lines, page counter, find box, goto-line), `clockpage`, `deploydash`, `dbdash` (tables vanish and are restored from a backup), `tutorial` (a step list with ticks + a terminal card, or a fake browser search), `filetree` (an agent working: a folder tree pops up item by item, a file is typed, tool-call lines tick), `chatterm` (a terminal chat: typed user line, a thinking spinner, a bot reply streaming letter by letter, red/blue `flash`). Each page's parameters are documented in a comment at the top of its drawing function.
- **Characters:** `characters/ujang/` = UjangGPT, a puffy cloud with a terminal-screen face (`>_` chip); voice Galang (Cartesia). Ayam has an extra face `blank` (episode-defined in ep03, listed in `character.json`).

## Scripts
- `script.json` lines may carry `"caption"`: what is shown when it differs from what is spoken ("tri di" said, "3D" shown; "eypiay kiy" said, "API key" shown; "Ujang Ji Pi Ti" said, "UjangGPT" shown). A line may also set `"level"` to be louder than the standard.
- **Locked takes** (`characters/<id>/locked/`) pin a recording to an exact text: Ayam's opening, Claude's "Beres.", Ayam's meme "Apaan tuh?" (ep06).

## Episodes included (scripts, directions, takes, extra audio, images; no MP4)
ep01 cuma lima (demo) · ep02 prompt sakti (banner of a raised hand) · ep03 deploy hari Jumat (neon sign) · ep04 cara bikin video 3D (a tutorial with a step board) · ep05 UjangGPT dan database (3 characters, fire-chain stickmen) · ep06 belajar slash command (siren ending, camera falls and goes black).
