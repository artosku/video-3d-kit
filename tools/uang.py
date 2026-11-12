"""The "Uang x5" video (ayam, a number that multiplies on the beat, each number buys something bigger).
    python tools/uang.py stills <slug>          one contact sheet: before and after the hit of every scene
    python tools/uang.py video <slug> [--size 720,1280]   frames -> MP4 with the music cut at the end + code-made sounds
episodes/<slug>/uang.json = { bpm, offset, total, fadeOut, scenes: [ { id, nominal, label, bar, bars } ], music: { file, start } }
"""
import json, subprocess, sys, shutil, argparse
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import browser
from common import OUT, ROOT


def tl(slug):
    return json.loads((ROOT / 'episodes' / slug / 'uang.json').read_text(encoding='utf-8'))


def stills(slug, size='540,960'):
    T = tl(slug); beat = 60 / T['bpm']; names = []
    times = []
    for s in T['scenes']:
        t0 = T['offset'] + s['bar'] * 4 * beat; hit = T['offset'] + (s['bar'] + s['bars'] / 2) * 4 * beat
        times += [round(t0 + 1.0 * beat, 2), round(hit + 0.35, 2)]
    for i, t in enumerate(times):
        n = f'{slug}_{i:02d}.png'; browser.shot(n, f'ep={slug}&t={t}&name={n}', size, 'uang.html'); names.append(OUT / 'shots' / n)
    sheet = OUT / slug / 'stills'; sheet.mkdir(parents=True, exist_ok=True)
    cols = 5; rows = (len(names) + cols - 1) // cols
    ins = []
    for n in names: ins += ['-i', str(n)]
    # row 1 = before, row 2 = after the hit
    order = names[0::2] + names[1::2]
    ins = []
    for n in order: ins += ['-i', str(n)]
    layout = '|'.join(f'{(i % cols) * 360}_{(i // cols) * 640}' for i in range(len(order)))
    fc = ''.join(f'[{i}:v]scale=360:640[v{i}];' for i in range(len(order))) + ''.join(f'[v{i}]' for i in range(len(order))) + f'xstack=inputs={len(order)}:layout={layout}[o]'
    out = sheet / 'contact.png'
    subprocess.run(['ffmpeg', '-y', '-v', 'error', *ins, '-filter_complex', fc, '-map', '[o]', '-frames:v', '1', str(out)], check=True)
    print('stills ->', out)


def render(slug, size='720,1280', workers=1):
    T = tl(slug); n = int(round(T['total'] * 30)); d = OUT / slug / 'frames'
    shutil.rmtree(d, ignore_errors=True); d.mkdir(parents=True, exist_ok=True)
    browser.capture(slug, 0, n - 1, size, 'uang.html')
    print('frames:', len(list(d.glob('f_*.png'))))


def mix(slug):
    T = tl(slug); m = T['music']; out = OUT / slug / 'audio.wav'
    dur = T['total']
    # music from the user's file: start at m.start, fade out at the end; the sounds come from tools/uang_sfx.py (code-made)
    cmd = ['ffmpeg', '-y', '-v', 'error', '-ss', str(m['start']), '-t', str(dur), '-i', m['file']]
    sfx = OUT / slug / 'sfx.wav'
    if sfx.exists():
        cmd += ['-i', str(sfx), '-filter_complex', f"[0:a]volume={m.get('gain', 0.9)},afade=t=out:st={dur - 0.8:.2f}:d=0.8[a];[1:a]volume=1.0[b];[a][b]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[o]", '-map', '[o]']
    else:
        cmd += ['-af', f"afade=t=out:st={dur - 0.8:.2f}:d=0.8"]
    cmd += ['-ar', '44100', '-ac', '2', str(out)]
    subprocess.run(cmd, check=True); return out


def video(slug, size='720,1280'):
    T = tl(slug); render(slug, size); aud = mix(slug)
    w, h = size.split(','); name = f"{slug}.mp4"; dst = OUT / slug / name
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-framerate', '30', '-i', str(OUT / slug / 'frames' / 'f_%04d.png'), '-i', str(aud), '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', str(dst)], check=True)
    print('video ->', dst)


if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('cmd', choices=['stills', 'video', 'mix']); ap.add_argument('slug'); ap.add_argument('--size', default=None)
    a = ap.parse_args()
    if a.cmd == 'stills': stills(a.slug, a.size or '540,960')
    elif a.cmd == 'mix': print(mix(a.slug))
    else: video(a.slug, a.size or '720,1280')
