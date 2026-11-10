"""
Kiágazási menetrend → BRANCH_TIMETABLE.
Bemenet: adatok/kiagazas-menetrend.csv, pontosvesszővel:
  vonatszam;kiagazas;irany;allomas;erkezes;indulas
  - kiagazas: a kiágazás azonosítója (kelenfold-keleti, kelenfold-gyor, kelenfold-szfvar, pszabolcs-szfvar,
    pszabolcs-dunaujvaros, sarbogard-szfvar, retszilas-dunaujvaros, retszilas-szekszard, dombovar-bataszek,
    dombovar-kaposvar, szentlorinc-szigetvar, szentlorinc-sellye)
  - irany: „felől” (a kiágazás felől érkezik; az első sor a csatlakozó állomás) vagy „felé” (a kiágazáson távozik; az utolsó sor a csatlakozó állomás)
  - allomas: a fővonali állomás neve pontosan úgy, ahogy a játékban (lásd ÁLLOMÁSOK lent); csak a fővonali megállók kellenek
  - erkezes/indulas: ÓÓ:PP; végállomáson az egyik üres lehet
Kimenet: adatok/kiagazas-menetrend.json, amit a build.sh beilleszt az index.html-be.
"""
import csv, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
html = (ROOT / "index.html").read_text(encoding="utf-8")
m = re.search(r"STATIONS\s*=\s*(\[.*?\]);", html, re.S)
STATIONS = json.loads(m.group(1))
BY_NAME = {s["name"].lower(): s["id"] for s in STATIONS}
JUNCTION = {"kelenfold": 1, "pszabolcs": 14, "sarbogard": 18, "retszilas": 19, "dombovar": 33, "szentlorinc": 43}


def hhmm(v):
    v = (v or "").strip()
    if not v:
        return None
    h, mnt = v.split(":")
    return int(h) * 60 + int(mnt)


def main():
    src = ROOT / "adatok" / "kiagazas-menetrend.csv"
    if not src.exists():
        print("Nincs adatok/kiagazas-menetrend.csv – üres menetrend.")
        (ROOT / "adatok" / "kiagazas-menetrend.json").write_text("[]", encoding="utf-8")
        return
    rows = list(csv.DictReader(src.open(encoding="utf-8-sig"), delimiter=";"))
    by = {}
    for r in rows:
        key = (r["vonatszam"].strip(), r["kiagazas"].strip(), r["irany"].strip())
        by.setdefault(key, []).append(r)
    out, errors = [], []
    for (num, branch, irany), rs in by.items():
        stops = []
        for r in rs:
            sid = BY_NAME.get(r["allomas"].strip().lower())
            if sid is None:
                errors.append(f"{num}: ismeretlen állomás „{r['allomas']}”")
                continue
            arr, dep = hhmm(r["erkezes"]), hhmm(r["indulas"])
            stops.append({"station": sid, "arr": arr if arr is not None else dep, "dep": dep if dep is not None else arr})
        if not stops:
            continue
        via = "from" if irany.startswith("fel") and "ől" in irany else "to"
        junction = JUNCTION.get(branch.split("-")[0])
        if junction is None:
            errors.append(f"{num}: ismeretlen kiágazás „{branch}”"); continue
        if via == "from" and stops[0]["station"] != junction or via == "to" and stops[-1]["station"] != junction:
            errors.append(f"{num}: a {'első' if via == 'from' else 'utolsó'} megállónak a csatlakozó állomásnak kell lennie ({STATIONS[junction]['name']})"); continue
        far = stops[0] if via == "to" else stops[-1]
        if len(stops) > 1 and not STATIONS[far["station"]]["control"]:
            errors.append(f"{num}: a fővonali végállomás ({STATIONS[far['station']]['name']}) nem forgalmi szolgálati hely; a modell csak ilyen végpontot tud kezelni"); continue
        direction = 0 if len(stops) == 1 else (1 if stops[-1]["station"] > stops[0]["station"] else -1)
        out.append({"id": f"{num}-{branch}-{via}", "number": num, "branch": branch, "via": via, "dir": direction, "stops": stops})
    (ROOT / "adatok" / "kiagazas-menetrend.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(out)} vonat, {len(errors)} hiba")
    for e in errors:
        print(" -", e)
    if errors:
        sys.exit(1)


if __name__ == "__main__":
    main()
