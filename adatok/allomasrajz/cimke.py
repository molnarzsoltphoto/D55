"""Feliratok a vázlatos helyszínrajzból: váltó- és jelzőtáblázat, vágánynevek, irányok, váltószámok."""
import sys, re, json, collections, pdfplumber

SZELV = r'\d{1,4}\+\d{1,2}'
KIND  = ("fő", "mellék", "tároló", "rakodó", "vg.", "vg")

def row_texts(page, ytol=0.6):
    rows = collections.defaultdict(list)
    for c in page.chars: rows[round(c["top"]/ytol)].append(c)
    out = []
    for k in sorted(rows):
        cs = sorted(rows[k], key=lambda c: c["x0"])
        out.append(("".join(c["text"] for c in cs), cs[0]["top"], cs))
    return out

def extract(pdf_path):
    with pdfplumber.open(pdf_path) as pdf:
        page = pdf.pages[0]
        words = page.extract_words(extra_attrs=["size"])
        sizes = collections.Counter(round(w["size"], 1) for w in words)
        big = max((s for s, n in sizes.items() if n >= 6 and s >= 6.0), default=None)

        valto, jelzo = {}, {}
        for text, _, _ in row_texts(page):
            for a, b in re.findall(r'(?<![\d+])(\d{1,3})\s+(' + SZELV + r')', text):
                valto.setdefault(a, b)
            for a, b in re.findall(r'(?<![\wÁÉÍÓÖŐÚÜŰ])([A-ZÁÉÍÓÖŐÚÜŰ][A-Za-z0-9]{0,3})\s+(' + SZELV + r')', text):
                jelzo.setdefault(a, b)

        tracks = []
        for i, w in enumerate(words):
            m = re.match(r'^((?:\d{1,4}|[IVXL]{1,7})(?:/?[ab])?)\.(' + "|".join(re.escape(k) for k in KIND) + r')?$', w["text"])
            if not m: continue
            tail = [x["text"] for x in words[i+1:i+5]
                    if abs(x["top"] - w["top"]) < 2.5 and 0 <= x["x0"] - w["x1"] < 26]
            if not m.group(2) and (not tail or tail[0] not in KIND): continue
            tracks.append({"szam": m.group(1),
                           "nev": (w["text"] + " " + " ".join(tail[:4])).strip(),
                           "x": round(w["x0"], 1), "y": round((w["top"] + w["bottom"]) / 2, 1)})

        swlab = [{"t": w["text"], "x": round((w["x0"] + w["x1"]) / 2, 1),
                  "y": round((w["top"] + w["bottom"]) / 2, 1)}
                 for w in words if big and round(w["size"], 1) == big and re.fullmatch(r'\d{1,3}', w["text"])]

        dirs = []
        for i, w in enumerate(words):
            if w["text"] not in ("<<", ">>"): continue
            j = i + 1 if w["text"] == "<<" else i - 1
            if not (0 <= j < len(words)): continue
            n = words[j]
            if abs(n["top"] - w["top"]) < 3 and abs(n["x0"] - w["x0"]) < 70:
                dirs.append({"irany": n["text"], "fele": "jobb" if w["text"] == ">>" else "bal",
                             "x": round((w["x0"] + n["x0"]) / 2, 1),
                             "y": round((w["top"] + w["bottom"]) / 2, 1)})
        return {"valtotabla": valto, "jelzotabla": jelzo, "vaganyok": tracks,
                "valtoszamok": swlab, "iranyok": dirs, "bold_meret": big}

if __name__ == "__main__":
    r = extract(sys.argv[1])
    v = {k: r["valtotabla"][k] for k in sorted(r["valtotabla"], key=int)}
    print(f"váltótáblázat ({len(v)}):")
    print("   ", v)
    print(f"\njelzőtáblázat ({len(r['jelzotabla'])}):", list(r["jelzotabla"])[:40])
    print(f"\nvágányok ({len(r['vaganyok'])}):")
    for t in sorted(r["vaganyok"], key=lambda t: t["y"]): print(f"    y={t['y']:6.1f} x={t['x']:6.1f}  {t['nev']}")
    print(f"\nirányok: {r['iranyok']}")
    print(f"\nrajzi váltószámok ({len(r['valtoszamok'])}):", sorted(int(s['t']) for s in r['valtoszamok']))
    json.dump(r, open(sys.argv[2], "w"), ensure_ascii=False, indent=0)
