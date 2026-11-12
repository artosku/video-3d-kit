"""Contact sheet of chosen scenes of a beat-synced "uang" style video (a still a little after each scene's hit).
    python tools/uang_sheet.py <slug> <s6,s7,s8> [seconds_after_hit=0.3] [tag=a]     -> out/<slug>/stills/sheet_<tag>.png (270x480 per scene, 5 per row)
Look at it before every render; a negative seconds value shoots before the hit.
"""
import json, sys, subprocess
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import browser
from common import OUT, ROOT
slug, want = sys.argv[1], sys.argv[2].split(',')
when = float(sys.argv[3]) if len(sys.argv) > 3 else 0.3; tag = sys.argv[4] if len(sys.argv) > 4 else 'a'
T = json.loads((ROOT / 'episodes' / slug / 'uang.json').read_text(encoding='utf-8')); beat = 60 / T['bpm']; names = []
for s in T['scenes']:
    if s['id'] not in want: continue
    t = round(T['offset'] + s.get('hitBar', s['bar'] + s['bars'] / 2) * 4 * beat + when, 2); n = f"{slug}_{s['id']}_{tag}.png"
    browser.shot(n, f'ep={slug}&t={t}&name={n}', '540,960', 'uang.html'); names.append(OUT / 'shots' / n)
if len(names) == 1: print('single shot ->', names[0]); sys.exit()
cols = min(5, len(names)); ins = []
for n in names: ins += ['-i', str(n)]
layout = '|'.join(f'{(i % cols) * 270}_{(i // cols) * 480}' for i in range(len(names)))
fc = ''.join(f'[{i}:v]scale=270:480[v{i}];' for i in range(len(names))) + ''.join(f'[v{i}]' for i in range(len(names))) + f'xstack=inputs={len(names)}:layout={layout}[o]'
d = OUT / slug / 'stills'; d.mkdir(parents=True, exist_ok=True); dst = d / f'sheet_{tag}.png'
subprocess.run(['ffmpeg', '-y', '-v', 'error', *ins, '-filter_complex', fc, '-map', '[o]', '-frames:v', '1', str(dst)], check=True); print('sheet ->', dst)
