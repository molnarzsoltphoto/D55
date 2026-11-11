# VONAL 40 – 0.9: kétvágányú pult, sorrendtartó engedély, kiágazások

**0.12.0 – teljes budapesti IC-k, új kiágazások, megállási idő, előengedély-korlát:**

- **A régi godisai Komló-modellág és a beépített Godisa-helyszínrajz kikerült** (`patch/godisa_eltavolitas.py`). A Komló irányú ág a többi kiágazással azonos modulban, Godisa Pécs felőli végén, alul működik, menetrendi vonatokkal. A játék kezdő állomása és alapértelmezett kézi területe Sárbogárd. Az `index.html` 1045 kB-ról 466 kB-ra fogyott.
- **A 800-as IC-k végigmennek Budapest-Déliig** (`adatok/ic_budapest.py`): a füzetoldalakból kimaradt 40a-szakaszt a `adatok/menetrend-40a-40.csv` hat IC-nél megadott, állandó menetidőiből pótoljuk (Kelenföld–Sárbogárd 46/49 perc, Kelenföld–Simontornya 71 perc, Kelenföld–Déli 6 perc, tartózkodás Kelenföldön 4, illetve 1 perc). Mind a 22 IC eléri Budapest-Délit; a Dombóvárig közlekedő IC-k (822, 824, 826, 823, 825, 829) innentől a 41-es füzetoldal szerint Kaposvárig futnak. A pótolt budapesti időpontok számítottak, nem a füzetoldalról származnak.
- **Új füzetoldalak:** 43 (Dunaújváros–Rétszilas–Simontornya) és 44 (Pusztaszabolcs–Börgönd–Székesfehérvár) – ezzel a rétszilasi Dunaújváros- és a pusztaszabolcsi Székesfehérvár-ág is menetrendi vonatokat kap. A kiágazási menetrend 513-ról 542 vonatra nőtt. A beolvasó mostantól eldobja azt a vonatot, amelyben háromóránál hosszabb állomásköz szerepel (hibás oszlopillesztés).
- **Érd felső – Székesfehérvár kiágazás** (Pécs felőli vég, alul, saját váltókörzettel). A 30a füzetoldal két útvonalat tartalmaz: amelyik vonat érinti Érd felsőt, az ott hagyja el a modellt (39 vonat), a Budafok–Albertfalva–Érd alsó útvonalon közlekedők továbbra is Kelenföldnél (175 vonat).
- **Rétszilas Baja felé:** a 45–46-os vonal rétszilasi ága a nevében is Baja (Szekszárd, Bátaszék); a 83xx vonatok Baja és Székesfehérvár között a rétszilasi és a sárbogárdi kiágazás között közlekednek.
- **Sárbogárd–Székesfehérvár ág bal alulra** került, **Százhalombatta öt vágányos** (I–V), és a kiágazások feliratából eltűnt a „modellhatár" szó.
- **Megállási idő:** menetrendi vonat a füzetben szereplő megállási helyen késés esetén is legalább egy percet áll (`timetableDeparture`); időben érkezve a menetrend szerinti indulásig vár. A csak számított (füzetben nem szereplő) áthaladási pontokon nincs megállás.
- **Előengedély:** kézzel legfeljebb három egymás utáni állomásközre adható engedély egy vonatnak (ez a korábbi `forwardLimit = 2`), a gép viszont már csak a következő egy állomásközre ad (`patch/v40-eloengedely.js`).
- **A menetrendablak a kiágazó vonalak vonatait is mutatja** (`patch/v40-menetrend-lista.js`): 684 sor (142 fővonali + 542 kiágazási; a kiágazási változattal kiváltott 97 fővonali vonat nem szerepel kétszer), vonalszámmal, szűrőmezővel. A kiágazáson érkező vagy távozó vonatnál a végpont „Baja felé (Rétszilas)” alakú, és az idő a csatlakozó állomásé, nem a vonal végállomásáé.
- **Ellenőrzés:** `node tests/valtozasok.cjs` (a fentiek böngészőben), `node tests/futas.cjs 12` (12 órás gépi futás: 498 vonat indult, 468 ért célba, egy sem ragadt be, átlagkésés 10,5 perc, legnagyobb 51 perc – a megállási szabály és az előengedély szűkítése miatt a korábbinál nagyobb). A régi `tests/engine.test.cjs` a különálló `assets/engine.js` változatot méri, és már e változtatások előtt sem futott le.

**0.11.0 – D55 pultkép az állomási pultokon:** világoszöld mozaiklapok, fekete vágánysáv benne világító szakaszokkal (sárga = lezárt vágányút, villogó sárga = oldódik, vörös = foglalt, halvány fehér = váltóállás), a vonat a sávban haladó vörös foglaltság vonatszámtáblával, a kezdő-/célgombok a vágányban ülnek, alul csoportgombsor (a felső eszköztárral egyenértékű), felül középen számlálók (törlés/oldás, Megállj – csak a saját kezelésű állomáson számol). A kezelés változatlanul kétütemű (kezdő- és célgomb = első lezárás, jelző szabadra = második lezárás). Forrás: egy valódi pult fényképe és a Boros–Hegedüs–Nagy-féle D55 tankönyv tartalomjegyzéke; a gombok pontos kiosztása és a visszajelentések színei állomásonként eltérnek, ez közelítés, nem hiteles kezelőfelület.

**0.10.0 – menetrendi vonatok a kiágazásokon:** a MÁV füzetoldalakból (`adatok/pdf/`: 1, 30a, 41, 42, 43, 44, 45–46, 47, 50, 60, 61) a `adatok/kiagazas_pdfbol.py` kinyeri a kiágazó vonalak vonatait (513 vonat; ebből 79 a fővonali menetrend egy vonatát váltja ki, hogy ne közlekedjen kétszer) → `adatok/kiagazas-menetrend.json` → `./build.sh`. A vonatok a kiágazás felől érkeznek a csatlakozó állomásra (ott végződnek vagy a fővonalon folytatják), illetve a fővonalról a kiágazáson távoznak. Új kiágazás: Godisa – Komló menetrendi vonatai. Kelenföld három iránya kétvágányú, saját váltókörzettel. Egyszerűsítések: a közlekedési napok jeleit a kinyerő nem értelmezi (minden oszlop naponta közlekedik, az azonos percű változatokból egy marad); megállás nélküli áthaladásnál a csatlakozó állomás ideje becsült; a 44-es (Pusztaszabolcs–Székesfehérvár) és a 43-as (Rétszilas–Dunaújváros) vonalhoz nincs füzetoldal, ott csak kézi menet van.

**Automata forgalom javítása:** a gép kezelte állomásokon a hosszabb futásnál beálló torlódás (az eredeti játékban is megvolt) megszűnt: (1) kijárati vágányút csak az állomáson álló vonatnak állítható, bejárati csak a ténylegesen elöl haladó, már úton lévő vonatnak; (2) kétvágányú állomásvégen a bejárat és a kijárat egyszerre is lezárható, ha külön vonali vágányt használnak és egyik sem megy át az átmenő kitérőn; (3) a végállomásán induló vonat nem ragad be. 12 órás gépi futás: korábban 45–75 célba ért vonat és 30–60 beragadt, most ~170 fővonali (kiágazásokkal ~450) és nincs 20 percnél régebben álló vonat.

**0.9.1:** a kétvágányú állomásvégeken mindkét vonali vágány a saját váltóján csatlakozik (saját térfél vágányai), köztük X átmenő kitérővel; a jelzőfeliratok a jelző mellé kerültek. 

Az `index.html` végén új blokk: `<script id="v40-ketvaganyu-sor-kiagazas">` (forrása: `patch/v40-ketvaganyu-sor-kiagazas.js`, beillesztés: `./build.sh`). A korábbi v40-* blokkokra épül, azokat nem írja át.

- **Kétvágányú állomási pult.** Ahol az állomásköz kétvágányú (Budapest-Déli–Pusztaszabolcs), a pulton is két vonali vágány csatlakozik: 1. (felső) vágány Pécs felé, 2. (alsó) Budapest felé, a KÖFI-vel azonos kiosztással és az ott kezelt menetirányt követve. Az A/B bejárati jelző a beérkező, a VL/VR kijárat a kimenő vágányon; a közeledő és kijáró vonatok a saját vonali vágányukon mozognak. A foglalt vonali vágány pirosas.
- **Engedély foglalt vagy lefoglalt fogadóvágányra, sorrendtartással.** Ha a Fogadóvágány-választóban konkrét vágányt jelölsz ki (nem az átmenő alapvágányt), az engedély akkor is megadható, ha a vágányon már vonat áll vagy másik engedély szól rá. Minden engedély sorszámot kap; a bejárati vágányút mindig a sorban első vonaté, a bejárati jelző pedig csak akkor állítható Szabadra, ha a vágányon álló és a kisebb sorszámú vonatok már elhagyták azt. Így Pusztaszabolcsról indulhat egymás mögött két vonat Ercsi ugyanarra a vágányára, és a második már az elsőnek a szakaszon létekor engedélyt kaphat. Minden állomáson érvényes. A gép (automata terület) továbbra is csak szabad vágányra ad engedélyt. A pult vágányfeliratában és a választóban látszik a sorban állók száma.
- **Kiágazások modellhatárral**, egy-egy modellezett állomásközzel (a godisai Komló-ág mintájára, 5 perc menetidő, 1 perc be-/kijárat): Kelenföld – Budapest-Keleti (Budapest felőli vég), Győr és Székesfehérvár (Pécs felőli vég); Pusztaszabolcs – Dunaújváros (Pécs felőli vég, felül), Székesfehérvár (Pécs felőli vég, alul); Sárbogárd – Székesfehérvár (Budapest felőli); Rétszilas – Dunaújváros (Budapest felőli), Szekszárd (Pécs felőli); Dombóvár – Bátaszék (Pécs felőli vég, felül), Kaposvár (Pécs felőli vég, alul); Szentlőrinc – Szigetvár (Budapest felőli), Sellye (Pécs felőli). Az állomási nézetben „Kiágazások” panel: kézi tehermenet a kiágazás felől (a választott fogadóvágányra), engedély, vágányút, jelző, Megállj, törlés/oldás; a beérkezett menet a fővonalra adható át (Budapest/Pécs felé) vagy bármely kiágazáson kiküldhető; álló, nem menetrendi fővonali tehervonat kiágazásra terelhető. A kiágazási vágányút az adott állomásvéget kizárja a fővonali vágányutak elől és fordítva. A csonkok a pulton és a KÖFI-n is látszanak, a KÖFI-csonkra kattintva az állomás pultja nyílik.
- **Javított hiba:** a Fogadóvágány-választóba minden rajzoláskor újabb „Átmenő alapvágány” sor került; most egy marad.

**Nem hiteles:** a kiágazások állomásvége (melyik végen ágazik ki) és a menetidő játékparaméter, ÁVU-val nem ellenőrzött; a `LINE_BRANCHES` listában a `side` (állomásvég) és `vert` (felül/alul) mező módosítható. A sorrendtartó engedély a D55 valós függőségeinek (foglalt vágányra csak hívójelzéssel) egyszerűsített játékmodellje.

# VONAL 40 – 0.8: KÖFI-megjelenés a fotó szerint

- **Állomási játék** (`allomas.html`): D55 kezelőpult (halványzöld csempés tábla, vékony vágányvonalak, nyomógombok, alsó gombsor), a korábbi fotó alapján.
- **KÖFI-játék** (`kofi.html`): a KÖFI-munkahely fotója alapján sötét kijelzők. Fent a **vonalkép** (Budapest-Déli–Pécs: kétvágányú szakasz Pusztaszabolcsig, utána egyvágányú; állomások fehér keretben, foglalt állomás piros, cián keret = kézzel kezelt, narancs szám = engedélykérés, a vonalon közlekedő vonatok cián jelölővel), alatta az **állomások képernyői** fekete háttérrel: fehér vágányvonalak, piros/zöld jelzőpontok, cián vonatjelölők, beállított vágányút fehéren, szabad jelzésnél zölden, foglalt vágány pirosan. A jelzők közvetlenül az állomás képernyőjén kezelhetők. A vonalkép állomására kattintva a képernyőjére ugrik.
- `index.html`: módválasztó. A két mód külön játék, közös állapot nélkül.

## Feltöltés GitHub Pagesre
A ZIP tartalmát a repository **gyökerébe** töltsd (ne `assets` mappába). A régi index.html/style.css/engine.js/app.js fájlokat írd felül/töröld. Settings → Pages → Deploy from a branch → `main` → `/ (root)`.
Fájlok: index.html, allomas.html, allomas.js, kofi.html, kofi.js, pult.js, allomas-motor.js, adatok.js, style.css.

## Kezelés
1. Engedély: fogadóvágány kiválasztása a jobb oldali listában, „Engedélyt adok”.
2. Vágányút: villogó kezdő jelző (A Budapest felől, B Pécs felől), majd a vágány túlsó végi jelzője (A után R-vágány, B után L-vágány).
3. Jelző szabadra: a kezdő jelző újra (vagy KÖZÖS SZABAD, majd a jelző).
4. Kijárat: R-vágány (jobbra) / L-vágány (balra), zöld célnyíl (VR/VL), majd a kijárati jelző újra.
5. Alsó gombsor: KÖZÖS SZABAD, JELZŐ MEGÁLLJ, TÖRLÉS, ELVETÉS.

## Amit NEM szabad kész állításnak venni
- **Csatlakozó vonalak nincsenek benne** (30a, 41, 42, 43, 44, 45/46, 47, 50, 60/61, 65). A vonalkép is csak a 40a/40 vonalat mutatja.
- **Nem minden állomás valós vágányszámú:** kilenc állomás ÁVU-hivatkozású, ellenőrizetlen adattal; a többi 22 játéksablon.
- A KÖFI-fotó alapján a színvilág és az elrendezés jellege készült (fekete háttér, fehér vonalak, piros/zöld jelzők, cián jelölők); a valós KÖFI-szoftver menüi, szimbólumai és állomásképei nem másolhatók a fotóból, az állomásrajzok sematikusak.
- A menetrend automatikusan lett beolvasva a PDF-ből; korlátozások nélkül, az azonos útvonalú napi változatok egyszerre futnak (a KÖFI-nap legnagyobb késése ~41 perc).
- Játék, nem üzemi vagy oktatási rendszer.

## Teszt
`node tests/engine.test.cjs` – 39 motorellenőrzés.
