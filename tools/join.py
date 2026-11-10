"""python tools/episode.py join <slugA> <slugB> [--transition slidedown|cut|whip] [--dur 0.6] [--out <file.mp4>]
Joins the latest MP4 of two episodes into one: a crossfade/slide on the picture, the second one's sound starts under the transition,
a whoosh on the slide, a limiter, and the peak kept under -1 dB. (What used to be done by hand with ffmpeg: an episode + its CTA.)"""
import re
import subprocess
import sys

from common import ASSETS, FPS, OUT, ffmpeg, load_json, run

XF = {"slidedown": "slidedown", "whip": "slideleft", "cut": None}


def _info(f):
    r = run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=width,height,codec_type", "-of", "default=nw=1", str(f)]).stdout
    return float(re.search(r"duration=([\d.]+)", r).group(1)), int(re.search(r"width=(\d+)", r).group(1)), int(re.search(r"height=(\d+)", r).group(1))


def _whoosh():
    lib = load_json(ASSETS / "sfx" / "library.json")["items"]
    f = ASSETS / "sfx" / lib["whoosh"]["file"]
    return f if f.exists() else None


def join(a, b, transition="slidedown", dur=0.6, out=None):
    from episode import latest_mp4
    A, B = latest_mp4(a), latest_mp4(b)
    da, wa, ha = _info(A)
    db, wb, hb = _info(B)
    if transition not in XF:
        sys.exit(f"transition must be one of {list(XF)}")
    dst = out or (OUT / f"{a}__{b}_joined.mp4")
    scale = f"scale={wa}:{ha}:flags=lanczos,setsar=1,fps={FPS},format=yuv420p"
    if XF[transition] is None:
        dur = 0.0
        vf = f"[0:v]{scale}[a];[1:v]{scale}[b];[a][b]concat=n=2:v=1:a=0[v];"
        off = da
    else:
        off = da - dur
        vf = f"[0:v]{scale}[a];[1:v]{scale}[b];[a][b]xfade=transition={XF[transition]}:duration={dur}:offset={off:.3f}[v];"
    d_ms = int(off * 1000)
    wh = _whoosh() if transition != "cut" else None
    inputs = ["-i", str(A), "-i", str(B)] + (["-i", str(wh)] if wh else [])
    af = f"[0:a]aresample=48000,apad,atrim=0:{da:.3f}[a0];[1:a]aresample=48000,adelay={d_ms}|{d_ms}[a1];[a0][a1]amix=inputs=2:duration=longest:normalize=0[m]"
    if wh:
        wm = max(0, int((off - 0.05) * 1000))
        af += f";[2:a]aresample=48000,volume=0.5,adelay={wm}|{wm}[w];[m][w]amix=inputs=2:duration=first:normalize=0[m2]"
        last = "m2"
    else:
        last = "m"
    af += f";[{last}]alimiter=limit=0.89:level=disabled[a]"   # 0.89 = -1 dBFS
    ffmpeg(*inputs, "-filter_complex", vf + af, "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-c:a", "aac", "-b:a", "160k", "-r", str(FPS), "-movflags", "+faststart", dst)
    vol = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(dst), "-af", "volumedetect", "-f", "null", "-"], capture_output=True, text=True).stderr
    peak = re.search(r"max_volume: (-?[\d.]+) dB", vol)
    tot, _, _ = _info(dst)
    print(f"join: {dst}\n  {tot:.2f}s ({da:.2f} + {db:.2f} - {dur}), transition {transition}, peak {peak.group(1) + ' dB' if peak else '?'}")
    return dst
