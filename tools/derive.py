"""Things derived from the dialogue: the mouth (loudness per video frame) and the subtitles.
   python tools/derive.py <slug>
Writes episodes/<slug>/lipsync.json and episodes/<slug>/subs.ass (white sans, one line at a time, in the upper third, no speaker labels, like the reference video)."""
import sys

import numpy as np

from common import FPS, IS_WINDOWS, SR, ep_dir, fmt_sizes, load_json, project, read_audio, save_json


def lipsync(slug):
    d = ep_dir(slug)
    timings = load_json(d / "timings.json")
    x = read_audio(d / "dialog.wav")
    win = int(SR * 0.045)                     # 45 ms: follows syllables, not single waves
    n = int(len(x) / SR * FPS) + 1
    env = np.zeros(n)
    for f in range(n):
        c = int(f / FPS * SR)
        seg = x[max(0, c - win):c + win]
        env[f] = float(np.sqrt(np.mean(np.square(seg.astype(np.float64)))) * 32768) if len(seg) else 0.0
    peak = float(np.sort(env)[int(len(env) * 0.95)]) or 1.0
    frames = []
    for f in range(n):
        t = f / FPS
        who = None
        for ln in timings:
            if ln["start"] <= t <= ln["end"]:
                who = ln["who"]
        lvl = min(1.0, env[f] / peak) if who else 0.0
        frames.append({"who": who, "level": round(lvl ** 0.8, 3)})
    save_json(d / "lipsync.json", {"fps": FPS, "duration": round(len(x) / SR, 3), "frames": frames, "lines": timings}, indent=None)
    print(f"lipsync: {len(frames)} frames")


def ts(t):
    h, m, s = int(t // 3600), int(t % 3600 // 60), t % 60
    return f"{h}:{m:02d}:{s:05.2f}"


def wrap(text, width=31):
    if len(text) <= width:
        return text
    best = min((abs(i - len(text) // 2), i) for i, ch in enumerate(text) if ch == " ")[1]
    return text[:best] + "\\N" + text[best + 1:]


def subs(slug):
    proj = project()
    W, H = fmt_sizes(proj)[1]
    portrait = H > W
    d = ep_dir(slug)
    lines = load_json(d / "timings.json")
    ep = load_json(d / "episode.json")
    script = load_json(d / "script.json")   # a line may carry "caption": what is shown, when it differs from what is spoken ("tri di" said, "3D" shown)
    dfl = proj.get("defaults", {})   # project.json -> defaults: "subtitlePos" ("top" | "bottom" | "auto") and "subtitleTop" (how far down the top subtitle starts, a fraction of the height)
    dirs, mode = ep.get("directions", []), (ep.get("subtitles") or {}).get("pos") or dfl.get("subtitlePos", "auto")   # "top" | "bottom" | "auto": top third, except in shots where the heads are there (wide, two-shot, high angles); per line: directions[i].subs = "top" | "bottom"
    font = "Segoe UI Semibold" if IS_WINDOWS else "DejaVu Sans"
    head = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,{font},{round(H * (0.0285 if portrait else 0.05))},&H00FFFFFF,&H00FFFFFF,&H99000000,&H66000000,0,0,0,0,100,100,0,0,1,{round(H * 0.0016, 1)},{round(H * 0.0012, 1)},{8 if portrait else 2},{round(W * 0.07)},{round(W * 0.07)},{round(H * (dfl.get('subtitleTop', 0.255) if portrait else 0.08))},1
Style: SubBottom,{font},{round(H * (0.0285 if portrait else 0.05))},&H00FFFFFF,&H00FFFFFF,&H99000000,&H66000000,0,0,0,0,100,100,0,0,1,{round(H * 0.0016, 1)},{round(H * 0.0012, 1)},2,{round(W * 0.07)},{round(W * 0.07)},{round(H * 0.07)},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    ev = []
    for i, ln in enumerate(lines):
        end = ln["end"] + 0.18
        if i + 1 < len(lines):
            end = min(end, lines[i + 1]["start"] - 0.02)
        x = dirs[i] if i < len(dirs) else {}
        pos = x.get("subs") or mode
        if pos == "auto":
            from direct import shot_kind
            pos = "bottom" if shot_kind(x.get("cam"), ep) in ("wide", "two", "high") else "top"   # where the heads are, the top third is not free
        ev.append(f"Dialogue: 0,{ts(ln['start'])},{ts(end)},{'SubBottom' if pos == 'bottom' else 'Sub'},,0,0,0,,{wrap((script[i].get('caption') if i < len(script) else None) or ln['text'], 31 if portrait else 52)}")
    (d / "subs.ass").write_text(head + "\n".join(ev) + "\n", encoding="utf-8")
    print(f"subtitles: {len(ev)} lines ({font})")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    lipsync(sys.argv[1])
    subs(sys.argv[1])
