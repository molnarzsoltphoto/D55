import sys, os, glob, json, collections
import cv2, numpy as np
from skimage.morphology import skeletonize
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cimke

SP = os.path.dirname(os.path.abspath(__file__))
def branchpoints(png, r, minpx=250):
    im = cv2.imread(png, cv2.IMREAD_GRAYSCALE)
    bw = (im < 128).astype(np.uint8)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2*r+1, 2*r+1))
    op = cv2.morphologyEx(bw, cv2.MORPH_OPEN, k)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(op, 8)
    keep = np.zeros_like(op)
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] >= minpx: keep[lab == i] = 1
    sk = skeletonize(keep.astype(bool)).astype(np.uint8)
    nb = (cv2.filter2D(sk, -1, np.ones((3,3), np.uint8), cv2.BORDER_CONSTANT) - sk) * sk
    bp = ((nb >= 3) & (sk > 0)).astype(np.uint8)
    nn, _, _, _ = cv2.connectedComponentsWithStats(cv2.dilate(bp, np.ones((5,5), np.uint8)), 8)
    return nn - 1, int(sk.sum())

print(f"{'állomás':<20} {'címkék':>6}  r=2    3    4    5    6    7    8    9   -> r")
for pdf in sorted(glob.glob(f"{SP}/../rajzok/*.pdf")):
    nev = os.path.basename(pdf)[:-4]
    png = f"{SP}/ki/{nev}.png"
    if not os.path.exists(png): continue
    c = cimke.extract(pdf)
    cel = len([s for s in c["valtoszamok"] if int(s["t"]) < 200])
    row, best, bd = [], None, 1e9
    for r in range(2, 10):
        bp, L = branchpoints(png, r)
        row.append(bp)
        if cel and abs(bp - cel) < bd: bd, best = abs(bp - cel), r
    print(f"{nev:<20} {cel:>6}  " + " ".join(f"{v:4}" for v in row) + f"  -> {best}")
