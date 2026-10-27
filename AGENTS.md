# video-3d-kit: instructions for AI agents

- If the user only shared this repo's link (even just with "setup"), the intent is always: install the kit as a tool and create the `/video-3d` command (AGENT_SETUP.md).
- This repo is a kit for making short 3D videos where two characters talk. The user wants to use it through a `/video-3d <topic>` command.
- FIRST TIME (no `project.json` in this folder): read `AGENT_SETUP.md` now and follow it. Do not just describe the repo. This kit is a tool: it is installed once at `~/.video-3d-kit`, not made into the user's project and not written into their current folder.
- LATER (`project.json` exists) and the user asks for a video: read `skill/SKILL.template.md` and follow its "How you talk to the user", questions and build steps (the installed `/video-3d` command has the same content). If the user gives a video of a screen and wants the characters to explain it, that is `/video-3d-toons`: read `skill/SKILL.toons.template.md` and `skill/guides/toons-playbook.md` (the installed `/video-3d-toons` command has the same content).
- Always: reply in the user's language, short bullet points, one batch of questions with a default marked ★, never ask for API keys in the chat (they go in `.env`), never commit `.env`, `project.json`, `out/` or MP4 files.
