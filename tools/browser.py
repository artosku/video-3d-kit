"""Headless Chrome with software WebGL (no GPU needed), the little web server, stills and frame capture. Pure Python: works the same on Windows, Linux and macOS.
   python tools/browser.py shot <name.png> "<query>" [WxH]       one still  -> out/shots/<name>
   python tools/browser.py capture <slug> <from> <to> [WxH]      frames     -> out/<slug>/frames/f_NNNN.png
"""
import os
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

from common import IS_WINDOWS, OUT, ROOT

PORT = int(os.environ.get("VIDEO3D_PORT", "5173"))


def find_chrome():
    cands = [os.environ.get("CHROME_BIN", "")]
    if IS_WINDOWS:
        cands += [r"C:\Program Files\Google\Chrome\Application\chrome.exe", r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
                  os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"), r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"]
    else:
        cands += [shutil.which(n) or "" for n in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "chrome")]
        cands += ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Chromium.app/Contents/MacOS/Chromium"]
    for c in cands:
        if c and os.path.isfile(c):
            return c
    return None


def server_up():
    try:
        return urllib.request.urlopen(f"http://localhost:{PORT}/web/episode.html", timeout=2).status == 200
    except Exception:
        return False


def ensure_server():
    if server_up():
        return
    if not shutil.which("node"):
        sys.exit("node is not installed (python tools/episode.py doctor tells how to install it)")
    OUT.mkdir(exist_ok=True)
    log = open(OUT / "serve.log", "ab")
    kw = {"creationflags": 0x00000008 | 0x00000200} if IS_WINDOWS else {"start_new_session": True}   # detached: it keeps running after this script ends
    subprocess.Popen(["node", "serve.mjs", str(PORT)], cwd=ROOT, stdout=log, stderr=log, stdin=subprocess.DEVNULL, **kw)
    for _ in range(40):
        if server_up():
            return
        time.sleep(0.5)
    sys.exit("the web server did not start (see out/serve.log)")


def _kill_tree(p):
    try:
        if IS_WINDOWS:
            subprocess.run(["taskkill", "/PID", str(p.pid), "/T", "/F"], capture_output=True)
        else:
            import signal
            os.killpg(os.getpgid(p.pid), signal.SIGKILL)
    except Exception:
        try:
            p.kill()
        except Exception:
            pass


def _chrome(url, size):
    ch = find_chrome()
    if not ch:
        sys.exit("no Chrome/Chromium found (set CHROME_BIN; python tools/episode.py doctor tells how to install it)")
    prof = tempfile.mkdtemp(prefix="v3d-")      # a profile of its own: the Chrome that is already open is never touched
    args = [ch, f"--user-data-dir={prof}", "--headless=new", "--disable-gpu", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-first-run",
            "--disable-extensions", "--hide-scrollbars", "--mute-audio", f"--window-size={size}"]
    if not IS_WINDOWS:
        args += ["--no-sandbox", "--disable-dev-shm-usage"]   # needed in containers and cloud sessions
    kw = {} if IS_WINDOWS else {"start_new_session": True}
    out = subprocess.DEVNULL
    if os.environ.get("VIDEO3D_DEBUG"):   # keep Chrome's console (JavaScript errors) in out/chrome.log
        OUT.mkdir(exist_ok=True)
        out = open(OUT / "chrome.log", "ab")
        args += ["--enable-logging=stderr", "--v=0"]
    p = subprocess.Popen(args + [url], stdout=out, stderr=out, stdin=subprocess.DEVNULL, **kw)
    return p, prof


def _wait(path, timeout):
    t0 = time.time()
    while time.time() - t0 < timeout:
        if Path(path).exists() and Path(path).stat().st_size > 0:
            return True
        time.sleep(1)
    return False


def shot(name, query="bg=quiet", size="540,960"):
    ensure_server()
    f = OUT / "shots" / name
    f.parent.mkdir(parents=True, exist_ok=True)
    f.unlink(missing_ok=True)
    p, prof = _chrome(f"http://localhost:{PORT}/web/episode.html?shot=1&name={name}&{query}", size)
    ok = _wait(f, 180)
    _kill_tree(p)
    shutil.rmtree(prof, ignore_errors=True)
    if not ok:
        sys.exit(f"no screenshot for {name} (query: {query})")
    return f


def capture(slug, a, b, size="720,1280"):
    ensure_server()
    d = OUT / slug / "frames"
    d.mkdir(parents=True, exist_ok=True)
    done = d / f"done_{a}_{b}.txt"
    done.unlink(missing_ok=True)
    p, prof = _chrome(f"http://localhost:{PORT}/web/episode.html?ep={slug}&capture=1&from={a}&to={b}", size)
    ok = _wait(done, 7200)
    _kill_tree(p)
    shutil.rmtree(prof, ignore_errors=True)
    if not ok:
        sys.exit(f"capture {a}-{b} did not finish")
    return done.read_text()


if __name__ == "__main__":
    if len(sys.argv) >= 3 and sys.argv[1] == "shot":
        print(shot(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else "bg=quiet", sys.argv[4] if len(sys.argv) > 4 else "540,960"))
    elif len(sys.argv) >= 5 and sys.argv[1] == "capture":
        print("done", sys.argv[3], sys.argv[4], capture(sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), sys.argv[5] if len(sys.argv) > 5 else "720,1280"))
    else:
        sys.exit(__doc__)
