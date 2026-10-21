"""Top-view diagrams of every lighting setup in assets/lighting/presets.json: where each light stands around the chicken's face.
   python tools/lighting_diagrams.py [out_dir]        (needs Pillow)  ->  out/diagram/L<n>_<name>_diagram.png"""
import json
import math
import os
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
out = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "out" / "diagram"
out.mkdir(parents=True, exist_ok=True)
data = json.load(open(ROOT / "assets" / "lighting" / "presets.json", encoding="utf-8"))["presets"]


def font(names, size):
    for n in names:
        for d in (r"C:\Windows\Fonts", "/usr/share/fonts/truetype/dejavu", "/Library/Fonts", "/System/Library/Fonts/Supplemental"):
            p = os.path.join(d, n)
            if os.path.exists(p):
                return ImageFont.truetype(p, size)
    return ImageFont.load_default()


FONT = font(["segoeui.ttf", "DejaVuSans.ttf", "Arial.ttf"], 17)
FONT_B = font(["seguisb.ttf", "DejaVuSans-Bold.ttf", "Arial Bold.ttf"], 22)
FONT_S = font(["segoeui.ttf", "DejaVuSans.ttf", "Arial.ttf"], 14)
ROLE = {"key": "Utama", "fill": "Pengisi", "rim": "Tepi", "screen": "Layar"}
W, H, S = 600, 640, 16   # image size, pixels per unit
cx, cy = 280, 310        # the chicken's face on the diagram


def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


for idx, (name, p) in enumerate(data.items(), 1):
    im = Image.new("RGB", (W, H), (14, 16, 34))
    d = ImageDraw.Draw(im, "RGBA")
    d.rectangle((40, 60, W - 40, 80), fill=(70, 80, 140, 255))
    d.text((48, 36), "jendela (belakang)", font=FONT_S, fill=(150, 165, 220, 255))
    d.rectangle((cx - 110, cy - 14, cx + 150, cy + 30), outline=(120, 125, 150, 255), width=2)
    d.text((cx - 100, cy + 34), "laptop", font=FONT_S, fill=(140, 145, 170, 255))
    d.rectangle((cx + 100 - 14, cy - 12, cx + 130 + 14, cy + 14), fill=(218, 119, 88, 255))
    d.text((cx + 88, cy - 34), "Claude", font=FONT_S, fill=(218, 119, 88, 255))
    d.ellipse((cx - 16, cy - 16, cx + 16, cy + 16), fill=(255, 235, 194, 255), outline=(255, 255, 255, 255))
    d.text((cx - 30, cy + 20), "si ayam", font=FONT_S, fill=(255, 235, 194, 255))
    d.polygon([(cx, H - 18), (cx - 16, H - 4), (cx + 16, H - 4)], fill=(200, 200, 220, 255))
    d.text((cx + 22, H - 26), "kamera", font=FONT_S, fill=(200, 200, 220, 255))
    for o in p["lights"]:
        az = math.radians(o["az"])
        lx = cx + o["d"] * S * math.sin(az) * math.cos(math.radians(o["el"])) * 0.9
        ly = cy + o["d"] * S * math.cos(az) * math.cos(math.radians(o["el"])) * 0.9
        col = hex_rgb(o["color"])
        d.line((lx, ly, cx, cy), fill=col + (140,), width=3)
        a = math.atan2(cy - ly, cx - lx)
        for sgn in (-1, 1):
            d.line((cx, cy, cx - 14 * math.cos(a + sgn * 0.45), cy - 14 * math.sin(a + sgn * 0.45)), fill=col + (200,), width=3)
        r = 12 if o["role"] != "fill" else 9
        d.ellipse((lx - r, ly - r, lx + r, ly + r), fill=col + (255,), outline=(255, 255, 255, 255), width=2)
        tx = min(max(lx - 70, 8), W - 260)
        d.text((tx, ly + r + 3), f"{ROLE.get(o['role'], o['role'])}: sudut {o['az']}\u00b0, tinggi {o['el']}\u00b0", font=FONT_S, fill=col + (255,))
    d.text((24, 6), p["label"], font=FONT_B, fill=(255, 255, 255, 255))
    words, line, y = p["mood"].split(), "", 520
    for w in words:
        if d.textlength(line + w + " ", font=FONT) > W - 48:
            d.text((24, y), line, font=FONT, fill=(200, 205, 230, 255)); y += 24; line = ""
        line += w + " "
    d.text((24, y), line, font=FONT, fill=(200, 205, 230, 255))
    im.save(out / f"L{idx}_{name}_diagram.png")
    print("saved", name)
