"""Cinematic direction. Two jobs:
   generate(slug)  builds a first plan for EVERY line from the script: which shot, which faces, which body acts, which camera move, which light change.
                   It is a starting point with real variety, never the final plan: the agent improves it line by line (skill/guides/cinematic-playbook.md).
   review(...)     measures a plan and says what is flat: the same shot again and again, faces that never change, nobody moves, a camera that never moves, no light play.
                   `validate` fails a flat plan (project.json rules.cinematic, on by default). `python tools/episode.py review <slug>` prints the measurements.
The ideas are the usual craft of dialogue scenes and character animation: cover a conversation from several angles (wide, medium, close-up, over-the-shoulder), cut on emotion,
low angles for power and high angles for weakness, push in on feeling, hold the face of the listener, give every line a gesture (anticipation, follow-through), and let the light follow the story."""
import re
import sys

from common import characters, ep_dir, gaps, load_json, project, save_json, world

# what each feeling may look like, best first (the first name that this character really has is used)
FACE = {
    "sad": ["sad", "dread", "tired", "guilty", "worried"], "embarrassed": ["sheepish", "embarrassed", "sad"], "shock": ["shocked", "panic", "surprised", "wow"],
    "panic": ["panic", "shocked", "worried", "surprised"], "happy": ["delighted", "laugh", "happy", "glee", "proud"], "proud": ["proud", "smug", "happy", "determined"],
    "smug": ["smug", "skeptical", "fakewow", "deadpan", "neutral"], "angry": ["angry", "fed_up", "annoyed", "determined", "squint"], "flat": ["deadpan", "deadeye", "neutral"],
    "curious": ["surprised", "skeptical", "worried", "neutral"], "pleading": ["pleading", "sad", "worried"], "neutral": ["neutral", "deadpan"], "worried": ["worried", "guilty", "sad", "surprised"],
}
BOTTOM_SUBS = ("wide", "two", "wide_low", "wide_high")   # shots where the top third is not free for the subtitles: see derive.py
NEW_SHOTS = ("left_low", "right_low", "left_high", "right_high", "left_ecu", "right_ecu", "over_left", "over_right", "wide_low", "wide_high", "two")


def shot_kind(name, ep=None):
    """What a shot IS: 'wide', 'two', 'low', 'high', 'ecu', 'over' or 'close'. A shot you invent can say it: episode.json shots: { "screen": { ..., "kind": "wide" } }."""
    k = ((ep or {}).get("shots", {}).get(name) or {}).get("kind")
    if k:
        return k
    if not name:
        return None
    if name.endswith("_ecu"): return "ecu"
    if name.startswith("over_"): return "over"
    if name == "two": return "two"
    if name.startswith("wide"): return "high" if name == "wide_high" else ("low" if name == "wide_low" else "wide")
    if name.endswith("_low"): return "low"
    if name.endswith("_high"): return "high"
    return "close"


def pick(names, have, default=None):
    return next((n for n in names if n in have), default if default in have else None)


def classify(ln, gap):
    t, tone = ln.get("text", ""), (ln.get("tone") or "")
    words = len(t.split())
    q, ex, dots = t.rstrip().endswith("?"), "!" in t, ("..." in t or "…" in t)
    weak = any(k in tone for k in ("weak", "gloomy", "soft", "pleading", "sad", "tired", "slow"))
    hot = any(k in tone for k in ("proud", "excited", "insisting", "shocked", "angry"))
    if gap >= 1.5 and (weak or dots or words <= 6):
        return "punchline"
    if "pleading" in tone:
        return "pleading"
    if "shocked" in tone or (ex and words <= 3):
        return "shock"
    if weak or (dots and not q):
        return "weak"
    if "insisting" in tone or "angry" in tone:
        return "insist"
    if "proud" in tone or "excited" in tone or (ex and hot):
        return "proud"
    if q:
        return "question"
    if ex:
        return "exclaim"
    if any(k in tone for k in ("flat", "deadpan", "calm", "dramatic")):
        return "flat"
    return "plain"


def generate(slug):
    d = ep_dir(slug)
    proj = project()
    W = world(proj)
    chars = characters(proj)
    script = load_json(d / "script.json")
    ep = load_json(d / "episode.json")
    G = gaps()
    ids = [c["id"] for c in chars]
    side_of = {cid: ("left" if i == 0 else "right") for i, cid in enumerate(ids)}
    have = [set(c["expressions"]) for c in chars]
    acts_rig = [set(c.get("acts", [])) for c in chars]
    shots_ok = set(W.get("builtinShots", ["wide", "left", "right", "right34"]))
    other = {"left": "right", "right": "left"}

    def face(side, feeling, fallback="neutral"):
        i = 0 if side == "left" else 1
        if i >= len(chars):
            return None
        return pick(FACE.get(feeling, FACE["neutral"]), have[i]) or chars[i]["defaultExpression"]

    def shot(cands, history):
        ok = [c for c in cands if c in shots_ok]
        for c in ok:
            if history[-2:].count(c) == 0:
                return c
        return ok[0] if ok else "left"

    dirs, camx, acts, hist, used_roll, labels = [], [], [], [], 0, []
    lead_lines = []
    for i, ln in enumerate(script):
        gap = 0.0 if ln.get("opening") else (G.get(ln["gap"], 0.5) if isinstance(ln.get("gap"), str) else float(ln.get("gap", 0.5)))
        S = side_of[ln["who"]]
        O = other[S]
        if ln.get("opening"):
            dirs.append({"cam": "left", "left": face("left", "neutral"), **({"right": face("right", "flat")} if len(chars) > 1 else {}), "cut": 1.0, "move": {"push": 0.1}})
            hist.append("left")
            labels.append("opening")
            continue
        lab = classify(ln, gap)
        labels.append(lab)
        if S == "left":
            lead_lines.append(i)
        n_before = labels.count(lab) - 1
        cands = {
            "punchline": [f"{S}_ecu", f"{S}_high", S],
            "weak": [f"{S}_high", S, "two", f"over_{O}"],
            "pleading": [f"{S}_high", S, f"over_{O}"],
            "shock": [f"{S}_ecu", f"{S}_low", "wide_low", S],
            "proud": [f"{S}_low", S, "two", f"over_{O}"],
            "exclaim": [S, f"{S}_low", f"over_{O}", "two"],
            "insist": [f"over_{O}", f"{S}_low", S],
            "question": [S, f"over_{O}", "two", f"{S}_low"],
            "flat": [f"over_{O}", S, "right34" if S == "right" else S, "two"],
            "plain": [S, f"over_{O}", "two", f"{S}_high"],
        }[lab]
        cands = cands[n_before % len(cands):] + cands[:n_before % len(cands)] if lab in ("plain", "flat", "question") else cands
        cam = shot(cands, hist)
        if i % 7 == 6 and "wide" not in hist[-4:] and "two" not in hist[-4:] and "wide_high" not in hist[-4:]:
            cam = "wide_high" if "wide_high" in shots_ok else ("wide" if "wide" in shots_ok else cam)   # every few lines, show the whole scene again
        hist.append(cam)
        feel_s = {"punchline": "embarrassed", "weak": "sad", "pleading": "pleading", "shock": "shock", "proud": "proud" if S == "left" else "smug", "exclaim": "happy" if S == "left" else "smug",
                  "insist": "angry", "question": "curious", "flat": "flat", "plain": "neutral"}[lab]
        feel_l = {"punchline": "smug", "weak": "worried", "pleading": "worried", "shock": "smug", "proud": "flat", "exclaim": "flat", "insist": "worried", "question": "neutral", "flat": "neutral", "plain": "neutral"}[lab]
        entry = {"cam": cam, S: face(S, feel_s)}
        if len(chars) > 1:
            entry[O] = face(O, feel_l)
        move = {"punchline": {"push": 0.2}, "weak": {"push": 0.16}, "pleading": {"push": 0.14}, "shock": {"push": 0.1}, "proud": {"push": 0.1}, "insist": {"push": 0.12}, "question": {"push": 0.08}}.get(lab)
        if cam in ("two", "wide", "wide_high", "wide_low"):
            move = {"push": 0.0, "orbit": 6 if i % 2 else -6}
        if move:
            entry["move"] = move
        if lab in ("shock", "insist") and used_roll < 2 and cam.endswith(("_low", "_ecu")):
            entry["roll"] = 0.1 if used_roll == 0 else -0.09
            used_roll += 1
        if lab in ("punchline", "pleading", "weak") and f"{S}_ecu" == cam:
            entry["dof"] = 1.6
            entry["focus"] = S
        act_s = {"punchline": "slump", "weak": "slump", "pleading": "tilt_curious", "shock": "jolt", "proud": "puff" if S == "left" else "lean_in", "exclaim": "bounce", "insist": "lean_in", "question": "tilt_curious", "flat": None, "plain": "nod_small" if i % 2 else None}[lab]
        act_l = {"punchline": "lean_in", "weak": "lean_in", "pleading": "recoil_small", "shock": "recoil", "proud": "nod_small", "exclaim": "recoil_small", "insist": "recoil_small", "question": "nod_small", "flat": None, "plain": None}[lab]
        if S == "left" and lab in ("proud", "exclaim"):
            entry["hop"] = True
        if lab in ("weak", "punchline"):
            entry["look"] = [0.0, -0.6]
        a = {}
        if act_s:
            a[S] = act_s
        if act_l and len(chars) > 1:
            a[O] = act_l
        if a:
            entry["act"] = a
        if lab == "shock":
            camx.append({"at": f"L{i}.start", "cam": cam, "blend": 0.08})
        dirs.append(entry)
        # a reaction shot: a long line ends on the face of the one who listens
        if len(ln["text"].split()) >= 8 and len(chars) > 1:
            react = O if O in ("left", "right") else "left"
            camx.append({"at": f"L{i}.end-0.55", "cam": react if react in shots_ok else "left", "blend": 0.08})
    # ---- light: only changes with a visible cause. The lead turning away is such a cause, so a dip of the key light sits on a lead line that has a turn
    events = []
    strict = W.get("lightCauseCheck", "strict") == "strict"
    pain = [i for i, lb in enumerate(labels) if lb in ("punchline", "weak", "pleading")]
    pairs = []
    for i in pain[:2]:
        j = next((k for k in lead_lines if k >= i), None)
        if j is not None and j not in [p[0] for p in pairs]:
            pairs.append((j, next((k for k in lead_lines if k > j and k not in pain), None)))
    for j, back in pairs:
        dirs[j]["turn"] = 0.95
        events.append({"type": "level", "role": "key", "at": f"L{j}.start", "over": 0.7, "to": 0.5, "cause": "the lead turns away, the face leaves the lamp's light"})
        if back is not None:
            dirs[back]["turn"] = 0.35
            events.append({"type": "level", "role": "key", "at": f"L{back}.start", "over": 0.9, "to": 1.0, "cause": "the lead turns back to the lamp"})
    if W.get("features", {}).get("lamp") and pain:
        k = pain[0]
        events.append({"type": "flicker", "at": f"L{k}.start-0.2", "dur": 1.7, "floor": 0.12, "amp": 0.55, "to": 0.45, "recover": 9, "cause": "the bulb of the desk lamp flickers on the painful line; the lamp is visible on the right"})
    # ---- the finish
    ep["directions"] = dirs
    ep["camExtra"] = camx
    ep["acts"] = [a for a in ep.get("acts", []) if a.get("keep")]
    ep["lightEvents"] = events
    if any(lb == "shock" for lb in labels):
        k = labels.index("shock")
        ep["camFx"] = [{"type": "punch", "at": f"L{k}.start", "dur": 0.35, "amount": 0.1}]
    ep.setdefault("alive", 1.0)
    save_json(d / "episode.json", ep)
    print(f"directions: a cinematic first plan for {len(script)} lines: {len(set(hist))} different shots, acts on most lines, camera moves, {len(events)} light changes.\n"
          f"  This is a STARTING POINT. Now improve it line by line (skill/guides/cinematic-playbook.md), then: python tools/episode.py review {slug}")


# ====================================================================== the flat-video check
LOW_HIGH = ("_low", "_high", "_ecu")


def metrics(ep, script, W):
    dirs = ep.get("directions", [])
    n = len([ln for ln in script if not ln.get("opening")]) or 1
    cams = [x.get("cam") for x in dirs if x.get("cam")]
    cams += [c.get("cam") for c in ep.get("camExtra", [])]
    run = best = 1
    for a, b in zip([x.get("cam") for x in dirs], [x.get("cam") for x in dirs][1:]):
        run = run + 1 if a == b and a else 1
        best = max(best, run)
    faces = {"left": [], "right": []}
    for x in dirs:
        for s in ("left", "right"):
            if x.get(s):
                faces[s].append(x[s])
    changes = sum(1 for s in faces for a, b in zip(faces[s], faces[s][1:]) if a != b)
    slots = max(1, sum(max(0, len(v) - 1) for v in faces.values()))
    explicit = sum(1 for x in dirs if x.get("act") or x.get("leftAct") or x.get("rightAct")) + len(ep.get("acts", []))
    moves = sum(1 for x in dirs if x.get("move") or x.get("roll")) + sum(1 for c in ep.get("camExtra", []) if c.get("move") or c.get("roll")) + len(ep.get("camFx", []))
    return {
        "lines": n, "distinct_shots": len(set(cams)), "longest_same_shot_run": best,
        "angle_shots": sum(1 for c in set(cams) if shot_kind(c, ep) in ("low", "high", "ecu", "over")), "wide_or_two": sum(1 for c in set(cams) if shot_kind(c, ep) in ("wide", "two") or (c or "").startswith("wide")),
        "face_changes_pct": round(100 * changes / slots), "distinct_faces": len({f for v in faces.values() for f in v}),
        "lines_with_an_act_pct": round(100 * min(n, explicit) / n), "camera_moves": moves, "light_changes": len(ep.get("lightEvents", [])),
    }


def review(ep, script, W, strict=True):
    """-> (problems, metrics). Problems are written as instructions to the agent."""
    m = metrics(ep, script, W)
    n = m["lines"]
    if n < 4:
        return [], m
    need_shots = min(6, max(3, n // 3 + 1))
    p = []
    if m["distinct_shots"] < need_shots:
        p.append(f"only {m['distinct_shots']} different shots for {n} lines (need at least {need_shots}). Cover the talk from several angles: close-ups, over-the-shoulder (over_left / over_right), low and high angles, a wide or two-shot.")
    if m["longest_same_shot_run"] >= 3:
        p.append(f"the same shot is used {m['longest_same_shot_run']} lines in a row. Never more than 2 in a row: cut to the listener, change the angle, or move the camera.")
    if not m["angle_shots"]:
        p.append("no angle shots: use a low angle (power, pride, a threat), a high angle (small, sad, embarrassed), an extreme close-up (a punchline, a shock) or an over-the-shoulder on at least a few lines.")
    if not m["wide_or_two"]:
        p.append("no wide shot or two-shot: show both characters and the place at least once (wide, wide_high, wide_low or two).")
    if m["face_changes_pct"] < 45 or m["distinct_faces"] < min(5, n // 3 + 2):
        p.append(f"faces barely change ({m['face_changes_pct']}% of the lines change a face, {m['distinct_faces']} different faces). Give every line the face of its feeling, for BOTH characters (the listener reacts too). Make new faces if the rig has none that fits (expressionParams in character.json).")
    if m["lines_with_an_act_pct"] < 40:
        p.append(f"only {m['lines_with_an_act_pct']}% of the lines have a body act (need 40%). Add directions[i].act = {{ \"left\": \"nod\", \"right\": \"recoil\" }}: a gesture on every key beat (see assets/acts.json, or define your own in actDefs).")
    if m["camera_moves"] < 2:
        p.append("the camera never moves: give the emotional shots a move ({ \"push\": 0.2 } slowly closer, orbit, rise), one tilted shot (roll) or a camFx punch/shake.")
    if strict and m["light_changes"] < 2 and W.get("lightRoles"):
        p.append("no light play: add at least 2 lightEvents, each with a visible cause (see skill/guides/light-theory.md), so the light follows the story.")
    return p, m


def print_report(m, problems):
    rows = [("lines", m["lines"]), ("different shots", m["distinct_shots"]), ("longest run of the same shot", m["longest_same_shot_run"]), ("angle shots (low/high/ecu/over)", m["angle_shots"]),
            ("wide / two-shot shots", m["wide_or_two"]), ("face changes", f"{m['face_changes_pct']}%"), ("different faces", m["distinct_faces"]), ("lines with a body act", f"{m['lines_with_an_act_pct']}%"),
            ("camera moves / fx", m["camera_moves"]), ("light changes", m["light_changes"])]
    for k, v in rows:
        print(f"  {k:<34} {v}")
    print("  " + ("cinematic check: OK" if not problems else "cinematic check: FLAT, fix:"))
    for x in problems:
        print("   ✗", x)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    generate(sys.argv[1])
