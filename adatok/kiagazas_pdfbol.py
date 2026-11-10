"""
Kiágazó vonalak menetrendje a MÁV-füzetoldalakból (adatok/pdf/*.pdf) → adatok/kiagazas-menetrend.json

Minden vonatnál csak a modellezett (40a/40) állomásokon lévő megállók maradnak meg; ha a vonat a modellen
kívülről érkezik vagy oda távozik, a megfelelő kiágazás kerül a `from` / `to` mezőbe. Ha a vonatszám a
fővonali menetrendben (REAL_TIMETABLE) is szerepel, a fővonali megállólistát használjuk, és a bejegyzés azt
a vonatot váltja ki (`replaces`), hogy ne közlekedjen kétszer.

Egyszerűsítések: a közlekedési napok jeleit nem értelmezi (az azonos percben, azonos útvonalon közlekedő
változatok közül egy marad); a csatlakozó állomáson megállás nélkül áthaladó vonat áthaladási ideje becsült.
"""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from menetrend_pdf import parse_pdf  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
STATIONS = json.loads(re.search(r"STATIONS\s*=\s*(\[.*?\]);", HTML, re.S).group(1))
BY_NAME = {s["name"].lower(): s["id"] for s in STATIONS}
m = re.search(r"globalThis\.REAL_TIMETABLE=(\[.*?\]);", HTML, re.S)
REAL = {t["number"]: t for t in json.loads(m.group(1))} if m else {}

# fájl, (előre irány két sora: A a B előtt), felső vég (állomás, kiágazás), alsó vég (állomás, kiágazás), [csak ezek a modellállomások]
# A 30a és az 1-es vonal a játékban Kelenföldnél ágazik ki, ezért ott csak Budapest-Déli és Kelenföld számít modellállomásnak.
LINES = [
    ("45-46.pdf", ("Székesfehérvár", "Baja"), (18, "sarbogard-szfvar"), (19, "retszilas-szekszard")),
    ("42.pdf", ("Pusztaszabolcs", "Dunaújváros"), None, (14, "pszabolcs-dunaujvaros")),
    ("41.pdf", ("Dombóvár", "Kaposvár"), (1, "kelenfold-keleti"), (33, "dombovar-kaposvar")),
    ("50.pdf", ("Dombóvár", "Baja"), None, (33, "dombovar-bataszek")),
    ("47.pdf", ("Dombóvár", "Komló"), None, (37, "godisa-komlo")),
    ("60.pdf", ("Szigetvár", "Pécs"), (43, "szentlorinc-szigetvar"), None),
    ("61.pdf", ("Szentlőrinc", "Sellye"), None, (43, "szentlorinc-sellye")),
    ("30a.pdf", ("Budapest-Kelenföld", "Székesfehérvár"), (1, "kelenfold-keleti"), (1, "kelenfold-szfvar"), {0, 1}),
    ("1.pdf", ("Budapest-Kelenföld", "Tatabánya"), (1, "kelenfold-keleti"), (1, "kelenfold-gyor"), {0, 1}),
]
SPEED = 1.3  # km/perc a becsült áthaladáshoz


def km(a, b):
    return abs(STATIONS[a]["km"] - STATIONS[b]["km"])


def trains_of(pdf, anchors, top, bottom, only=None):
    out = []
    is_model = lambda n: n.lower() in BY_NAME and (only is None or BY_NAME[n.lower()] in only)
    for page in parse_pdf(ROOT / "adatok" / "pdf" / pdf):
        names = [r["name"] for r in page["rows"]]
        ia = next((i for i, n in enumerate(names) if n.startswith(anchors[0])), None)
        ib = next((i for i, n in enumerate(names) if n.startswith(anchors[1])), None)
        if ia is None or ib is None:
            continue  # ez az oldal nem érinti a modellt (pl. az 1-es vonal Komárom utáni táblái)
        forward = ia < ib
        origin_cfg, dest_cfg = (top, bottom) if forward else (bottom, top)
        for num in dict.fromkeys(page["cols"]):
            timed = [(i, r["name"], r["cells"][num]) for i, r in enumerate(page["rows"]) if num in r["cells"]]
            if not timed:
                continue
            # éjfél utáni folytatás
            fixed, prev = [], None
            for i, n, t in timed:
                while prev is not None and t < prev - 600:
                    t += 1440
                fixed.append((i, n, t))
                prev = t
            model = [(i, BY_NAME[n.lower()], t) for i, n, t in fixed if is_model(n)]
            off = [(i, n, t) for i, n, t in fixed if not is_model(n)]
            lo = min((i for i, _, _ in model), default=None)
            hi = max((i for i, _, _ in model), default=None)
            stops = []
            for _, sid, t in model:
                if stops and stops[-1]["station"] == sid:
                    stops[-1]["dep"] = t
                else:
                    stops.append({"station": sid, "arr": t, "dep": t})
            frm = to = None
            if origin_cfg and any(i < (lo if lo is not None else 10**6) for i, _, _ in off) and (lo is not None or off):
                before = [x for x in off if lo is None or x[0] < lo]
                if before:
                    frm = origin_cfg
            if dest_cfg and off:
                after = [x for x in off if hi is None or x[0] > hi]
                if after and (lo is not None or frm is None):
                    to = dest_cfg
            if lo is None:
                # a modell egyetlen állomásán sem áll meg: csak akkor kezelhető, ha ugyanazon az állomáson lép be és ki
                if frm and to and frm[0] == to[0]:
                    before = [x for x in off if True]
                    continue  # megállás nélküli átmenő vonat a csatlakozó állomáson: idő nem ismert, kihagyjuk
                continue
            if not frm and not to:
                continue
            # a csatlakozó állomás legyen a megállólista szélén (megállás nélküli áthaladásnál becsült idővel)
            if frm and stops[0]["station"] != frm[0]:
                t = round(stops[0]["arr"] - km(frm[0], stops[0]["station"]) / SPEED)
                stops.insert(0, {"station": frm[0], "arr": t, "dep": t, "est": True})
            if to and stops[-1]["station"] != to[0]:
                t = round(stops[-1]["dep"] + km(to[0], stops[-1]["station"]) / SPEED)
                stops.append({"station": to[0], "arr": t, "dep": t, "est": True})
            ids = [s["station"] for s in stops]
            if len(ids) > 1 and not (ids == sorted(ids) or ids == sorted(ids, reverse=True)) or len(set(ids)) != len(ids):
                continue  # nem egyirányú megállólista: hibás beolvasás
            out.append({"number": num, "from": frm[1] if frm else None, "to": to[1] if to else None, "stops": stops, "lines": [pdf.replace(".pdf", "")]})
    return out


def main():
    if not (ROOT / "adatok" / "pdf").is_dir():
        print("Nincs adatok/pdf – üres kiágazási menetrend.")
        (ROOT / "adatok" / "kiagazas-menetrend.json").write_text("[]", encoding="utf-8")
        return
    by_num, stats = {}, {}
    for pdf, anchors, top, bottom, *rest in LINES:
        if not (ROOT / "adatok" / "pdf" / pdf).exists():
            continue
        ts = trains_of(pdf, anchors, top, bottom, rest[0] if rest else None)
        stats[pdf] = len(ts)
        for t in ts:
            old = by_num.get(t["number"])
            if not old:
                by_num[t["number"]] = t
            else:  # ugyanaz a vonat több füzetoldalon: a végek összeadódnak, a hosszabb megállólista marad
                old["from"] = old["from"] or t["from"]
                old["to"] = old["to"] or t["to"]
                if len(t["stops"]) > len(old["stops"]):
                    old["stops"] = t["stops"]
                old["lines"] = sorted(set(old["lines"] + t["lines"]))
    out, seen, replaced, dropped = [], set(), 0, 0
    junction = {"kelenfold": 1, "pszabolcs": 14, "sarbogard": 18, "retszilas": 19, "dombovar": 33, "godisa": 37, "szentlorinc": 43}
    for num, t in by_num.items():
        real = REAL.get(num)
        if real:
            rs = [{"station": s["station"], "arr": s["arr"], "dep": s["dep"]} for s in real["stops"]]
            if t["from"] and rs[0]["station"] != junction[t["from"].split("-")[0]]:
                t["from"] = None
            if t["to"] and rs[-1]["station"] != junction[t["to"].split("-")[0]]:
                t["to"] = None
            if not t["from"] and not t["to"]:
                dropped += 1
                continue
            t["stops"], t["replaces"] = rs, real["id"]
            replaced += 1
        ids = [s["station"] for s in t["stops"]]
        # a fővonali szakasz végpontja forgalmi szolgálati hely legyen
        if len(ids) > 1 and not (STATIONS[ids[0]]["control"] and STATIONS[ids[-1]]["control"]):
            dropped += 1
            continue
        key = (t["from"], t["to"], ids[0], t["stops"][0]["dep"], ids[-1])
        if key in seen:
            dropped += 1
            continue
        seen.add(key)
        t["dir"] = 0 if len(ids) == 1 else (1 if ids[-1] > ids[0] else -1)
        t["id"] = f"B{num}"
        for s in t["stops"]:
            s.pop("est", None)
        out.append(t)
    out.sort(key=lambda t: t["stops"][0]["dep"])
    (ROOT / "adatok" / "kiagazas-menetrend.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(out)} kiágazási vonat ({replaced} fővonali vonatot vált ki, {dropped} kihagyva/összevonva); füzetoldalanként: {stats}")
    from collections import Counter
    print("kiágazásonként:", dict(Counter((t["from"] or "-") + " → " + (t["to"] or "-") for t in out).most_common()))


if __name__ == "__main__":
    main()
