"""Contact sheets and the self-test (the eyes of a model that cannot judge motion from one still).
   python tools/episode.py actsheet <character> [--world <id>] [--cam wide]   every face and every act of a character, in out/actsheets/<character>/
   python tools/episode.py selftest [--update]                             6 fixed stills per world + 2 of a fixture episode, compared with tests/golden/
"""
import sys
from pathlib import Path

from common import ASSETS, OUT, ROOT, character, load_json, save_json


def _acts_of(cid):
    cfg = character(cid)
    lib = {k: v for k, v in load_json(ASSETS / "acts.json").items() if k != "_note"}
    rig_names = list(cfg.get("acts", []))
    return cfg, lib, rig_names


def actsheet(cid, world_id=None, cam="wide", frames=6):
    from browser import shot
    from episode import sheet, shot_size
    import shutil
    cfg, lib, rig_names = _acts_of(cid)
    dst = OUT / "actsheets" / cid
    shutil.rmtree(dst, ignore_errors=True)
    dst.mkdir(parents=True)
    size = shot_size()
    base = f"chars={cid}&bg=quiet" + (f"&world={world_id}" if world_id else "")
    made = []
    # faces: one still each, in the close shot
    exprs = list(cfg["expressions"]) + [e for e in cfg.get("expressionParams", {}) if e not in cfg["expressions"]]
    fs = []
    for i, e in enumerate(exprs):
        n = f"as_{cid}_x{i:02d}_{e}.png"
        shot(n, f"{base}&cam=left&left={e}", size)
        shutil.move(str(OUT / "shots" / n), dst / n)
        fs.append(dst / n)
    sheet(fs, dst / "faces.png", cols=6, width=200)
    made.append(dst / "faces.png")
    print(f"actsheet: {len(exprs)} faces -> {dst / 'faces.png'}  (order: {', '.join(exprs)})")
    # acts: `frames` stills across each act
    names = rig_names + [a for a in lib if a not in rig_names]
    for name in names:
        dur = float(lib[name]["dur"]) if name in lib and name not in rig_names else 0.9
        if name in ("launch",):
            dur = 1.6   # the first seconds of a long hold-out
        fs = []
        for k in range(frames):
            u = k / (frames - 1)
            n = f"as_{cid}_{name}_{k}.png"
            shot(n, f"{base}&cam={cam}&act={name}&actdur={dur}&t={0.5 + u * dur * 0.999:.3f}", size)
            shutil.move(str(OUT / "shots" / n), dst / n)
            fs.append(dst / n)
        sheet(fs, dst / f"act_{name}.png", cols=frames, width=180)
        for f in fs:
            f.unlink()
        made.append(dst / f"act_{name}.png")
        print(f"actsheet: {name} ({dur:.2f}s) -> {dst / ('act_' + name + '.png')}", flush=True)
    for f in dst.glob("as_*.png"):
        f.unlink()
    print(f"actsheet: done, {len(made)} sheets in {dst}")
    return made


# ------------------------------------------------------------------ selftest
GOLDEN = ROOT / "tests" / "golden"
THRESHOLD = 3.0   # mean absolute difference per channel (0..255) that still counts as the same picture; software and GPU drawing differ by well under this


def _worlds():
    out = []
    for d in sorted((ROOT / "worlds").iterdir()):
        f = d / "world.json"
        if d.name.startswith("_") or not f.exists():
            continue
        if load_json(f).get("transparent"):
            continue
        out.append(d.name)
    return out


def _cases():
    """(name, query) pairs. A fixed set: the same shots, faces and moments every time."""
    cases = []
    for w in _worlds():
        base = f"world={w}&chars=ayam,claude"
        for i, (cam, l, r, t) in enumerate([("wide", "neutral", "deadpan", 3), ("left", "happy", "deadpan", 3), ("right", "neutral", "worried", 3),
                                            ("two", "surprised", "smug", 3), ("wide_low", "determined", "proud", 3), ("left_ecu", "sheepish", "skeptical", 3)]):
            cases.append((f"{w}_{i}_{cam}", f"{base}&cam={cam}&left={l}&right={r}&t={t}"))
    for i, t in enumerate([1.0, 2.2]):
        cases.append((f"fixture_{i}", f"ep=_selftest&t={t}"))
    return cases


def selftest(update=False):
    import numpy as np
    from PIL import Image
    from browser import shot
    GOLDEN.mkdir(parents=True, exist_ok=True)
    bad, ok = [], 0
    for name, query in _cases():
        f = shot(f"st_{name}.png", query, "270,480")
        g = GOLDEN / f"{name}.png"
        if update or not g.exists():
            Image.open(f).convert("RGB").save(g, optimize=True)
            print(f"  = {name}: golden {'updated' if update else 'created'}")
            continue
        a = np.asarray(Image.open(f).convert("RGB"), dtype=np.int16)
        b = np.asarray(Image.open(g).convert("RGB"), dtype=np.int16)
        if a.shape != b.shape:
            bad.append((name, "size differs"))
            print(f"  ✗ {name}: size differs")
            continue
        d = float(np.abs(a - b).mean())
        if d > THRESHOLD:
            diff = OUT / "selftest"
            diff.mkdir(parents=True, exist_ok=True)
            Image.open(f).convert("RGB").save(diff / f"{name}_now.png")
            bad.append((name, d))
            print(f"  ✗ {name}: mean difference {d:.2f} > {THRESHOLD} (picture now: {diff / (name + '_now.png')}, golden: {g})")
        else:
            ok += 1
            print(f"  ✓ {name}: {d:.2f}")
    if bad:
        sys.exit(f"selftest: {len(bad)} pictures changed, {ok} same. If the change is meant, run: python tools/episode.py selftest --update")
    print(f"selftest: all {ok} pictures match tests/golden/" if not update else "selftest: goldens written")
