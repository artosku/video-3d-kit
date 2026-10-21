# Audio: voices, tones, effects, music

`python tools/episode.py build <slug>` does everything (voices + mouth sync + subtitles + soundtrack). This file explains what happens and how to change it.

## 1. Voices
- Provider: `project.json` → `tts.provider` = `cartesia` or `elevenlabs`. Key from env or the `.env` file in the kit folder (`CARTESIA_API_KEY` / `ELEVENLABS_API_KEY`). Never ask the user to paste a key into the chat.
- Each character has its voice in `characters/<id>/character.json` → `voice`: `level`, `cartesia` `{id, emotion, speed, volume}`, `elevenlabs` `{id, stability, similarity, style, speed}`. List what an account can use: `python tools/episode.py voices --provider <p> --language <code>`; set the `id` in the character file under `voice.<provider>.id`.
- Language: `project.json` → `language` (Cartesia language code; ElevenLabs detects it). Emotion tags do not work outside English, so acting comes from `tone`, `gap`, punctuation and `...`.
- **Cache per line**: a hash of (voice, text, speed, volume, settings). Changing one sentence makes only that line again; the rest is reused exactly, so the voice never drifts. Takes live in `episodes/<slug>/takes/` and are kept: an episode with all takes rebuilds with no key and no internet.
- **Levels**: every line is leveled to the same loudness, then multiplied by `level` (below 1 quieter, above 1 louder), so whispered lines stay audible.

## 2. Tones, speed, level, gap
- `tones` in `character.json`: `"name": { "speed", "volume", "level", "use" }`. Pick by name in `script.json` (`"tone": "soft"`); explicit `speed`/`volume`/`level` on a line win. `speed` 0.6-1.5 (ElevenLabs is clamped to 0.7-1.2), `volume` 0.5-2.0.
- Gap (silence before a line): number or a name from `assets/gaps.json` (`tight` 0.3, `normal` 0.5, `breath` 0.9, `tense` 1.1, `before_punchline` 1.9).
- **A line that came out wrong** (too high, robotic, cut off, or an extra sound at the end: a short line with `!` sometimes gets one): `python tools/episode.py variants <slug> <line> [--n 3]` makes up to 4 takes of THAT line only (as written, with a full stop, a full stop and a little faster, slower) in `out/<slug>/variants/` and prints their full paths and lengths. Give the user the paths; they listen and choose. Then `python tools/episode.py lock <slug> <line> <file>` pins the chosen file. Never regenerate everything.

## 3. Locked takes (a voice take the user likes, reused as is)
1. Save the chosen WAV (mono, 44.1 kHz, 16-bit) as `characters/<id>/locked/<name>.wav`. Trim silence gently: keep about 0.14 s after the last sound and fade 30 ms; never cut a soft ending.
2. Add to `character.json` → `locked_takes`: `{ "text": "Exactly the line", "file": "locked/<name>.wav", "voice": "cartesia:<voice id>", "note": "why" }`.
3. Whenever a line has the same `text` for that character AND the voice `provider:id` matches the current one, the file is used and the voice service is not called. Change the voice and locked takes are skipped automatically.
4. `lock` does steps 1-2 for you (the file goes to `characters/<id>/locked/<slug>_L<line>.wav`). **A locked take ignores the line's tone and speed**; `validate` warns when a locked line also has a `tone`. Remove its entry in `locked_takes` to act that line again.

## 4. Sound effects (`assets/sfx/library.json`)
Every visible cause has a sound; the engine adds them automatically:
| cause | sound |
|---|---|
| lamp flicker | `lamp_flicker` |
| phone rises | `phone_rise` |
| moment outside | per type, from `world.json` → `outsideSfx` (`star` → `shooting_star`, `car` → `rocket_car_far`, `ufo` → `ufo_pass`, `santa` → `santa_bells`, `ketupat` → `ketupat_launch`, `firework` → `fireworks`, `lantern` → `lantern_rise`, `sprite` → `whoosh`), 0.3 s before it appears |
| screen page change | `soft_click` (`screen[].sfx` to change, `false` = silent) |
Others to add by hand in `sfx` when visible: `keyboard_typing` (low `gain`, about 0.4, under a character's "work" lines), `done_ping`, `sparkle`, `bell`, `whoosh`, `soft_pop`, `neon_flicker` (the sign switching on: add it at the `neon.at` time).
- Library entries: `"source": "kit"` (a bundled file in `assets/sfx/kit/`) or `"source": "elevenlabs"` (generated once from `prompt` + `duration`, kept in `assets/sfx/generated/`).
- **No ElevenLabs key?** Everything already generated ships in the kit and works. A sound that is not generated yet falls back to the bundled `whoosh` with a notice. Nothing blocks.
- **New effect**: add an entry `{"source":"elevenlabs","duration":2.0,"rms":900,"prompt":"English description: the sound, distance (\"very far away\"), the place (\"quiet room\")"}`, run `python tools/audio.py <slug> --sfx`, keep the mp3. Needs the ElevenLabs key; this key is for effects only when the project's voices use Cartesia.
- `rms` = target loudness when mixed (dialogue about 2600, effects 800-1900, ambience 260-420, music 330).
- **Ambience**: `episode.json` → `ambience` (see `direction.md`); the bedroom has `amb_quiet`, `amb_street`, `amb_moon`, `amb_rain`, looped softly. Worlds without ambience stay silent under the dialogue, unless `ambience` names a library sound.
- A `video` screen page plays NO sound by itself. If the recording has sound, extract it (`ffmpeg -i rec.mp4 episodes/<slug>/audio/rec.mp3`) and add `{ "at": "<the time the page starts>", "file": "episodes/<slug>/audio/rec.mp3", "rms": 1100 }` to `sfx`.
- Room tone (fan, hum) is only added when the world says `roomTone: true` (the bedroom).

## 5. Music
- A very thin soft piano under the whole video, ducking to 55% while someone speaks. `music.mood`: `sad` (default), `calm`, `cheerful`. Generated by `assets/audio_engine/make-audio.mjs` (Node), no samples needed.
- Own music: `"music": { "file": "episodes/<slug>/audio/song.mp3", "rms": 330 }` replaces the piano (still ducked). Use only music the user has the right to use. `{ "enabled": false }` = no music.

## 6. Final mix
Dialogue + music + room tone + ambience + effects → fade out (`fadeOut`) → loudness about **-16 LUFS**, peak ≤ -1.5 dB, 48 kHz stereo (`out/<slug>/audio.wav`). `qa` checks the MP4: mean about -20 dB, peak ≤ -1 dB.

## 7. Dos and don'ts
- Do: short lines, a period at the end of very short fast lines, one sound per visible event.
- Don't: loud music, sound effects with no visible cause, anything that covers a line, a line whose last letter is cut off (fix by rewording or a period).
- **You cannot hear.** Never claim the audio "sounds good". Report the numbers (length, mean/peak dB) and hand judgement of acting, rhythm and cut-off endings to the user.
