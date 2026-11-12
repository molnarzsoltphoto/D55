"""Hány vágány van az állomáson, és hogy hívják őket — a rajz szövegrétegéből.

A korábbi kísérlet a rajz geometriáját próbálta a pultra tenni; az eredmény
hullámos és átláthatatlan lett, a morfológiai zárás ráadásul nem létező
váltókat gyártott. Ez a modul csak azt veszi át a rajzból, ami tény: a
párhuzamos vágányok számát és — ahol a rajz kiírja — a számozásukat. A pult
marad a régi, tiszta sematikus rajz, csak a helyes vágányszámmal.

A számolás közvetlenül a képen történik: az állomás törzsén végigpásztázunk
egy függőlegest, és megszámoljuk, hány vágányvastagságú fekete sáv van
egymás alatt. A mérvadó érték a törzsben mért leggyakoribb szám.
"""
import collections
import json
import re
import sys


ROMAI = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
         "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX"]


FO = re.compile(r"^(?:(.*?)\.)?(fő|Fő|FŐ)$")
SZAM = re.compile(r"^([IVXL]{1,7}|\d{1,3}[ab]?)\.?$")


def vaganyok(pdf_ut):
    """Az állomás fővágányai a rajz szövegrétege szerint, felülről lefelé.

    Minden fővágány mellé oda van írva, hogy „fő”. A szám néha ugyanabban a
    szóban van („03.fő”), néha külön, sőt más sorban — ezért térben párosítjuk,
    nem soronként.
    """
    import pdfplumber
    with pdfplumber.open(pdf_ut) as pdf:
        ws = pdf.pages[0].extract_words()
    ki = []
    for w in ws:
        m = FO.match(w["text"])
        if not m:
            continue
        y = (w["top"] + w["bottom"]) / 2
        szam = m.group(1)
        if not szam or not SZAM.match(szam + "."):
            jelolt = [x for x in ws
                      if x["x1"] <= w["x0"] + 2 and w["x0"] - x["x1"] < 60
                      and abs((x["top"] + x["bottom"]) / 2 - y) < 9 and SZAM.match(x["text"])]
            szam = max(jelolt, key=lambda x: x["x1"])["text"].rstrip(".") if jelolt else None
        ki.append({"szam": (szam or "").lstrip("0") or szam, "y": y})
    ki.sort(key=lambda x: x["y"])
    nevek, latott = [], set()
    for i, x in enumerate(ki):
        sz = x["szam"] or ""
        if not sz or sz in latott:
            sz = f"#{i + 1}"
        latott.add(sz)
        nevek.append(sz)
    return nevek


def nevek(nyers_ut, db):
    """A rajzon kiírt vágányszámok, ahol olvashatók; különben római számozás."""
    a = json.loads(open(nyers_ut, encoding="utf-8").read())
    talalt = []
    for t in a["vaganyok"]:
        n = t.get("nev") or ""
        m = re.match(r"^\s*(\d{1,3}[ab]?|[IVXL]{1,7})\.", n)
        if m and re.search(r"\bfő\b", n):
            talalt.append((t["y"], m.group(1).lstrip("0") or m.group(1)))
    talalt.sort()
    egyedi = []
    for _, v in talalt:
        if v not in egyedi:
            egyedi.append(v)
    if len(egyedi) >= db:
        return egyedi[:db]
    # kiegészítés római számokkal, a már meglévőket átugorva
    ki = list(egyedi)
    for r in ROMAI:
        if len(ki) >= db:
            break
        if r not in ki:
            ki.append(r)
    return ki[:db]


if __name__ == "__main__":
    png, nyers = sys.argv[1], sys.argv[2]
    db, _ = szamol(png)
    print(json.dumps({"db": db, "nevek": nevek(nyers, db)}, ensure_ascii=False))
