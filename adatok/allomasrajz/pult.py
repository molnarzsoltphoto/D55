"""Az állomási pult rajzadata a kiolvasott helyszínrajzból.

A pult eddig sematikus volt: minden vágány egy vízszintes vonal, a torok egy V.
Ez a modul a valódi vágányhálózatot teszi át a pult koordinátarendszerébe, hogy
a játékos azt lássa, ami a helyszínrajzon van: a tényleges váltókörzetet, a
vágányok tényleges sorrendjét és azt, melyik vágányút merre vezet.

A rajz x és y irányban külön skálázódik: az állomás a valóságban nagyon hosszú
és lapos, a pult viszont közel négyzetes, és a vágányoknak kattintható
távolságra kell kerülniük egymástól. A topológia ettől nem sérül.
"""
import json
import sys


def polilinek(halo):
    g = json.loads(open(halo, encoding="utf-8").read())
    N = {n["i"]: n for n in g["nodes"]}
    el = {}
    for e in g["edges"]:
        poly = e.get("poly") or [[N[e["a"]]["x"], N[e["a"]]["y"]], [N[e["b"]]["x"], N[e["b"]]["y"]]]
        el[(e["a"], e["b"])] = [list(map(float, p)) for p in poly]
        el[(e["b"], e["a"])] = [list(map(float, p)) for p in poly][::-1]
    return N, el, g


def ut_polilin(el, ut):
    """Csomópontlánc → összefűzött vonal."""
    ki = []
    for a, b in zip(ut, ut[1:]):
        p = el.get((a, b))
        if not p:
            continue
        ki.extend(p if not ki else p[1:])
    return ki


def keszit(halo, allomas, konfig):
    N, el, g = polilinek(halo)
    a = json.loads(open(allomas, encoding="utf-8").read())
    k = json.loads(open(konfig, encoding="utf-8").read())

    hasznalt = set()
    for u in a["utak"].values():
        for v in u.values():
            hasznalt.update(v["ut"])
    pontok = [(N[i]["x"], N[i]["y"]) for i in N]
    x0 = min(p[0] for p in pontok); x1 = max(p[0] for p in pontok)
    y0 = min(p[1] for p in pontok); y1 = max(p[1] for p in pontok)

    db = len(k["vagany"])
    # a pult magassága a modellvágányokból adódna, de a valódi rajzon több vágány van,
    # és a tényleges (egyenetlen) vágányközöknél a jelzők egymásra csúsznának
    H = max(175 + db * 58, 150 + len(a["vaganyok"]) * 42)
    BX0, BX1, BY0, BY1 = 88.0, 1112.0, 96.0, H - 72.0
    sx = (BX1 - BX0) / max(x1 - x0, 1e-6)
    sy = (BY1 - BY0) / max(y1 - y0, 1e-6)
    T = lambda p: [round(BX0 + (p[0] - x0) * sx, 1), round(BY0 + (p[1] - y0) * sy, 1)]

    halozat = []
    for (a_, b_), poly in el.items():
        if a_ > b_:
            continue
        halozat.append([T(p) for p in poly])

    # modellvágány → a rajzi vágány vonala és középpontja
    sorszam_edge = {str(t["sorszam"]): tuple(t["edge"]) for t in a["vaganyok"]}
    sorszam_y = {str(t["sorszam"]): t["y"] for t in a["vaganyok"]}
    vagany = {}
    for modell, sorsz in k["vagany"].items():
        e = sorszam_edge.get(str(sorsz))
        if not e:
            continue
        poly = el.get(e) or el.get((e[1], e[0]))
        if not poly:
            continue
        pts = [T(p) for p in poly]
        yy = round(T((0, sorszam_y[str(sorsz)]))[1], 1)
        # a vágány teljes hossza: a hozzá tartozó magasságon futó vízszintes szakaszok
        xs = []
        for vonal in halozat:
            for p, q in zip(vonal, vonal[1:]):
                if abs(p[1] - yy) <= 5 and abs(q[1] - yy) <= 5:
                    xs += [p[0], q[0]]
        vagany[modell] = {"vonal": pts, "y": yy,
                          "x0": round(min(xs) if xs else min(p[0] for p in pts), 1),
                          "x1": round(max(xs) if xs else max(p[0] for p in pts), 1)}

    utak = {}
    for szerep, kulcs in k["bejarat"].items():
        forras = a["utak"].get(kulcs, {})
        for modell, sorsz in k["vagany"].items():
            u = forras.get(str(sorsz))
            if not u:
                continue
            utak[f"{szerep}|{modell}"] = [T(p) for p in ut_polilin(el, u["ut"])]

    vegek = {}
    for szerep, kulcs in k["bejarat"].items():
        node = int(kulcs.split("|")[1])
        vegek[szerep] = T((N[node]["x"], N[node]["y"]))

    # a váltókörzetek külső határa: a kijárati jelző nem a vonalon, hanem az állomáson áll
    agak = [i for i in N if N[i]["deg"] >= 3] if False else []
    agx = [N[i]["x"] for i in N if sum(1 for e in el if e[0] == i) >= 3]
    torok = [round(T((min(agx), 0))[0], 1), round(T((max(agx), 0))[0], 1)] if agx else [BX0, BX1]

    return {"nev": k["allomas"], "h": H, "halozat": halozat, "torok": torok,
            "vagany": vagany, "utak": utak, "vegek": vegek}


if __name__ == "__main__":
    print(json.dumps(keszit(*sys.argv[1:4]), ensure_ascii=False))
