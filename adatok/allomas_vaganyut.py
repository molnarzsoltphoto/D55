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

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent / "allomasrajz"))
import pult

GYOKER = pathlib.Path(__file__).resolve().parent
FORRAS = GYOKER / "allomasok"
KIMENET = GYOKER / "allomas-vaganyut.json"
RAJZ = GYOKER / "allomas-rajz.json"
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
    tabla, rajzok = {}, {}
    for konfig in sorted(FORRAS.glob("_*.konfig.json")):
        k, adat, hiany = allomas(konfig)
        # a vágányút-tábla csak ellenőrzött állomásra kerül be: egy hamis vágányút rosszabb,
        # mint egy hiányzó (ott marad a régi, szigorúbb szabály). A rajz mindenhol készül.
        if k.get("vaganyut"):
            tabla[str(k["sim"])] = adat
        halo = konfig.with_name(konfig.name.replace(".konfig.", ".halo."))
        nyers = konfig.with_name(konfig.name.replace(".konfig.", ".nyers."))
        if halo.exists():
            rajzok[str(k["sim"])] = pult.keszit(str(halo), str(nyers), str(konfig))
        db = sum(len(v) for v in adat["utak"].values())
        print(f"{k['allomas']:<20} (sim {k['sim']:>2}): rajz {len(rajzok.get(str(k['sim']), {}).get('halozat', []))} vonal, "
              f"{len(k['vagany'])} vágány, {db} vágányút"
              + ("  [vágányút-tábla aktív]" if k.get("vaganyut") else ""))
    if not tabla:
        print("nincs feldolgozható állomás", file=sys.stderr)
    KIMENET.write_text(json.dumps(tabla, ensure_ascii=False, indent=1), encoding="utf-8")
    RAJZ.write_text(json.dumps(rajzok, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{KIMENET.name}: {len(tabla)} állomás; "
          f"{RAJZ.name}: {len(rajzok)} rajz, {RAJZ.stat().st_size // 1024} kB")


if __name__ == "__main__":
    main()
