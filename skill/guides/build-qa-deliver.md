# Build, check, deliver

Run everything from the kit folder. One command per stage; never assemble things by hand. Voices, mouth, subtitles, sound, render, encode and checks are all done by `python tools/episode.py`.

## Commands (in order)
```
python tools/episode.py doctor --smoke    # is this machine ready? (once per machine)
python tools/episode.py new "<title>"     # -> episodes/epNN-<slug>/ (add --number 3 and/or --slug name if the user numbers or names their own episodes)
python tools/episode.py directions <slug> # a cinematic first plan for every line: shots, faces, body acts, camera moves, light
python tools/episode.py review <slug>     # measures the plan and says what is flat (validate runs the same check)
python tools/episode.py validate <slug>   # the rules, before spending anything
python tools/episode.py build <slug>      # voices + mouth + subtitles + sound effects + soundtrack
python tools/episode.py stills <slug>     # one picture per line + a contact sheet (--at 3,12.5 for chosen times)
python tools/episode.py video <slug>      # render + encode + qa  (about 30 minutes for a minute of video)
python tools/episode.py deliver <slug>    # copy the MP4 to the delivery folder
python tools/episode.py organize <slug>   # out/<slug>/chosen and not_chosen
```
- Also: `render`, `encode`, `qa` separately. `render` resumes where it stopped.
- `python tools/browser.py shot name.png "<query>" [WxH]` = a quick look without an episode (`chars=a,b&world=x&cam=wide&left=happy&t=3`).
- Run `video` in the BACKGROUND and check the number of files in `out/<slug>/frames/` now and then. Do not poll fast.
- Tell the user the wait up front ("about 30 minutes") and say what they get at the end.

## The director pass (before voices and stills)
1. Run `directions`: it gives every line a shot, a face for BOTH characters, a body act, a camera move and some light. Never keep it as is: improve it line by line with `cinematic-playbook.md` and `direction.md`.
2. Run `review` (or `validate`). A **flat plan fails** (`rules.cinematic`, on by default). The errors say what to change:
   | error | fix |
   |---|---|
   | too few different shots / the same shot 3 times in a row | cut to the listener, change the angle (`over_*`, `*_low`, `*_high`), add a `wide` or `two` |
   | no angle shots / no wide or two-shot | a low, high, extreme close-up or over-the-shoulder on key lines; show both characters once |
   | faces barely change | give every line the face of its feeling for both characters; invent faces with `expressionParams` |
   | too few lines with a body act (need 40%) | `directions[i].act = { "left": "nod", "right": "recoil" }` on the beats |
   | the camera never moves | `move: { "push": 0.2 }` on emotional shots, one `roll`, a `camFx` punch or shake |
   | no light play (need 2 changes) | `lightEvents` with a visible cause (`light-theory.md`) |
3. Turn the check off (`project.json` -> `rules.cinematic: false`) only if the user asks.

## Look at the stills first (`out/<slug>/stills/contact.png`)
Do NOT render the full video until these are all yes:
- [ ] Both characters visible, not cropped, not overlapping badly.
- [ ] No speckle or noise in dark areas; a thin vignette is visible at the edges.
- [ ] Subtitles readable, not over a bright area, at most 2 lines.
- [ ] Shots vary: not more than 3 close-ups of the same character in a row; a `wide` somewhere in the middle.
- [ ] Every light change has something on screen that explains it.
- [ ] Expressions match the line (sad line, sad face).
Fix `episode.json` (shot, expression, props) and run `stills` again.

## After the video (`qa` + `out/<slug>/qa/contact.png`)
- `qa` rejects automatically: wrong size for the project format, duration >0.5 s off plan, over 30 MB (`encode` raises compression by itself until it fits), mean volume outside -30..-12 dB, peak above -1 dB.
- Look at the QA contact sheet once more: noise, edges, subtitles.
- An agent CANNOT judge, so say it plainly to the user: voices and acting, mouth movement, rhythm of the pauses, how sound effects match the picture, cut-off sentence ends. Hand over the file and ask them to watch it.

## Delivery
- `deliver` copies the MP4 to `project.json` -> `delivery.folder`, or the `VIDEO3D_DRIVE` environment variable. Nothing set = the MP4 stays at `out/<slug>/<EpNN_Title>_vN.mp4`. Always report the FULL path.
- Each new render gets a new version number (`_v1`, `_v2`).
- `organize` copies the final files to `out/<slug>/chosen` and moves `out/<slug>/options/*` to `not_chosen` (kept, not deleted).

## Saving work in the user's own repo
- Commit: `episodes/<slug>/` (script.json, episode.json, `takes/*.wav`, `dialog.mp3`, `lipsync.json`, `timings.json`, `subs.ass`, `images/`, `audio/`), `characters/`, `worlds/`, `assets/` additions.
- NEVER commit: `out/`, `*.mp4`, `.env`, `project.json`, `episodes/*/dialog.wav` (all already in `.gitignore`).
- Committed takes mean an episode can be rebuilt later with no API key.

## Troubleshooting
| Symptom | Cause and fix |
|---|---|
| `doctor` says no Chrome | Install Chrome or Chromium, or set `CHROME_BIN` to its path |
| Still or render hangs, blank, or all black | WebGL failed. Run `doctor --smoke`; close leftover `chrome` processes; update Chrome; try another `CHROME_BIN` |
| Wrong page or old files shown | Not an issue any more: the tools check that the server on a port serves THIS kit, and take the next free port (5173, 5174, ...) otherwise. A stale server of another copy may keep running; it does no harm |
| Render crashed halfway | Run `video` or `render` again: it only draws the missing frames |
| `FileExistsError ... enc` at encode | A previous `ffmpeg` is still running or left the `out/<slug>/enc` folder. Wait for it to finish, or end the `ffmpeg` process, delete `out/<slug>/enc`, run `encode` then `qa` |
| `frames are still missing` | Run `render` again (it resumes) |
| Subtitles show no text (Linux) | `sudo apt-get install -y fonts-dejavu` |
| `Cartesia error 401/403` or `ElevenLabs error 401` | Key missing or wrong in `.env`. The user fixes it in the file themselves; never ask for the key in chat |
| `has no <provider> voice yet` | `python tools/setup.py set-voice <character> <provider> <voice-id>` |
| End of a sentence is cut off | Add a final period to the line text, lower `speed`, build again; for a sure fix make 3 versions and let the user choose |
| Text or subtitle overlaps something | Shorten the line (max ~70 characters), or change shot/props |
| `validate`: light change has no cause | Move it next to a visible event, or remove it. In a world with `lightCauseCheck: "text"` only the written `cause` is needed |
| `validate`: world has no screen/phone/outside | Remove those parts from `episode.json`; this world does not have them |
| `validate`: unknown tone/expression | Use names from `characters/<id>/character.json` (a new face: add it to `expressions` and `expressionParams`) |
| `validate`: the plan is flat | See "The director pass" above; `review` prints the numbers |
| `validate`: unknown act | Use a name from `assets/acts.json`, the character's `acts`, or define it in `actDefs` |
| MP4 over 30 MB | `encode` retries with more compression; if it still fails, shorten the video |
| A custom sound is missing | Without `ELEVENLABS_API_KEY` the kit plays the bundled `whoosh` instead and says so |
