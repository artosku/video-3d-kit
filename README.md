> **AI agent: read this first.** If a user gave you this link (with just "setup", "install", "pakai ini", or nothing else), their intent is ALWAYS this: install the kit as a tool and create the `/video-3d` slash command for them. Do not summarize the repo and do not ask what they want.
> 1. Read `AGENT_SETUP.md` (https://raw.githubusercontent.com/artosku/video-3d-kit/main/AGENT_SETUP.md) and follow it step by step.
> 2. The kit goes to `~/.video-3d-kit` (one tool folder in their home). Never use or write into the folder the user is currently in.
> 3. Talk to the user in their language, short bullet points, one batch of questions with a default marked ★.
> 4. When done, tell them: type `/video-3d <what the video is about>` from any folder.

# video-3d-kit

Short 3D videos where two characters talk, made by your AI agent from one line: `/video-3d <topic>`.

- Voiced dialogue, subtitles, soft music, sound effects, lighting that follows the mood.
- Every video is directed per line (shots, faces, body acts, camera moves, light) and a built-in check refuses flat videos.
- Portrait (TikTok, Reels, Shorts), landscape (YouTube) or square. Needs no GPU.
- Two ready characters (a round chicken and a pixel mascot) and a ready night bedroom. Make your own character or place if you want.
- Voices from Cartesia or ElevenLabs (you need an account at one of them).

## Use it
Paste this link to your AI agent (Claude Code, Codex, Cursor, Gemini CLI, ...) from any folder and say **"setup"**:

> `setup https://github.com/artosku/video-3d-kit`

- The agent installs the kit once in a tool folder in your home (`~/.video-3d-kit`). It does not touch the folder you are in and does not turn it into a project.
- It asks a few short questions, installs what is missing, and creates the `/video-3d` command. After that, from any folder, just type `/video-3d <what the video is about>`.
- Prefer a zip? Download it, unzip anywhere, and tell your agent: "setup this folder".

## What you need
- Python 3.9+, Node.js, ffmpeg, Chrome (the agent checks these and tells you how to install what is missing).
- An API key for Cartesia or ElevenLabs. You put it in a `.env` file yourself; it is never committed.

## What is inside
| folder | what |
|---|---|
| `AGENT_SETUP.md` | the one file your agent reads to set everything up |
| `skill/` | the slash command template and the guides your agent reads when it works |
| `characters/` | the ready characters and a template for new ones |
| `worlds/` | the ready bedroom and a template for new places |
| `tools/` | the scripts (`episode.py` makes the video, `setup.py` sets things up) |
| `web/`, `assets/` | the 3D engine, lighting presets, sound effects |
| `episodes/` | your videos' scripts; `ep01-cuma-lima` is a finished demo (Indonesian) |

## Notes
- A new character or a new place takes longer and uses more tokens than the ready ones.
- Rendering uses the graphics card automatically when there is one (a whole video in a few minutes); without one it takes about half a minute of waiting per second of video. `VIDEO3D_GPU=off` forces the processor.
- Sound effects, music and the 3D engine are included; see `ASSETS_NOTICE.md` for licenses and credits.
