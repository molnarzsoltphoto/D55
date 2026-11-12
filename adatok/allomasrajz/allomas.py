"""Állomási vágányút-modell egy vázlatos helyszínrajzból.

A vágányokat nem a feliratuk, hanem a geometria azonosítja: az állomás közepén
húzott függőlegest minden átmenő és kitérő vágány metszi, a csonka mellékvágányok
többsége nem. A metszéspontok y szerinti sorrendje adja a vágányok sorrendjét —
a szimulátor vágányai (I, II, III…) is ebben a sorrendben felelnek meg nekik.

A feliratokból csak annyit használunk, amennyi van: a vágánynév (ahol a rajz
kiírja), a váltószámok és a szelvényszámok a váltótáblázatból.
"""
import sys, json, math, collections, heapq


def P(N, i):
    return (N[i]["x"], N[i]["y"])


def load(halo, cimke):
    g = json.load(open(halo))
    c = json.load(open(cimke))
    N = {n["i"]: n for n in g["nodes"]}
    adj = collections.defaultdict(set)
    for e in g["edges"]:
        adj[e["a"]].add(e["b"])
        adj[e["b"]].add(e["a"])
    for i in N:
        N[i]["deg"] = len(adj[i])
    return N, adj, g["edges"], c


def fo_komponens(N, adj):
    """A legnagyobb összefüggő komponens — a törmelék (pecsétek, keretek) kiesik."""
    latott, legnagyobb = set(), set()
    for s in N:
        if s in latott:
            continue
        verem, comp = [s], {s}
        latott.add(s)
        while verem:
            u = verem.pop()
            for v in adj[u]:
                if v not in comp:
                    comp.add(v)
                    latott.add(v)
                    verem.append(v)
        if len(comp) > len(legnagyobb):
            legnagyobb = comp
    return legnagyobb


def metszesek(N, edges, comp, x0):
    """Az x0 függőlegest metsző élek, a metszéspont y-ja szerint rendezve."""
    ki = []
    for e in edges:
        if e["a"] not in comp or e["b"] not in comp:
            continue
        poly = e.get("poly") or [P(N, e["a"]), P(N, e["b"])]
        for a, b in zip(poly, poly[1:]):
            if (a[0] - x0) * (b[0] - x0) > 0 or a[0] == b[0]:
                continue
            t = (x0 - a[0]) / (b[0] - a[0])
            ki.append({"edge": (e["a"], e["b"]), "y": a[1] + t * (b[1] - a[1])})
            break
    ki.sort(key=lambda z: z["y"])
    # azonos y-on futó duplumok kiszűrése
    tiszta = []
    for m in ki:
        if tiszta and abs(m["y"] - tiszta[-1]["y"]) < 3.0:
            continue
        tiszta.append(m)
    return tiszta


def kozep(N, edges, comp):
    """Az állomás törzse ott van, ahol a legtöbb vágány fut egymás mellett:
    végigpásztázzuk az x tengelyt, és azt a függőlegest választjuk, amelyet a
    legtöbb él metsz (holtversenyben a középsőt)."""
    xs = [N[i]["x"] for i in comp]
    x0, x1 = min(xs), max(xs)
    if x1 - x0 < 1:
        return x0
    jeloltek = [x0 + (x1 - x0) * k / 200.0 for k in range(5, 196)]
    legjobb, db = [], 0
    for x in jeloltek:
        n = len(metszesek(N, edges, comp, x))
        if n > db:
            db, legjobb = n, [x]
        elif n == db:
            legjobb.append(x)
    kozepe = (x0 + x1) / 2
    return min(legjobb, key=lambda x: abs(x - kozepe)) if legjobb else kozepe


def bejaratok(N, comp, dirs, tracks=(), margo=30.0):
    """Vonali végek: a vágányok magasságsávjában a legszélső zsákvégek. A csonka
    vágányok beljebb érnek véget, a lapszéli rajzi törmelék pedig kilóg a sávból."""
    ty = [t["y"] for t in tracks]
    sav = (min(ty) - 45, max(ty) + 45) if ty else (-1e9, 1e9)
    jelolt = [i for i in comp if N[i]["deg"] == 1 and sav[0] <= N[i]["y"] <= sav[1]]
    if not jelolt:
        return []
    xmin = min(N[i]["x"] for i in jelolt)
    xmax = max(N[i]["x"] for i in jelolt)
    ki = []
    for i in jelolt:
        oldal = ("bal" if N[i]["x"] <= xmin + margo else
                 "jobb" if N[i]["x"] >= xmax - margo else None)
        if not oldal:
            continue
        nev = None
        d = [x for x in dirs if x["fele"] == oldal]
        if d:
            nev = min(d, key=lambda x: abs(x["y"] - N[i]["y"]))["irany"]
        ki.append({"irany": nev or oldal, "fele": oldal, "node": i,
                   "x": N[i]["x"], "y": N[i]["y"]})
    ki.sort(key=lambda e: (e["fele"], e["y"]))
    return ki


def ut(N, adj, start, celok, befele):
    """Legrövidebb x-monoton út: a vonat nem fordulhat vissza a váltón."""
    tav = {start: 0.0}
    elozo = {}
    sor = [(0.0, start)]
    while sor:
        d, u = heapq.heappop(sor)
        if d > tav.get(u, 1e18) + 1e-9:
            continue
        if u in celok and u != start:
            p = [u]
            while p[-1] != start:
                p.append(elozo[p[-1]])
            return p[::-1]
        for v in adj[u]:
            if (N[v]["x"] - N[u]["x"]) * befele <= 0.4:
                continue
            w = math.dist(P(N, u), P(N, v))
            if w + d < tav.get(v, 1e18):
                tav[v] = w + d
                elozo[v] = u
                heapq.heappush(sor, (w + d, v))
    return None


def valtonevek(N, comp, swlab, valtotabla):
    """Váltószám → csomópont. A rajzi címke távolsága dönt, de a váltók fizikai
    sorrendje a szelvényszám, és az a rajzon balról jobbra nő: ezt monoton
    illesztéssel kényszerítjük ki, így a közeli váltók nem cserélődnek fel."""
    nodes = sorted((i for i in comp if N[i]["deg"] >= 3), key=lambda i: N[i]["x"])
    labs = [s for s in swlab if s["t"] in valtotabla]
    if not nodes or not labs:
        return {}, [], True

    def szelv(t):
        a, b = valtotabla[t].split("+")
        return int(a) * 100 + int(b)

    # A szelvényszám a váltók fizikai sorrendje. Hogy a rajz melyik végén nő, nem tudjuk
    # előre (a helyszínrajzok tájolása nem egységes), ezért mindkét irányt megpróbáljuk,
    # és az illeszkedőbbet fogadjuk el. Ez egyben megmondja, merre van a vonal eleje.
    jobbra_no = _illesztes(N, nodes, labs, szelv, True)[0] <= _illesztes(N, nodes, labs, szelv, False)[0]
    _, nev, parositatlan = _illesztes(N, nodes, labs, szelv, jobbra_no)
    return nev, parositatlan, jobbra_no


def _illesztes(N, nodes, labs, szelv, novekvo):
    labs = sorted(labs, key=lambda s: szelv(s["t"]) * (1 if novekvo else -1))
    n, m = len(labs), len(nodes)
    INF = float("inf")
    SKIP_L, SKIP_N, MAXD = 60.0, 18.0, 34.0
    D = [[INF] * (m + 1) for _ in range(n + 1)]
    CH = [[None] * (m + 1) for _ in range(n + 1)]
    D[0][0] = 0.0
    for i in range(n + 1):
        for j in range(m + 1):
            if D[i][j] == INF:
                continue
            if i < n and j < m:
                c = math.dist((labs[i]["x"], labs[i]["y"]), P(N, nodes[j]))
                if c <= MAXD and D[i][j] + c < D[i + 1][j + 1]:
                    D[i + 1][j + 1] = D[i][j] + c
                    CH[i + 1][j + 1] = ("m", i, j)
            if i < n and D[i][j] + SKIP_L < D[i + 1][j]:
                D[i + 1][j] = D[i][j] + SKIP_L
                CH[i + 1][j] = ("l", i, j)
            if j < m and D[i][j] + SKIP_N < D[i][j + 1]:
                D[i][j + 1] = D[i][j] + SKIP_N
                CH[i][j + 1] = ("n", i, j)
    nev, parositatlan = {}, []
    i, j = n, m
    while CH[i][j]:
        k, pi, pj = CH[i][j]
        if k == "m":
            nev[nodes[pj]] = labs[pi]["t"]
        elif k == "l":
            parositatlan.append(labs[pi]["t"])
        i, j = pi, pj
    return D[n][m], nev, parositatlan


def seg_tav(p, a, b):
    ax, ay = a
    bx, by = b
    px, py = p
    dx, dy = bx - ax, by - ay
    L2 = dx * dx + dy * dy
    t = 0.0 if L2 == 0 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / L2))
    return math.dist(p, (ax + t * dx, ay + t * dy))


def vagany_nevek(N, edges, tracks, cimkek):
    """Ahol a rajz kiírja a vágány nevét, hozzárendeljük a metszett élhez."""
    for t in cimkek:
        pont = (t["x"] + 8, t["y"])
        legjobb = None
        for k, tr in enumerate(tracks):
            e = next((e for e in edges if (e["a"], e["b"]) == tr["edge"]), None)
            if not e:
                continue
            poly = e.get("poly") or []
            for a, b in zip(poly, poly[1:]):
                if max(a[1], b[1]) < t["y"] - 1.0:
                    continue
                d = seg_tav(pont, a, b)
                if d <= 15 and (legjobb is None or d < legjobb[0]):
                    legjobb = (d, k)
        if legjobb and "nev" not in tracks[legjobb[1]]:
            tracks[legjobb[1]]["nev"] = t["nev"]
            tracks[legjobb[1]]["szam"] = t["szam"]
    return tracks


def main(halo, cimke, out):
    N, adj, edges, c = load(halo, cimke)
    comp = fo_komponens(N, adj)
    x0 = kozep(N, edges, comp)
    tracks = metszesek(N, edges, comp, x0)
    for k, t in enumerate(tracks):
        t["sorszam"] = k + 1
    vagany_nevek(N, edges, tracks, c.get("vaganyok", []))
    nev, parositatlan, jobbra_no = valtonevek(N, comp, c.get("valtoszamok", []), c.get("valtotabla", {}))
    SW = lambda i: nev.get(i, f"#{i}")
    ents = bejaratok(N, comp, c.get("iranyok", []), tracks)

    print(f"Metszővonal x={x0:.1f}; {len(tracks)} vágány, {len(ents)} vonali vég, "
          f"{sum(1 for i in comp if N[i]['deg'] >= 3)} elágazás "
          f"({len(nev)} váltószámmal)")
    for t in tracks:
        print(f"   {t['sorszam']:>2}. vágány  y={t['y']:6.1f}  él {t['edge']}  {t.get('nev', '')}")
    for e in ents:
        print(f"   vég {e['fele']:<4} node={e['node']:<4} y={e['y']:6.1f}  {e['irany']}")

    utak = {}
    for e in ents:
        befele = +1 if e["fele"] == "bal" else -1
        for t in tracks:
            p = ut(N, adj, e["node"], set(t["edge"]), befele)
            if not p:
                continue
            utak.setdefault(f"{e['fele']}|{e['node']}", {})[str(t["sorszam"])] = {
                "valtok": [SW(i) for i in p if N[i]["deg"] >= 3], "ut": p}
    print("   vágányutak:", {k: len(v) for k, v in utak.items()})
    if parositatlan:
        print("   nem párosított váltószám:", " ".join(parositatlan))

    print(f"   szelvényszám iránya: {'balról jobbra nő' if jobbra_no else 'jobbról balra nő'}"
          f"  → Budapest felőli vég: {'bal' if jobbra_no else 'jobb'}")
    json.dump({"kozepvonal": round(x0, 1), "budapest": "bal" if jobbra_no else "jobb",
               "vaganyok": [{k: v for k, v in t.items() if k != "edge"} | {"edge": list(t["edge"])}
                            for t in tracks],
               "bejaratok": ents,
               "valtonevek": {str(k): v for k, v in nev.items()},
               "utak": utak},
              open(out, "w"), ensure_ascii=False, indent=0)


if __name__ == "__main__":
    main(*sys.argv[1:4])
