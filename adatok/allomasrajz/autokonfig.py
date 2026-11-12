"""Állomáskonfiguráció gépi előállítása a kiolvasott modellből.

A szimulátor vágányai (I, II, III…) absztraktak, a rajzé geometriaiak (fentről lefelé
sorszámozva). Ez a modul összepárosítja őket, és kiosztja a négy vonali szerepet.

Tájolás: a váltók fizikai sorrendje a szelvényszám, és a kiolvasás megmondja, a rajzon
melyik irányba nő — abból adódik, melyik végén van a vonal eleje (Budapest). A jobb
oldali közlekedés miatt a növekvő szelvény felé haladó vonat a jobb oldali vágányon jár,
ami a rajzon az alsó, ha a szelvény jobbra nő, és a felső, ha balra.

A vágányok párosítása: ahol a rajz kiírja a vágány számát (római vagy arab), azt
használjuk; a maradékot a mindkét végről elérhető vágányokból, fentről lefelé.
Gépi javaslat: ellenőrizni kell az ellenőrző képen.
"""
import json
import re
import sys

ROMAI = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
         "XI", "XII", "XIII", "XIV", "XV"]
ARAB = {r: i + 1 for i, r in enumerate(ROMAI)}


def _szam(nev):
    """A vágánynévből a sorszám: '03.fő jobb átmenő' → 3, 'IV. fő Hh=686' → 4."""
    if not nev:
        return None
    m = re.match(r"^\s*(\d{1,3})[ab]?\.", nev)
    if m:
        return int(m.group(1))
    m = re.match(r"^\s*([IVXL]{1,7})[ab]?\.", nev)
    if m and m.group(1) in ARAB:
        return ARAB[m.group(1)]
    return None


def keszit(nyers_ut, sim_id, nev, modell_vaganyok):
    a = json.loads(open(nyers_ut, encoding="utf-8").read())
    jobbra_no = a.get("budapest", "bal") == "bal"
    L = "bal" if jobbra_no else "jobb"
    R = "jobb" if jobbra_no else "bal"

    utak = a["utak"]
    elerhet = {k: set(v.keys()) for k, v in utak.items()}

    def vegek(oldal):
        v = [e for e in a["bejaratok"] if e["fele"] == oldal]
        v.sort(key=lambda e: -len(elerhet.get(f"{oldal}|{e['node']}", ())))
        v = v[:2]
        v.sort(key=lambda e: e["y"])
        return v

    def valaszt(oldal, also):
        v = vegek(oldal)
        if not v:
            return None
        e = v[-1] if (also and len(v) > 1) else v[0]
        return f"{oldal}|{e['node']}"

    # a növekvő szelvény felé haladó a rajzon alul jár, ha a szelvény jobbra nő
    pecs_alul = jobbra_no
    bejarat = {}
    for szerep, oldal, pecs_fele in (("L.be", L, True), ("L.ki", L, False),
                                     ("R.be", R, False), ("R.ki", R, True)):
        k = valaszt(oldal, pecs_alul if pecs_fele else not pecs_alul)
        if k and k in utak:
            bejarat[szerep] = k

    balrol = elerhet.get(bejarat.get("L.be", ""), set()) | elerhet.get(bejarat.get("L.ki", ""), set())
    jobbrol = elerhet.get(bejarat.get("R.be", ""), set()) | elerhet.get(bejarat.get("R.ki", ""), set())
    kozos = sorted(balrol & jobbrol, key=int) or sorted(balrol | jobbrol, key=int)

    y = {str(t["sorszam"]): t["y"] for t in a["vaganyok"]}
    nevek = {str(t["sorszam"]): t.get("nev", "") for t in a["vaganyok"]}
    kozos.sort(key=lambda s: y[s])

    vagany, elkelt = {}, set()
    # 1) ahol a rajz kiírja a vágány számát
    for sorsz in kozos:
        n = _szam(nevek.get(sorsz))
        if n and 1 <= n <= len(modell_vaganyok):
            modell = modell_vaganyok[n - 1]
            if modell not in vagany:
                vagany[modell] = sorsz
                elkelt.add(sorsz)
    # 2) a maradék fentről lefelé
    szabad = [s for s in kozos if s not in elkelt]
    for modell in modell_vaganyok:
        if modell in vagany or not szabad:
            continue
        vagany[modell] = szabad.pop(0)

    # átmenő fővágány: amit a rajz annak nevez, különben a legkevesebb váltóval elért
    atmeno = {}
    for irany, szerep in (("1", "L.be"), ("-1", "R.be")):
        kulcs = bejarat.get(szerep)
        if not kulcs:
            continue
        jelolt = None
        for modell, sorsz in vagany.items():
            nm = (nevek.get(sorsz) or "").lower()
            if ("jobb átmenő" in nm and irany == "1") or ("bal átmenő" in nm and irany == "-1"):
                jelolt = modell
        if not jelolt:
            p = [(len(utak[kulcs][s]["valtok"]), m) for m, s in vagany.items() if s in utak[kulcs]]
            jelolt = min(p)[1] if p else None
        if jelolt:
            atmeno[irany] = jelolt

    return {"allomas": nev, "sim": sim_id,
            "megjegyzes": "Gépi javaslat a helyszínrajzból; a rajz megjelenítéséhez elég, "
                          "a vágányút-táblához ellenőrizni kell.",
            "vagany": vagany, "atmeno": atmeno, "bejarat": bejarat,
            "_vaganynevek": {m: nevek.get(s, "") for m, s in vagany.items()},
            "_budapest": L}


if __name__ == "__main__":
    nyers, sim_id, nev, db = sys.argv[1], int(sys.argv[2]), sys.argv[3], int(sys.argv[4])
    print(json.dumps(keszit(nyers, sim_id, nev, ROMAI[:db]), ensure_ascii=False, indent=1))
