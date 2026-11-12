#!/usr/bin/env python3
"""Az állomások vágányszámát a helyszínrajzokhoz igazítja.

A rajzon minden fővágány mellé oda van írva, hogy „fő”. Ahol ezek a feliratok
olvashatók és többet mutatnak, mint ahány vágánya a modellben az állomásnak van,
ott a modellt a rajzhoz igazítjuk. Lefelé nem módosítunk: ahol a felirat nem
olvasható ki (nagy rajzokon gyakori), ott a kevesebb találat nem bizonyít semmit,
a vágány elvétele viszont kapacitást venne el.

A rajz geometriáját szándékosan NEM használjuk: a pixelből követett vágánykép
hullámos lett, a hézagzárás pedig nem létező váltókat gyártott. A pult marad a
régi, tiszta sematikus rajz — csak a helyes vágányszámmal.
"""
import json
import pathlib
import re
import sys

GYOKER = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(GYOKER / "allomasrajz"))
import vaganyszam  # noqa: E402

RAJZOK = GYOKER / "rajzok"
KIMENET = GYOKER / "allomas-vagany.json"
INDEX = GYOKER.parent / "index.html"


def stations():
    s = INDEX.read_text(encoding="utf-8")
    i = s.index("const STATIONS=") + len("const STATIONS=")
    j = s.index("];", i) + 1
    return s, i, j, json.loads(s[i:j])


def main():
    if not RAJZOK.is_dir():
        print("nincs adatok/rajzok könyvtár, a vágányszámok változatlanok")
        return
    s, i, j, st = stations()
    nev2id = {x["name"]: x["id"] for x in st}
    parok = json.loads((GYOKER / "allomasrajz" / "rajz-allomas.json").read_text(encoding="utf-8"))
    tabla = {}
    for fajl, allomasnev in parok.items():
        pdf = RAJZOK / f"{fajl}.pdf"
        if not pdf.exists() or allomasnev not in nev2id:
            continue
        fo = vaganyszam.vaganyok(str(pdf))
        sid = nev2id[allomasnev]
        if not fo:
            continue
        most = next(x for x in st if x["id"] == sid)["tracks"]
        db = max(len(most), len(fo))
        tabla[str(sid)] = {"nev": allomasnev, "vaganyok": vaganyszam.ROMAI[:db], "rajzrol": fo}
        if db != len(most):
            print(f"{allomasnev:<22} {len(most)} → {db} vágány  (rajzon: {', '.join(fo)})")
    KIMENET.write_text(json.dumps(tabla, ensure_ascii=False, indent=1), encoding="utf-8")

    # a STATIONS literál átírása
    valtozott = 0
    for x in st:
        t = tabla.get(str(x["id"]))
        if t and x["tracks"] != t["vaganyok"]:
            x["tracks"] = t["vaganyok"]
            valtozott += 1
    uj = s[:i] + json.dumps(st, ensure_ascii=False, separators=(",", ":")) + s[j:]
    INDEX.write_text(uj, encoding="utf-8")
    print(f"{valtozott} állomás vágányszáma a rajzhoz igazítva")


if __name__ == "__main__":
    main()
