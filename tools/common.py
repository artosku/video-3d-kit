"""Shared helpers for the 3D dialogue video tools: paths, JSON, time references, and audio through ffmpeg + numpy (no audioop, it is gone in Python 3.13)."""
import json
import os
import platform
import re
import subprocess
import sys
from pathlib import Path

import numpy as np

for _s in (sys.stdout, sys.stderr):   # Windows consoles default to cp1252 and cannot print the check marks
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

ROOT = Path(__file__).resolve().parents[1]          # the kit root
ASSETS = ROOT / "assets"
EPISODES = ROOT / "episodes"
OUT = ROOT / "out"
SR = 44100
FPS = 30
IS_WINDOWS = platform.system() == "Windows"


def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save_json(path, data, **kw):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=kw.pop("indent", 1), **kw)


def ep_dir(slug):
    d = EPISODES / slug
    if not d.is_dir():
        sys.exit(f"episode '{slug}' not found in {EPISODES} (tools/episode.py new ... creates one)")
    return d


def out_dir(slug):
    d = OUT / slug
    d.mkdir(parents=True, exist_ok=True)
    return d


def run(cmd, **kw):
    """Run a command; stop with its output when it fails."""
    r = subprocess.run(cmd, capture_output=True, text=True, **kw)
    if r.returncode != 0:
        sys.exit(f"command failed ({r.returncode}): {' '.join(map(str, cmd))}\n{r.stderr[-1500:]}")
    return r


def ffmpeg(*args):
    return run(["ffmpeg", "-loglevel", "error", "-y", *map(str, args)])


# ---------------------------------------------------------------- audio
def read_audio(path, sr=SR, pre=()):
    """Any audio file -> float32 mono numpy array at `sr`."""
    r = subprocess.run(["ffmpeg", "-loglevel", "error", *pre, "-i", str(path), "-f", "f32le", "-ac", "1", "-ar", str(sr), "-"], capture_output=True)
    if r.returncode != 0:
        sys.exit(f"cannot read audio {path}: {r.stderr.decode(errors='replace')[-500:]}")
    return np.frombuffer(r.stdout, dtype="<f4").copy()


def write_wav(path, samples, sr=SR, channels=1):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    data = np.clip(samples, -1.0, 1.0).astype("<f4").tobytes()
    r = subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "f32le", "-ar", str(sr), "-ac", str(channels), "-i", "-", "-sample_fmt", "s16", str(path)], input=data, capture_output=True)
    if r.returncode != 0:
        sys.exit(f"cannot write {path}: {r.stderr.decode(errors='replace')[-500:]}")


def rms16(x):
    """RMS on the int16 scale (32768 = full scale): the unit the loudness targets were tuned in."""
    return float(np.sqrt(np.mean(np.square(x.astype(np.float64)))) * 32768) if len(x) else 0.0


def leveled(x, target, lo=0.0, hi=12.0):
    r = max(rms16(x), 1.0)
    return x * float(min(max(target / r, lo), hi))


def mix_in(buf, x, t, gain=1.0):
    """Add `x` into `buf` starting at t seconds (clipped to the buffer)."""
    a = int(round(t * SR))
    if a >= len(buf):
        return
    s = max(0, -a)
    b = min(len(buf), a + len(x))
    if b > max(a, 0) and s < len(x):
        buf[max(a, 0):b] += x[s:s + (b - max(a, 0))] * gain


# ---------------------------------------------------------------- time references (the same grammar as web/episode.js)
_T = re.compile(r"^(?:L(\d+)\.(start|end)|(end)|(total))\s*([+-]\s*\d+(?:\.\d+)?)?$")


class Clock:
    def __init__(self, lines, total):
        self.lines, self.total = lines, total
        self.last_end = lines[-1]["end"] if lines else 0.0

    def __call__(self, x, default=0.0):
        if x is None:
            return default
        if isinstance(x, (int, float)):
            return float(x)
        m = _T.match(str(x).strip())
        if not m:
            raise ValueError(f"bad time reference: {x!r}")
        off = float(m.group(5).replace(" ", "")) if m.group(5) else 0.0
        if m.group(1) is not None:
            i = int(m.group(1))
            if i >= len(self.lines):
                raise ValueError(f"no line {i} in {x!r}")
            return self.lines[i][m.group(2)] + off
        return (self.last_end if m.group(3) else self.total) + off


def total_of(ep, lines):
    last = lines[-1]["end"] if lines else 0.0
    return float(ep.get("total", last + float(ep.get("tail", 4.0))))


FORMATS = {   # name -> (render size, final size): drawn small with software WebGL, scaled up when encoding
    "portrait": ((720, 1280), (1080, 1920)),
    "landscape": ((1280, 720), (1920, 1080)),
    "square": ((720, 720), (1080, 1080)),
}


def project():
    """project.json (yours, written by tools/setup.py) or, before setup, project.example.json."""
    f = ROOT / "project.json"
    p = load_json(f if f.exists() else ROOT / "project.example.json")
    p.setdefault("language", "id"); p.setdefault("format", "portrait"); p.setdefault("world", "bedroom")
    p.setdefault("rules", {}); p.setdefault("defaults", {}); p.setdefault("tts", {"provider": "cartesia"})
    if p["format"] not in FORMATS:
        sys.exit(f"project.json: format must be one of {sorted(FORMATS)}")
    return p


def fmt_sizes(p=None):
    return FORMATS[(p or project())["format"]]


def character(cid):
    f = ROOT / "characters" / cid / "character.json"
    if not f.exists():
        sys.exit(f"character '{cid}' not found (characters/{cid}/character.json)")
    return load_json(f)


def characters(p=None):
    """[left, right] character.json dicts, in the order of project.json."""
    return [character(c) for c in (p or project())["characters"]]


def world(p=None):
    wid = (p or project())["world"]
    f = ROOT / "worlds" / wid / "world.json"
    if not f.exists():
        sys.exit(f"world '{wid}' not found (worlds/{wid}/world.json)")
    return load_json(f)


def gaps():
    return {k: v for k, v in load_json(ASSETS / "gaps.json")["gaps"].items()}


def _dotenv():
    f = ROOT / ".env"
    out = {}
    if f.exists():
        for ln in f.read_text(encoding="utf-8").splitlines():
            ln = ln.strip()
            if ln and not ln.startswith("#") and "=" in ln:
                k, v = ln.split("=", 1)
                out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def has_key(name):
    return bool(os.environ.get(name) or _dotenv().get(name))


def keys_env(name):
    v = os.environ.get(name) or _dotenv().get(name)
    if not v and IS_WINDOWS:   # a terminal opened before the variable was set does not see it: read the Windows user environment
        try:
            import winreg
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, "Environment") as k:
                v = winreg.QueryValueEx(k, name)[0]
        except OSError:
            v = None
    if not v:
        sys.exit(f"{name} is not set. Put it in an environment variable, or in a .env file in the kit folder (see .env.example). It is never committed.")
    return v
