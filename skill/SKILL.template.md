---
description: Make a short voiced 3D video where two characters talk (subtitles, music, sound effects) from one line. Use when the user types /video-3d <topic> or asks for a 3D character dialogue video.
---
<!-- BODY -->
# /video-3d {{ARGS}}

You make a short 3D video of two characters talking, from the user's topic. Kit folder: `{{KIT}}`. Do the work with the scripts in it; never rebuild by hand what a script does.

## How you talk to the user (strict, this is what keeps them from getting lost)
- Reply in the user's own language. Bullet points only, short, plain words. No jargon (no "rig", "TTS", "frames", "provider", file names) unless they ask.
- One message = at most 5 bullets. Say what you did, then what happens next, in one line each.
- Ask questions in ONE batch (use your question tool if you have one, otherwise a numbered list). Mark the default with ★. "ok" means "take all the ★".
- Never ask something already saved in `project.json`. Never ask for an API key in the chat (the user puts keys in `{{KIT}}/.env` themselves).
- Never mention internal details such as the moment outside the window: it is a falling star unless the user asks for something else.
- Do not narrate each command. Give the result and the next step.

## 0. First check
- Run `python {{KIT}}/tools/setup.py status`. If `projectExists` is false: read `{{KIT}}/AGENT_SETUP.md` and follow it (first-time setup), then come back here.

## 1. Questions (one batch)
Topic = {{ARGS}}. If it is empty, ask "What is the video about?" first.
- If `project.defaults.lastFormat` exists, ask ONE question: "Same as last time? <format> · <length> · <mood> · <character A> + <character B> in <world>" with ★ Yes / Change something. Only if they want to change, ask the four below.
- Otherwise ask these four together, defaults first:
  1. Shape: ★ portrait 9:16 (TikTok, Reels, Shorts) / landscape 16:9 (YouTube) / square 1:1.
  2. Length: ★ about 60 s / short, about 30 s / long, about 90 s.
  3. Mood: ★ sad (soft piano, warm dim light) / calm / cheerful.
  4. Cast and place: ★ keep "<character A> + <character B> in <world>" / change a character / change the place. If they pick a change, warn once: "a new character or place takes longer and uses more tokens", then follow `{{KIT}}/skill/guides/new-character.md` or `new-world.md`.
- Save the answers: `python {{KIT}}/tools/setup.py remember --format <f> --length <l> --mood <m>`.

## 2. Script first, wait for OK
- Read `{{KIT}}/skill/guides/script-craft.md`. Write `episodes/<slug>/script.json` (create it with `python {{KIT}}/tools/episode.py new "<short title>"`, it prints the slug).
- Show ONE compact table: `# · who · line` plus the estimated length (about 2.6 s per line). Ask only "OK, or what should change?". Make no voices before the OK (they cost credits).
- Language of the lines = `project.json` language. Short spoken lines (3-8 words). No real people, no real brands, no numbers the user did not give.

## 3. Build (scripts do the work)
Run from `{{KIT}}`:
1. `python tools/episode.py directions <slug>`, then edit `episode.json` by judgement (expressions, shots, light, ending). Read `skill/guides/direction.md` and `light-theory.md` when you do.
2. `python tools/episode.py validate <slug>` until it says OK.
3. `python tools/episode.py build <slug>` (voices, mouth, subtitles, sound).
4. `python tools/episode.py stills <slug>`, then LOOK at `out/<slug>/stills/contact.png` (one picture). Fix `episode.json`, repeat. Never render the full video before the stills are right.
5. Tell the user once: "Rendering takes about half a minute per second of video (a 60 s video is about 30 min)". Then run `python tools/episode.py video <slug>` in the background and wait for it to finish; do not poll.
6. `python tools/episode.py deliver <slug>`.

## 4. Final message (bullets, nothing else)
- The full path of the MP4, its length and size.
- What you could not judge: the voices, the mouth movement and the rhythm. Ask the user to watch and say what to change.
- Offer: "change a line / another video / another shape".

## Changes after the first result
- Only redo what changed: edit the script or `episode.json`, then `build` again (unchanged lines are reused, no new credits) and `video`.
- If the user asks for another moment outside the window, see `skill/guides/direction.md` (the `outside` field).

## Guides (read only when needed)
`{{KIT}}/skill/guides/`: `script-craft.md` · `direction.md` · `light-theory.md` · `audio.md` · `new-character.md` · `new-world.md` · `build-qa-deliver.md` (troubleshooting) · `formats-and-voices.md`.

## Fixed rules
- Do not change the voices or look of existing characters unless the user asks.
- Every change of light needs a cause the viewer can see; `validate` checks it.
- No film grain, no shiny characters, no real brands on screen.
- Do not commit `out/`, MP4 files, `.env` or `project.json`.
