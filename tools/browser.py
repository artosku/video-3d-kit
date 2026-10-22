"""Headless Chrome (uses the GPU when the machine has one, otherwise software WebGL; VIDEO3D_GPU=on|off|auto), the little web server, stills and frame capture. Pure Python: works the same on Windows, Linux and macOS.
   python tools/browser.py shot <name.png> "<query>" [WxH]       one still  -> out/shots/<name>
   python tools/browser.py capture <slug> <from> <to> [WxH]      frames     -> out/<slug>/frames/f_NNNN.png
"""
import json
import os
import re
import shutil
import subprocess
import sys
import socket
import tempfile
import threading
import time
import urllib.request
from pathlib import Path

from common import IS_WINDOWS, OUT, ROOT

BASE_PORT = int(os.environ.get("VIDEO3D_PORT", "5173"))
PORT = BASE_PORT   # the port in use: ensure_server() settles it (another kit or program may already hold 5173)
_LOCK = threading.Lock()


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


def _root_of(port):
    try:
        return urllib.request.urlopen(f"http://localhost:{port}/__root", timeout=2).read().decode().strip()
    except Exception:
        return None


def _in_use(port):
    with socket.socket() as s:
        s.settimeout(0.5)
        return s.connect_ex(("127.0.0.1", port)) == 0


def _same(a, b):
    return os.path.normcase(os.path.normpath(a)) == os.path.normcase(os.path.normpath(b))


def ensure_server():
    """Finds (or starts) the little web server of THIS kit. If 5173 belongs to something else (another kit, another project), the next free port is used."""
    global PORT
    with _LOCK:
        if _root_of(PORT) is not None and _same(_root_of(PORT), str(ROOT)):
            return
        if not shutil.which("node"):
            sys.exit("node is not installed (python tools/episode.py doctor tells how to install it)")
        for port in range(BASE_PORT, BASE_PORT + 30):
            r = _root_of(port)
            if r is not None and _same(r, str(ROOT)):
                PORT = port
                return
            if r is None and not _in_use(port):
                OUT.mkdir(exist_ok=True)
                log = open(OUT / "serve.log", "ab")
                kw = {"creationflags": 0x00000008 | 0x00000200} if IS_WINDOWS else {"start_new_session": True}   # detached: it keeps running after this script ends
                subprocess.Popen(["node", "serve.mjs", str(port)], cwd=ROOT, stdout=log, stderr=log, stdin=subprocess.DEVNULL, **kw)
                for _ in range(40):
                    if _root_of(port) is not None:
                        PORT = port
                        return
                    time.sleep(0.5)
                sys.exit(f"the web server did not start on port {port} (see out/serve.log)")
        sys.exit("no free port between %d and %d for the little web server" % (BASE_PORT, BASE_PORT + 29))


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


_SOFT = ("swiftshader", "llvmpipe", "software", "softpipe", "basic render", "none", "")
_GPU = None   # None = not checked yet, True/False after use_gpu()


def use_gpu():
    """True when the render should use the graphics card. VIDEO3D_GPU=on|off|auto (auto is the default): auto looks once whether
    headless Chrome gets a real GPU (not SwiftShader / llvmpipe) and remembers the answer in out/gpu.json."""
    global _GPU
    if _GPU is not None:
        return _GPU
    mode = os.environ.get("VIDEO3D_GPU", "auto").strip().lower()
    if mode in ("off", "0", "no", "cpu", "software"):
        _GPU = False
    elif mode in ("on", "1", "yes", "gpu"):
        _GPU = True
    else:
        _GPU = _detect_gpu()
    return _GPU


def gpu_name():
    try:
        return json.loads((OUT / "gpu.json").read_text(encoding="utf-8")).get("renderer", "")
    except Exception:
        return ""


def _detect_gpu():
    ch = find_chrome()
    cache = OUT / "gpu.json"
    try:
        c = json.loads(cache.read_text(encoding="utf-8"))
        if c.get("chrome") == ch and "gpu" in c:
            return bool(c["gpu"])
    except Exception:
        pass
    renderer, gpu = "", False
    try:
        ensure_server()
        prof = tempfile.mkdtemp(prefix="v3d-")
        args = [ch, f"--user-data-dir={prof}", "--headless=new", "--enable-gpu", "--ignore-gpu-blocklist", "--no-first-run", "--disable-extensions",
                "--virtual-time-budget=3000", "--dump-dom"]
        if not IS_WINDOWS:
            args += ["--no-sandbox", "--disable-dev-shm-usage"]
        r = subprocess.run(args + [f"http://localhost:{PORT}/web/gpucheck.html"], capture_output=True, text=True, timeout=60)
        shutil.rmtree(prof, ignore_errors=True)
        m = re.search(r"\[\[(.*?)\]\]", r.stdout or "", re.S)
        renderer = (m.group(1) if m else "").strip()
        low = renderer.lower()
        gpu = bool(low) and not any(s in low for s in _SOFT if s)
    except Exception:
        pass
    try:
        OUT.mkdir(exist_ok=True)
        cache.write_text(json.dumps({"chrome": ch, "gpu": gpu, "renderer": renderer}), encoding="utf-8")
    except Exception:
        pass
    return gpu


def _chrome(url, size, gpu=None):
    ch = find_chrome()
    if not ch:
        sys.exit("no Chrome/Chromium found (set CHROME_BIN; python tools/episode.py doctor tells how to install it)")
    gpu = use_gpu() if gpu is None else gpu
    prof = tempfile.mkdtemp(prefix="v3d-")      # a profile of its own: the Chrome that is already open is never touched
    gl = ["--enable-gpu", "--ignore-gpu-blocklist"] if gpu else ["--disable-gpu", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
    args = [ch, f"--user-data-dir={prof}", "--headless=new", *gl, "--no-first-run",
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


def _wait(path, timeout, proc=None):
    t0 = time.time()
    while time.time() - t0 < timeout:
        if Path(path).exists() and Path(path).stat().st_size > 0:
            return True
        if proc is not None and proc.poll() is not None:   # Chrome quit before it wrote the file (a GPU that does not work)
            return Path(path).exists() and Path(path).stat().st_size > 0
        time.sleep(1)
    return False


def shot(name, query="bg=quiet", size="540,960"):
    f = OUT / "shots" / name
    for attempt in range(3):   # a busy machine (a build running next to it) can make Chrome miss the deadline once: try again
        ensure_server()
        f.parent.mkdir(parents=True, exist_ok=True)
        f.unlink(missing_ok=True)
        gpu = use_gpu() and attempt < 2   # the last try always uses software, in case the GPU is the problem
        p, prof = _chrome(f"http://localhost:{PORT}/web/episode.html?shot=1&name={name}&{query}", size, gpu)
        ok = _wait(f, 150, p)
        _kill_tree(p)
        shutil.rmtree(prof, ignore_errors=True)
        if ok:
            return f
    sys.exit(f"no screenshot for {name} (query: {query})")


def capture(slug, a, b, size="720,1280"):
    ensure_server()
    d = OUT / slug / "frames"
    d.mkdir(parents=True, exist_ok=True)
    done = d / f"done_{a}_{b}.txt"
    done.unlink(missing_ok=True)
    ok = False
    for gpu in ([True, False] if use_gpu() else [False]):   # a GPU that fails falls back to software for this chunk
        p, prof = _chrome(f"http://localhost:{PORT}/web/episode.html?ep={slug}&capture=1&from={a}&to={b}", size, gpu)
        ok = _wait(done, 7200, p)
        _kill_tree(p)
        shutil.rmtree(prof, ignore_errors=True)
        if ok:
            break
        if gpu:
            print(f"  GPU render of frames {a}-{b} failed, trying software", flush=True)
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
