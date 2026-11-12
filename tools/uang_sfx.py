"""Sounds for the "Uang x5" video, placed on the beat grid (episodes/<slug>/uang.json). Earshot files + code-made thump/click (lemo-opuscar).
    C:/Users/andi.pramana/lemo-opuscar/.venv/Scripts/python.exe tools/uang_sfx.py <slug>      -> out/<slug>/sfx.wav
"""
import json, os, sys
from pathlib import Path
import numpy as np, soundfile as sf
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(os.environ.get('LEMO_OPUSCAR_HOME', Path.home() / 'lemo-opuscar'))))
from core.audio.sfx import SR, add, thump, click   # noqa

slug = sys.argv[1]; T = json.loads((ROOT / 'episodes' / slug / 'uang.json').read_text(encoding='utf-8'))
beat = 60 / T['bpm']; off = T['offset']; dur = T['total']
buf = np.zeros((int((dur + 2) * SR), 2))
lib = json.loads((ROOT / 'assets' / 'sfx' / 'library.json').read_text(encoding='utf-8'))['items']
def load(name):
    x, sr = sf.read(ROOT / 'assets' / 'sfx' / lib[name]['file'])
    if x.ndim == 2: x = x.mean(1)
    if sr != SR:
        import soxr; x = soxr.resample(x, sr, SR)
    return x.astype(np.float64)
def put(name, t, g=0.5, pan=0.0):
    x = load(name); x = x / (np.abs(x).max() + 1e-9); add(buf, x, t, g, pan=pan)
for hb, nm in [(0.5, 'es_pro_pop_bloop'), (2.0, 'es_ui_pop_blip'), (3.5, 'es_pro_pop_chirp')]: put(nm, off + hb * beat, 0.5)   # the two hook lines appear on beats 0.5 and 3.5
for i, s in enumerate(T['scenes']):
    t0 = off + s['bar'] * 4 * beat; hit = off + (s['bar'] + s['bars'] / 2) * 4 * beat
    # the number rolls: a fast rising run of clicks over 0.28 s, then a pop on the item
    if i:
        for k in range(9): add(buf, click(1.6 + 0.12 * k, 0.5), t0 + 0.03 * k, 0.12 + 0.01 * k, pan=0.2)   # the number rolls (not on the first purchase)
    put('es_pro_pop_bloop', t0 + 0.02, 0.55); put('es_ui_pop_blip', t0 + 0.12, 0.4)   # the x5 tag and the item pop
    if i: put('es_whoosh_fast_tight', t0 - 0.12, 0.35)                                   # a cut into the new scene
    id = s['id']
    if id == 's1': put('es_drip_bloop', hit + 0.02, 0.6); add(buf, thump(0.5, 60), hit, 0.35); put('es_toggle_latch', hit + 0.28, 0.45)
    if id == 's2': put('es_drip_drop', hit + 0.05, 0.6); put('es_drip_bloop', hit + 0.28, 0.5); put('es_whoosh_big_gust', hit + 0.1, 0.25); add(buf, thump(0.6, 55), hit, 0.35)
    if id == 's3':
        add(buf, thump(0.9, 45), hit, 0.6); put('es_toggle_latch', hit + 0.02, 0.6); put('es_shimmer_m1', hit + 0.1, 0.6)
        for k in range(3): put('es_hover_tick_detent', hit + 0.14 * k, 0.5)   # the lamps switch on one by one
        put('es_pro_notify_ding_1930', hit + 0.5, 0.45)
    if id == 's4': put('es_whoosh_fast_whistle', hit + 0.02, 0.6); add(buf, thump(0.7, 50), hit, 0.45); put('es_whoosh_big_jet', hit + 0.9, 0.5); put('es_pro_impact_short', hit + 1.5, 0.4)
    if id == 's5':
        put('es_fit_bell_small_bell', hit - 0.02, 0.6); put('es_fit_bell_small_bell', hit + 0.2, 0.5); put('es_whoosh_fast_crisp', hit + 0.1, 0.55); add(buf, thump(0.5, 55), hit + 0.55, 0.3)
        put('es_whoosh_fast_tight', hit + 1.0, 0.5); put('es_pro_impact_short', hit + 1.6, 0.4)
n = int(dur * SR); out = buf[:n]; pk = np.abs(out).max()
if pk > 0.9: out = out * 0.9 / pk
dst = ROOT / 'out' / slug / 'sfx.wav'; dst.parent.mkdir(parents=True, exist_ok=True); sf.write(dst, out.astype(np.float32), SR); print('sfx ->', dst)
