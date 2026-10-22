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
  2. Length: ★ as long as the story needs (usually 45-75 s) / short, about 30 s / long, about 90 s.
  3. Mood: ★ let me choose from the topic / sad / calm / cheerful. (Sad is wrong for comedy: pick the music and light from the topic.)
  4. Cast and place: ★ keep "<character A> + <character B> in <world>" / change a character / change the place. If they pick a change, warn once: "a new character or place takes longer and uses more tokens", then follow `{{KIT}}/skill/guides/new-character.md` or `new-world.md`.
- The user may name the episode ("ep3 my-title"): create it with `python {{KIT}}/tools/episode.py new "<title>" --number 3`.
- Save the answers: `python {{KIT}}/tools/setup.py remember --format <f> --length <l> --mood <m>`.

## 2. Script first, wait for OK
- Read `{{KIT}}/skill/guides/script-craft.md`. Write `episodes/<slug>/script.json` (create it with `python {{KIT}}/tools/episode.py new "<short title>"`, it prints the slug).
- Show ONE compact table: `# · who · line` plus the estimated length (about 2.6 s per line). Add ONE extra line: "Anything to show on the laptop screen (a screen recording or screenshots)? If not, I will make a simulation that fits the story." Ask only "OK, or what should change?". Make no voices before the OK (they cost credits).
- Language of the lines = `project.json` language. Short spoken lines (3-8 words). No real people, no real brands, no numbers the user did not give.

## 3. Build (scripts do the work). The director pass is MANDATORY
Run from `{{KIT}}`. Never skip a step; a flat video is a failed video.
1. Read `skill/guides/cinematic-playbook.md` FIRST and fully, then `direction.md` and `light-theory.md`. Do this every time, even if you think you remember.
2. `python tools/episode.py directions <slug>` gives a first plan. It is only a start. Then go LINE BY LINE (shot and angle, the face of BOTH characters, a body act on the key beats, a camera move, the light) as the playbook says. Make new faces, gestures, shots or a screen simulation when the scene needs them; you are not limited to the shipped ones.
3. `python tools/episode.py review <slug>` must print `cinematic check: OK`. Then `python tools/episode.py validate <slug>` until it says OK.
4. `python tools/episode.py build <slug>` (voices, mouth, subtitles, sound). If a line's voice came out wrong (an extra sound at the end), offer takes: `python tools/episode.py variants <slug> <line>`, let the user pick, then `python tools/episode.py lock <slug> <line> <file>`.
5. `python tools/episode.py stills <slug>`, then LOOK at `out/<slug>/stills/contact.png` (one picture) and go through the visual checklist at the end of the playbook. Fix `episode.json`, repeat. Never render the full video before the stills are right.
6. The render uses the graphics card by itself when the laptop has one (a minute or two for a whole video), otherwise the processor. Tell the user once which: with a graphics card "a few minutes"; without, "about half a minute per second of video (a 60 s video is about 30 min)". `python tools/episode.py doctor --smoke` shows which one it found; `VIDEO3D_GPU=off` forces the processor. Then run `python tools/episode.py video <slug>` in the background and wait for it to finish; do not poll.
7. `python tools/episode.py deliver <slug>`.

## 4. Final message (bullets, nothing else)
- The full path of the MP4, its length and size.
- What you could not judge: the voices, the mouth movement and the rhythm. Ask the user to watch and say what to change.
- Offer: "change a line / another video / another shape".

## Changes after the first result
- Only redo what changed: edit the script or `episode.json`, then `build` again (unchanged lines are reused, no new credits) and `video`.
- If the user asks for another moment outside the window, see `skill/guides/direction.md` (the `outside` field).

## Guides (read only when needed, except the playbook)
`{{KIT}}/skill/guides/`: `cinematic-playbook.md` (always, step 3) · `script-craft.md` · `direction.md` · `light-theory.md` · `audio.md` · `new-character.md` · `new-world.md` · `build-qa-deliver.md` (troubleshooting) · `formats-and-voices.md`.

## Fixed rules
- Do not change the voices or look of existing characters unless the user asks.
- Every change of light needs a cause the viewer can see; `validate` checks it.
- No film grain, no shiny characters, no real brands on screen.
- Do not commit `out/`, MP4 files, `.env` or `project.json`.
