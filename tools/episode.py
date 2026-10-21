"""The one command for the 3D dialogue videos. Repetitive work lives here, not in the agent's head.
   python tools/episode.py doctor [--smoke]        check this machine (Python, Node, ffmpeg, Chrome, keys) and say exactly how to fix what is missing
   python tools/episode.py new "<title>"           scaffold episodes/epNN-<slug>/ (script.json, episode.json)
   python tools/episode.py directions <slug>       fill episode.json "directions" with a default for every line (then edit by judgement)
   python tools/episode.py validate <slug>         the rules (project rules, light causes, files, durations)
   python tools/episode.py build <slug>            validate + voices + mouth + subtitles + sound effects + soundtrack
   python tools/episode.py stills <slug> [--at 3,12.5]   stills at every line (and the special moments) + a contact sheet
   python tools/episode.py render <slug>           all frames, in parallel chunks (resumable)
   python tools/episode.py encode <slug>           frames + audio + subtitles -> MP4 (the project's format, 30 fps, <= 30 MB)
   python tools/episode.py qa <slug>               checks the MP4 and makes a contact sheet
   python tools/episode.py video <slug>            render + encode + qa
   python tools/episode.py deliver <slug>          copy the MP4 to the delivery folder (project.json delivery.folder, or VIDEO3D_DRIVE)
   python tools/episode.py organize <slug>         out/<slug>/chosen (what was chosen) and not_chosen (the options that were not)
   python tools/episode.py voices [--provider cartesia|elevenlabs] [--language id]    list the voices an account can use
   python tools/episode.py characters              list the characters and worlds this kit has, and which ones the project uses
"""
import concurrent.futures as cf
import math
import os
import re
import shutil
import subprocess
import sys

from common import ASSETS, EPISODES, FPS, IS_WINDOWS, OUT, ROOT, Clock, character, characters, ep_dir, ffmpeg, fmt_sizes, gaps, has_key, load_json, out_dir, project, run, save_json, total_of, world

NUMBERS = re.compile(r"\d|\b(satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|belas|puluh|ratus|ribu|juta|miliar|one|two|three|four|five|six|seven|eight|nine|ten|hundred|thousand|million|billion)\b", re.I)
BRAND_WORDS = ["tesla", "iphone", "samsung", "apple", "nike", "adidas", "mcdonald", "starbucks", "netflix", "coca", "pepsi", "toyota", "honda", "bmw", "mercedes"]


def fail(msgs):
    for m in msgs:
        print("  ✗", m)
    sys.exit(f"{len(msgs)} problem(s). Fix them and run validate again.")


def shot_size(proj=None):
    w, h = fmt_sizes(proj)[0]
    return f"{int(w * 0.75)},{int(h * 0.75)}"   # stills are smaller than the render: they are for looking, not for posting


# ================================================================== doctor
def doctor(smoke=False):
    ok = True
    def line(good, what, fix=""):
        nonlocal ok
        print(f"  {'✓' if good else '✗'} {what}" + ("" if good else f"\n      -> {fix}"))
        ok = ok and good
    print("Checking this machine for the 3D dialogue videos")
    line(sys.version_info >= (3, 9), f"Python {sys.version.split()[0]}", "install Python 3.9 or newer")
    try:
        import numpy
        line(True, f"numpy {numpy.__version__}")
    except ImportError:
        line(False, "numpy", "pip install -r requirements.txt")
    try:
        import PIL
        line(True, f"Pillow {PIL.__version__} (only for the lighting diagrams)")
    except ImportError:
        print("  - Pillow missing (optional, only for lighting diagrams): pip install pillow")
    node = shutil.which("node")
    line(bool(node), "Node.js" + (f" {run(['node', '--version']).stdout.strip()}" if node else ""),
         {True: "winget install OpenJS.NodeJS", False: "Linux: sudo apt-get install -y nodejs   macOS: brew install node"}[IS_WINDOWS])
    ff = shutil.which("ffmpeg")
    line(bool(ff) and bool(shutil.which("ffprobe")), "ffmpeg + ffprobe",
         {True: "winget install Gyan.FFmpeg", False: "Linux: sudo apt-get install -y ffmpeg   macOS: brew install ffmpeg"}[IS_WINDOWS])
    if ff:
        filters = run(["ffmpeg", "-hide_banner", "-filters"]).stdout
        enc = run(["ffmpeg", "-hide_banner", "-encoders"]).stdout
        line(" ass " in filters or re.search(r"\bass\b", filters) is not None, "ffmpeg can burn subtitles (libass)", "use an ffmpeg build with libass (the 'full' build; on Linux apt ffmpeg has it)")
        line("libx264" in enc, "ffmpeg has libx264", "use an ffmpeg build with libx264")
    from browser import find_chrome
    ch = find_chrome()
    line(bool(ch), f"Chrome/Chromium ({ch})" if ch else "Chrome/Chromium",
         {True: "winget install Google.Chrome   (or set CHROME_BIN)", False: "Linux: sudo apt-get install -y chromium   (or google-chrome)   macOS: brew install --cask google-chrome"}[IS_WINDOWS])
    prov = project()["tts"]["provider"]
    key = {"cartesia": "CARTESIA_API_KEY", "elevenlabs": "ELEVENLABS_API_KEY"}[prov]
    if has_key(key):
        print(f"  ✓ {key} is set (voices from {prov})")
    else:
        print(f"  - {key} is not set: needed to make voices for NEW lines ({prov}). Put it in the environment or in .env (see .env.example). Takes that already exist need no key.")
    print("  - ELEVENLABS_API_KEY is " + ("set" if has_key("ELEVENLABS_API_KEY") else "not set") + ": optional, only to generate NEW sound effects (the bundled library works without it)")
    if not IS_WINDOWS:
        fc = shutil.which("fc-list")
        print("  - subtitle font: " + ("fontconfig found (uses DejaVu Sans; install fonts-dejavu if subtitles look empty)" if fc else "install fonts-dejavu so the subtitles have a font"))
    if smoke and ok:
        print("Smoke test: drawing one frame of the world in headless Chrome (software WebGL) ...")
        from browser import shot
        f = shot("doctor.png", "cam=wide", shot_size())
        line(f.exists() and f.stat().st_size > 20000, f"a frame was drawn: {f}", "Chrome could not draw WebGL; try CHROME_BIN=<another chrome> or a newer Chrome")
    print("READY" if ok else "NOT READY: fix the lines marked ✗")
    return ok


# ================================================================== scaffold
def slugify(s):
    s = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    return s or "episode"


def new(title):
    proj, W = project(), None
    W = world(proj)
    chars = characters(proj)
    EPISODES.mkdir(exist_ok=True)
    nums = [int(m.group(1)) for p in EPISODES.iterdir() if (m := re.match(r"ep(\d+)-", p.name))]
    n = (max(nums) + 1) if nums else 1
    slug = f"ep{n:02d}-{slugify(title)}"
    d = EPISODES / slug
    d.mkdir()
    a, b = chars[0]["id"], (chars[1]["id"] if len(chars) > 1 else chars[0]["id"])
    save_json(d / "script.json", [{"who": a, "text": "FIRST LINE", "gap": 0.3}, {"who": b, "text": "SECOND LINE", "gap": "normal"}])
    ep = {"title": title, "scene": {"light": proj["defaults"].get("light", "rembrandt")}, "tail": 4.0, "fadeOut": 1.3, "music": {"mood": proj["defaults"].get("music", "sad")},
          "screen": [], "directions": [], "lightEvents": [], "ending": {"turnAt": "end+0.5", "lookUpAt": "end+1.1", "yaw": 3.0, "pitch": -0.32, "expression": chars[0]["defaultExpression"]}, "facts": []}
    if W.get("backgrounds"):
        ep["scene"]["bg"] = proj["defaults"].get("bg", W.get("defaultBackground"))
    if W.get("features", {}).get("screen"):
        ep["pages"] = {"log": {"type": "code", "theme": "dark", "lines": [{"t": "> ...", "c": "#9CC4FF"}]}}
    if W.get("features", {}).get("outside"):
        ep["outside"] = {"type": "star", "at": "end+1.4", "dur": 3.0}   # a falling star by default; change it only when the user asks for another moment
    save_json(d / "episode.json", ep)
    print(f"created {d}\n  next: write script.json and episode.json, then: python tools/episode.py directions {slug}")
    return slug


def init_directions(slug):
    d = ep_dir(slug)
    script = load_json(d / "script.json")
    ep = load_json(d / "episode.json")
    chars = characters()
    idl = chars[0]["id"]
    dl, dr = chars[0]["defaultExpression"], (chars[1]["defaultExpression"] if len(chars) > 1 else None)
    ep["directions"] = [{"cam": "left" if ln["who"] == idl else "right", "left": dl, **({"right": dr} if dr else {})} for ln in script]
    save_json(d / "episode.json", ep)
    print(f"directions: a default for each of the {len(script)} lines (edit expressions, shots, looks, hops, turns by judgement)")


# ================================================================== validate
def strings_of(x):
    if isinstance(x, str):
        yield x
    elif isinstance(x, dict):
        for v in x.values():
            yield from strings_of(v)
    elif isinstance(x, list):
        for v in x:
            yield from strings_of(v)


def last_moment(slug):
    """The moment outside the window of the latest episode in episodes/LOG.md (first word, lowercase), so a new one can differ (only when rules.noRepeatOutside is on)."""
    f = EPISODES / "LOG.md"
    if not f.exists():
        return None
    m = re.match(r"ep(\d+)-", slug)
    mine = int(m.group(1)) if m else 10 ** 6
    rows = []
    for l in f.read_text(encoding="utf-8").splitlines():
        mm = re.match(r"\|\s*(\d+)\s*\|", l)
        if mm and int(mm.group(1)) < mine:   # only episodes made BEFORE this one
            rows.append(l)
    if not rows:
        return None
    cells = [c.strip() for c in rows[-1].strip().strip("|").split("|")]
    return cells[5].lower().split()[0] if len(cells) > 5 and cells[5] else None


def validate(slug, quiet=False, pre=False):   # pre: before the voices exist, so nothing that depends on timings is checked
    d = ep_dir(slug)
    errs, warns = [], []
    proj = project()
    R = proj["rules"]
    W = world(proj)
    F = W.get("features", {})
    chars = {c["id"]: c for c in characters(proj)}
    G = gaps()
    ids = list(chars)
    script = load_json(d / "script.json")
    ep = load_json(d / "episode.json")
    presets = load_json(ASSETS / "lighting" / "presets.json")["presets"]
    sfxlib = load_json(ASSETS / "sfx" / "library.json")["items"]
    # --- script
    if not script:
        errs.append("script.json is empty")
    for i, ln in enumerate(script):
        who = ln.get("who")
        if who not in chars:
            errs.append(f"line {i}: who must be one of {ids}")
            continue
        if not str(ln.get("text", "")).strip() or re.search(r"FIRST LINE|SECOND LINE|PLACEHOLDER", str(ln.get("text", ""))):
            errs.append(f"line {i}: the text is empty or still a placeholder")
        if ln.get("tone") and ln["tone"] not in chars[who]["tones"]:
            errs.append(f"line {i}: unknown tone '{ln['tone']}' for {who} ({', '.join(chars[who]['tones'])})")
        if isinstance(ln.get("gap"), str) and ln["gap"] not in G:
            errs.append(f"line {i}: unknown gap '{ln['gap']}' ({', '.join(G)})")
        if len(ln.get("text", "")) > 70:
            warns.append(f"line {i} is long ({len(ln['text'])} chars): short lines work better (3-8 words)")
    # --- project rules (all optional, off by default)
    for w in R.get("forbidWords", []):
        if any(re.search(re.escape(w), s, re.I) for s in list(strings_of(script)) + list(strings_of(ep))):
            errs.append(f"the word '{w}' appears, and project.json rules.forbidWords forbids it")
    has = None
    if R.get("requirePhrases"):
        has = [ln["text"] for ln in script if any(p.lower() in ln.get("text", "").lower() for p in R["requirePhrases"])]
        if not has:
            errs.append("no line has one of the required catchphrases: " + " | ".join(f'"{p}"' for p in R["requirePhrases"]))
    # --- episode.json basics
    lines = [{"start": 0, "end": 1}] * len(script)
    tj = d / "timings.json"
    if tj.exists() and not pre:
        lines = load_json(tj)
        if len(lines) != len(script):
            errs.append("timings.json is out of date (run build)")
    total = total_of(ep, lines)
    _clock = Clock(lines, total)

    def clock(x, default=0.0):
        try:
            return _clock(x, default)
        except ValueError as e:
            errs.append(f"time reference: {e}")
            return 0.0

    bg = ep.get("scene", {}).get("bg")
    if W.get("backgrounds") and bg and bg not in W["backgrounds"]:
        errs.append(f"unknown background '{bg}' ({', '.join(sorted(W['backgrounds']))})")
    base_light = ep.get("scene", {}).get("light", "rembrandt")
    if base_light not in presets:
        errs.append(f"unknown light preset '{base_light}' ({', '.join(presets)})")
    dirs = ep.get("directions", [])
    if len(dirs) != len(script):
        errs.append(f"directions has {len(dirs)} entries but the script has {len(script)} lines (python tools/episode.py directions {slug})")
    shots = set(W.get("builtinShots", ["wide", "left", "right", "right34"])) | set(ep.get("shots", {}))
    pages = ep.get("pages", {})
    for k, p in pages.items():
        if p.get("type") not in W.get("pageTypes", []):
            errs.append(f"page '{k}': type must be one of {sorted(W.get('pageTypes', []))}" + ("" if F.get("screen") else " (this world has no screen: remove pages)"))
        if p.get("theme", "dark") not in W.get("themes", ["dark"]):
            errs.append(f"page '{k}': theme must be one of {sorted(W.get('themes', []))}")
        if p.get("type") == "image" and not (ROOT / p.get("src", "@@")).exists():
            errs.append(f"page '{k}': image '{p.get('src')}' not found (path relative to the kit folder)")
    exprs = [set(c["expressions"]) for c in characters(proj)]
    for i, x in enumerate(dirs):
        if x.get("cam") and x["cam"] not in shots:
            errs.append(f"directions[{i}]: unknown shot '{x['cam']}' ({sorted(shots)})")
        for k, side in (("left", 0), ("right", 1)):
            if x.get(k) and side < len(exprs) and x[k] not in exprs[side]:
                errs.append(f"directions[{i}]: unknown {k} expression '{x[k]}' for {ids[side]} ({sorted(exprs[side])})")
    for c in ep.get("camExtra", []):
        if c.get("cam") not in shots:
            errs.append(f"camExtra: unknown shot '{c.get('cam')}'")
    if ep.get("screen") and not F.get("screen"):
        errs.append("this world has no screen: remove 'screen' and 'pages'")
    screen_times = []
    for s in ep.get("screen", []):
        if s.get("page") not in pages:
            errs.append(f"screen: page '{s.get('page')}' is not defined in pages")
        try:
            screen_times.append(clock(s["at"]))
        except Exception as e:
            errs.append(f"screen: {e}")
    # --- every change of light needs a visible cause
    if pre:
        ep = {**ep, "lightEvents": [], "phone": ep.get("phone") and {**ep["phone"], "at": 0}, "outside": ep.get("outside") and {**ep["outside"], "at": 0}, "screen": []}
        screen_times = []
    causes = [(t - 0.3, t + 1.2, "screen change") for t in screen_times]
    for i, x in enumerate(dirs):
        if "turn" in x and i < len(lines):
            causes.append((lines[i]["start"] - 0.3, lines[i]["start"] + 1.5, "a character turns"))
    for e in ep.get("lightEvents", []):
        if e.get("type") == "flicker":
            causes.append((clock(e["at"]) - 0.1, clock(e["at"]) + e.get("dur", 1.7), "lamp flicker"))
    if ep.get("phone"):
        if not F.get("phone"):
            errs.append("this world has no phone: remove 'phone'")
        p0 = clock(ep["phone"]["at"]); causes.append((p0 - 0.1, p0 + ep["phone"].get("rise", 0.65) + 0.6, "phone rises"))
    if ep.get("outside"):
        if not F.get("outside"):
            errs.append("this world has no moment outside: remove 'outside'")
        o0 = clock(ep["outside"]["at"]); causes.append((o0 - 0.1, o0 + ep["outside"].get("dur", 3.0), "moment outside"))
        o = ep["outside"]
        if F.get("outside") and o.get("type") not in W.get("outsideTypes", []):
            errs.append(f"outside.type must be one of {sorted(W.get('outsideTypes', []))}")
        if o.get("type") == "sprite" and not (ROOT / o.get("image", "@@")).exists():
            errs.append(f"outside.image '{o.get('image')}' not found (a transparent PNG; path relative to the kit folder)")
        if not pre and R.get("confirmOutside") and o.get("confirmed") is not True:
            errs.append("rules.confirmOutside is on: ask the user which moment outside they want and set outside.confirmed to true")
        if not pre and R.get("noRepeatOutside"):
            last = last_moment(slug)
            key = str(o.get("label") or o.get("type")).strip().lower().split()[0]
            if last and key == last and not o.get("repeatOk"):
                errs.append(f"the moment outside ('{key}') is the same as the previous episode (rules.noRepeatOutside; see episodes/LOG.md)")
    strict = W.get("lightCauseCheck", "strict") == "strict"
    for i, e in enumerate(ep.get("lightEvents", [])):
        if e.get("type") not in ("flicker", "level", "preset"):
            errs.append(f"lightEvents[{i}]: type must be flicker, level or preset"); continue
        if not str(e.get("cause", "")).strip():
            errs.append(f"lightEvents[{i}]: 'cause' is required (what in the scene makes the light change)")
        if e.get("role", "key") not in W.get("lightRoles", ["key", "rim", "fill", "hemi"]):
            errs.append(f"lightEvents[{i}]: unknown role '{e.get('role')}'")
        if e["type"] == "preset" and e.get("to") not in presets:
            errs.append(f"lightEvents[{i}]: unknown preset '{e.get('to')}'")
        if strict and e["type"] in ("level", "preset"):
            t = clock(e["at"])
            if not any(a <= t <= b for a, b, _ in causes):
                errs.append(f"lightEvents[{i}] at {t:.1f}s has no visible cause within 1 s (a screen change, a lamp flicker, the phone, a moment outside, or a character turning): every change of light needs a cause the viewer can see")
    # --- the phone, props, pictures, sound effects
    if ep.get("phone") and not (ROOT / ep["phone"].get("image", "@@")).exists():
        errs.append(f"phone.image '{ep['phone'].get('image')}' not found")
    for w in ep.get("wall", []):
        if not (ROOT / w.get("src", "@@")).exists():
            errs.append(f"wall image '{w.get('src')}' not found")
    for p in ep.get("props", []):
        if p.get("type") not in W.get("propTypes", []):
            errs.append(f"unknown prop '{p.get('type')}' ({sorted(W.get('propTypes', []))})")
    for s in ep.get("sfx", []):
        if s.get("file"):
            if not (ROOT / s["file"]).exists():
                errs.append(f"sfx file '{s['file']}' not found (path relative to the kit folder)")
        elif s.get("name") not in sfxlib:
            errs.append(f"sfx '{s.get('name')}' is not in assets/sfx/library.json (or give a \"file\")")
    if ep.get("music", {}).get("file") and not (ROOT / ep["music"]["file"]).exists():
        errs.append(f"music file '{ep['music']['file']}' not found")
    for p in ep.get("screen", []):
        if p.get("sfx") and p["sfx"] not in sfxlib:
            errs.append(f"screen sfx '{p['sfx']}' is not in assets/sfx/library.json")
    if not ep.get("music", {}).get("file") and ep.get("music", {}).get("mood", "sad") not in ("sad", "calm", "cheerful"):
        errs.append("music.mood must be sad, calm or cheerful")
    # --- facts and brands
    if R.get("numbersNeedFacts") and any(NUMBERS.search(ln.get("text", "")) for ln in script) and not ep.get("facts"):
        errs.append("the script uses numbers but episode.json has no 'facts': list each number/claim with its source")
    low = " ".join(strings_of(ep)).lower() + " " + " ".join(l.get("text", "") for l in script).lower()
    hit = [b for b in BRAND_WORDS if re.search(r"\b" + b, low)]
    if hit:
        warns.append("real brand names appear: " + ", ".join(hit) + " (avoid real brands on screen)")
    hint = R.get("durationHint") or []
    if not pre and len(hint) == 2 and not hint[0] <= total <= hint[1]:
        warns.append(f"the video is {total:.0f} s; the project aims at {hint[0]}-{hint[1]} s (fine if the story needs it)")
    if not quiet:
        for w in warns:
            print("  !", w)
    if errs:
        fail(errs)
    if not quiet:
        print(f"validate: OK ({len(script)} lines, {total:.0f} s" + (f", catchphrase: {has[0]!r}" if has else "") + ")")
    return True


# ================================================================== build
def build(slug):
    py = sys.executable
    validate(slug, quiet=True, pre=True)
    for step in (["dialog.py", slug], ["derive.py", slug]):
        subprocess.run([py, str(ROOT / "tools" / step[0]), *step[1:]], check=True, cwd=ROOT / "tools")
    validate(slug)
    for step in (["audio.py", slug, "--sfx"], ["audio.py", slug]):
        subprocess.run([py, str(ROOT / "tools" / step[0]), *step[1:]], check=True, cwd=ROOT / "tools")


# ================================================================== stills and render
def sheet(files, dst, cols=8, width=240):
    inputs = []
    for f in files:
        inputs += ["-i", str(f)]
    rows = math.ceil(len(files) / cols)
    probe = run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", str(files[0])]).stdout.strip().split(",")
    cell_h = int(width * int(probe[1]) / int(probe[0]))
    fc = ";".join(f"[{i}:v]scale={width}:-1[v{i}]" for i in range(len(files))) + ";" + "".join(f"[v{i}]" for i in range(len(files))) + f"xstack=inputs={len(files)}:layout=" + "|".join(f"{(i % cols) * width}_{(i // cols) * cell_h}" for i in range(len(files)))
    ffmpeg(*inputs, "-filter_complex", fc, "-frames:v", 1, dst)


def stills(slug, at=None):
    from browser import shot
    d = ep_dir(slug)
    ep = load_json(d / "episode.json")
    lines = load_json(d / "timings.json")
    total = total_of(ep, lines)
    clock = Clock(lines, total)
    if at:
        times = [float(x) for x in at.split(",")]
    else:
        times = [round(ln["start"] + 0.6 * (ln["end"] - ln["start"]), 2) for ln in lines]
        if ep.get("phone"):
            times.append(round(clock(ep["phone"]["at"]) + 1.0, 2))
        if ep.get("outside"):
            times.append(round(clock(ep["outside"]["at"]) + ep["outside"].get("dur", 3.0) * 0.5, 2))
        times.append(round(total - 1.5, 2))
    sd = out_dir(slug) / "stills"
    shutil.rmtree(sd, ignore_errors=True)
    sd.mkdir(parents=True)
    names = [f"s{i:02d}_{t:05.1f}.png" for i, t in enumerate(times)]
    size = shot_size()
    with cf.ThreadPoolExecutor(max_workers=3) as ex:
        list(ex.map(lambda a: shot(a[0], f"ep={slug}&t={a[1]}", size), zip(names, times)))
    for n in names:
        shutil.move(str(OUT / "shots" / n), sd / n)
    sheet([sd / n for n in names], sd / "contact.png", cols=8 if project()["format"] == "portrait" else 4)
    print(f"stills: {len(names)} -> {sd / 'contact.png'}")
    return sd / "contact.png"


def render(slug):
    from browser import capture
    d = ep_dir(slug)
    ep = load_json(d / "episode.json")
    lines = load_json(d / "timings.json")
    total = total_of(ep, lines)
    n = math.ceil(total * FPS)
    fd = out_dir(slug) / "frames"
    missing = [i for i in range(n) if not (fd / f"f_{i:04d}.png").exists()]
    if not missing:
        print(f"render: all {n} frames already exist"); return
    workers = int(os.environ.get("VIDEO3D_WORKERS", max(1, min(4, (os.cpu_count() or 4) // 2))))
    rw, rh = fmt_sizes()[0]
    size = os.environ.get("VIDEO3D_SIZE", f"{rw},{rh}")
    # chunks of contiguous missing frames, split among the workers
    first, last = missing[0], missing[-1]
    step = math.ceil((last - first + 1) / workers)
    chunks = [(first + i * step, min(last, first + (i + 1) * step - 1)) for i in range(workers) if first + i * step <= last]
    print(f"render: {len(missing)} of {n} frames missing, {len(chunks)} workers at {size} (software WebGL, about 2 frames/s per worker)")
    with cf.ThreadPoolExecutor(max_workers=len(chunks)) as ex:
        for res in ex.map(lambda c: capture(slug, c[0], c[1], size), chunks):
            print("  chunk done:", res)
    left = [i for i in range(n) if not (fd / f"f_{i:04d}.png").exists()]
    if left:
        sys.exit(f"{len(left)} frames are still missing (run render again; it resumes): first {left[:5]}")
    print(f"render: {n} frames")


def mp4_name(slug):
    m = re.match(r"ep(\d+)-(.*)", slug)
    base = f"Ep{m.group(1)}_{'_'.join(w.capitalize() for w in m.group(2).split('-'))}"
    v = 1
    while (out_dir(slug) / f"{base}_v{v}.mp4").exists():
        v += 1
    return out_dir(slug) / f"{base}_v{v}.mp4", base


def encode(slug, max_mb=30):
    d = ep_dir(slug)
    o = out_dir(slug)
    ep = load_json(d / "episode.json")
    lines = load_json(d / "timings.json")
    n = math.ceil(total_of(ep, lines) * FPS)
    fw, fh = fmt_sizes()[1]
    enc = o / "enc"
    shutil.rmtree(enc, ignore_errors=True)
    enc.mkdir()
    shutil.copy(d / "subs.ass", enc / "subs.ass")
    vf = f"scale={fw}:{fh}:flags=lanczos,unsharp=5:5:0.25,ass=subs.ass"
    if IS_WINDOWS:
        (enc / "fonts").mkdir()
        for f in ("seguisb.ttf", "segoeui.ttf"):
            src = os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Fonts", f)
            if os.path.exists(src):
                shutil.copy(src, enc / "fonts" / f)
        vf += ":fontsdir=fonts"
    vf += ",format=yuv420p"
    dst, base = mp4_name(slug)
    for crf, maxrate in ((19, "8M"), (22, "6M"), (25, "4M"), (28, "3M")):   # raise the compression until it is small enough for social media
        cmd = ["ffmpeg", "-loglevel", "error", "-y", "-framerate", str(FPS), "-i", str(o / "frames" / "f_%04d.png"), "-i", str(o / "audio.wav"), "-frames:v", str(n), "-vf", vf,
               "-c:v", "libx264", "-preset", "medium", "-crf", str(crf), "-maxrate", maxrate, "-bufsize", str(int(maxrate[:-1]) * 2) + "M", "-c:a", "aac", "-b:a", "160k", "-r", str(FPS), "-shortest", "-movflags", "+faststart", str(dst)]
        run(cmd, cwd=enc)
        mb = dst.stat().st_size / 1048576
        print(f"encode: crf {crf} -> {mb:.1f} MB")
        if mb <= max_mb:
            break
    print(f"encode: {dst}")
    return dst


def latest_mp4(slug):
    files = sorted(out_dir(slug).glob("Ep*_v*.mp4"), key=lambda p: p.stat().st_mtime)
    if not files:
        sys.exit("no MP4 yet (run encode)")
    return files[-1]


def qa(slug):
    f = latest_mp4(slug)
    d = ep_dir(slug)
    ep = load_json(d / "episode.json")
    lines = load_json(d / "timings.json")
    total = total_of(ep, lines)
    fw, fh = fmt_sizes()[1]
    info = run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_name,width,height,r_frame_rate,duration", "-of", "default=nw=1", str(f)]).stdout
    vol = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(f), "-af", "volumedetect", "-vn", "-f", "null", "-"], capture_output=True, text=True).stderr
    mean = float(re.search(r"mean_volume: (-?[\d.]+)", vol).group(1)); peak = float(re.search(r"max_volume: (-?[\d.]+)", vol).group(1))
    w = int(re.search(r"width=(\d+)", info).group(1)); h = int(re.search(r"height=(\d+)", info).group(1))
    dur = float(re.findall(r"duration=([\d.]+)", info)[0])
    mb = f.stat().st_size / 1048576
    bad = []
    if (w, h) != (fw, fh): bad.append(f"size is {w}x{h}, not {fw}x{fh}")
    if abs(dur - total) > 0.5: bad.append(f"duration {dur:.1f}s differs from the plan {total:.1f}s")
    if mb > 30: bad.append(f"{mb:.1f} MB is over 30 MB")
    if mean < -30 or mean > -12: bad.append(f"mean volume {mean} dB is off (expect about -20)")
    if peak > -1: bad.append(f"peak {peak} dB is too hot")
    sd = out_dir(slug) / "qa"
    shutil.rmtree(sd, ignore_errors=True); sd.mkdir()
    ffmpeg("-i", f, "-vf", f"fps=1/4,scale=240:-1,tile=8x2", "-frames:v", 1, sd / "contact.png")
    print(f"qa: {f.name}: {w}x{h}, {dur:.1f}s, {mb:.1f} MB, mean {mean} dB, peak {peak} dB -> contact sheet {sd / 'contact.png'}")
    if bad:
        fail(bad)
    print("qa: OK (still LOOK at the contact sheet: noise, cut-off tails, subtitles over bright areas)")


def deliver(slug):
    f = latest_mp4(slug)
    dest = os.environ.get("VIDEO3D_DRIVE") or project().get("delivery", {}).get("folder", "")
    if not dest:
        print(f"deliver: no delivery folder set (project.json delivery.folder, or VIDEO3D_DRIVE); the MP4 stays at {f}")
        return
    if not os.path.isdir(os.path.dirname(dest.rstrip("\\/")) or "."):
        print(f"deliver: the folder {dest} is not available here; the MP4 stays at {f}")
        return
    os.makedirs(dest, exist_ok=True)
    shutil.copy2(f, os.path.join(dest, f.name))
    print(f"deliver: copied to {os.path.join(dest, f.name)}")


def organize(slug):
    d = ep_dir(slug)
    o = out_dir(slug)
    chosen, rest = o / "chosen", o / "not_chosen"
    chosen.mkdir(exist_ok=True)
    for f in ("script.json", "episode.json", "timings.json", "subs.ass", "dialog.mp3"):
        shutil.copy2(d / f, chosen / f)
    for f in o.glob("Ep*_v*.mp4"):
        shutil.copy2(f, chosen / f.name)
    opt = o / "options"
    if opt.is_dir():
        rest.mkdir(exist_ok=True)
        for f in opt.iterdir():
            shutil.move(str(f), rest / f.name)
    print(f"organize: {chosen} (chosen) and {rest} (options not chosen, kept)")


def list_assets():
    proj = project()
    print("characters (the project uses: " + ", ".join(proj["characters"]) + ")")
    for p in sorted((ROOT / "characters").iterdir()):
        if (p / "character.json").exists():
            c = load_json(p / "character.json")
            print(f"  {c['id']:<14} {c['name']}  expressions: {', '.join(c['expressions'])}")
    print(f"worlds (the project uses: {proj['world']})")
    for p in sorted((ROOT / "worlds").iterdir()):
        if (p / "world.json").exists():
            w = load_json(p / "world.json")
            print(f"  {w['id']:<14} {w['name']}: {w['description'][:90]}")


if __name__ == "__main__":
    a = sys.argv[1:]
    if not a or a[0] in ("-h", "--help"):
        sys.exit(__doc__)
    cmd, args = a[0], a[1:]
    if cmd == "doctor": sys.exit(0 if doctor("--smoke" in args) else 1)
    elif cmd == "new": new(" ".join(args))
    elif cmd == "directions": init_directions(args[0])
    elif cmd == "validate": validate(args[0])
    elif cmd == "build": build(args[0])
    elif cmd == "stills": stills(args[0], args[args.index("--at") + 1] if "--at" in args else None)
    elif cmd == "render": render(args[0])
    elif cmd == "encode": encode(args[0])
    elif cmd == "qa": qa(args[0])
    elif cmd == "video": render(args[0]); encode(args[0]); qa(args[0])
    elif cmd == "deliver": deliver(args[0])
    elif cmd == "organize": organize(args[0])
    elif cmd == "voices":
        sys.argv = ["tts.py", "voices", *args]
        import runpy
        runpy.run_path(str(ROOT / "tools" / "tts.py"), run_name="__main__")
    elif cmd == "characters": list_assets()
    else: sys.exit(f"unknown command '{cmd}'\n{__doc__}")
