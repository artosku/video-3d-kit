"""A fun, bouncy background track made from code (no files, no licence): soft kick, claps, shaker and hats, a round bass, offbeat ukulele-like plucks and a sparkly marimba line.
   python tools/funmusic.py <seconds> <out.wav> [--bpm 108] [--seed 7] [--key C|D|E|F|G] [--episode <slug>]
With --episode the music follows the scenes of that episode (episode.json): a sparse curious hook (intro.jumpAt), a rising sweep up to the pull of the blind (intro.pullAt) with an
impact, the full beat from the pull on, the beat dropping out into a descending whirl at outro.vortexAt, and a bright chime plus a light jingle on the end card (outro.cardAt).
Use it in episode.json:  "music": { "file": "<path to the wav>", "rms": 300 }   (the kit puts it about 18 dB under the speech)."""
import json, sys, wave
from pathlib import Path
import numpy as np

SR = 44100


def note(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def env(n, a=0.004, d=0.12, s=0.0):
    t = np.arange(n) / SR
    return np.minimum(1, t / a) * (s + (1 - s) * np.exp(-t / d))


def pluck(freq, dur, bright=0.5):
    n = int(SR * dur); t = np.arange(n) / SR
    w = np.sin(2 * np.pi * freq * t) + 0.45 * np.sin(4 * np.pi * freq * t) * bright + 0.2 * np.sin(6 * np.pi * freq * t) * bright
    return w * env(n, 0.003, dur * 0.35)


def pad(freq, dur):
    n = int(SR * dur); t = np.arange(n) / SR
    w = np.sin(2 * np.pi * freq * t) + 0.5 * np.sin(2 * np.pi * freq * 2.003 * t) + 0.25 * np.sin(2 * np.pi * freq * 3.01 * t)
    return w * np.minimum(1, t / (dur * 0.35)) * np.minimum(1, (dur - t) / (dur * 0.3))


def bass(freq, dur):
    n = int(SR * dur); t = np.arange(n) / SR
    w = np.sin(2 * np.pi * freq * t) + 0.35 * np.sin(4 * np.pi * freq * t)
    return w * env(n, 0.006, dur * 0.7, 0.15)


def kick(dur=0.22):
    n = int(SR * dur); t = np.arange(n) / SR
    f = 55 + 90 * np.exp(-t * 28)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 16)


def hat(rng, dur=0.05):
    n = int(SR * dur); x = np.diff(rng.standard_normal(n + 1)); return x * env(n, 0.001, dur * 0.3)


def clap(rng, dur=0.16):
    n = int(SR * dur); x = rng.standard_normal(n); out = np.zeros(n)
    for k, o in enumerate((0, 0.012, 0.024)):
        i = int(o * SR); out[i:] += x[:n - i] * np.exp(-np.arange(n - i) / SR * 40) * (0.6 + 0.2 * k)
    return np.diff(np.concatenate([[0], out]))


def crash(rng, dur=1.4):
    n = int(SR * dur); x = np.diff(rng.standard_normal(n + 1)); return x * np.exp(-np.arange(n) / SR * 3.2)


def sweep(f0, f1, dur, shape=1.0, tremolo=0.0):
    """A glissando from f0 to f1 (exponential), optionally with a tremolo that speeds up (the whirl)."""
    n = int(SR * dur); u = np.arange(n) / n
    f = f0 * (f1 / f0) ** (u ** shape)
    ph = 2 * np.pi * np.cumsum(f) / SR
    w = np.sin(ph) + 0.35 * np.sin(2 * ph + 0.5)
    if tremolo:
        w *= 0.6 + 0.4 * np.sin(2 * np.pi * np.cumsum(tremolo * (1 + 2.5 * u)) / SR)
    return w


PROG = [(0, [0, 4, 7]), (7, [7, 11, 14]), (9, [9, 12, 16]), (5, [5, 9, 12])]   # C G Am F, as semitone offsets of the root
SCALE = [0, 2, 4, 7, 9, 12, 14, 16]   # major pentatonic for the sparkle line


def render(seconds, bpm=108, seed=7, key=0, cues=None):
    rng = np.random.default_rng(seed)
    beat = 60.0 / bpm; bar = 4 * beat; n = int((seconds + 3) * SR)
    L = {k: np.zeros(n) for k in ("hook", "beat", "fx")}

    def put(layer, sig, t, g=1.0):
        i = int(t * SR)
        if 0 <= i < n:
            m = min(len(sig), n - i); L[layer][i:i + m] += sig[:m] * g

    def bar_pattern(t0, b, full, layer="beat", g=1.0, drums=True):
        root, tri = PROG[b % 4]; r = 48 + key + root
        for q in range(4):
            tb = t0 + q * beat
            if drums:
                if q in (0, 2):
                    put(layer, kick(), tb, 0.9 * g)
                if q in (1, 3):
                    put(layer, clap(rng), tb, 0.45 * g)
                for e8 in (0, 0.5):
                    put(layer, hat(rng), tb + e8 * beat, (0.16 if e8 else 0.24) * g)
                for s16 in (0.25, 0.75):
                    put(layer, hat(rng, 0.03), tb + s16 * beat, 0.07 * g)
        for tb, o in ((0, 0), (1.5, 0), (2.0, 7), (3.5, 0)):                 # a bouncing bass
            put(layer, bass(note(r - 12 + o), beat * 0.5), t0 + tb * beat, 0.5 * g)
        if full:
            for q in (0.5, 1.5, 2.5, 3.5):                                     # offbeat ukulele-like chord plucks
                for iv in tri:
                    put(layer, pluck(note(r + 12 + iv), beat * 0.4, 0.6), t0 + q * beat, 0.12 * g)
            pat = rng.integers(0, len(SCALE), 8)
            for k in range(8):                                                 # sparkly marimba line on the eighths
                if rng.random() < 0.78:
                    put(layer, pluck(note(r + 24 + SCALE[pat[k]]), beat * 0.45, 0.35), t0 + k * 0.5 * beat, 0.16 * g)

    cues = cues or {}
    pull, jump, stop, card = cues.get("pullAt"), cues.get("jumpAt"), cues.get("vortexAt"), cues.get("cardAt")
    if pull is None:                                                          # no scenes: a plain bed (two bars of intro, then everything)
        for b in range(int(seconds / bar) + 2):
            bar_pattern(b * bar, b, b >= 2)
    else:
        # 1. the hook: curious and sparse. A soft pad, a bass pulse and a little rising marimba question, no drums yet
        hook_end = jump if jump is not None else pull
        for b in range(int(hook_end / bar) + 1):
            t0 = b * bar; root, tri = PROG[b % 4]; r = 48 + key + root
            for iv in tri:
                put("hook", pad(note(r + iv), bar * 1.05), t0, 0.07)
            for q in (0, 2):
                put("hook", bass(note(r - 12), beat * 0.8), t0 + q * beat, 0.32)
            for k, (ofs, sc) in enumerate(((1.0, 4), (1.5, 7), (2.0, 9), (3.0, 12))):   # up, up, up... a question
                put("hook", pluck(note(r + 24 + SCALE[min(sc // 2, 7)] - (0 if b % 2 == 0 else 2)), beat * 0.5, 0.35), t0 + ofs * beat, 0.13)
        # 2. the jump: a rising sweep and a roll of ticks, then silence for a breath
        if jump is not None:
            d = pull - jump
            put("fx", sweep(260, 1500, d, 1.6), jump, 0.18)
            ts, step = jump, d / 5.0
            for k in range(14):
                put("fx", hat(rng, 0.04), jump + d * (1 - (1 - k / 14) ** 1.6), 0.05 + 0.2 * k / 14)
        # 3. the pull: an impact, then the whole beat in time with the blind
        put("fx", crash(rng), pull, 0.30)
        put("fx", kick(0.4), pull, 1.1)
        for iv in (0, 4, 7, 12):
            put("fx", pluck(note(60 + key + iv), 1.2, 0.8), pull, 0.16)
        put("fx", bass(note(36 + key), 1.2), pull, 0.6)
        end_beat = stop if stop is not None else seconds
        b, t0 = 0, pull
        while t0 < end_beat + 0.2:
            bar_pattern(t0, b, b >= 1, "beat", 1.0, drums=True)
            t0 += bar; b += 1
        be = np.ones(n); i0 = int(end_beat * SR)
        if i0 < n:
            fade = int(0.35 * SR); be[i0:i0 + fade] = np.linspace(1, 0, min(fade, n - i0)); be[i0 + fade:] = 0
        L["beat"] *= be
        # 4. the whirl: a swirling descent while the water takes them, bubbles falling
        if stop is not None and card is not None:
            wd = card - stop
            put("fx", sweep(1100, 90, wd, 0.8, tremolo=5.0), stop, 0.22)
            for k in range(int(wd / 0.17)):
                put("fx", pluck(note(84 - 2 * (k % 7) - k // 4), 0.22, 0.4), stop + 0.1 + k * 0.17, 0.10 * (1 - 0.5 * k * 0.17 / wd))
            # 5. the end card: a bright chime and a light jingle until the end
            for k, iv in enumerate((0, 4, 7, 11, 14, 19)):
                put("fx", pluck(note(72 + key + iv), 1.4, 0.8), card - 0.05 + k * 0.06, 0.15)
            put("fx", kick(0.4), card, 1.0); put("fx", clap(rng), card + 0.02, 0.5); put("fx", crash(rng, 1.0), card, 0.18)
            b, t0 = 0, card + beat
            while t0 < seconds:
                bar_pattern(t0, b + 1, True, "fx", 0.6, drums=(b % 2 == 1))
                t0 += bar; b += 1
    mix = (L["hook"] + L["beat"] + L["fx"])[:int(seconds * SR)]
    peak = np.max(np.abs(mix)) or 1.0
    mix = mix / peak * 0.85
    f = int(0.4 * SR); mix[:f] *= np.linspace(0, 1, f)
    o = int(2.0 * SR); mix[-o:] *= np.linspace(1, 0, o)
    return mix.astype(np.float32)


def write_wav(path, x):
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(x, -1, 1) * 32767).astype("<i2").tobytes())


def cues_of(slug):
    ep = json.loads((Path(__file__).resolve().parents[1] / "episodes" / slug / "episode.json").read_text(encoding="utf-8"))
    tm = json.loads((Path(__file__).resolve().parents[1] / "episodes" / slug / "timings.json").read_text(encoding="utf-8"))
    ti, to = ep.get("intro") or {}, ep.get("outro") or {}
    c = {k: ti[k] for k in ("jumpAt", "pullAt") if k in ti}
    c.update({k: to[k] for k in ("vortexAt", "cardAt") if k in to})
    return c


if __name__ == "__main__":
    a = sys.argv[1:]
    if len(a) < 2:
        sys.exit(__doc__)
    opt = lambda k, d: type(d)(a[a.index(k) + 1]) if k in a else d
    key = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7}.get(str(opt("--key", "C")), 0)
    cues = cues_of(opt("--episode", "")) if "--episode" in a else None
    write_wav(a[1], render(float(a[0]), opt("--bpm", 108), opt("--seed", 7), key, cues))
    print("music:", a[1], "cues:", cues or "none")
