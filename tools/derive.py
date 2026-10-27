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


def _chunks(text, max_words=4, max_chars=24):
    """Split a caption into short phrases that read well: a sentence end or a comma closes a phrase once it has 2+ words, otherwise at 4 words / 24 characters;
    a lone short word is never left on its own (it joins the phrase before it)."""
    words, out, cur = text.split(), [], []
    plain = lambda ws: " ".join(ws).replace("*", "")
    for w in words:
        cur.append(w)
        end = w.rstrip("*")[-1:] in ",.?!…"
        if (len(cur) >= 2 and end) or len(cur) >= max_words or len(plain(cur)) >= max_chars:
            out.append(cur); cur = []
    if cur:
        out.append(cur)
    merged = []
    for c in out:
        if merged and len(c) == 1 and len(plain(merged[-1] + c)) <= max_chars + 12:
            merged[-1] = merged[-1] + c
        else:
            merged.append(c)
    return [" ".join(c) for c in merged]


def _words_mode(text, units):
    """One word at a time; a name that belongs together ("Play Store", "Mode Bisnis" ...: episode.json subtitles.units) stays ONE chunk."""
    import re
    glue = chr(1)
    for u in sorted(units, key=len, reverse=True):
        text = re.sub(re.escape(u), lambda m: m.group(0).replace(" ", glue), text, flags=re.I)
    return [w.replace(glue, " ") for w in text.split()]


def _chunk_times(ln, chunks, frames):
    """When each chunk starts, from where the voice really has energy (a pause inside a line pushes the next phrase later), not from the clock alone."""
    a, b = int(ln["start"] * FPS), max(int(ln["start"] * FPS) + 1, int(ln["end"] * FPS))
    lv = [max(0.0, float(f.get("level") or 0)) for f in frames[a:b]] or [1.0]
    tot = sum(lv) or 1.0
    cum, acc = [], 0.0
    for v in lv:
        acc += v; cum.append(acc / tot)
    n = [len(c.replace("*", "").replace(" ", "")) for c in chunks]; total = sum(n) or 1
    starts, done = [ln["start"]], 0
    for k in range(len(chunks) - 1):
        done += n[k]; frac = done / total
        idx = next((i for i, c in enumerate(cum) if c >= frac), len(cum) - 1)
        starts.append(max(starts[-1] + 0.14, (a + idx) / FPS))
    return starts


def subs_pop(slug):
    """Captions that follow the talking: short phrases pop in at ONE fixed place as they are said, key words in colour, shouted lines bigger.
    episode.json "subtitles": { "style": "pop", "y": 0.91 (fraction of the height), "size": 0.04, "outline": "#0B4A52", "accent": "#FFD84A", "words": true (one word at a time), "units": ["Play Store"] (stay as one) }
    script line: "caption" (what is shown), "*word*" marks a key word, "capstyle": "shout" | "whisper"""
    proj = project(); W, H = fmt_sizes(proj)[1]
    d = ep_dir(slug); lines = load_json(d / "timings.json"); ep = load_json(d / "episode.json"); script = load_json(d / "script.json")
    frames = load_json(d / "lipsync.json").get("frames", [])
    st = ep.get("subtitles") or {}
    bgr = lambda hx: "&H00" + hx[5:7] + hx[3:5] + hx[1:3] + "&"
    acc, outl = bgr(st.get("accent", "#FFD84A")), bgr(st.get("outline", "#0B4A52"))
    size, y, x = round(H * st.get("size", 0.034)), round(H * st.get("y", 0.575)), W // 2
    font = "Segoe UI Semibold" if IS_WINDOWS else "DejaVu Sans"
    head = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Pop,{font},{size},&H00FFFFFF,&H00FFFFFF,{outl},&H88000000,1,0,0,0,100,100,0,0,1,{round(H * 0.0042, 1)},{round(H * 0.0016, 1)},5,{round(W * 0.07)},{round(W * 0.07)},0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    ev = []
    for i, ln in enumerate(lines):
        sc = script[i] if i < len(script) else {}
        cap = sc.get("caption") or ln["text"]
        kind = sc.get("capstyle", "normal")
        chunks = _words_mode(cap, st.get("units", [])) if st.get("words") else (_chunks(cap, 3, 16) if kind == "shout" else _chunks(cap))   # words: one word at a time, a name stays whole; a shout is drawn bigger: shorter phrases so it never runs off the picture
        starts = _chunk_times(ln, chunks, frames)
        line_end = ln["end"] + 0.2
        if i + 1 < len(lines):
            line_end = min(line_end, lines[i + 1]["start"] - 0.02)
        emph = False   # *key words* can span several words and several phrases
        for k, ch in enumerate(chunks):
            end = (starts[k + 1] if k + 1 < len(chunks) else line_end)
            if k + 1 < len(chunks):
                end = max(starts[k] + 0.2, end)
            words = []
            for w in ch.split():
                if w.startswith("*"):
                    emph = True
                core = w.replace("*", "")
                words.append((r"{\c" + acc + r"\fscx112\fscy112}" + core + r"{\c&HFFFFFF&\fscx100\fscy100}") if emph else core)
                if w.rstrip(".,!?…").endswith("*"):
                    emph = False
            body = " ".join(words)
            if kind == "shout":
                base = "&H00FFFFFF&" if "*" in cap else acc   # a shout with a key word: white with the key word in colour; a pure shout ("UWAAA"): all in colour
                tag = r"{\an5\pos(%d,%d)\fs%d\c%s\fscx70\fscy70\frz-3\t(0,90,\fscx108\fscy108\frz2)\t(90,170,\fscx100\fscy100\frz0)\fad(30,40)}" % (x, y, round(size * 1.3), base)
            elif kind == "whisper":
                tag = r"{\an5\pos(%d,%d)\fs%d\alpha&H30&\fad(120,160)}" % (x, y, round(size * 0.82))
            else:
                tag = r"{\an5\pos(%d,%d)\fscx86\fscy86\t(0,120,\fscx100\fscy100)\fad(50,60)}" % (x, y)
            ev.append(f"Dialogue: 0,{ts(starts[k])},{ts(end)},Pop,,0,0,0,,{tag}{body}")
    (d / "subs.ass").write_text(head + "\n".join(ev) + "\n", encoding="utf-8")
    print(f"subtitles (pop): {len(ev)} phrases from {len(lines)} lines ({font})")


def subs(slug):
    if ((load_json(ep_dir(slug) / "episode.json").get("subtitles")) or {}).get("style") == "pop":
        return subs_pop(slug)
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
