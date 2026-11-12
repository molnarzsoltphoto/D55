"""Ellenőrző rajz: eredeti helyszínrajz + kinyert gráf + hozzárendelt váltószámok."""
import sys, json
from PIL import Image, ImageDraw, ImageFont
halo, allom, base, out = sys.argv[1:5]
g = json.load(open(halo)); a = json.load(open(allom))
nev = {int(k): v for k, v in a["valtonevek"].items()}
im = Image.open(base).convert("RGB")
im = Image.blend(im, Image.new("RGB", im.size, "white"), 0.55)
d = ImageDraw.Draw(im)
F = lambda s: ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", s)
K = g["dpi"]/72.0
N = {n["i"]: n for n in g["nodes"]}
for e in g["edges"]:
    poly = [(x*K, y*K) for x, y in e.get("poly", [])]
    if len(poly) >= 2: d.line([c for p in poly for c in p], fill=(0, 110, 230), width=7)
for n in g["nodes"]:
    x, y = n["px"]; i = n["i"]
    if n["deg"] >= 3:
        lab = nev.get(i)
        col = (0, 150, 40) if lab else (225, 0, 0)
        d.ellipse([x-16, y-16, x+16, y+16], fill=col, outline=(255,255,255), width=3)
        t = lab if lab else f"?{i}"
        d.text((x+20, y-20), t, fill=col, font=F(40), stroke_width=5, stroke_fill=(255,255,255))
for e in a["bejaratok"]:
    x, y = N[e["node"]]["px"]
    d.ellipse([x-18, y-18, x+18, y+18], fill=(255,140,0), outline=(0,0,0), width=3)
    d.text((x-10, y+22), e["irany"], fill=(190,80,0), font=F(38), stroke_width=5, stroke_fill=(255,255,255))
for t in a["vaganyok"]:
    d.text((t["x"]*K, t["y"]*K+10), t["szam"], fill=(140,0,170), font=F(44),
           stroke_width=6, stroke_fill=(255,255,255))
im.save(out); print(out, im.size)
