"""Text-to-speech providers: Cartesia and ElevenLabs behind one function, and a way to list the voices an account can use.
   python tools/tts.py voices [--provider cartesia|elevenlabs] [--language id]     list voices (id, name, language, gender) so a character can be given one
A character's voice lives in characters/<id>/character.json under "voice":
   { "level": 1.0, "cartesia": {id, emotion, speed, volume}, "elevenlabs": {id, stability, similarity, style, speed} }"""
import json
import sys
import tempfile
import urllib.error
from pathlib import Path
from urllib.request import Request, urlopen

from common import SR, ffmpeg, keys_env, project

PROVIDERS = ("cartesia", "elevenlabs")


def _post(url, headers, body, timeout=120):
    req = Request(url, data=json.dumps(body).encode(), method="POST", headers={"Content-Type": "application/json", **headers})
    try:
        with urlopen(req, timeout=timeout) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        sys.exit(f"{url.split('/')[2]} error {e.code}: {e.read().decode(errors='replace')[:300]}")


def _get(url, headers, timeout=60):
    try:
        with urlopen(Request(url, headers=headers), timeout=timeout) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        sys.exit(f"{url.split('/')[2]} error {e.code}: {e.read().decode(errors='replace')[:300]}")


def cartesia(text, voice, p, proj, dst):
    cfg = proj["tts"].get("cartesia", {})
    raw = _post("https://api.cartesia.ai/tts/bytes",
                {"Authorization": "Bearer " + keys_env("CARTESIA_API_KEY"), "Cartesia-Version": cfg.get("api_version", "2026-08-14")},
                {"model_id": cfg.get("model", "sonic-3.6"), "transcript": text, "voice": {"id": voice["id"]}, "language": proj["language"],
                 "output_format": {"container": "wav", "encoding": "pcm_s16le", "sample_rate": SR},
                 "generation_config": {"speed": p["speed"], "volume": p["volume"], "emotion": voice.get("emotion", "neutral")}})
    Path(dst).parent.mkdir(parents=True, exist_ok=True)
    Path(dst).write_bytes(raw)


def elevenlabs(text, voice, p, proj, dst):
    cfg = proj["tts"].get("elevenlabs", {})
    body = {"text": text, "model_id": cfg.get("model", "eleven_multilingual_v2"),
            "voice_settings": {"stability": voice.get("stability", 0.45), "similarity_boost": voice.get("similarity", 0.75), "style": voice.get("style", 0.3),
                               "use_speaker_boost": True, "speed": min(1.2, max(0.7, p["speed"]))}}
    raw = _post(f"https://api.elevenlabs.io/v1/text-to-speech/{voice['id']}?output_format=mp3_44100_128", {"xi-api-key": keys_env("ELEVENLABS_API_KEY")}, body)
    with tempfile.TemporaryDirectory() as td:
        mp3 = Path(td) / "t.mp3"
        mp3.write_bytes(raw)
        Path(dst).parent.mkdir(parents=True, exist_ok=True)
        ffmpeg("-i", mp3, "-ar", SR, "-ac", 1, "-sample_fmt", "s16", dst)   # one format for everything downstream


def synth(provider, text, voice, p, proj, dst):
    {"cartesia": cartesia, "elevenlabs": elevenlabs}[provider](text, voice, p, proj, dst)


def list_voices(provider, language=None):
    out = []
    if provider == "cartesia":
        h = {"Authorization": "Bearer " + keys_env("CARTESIA_API_KEY"), "Cartesia-Version": project()["tts"].get("cartesia", {}).get("api_version", "2026-08-14")}
        after = None
        for _ in range(20):
            d = _get("https://api.cartesia.ai/voices?limit=100" + (f"&starting_after={after}" if after else ""), h)
            items = d.get("data", d if isinstance(d, list) else [])
            for v in items:
                out.append({"id": v["id"], "name": v.get("name", ""), "language": v.get("language", ""), "gender": v.get("gender", "") or "", "description": (v.get("description") or "")[:70]})
            if not isinstance(d, dict) or not d.get("has_more") or not items:
                break
            after = items[-1]["id"]
    else:
        d = _get("https://api.elevenlabs.io/v1/voices", {"xi-api-key": keys_env("ELEVENLABS_API_KEY")})
        for v in d.get("voices", []):
            lab = v.get("labels") or {}
            out.append({"id": v["voice_id"], "name": v.get("name", ""), "language": lab.get("language", "") or "multilingual", "gender": lab.get("gender", "") or "",
                        "description": (lab.get("descriptive") or lab.get("description") or v.get("category", "") or "")[:70]})
    if language:
        out = [v for v in out if not v["language"] or v["language"] == "multilingual" or v["language"].lower().startswith(language.lower())]
    return out


if __name__ == "__main__":
    a = sys.argv[1:]
    if not a or a[0] != "voices":
        sys.exit(__doc__)
    prov = a[a.index("--provider") + 1] if "--provider" in a else project()["tts"]["provider"]
    lang = a[a.index("--language") + 1] if "--language" in a else None
    for v in list_voices(prov, lang):
        print(f"{v['id']}  {v['name']:<22} {v['language']:<14} {v['gender']:<8} {v['description']}")
