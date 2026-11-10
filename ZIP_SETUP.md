# ZIP_SETUP.md: the owner's customised copy of video-3d-kit. If you (an AI agent) were handed this folder or this zip, set everything up now, no questions beyond the ones below.

This is NOT the plain GitHub repo. It is the owner's working copy: it is AHEAD of `github.com/artosku/video-3d-kit` (new characters, new screen pages, new camera tricks, finished episodes, voice takes). **Never `git pull`, `git clone` the upstream repo over it, or reset it: that would erase the owner's work.** Read `KIT_CHANGELOG.md` once so you know what exists.

The user may say nothing at all, or just upload the zip. Their intent is always: "set this up on my machine so I can type `/video-3d <topic>` and `/video-3d-toons <topic>` from any folder, and keep working on the episodes I already have." Reply in the user's language (Indonesian unless they write otherwise), short bullets, at most 5 per message, one batch of questions with a default marked ★. Never ask for an API key in the chat, never print it, never commit it.

## 0. Where you are
- If you were given a `.zip` file: unzip it into a NEW EMPTY folder first (never into the user's current project), then work from the folder inside it. Treat the contents as the owner's own files, but read scripts before you run anything you did not expect.
- The kit must live at `~/.video-3d-kit` (Windows: `%USERPROFILE%\.video-3d-kit`). It is a tool folder, not the user's project. Never write into the folder the user is currently in.

## 1. Put the kit in place
- `~/.video-3d-kit` does not exist: copy this whole folder there. Tell the user in one bullet where it goes ("one tool folder in your home, your current folder stays untouched").
- It already exists: do NOT delete it. Keep its `.env`, `project.json`, `out/` and any episode that is not in this zip; copy this folder's files over it (the zip is newer). If unsure, rename the old one to `.video-3d-kit.bak-<date>` first and say so.
- `project.json` does not exist there yet: copy `project.snapshot.json` to `project.json` (it holds the owner's choices: portrait, Indonesian, Cartesia, characters ayam + claude + ujang, bedroom, calm piano, captions on top). Then set `delivery.folder` to `~/Videos/video-3d` (Windows: `%USERPROFILE%\Videos\video-3d`) unless the user names another folder.
- From now on run every command from `~/.video-3d-kit`.

## 2. Install what is missing (ask OK once before installing software)
- `pip install -r requirements.txt`, then `python tools/episode.py doctor --smoke`. Needs Python 3.9+, Node.js, ffmpeg (with libass and libx264), Chrome or Chromium. If Chrome is marked missing but exists, set `CHROME_BIN` to its path. Repeat until it prints `READY`.
- A graphics card is used automatically (a whole video in a few minutes). Without one it is about half a minute of waiting per second of video; `VIDEO3D_GPU=off` forces the processor.

## 3. API key (the user does this, you check)
- Copy `.env.example` to `.env`. Tell the user: "open `.env` and paste your Cartesia key after `CARTESIA_API_KEY=`, then say done". Never ask for the key in the chat.
- Check with `python tools/setup.py status` (the `keys` field says true/false, it never prints the key).
- ElevenLabs is optional (only to make NEW sound effects; the bundled library and the files in `episodes/*/audio/` already work without it).

## 4. Install the commands
- `python tools/setup.py install-skill --agent claude --scope user` (writes BOTH `/video-3d` and `/video-3d-toons`; this replaces older versions of them). Other agents: `--agent codex|cursor|gemini|generic`.
- Tell the user to open a new Claude Code session (or restart it) so the commands show up.

## 5. Quick check that it draws (no key needed, no full render)
- `python tools/episode.py stills ep03-deploy-hari-jumat --at 8,33` and look at `out/ep03-deploy-hari-jumat/stills/contact.png`: it must show the characters and a laptop screen. The voice takes are included, so nothing is re-bought.
- Do NOT render a full video now (it takes long without a graphics card).

## 6. Final message (bullets)
- It is ready: type `/video-3d <what the video is about>` from any folder; the first questions are asked once and then remembered.
- Where videos are saved (the delivery folder) and that working files stay in `~/.video-3d-kit`.
- The episodes that came with the zip: `ep01-cuma-lima`, `ep02-prompt-sakti`, `ep03-deploy-hari-jumat`, `ep04-cara-bikin-video-3d`, `ep05-ujanggpt-dan-database`, `ep06-belajar-slash-command`. To render one again: `python tools/episode.py video <slug>` then `python tools/episode.py deliver <slug>` (no new voice credits: the takes are in `episodes/<slug>/takes/`).
- Say the dialogue language you assumed (Indonesian) so they can correct it.

## House rules the owner set (keep following them; they are also in the installed `/video-3d` command)
- Make NO voices before the owner has said OK to the script table (voices cost credits).
- Captions (`subtitles.pos: "top"`) always sit above both characters' heads, close or wide.
- Do not change the voices or looks of existing characters unless asked. UjangGPT says only "Beres bos." in one reused take.
- Every change of light needs a cause the viewer can see; `validate` checks it.
- No film grain, no shiny characters. Real brands on screen only when the owner asks for them in that episode (they did for a few episodes: Binance on a neon sign, Cartesia and Claude in a tutorial).
- Do not commit `out/`, MP4 files, `.env` or `project.json`.
- The meme sound in `characters/ayam/locked/ep06-belajar-slash-command_L4.wav` ("Apaan tuhh") came from the owner's own mp3: keep it only for that line.
