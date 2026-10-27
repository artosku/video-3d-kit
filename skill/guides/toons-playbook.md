# Toons playbook: two characters explaining a video that already exists (`/video-3d-toons`)

Toons = the two characters stand at the bottom edges of the picture and talk about what is on a **phone screen recording, a PC screen recording or any real video**. The video plays under them, its own sounds are kept, and the characters are drawn flat (2D from the front) on top. It is the same kit, characters, voices and engine as `/video-3d`; only the stage is different (`worlds/overlay`, transparent).

## The pipeline (scripts do the work)
```
python tools/toons.py init "<title>" --video <file.mp4>     # scaffold: episode.json with every default below
python tools/toons.py look <slug>                           # one picture every 3 s of the video: LOOK at it before writing anything
  ... write episodes/<slug>/script.json, get the user's OK (no voices before the OK: they cost credits) ...
  ... set episode.json -> toons.marks (which line starts when which screen appears), toons.intro / toons.outro if wanted ...
python tools/toons.py settle <slug>                         # voices, gaps so each marked line meets its screen, the plan; loops until stable
python tools/episode.py build <slug>                        # voices (cached), mouth, captions, sound, music
python tools/toons.py stills <slug> --at 2,12,30,45         # the characters over the REAL frames: check position, captions, eyes. Do this before any render
python tools/episode.py video <slug>                        # render + encode (the video is laid under the frames, sounds mixed) + check
python tools/episode.py deliver <slug>
```
`episode.json -> toons`: `explainer` (who explains; the other one only chips in), `turns` ("mix" or "half"), `music` ("fun" or "none"), `intro` ("none" | "roller"), `outro` ("none" | "whirl"), `marks` ({"line": second of the VIDEO where that line should start}), `backdrop`, `outroTexts`.

## Writing the script (the screen sets the budget)
- The video is the story. Look at the contact sheet, list each screen with its start second, and give every screen a **word budget**: the voice speaks about 0.6 s per word (pauses included), so a 3 s screen holds about 5 words, a 5 s screen about 8, a 9 s screen about 15. A line that needs more words than its screen lasts arrives late and the viewer reads one thing while hearing another. If the user gave a script or timestamps, they are a guide for WHAT to explain at that second, not text to copy: shorten to the budget.
- One feature = one short sentence, in the order of the screen. Spoken lines are 3-9 words.
- One character explains (the explainer), the other chips in 3-4 times with a short reaction or question ("Wow, complete!", "Do I retype the price?"). Never let the second character interrogate the whole video.
- The first line must hook; if the user wants a specific opening sentence, use it word for word and make the next line continue it ("<Product> has a new look!" then "This is the home: ...").
- Anything the TTS reads badly: spoken text differs from the caption: `"text": "kris"`, `"caption": "QRIS"` (see script-craft.md).
- No real people, no real brands on screen unless the owner asked for them (their own product name is fine).

## Marks: make the voice meet the screen
`toons.marks = {"3": 6.1, "6": 16.8}` means: script line 3 starts when the VIDEO is at 6.1 s, line 6 at 16.8 s. `settle` turns this into gaps. Lines between marks follow each other with a short gap. A line that is shorter than its screen leaves silence: lengthen the sentence a little (never leave more than 2-3 s of silence), or let the other character react. A line longer than its screen: cut words.

## The look (already the default; change only when the user asks)
- **Camera = 2D from the front, ALWAYS.** The overlay world uses an ORTHOGRAPHIC camera at the characters' eye level looking straight ahead: no perspective, never seen from above (no top of the head, no roof of the pixel mascot), never from below at any height, no handheld drift, no dolly or zoom. The characters must not move against the footage. To put them low in the frame the picture is lens-shifted, never tilted.
- **Position:** ayam at the far left, claude at the far right (`overlayLook`: `leftX -4.95`, `rightX 4.5`, `feet 0.16` = feet 16% above the bottom, standing on the phone's bottom menu). They may cover a little of the screen edge; keep them out of the important middle. Caption and characters are not "safe-area" constrained here (the user decided); the guide numbers for TikTok/Instagram safe zones are: top about 270 px, bottom about 670 px, sides 120 px, the right-hand button column about 180 px wide from y 840 to 1250 (third-party guides, they differ).
- **Style:** flat toon bands (3-4 steps of light), NO outline (the user dislikes thick black lines), warm and not washed out. Set in `worlds/overlay/world.json` (`toon`, `eyes`).
- **Eyes and body:** the body stays upright and faces the viewer or turns half (90°, most often), three-quarters (135°) or fully away (180°, for typing) toward the screen; where they look is shown by the EYES (`gazeL`/`gazeR`: up at the phone `[0.35, 0.95]`, at each other `[0.95, 0]`, at the viewer `[0, 0]`). The rigs have `setEyeStyle({gain, life, mouth, beak, speech})`: wider eye travel, tiny restless eye life.
- **Mouth:** small. The ayam's mouth and beak open to 1/3 of the original maximum (`eyes.mouth 0.56`, `eyes.beak 0.67`) and `speech: true` makes the mouth follow the voice only: it closes between syllables. Never enlarge it to make it "readable". Check a frame at a pause and at a loud syllable before delivering.
- **Captions:** ONE fixed place just above the characters' heads (`subtitles.y 0.68`), white with a dark outline, **one word at a time** (`words: true`), a name that belongs together stays whole (`subtitles.units: ["Play Store", "Mode Bisnis"]`), key words in the accent colour (`*word*` in the caption), shouts bigger (`"capstyle": "shout"`), whispers smaller. Never long phrases, never over the key content of the video.
- **Faces and acts:** change from line to line and follow the sentence (the plan does a first version; improve it by judgement). Acts come from `assets/acts.json` so they work on any character.

## Hook and ending (optional, both on in the first promo made with it)
- **Hook "roller"** (`toons.intro: "roller"`, line 0 is a question asked in the middle of a plain or themed screen): the characters jump up, grab a rod at the top edge and pull the video down like a roller shutter; they hang on the rod, come down with it and land at the bottom positions. Use a backdrop picture so the hook has an environment: `python tools/toons.py backdrop <slug> --world park --episode ep05-... --pos 0,2.2,10 --look 0,3.4,-12.6 --fov 70 --t 40` (a picture of a set without characters) then `toons.backdrop`. The video starts at the moment of the pull; marks are relative to the VIDEO.
- **Ending "whirl"** (`toons.outro: "whirl"`, two script lines marked `"scene": "scream"` and `"scene": "cta"`): a cartoon whirlpool covers the frame from the edges, a SMALL fixed drain in the middle (it must not grow), the scream starts INSIDE the already swirling water (1.3 s after it begins, never before it), the characters spin and shrink into the drain, then the whirl is gone fast and an end card opens from the middle: title, tag, button (`outroTexts`: `title`, `pill`, `sub`, `dl`, `store`, `badge` "play" or "none", colours). They drop in, glance at the text first, then turn to the viewer for the call to action line.
- Do not put anything else in the scream line but a scream. See `toons` voice tricks below.

## Music that follows the scenes
`toons.music: "fun"` (default) generates `episodes/<slug>/music.wav` from code (`tools/funmusic.py`, no licence): a sparse curious bed during the hook, a rising sweep as they jump, an impact and the full bouncy beat exactly at the pull, the beat dropping into a descending whirl at the whirlpool, a bright chime and a light jingle on the end card. With no hook/ending it is a plain fun bed. The video's own sound effects stay in the mix. Peak is limited (the QA fails a peak above -1 dB).

## Voices: shouts, screams, panic (Cartesia)
- Cartesia emotion is English-only (Beta). In another language the same tag is mostly ignored; switching the language only to get emotion makes a foreigner's accent: do not.
- For a panicked shout in the dialogue language use inline tags: `<emotion value="scared"/><volume ratio="1.9"/><speed ratio="1.25"/>Hurry, download the app!` (valid emotions are listed in the Cartesia docs: panicked, scared, alarmed, surprised ...). Stretch a word with extra letters ("Stoooor"), do not respell it phonetically.
- Trick for a pure scream: write the text as `scream waaaaa!!!!`, then CUT the audio so only the scream is left. Such a file is quiet: normalise it (+18 dB with a limiter), then `episode.py lock <slug> <line> <file>`.
- Offer 3-4 takes for any special line (`variants`, or your own options) and let the user pick; lock the pick.

## Checks before you show a video
1. `toons.py look`: no private details on the video (name, e-mail, phone number, address, account number). If there are, say so and offer to blur that part.
2. `toons.py stills` over the real frames: characters inside the picture (not cropped by the edge), captions one word and readable, mouth small, eyes on the right thing, nothing from above.
3. Every marked line meets its screen (within about 1 s).
4. After `video`: extract frames from the delivered MP4 (not only the stills) and look; `qa` must say OK.
5. Say what you could not judge: the voices, the music, the rhythm.

## Known limits
- Portrait 9:16 only for now (the overlay is drawn for 1080x1920). Make the video portrait first.
- The captions follow the voice by loudness, not by word recognition: with long pauses inside a line the timing of single words can be off by a fraction of a second.
- The end-card store mark is a simplified drawing; a real brand logo is only used when the owner asks.
