"""
A régi godisai Komló-modellág és a beépített Godisa-helyszínrajz eltávolítása az index.html-ből.
Egyszer lefuttatva idempotens: a már eltávolított részeket nem keresi újra (jelenti, mi maradt el).

A Komló irányú ág ezután a többi kiágazással azonos modulban (patch/v40-ketvaganyu-sor-kiagazas.js,
`godisa-komlo`, Pécs felőli vég, alul) működik, menetrendi vonatokkal.
"""
import re
from pathlib import Path

HTML = Path(__file__).resolve().parent.parent / "index.html"


def main():
    s = HTML.read_text(encoding="utf-8")
    eredeti = len(s)
    jelentes = []

    def csere(mit, mire, nev, kell=True):
        nonlocal s
        if mit not in s:
            jelentes.append(f"– {nev}: nincs benne")
            if kell:
                raise SystemExit(f"HIBA: nem találom ({nev}): {mit[:70]}")
            return
        s = s.replace(mit, mire, 1)
        jelentes.append(f"✓ {nev}")

    def blokk(kezdet, veg, nev, utan=0):
        """A kezdet…veg közötti rész törlése (veg a befejező minta, utan = a minta hossza is menjen)."""
        nonlocal s
        i = s.find(kezdet)
        if i < 0:
            jelentes.append(f"– {nev}: nincs benne")
            return
        j = s.find(veg, i)
        if j < 0:
            raise SystemExit(f"HIBA: {nev} vége nem található")
        s = s[:i] + s[j + (len(veg) if utan else 0) :]
        jelentes.append(f"✓ {nev} ({j - i} bájt)")

    # 1) menüsor gombjai
    csere("""<button onclick="selectStation(37);setView('station')">Godisa</button>""", "", "Godisa menügomb")
    csere("""<button onclick="document.getElementById('godisaSource').showModal()">Godisa forrásrajz</button>""", "", "Godisa forrásrajz gomb")
    # 2) a beépített helyszínrajz dialógusa (az SVG-vel együtt)
    blokk('<dialog id="godisaSource"', "</dialog>", "Godisa helyszínrajz dialógus", utan=1)
    # 3) a külön godisai kezelőpanel helye és stílusa
    csere("""<section id="godisa-controls" class="body" hidden></section>""", "", "godisa-controls szakasz")
    csere("#godisa-controls{background:#153449;color:#e3edf6}#godisa-controls button{margin:4px;padding:7px}", "", "godisa-controls CSS")
    # 4) a régi modul (motor)
    blokk("<script>\n\"use strict\";\nconst GODISA=37;", "</script>", "régi GodisaBranch modul", utan=1)
    # 5) automata kezelés a régi ágon
    blokk(" if(typeof GodisaBranch!=='undefined'&&!playerOwns(s,37))for(const t of s.trains){", "\n }\n", "autoOutside godisai rész", utan=1)
    # 6) gbAct kezelőfüggvény
    blokk("function gbAct(action,id,dir){", "\nfunction timetableList", "gbAct függvény", utan=0)
    # 7) a panel kirajzolása a render felülírásában
    blokk(" const panel=document.getElementById('godisa-controls');", "\n};\nconst originalKofi", "godisai panel kirajzolása", utan=0)
    # 8) KÖFI-overlay a régi ággal
    blokk("const originalKofi=drawKofi;drawKofi=function(){originalKofi();", "NW.svg.append(g);};", "KÖFI godisai overlay", utan=1)
    # 9) apróbb hivatkozások
    csere("sim.godisaBranch=null;", "", "startService godisaBranch", kell=False)
    csere("Godisa Komló irányú csatlakozása Godisa besorolását követi. ", "", "area-dialog szöveg", kell=False)
    csere("PDF-menetrend, Godisa modellág, választható kézi terület.", "PDF-menetrend, menetrendi kiágazások, választható kézi terület.", "kezdő naplósor", kell=False)
    # 10) a kezdő állomás és az alapértelmezett kézi terület Sárbogárd legyen
    csere("this.selected=37;", "this.selected=18;", "kezdő állomás")
    s2, n = re.subn(r"\[37\]", "[18]", s)
    s = s2
    jelentes.append(f"✓ alapértelmezett kézi terület Sárbogárd ({n} helyen)")

    HTML.write_text(s, encoding="utf-8")
    print("\n".join(jelentes))
    print(f"index.html: {eredeti} → {len(s)} bájt")


if __name__ == "__main__":
    main()
