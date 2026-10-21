"""Builds the dialogue of an episode: one take per line from the project's TTS provider (Cartesia or ElevenLabs), cached by what it says and how, locked takes, pauses, timings.
   python tools/dialog.py <slug> [--prune]
Reads episodes/<slug>/script.json: [{"who": "<character id>", "text": "...", "tone": "name", "gap": 0.5 | "breath", "speed": .., "volume": .., "level": ..}]
Writes episodes/<slug>/takes/*.wav (kept: so the episode can be rebuilt without calling the API), dialog.wav, dialog.mp3, timings.json.
A line is remembered by a hash of (voice, text, speed, volume, settings): change the words or the acting and only that line is made again."""
import hashlib
import json
import sys

import numpy as np

from common import ROOT, SR, characters, ep_dir, ffmpeg, gaps, leveled, load_json, project, read_audio, save_json, write_wav
from tts import synth


def params(ln, ch, provider):
    cv = ch["voice"].get(provider) or {}
    if not cv.get("id"):
        sys.exit(f"character '{ch['id']}' has no {provider} voice yet: python tools/tts.py voices --provider {provider} --language <code>, then put the id in characters/{ch['id']}/character.json under voice.{provider}.id")
    tone = ch["tones"].get(ln["tone"]) if ln.get("tone") else None
    if ln.get("tone") and tone is None:
        sys.exit(f"unknown tone '{ln['tone']}' for {ch['id']} (see characters/{ch['id']}/character.json)")
    p = {"speed": cv.get("speed", 1.0), "volume": cv.get("volume", 1.0), "level": ch["voice"].get("level", 1.0), **({k: tone[k] for k in ("speed", "volume", "level") if k in tone} if tone else {})}
    for k in ("speed", "volume", "level"):
        if k in ln:
            p[k] = ln[k]
    return p


def gap_of(ln, G):
    g = ln.get("gap", 0.5)
    if isinstance(g, str):
        if g not in G:
            sys.exit(f"unknown gap '{g}' ({', '.join(G)})")
        return float(G[g])
    return float(g)


def cache_key(ln, p, ch, provider):
    cv = ch["voice"][provider]
    if provider == "cartesia":   # the same signature as before, so takes made earlier are still found
        sig = [cv["id"], ln["text"], p["speed"], p["volume"], cv.get("emotion", "neutral")]
    else:
        sig = [provider, cv["id"], ln["text"], p["speed"], cv.get("stability"), cv.get("similarity"), cv.get("style")]
    return ln["who"] + "_" + hashlib.sha1(json.dumps(sig, ensure_ascii=False).encode("utf-8")).hexdigest()[:12]


def build(slug, prune=False):
    d = ep_dir(slug)
    proj = project()
    provider = proj["tts"]["provider"]
    chars = {c["id"]: c for c in characters(proj)}
    G = gaps()
    script = load_json(d / "script.json")
    takes = d / "takes"
    parts, timings, t, used = [], [], 0.0, set()
    new = 0
    for i, ln in enumerate(script):
        ch = chars.get(ln["who"])
        if ch is None:
            sys.exit(f"line {i}: who='{ln['who']}' is not one of this project's characters ({', '.join(chars)})")
        p = params(ln, ch, provider)
        vid = f"{provider}:{(ch['voice'].get(provider) or {}).get('id')}"
        lk = next((ROOT / "characters" / ch["id"] / e["file"] for e in ch.get("locked_takes", []) if e["text"] == ln["text"] and e.get("voice") == vid), None)   # a take the author locked: used as it is, never made again
        if lk is not None:
            if not lk.exists():
                sys.exit(f"locked take missing: {lk}")
            src = lk
        else:
            src = takes / (cache_key(ln, p, ch, provider) + ".wav")
            if not src.exists():
                print(f"  new line {i}: {ln['text']}")
                synth(provider, ln["text"], ch["voice"][provider], p, proj, src)
                new += 1
            used.add(src.name)
        x = leveled(read_audio(src), 2600 * p["level"], 0.4, 8.0)   # every line to the same loudness, `level` keeps the acting softer or louder
        gap = gap_of(ln, G)
        if gap > 0:
            parts.append(np.zeros(int(round(gap * SR)), dtype=np.float32)); t += gap
        parts.append(x)
        timings.append({"who": ln["who"], "text": ln["text"], "start": round(t, 3), "end": round(t + len(x) / SR, 3)})
        t += len(x) / SR
    dialog = np.concatenate(parts) if parts else np.zeros(1, dtype=np.float32)
    write_wav(d / "dialog.wav", dialog)
    ffmpeg("-i", d / "dialog.wav", "-b:a", "192k", d / "dialog.mp3")
    save_json(d / "timings.json", timings)
    if prune and takes.is_dir():
        for f in takes.glob("*.wav"):
            if f.name not in used:
                f.unlink(); print("  pruned unused take", f.name)
    print(f"dialog: {len(script)} lines, {t:.2f} s, {new} new takes ({provider}) -> {d / 'dialog.mp3'}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    build(sys.argv[1], "--prune" in sys.argv)
