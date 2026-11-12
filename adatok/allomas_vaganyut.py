#!/usr/bin/env python3
"""A helyszínrajzokból kiolvasott állomásmodellekből a szimulátor vágányút-táblája.

Bemenet állomásonként két fájl az adatok/allomasok könyvtárban:
  _<nev>.nyers.json   – az allomasrajz/allomas.py kimenete (a rajzból kiolvasva)
  _<nev>.konfig.json  – kézi hozzárendelés: melyik modellvágány melyik valódi vágány,
                        és melyik rajzi bejárati pont melyik szerep (L.be, L.ki, R.be, R.ki)

Kimenet: adatok/allomas-vaganyut.json — állomásazonosító szerint a modellvágányokhoz
tartozó váltólisták. Két vágányút akkor fér össze, ha a váltólistáik metszete üres.

A szerepek a szimulátor oldalkódjából adódnak:
  L.be  – bejárat a budapesti végen (menetirány Pécs felé)
  L.ki  – kijárat a budapesti végen (menetirány Budapest felé)
  R.be  – bejárat a pécsi végen     (menetirány Budapest felé)
  R.ki  – kijárat a pécsi végen     (menetirány Pécs felé)
"""
import json
import pathlib
import sys

GYOKER = pathlib.Path(__file__).resolve().parent
FORRAS = GYOKER / "allomasok"
KIMENET = GYOKER / "allomas-vaganyut.json"
SZEREPEK = ("L.be", "L.ki", "R.be", "R.ki")


def allomas(konfig_ut):
    k = json.loads(konfig_ut.read_text(encoding="utf-8"))
    nyers_ut = konfig_ut.with_name(konfig_ut.name.replace(".konfig.", ".nyers."))
    if not nyers_ut.exists():
        raise SystemExit(f"hiányzik: {nyers_ut.name}")
    nyers = json.loads(nyers_ut.read_text(encoding="utf-8"))

    utak, hiany = {}, []
    for szerep, kulcs in k["bejarat"].items():
        if szerep not in SZEREPEK:
            raise SystemExit(f"{konfig_ut.name}: ismeretlen szerep: {szerep}")
        forras = nyers["utak"].get(kulcs)
        if forras is None:
            raise SystemExit(f"{konfig_ut.name}: nincs ilyen bejárati pont: {kulcs}")
        for modell, valos in k["vagany"].items():
            u = forras.get(valos)
            if not u:
                hiany.append(f"{szerep}/{modell}({valos})")
                continue
            utak.setdefault(szerep, {})[modell] = u["valtok"]

    return k, {"allomas": k["allomas"], "vagany": k["vagany"],
               "atmeno": k.get("atmeno", {}), "utak": utak}, hiany


def main():
    tabla = {}
    for konfig in sorted(FORRAS.glob("_*.konfig.json")):
        k, adat, hiany = allomas(konfig)
        tabla[str(k["sim"])] = adat
        db = {sz: len(v) for sz, v in adat["utak"].items()}
        print(f"{k['allomas']:<18} (sim {k['sim']:>2}): " +
              ", ".join(f"{sz} {n} vágány" for sz, n in db.items()))
        if hiany:
            print(f"    nincs levezetett vágányút: {', '.join(hiany)}")
    if not tabla:
        print("nincs feldolgozható állomás", file=sys.stderr)
    KIMENET.write_text(json.dumps(tabla, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{KIMENET.name}: {len(tabla)} állomás")


if __name__ == "__main__":
    main()
