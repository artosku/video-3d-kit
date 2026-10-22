# Formats, languages, voices, keys

## Formats (`project.json` -> `format`)
| format | final size | drawn at | for |
|---|---|---|---|
| `portrait` | 1080x1920 | 720x1280 | TikTok, Reels, Shorts (default) |
| `landscape` | 1920x1080 | 1280x720 | YouTube, presentations |
| `square` | 1080x1080 | 720x720 | feeds |
- The video is drawn small with WebGL (the graphics card when there is one, otherwise software; no GPU needed) and scaled up when encoded. That is normal and looks fine.
- Subtitles: portrait = white, top third, no speaker names; landscape and square = bottom center, bigger relative font, longer lines (about 52 characters, portrait 31).
- Subtitle position: `episode.json` -> `subtitles: { "pos": "top" | "bottom" | "auto" }` and per line `directions[i].subs`. Default `auto`: top third, but bottom for shots where the heads are in the top third (`wide`, `two`, `wide_low`, `wide_high`, every `*_high`). Landscape and square are always at the bottom.
- Camera: the shots are framed for portrait. For landscape the lens is narrowed (x0.55) and for square (x0.82) automatically. No change needed in `episode.json`.
- Change it for one video: ask the user, then set `format` in `project.json` (or `python tools/setup.py remember --format ...`) before `stills`. Stills and render both follow it.
- Size limit: `encode` keeps the MP4 at 30 MB or less for social media.

## Language (`project.json` -> `language`)
- A code like `id`, `en`, `es`, `fr`, `de`, `ja`. Used for Cartesia voices. Subtitles are just the script text, so write the script in that language.
- Cartesia: the code must be one Cartesia supports; list voices with `python tools/episode.py voices --provider cartesia --language <code>`.
- ElevenLabs: the model `eleven_multilingual_v2` (set in `tts.elevenlabs.model`) detects the language from the text; the code only filters the voice list.
- If a language has no voices, say so and offer the nearest one (or ElevenLabs).

## Providers (`project.json` -> `tts.provider`)
| | Cartesia | ElevenLabs |
|---|---|---|
| per voice settings in `character.json` | `id`, `emotion`, `speed`, `volume` | `id`, `stability`, `similarity`, `style`, `speed` |
| speed range | about 0.6-1.5 | 0.7-1.2 (the kit clamps) |
| volume | used | not used (the kit levels every line itself) |
| emotion words | work for English only; for other languages act with speed, punctuation and pauses | none; use `stability` (lower = more varied) and `style` |
- Acting for any provider: `speed`, short lines, `...` for a hesitation, `!` rising, `.` falling, and the pause (`gap`) before a line. `level` (below 1 = quieter, above 1 = louder) evens the final loudness.
- Tones in `character.json` -> `tones` set speed/volume/level in one name (`soft`, `excited`...). A tone written on a line can be overridden by `speed`/`volume`/`level` on the same line.
- A character needs a voice for EACH provider it may use. Missing = `dialog.py` stops and says which command to run.
- Pick a voice:
  - `python tools/episode.py voices --provider <p> --language <code>` (list: id, name, language, gender, description)
  - suggest 3 by gender and description; the user chooses by name
  - `python tools/setup.py set-voice <character-id> <provider> <voice-id> --name "<name>"`
- A line the author loves can be locked: add `{"text": "...", "file": "locked/name.wav", "voice": "<provider>:<voice-id>"}` to the character's `locked_takes` (file in `characters/<id>/`). It is used as is and only for that exact voice.

## Keys (`.env`, never in chat)
- The user copies `.env.example` to `.env` and pastes the key themselves:
  - `CARTESIA_API_KEY=...` (if the provider is cartesia)
  - `ELEVENLABS_API_KEY=...` (if the provider is elevenlabs, or for new sound effects)
- NEVER ask the user to paste a key into the chat. NEVER print, echo or commit a key. `.env` is in `.gitignore`.
- The kit reads the key from the environment first, then from `.env`. `python tools/episode.py doctor` says whether it is found (it never shows the key).
- Where to get one: Cartesia dashboard (play.cartesia.ai) or ElevenLabs (elevenlabs.io), account -> API keys. Give the user this plain instruction: "Make a key there, open the file `.env` in the kit folder, paste it after the `=`, save."

## Cost and credits
- A voice is made only for NEW or CHANGED lines. Every line is cached in `episodes/<slug>/takes/` by what it says and how, so re-running `build` costs nothing for lines already made.
- Before building, tell the user roughly how many new lines will be made. Ask for script approval first (the script is cheap, voices are not).
- A change of voice or provider makes every line new again.

## When ElevenLabs is optional
- If the provider is Cartesia, ElevenLabs is needed only to generate NEW sound effects (a prompt in `assets/sfx/library.json` that has no file yet).
- A bundled sound library comes with the kit (`assets/sfx/generated/` and `assets/sfx/kit/`), so the bedroom and the default sounds work without ElevenLabs.
- A missing new sound with no ElevenLabs key plays the bundled `whoosh` and prints a note. Do not treat it as an error.
- If the user has ONLY ElevenLabs: set `tts.provider` to `elevenlabs` (via `setup.py init --provider elevenlabs`) and give each character an ElevenLabs voice. Nothing else changes.
