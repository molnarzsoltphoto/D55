"""Állomási vágányút-modell egy vázlatos helyszínrajzból."""
import sys, json, math, collections, heapq

def P(N, i): return (N[i]["x"], N[i]["y"])

def load(halo, cimke):
    g = json.load(open(halo)); c = json.load(open(cimke))
    N = {n["i"]: n for n in g["nodes"]}
    adj = collections.defaultdict(set)
    for e in g["edges"]: adj[e["a"]].add(e["b"]); adj[e["b"]].add(e["a"])
    for i in N: N[i]["deg"] = len(adj[i])
    return N, adj, g["edges"], c

def seg_dist(p, a, b):
    ax, ay = a; bx, by = b; px, py = p
    dx, dy = bx-ax, by-ay; L2 = dx*dx+dy*dy
    t = 0.0 if L2 == 0 else max(0.0, min(1.0, ((px-ax)*dx+(py-ay)*dy)/L2))
    q = (ax+t*dx, ay+t*dy)
    return math.dist(p, q), q

def anchor(edges, t, maxd=15.0):
    """A vágánynév alatti vonalszakasz megkeresése a valódi poliline mentén."""
    p = (t["x"] + 8, t["y"])
    best = None
    for e in edges:
        poly = e.get("poly") or []
        for a, b in zip(poly, poly[1:]):
            if max(a[1], b[1]) < t["y"] - 1.0: continue        # a felirat fölött fut
            if min(a[0], b[0]) - 40 > p[0] or max(a[0], b[0]) + 15 < p[0]: continue
            d, q = seg_dist(p, a, b)
            if d <= maxd and (best is None or d < best[0]): best = (d, e, q)
    return best

def ut(N, adj, start, targets, befele):
    dist = {start: 0.0}; prev = {}; pq = [(0.0, start)]
    while pq:
        d, u = heapq.heappop(pq)
        if d > dist.get(u, 1e18)+1e-9: continue
        if u in targets and u != start:
            p = [u]
            while p[-1] != start: p.append(prev[p[-1]])
            return p[::-1]
        for v in adj[u]:
            if (N[v]["x"]-N[u]["x"])*befele <= 0.4: continue
            w = math.dist(P(N, u), P(N, v))
            if w+d < dist.get(v, 1e18):
                dist[v] = w+d; prev[v] = u; heapq.heappush(pq, (w+d, v))
    return None

def switch_names(N, swlab, valtotabla):
    """Váltószám -> csomópont. A rajzi címke távolsága dönt, de a szelvényszám-sorrend
    (azaz a váltók x szerinti sorrendje) monoton kényszerként szerepel."""
    nodes = sorted((i for i in N if N[i]["deg"] >= 3), key=lambda i: N[i]["x"])
    labs = [s for s in swlab if s["t"] in valtotabla]
    def szelv(t):
        a, b = valtotabla[t].split("+"); return int(a)*100 + int(b)
    # a váltók fizikai sorrendje a szelvényszám; a rajzon ez balról jobbra nő
    labs.sort(key=lambda s: szelv(s["t"]))
    BIG = 1e5
    n, m = len(labs), len(nodes)
    INF = float("inf")
    D = [[INF]*(m+1) for _ in range(n+1)]
    CH = [[None]*(m+1) for _ in range(n+1)]
    D[0][0] = 0.0
    SKIP_L, SKIP_N, MAXD = 60.0, 18.0, 34.0
    for i in range(n+1):
        for j in range(m+1):
            if D[i][j] == INF: continue
            if i < n and j < m:
                c = math.dist((labs[i]["x"], labs[i]["y"]), P(N, nodes[j]))
                if c > MAXD: c = INF
                if c < INF and D[i][j] + c < D[i+1][j+1]: D[i+1][j+1] = D[i][j] + c; CH[i+1][j+1] = ("m", i, j)
            if i < n and D[i][j] + SKIP_L < D[i+1][j]: D[i+1][j] = D[i][j] + SKIP_L; CH[i+1][j] = ("l", i, j)
            if j < m and D[i][j] + SKIP_N < D[i][j+1]: D[i][j+1] = D[i][j] + SKIP_N; CH[i][j+1] = ("n", i, j)
    out, gyenge = {}, []
    i, j = n, m
    while CH[i][j]:
        k, pi, pj = CH[i][j]
        if k == "m":
            d = math.dist((labs[pi]["x"], labs[pi]["y"]), P(N, nodes[pj]))
            out[nodes[pj]] = labs[pi]["t"]
            if d > 20: gyenge.append((labs[pi]["t"], nodes[pj], round(d, 1)))
        elif k == "l":
            gyenge.append((labs[pi]["t"], None, None))
        i, j = pi, pj
    return out, gyenge

def main(halo, cimke, out):
    N, adj, edges, c = load(halo, cimke)
    nev, gyenge = switch_names(N, c["valtoszamok"], c["valtotabla"])
    SW = lambda i: nev.get(i, f"?{i}")
    tracks = []
    for t in c["vaganyok"]:
        a = anchor(edges, t)
        if not a: print(f"   !! nincs vonal: {t['nev']}"); continue
        d, e, q = a
        tracks.append({"szam": t["szam"], "nev": t["nev"], "edge": (e["a"], e["b"]),
                       "x": round(q[0], 1), "y": round(q[1], 1), "d": round(d, 1)})
    print(f"VÁGÁNYOK ({len(tracks)}):")
    for t in sorted(tracks, key=lambda t: t["y"]):
        print(f"   {t['szam']:>4}  horgony y={t['y']:6.1f} x={t['x']:6.1f} (táv {t['d']:4.1f})  él {t['edge']}  {t['nev'][:40]}")
    xs = [N[i]["x"] for i in N]; xmin, xmax = min(xs), max(xs)
    ents = []
    for i in N:
        if N[i]["deg"] != 1: continue
        side = "bal" if N[i]["x"] < xmin+12 else ("jobb" if N[i]["x"] > xmax-45 else None)
        if not side: continue
        d = [x for x in c["iranyok"] if x["fele"] == side]
        if not d: continue
        b = min(d, key=lambda x: abs(x["y"]-N[i]["y"]))
        ents.append({"irany": b["irany"], "fele": side, "node": i, "x": N[i]["x"], "y": N[i]["y"]})
    print("\nBEJÁRATOK:")
    for e in sorted(ents, key=lambda e: (e["fele"], e["y"])):
        print(f"   {e['fele']:4} {e['irany']:14} node={e['node']:3} x={e['x']:6.1f} y={e['y']:6.1f}")
    utak = {}
    print("\nVÁGÁNYUTAK:")
    for e in sorted(ents, key=lambda e: (e["fele"], e["y"])):
        befele = +1 if e["fele"] == "bal" else -1
        for t in sorted(tracks, key=lambda t: t["y"]):
            p = ut(N, adj, e["node"], set(t["edge"]), befele)
            if not p: continue
            sw = [SW(i) for i in p if N[i]["deg"] >= 3]
            utak.setdefault(f"{e['irany']}|{e['node']}", {})[t["szam"]] = {"valtok": sw, "ut": p}
            print(f"   {e['irany']:13} n{e['node']:<3} -> {t['szam']:>4} : {' '.join(sw)}")
    if gyenge: print("\nBIZONYTALAN VÁLTÓ-HOZZÁRENDELÉS:", gyenge)
    json.dump({"valtonevek": {str(k): v for k, v in nev.items()}, "vaganyok": tracks,
               "bejaratok": ents, "utak": utak}, open(out, "w"), ensure_ascii=False, indent=0)

if __name__ == "__main__": main(*sys.argv[1:4])
