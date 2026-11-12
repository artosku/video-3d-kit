# Beat-sync engine ("Engine v2"): a video whose scene changes and impacts sit exactly on the music

Used by `/beat-3d`. Reference build: the "Uang Rp2.000 ×5" video (`episodes/uang-full/uang.json`, `web/uang.js`, `web/uang-x.js`, `tools/uang.py`, `tools/uang_sfx.py`).

## 1. The idea
- Every frame is a pure function of time `t`; time is read on the music's **beat grid**: bar `b` starts at `offset + b·4·60/bpm`.
- Scenes are defined in `episodes/<slug>/uang.json` as `{ id, nominal, bar, bars, item }`. A scene starts on its bar, its **hit** (the impact: the thing the money buys lands, lights switch on, the rocket lifts off) is at the **middle** of the scene (`bar + bars/2`), sounds and bursts are fired from the same numbers (`tools/uang_sfx.py`).
- Result: change the song or the bpm and everything stays on the beat.

## 2. Step 1: map the song (never guess the structure)
```
C:/Users/andi.pramana/lemo-opuscar/.venv/Scripts/python.exe tools/beat_analyze.py map <song.mp3> --first 90 --out out/<slug>/beatmap.json
```
It prints bpm, offset, one row per bar (energy and loud/mid/quiet), the **drops** (a loud part starts), where a loud part ends, and the strongest accents as `bar.beat`. Read it and write down:
- the **drops** (the "DENG" after a "totototet" build-up): each one is a bar line that must be a scene change with the biggest impact of the video;
- the **build-ups** (the bars before a drop, energy falling then a roll): put a calm or tense scene there, never a hit;
- the **quiet parts**: if the story needs a climax later, cut them out (step 3) instead of stretching the video.
- Kick (beat 0 and 2) and snare (beat 1 and 3) are strong; the offbeat (1.5, 3.5) are small accents: good for small pops, not for the big hit.

## 3. Step 2: cut the song to the story (optional)
```
python tools/beat_analyze.py cut <song.mp3> --keep 0:24 --keep 30: --out out/<slug>/music_cut.wav --bpm 138 --offset 0.06
```
Keeps bars 0..24 then bar 30 to the end, joined on bar lines with a 30 ms crossfade, so the grid stays exact. Put the file in `uang.json` → `music.file` (use forward slashes). Use the offset printed by `map`.

## 4. Step 3: the scene plan on the grid (rules that made it feel right)
1. The hook is 2 bars (pops on beats 0.5 and 2.0 of the hook). The first story scene starts on bar 2.
2. Scenes start on bar lines or on beat 2 of a bar (x.5). Never on beat 1 or 3 and never at 1.5 (that was the "half a bar late" mistake).
3. The first **drop** is a scene change. If the story has a "big moment" (rocket, the finale), its hit (mid-scene) is put on the strongest accent: make the scene 2 bars long so the build-up is the first bar and the hit is the bar line of the second.
4. In loud parts: calm scenes 1–2 bars, montage 0.5 bar (hit on beat 1 or 3 = the snare). In quiet parts: 1 bar and calm.
5. The last scene before a drop is the build-up (shake, countdown); the drop itself is the next scene's start.
6. The outro (2 bars) sits in a loud part; the music fades out at the end (`fadeOut`).
7. `total = offset + endBar·4·60/bpm`. After editing the json always check the printed frame count equals `total·30` (a stale json once rendered the old length without any error).

## 5. Step 4: build the scenes
- New scene = one entry in `X` in `web/uang-x.js`: `{ mood: 'day'|'sky'|'space', earth?, face:[before,after], act, burst:{c,n,p,s,z}, shake, build(g), anim(u, uh, g, pi, t) }`. `u` = seconds since the scene start, `uh` = seconds since the hit (negative before it), `pi` = springy pop 0→1. `anim` may return `{ ay, camY, camLy, space, sink }`.
- The info block (nominal, formula, item name, in the top-left, never behind the TikTok UI) is generic and driven by the json; item names must be short (one line). Big numbers: `fmt` in `uang.js` writes Rp … T / juta T.
- Money in the world is always Rp2.000 bills (`buildPile`: a low wide pile of bundles in front, taller with every power). Never a tall pole at the edge (it was mistaken for a pillar).
- In-world price boards (`board(...)`) must not overlap the top-left info block: keep them at y ≤ 2.2 or on the right.
- Colour code: yellow = money, coral = ×5, white = other text. No real brand on screen unless the user asked (BYD was asked; the phone is "HP burgundy", modelled on a reference photo but without logo).
- Sounds: `tools/uang_sfx.py` puts a pop, a thump that grows with the power, and one signature sound per scene on the hit; add the scene id to its `sig` table.

## 6. Step 5: check, then render
```
python tools/uang_sheet.py <slug> s6,s7,s8,s9,s10 0.3 a        # a contact sheet; LOOK at it (also -0.2 for before the hit)
python tools/uang.py video <slug> --size 540,960                # preview, about 10 minutes for 50 s on the GPU
python tools/uang.py video <slug> --size 1080,1920              # final, only after the user says OK
```
Copy previews to `C:\Users\andi.pramana\Videos\video-3d\` with a version number, finals also to `G:\My Drive\Artosku-Videos\3D\Potrait\`. Always give the user the full path. Say honestly that you cannot hear or judge the rhythm; the user does.

## 7. Pitfalls we hit
- Heredoc python through bash: a double backslash `'\\'` becomes `'\'`: never write Windows paths with backslashes there, use forward slashes.
- Run a long render in the background; do not poll. Confirm with `ffprobe` (duration) after it.
- The GPU: one worker only. Chrome is forced to the NVIDIA GPU by a per-app registry preference (see memory).
- The money pile, signs and the HUD must be looked at in stills before every render.

## 8. Lessons from uang ×5 v8 (late-scene redesign)
- Scene = one real place + one hero picture + at most two text items; avoid "everything is in space" after the climax. Use real maps (`web/maps.js`, `mapBoard(parent,'ID'|'W',width,x,y,z,panel)` draws provinces/continents on a canvas plane and can light them one by one; `landPts` gives points on land for dots).
- Scale ladder (`LAD` in uang.js): chicken 0.72→0.28, camera distance 13.5→34, item scale about the chicken 1→3.6. A scene can return camera offsets `dx, dlx, dy, dly, dz` and chicken offsets `ax, az, ay` from its `anim`.
- Four phases per scene: setup, anticipation (chicken crouches, camera moves), HIT on the beat, reaction. The chicken walks/hops to the action (ribbon, chain) and holds the tool (giant scissors, bolt cutter).
- Verify with frames of the final MP4 (see lessons.md: transparent material bug).
