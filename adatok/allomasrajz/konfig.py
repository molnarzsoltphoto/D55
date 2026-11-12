"""Állomáskonfiguráció javaslat a kiolvasott modellből.

A szimulátor vágányai (I, II, III…) absztraktak, a rajzé geometriaiak (fentről
lefelé sorszámozva). A javaslat azokat a vágányokat párosítja a modellhez,
amelyek mindkét állomásvégről elérhetők — azok a valódi közlekedő vágányok —,
és a vonali végeket oldal + magasság szerint osztja ki a négy szerepre.

A jobb oldali közlekedés miatt a rajzon (Budapest balra) a Pécs felé haladó az
alsó, a Budapest felé haladó a felső vonali vágányon jár:
  L.be  = bal oldal, alsó vég      R.be = jobb oldal, felső vég
  L.ki  = bal oldal, felső vég     R.ki = jobb oldal, alsó vég
Egyvágányú oldalon mindkét szerep ugyanarra a végre mutat.

A javaslatot ellenőrizni kell az ellenőrző képen, mielőtt élesbe kerül.
"""
import json
import sys

ROMAI = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
         "XI", "XII", "XIII", "XIV", "XV"]


def javaslat(nyers_ut, sim_id, nev, modell_vaganyok):
    a = json.loads(open(nyers_ut, encoding="utf-8").read())
    utak = a["utak"]
    balok = [k for k in utak if k.startswith("bal|")]
    jobbok = [k for k in utak if k.startswith("jobb|")]

    # mindkét végről elérhető vágányok = a tényleges közlekedő vágányok
    mind = None
    for k in utak:
        s = set(utak[k].keys())
        mind = s if mind is None else (mind | s)
    balrol = set().union(*[set(utak[k]) for k in balok]) if balok else set()
    jobbrol = set().union(*[set(utak[k]) for k in jobbok]) if jobbok else set()
    kozos = sorted(balrol & jobbrol, key=int)

    y = {str(t["sorszam"]): t["y"] for t in a["vaganyok"]}
    nevek = {str(t["sorszam"]): t.get("nev", "") for t in a["vaganyok"]}
    kozos.sort(key=lambda s: y[s])

    vagany = {}
    for i, modell in enumerate(modell_vaganyok):
        if i < len(kozos):
            vagany[modell] = kozos[i]

    def veg(oldal, also):
        v = [e for e in a["bejaratok"] if e["fele"] == oldal]
        if not v:
            return None
        v.sort(key=lambda e: e["y"])
        return f"{oldal}|{(v[-1] if also else v[0])['node']}"

    bejarat = {}
    for szerep, oldal, also in (("L.be", "bal", True), ("L.ki", "bal", False),
                                ("R.be", "jobb", False), ("R.ki", "jobb", True)):
        k = veg(oldal, also)
        if k and k in utak:
            bejarat[szerep] = k

    return {"allomas": nev, "sim": sim_id,
            "megjegyzes": "Gépi javaslat a helyszínrajzból; ellenőrizni kell.",
            "vagany": vagany,
            "atmeno": {},
            "bejarat": bejarat,
            "_vaganynevek": {m: nevek.get(s, "") for m, s in vagany.items()}}


if __name__ == "__main__":
    nyers, sim_id, nev, db = sys.argv[1], int(sys.argv[2]), sys.argv[3], int(sys.argv[4])
    print(json.dumps(javaslat(nyers, sim_id, nev, ROMAI[:db]), ensure_ascii=False, indent=1))
