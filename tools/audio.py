"""The soundtrack of an episode: the dialogue, a quiet room, a very thin soft piano that steps back while somebody speaks, a background ambience,
and sound effects that sit on the things that happen on screen (each visible cause has its sound).
   python tools/audio.py <slug>          -> out/<slug>/audio.wav (48 kHz stereo, about -16 LUFS, a fade at the end)
   python tools/audio.py <slug> --sfx    only make sure every sound effect the episode uses exists (generates missing ones through ElevenLabs)
Sound effects used by an episode are listed in episode.json ("sfx"), and derived from its causes: a flickering lamp -> lamp_flicker, the phone -> phone_rise,
the moment outside -> its sound, every change of screen page -> soft_click (or the "sfx" named in that page change)."""
import json
import os
import shutil
import sys
import urllib.error
import urllib.request

import numpy as np

from common import ASSETS, IS_WINDOWS, OUT, ROOT, SR, Clock, ep_dir, ffmpeg, has_key, keys_env, leveled, load_json, mix_in, out_dir, read_audio, run, total_of, world, write_wav

LIB = load_json(ASSETS / "sfx" / "library.json")
ITEMS = LIB["items"]
WORLD = world()


def sfx_path(name):
    """The audio file of a library sound; generated through ElevenLabs the first time (and then kept in the repo)."""
    if name not in ITEMS:
        sys.exit(f"unknown sound effect '{name}' (see assets/sfx/library.json)")
    it = ITEMS[name]
    if it["source"] == "kit":
        return ASSETS / "sfx" / it["file"]
    f = ASSETS / "sfx" / "generated" / (name + ".mp3")
    if not f.exists() and not has_key("ELEVENLABS_API_KEY"):
        print(f"  sound '{name}' is not generated yet and there is no ELEVENLABS_API_KEY: using the bundled 'whoosh' instead")
        return ASSETS / "sfx" / ITEMS["whoosh"]["file"]
    if not f.exists():
        key = keys_env("ELEVENLABS_API_KEY")
        body = json.dumps({"text": it["prompt"], "duration_seconds": it["duration"], "prompt_influence": 0.5}).encode()
        req = urllib.request.Request("https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128", data=body, method="POST", headers={"xi-api-key": key, "Content-Type": "application/json"})
        try:
            raw = urllib.request.urlopen(req, timeout=180).read()
        except urllib.error.HTTPError as e:
            sys.exit(f"ElevenLabs error {e.code}: {e.read().decode()[:300]}")
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_bytes(raw)
        print("  generated sound effect", name)
    return f


def sfx_audio(name, spec=None):
    """A library sound, or the owner's own attached file: {"at": .., "file": "episodes/<slug>/audio/x.mp3", "rms": 1200}."""
    if spec and spec.get("file"):
        return leveled(read_audio(ROOT / spec["file"]), float(spec.get("rms", 1200)))
    return leveled(read_audio(sfx_path(name)), ITEMS[name]["rms"])


# ------------------------------------------------------------------ what happens when (the events the sounds follow)
def events_of(ep, clock):
    """[(time, sound, gain)] for every visible cause plus the explicit list."""
    ev = []
    for e in ep.get("lightEvents", []):
        if e["type"] == "flicker" and e.get("sfx", "lamp_flicker"):
            ev.append((clock(e["at"]), e.get("sfx", "lamp_flicker"), 1.0, None))
    if ep.get("phone") and ep["phone"].get("sfx", "phone_rise"):
        ev.append((clock(ep["phone"]["at"]), ep["phone"].get("sfx", "phone_rise"), 1.0, None))
    o = ep.get("outside")
    osfx = WORLD.get("outsideSfx", {})
    if o and o.get("sfx", osfx.get(o["type"], "whoosh")):
        ev.append((clock(o["at"]) - 0.3, o.get("sfx", osfx.get(o["type"], "whoosh")), 1.0, None))
    for s in ep.get("screen", []):
        name = s.get("sfx", "soft_click")
        if name:
            ev.append((clock(s["at"]), name, 1.0, None))
    for s in ep.get("sfx", []):
        ev.append((clock(s["at"]), s.get("name") or s["file"], float(s.get("gain", 1.0)), s))
    return sorted(ev, key=lambda e: e[0])


# ------------------------------------------------------------------ the thin piano
PROGS = {   # four chords, four seconds each
    "sad": [(45, [57, 60, 64]), (41, [53, 57, 60]), (48, [55, 60, 64]), (43, [55, 59, 62])],     # Am F C G
    "calm": [(48, [60, 64, 67]), (45, [57, 60, 64]), (41, [53, 57, 60]), (43, [55, 59, 62])],    # C Am F G
    "cheerful": [(48, [60, 64, 67]), (43, [55, 59, 62]), (45, [57, 60, 64]), (41, [53, 57, 60])],     # C G Am F
}


def piano_bed(slug, secs, mood):
    eng = out_dir(slug) / "engine"
    (eng / "scripts").mkdir(parents=True, exist_ok=True)
    (eng / "assets" / "audio").mkdir(parents=True, exist_ok=True)
    src = (ASSETS / "audio_engine" / "make-audio.mjs").read_text(encoding="utf-8")
    import re
    src = re.sub(r"const DUR = \d+;", f"const DUR = {int(np.ceil(secs))};", src, count=1)
    a, b = src.index("if (PART === 'music') {"), src.index("// ===== SCORE END")
    prog = json.dumps([{"bass": bs, "ch": ch} for bs, ch in PROGS[mood]])
    score = f"""if (PART === 'music') {{
  /* a very thin, soft piano under the dialogue, one chord every four seconds */
  const PROG = {prog};
  for (let bar = 0; bar < Math.ceil(DUR / 4); bar++) {{
    const c = PROG[bar % 4], t0 = bar * 4;
    piano(t0, c.bass, 0.30, 3.8);
    for (let k = 0; k < 6; k++) piano(t0 + 0.55 + k * 0.58, c.ch[k % 3] + (k >= 3 ? 12 : 0), 0.20 + 0.04 * (k % 2), 2.4);
    if (bar % 4 === 3) celesta(t0 + 3.2, c.ch[2] + 24, 0.16, 1.4);   // a faint sparkle every fourth chord
  }}
}} else {{
  /* no sound effects here: tools/audio.py mixes them in */
}}

"""
    (eng / "scripts" / "make-audio.mjs").write_text(src[:a] + score + src[b:], encoding="utf-8")
    (eng / "assets" / "cues.js").write_text("window.CUE = {DUR: %d, BEAT: 0.5};\n" % int(np.ceil(secs)), encoding="utf-8")
    run(["node", "scripts/make-audio.mjs"], cwd=eng, env={**os.environ, "PART": "music"})
    return read_audio(eng / "assets" / "audio" / "music.wav")


def room_tone(secs):
    """The room at night: a fan and the air (brown noise), a low hum, a tiny hiss of the lamp."""
    tmp = OUT / "_room_tone.wav"
    tmp.parent.mkdir(exist_ok=True)
    ffmpeg("-f", "lavfi", "-i", f"anoisesrc=d={secs}:c=brown:a=0.5:r={SR}", "-f", "lavfi", "-i", f"sine=f=118:d={secs}:r={SR}", "-f", "lavfi", "-i", f"anoisesrc=d={secs}:c=pink:a=0.2:r={SR}",
           "-filter_complex", "[0]lowpass=f=300,volume=-25dB[a];[1]volume=-48dB[b];[2]highpass=f=2500,lowpass=f=7000,volume=-53dB[c];[a][b][c]amix=inputs=3:normalize=0,aformat=sample_fmts=s16:channel_layouts=mono",
           "-ar", SR, tmp)
    x = read_audio(tmp)
    tmp.unlink()
    return x


def loop_to(x, n, fade=0.5):
    f = int(fade * SR)
    out = np.zeros(n, dtype=np.float32)
    pos = 0
    ramp = np.linspace(0, 1, f, dtype=np.float32)
    while pos < n:
        seg = x.copy()
        seg[:f] *= ramp
        seg[-f:] *= ramp[::-1]
        end = min(n, pos + len(seg))
        out[pos:end] += seg[:end - pos]
        pos += len(seg) - f
    return out


def build(slug):
    d = ep_dir(slug)
    ep = load_json(d / "episode.json")
    lines = load_json(d / "timings.json")
    total = total_of(ep, lines)
    clock = Clock(lines, total)
    n = int(round(total * SR))
    mix = room_tone(total)[:n] if WORLD.get("roomTone") else np.zeros(n, dtype=np.float32)
    mix = np.pad(mix, (0, max(0, n - len(mix))))

    amb = ep.get("ambience", True)
    if amb:   # the sound of what is outside the window
        name = amb if isinstance(amb, str) else WORLD.get("ambience", {}).get(ep.get("scene", {}).get("bg") or WORLD.get("defaultBackground"))
        if name:
            mix += loop_to(leveled(read_audio(sfx_path(name)), ITEMS[name]["rms"]), n)

    dlg = read_audio(d / "dialog.wav")
    mood = ep.get("music", {}).get("mood", "sad")
    mu = ep.get("music", {})
    if mu.get("enabled", True):
        raw_music = read_audio(ROOT / mu["file"]) if mu.get("file") else piano_bed(slug, total, mood)   # the owner's own music file, or the thin piano
        pn = leveled(raw_music[:n], float(mu.get("rms", 330)))       # about 18 dB under the speech
        step = int(0.02 * SR)
        duck, ducked = 1.0, np.zeros(len(pn), dtype=np.float32)
        spans = [(ln["start"] - 0.05, ln["end"] + 0.1) for ln in lines]
        for k in range(0, len(pn), step):
            t = k / SR
            goal = 0.55 if any(a <= t <= b for a, b in spans) else 1.0
            duck += (goal - duck) * 0.08                              # eases, no pumping
            ducked[k:k + step] = pn[k:k + step] * duck
        mix[:len(ducked)] += ducked
    mix_in(mix, dlg, 0.0)
    for t, name, gain, spec in events_of(ep, clock):
        mix_in(mix, sfx_audio(name, spec), t, gain)

    o = out_dir(slug)
    raw = o / "_mix_raw.wav"
    write_wav(raw, mix)
    fade_out = float(ep.get("fadeOut", 1.3))
    ffmpeg("-i", raw, "-af", f"afade=t=out:st={total - fade_out}:d={fade_out},loudnorm=I=-16:TP=-1.5:LRA=9", "-ar", 48000, "-ac", 2, o / "audio.wav")
    raw.unlink()
    print(f"audio: {total:.1f} s -> {o / 'audio.wav'}")


def ensure_sfx(slug):
    d = ep_dir(slug)
    ep = load_json(d / "episode.json")
    lines = load_json(d / "timings.json") if (d / "timings.json").exists() else [{"start": 0, "end": 1}]
    clock = Clock(lines, total_of(ep, lines))
    need = {name for _, name, _, spec in events_of(ep, clock) if not (spec and spec.get("file"))}
    amb = ep.get("ambience", True)
    if amb:
        nm = amb if isinstance(amb, str) else WORLD.get("ambience", {}).get(ep.get("scene", {}).get("bg") or WORLD.get("defaultBackground"))
        if nm:
            need.add(nm)
    for name in sorted(need):
        sfx_path(name)
    print("sound effects ready:", ", ".join(sorted(need)))


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    ensure_sfx(sys.argv[1]) if "--sfx" in sys.argv else build(sys.argv[1])
