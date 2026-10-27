"""Setup helper for the kit. An AI agent calls these after it has asked the user a few short questions (AGENT_SETUP.md says which).
   python tools/setup.py status                          what exists and what is missing (JSON), so a setup can resume
   python tools/setup.py init --format portrait|landscape|square --language <code> --provider cartesia|elevenlabs --characters <idLeft>,<idRight> --world <id> [--music sad|calm|cheerful] [--delivery <folder>]
   python tools/setup.py new-character <id> --name "..." [--role "..."] [--body-color #hex --belly-color #hex --accent-color #hex --ears none|round|pointy --tail yes|no --width 0.85 --height 0.85]
   python tools/setup.py new-world <id> --name "..." [--sky-top #hex --sky-bottom #hex --ground #hex --trees N --moon yes|no]
   python tools/setup.py set-voice <character-id> <provider> <voice-id> [--name "..."]
   python tools/setup.py preview-character <id> [--with <other-id>]      6 expression stills as one picture (out/previews/character_<id>.png)
   python tools/setup.py preview-world <id> [--chars <a>,<b>]            3 camera shots as one picture (out/previews/world_<id>.png)
   python tools/setup.py install-skill --agent claude|codex|cursor|gemini|generic [--scope user|project] [--dir <path>] [--command video-3d|video-3d-toons|all]
   python tools/setup.py remember [--format ..] [--length ..] [--mood ..] [--characters a,b] [--world id]     keep the answers as the defaults for next time
Nothing here ever asks for or stores an API key: the user puts keys in .env themselves (see .env.example)."""
import json
import re
import shutil
import sys
from pathlib import Path

from common import FORMATS, ROOT, has_key, load_json, project, save_json

TEMPLATE_SKILL = ROOT / "skill" / "SKILL.template.md"
TEMPLATE_TOONS = ROOT / "skill" / "SKILL.toons.template.md"
COMMANDS = {"video-3d": TEMPLATE_SKILL, "video-3d-toons": TEMPLATE_TOONS}   # slash command name -> its template


def arg(a, name, default=None):
    return a[a.index(name) + 1] if name in a else default


def slug_ok(s):
    if not re.fullmatch(r"[a-z][a-z0-9-]{1,30}", s or ""):
        sys.exit(f"'{s}' is not a good id: use lowercase letters, digits and dashes (for example 'bobo' or 'night-forest')")
    return s


def dirs(kind):
    base = ROOT / kind
    return sorted(p for p in base.iterdir() if p.is_dir() and not p.name.startswith("_") and (p / ("character.json" if kind == "characters" else "world.json")).exists())


# ------------------------------------------------------------------ status
def status():
    pf = ROOT / "project.json"
    out = {"kit": str(ROOT), "projectExists": pf.exists(), "keys": {"CARTESIA_API_KEY": has_key("CARTESIA_API_KEY"), "ELEVENLABS_API_KEY": has_key("ELEVENLABS_API_KEY")}}
    if pf.exists():
        p = project()
        out["project"] = {k: p.get(k) for k in ("format", "language", "characters", "world")}
        out["project"]["provider"] = p["tts"]["provider"]
        out["project"]["defaults"] = p["defaults"]
    out["characters"] = []
    for d in dirs("characters"):
        c = load_json(d / "character.json")
        out["characters"].append({"id": c["id"], "name": c["name"], "voiceReady": {pr: bool((c["voice"].get(pr) or {}).get("id")) for pr in ("cartesia", "elevenlabs")}})
    out["worlds"] = [{"id": load_json(d / "world.json")["id"], "name": load_json(d / "world.json")["name"]} for d in dirs("worlds")]
    out["skillTemplate"] = TEMPLATE_SKILL.exists()
    print(json.dumps(out, indent=1, ensure_ascii=False))


# ------------------------------------------------------------------ init
def init(a):
    fmt, prov = arg(a, "--format", "portrait"), arg(a, "--provider", "cartesia")
    if fmt not in FORMATS:
        sys.exit(f"--format must be one of {sorted(FORMATS)}")
    if prov not in ("cartesia", "elevenlabs"):
        sys.exit("--provider must be cartesia or elevenlabs")
    chars = (arg(a, "--characters") or "ayam,claude").split(",")
    for c in chars:
        if not (ROOT / "characters" / c / "character.json").exists():
            sys.exit(f"character '{c}' does not exist (python tools/episode.py characters)")
    world = arg(a, "--world", "bedroom")
    if not (ROOT / "worlds" / world / "world.json").exists():
        sys.exit(f"world '{world}' does not exist (python tools/episode.py characters)")
    p = load_json(ROOT / "project.example.json")
    p.pop("_note", None)
    p.update({"format": fmt, "language": arg(a, "--language", "id"), "characters": chars, "world": world})
    p["tts"]["provider"] = prov
    p["defaults"]["music"] = arg(a, "--music", p["defaults"].get("music", "sad"))
    vids = Path.home() / "Videos"
    p["delivery"]["folder"] = arg(a, "--delivery") or str((vids if vids.exists() else Path.home()) / "video-3d")   # where finished videos are copied
    save_json(ROOT / "project.json", p)
    print(f"project.json written: {fmt}, {p['language']}, voices from {prov}, characters {', '.join(chars)}, world {world}")
    key = {"cartesia": "CARTESIA_API_KEY", "elevenlabs": "ELEVENLABS_API_KEY"}[prov]
    if not has_key(key):
        print(f"next: the user adds {key} to the .env file (copy .env.example to .env). Never ask them to paste the key in the chat.")
    for c in chars:
        cj = load_json(ROOT / "characters" / c / "character.json")
        if not (cj["voice"].get(prov) or {}).get("id"):
            print(f"next: '{c}' needs a {prov} voice: python tools/episode.py voices --provider {prov} --language {p['language']}  then  python tools/setup.py set-voice {c} {prov} <voice-id>")


# ------------------------------------------------------------------ new character / world
def new_character(a):
    cid = slug_ok(a[0])
    dst = ROOT / "characters" / cid
    if dst.exists():
        sys.exit(f"characters/{cid} already exists")
    shutil.copytree(ROOT / "characters" / "_template", dst)
    cj = load_json(dst / "character.json")
    cj["id"] = cid
    cj["name"] = arg(a, "--name", cid)
    if arg(a, "--role"):
        cj["role"] = arg(a, "--role")
    look = cj["look"]
    for flag, key in (("--body-color", "bodyColor"), ("--belly-color", "bellyColor"), ("--accent-color", "accentColor"), ("--eye-color", "eyeColor")):
        if arg(a, flag):
            look[key] = arg(a, flag)
    for flag, key in (("--width", "width"), ("--height", "height")):
        if arg(a, flag):
            look[key] = float(arg(a, flag))
    if arg(a, "--ears"):
        look["ears"] = arg(a, "--ears")
    if arg(a, "--tail"):
        look["tail"] = arg(a, "--tail") == "yes"
    save_json(dst / "character.json", cj)
    print(f"characters/{cid} created. next: set its voice (set-voice), then: python tools/setup.py preview-character {cid}")


def new_world(a):
    wid = slug_ok(a[0])
    dst = ROOT / "worlds" / wid
    if dst.exists():
        sys.exit(f"worlds/{wid} already exists")
    shutil.copytree(ROOT / "worlds" / "_template", dst)
    wj = load_json(dst / "world.json")
    wj["id"] = wid
    wj["name"] = arg(a, "--name", wid)
    look = wj["look"]
    for flag, key in (("--sky-top", "skyTop"), ("--sky-bottom", "skyBottom"), ("--ground", "groundColor")):
        if arg(a, flag):
            look[key] = arg(a, flag)
    if arg(a, "--trees"):
        look["trees"] = int(arg(a, "--trees"))
    if arg(a, "--moon") == "no":
        look["sun"] = None
    save_json(dst / "world.json", wj)
    print(f"worlds/{wid} created. next: python tools/setup.py preview-world {wid}")


def set_voice(a):
    cid, prov, vid = a[0], a[1], a[2]
    f = ROOT / "characters" / cid / "character.json"
    cj = load_json(f)
    if prov not in ("cartesia", "elevenlabs"):
        sys.exit("provider must be cartesia or elevenlabs")
    cj["voice"].setdefault(prov, {}).update({"id": vid, "name": arg(a, "--name", cj["voice"].get(prov, {}).get("name"))})
    save_json(f, cj)
    print(f"{cid}: {prov} voice set to {vid}")


# ------------------------------------------------------------------ previews (scripted, so the agent does not do it by hand)
def preview_character(a):
    from browser import shot
    from episode import sheet
    cid = a[0]
    cj = load_json(ROOT / "characters" / cid / "character.json")
    other = arg(a, "--with") or next((c for c in project()["characters"] if c != cid), "claude")
    names = []
    for i, e in enumerate(cj["expressions"][:8]):
        n = f"pv_{cid}_{i}.png"
        shot(n, f"chars={cid},{other}&cam=left&left={e}&t=3&world={project()['world']}", "405,720")
        names.append(ROOT / "out" / "shots" / n)
    dst = ROOT / "out" / "previews" / f"character_{cid}.png"
    dst.parent.mkdir(parents=True, exist_ok=True)
    sheet(names, dst, cols=4, width=300)
    print(f"preview: {dst}  (expressions, left to right: {', '.join(cj['expressions'][:8])})")


def preview_world(a):
    from browser import shot
    from episode import sheet
    wid = a[0]
    chars = arg(a, "--chars") or ",".join(project()["characters"])
    names = []
    for i, cam in enumerate(("wide", "left", "right34")):
        n = f"pv_{wid}_{i}.png"
        shot(n, f"world={wid}&chars={chars}&cam={cam}&t=3", "405,720")
        names.append(ROOT / "out" / "shots" / n)
    dst = ROOT / "out" / "previews" / f"world_{wid}.png"
    dst.parent.mkdir(parents=True, exist_ok=True)
    sheet(names, dst, cols=3, width=300)
    print(f"preview: {dst}  (shots: wide, left, right34)")


# ------------------------------------------------------------------ the slash command
def install_skill(a):
    """Writes the slash commands: /video-3d and /video-3d-toons (both by default; --command video-3d|video-3d-toons|all)."""
    which = arg(a, "--command", "all")
    names = list(COMMANDS) if which == "all" else [which]
    for nm in names:
        if nm not in COMMANDS:
            sys.exit(f"unknown command '{nm}' (video-3d, video-3d-toons, all)")
        if not COMMANDS[nm].exists():
            sys.exit(f"{COMMANDS[nm].relative_to(ROOT)} is missing")
    agent = arg(a, "--agent", "claude")
    scope = arg(a, "--scope", "user")
    base = Path(arg(a, "--dir")).expanduser() if arg(a, "--dir") else (Path.home() if scope == "user" else Path.cwd())
    kit = str(ROOT).replace("\\", "/")
    args_word = {"claude": "$ARGUMENTS", "codex": "$ARGUMENTS", "cursor": "(whatever the user typed after the command)", "gemini": "{{args}}", "generic": "(whatever the user typed after the command)"}[agent]
    for nm in names:
        text = COMMANDS[nm].read_text(encoding="utf-8")
        body = text.split("<!-- BODY -->", 1)[1].strip()
        desc = re.search(r"^description:\s*(.+)$", text, re.M).group(1).strip()
        body = body.replace("{{KIT}}", kit).replace("{{ARGS}}", args_word)
        if agent == "claude":
            dst = base / ".claude" / "skills" / nm / "SKILL.md"
            content = f"---\nname: {nm}\ndescription: {desc}\n---\n\n{body}\n"
        elif agent == "codex":
            dst = base / ".codex" / "prompts" / f"{nm}.md"
            content = f"---\ndescription: {desc}\nargument-hint: [topic]\n---\n\n{body}\n"
        elif agent == "cursor":
            dst = base / ".cursor" / "commands" / f"{nm}.md"
            content = body + "\n"
        elif agent == "gemini":
            dst = base / ".gemini" / "commands" / f"{nm}.toml"
            content = f'description = "{desc}"\nprompt = """\n{body}\n"""\n'
        else:
            dst = ROOT / "skill" / f"{nm}.installed.md"
            content = body + "\n"
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_text(content, encoding="utf-8")
        print(f"slash command written: {dst}")
    how = {"claude": "the user types /{n} <topic> (restart the agent or open a new session if it does not show up)",
           "codex": "the user types /{n} <topic> in a new Codex session",
           "cursor": "the user types /{n} <topic> in Cursor's chat",
           "gemini": "the user types /{n} <topic> in a new Gemini CLI session",
           "generic": "tell the user to give their agent the file when they want a video"}[agent]
    print("; ".join(how.format(n=nm) for nm in names))


def remember(a):
    f = ROOT / "project.json"
    if not f.exists():
        sys.exit("no project.json yet (run init first)")
    p = project()
    d = p["defaults"]
    for k in ("format", "length", "mood"):
        if arg(a, "--" + k):
            d["lastFormat" if k == "format" else k] = arg(a, "--" + k)
    if arg(a, "--format"):
        p["format"] = arg(a, "--format")
    if arg(a, "--characters"):
        p["characters"] = arg(a, "--characters").split(",")
    if arg(a, "--world"):
        p["world"] = arg(a, "--world")
    if arg(a, "--mood"):
        d["music"] = arg(a, "--mood")
    save_json(f, p)
    print("remembered:", json.dumps({"format": p["format"], "characters": p["characters"], "world": p["world"], "defaults": d}, ensure_ascii=False))


if __name__ == "__main__":
    a = sys.argv[1:]
    if not a or a[0] in ("-h", "--help"):
        sys.exit(__doc__)
    cmd, rest = a[0], a[1:]
    if cmd == "status": status()
    elif cmd == "init": init(rest)
    elif cmd == "new-character": new_character(rest)
    elif cmd == "new-world": new_world(rest)
    elif cmd == "set-voice": set_voice(rest)
    elif cmd == "preview-character": preview_character(rest)
    elif cmd == "preview-world": preview_world(rest)
    elif cmd == "install-skill": install_skill(rest)
    elif cmd == "remember": remember(rest)
    else: sys.exit(f"unknown command '{cmd}'\n{__doc__}")
