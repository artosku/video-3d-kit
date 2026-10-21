"""Packs the kit into one zip (dist/video-3d-kit.zip): everything a user needs, nothing private.
   python tools/make_zip.py
Left out: out/, dist/, .git, .env, project.json (yours), *.mp4, __pycache__, dialog.wav (rebuilt), node_modules."""
import os
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKIP_DIRS = {"out", "dist", ".git", "__pycache__", "node_modules"}
SKIP_FILES = {".env", "project.json", "dialog.wav"}
SKIP_EXT = {".mp4", ".pyc"}


def main():
    dist = ROOT / "dist"
    dist.mkdir(exist_ok=True)
    dst = dist / "video-3d-kit.zip"
    n = size = 0
    with zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for dp, dn, fn in os.walk(ROOT):
            dn[:] = [d for d in dn if d not in SKIP_DIRS]
            for f in fn:
                p = Path(dp) / f
                if f in SKIP_FILES or p.suffix in SKIP_EXT:
                    continue
                z.write(p, Path("video-3d-kit") / p.relative_to(ROOT))
                n += 1
                size += p.stat().st_size
    print(f"zip: {dst}  ({n} files, {size / 1048576:.1f} MB packed into {dst.stat().st_size / 1048576:.1f} MB)")


if __name__ == "__main__":
    sys.exit(main())
