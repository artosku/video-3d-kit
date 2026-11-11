"""Post effects on a finished MP4 (ffmpeg only).

    python tools/post_fx.py tvoff <in.mp4> <out.mp4> [--collapse 0.4] [--hold 2.0] [--sound es_pro_zip_down]

tvoff = the "camera dies" ending: the last <collapse> seconds of the video squash to a thin bright line, the line shrinks to a dot,
then the screen stays black for <hold> seconds (the climax). A power-down sound plays at the start of the collapse; everything else
in the audio is kept. Use it when the story ends on a blackout (a falling camera, a siren, a cut-to-black joke).
"""
import argparse, subprocess, sys, json, os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def probe(path):
    r = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate:format=duration', '-of', 'json', str(path)], capture_output=True, text=True)
    j = json.loads(r.stdout); s = j['streams'][0]; n, d = s['r_frame_rate'].split('/')
    return int(s['width']), int(s['height']), float(n) / float(d), float(j['format']['duration'])


def sfx_file(name):
    lib = json.loads((ROOT / 'assets' / 'sfx' / 'library.json').read_text(encoding='utf-8'))['items']
    it = lib[name]
    return ROOT / 'assets' / 'sfx' / it['file']


def tvoff(src, dst, collapse=0.4, hold=2.0, sound='es_pro_zip_down'):
    w, h, fps, dur = probe(src)
    a = collapse * 0.7; b = collapse - a        # a: the picture squashes to a line, b: the line shrinks to a dot
    head = max(0.0, dur - collapse)
    # the squashed picture is laid over black, centred, one frame at a time
    vf = (
        f"[0:v]split=2[m][l];"
        f"[m]trim=0:{head:.3f},setpts=PTS-STARTPTS[main];"
        f"[l]trim={head:.3f}:{dur:.3f},setpts=PTS-STARTPTS,eq=brightness='0.35*min(1,t/{a:.3f})':eval=frame,"
        f"scale=w='max(4,iw*if(lt(t,{a:.3f}),1,max(0.004,1-(t-{a:.3f})/{b:.3f})))':h='max(4,ih*if(lt(t,{a:.3f}),max(0.006,1-pow(t/{a:.3f},2.2)),0.006))':eval=frame:flags=bilinear[sq];"
        f"color=c=black:s={w}x{h}:r={fps:g}:d={collapse:.3f}[bk];"
        f"[bk][sq]overlay=x='(W-w)/2':y='(H-h)/2':eval=frame:shortest=1,format=yuv420p[tail];"
        f"color=c=black:s={w}x{h}:r={fps:g}:d={hold:.3f},format=yuv420p[hold];"
        f"[main]format=yuv420p[mainf];[mainf][tail][hold]concat=n=3:v=1:a=0[vout]"
    )
    sf = sfx_file(sound); ms = int(head * 1000)
    af = (f"[0:a]apad=pad_dur={hold + 0.5:.3f}[a0];[1:a]volume=0.9,adelay={ms}|{ms}[s];[a0][s]amix=inputs=2:duration=first:normalize=0[aout]")
    cmd = ['ffmpeg', '-y', '-v', 'error', '-i', str(src), '-i', str(sf), '-filter_complex', vf + ';' + af, '-map', '[vout]', '-map', '[aout]',
           '-t', f'{dur + hold:.3f}', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', str(dst)]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        sys.exit('ffmpeg failed:\n' + r.stderr[-1500:])
    print(f'tvoff: {dst}  ({dur + hold:.1f} s: picture {dur:.1f} s + {hold:.1f} s black)')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('cmd', choices=['tvoff']); ap.add_argument('src'); ap.add_argument('dst')
    ap.add_argument('--collapse', type=float, default=0.4); ap.add_argument('--hold', type=float, default=2.0); ap.add_argument('--sound', default='es_pro_zip_down')
    a = ap.parse_args()
    tvoff(a.src, a.dst, a.collapse, a.hold, a.sound)
