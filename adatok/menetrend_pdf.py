"""
MÁV menetrendi PDF (vonalankénti füzetoldal) → vonatonkénti megállólista, koordináta alapú beolvasással.

Oldalanként: a vonatszámok sora adja az oszlopokat, az állomásnevek a sorokat; egy idő az „óra perc” szópár,
amelyet a legközelebbi vonatszám-oszlophoz rendelünk. Nem kezeli a közlekedési napok jeleit (minden oszlop
önálló vonat); az azonos percben, azonos irányban közlekedő változatokat a hívó vonja össze.
Használat: python3 menetrend_pdf.py fajl.pdf   → soronként vonat: megállók
"""
import re
import sys

import pdfplumber

NUM = re.compile(r"^\d{3,5}$")


def group_rows(words, tol=2.6):
    rows, cur, top = [], [], None
    for w in sorted(words, key=lambda w: (w["top"], w["x0"])):
        if top is None or w["top"] - top > tol:
            if cur:
                rows.append(cur)
            cur, top = [], w["top"]
        cur.append(w)
    if cur:
        rows.append(cur)
    return [sorted(r, key=lambda w: w["x0"]) for r in rows]


def clean_label(words):
    parts = []
    for w in words:
        t = re.split(r"\.{2,}", w["text"])[0].strip(".")
        if not t or re.fullmatch(r"[\d,]+[a-z]?,?", t) or not re.search(r"[A-Za-zÁÉÍÓÖŐÚÜŰáéíóöőúüű]{2,}", t):
            continue
        parts.append(t)
    return " ".join(parts).strip()


def parse_page(page, prev_cols=None):
    words = page.extract_words(x_tolerance=1.5, y_tolerance=2)
    rows = group_rows(words)
    # vonatszám-sor: a legtöbb 3–5 jegyű számot tartalmazó sor a lap felső harmadában
    best = max(rows, key=lambda r: (sum(1 for w in r if NUM.match(w["text"])) if r[0]["top"] < page.height * 0.45 else -1))
    cols = [{"number": w["text"], "x": (w["x0"] + w["x1"]) / 2} for w in best if NUM.match(w["text"])]
    head_top = best[0]["top"]
    if len(cols) < 2:
        # folytatólap fejléc nélkül (a táblázat alsó fele): az előző lap oszlopai érvényesek
        if not prev_cols:
            return None
        cols, head_top = prev_cols, 0
    col_min = min(c["x"] for c in cols)
    out_rows = []
    for r in rows:
        if r[0]["top"] <= head_top + 4:
            continue
        label = clean_label([w for w in r if w["x0"] < col_min - 25])
        if not label or label in ("km", "Kiindulási állomás", "Végállomás"):
            continue
        cells = {}
        data = [w for w in r if w["x1"] > col_min - 22]
        i = 0
        while i < len(data) - 1:
            a, b = data[i], data[i + 1]
            ha = re.sub(r"\D", "", a["text"])
            if re.fullmatch(r"\d{1,2}", ha) and re.fullmatch(r"\d{2}", b["text"]) and b["x0"] - a["x1"] < 9 and int(ha) < 25 and int(b["text"]) < 60:
                cx = (a["x1"] - 4 * len(ha) + b["x1"]) / 2
                col = min(cols, key=lambda c: abs(c["x"] - cx))
                if abs(col["x"] - cx) < 14:
                    cells[col["number"]] = int(ha) * 60 + int(b["text"])
                i += 2
            else:
                i += 1
        has_dots = any("..." in w["text"] for w in r)
        if cells or has_dots:
            out_rows.append({"name": label, "cells": cells})
    return {"cols": [c["number"] for c in cols], "rows": out_rows, "_cols": cols}


def parse_pdf(path):
    """Oldalanként: {"cols": [vonatszám…], "rows": [{"name", "cells": {vonatszám: perc}}…]}"""
    pages = []
    with pdfplumber.open(path) as pdf:
        prev = None
        for pg in pdf.pages:
            try:
                t = parse_page(pg, prev)
            except Exception:
                t = None
            if t and t["rows"]:
                prev = t.pop("_cols")
                pages.append(t)
    return pages


if __name__ == "__main__":
    for n, t in enumerate(parse_pdf(sys.argv[1]), 1):
        print(f"--- {n}. oldal: {len(t['cols'])} vonat, {len(t['rows'])} sor; első/utolsó sor: {t['rows'][0]['name']} … {t['rows'][-1]['name']}")
        for num in t["cols"]:
            stops = [(r["name"], r["cells"][num]) for r in t["rows"] if num in r["cells"]]
            if stops:
                print(f"  {num}: " + ", ".join(f"{n} {m // 60}:{m % 60:02d}" for n, m in stops[:3]) + (" … " + f"{stops[-1][0]} {stops[-1][1] // 60}:{stops[-1][1] % 60:02d}" if len(stops) > 3 else ""))
