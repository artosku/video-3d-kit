"""A small original music cue for a /video-3d episode, written from code with the lemo-opuscar audio toolkit
(physically modelled kalimba / music box from core/audio/pluck.py, procedural thump / click from core/audio/sfx.py).
No sample download, no numba needed (the modal instruments are plain numpy).

    python tools/make_cue.py <slug> [--bpm 100] [--length 65] [--cut 56.0] [--sections "0:intro,2.4:groove,12.4:explain,31.9:tense,48.5:resolve"]

Writes episodes/<slug>/music.wav. Then in episode.json:  "music": { "file": "episodes/<slug>/music.wav", "rms": 330 }
--cut = where the music fades out (e.g. a siren or a blackout takes over). LEMO_OPUSCAR_HOME = the lemo-opuscar clone (default ~/lemo-opuscar).
"""
import argparse, os, sys
from pathlib import Path
import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parent.parent
LEMO = Path(os.environ.get('LEMO_OPUSCAR_HOME', Path.home() / 'lemo-opuscar'))
sys.path.insert(0, str(LEMO))
from core.audio import pluck as P                       # noqa: E402
from core.audio.sfx import SR, add, thump, click, limit  # noqa: E402

CHORDS = [('A', ['A3', 'C4', 'E4', 'A4'], 55.0), ('F', ['F3', 'A3', 'C4', 'F4'], 43.65), ('C', ['C4', 'E4', 'G4', 'C5'], 65.4), ('G', ['G3', 'B3', 'D4', 'G4'], 49.0)]
ARP = [0, 1, 2, 3, 2, 1, 2, 1]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('slug'); ap.add_argument('--bpm', type=float, default=100); ap.add_argument('--length', type=float, default=65)
    ap.add_argument('--cut', type=float, default=None); ap.add_argument('--sections', default='0:intro,2.4:groove,12.4:explain,31.9:tense,48.5:resolve')
    a = ap.parse_args()
    secs = sorted((float(k), v) for k, v in (s.split(':') for s in a.sections.split(',')))
    sec_at = lambda t: [v for k, v in secs if k <= t][-1]
    beat = 60 / a.bpm; eighth = beat / 2; bar = beat * 4
    buf = np.zeros((int((a.length + 3) * SR), 2), dtype=np.float64)
    nb = int(a.length / bar) + 1
    for b in range(nb):
        t0 = b * bar; name, notes, root = CHORDS[b % 4]; sec = sec_at(t0)
        for i in range(8):
            t = t0 + i * eighth; s = sec_at(t)
            if t >= a.length: break
            idx = ARP[i]
            if s == 'intro' and i % 2: continue
            if s == 'explain': idx = (idx + 0) % 4; oct_down = True
            else: oct_down = False
            pitch = notes[idx]
            if oct_down: pitch = pitch[0] + str(int(pitch[1]) - 1)
            vel = {'intro': .45, 'groove': .7, 'explain': .5, 'tense': .6, 'resolve': .4}[s]
            if i % 4 == 0: vel += .1
            add(buf, P.pluck('kalimba', pitch, None, vel=vel), t, 0.5 if s != 'explain' else 0.42, pan=-.2 + .4 * (i % 2))
        # bass pulse
        for k, tb in enumerate([t0, t0 + 2 * beat] if sec in ('explain', 'resolve', 'intro') else [t0, t0 + beat, t0 + 2 * beat, t0 + 3 * beat]):
            if tb < a.length: add(buf, thump(0.6, root * 1.0), tb, 0.55 if k == 0 else 0.4)
        # hats / ticks: the groove has them on every off-beat; the tense part keeps a thin 16th shimmer
        if sec == 'groove':
            for i in range(8):
                add(buf, click(1.9, 0.5), t0 + i * eighth + eighth / 2 * (i % 2 == 0) * 0, 0.1, pan=.3)
        if sec == 'tense':
            for i in range(16):
                if i % 2: add(buf, click(2.4, 0.4), t0 + i * eighth / 2, 0.07, pan=-.3)
            if b % 2 == 0:
                add(buf, P.pluck('music_box', ['E5', 'C5', 'B4', 'G4'][b // 2 % 4], None, vel=.5), t0 + 3 * beat, 0.3, pan=.4)
        if sec == 'resolve' and b % 2 == 0:
            add(buf, P.pluck('music_box', notes[3], None, vel=.4), t0 + beat, 0.25, pan=.3)
    n = int(a.length * SR)
    if a.cut:
        c = int(a.cut * SR); f = int(0.5 * SR); buf[c - f:c] *= np.linspace(1, 0, f)[:, None]; buf[c:] = 0
        n = min(n, c + int(0.1 * SR))
    out = buf[:n]
    out = np.stack([limit(out[:, 0], .9), limit(out[:, 1], .9)], 1).astype(np.float32)
    dst = ROOT / 'episodes' / a.slug / 'music.wav'
    sf.write(dst, out, SR)
    print('music cue ->', dst, f'{len(out) / SR:.1f} s', f'{a.bpm} bpm')


main()
