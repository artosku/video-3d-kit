---
description: Make a short voiced video where two cartoon characters stand over a video you already have (a phone or PC screen recording, a real video) and explain what is on it. Use when the user types /video-3d-toons <what to explain> or wants characters talking over a screen recording.
---
<!-- BODY -->
# /video-3d-toons {{ARGS}}

You make a short video where two characters talk OVER a video the user already has and explain what is on it (captions, music, their own sound effects kept). Kit folder: `{{KIT}}`. Do the work with the scripts in it; never rebuild by hand what a script does. It is the same kit as `/video-3d` (same characters, voices, project); only the stage is different.

## How you talk to the user (strict, this is what keeps them from getting lost)
- Reply in the user's own language. Bullet points only, short, plain words. No jargon (no "rig", "TTS", "frames", "orthographic", file names) unless they ask.
- One message = at most 5 bullets (a table is fine for a script or a list of options). Say what you did, then what happens next, in one line each.
- Ask questions in ONE batch (use your question tool if you have one, otherwise a numbered list). Mark the default with ★. "ok" means "take all the ★".
- Never ask something already saved in `project.json`. Never ask for an API key in the chat (the user puts keys in `{{KIT}}/.env` themselves).
- Do not narrate each command. Give the result and the next step. Send pictures and videos to the user with your file-sending tool when you have one; otherwise give the full path.

## 0. First check
- Run `python {{KIT}}/tools/setup.py status`. If `projectExists` is false: read `{{KIT}}/AGENT_SETUP.md` and follow it (first-time setup), then come back here.
- Read `{{KIT}}/skill/guides/toons-playbook.md` fully, EVERY time. It holds the look, the rules and the checks; the user has corrected each of them before.

## 1. The video and the questions (one batch)
Topic = {{ARGS}}. The user must give you the video file (a path). If they did not, ask for it first. If they also gave notes or a timestamped script, those say WHAT to explain at which second: a guide, not text to copy.
- Run `python {{KIT}}/tools/toons.py init "<short title>" --video <path>` (the episode number can be given with `--number`), then `python {{KIT}}/tools/toons.py look <slug>` and LOOK at the picture it makes: what is on screen at each second, and whether something private shows (a name, an e-mail, a phone or account number). If it does, tell the user in one bullet and offer to blur that part.
- Ask ONE batch, defaults first:
  1. Who explains: ★ the second character explains and the first chips in 3-4 times / the other way round / only one explains.
  2. Opening: ★ start straight on the video / a hook: a question in the middle of a themed picture, then they jump up and pull the video down like a roller shutter (needs a backdrop picture: a place from this kit, or one the user has).
  3. Ending: ★ just finish with the video / a whirlpool takes them away, then an end card with a call to action (needs the card words: title, a short tag, a button text, and whether to draw a store logo).
  4. Music: ★ a fun bouncy bed that follows the scenes / none.
  (Characters, voices and language come from `project.json`; do not ask again.)
- Save the answers into `episodes/<slug>/episode.json` → `toons` (explainer, intro "none"|"roller", outro "none"|"whirl", music "fun"|"none", backdrop, outroTexts).

## 2. Script first, wait for OK
- Write `episodes/<slug>/script.json` as the playbook says: a word budget per screen (about 0.6 s per word), one feature per short sentence in the order of the screen, one character explains and the other chips in 3-4 times. Mark the scream and the call to action lines with `"scene": "scream"` / `"scene": "cta"` when there is an ending. Put the user's own opening sentence word for word at the start if they gave one.
- Show ONE compact table: `# · who · line · which screen and its budget`, plus the estimated length. Ask only "OK, or what should change?". Make no voices before the OK (they cost credits).
- Language of the lines = `project.json` language. No real people, no real brands on screen unless the owner asked.

## 3. Build (scripts do the work)
Run from `{{KIT}}`.
1. Write `toons.marks` into `episode.json`: for each screen change worth following, `"<line number>": <second of the video where that line starts>`.
2. `python tools/toons.py settle <slug>` (makes the voices, aligns the gaps to the marks, writes the plan; repeats until stable). Special lines (a scream, a panic shout, a dramatic line) need options: make 3-4 takes (playbook "Voices"), let the user pick, then `python tools/episode.py lock <slug> <line> <file>` and run `settle` again.
3. `python tools/episode.py validate <slug>` until it says OK, then `python tools/episode.py build <slug>`.
4. `python tools/toons.py stills <slug> --at <6 seconds that show different things>`: the characters over the REAL frames. LOOK at `out/<slug>/toons_stills.png`. Check position, one-word captions, small mouth, eyes, nothing seen from above. Fix `episode.json` (`overlayLook`, `directions`, `subtitles`), repeat. Show the user this picture and wait for their OK or notes about position and captions BEFORE the full render.
5. The render uses the graphics card by itself when there is one (a few minutes), otherwise about half a minute per second of video. Run `python tools/episode.py video <slug>` in the background and wait for it to finish; do not poll.
6. LOOK at frames extracted from the delivered MP4 (`ffmpeg -vf fps=1/5,scale=210:-2,tile=15x1`), not only the stills. `python tools/episode.py deliver <slug>`.

## 4. Final message (bullets, nothing else)
- The full path of the MP4, its length and size.
- What you could not judge: the voices, the music, the rhythm and the mouth movement. Ask the user to watch and say what to change.
- If something private showed on the video: say it and offer a blur. Offer: "change a line / another video".

## Changes after the first result
- Only redo what changed: edit the script, `toons.marks` or `episode.json`, run `settle` again (unchanged lines are reused, no new credits), `build`, `stills`, then `video`. Delete `out/<slug>/frames` before every re-render (old frames are reused otherwise).
- When the user corrects something about the look (a position, the mouth, the camera, a caption), apply it AND write it into the playbook's rules for next time if it is not already there.

## Fixed rules (every one came from a correction)
- The camera is 2D from the front at the characters' eye level, never from above or below, never moving. The characters stay at the bottom edges (ayam left, claude right) so they hide little of the video.
- The ayam's mouth stays small and closes between syllables. No thick black outlines. No film grain, no shiny characters.
- Captions: one fixed place just above the characters, ONE word at a time (names stay whole), key words coloured.
- The scream starts inside the whirlpool, never before it. Emotion tags work in English only; do not switch the language to get emotion.
- Do not change the voices or look of existing characters unless the user asks. No real brands on screen unless the owner asked.
- Do not commit `out/`, MP4 files, `.env`, `project.json`, or the user's own episodes.
