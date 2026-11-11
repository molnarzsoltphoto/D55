"""
A 800-as sorozatú InterCityk budapesti szakaszának pótlása a fővonali menetrendben (index.html → REAL_TIMETABLE).

A beolvasott füzetoldalakból ezeknél a vonatoknál a 40a-oldal sorai kimaradtak, ezért Sárbogárdon (vagy
Simontornyán) kezdődtek/végződtek. A `adatok/menetrend-40a-40.csv` hat IC-nél tartalmazza a budapesti
szakaszt is; az ott szereplő menetidők állandóak, ezekből pótoljuk a többit:

  Budapest-Kelenföld indulás → Sárbogárd érkezés   46 perc     (Pécs felé)
  Sárbogárd indulás → Budapest-Kelenföld érkezés   49 perc     (Budapest felé)
  Kelenföld ↔ Simontornya                          71 perc     (a Dombóvárig közlekedő IC-knél)
  Budapest-Déli ↔ Budapest-Kelenföld                6 perc     (a fővonali személyvonatokkal egyezően)
  tartózkodás Kelenföldön: 4 perc Pécs felé, 1 perc Budapest felé

A Kelenföld–Sárbogárd szakaszon ezek a vonatok nem állnak meg, ezért nincs közbenső megállójuk.
Nem hiteles: a pótolt időpontok a fenti állandókból számítottak, nem a füzetoldalról származnak.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HTML = ROOT / "index.html"
DELI, KELENFOLD = 0, 1
RUN = {18: (46, 49), 21: (71, 71)}  # állomás: (Kelenföld→oda Pécs felé, onnan→Kelenföld Budapest felé)
DELI_RUN = 6
DWELL = {1: 4, -1: 1}


def extend(train):
    """Igaz, ha a vonat budapesti szakaszát pótoltuk."""
    stops = train["stops"]
    if any(s["station"] in (DELI, KELENFOLD) for s in stops):
        return False
    if train["dir"] == 1:
        first = stops[0]
        run = RUN.get(first["station"])
        if not run:
            return False
        kf_dep = first["arr"] - run[0]
        kf_arr = kf_dep - DWELL[1]
        deli = kf_arr - DELI_RUN
        stops.insert(0, {"station": KELENFOLD, "arr": kf_arr, "dep": kf_dep, "potolt": True})
        stops.insert(0, {"station": DELI, "arr": deli, "dep": deli, "potolt": True})
    else:
        last = stops[-1]
        run = RUN.get(last["station"])
        if not run:
            return False
        kf_arr = last["dep"] + run[1]
        kf_dep = kf_arr + DWELL[-1]
        deli = kf_dep + DELI_RUN
        stops.append({"station": KELENFOLD, "arr": kf_arr, "dep": kf_dep, "potolt": True})
        stops.append({"station": DELI, "arr": deli, "dep": deli, "potolt": True})
    return True


def main():
    html = HTML.read_text(encoding="utf-8")
    m = re.search(r"(globalThis\.REAL_TIMETABLE=)(\[.*?\]);", html, re.S)
    if not m:
        print("Nincs REAL_TIMETABLE az index.html-ben.")
        return
    tt = json.loads(m.group(2))
    done = []
    for t in tt:
        if re.fullmatch(r"8\d\d", t["number"]) and extend(t):
            done.append(t["number"])
    if not done:
        print("Az IC-k budapesti szakasza már megvan.")
        return
    új = m.group(1) + json.dumps(tt, ensure_ascii=False, separators=(",", ":")) + ";"
    HTML.write_text(html[: m.start()] + új + html[m.end() :], encoding="utf-8")
    print(f"{len(done)} IC budapesti szakasza pótolva: {', '.join(sorted(done))}")


if __name__ == "__main__":
    main()
