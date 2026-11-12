"""Beat map of a song, so that scene changes and impacts of a video land exactly on the music ("beat-sync" engine, /beat-3d).
    python tools/beat_analyze.py map  <song.mp3> [--out beatmap.json] [--bpm 130,146] [--first 90]   tempo, offset, energy per bar, drops, breaks, strongest accents
    python tools/beat_analyze.py cut  <song.mp3> --keep 0:24 --keep 30: --out cut.wav [--bpm 138 --offset 0.06]   keep bar ranges (a:b, b optional = to the end), joined on bar lines with a tiny crossfade
The grid is bar b starts at  offset + b * 4 * 60 / bpm  (4/4). Needs numpy + scipy + soundfile (the lemo-opuscar venv has them) and ffmpeg.
"""
import argparse, json, os, subprocess, sys, tempfile
import numpy as np


def _load(path, first=None):
    import soundfile as sf
    tmp = os.path.join(tempfile.gettempdir(), 'beat_analyze_tmp.wav')
    cmd = ['ffmpeg', '-y', '-v', 'error'] + (['-t', str(first)] if first else []) + ['-i', path, '-ac', '1', '-ar', '22050', tmp]
    subprocess.run(cmd, check=True)
    x, sr = sf.read(tmp); os.remove(tmp); return x, sr


def analyze(path, bpm_range=(110, 175), first=None):
    from scipy.signal import butter, sosfilt, stft, find_peaks
    x, sr = _load(path, first)
    lo = sosfilt(butter(4, 150, 'low', fs=sr, output='sos'), x)
    hop = 256; n = len(lo) // hop
    env = np.sqrt((lo[:n * hop].reshape(n, hop) ** 2).mean(1)); fr = sr / hop
    d = np.maximum(0, np.diff(env, prepend=0)); d /= d.max() + 1e-9
    # tempo + phase: comb of kicks over the loudest 40 s window
    seg = d
    best = None
    for bpm in np.arange(bpm_range[0], bpm_range[1], 0.05):
        per = 60 / bpm * fr
        for off in np.arange(0, per, 0.5):
            idx = (off + np.arange(0, int(len(seg) / per)) * per).astype(int); idx = idx[idx < len(seg)]
            sc = seg[idx].sum()
            if best is None or sc > best[0]: best = (sc, bpm, off / fr)
    _, bpm, off = best
    beat = 60 / bpm; bar_s = 4 * beat
    # the kick detector lags the true onset by about one window: refine the offset on broadband flux
    f, t, Z = stft(x, sr, nperseg=1024, noverlap=1024 - hop); M = np.log1p(np.abs(Z) * 20)
    flux = np.maximum(0, np.diff(M, axis=1, prepend=M[:, :1])).sum(0); flux /= flux.max() + 1e-9
    ph = (t - off) / beat; ph = ph - np.round(ph)    # distance (in beats) of every frame to the nearest grid beat
    w = flux > 0.3
    if w.sum() > 10: off += float(np.median(ph[w])) * beat - 0.012   # 0.012 s = half the stft window (the peak shows after the onset)
    off = float(off % beat)
    # the kick sits on beats 0 and 2 (and the snare on 1 and 3), so the comb cannot tell which beat is the bar line: choose the phase (0..3 beats) where the energy jumps most at the bar starts (drops start on a bar line)
    def _jump(o):
        tot = 0.0
        for b in range(0, int((len(x) / sr - o) / bar_s)):
            t0 = o + b * bar_s; i0 = int(t0 * sr); w = int(0.2 * sr)
            if i0 - w < 0 or i0 + w > len(x): continue
            tot += max(0.0, float(np.sqrt(np.mean(x[i0:i0 + w] ** 2)) - np.sqrt(np.mean(x[i0 - w:i0] ** 2))))
        return tot
    off = float(max((off + k * beat for k in range(4)), key=_jump)); off = off % bar_s if off >= bar_s else off
    nbars = int((len(x) / sr - off) / bar_s)
    rms = np.array([np.sqrt(np.mean(x[int((off + i * beat) * sr):int((off + (i + 1) * beat) * sr)] ** 2)) if int((off + (i + 1) * beat) * sr) <= len(x) else 0 for i in range(nbars * 4)]).reshape(nbars, 4) * 100
    en = rms.mean(1)
    ref = np.percentile(en, 85) + 1e-9
    level = ['loud' if e > 0.6 * ref else ('mid' if e > 0.28 * ref else 'quiet') for e in en]
    drops = [int(b) for b in range(1, nbars) if level[b] == 'loud' and level[b - 1] != 'loud' and en[b] > 1.6 * max(en[b - 1], 1e-9)]
    breaks = [int(b) for b in range(1, nbars) if level[b - 1] == 'loud' and level[b] != 'loud']
    pk, _ = find_peaks(flux, height=0.3, distance=6)
    acc = []
    for i in pk:
        bb = (t[i] - off + 0.012) / beat
        acc.append({'t': round(float(t[i] - 0.012), 3), 'bar': int(bb // 4), 'beat': round(float(bb % 4), 2), 'strength': round(float(flux[i]), 2)})
    big = sorted(acc, key=lambda a: -a['strength'])[:24]
    return {'file': path, 'bpm': round(float(bpm), 2), 'offset': round(off, 3), 'bar_sec': round(bar_s, 4), 'bars': [{'bar': b, 't': round(off + b * bar_s, 2), 'energy': round(float(en[b]), 1), 'level': level[b]} for b in range(nbars)],
            'drops': drops, 'breaks_after_loud': breaks, 'strongest_accents': sorted(big, key=lambda a: a['t'])}


def cut(path, keeps, out, bpm, offset, xfade=0.03):
    bar_s = 4 * 60 / bpm; T = lambda b: offset + b * bar_s
    parts = []
    for i, (a, b) in enumerate(keeps):
        end = f":{T(b) + xfade:.4f}" if b is not None else ''
        parts.append(f"[0:a]atrim={T(a):.4f}{end},asetpts=PTS-STARTPTS[s{i}]")
    fc = ';'.join(parts); last = 's0'
    for i in range(1, len(keeps)):
        fc += f";[{last}][s{i}]acrossfade=d={xfade}:c1=tri:c2=tri[x{i}]"; last = f'x{i}'
    r = subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', path, '-filter_complex', fc, '-map', f'[{last}]', '-ar', '44100', '-ac', '2', out], capture_output=True, text=True)
    if r.returncode: sys.exit(r.stderr)
    print('cut ->', out)


if __name__ == '__main__':
    ap = argparse.ArgumentParser(); sp = ap.add_subparsers(dest='cmd', required=True)
    m = sp.add_parser('map'); m.add_argument('song'); m.add_argument('--out'); m.add_argument('--bpm', default='110,175'); m.add_argument('--first', type=float, default=None)
    c = sp.add_parser('cut'); c.add_argument('song'); c.add_argument('--keep', action='append', required=True); c.add_argument('--out', required=True); c.add_argument('--bpm', type=float, required=True); c.add_argument('--offset', type=float, required=True)
    a = ap.parse_args()
    if a.cmd == 'map':
        lo, hi = [float(v) for v in a.bpm.split(',')]; R = analyze(a.song, (lo, hi), a.first)
        print(f"bpm {R['bpm']}  offset {R['offset']}  bar {R['bar_sec']} s  bars {len(R['bars'])}")
        print('bar : start s : energy : level'); [print(f"{b['bar']:>3} : {b['t']:>6} : {b['energy']:>5} : {b['level']}") for b in R['bars'][:80]]
        print('drops (a loud part starts at the bar):', R['drops']); print('loud part ends before bar:', R['breaks_after_loud'])
        print('strongest accents (bar, beat 0-4, strength):', ' '.join(f"{x['bar']}.{x['beat']}({x['strength']})" for x in R['strongest_accents']))
        if a.out: open(a.out, 'w', encoding='utf-8').write(json.dumps(R, indent=1)); print('map ->', a.out)
    else:
        keeps = []
        for k in a.keep:
            lo, _, hi = k.partition(':'); keeps.append((float(lo), float(hi) if hi else None))
        cut(a.song, keeps, a.out, a.bpm, a.offset)
