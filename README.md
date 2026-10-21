> **AI agent reading this? Start here.** The user wants this kit set up. Do not summarize it: open `AGENT_SETUP.md` (in this repo, next to this file), follow it step by step, and talk to the user in their language with short bullet points. If the repo is not on their machine yet, `git clone https://github.com/artosku/video-3d-kit` first.

# video-3d-kit

Short 3D videos where two characters talk, made by your AI agent from one line: `/video-3d <topic>`.

- Voiced dialogue, subtitles, soft music, sound effects, lighting that follows the mood.
- Portrait (TikTok, Reels, Shorts), landscape (YouTube) or square. Needs no GPU.
- Two ready characters (a round chicken and a pixel mascot) and a ready night bedroom. Make your own character or place if you want.
- Voices from Cartesia or ElevenLabs (you need an account at one of them).

## Use it (2 steps)
The shortest way: paste this link into your AI agent and say **"set this up"**: `https://github.com/artosku/video-3d-kit`

1. Get the kit: `git clone https://github.com/artosku/video-3d-kit`, or download the zip and unzip it.
2. Tell your AI agent (Claude Code, Codex, Cursor, Gemini CLI, ...): **"Read AGENT_SETUP.md in this folder and set it up for me."** Or, without cloning first: **"Clone https://github.com/artosku/video-3d-kit, read its AGENT_SETUP.md and set it up for me."**

The agent asks a few short questions, installs what is missing, and creates the `/video-3d` command. After that, just type `/video-3d <what the video is about>`.

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
- Rendering takes about half a minute of waiting per second of video on a normal laptop.
- Sound effects, music and the 3D engine are included; see `ASSETS_NOTICE.md` for licenses and credits.
