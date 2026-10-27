"""Toons: the two characters talk OVER a video that already exists (a phone or PC screen recording, a real video) and explain what is on it.
The characters are drawn on a transparent picture (worlds/overlay, an orthographic camera: flat 2D from the front) and laid over the video when the MP4 is made.

  python tools/toons.py init "<title>" --video <file.mp4> [--number N] [--slug name]   scaffold an episode over that video
  python tools/toons.py look <slug>                                                     a contact sheet of the video (what is on screen, when)
  python tools/toons.py plan <slug>                                                     the directing plan: faces, eyes, turns, acts, captions, music, hook and ending
  python tools/toons.py settle <slug>                                                   voices + gaps so every line meets its screen + plan, until it is stable
  python tools/toons.py stills <slug> --at 1.8,12,40                                    the characters over the REAL video frames with captions (no full render)
  python tools/toons.py backdrop <slug> --world <id> [--episode <slug>] [--cam name | --pos x,y,z --look x,y,z --fov f] [--t 40]   a picture of a set for the hook
Settings live in episode.json -> "toons" (see skill/guides/toons-playbook.md). Then: episode.py render / encode / qa / deliver (or `episode.py video <slug>`)."""
import json, math, os, re, subprocess, sys, tempfile, shutil
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import EPISODES, FPS, ROOT, ep_dir, load_json, save_json, project, characters, out_dir, IS_WINDOWS

R2 = lambda x: round(float(x), 2)
YAW = {"A": 1.57, "B": 2.36, "C": 3.14}                      # half, three-quarters, fully turned away from the viewer
TURN_SEQ = ["A", "A", "B", "A", "A", "C"]
TONE_FACE = {"proud": "delighted", "proud_slow": "happy", "insisting": "determined", "shocked": "shocked", "sad_soft": "sad", "weak": "tired", "weak_whisper": "tired",
             "pleading": "pleading", "tired_question": "tired", "gloomy": "sad", "flat_soft": "deadpan", "dramatic": "wow"}
EXPLAIN_FACES = ["proud", "happy", "deadpan", "smug", "neutral"]
REACT_FACES = ["delighted", "happy", "surprised", "neutral", "deadpan"]
SPEAK_ACTS = ["nod_small", "bounce", "nod", "hop_small"]       # from assets/acts.json: they work on any character
LISTEN_ACTS = ["nod_small", "tilt_curious", "lean_in"]


def sh(cmd, **kw):
    return subprocess.run(cmd, check=True, capture_output=True, text=True, **kw)


def probe(video):
    info = sh(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,width,height:format=duration", "-of", "default=nw=1", str(video)]).stdout
    w = int(re.search(r"width=(\d+)", info).group(1)); h = int(re.search(r"height=(\d+)", info).group(1))
    return w, h, float(re.search(r"duration=([\d.]+)", info).group(1)), "codec_type=audio" in info


def load(slug):
    d = ep_dir(slug)
    return d, load_json(d / "episode.json"), load_json(d / "script.json")


# ------------------------------------------------------------------ init
def init(title, video, number=None, slug=None):
    video = os.path.abspath(os.path.expanduser(video))
    if not os.path.exists(video):
        sys.exit(f"no such video: {video}")
    w, h, dur, has_a = probe(video)
    proj = project()
    if proj["format"] != "portrait" or abs(w / h - 9 / 16) > 0.02:
        print(f"! the overlay world is drawn for portrait 9:16 (1080x1920). This video is {w}x{h} and the project format is {proj['format']}: "
              f"make the video portrait, or run `python tools/setup.py remember --format portrait`. Continuing anyway.")
    chars = characters(proj)
    ids = [c["id"] for c in chars]
    EPISODES.mkdir(exist_ok=True)
    nums = [int(m.group(1)) for p in EPISODES.iterdir() if (m := re.match(r"ep(\d+)-", p.name))]
    n = number or ((max(nums) + 1) if nums else 1)
    s = re.sub(r"[^a-z0-9]+", "-", (slug or title).lower()).strip("-") or "toons"
    name = f"ep{n:02d}-{s}"
    d = EPISODES / name
    d.mkdir()
    a, b = ids[0], ids[1] if len(ids) > 1 else ids[0]
    save_json(d / "script.json", [{"who": b, "text": "FIRST LINE", "gap": 0.3}, {"who": a, "text": "SECOND LINE", "gap": 0.2}])
    ep = {"title": title, "world": "overlay", "scene": {"light": proj["defaults"].get("light", "rembrandt")},
          "overlay": {"video": video, "hold": "last", "start": 0}, "overlayLook": {"feet": 0.16, "leftX": -4.95, "rightX": 4.5},
          "music": {"file": f"episodes/{name}/music.wav", "rms": 300}, "ambience": False, "alive": 1, "tail": 2.4, "fadeOut": 0,
          "subtitles": {"style": "pop", "y": 0.68, "size": 0.04, "outline": "#0B1F33", "accent": "#FFD84A", "words": True, "units": []},
          "pages": {}, "screen": [], "directions": [], "lightEvents": [], "facts": [],
          "toons": {"explainer": b, "intro": "none", "outro": "none", "turns": "mix", "music": "fun", "marks": {}, "video": {"w": w, "h": h, "duration": R2(dur), "audio": has_a}}}
    save_json(d / "episode.json", ep)
    print(f"created {d}\n  video: {video} ({w}x{h}, {dur:.1f} s, {'with' if has_a else 'no'} sound)\n  next: python tools/toons.py look {name}  (see what is on the screen and when), then write script.json")
    return name


# ------------------------------------------------------------------ look
def look(slug):
    d, ep, sc = load(slug)
    video = ep["overlay"]["video"]
    w, h, dur, has_a = probe(video)
    o = out_dir(slug); o.mkdir(parents=True, exist_ok=True)
    dst = o / "video_look.png"
    cols = 10; rows = math.ceil(dur / 3 / cols)
    sh(["ffmpeg", "-loglevel", "error", "-y", "-i", video, "-vf", f"fps=1/3,scale=216:-2,tile={cols}x{rows}", "-frames:v", "1", str(dst)])
    print(f"video: {video}\n  {w}x{h}, {dur:.1f} s, {'sound included (it is mixed with the voices)' if has_a else 'no sound'}\n  one picture every 3 seconds, left to right, top to bottom: {dst}")
    print("  Look at it: what is on screen at each second, and whether a name, e-mail, phone number or another private detail shows (offer to blur it).")


# ------------------------------------------------------------------ plan
def _faces(cid):
    return load_json(ROOT / "characters" / cid / "character.json")["expressions"]


def pick(options, avail, k, default):
    ok = [x for x in options if x in avail]
    return ok[k % len(ok)] if ok else default


def plan(slug):
    """Writes the directing plan into episode.json. Returns True when script gaps had to change (run the voices again: `settle` does that for you)."""
    d, ep, sc = load(slug)
    tmf = d / "timings.json"
    if not tmf.exists():
        sys.exit("no timings yet: run `python tools/toons.py settle <slug>` (it makes the voices first)")
    tm = load_json(tmf)
    proj = project(); chars = characters(proj)
    L, Rr = chars[0], chars[1] if len(chars) > 1 else chars[0]
    T = ep.setdefault("toons", {})
    st = lambda i: tm[i]["start"]; en = lambda i: tm[i]["end"]
    avail = {"left": _faces(L["id"]), "right": _faces(Rr["id"])}
    default_face = {"left": L.get("defaultExpression", avail["left"][0]), "right": Rr.get("defaultExpression", avail["right"][0])}
    counts = {}
    for l in sc:
        counts[l["who"]] = counts.get(l["who"], 0) + 1
    explainer = T.get("explainer") or max(counts, key=counts.get)
    changed = False
    # ---- the scenes marked in the script: "scene": "scream" (the line shouted while the whirl takes them) and "cta" (the call to action on the end card)
    idx = {l.get("scene"): i for i, l in enumerate(sc) if l.get("scene")}
    intro_on = T.get("intro", "none") == "roller"
    outro_on = T.get("outro", "none") == "whirl"
    n_last = len(sc) - 1
    scream, cta = idx.get("scream"), idx.get("cta")
    if outro_on and (scream is None or cta is None):
        sys.exit('outro "whirl" needs two script lines marked "scene": "scream" and "scene": "cta"')
    # ---- the hook (a question in the middle of the picture, a jump, the blind is pulled down and the video appears)
    start = 0.0
    if intro_on:
        hook_end = en(0)
        jump, pull, pulldur = R2(hook_end + 0.16), R2(hook_end + 0.76), 1.3
        start = pull
        ep["intro"] = {"jumpAt": jump, "pullAt": pull, "pullDur": pulldur, "midFeetPx": T.get("midFeetPx", 1215), "hang": 1.35, "midX": 1.75, "rodPx": 34, "landAt": R2(pull + 1.05),
                       "jumpFaceL": "determined", "jumpFaceR": "wow", "pullFaceL": "delighted", "pullFaceR": "glee"}
        if T.get("backdrop"):
            ep["intro"]["backdrop"] = T["backdrop"]
    else:
        ep.pop("intro", None)
    ep["overlay"]["start"] = start
    # ---- the whirl and the end card
    if outro_on:
        gnum = lambda v: v if isinstance(v, (int, float)) else -99
        if abs(gnum(sc[scream].get("gap", 0)) - 1.4) > 0.05:
            sc[scream]["gap"] = 1.4; changed = True
        vortex = R2(st(scream) - 1.3); card = R2(vortex + 3.4)
        need = R2((card + 2.9) - en(scream))
        if abs(gnum(sc[cta].get("gap", 0)) - need) > 0.05:
            sc[cta]["gap"] = need; changed = True
        texts = {"title": "Title", "pill": "Offer", "sub": "More", "dl": "Download on", "store": "Store", "badge": "none", **(T.get("outroTexts") or {})}
        ep["outro"] = {"vortexAt": vortex, "vortexDur": 3.2, "cardAt": card, "leftFace": "delighted", "rightFace": "proud", "leftLook": "surprised", "rightLook": "wow", "leftFace2": "laugh", "rightFace2": "glee",
                       "lookAt": R2(card + 1.5), "faceAt": R2(st(cta) - 0.15), "card": {"left": {"x": 330, "y": 1450, "scale": 0.95}, "right": {"x": 760, "y": 1450, "scale": 0.95}}, "texts": texts}
        ep["total"] = R2(en(cta) + 2.4)
    else:
        ep.pop("outro", None); ep.pop("total", None)
        ep["total"] = R2(max(en(n_last) + 2.4, start + T["video"]["duration"] + 0.4))
    if changed:
        save_json(d / "script.json", sc)
    # ---- the plan, line by line
    minority = [w for w in counts if w != explainer]
    D = []
    seq = {"left": 0, "right": 0}; turn_i = 0; speak_i = 0; listen_i = 0
    for i, l in enumerate(sc):
        who = l["who"]; side = "left" if who == L["id"] else "right"; other = "right" if side == "left" else "left"
        gz = l.get("gaze")
        kind = {"phone": "S", "each": "P", "viewer": "C"}.get(gz)
        first_real = 1 if intro_on else 0
        if kind is None:
            if i == 0 and intro_on or i == first_real or l.get("scene") in ("scream", "cta") or (outro_on and i >= scream):
                kind = "C"
            elif who == explainer:
                kind = "S"
            else:
                kind = "P"
        tone_face = TONE_FACE.get(l.get("tone", ""))
        face = {}
        for sd in ("left", "right"):
            cid = L["id"] if sd == "left" else Rr["id"]
            av = avail[sd]
            if sd == side:
                f = tone_face if tone_face in av else pick(EXPLAIN_FACES if who == explainer else REACT_FACES, av, seq[sd], default_face[sd])
            else:
                f = pick(REACT_FACES if who == explainer else EXPLAIN_FACES, av, seq[sd] + 1, default_face[sd])
            face[sd] = f; seq[sd] += 1
        if l.get("scene") == "scream":
            face = {"left": "panic" if "panic" in avail["left"] else face["left"], "right": "shocked" if "shocked" in avail["right"] else face["right"]}
        if intro_on and i == 0:
            face = {"left": "pleading" if "pleading" in avail["left"] else face["left"], "right": "skeptical" if "skeptical" in avail["right"] else face["right"]}
        gaze = {"S": ([0.35, 0.95], [-0.35, 0.95]), "P": ([0.95, 0.0], [-0.95, 0.0]), "C": ([0.0, 0.0], [0.0, 0.0])}[kind]
        spk = SPEAK_ACTS[speak_i % len(SPEAK_ACTS)]; speak_i += 1
        acts = {side: spk}
        if kind == "P":
            acts[other] = LISTEN_ACTS[listen_i % len(LISTEN_ACTS)]; listen_i += 1
        e = {"cam": "wide", "left": face["left"], "right": face["right"], "act": acts, "move": {"push": 0}, "gazeL": gaze[0], "gazeR": gaze[1]}
        if kind == "S":
            code = l.get("turn") or ("A" if T.get("turns") == "half" else TURN_SEQ[turn_i % len(TURN_SEQ)]); turn_i += 1
            e["turn"] = YAW[code]; e["turnR"] = -YAW[code]
        if i == 0 and not intro_on:
            e["hop"] = True; e["cut"] = 0.0
        D.append(e)
    ep["directions"] = D
    ep["camExtra"] = []; ep["camFx"] = []; ep["acts"] = []
    # ---- sounds only for what the story adds (the video's own sounds are mixed in as they are)
    sfx = []
    if intro_on:
        sfx += [{"at": ep["intro"]["jumpAt"], "name": "whoosh", "gain": 0.5}, {"at": ep["intro"]["pullAt"], "name": "shutter_roll", "gain": 0.6}, {"at": ep["intro"]["landAt"], "name": "soft_pop", "gain": 0.5}]
    if outro_on:
        o = ep["outro"]
        sfx += [{"at": o["vortexAt"], "name": "whoosh", "gain": 0.5}, {"at": R2(o["vortexAt"] + 0.4), "name": "sink_water", "gain": 0.7}, {"at": R2(o["cardAt"] - 0.1), "name": "sparkle", "gain": 0.5},
                {"at": R2(o["cardAt"] + 1.05), "name": "soft_pop", "gain": 0.5}, {"at": R2(o["cardAt"] + 1.5), "name": "soft_pop", "gain": 0.5}, {"at": o["faceAt"], "name": "bell", "gain": 0.4}]
    ep["sfx"] = sfx
    ep["facts"] = ep.get("facts") or [{"claim": "What the characters say follows the owner's own video and notes", "source": "user"}]
    # ---- music that follows the scenes
    if T.get("music", "fun") == "fun":
        import funmusic
        cues = {k: ep["intro"][k] for k in ("jumpAt", "pullAt") if intro_on and k in ep["intro"]}
        if outro_on:
            cues.update({"vortexAt": ep["outro"]["vortexAt"], "cardAt": ep["outro"]["cardAt"]})
        funmusic.write_wav(ROOT / "episodes" / slug / "music.wav", funmusic.render(ep["total"] + 3, 108, 7, 0, cues or None))
        ep["music"] = {"file": f"episodes/{slug}/music.wav", "rms": 300}
    else:
        ep["music"] = {"enabled": False}
    save_json(d / "episode.json", ep)
    print(f"plan: {len(D)} lines, explainer = {explainer}, intro = {T.get('intro', 'none')}, outro = {T.get('outro', 'none')}, video starts at {start} s, total {ep['total']} s" + ("  (script gaps changed: the voices run again)" if changed else ""))
    return changed


# ------------------------------------------------------------------ settle
def settle(slug):
    """voices -> gaps so every marked line starts when its screen appears -> plan, until nothing changes anymore."""
    import dialog
    from common import gaps as gap_table
    G = gap_table()
    d, ep, sc = load(slug)
    T = ep.get("toons", {})
    marks = {int(k): float(v) for k, v in (T.get("marks") or {}).items()}   # script line -> second OF THE VIDEO where that line should start
    roller, whirl = T.get("intro") == "roller", T.get("outro") == "whirl"
    num = lambda v, dflt=0.2: v if isinstance(v, (int, float)) else float(G.get(v, dflt)) if isinstance(v, str) else dflt
    for rnd in range(6):
        dialog.build(slug)
        tm = load_json(d / "timings.json")
        sc = load_json(d / "script.json")
        start = (tm[0]["end"] + 0.76) if roller else 0.0
        changed, prev_end = False, 0.0
        for i, l in enumerate(sc):
            dur = tm[i]["end"] - tm[i]["start"]
            if (roller and i == 0) or (whirl and l.get("scene") in ("scream", "cta")):   # these gaps are decided by the scene itself (plan)
                prev_end += num(l.get("gap")) + dur if i else num(l.get("gap")) + dur
                continue
            if i in marks:
                gap = max(0.2, R2(start + marks[i] - prev_end))
                if not isinstance(l.get("gap"), (int, float)) or abs(l["gap"] - gap) > 0.02:
                    l["gap"] = gap; changed = True
            prev_end += num(l.get("gap"), 0.3 if i == 0 else 0.2) + dur
        if changed:
            save_json(d / "script.json", sc)
            continue
        if not plan(slug):
            print(f"settled after {rnd + 1} round(s)")
            return
    print("! not settled after 6 rounds: check the marks and the scene lines")


# ------------------------------------------------------------------ stills over the real video
def stills(slug, times):
    import browser
    d, ep, sc = load(slug)
    video = ep["overlay"]["video"]; start = float(ep["overlay"].get("start", 0))
    tmp = Path(tempfile.mkdtemp(prefix="toons-"))
    shutil.copy(d / "subs.ass", tmp / "subs.ass")
    (tmp / "fonts").mkdir()
    for f in ("seguisb.ttf", "segoeui.ttf"):
        s = os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Fonts", f)
        if IS_WINDOWS and os.path.exists(s):
            shutil.copy(s, tmp / "fonts" / f)
    parts = []
    for i, t in enumerate(times):
        browser.shot(f"toons{i}.png", f"ep={slug}&t={t}", "1080,1920")
        bg = tmp / f"bg{i}.png"
        vt = max(0.0, t - start)
        sh(["ffmpeg", "-loglevel", "error", "-y", "-ss", str(vt), "-i", video, "-frames:v", "1", str(bg)])
        fg = ROOT / "out" / "shots" / f"toons{i}.png"
        out = tmp / f"o{i}.png"
        fc = f"[0:v]scale=1080:1920[b];[1:v]scale=1080:1920[o];[b][o]overlay=0:0,setpts=PTS+{t}/TB,ass=subs.ass" + (":fontsdir=fonts" if IS_WINDOWS else "") + ",scale=360:-2"
        sh(["ffmpeg", "-loglevel", "error", "-y", "-loop", "1", "-framerate", "30", "-t", "0.2", "-i", str(bg), "-loop", "1", "-framerate", "30", "-t", "0.2", "-i", str(fg), "-filter_complex", fc, "-frames:v", "1", str(out)], cwd=tmp)
        parts.append(str(out))
    dst = out_dir(slug) / "toons_stills.png"
    dst.parent.mkdir(parents=True, exist_ok=True)
    cmd = ["ffmpeg", "-loglevel", "error", "-y"]
    for p in parts:
        cmd += ["-i", p]
    sh(cmd + ["-filter_complex", f"hstack=inputs={len(parts)}", "-frames:v", "1", str(dst)])
    shutil.rmtree(tmp, ignore_errors=True)
    print(f"stills over the real video: {dst}  (times: {', '.join(str(t) for t in times)}; the captions are the ones baked by `build`)")


# ------------------------------------------------------------------ backdrop: a picture of a set, for the hook
def backdrop(slug, world, episode=None, cam=None, pos=None, look_=None, fov=None, t=40.0):
    import browser
    d, ep, sc = load(slug)
    p = d / "episode.json"
    base = json.loads(json.dumps(ep))
    src_ep = episode or slug
    name = cam or "wide"
    try:
        if pos:
            ep.setdefault("shots", {})["backdrop_cam"] = {"pos": pos, "look": look_ or [0, pos[1], -12], "fov": fov or 60, "kind": "wide"}
            save_json(p, ep); name = "backdrop_cam"; src_ep = slug
        browser.shot("backdrop.png", f"ep={src_ep}&world={world}&t={t}&cam={name}&nochars=1", "1080,1920")
    finally:
        save_json(p, base)
    dst = d / "hook_backdrop.png"
    shutil.copy(ROOT / "out" / "shots" / "backdrop.png", dst)
    print(f"backdrop: {dst}\n  use it: episode.json -> toons.backdrop = \"episodes/{slug}/hook_backdrop.png\" and toons.intro = \"roller\", then `settle`")


# ------------------------------------------------------------------ cli
def arg(a, k, d=None):
    return a[a.index(k) + 1] if k in a else d


if __name__ == "__main__":
    a = sys.argv[1:]
    if not a:
        sys.exit(__doc__)
    cmd, rest = a[0], a[1:]
    if cmd == "init":
        init(rest[0], arg(rest, "--video"), int(arg(rest, "--number")) if arg(rest, "--number") else None, arg(rest, "--slug"))
    elif cmd == "look": look(rest[0])
    elif cmd == "plan": plan(rest[0])
    elif cmd == "settle": settle(rest[0])
    elif cmd == "stills": stills(rest[0], [float(x) for x in arg(rest, "--at", "1.5,10,30").split(",")])
    elif cmd == "backdrop":
        f3 = lambda s: [float(x) for x in s.split(",")] if s else None
        backdrop(rest[0], arg(rest, "--world"), arg(rest, "--episode"), arg(rest, "--cam"), f3(arg(rest, "--pos")), f3(arg(rest, "--look")), float(arg(rest, "--fov")) if arg(rest, "--fov") else None, float(arg(rest, "--t", 40)))
    else:
        sys.exit(__doc__)
