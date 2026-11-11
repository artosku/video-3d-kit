"""One-off: copy the earshot (MIT) + openverse (CC0) sounds of motion-style-kit into assets/sfx/earshot and register them as library items (name = file name without extension)."""
import json, shutil
from pathlib import Path

SRC = Path('C:/Users/andi.pramana/Documents/project/motion-style-kit/assets/sfx')
KIT = Path(__file__).resolve().parent.parent
DST = KIT / 'assets' / 'sfx' / 'earshot'
DST.mkdir(parents=True, exist_ok=True)
lib_path = KIT / 'assets' / 'sfx' / 'library.json'
lib = json.loads(lib_path.read_text(encoding='utf-8'))
n = 0
for f in sorted(SRC.glob('es_*.wav')) + sorted(SRC.glob('ov_*.mp3')):
    shutil.copy2(f, DST / f.name)
    lib['items'][f.stem] = {'source': 'kit', 'file': f'earshot/{f.name}', 'rms': 1500, 'note': 'from artosku/motion-style-kit (earshot MIT / openverse CC0)'}
    n += 1
for lic in ('LICENSE-earshot',):
    if (SRC / lic).exists():
        shutil.copy2(SRC / lic, DST / lic)
if (SRC / 'openverse_credits.json').exists():
    shutil.copy2(SRC / 'openverse_credits.json', DST / 'openverse_credits.json')
lib_path.write_text(json.dumps(lib, ensure_ascii=False, indent=1), encoding='utf-8')
print('registered', n)
