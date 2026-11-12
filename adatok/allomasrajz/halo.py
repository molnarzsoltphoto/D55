"""Vágányhálózat-gráf kinyerése vázlatos helyszínrajzból (raszter + morfológia + csontváz)."""
import sys, json, math, collections
import cv2, numpy as np
from skimage.morphology import skeletonize


def iranyitott_zaras(mask, hossz=31):
    """A rajzi jelek (kisiklasztósaru, útátjáró, szelvényjel) kivágnak a vágányból.
    Vonalirányú zárással betömjük: a vonal mentén összeér, keresztben nem, így a
    párhuzamos vágányok nem folynak össze."""
    ki = mask.copy()
    for fok in range(0, 180, 15):
        ker = np.zeros((hossz, hossz), np.uint8)
        cv2.line(ker, (0, hossz // 2), (hossz - 1, hossz // 2), 1, 1)
        M = cv2.getRotationMatrix2D((hossz / 2 - 0.5, hossz / 2 - 0.5), fok, 1.0)
        ker = (cv2.warpAffine(ker.astype(np.float32), M, (hossz, hossz)) > 0.3).astype(np.uint8)
        if ker.sum() < 3:
            continue
        ki = np.maximum(ki, cv2.morphologyEx(mask, cv2.MORPH_CLOSE, ker))
    return ki

def mask_tracks(png, r=5, minpx=250):
    """A vágány a rajz legvastagabb vonala. A sötét pixelek mellett az erősen színeseket
    is beveszi: a helyszínrajzokon színes jelölések (szigetelt sín, besorolás) fekszenek rá
    a vágányra, és világos szürkeértékük miatt lyukat ütnének bele."""
    szin = cv2.imread(png, cv2.IMREAD_COLOR)
    im = cv2.cvtColor(szin, cv2.COLOR_BGR2GRAY)
    telitettseg = szin.max(axis=2).astype(np.int16) - szin.min(axis=2).astype(np.int16)
    bw = ((im < 128) | ((telitettseg > 60) & (im < 205))).astype(np.uint8)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2*r+1, 2*r+1))
    op = cv2.morphologyEx(bw, cv2.MORPH_OPEN, k)
    op = iranyitott_zaras(op)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(op, 8)
    keep = np.zeros_like(op)
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] >= minpx: keep[lab == i] = 1
    return im.shape, keep

def order_pixels(xs, ys, start):
    """Csontvázpixelek sorba fűzése a kezdőponttól (egyszerű legközelebbi-szomszéd)."""
    import math
    pts = list(zip(xs.tolist(), ys.tolist()))
    if not pts: return []
    cur = min(pts, key=lambda p: (p[0]-start[0])**2 + (p[1]-start[1])**2)
    rem = set(pts); rem.discard(cur); out = [cur]
    while rem:
        nxt = min(rem, key=lambda p: (p[0]-cur[0])**2 + (p[1]-cur[1])**2)
        if (nxt[0]-cur[0])**2 + (nxt[1]-cur[1])**2 > 9: break
        rem.discard(nxt); out.append(nxt); cur = nxt
    return out

def simplify(pts, eps=2.0):
    """Ramer-Douglas-Peucker."""
    if len(pts) < 3: return pts
    import math
    a, b = pts[0], pts[-1]
    dx, dy = b[0]-a[0], b[1]-a[1]; L = math.hypot(dx, dy)
    if L < 1e-6: return [a, b]
    worst, wi = 0.0, 0
    for i, p in enumerate(pts[1:-1], 1):
        d = abs(dy*(p[0]-a[0]) - dx*(p[1]-a[1])) / L
        if d > worst: worst, wi = d, i
    if worst <= eps: return [a, b]
    return simplify(pts[:wi+1], eps)[:-1] + simplify(pts[wi:], eps)

def skeleton_graph(keep, merge=12, minedge=14, mincsontvaz=45):
    sk = skeletonize(keep.astype(bool)).astype(np.uint8)
    # a rajzi jelek (szelvényjel, jelzőkép) rövid csonkjai hamis zsákvégeket adnának,
    # és elvinnék a hézagáthidalást a valódi vonalfolytatás elől
    n, lab, stats, _ = cv2.connectedComponentsWithStats(sk, 8)
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] < mincsontvaz:
            sk[lab == i] = 0
    nb = cv2.filter2D(sk, -1, np.ones((3,3), np.uint8), borderType=cv2.BORDER_CONSTANT) - sk
    nb = nb * sk
    nodemask = ((nb != 2) & (sk > 0)).astype(np.uint8)
    # csomópont-pixelek kiterjesztése, hogy az elágazásnál összeérjenek
    nodemask = cv2.dilate(nodemask, np.ones((3,3), np.uint8))* sk
    nn, nlab, _, ncent = cv2.connectedComponentsWithStats(nodemask, 8)
    edgemask = ((sk > 0) & (nodemask == 0)).astype(np.uint8)
    en, elab = cv2.connectedComponents(edgemask, 8)
    nodes = [tuple(ncent[i]) for i in range(1, nn)]           # (x, y) px
    links = []
    for e in range(1, en):
        ys, xs = np.where(elab == e)
        if len(xs) < 2: continue
        comp = np.zeros_like(sk); comp[ys, xs] = 1
        grown = cv2.dilate(comp, np.ones((3,3), np.uint8))
        touch = sorted(set(nlab[(grown > 0) & (nlab > 0)].tolist()))
        length = len(xs)
        if len(touch) == 2:
            links.append((touch[0]-1, touch[1]-1, length, (xs, ys)))
        elif len(touch) == 1:
            links.append((touch[0]-1, None, length, (xs, ys)))
    # csomópontok összevonása közelség szerint
    parent = list(range(len(nodes)))
    def find(a):
        while parent[a] != a: parent[a] = parent[parent[a]]; a = parent[a]
        return a
    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb: parent[rb] = ra
    for i in range(len(nodes)):
        for j in range(i+1, len(nodes)):
            if math.dist(nodes[i], nodes[j]) <= merge: union(i, j)
    for a, b, L, _ in links:                     # rövid csonkélek összehúzása
        if b is not None and L < minedge: union(a, b)
    groups = collections.defaultdict(list)
    for i in range(len(nodes)): groups[find(i)].append(i)
    remap, pts = {}, []
    for root, members in groups.items():
        cx = sum(nodes[m][0] for m in members)/len(members)
        cy = sum(nodes[m][1] for m in members)/len(members)
        for m in members: remap[m] = len(pts)
        pts.append((cx, cy))
    edges = []
    for a, b, L, px in links:
        if b is None: continue
        A, B = remap[a], remap[b]
        if A == B: continue
        poly = simplify(order_pixels(px[0], px[1], pts[A]), 2.0)
        poly = [pts[A]] + poly + [pts[B]]
        edges.append({"a": A, "b": B, "len": int(L), "poly": poly,
                      "mid": (float(px[0].mean()), float(px[1].mean()))})
    # párhuzamos élek összevonása
    seen = {}
    for e in edges:
        k = (min(e["a"], e["b"]), max(e["a"], e["b"]))
        if k not in seen or e["len"] > seen[k]["len"]: seen[k] = e
    return pts, list(seen.values()), sk


def bridge(pts, edges, maxgap=95.0, maxang=18.0):
    """A rajzi jelek (kisiklasztó, útátjáró, szigetelt sín) kivágják a vonalat – összekötjük.
    Zsákvégből indulunk, és csak akkor kötünk össze, ha a hézag a vonal folytatásának irányába esik."""
    import math
    def tipirany(poly, veg, hossz=12.0):
        """A vonalvég iránya: nem az utolsó (gyakran 1 pixeles) szakaszból, hanem
        a végponttól visszafelé legalább `hossz` pixelnyi szakaszból."""
        q = poly[::-1] if veg == "b" else list(poly)
        p1 = q[0]
        for p0 in q[1:]:
            if math.dist(p0, p1) >= hossz: break
        else:
            p0 = q[-1]
        return math.atan2(p1[1]-p0[1], p1[0]-p0[0])

    deg, tip = {}, {}
    for e in edges:
        poly = e.get("poly") or [pts[e["a"]], pts[e["b"]]]
        for a, veg in ((e["a"], "a"), (e["b"], "b")):
            deg[a] = deg.get(a, 0) + 1
            tip.setdefault(a, []).append(tipirany(poly, veg))
    ends = [i for i in range(len(pts)) if deg.get(i, 0) == 1]
    def dang(a, b):
        return abs((a - b + math.pi) % (2*math.pi) - math.pi)
    new, used = [], set()
    cands = []
    for i in ends:
        for j in range(len(pts)):
            if j == i or j in (x for e in edges if e["a"] == i for x in (e["b"],)): continue
            d = math.dist(pts[i], pts[j])
            if d > maxgap or d < 1: continue
            v = math.atan2(pts[j][1]-pts[i][1], pts[j][0]-pts[i][0])
            da = dang(tip[i][0], v)
            if da > math.radians(maxang): continue
            db = dang(tip[j][0], v + math.pi) if deg.get(j, 0) == 1 else 0.0
            if db > math.radians(maxang): continue
            # az irányhűség fontosabb, mint a közelség: a valódi vonalfolytatást ne vigye el
            # egy közelebbi, de félreálló csonk
            cands.append((max(da, db), d, i, j))
    for _, d, i, j in sorted(cands):
        if i in used: continue
        if any((e["a"], e["b"]) in ((i, j), (j, i)) for e in edges): continue
        used.add(i)
        if deg.get(j, 0) == 1: used.add(j)
        new.append({"a": i, "b": j, "len": int(d), "poly": [pts[i], pts[j]],
                    "mid": ((pts[i][0]+pts[j][0])/2, (pts[i][1]+pts[j][1])/2)})
    return edges + new

if __name__ == "__main__":
    png, outjson, dpi = sys.argv[1], sys.argv[2], float(sys.argv[3])
    shape, keep = mask_tracks(png)
    pts, edges, sk = skeleton_graph(keep)
    n0 = len(edges)
    edges = bridge(pts, edges)
    print(f"  hézagáthidalás: +{len(edges)-n0} él")
    s = 72.0/dpi
    deg = collections.Counter()
    for e in edges: deg[e["a"]] += 1; deg[e["b"]] += 1
    out = {"dpi": dpi,
           "nodes": [{"i": i, "x": round(x*s, 2), "y": round(y*s, 2), "px": [round(x,1), round(y,1)],
                      "deg": deg[i]} for i, (x, y) in enumerate(pts)],
           "edges": [{"a": e["a"], "b": e["b"], "len_pt": round(e["len"]*s, 1),
                      "mid": [round(e["mid"][0]*s, 2), round(e["mid"][1]*s, 2)],
                      "poly": [[round(x*s, 2), round(y*s, 2)] for x, y in e.get("poly", [])]}
                     for e in edges]}
    json.dump(out, open(outjson, "w"), indent=0)
    print(f"{png.split('/')[-1]}: {len(pts)} csomópont, {len(edges)} él")
    print("fokszám:", dict(sorted(collections.Counter(deg.values()).items())))
