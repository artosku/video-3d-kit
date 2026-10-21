# AGENT_SETUP.md: read this once, then set everything up for the user

You are an AI coding agent (Claude Code, Codex, Cursor, Gemini CLI, or similar). The user wants to make short 3D videos where two characters talk, using this kit. Your job now: install the kit as a tool on their machine and create a `/video-3d` command for them. After this, they only type `/video-3d <topic>` from any folder.

## Talk to the user like this (strict)
- Reply in the user's own language. Bullet points only, short, plain words. No jargon (no "rig", "TTS", "frames", file names) unless asked.
- At most 5 bullets per message: what you did, then what happens next.
- Ask questions in ONE batch (use your question tool if you have one, otherwise a numbered list). Mark the default with ★. "ok" = take all the ★. At most 4 questions per batch.
- NEVER ask the user to paste an API key in the chat. They paste it into the `.env` file themselves.
- Ask before installing software on their machine. Never commit or upload anything.

## Step 1. Install the kit as a tool, then check the machine
- This kit is a TOOL, not the user's project. Install it once in a fixed folder in their home: `~/.video-3d-kit` (Windows: `%USERPROFILE%\.video-3d-kit`). Never use or write into the folder the user is currently in, and never turn it into a project.
  - Not installed yet (you were just given the link): `git clone https://github.com/artosku/video-3d-kit ~/.video-3d-kit`. Tell the user in one bullet where it goes and why ("one tool folder, your current folder stays untouched").
  - You were given a zip or a copy somewhere else: move or copy it to `~/.video-3d-kit` (ask OK first).
  - Already there: `git -C ~/.video-3d-kit pull` (if it is a git clone) and continue.
- From now on, run every command from `~/.video-3d-kit`. Everything the user makes (characters, places, videos) is saved there too.
- Run `pip install -r requirements.txt`, then `python tools/episode.py doctor --smoke`.
- If something is marked ✗, the doctor prints the fix command. Tell the user in one bullet what is missing and ask OK before running it. Repeat until it prints READY.

## Step 2. Ask the setup questions (one batch)
1. Characters: ★ use the two that are ready (a round chicken + a pixel mascot) / make a new character / keep one and make one new. If they choose "new", warn once: "a new character takes longer and uses more tokens".
2. Place: ★ the ready night bedroom / make a new place (forest, beach, anywhere). Same warning for "new".
3. Voices from: ★ Cartesia / ElevenLabs (the one they have an account for).
4. Video shape: ★ portrait 9:16 (TikTok, Reels, Shorts) / landscape 16:9 (YouTube) / square 1:1.
- The dialogue language is the language the user writes to you in (say it in your final message so they can correct it). Language codes: see `skill/guides/formats-and-voices.md`.

## Step 3. API key
- Tell the user: "Copy `.env.example` to `.env`, open it, and paste your key for <provider> there. Say 'done' when finished." You can do the copy for them; they paste the key.
- Check with `python tools/setup.py status` (the `keys` field). Never print or log the key.
- The other provider's key is optional: ElevenLabs is also used to make NEW sound effects, but a library of sounds is already included.

## Step 4. Characters and place
- Ready characters: `ayam` (the chicken) and `claude` (the pixel mascot). Ready place: `bedroom`. See all: `python tools/episode.py characters`.
- Voices: each character needs a voice id for the chosen provider.
  - The ready characters already have Cartesia voices (Indonesian). Use them only if the dialogue language is Indonesian and the provider is Cartesia; otherwise pick new voices.
  - To pick: `python tools/episode.py voices --provider <p> --language <code>`. Show 3-4 options per character in plain words (name + male/female + one-line feel), ask the user to choose, then `python tools/setup.py set-voice <character-id> <p> <voice-id> --name "<name>"`.
- New character: follow `skill/guides/new-character.md` (easy path first: three short questions, then `python tools/setup.py new-character ...`, then `python tools/setup.py preview-character <id>` and show the picture).
- New place: follow `skill/guides/new-world.md` (easy path first: `python tools/setup.py new-world ...`, then `python tools/setup.py preview-world <id>` and show the picture).
- If they have made their own character, that one is the default from now on, not the chicken.

## Step 5. Save the choices and make the command
- `python tools/setup.py init --format <portrait|landscape|square> --language <code> --provider <cartesia|elevenlabs> --characters <idLeft>,<idRight> --world <id>` (finished videos are copied to `~/Videos/video-3d` by default; add `--delivery <folder>` if the user names another one, and say in one bullet where they will find their videos)
- Install the slash command for the agent you are: `python tools/setup.py install-skill --agent <claude|codex|cursor|gemini|generic> --scope user`. (`generic` writes a file the user can hand to any agent.)
- If you are not sure how your agent loads custom commands, check its current documentation and place the generated file there; the content is the same.

## Step 6. A quick check that it draws
- `python tools/episode.py stills ep01-cuma-lima --at 8,33` (works without any key; it is the included demo). Look at `out/ep01-cuma-lima/stills/contact.png` and confirm it shows the characters. If the project does not use the demo characters, use `python tools/setup.py preview-world <world-id>` instead.
- Do NOT render a full video now (it takes a long time).

## Step 7. Final message to the user (bullets)
- It is ready. To make a video: type `/video-3d <what the video is about>` (restart the agent or open a new session if the command is not listed yet).
- What they set: characters, place, shape, voices from, dialogue language.
- Where videos are saved: the delivery folder (default `~/Videos/video-3d`; change it in `project.json` → `delivery.folder`); the working files stay in the tool folder.
- A video takes about half a minute of waiting per second of video; the first questions are asked once, later runs remember them.

## If something fails
- `skill/guides/build-qa-deliver.md` has a troubleshooting table.
- Re-running this setup is safe: `python tools/setup.py status` shows what already exists.
