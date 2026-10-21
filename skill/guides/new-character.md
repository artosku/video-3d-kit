# Making a new character

Two paths. Default to EASY. Tell the user once, before ADVANCED: "A fully custom character takes longer and uses more tokens."

## Words to the user
- Plain words only. Say "character", "face", "voice". Never "rig", "shader", "TTS", "JSON".
- Bullets, short. One question batch, not a quiz.

## EASY path (minutes, few tokens)
1. Ask 3 things in ONE message (offer defaults):
   - What is it? (animal, robot, blob, person-like...) -> picks `ears` (`none|round|pointy`), `tail`, `width`, `height`
   - Colors? (body, belly, accent) -> three hex colors
   - How does it talk? (shy, bold, grumpy, sweet...) -> goes into `--role`, and guides the script and tones later
2. Create it:
   `python tools/setup.py new-character <id> --name "Mochi" --role "Shy, sweet, apologises a lot" --body-color #F2C9A0 --belly-color #FFE9CF --accent-color #E8645A --ears round --tail yes --width 0.85 --height 0.85`
   - `<id>` = short lowercase word, no spaces. It becomes `characters/<id>/` (copied from `characters/_template/`).
   - Edit `characters/<id>/character.json` -> `look` for anything else (`eyeColor`, `cheeks`).
3. Pick a voice (needs the provider key in `.env`, see `formats-and-voices.md`):
   - `python tools/episode.py voices --provider <cartesia|elevenlabs> --language <code>`
   - Suggest 3 by gender and description (e.g. "calm male", "bright female"). Ask which one.
   - `python tools/setup.py set-voice <id> <provider> <voice-id> --name "<voice name>"`
   - The voice id is stored PER PROVIDER (`voice.cartesia.id`, `voice.elevenlabs.id`). If the project later switches provider, set the voice again for that provider. A line cannot be built without it.
4. Put it in the project: `python tools/setup.py init ... --characters <idLeft>,<idRight> ...` (re-run `init` with the same other values), or edit `characters` in `project.json`.
   - The LEFT character is the lead: it hops, turns and daydreams at the end. Put the main character first.
5. Look at it: `python tools/setup.py preview-character <id>` (one picture of all the faces, saved in `out/previews/`; add `--with <other-id>` to pick the partner).
   - Show that picture. Ask "Happy with it?". Change colors/shape in `character.json` and repeat until yes.

## Adding or renaming expressions
- Template expressions are defined at the top of `characters/<id>/rig.js` (`EXPRESSIONS`). Each is numbers: `lid` (eye closes 0..1), `brow` (raise), `tilt` (+ sad, - angry), `mouth` (open), `wide`, `eye` (size).
- Add one there, then add its name to `expressions` in `character.json`. The validator only accepts names listed there.
- `defaultExpression` is what the character wears when nothing is directed.

## ADVANCED path (slower, more tokens)
Use only if the user wants a shape the template cannot make (a robot, a cat with whiskers, a person). Either:
- Edit `characters/<id>/rig.js` (start from the template, keep the contract), or
- Import a glTF/GLB made elsewhere and wrap it in the same contract.

The contract every `rig.js` exports (the kit calls it, nothing else):
```
export function create(renderer, { rand, W, H, config }) -> {
  group,                        // THREE.Group, origin at the FEET, about 1.9 units tall
  setExpression(name, speed),   // speed >= 100 means "snap now"
  setTalkLevel(v),              // 0..1, mouth openness, set every frame from the voice
  look(x, y),                   // -1..1, where the eyes look
  update(dt),                   // every frame: blink, breathing
  freeze?()                     // optional: stop random motion (stills)
}
```
- `config` is the whole `character.json`; read `config.look` for your own settings.
- Keep every material matte (`roughness` ~0.9). Shiny looks cheap in this light.
- No film grain, no random flicker: frames must be identical on every run. Use the `rand` you are given, never `Math.random`.
- Optional: `renderer`, `W`, `H` are there for outline passes; most rigs ignore them.
- Depth of field blurs anything not at the focus distance, so thin outlines and tiny details can look soft. Prefer big shapes.
- The world scales the group (about 0.95), so keep the size near 1.9 units.

## Testing a character
- Faces: the sheet above. Check every expression reads (sad does not look angry), the mouth closes at `setTalkLevel(0)`, the eyes close fully when sleepy.
- In a scene: `python tools/browser.py shot t.png "chars=<id>,<other>&cam=wide&t=3" 405,720` then look at `out/shots/t.png`. Also try `cam=left` and `cam=right34`.
- Full check: write a 2-line episode, `build`, `stills` (see `build-qa-deliver.md`).

## Common mistakes
- Shiny or white-hot body: use matte materials, lower `emissive`.
- Wrong size: too big fills the screen and hides the other character; too small is lost. Aim ~1.9 units, feet at y = 0.
- Mouth never closes: `setTalkLevel(0)` must return it to the closed shape, and expressions must not keep it open.
- Direction reversed: brows or eyes tilted the wrong way show as the wrong feeling. Test `sad` and `angry` side by side.
- Voice missing for the active provider: `dialog.py` stops with "has no <provider> voice yet". Run `set-voice`.
- Expression typo: the validator lists the allowed names. Use them exactly.
