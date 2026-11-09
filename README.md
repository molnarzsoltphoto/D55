# VONAL 40 – 0.9: kétvágányú pult, sorrendtartó engedély, kiágazások

Az `index.html` végén új blokk: `<script id="v40-ketvaganyu-sor-kiagazas">` (forrása: `patch/v40-ketvaganyu-sor-kiagazas.js`, beillesztés: `./build.sh`). A korábbi v40-* blokkokra épül, azokat nem írja át.

- **Kétvágányú állomási pult.** Ahol az állomásköz kétvágányú (Budapest-Déli–Pusztaszabolcs), a pulton is két vonali vágány csatlakozik: 1. (felső) vágány Pécs felé, 2. (alsó) Budapest felé, a KÖFI-vel azonos kiosztással és az ott kezelt menetirányt követve. Az A/B bejárati jelző a beérkező, a VL/VR kijárat a kimenő vágányon; a közeledő és kijáró vonatok a saját vonali vágányukon mozognak. A foglalt vonali vágány pirosas.
- **Engedély foglalt vagy lefoglalt fogadóvágányra, sorrendtartással.** Ha a Fogadóvágány-választóban konkrét vágányt jelölsz ki (nem az átmenő alapvágányt), az engedély akkor is megadható, ha a vágányon már vonat áll vagy másik engedély szól rá. Minden engedély sorszámot kap; a bejárati vágányút mindig a sorban első vonaté, a bejárati jelző pedig csak akkor állítható Szabadra, ha a vágányon álló és a kisebb sorszámú vonatok már elhagyták azt. Így Pusztaszabolcsról indulhat egymás mögött két vonat Ercsi ugyanarra a vágányára, és a második már az elsőnek a szakaszon létekor engedélyt kaphat. Minden állomáson érvényes. A gép (automata terület) továbbra is csak szabad vágányra ad engedélyt. A pult vágányfeliratában és a választóban látszik a sorban állók száma.
- **Kiágazások modellhatárral**, egy-egy modellezett állomásközzel (a godisai Komló-ág mintájára, 5 perc menetidő, 1 perc be-/kijárat): Kelenföld – Budapest-Keleti (Budapest felőli vég), Győr és Székesfehérvár (Pécs felőli vég); Pusztaszabolcs – Székesfehérvár (Budapest felőli), Dunaújváros (Pécs felőli); Sárbogárd – Székesfehérvár (Budapest felőli); Rétszilas – Dunaújváros (Budapest felőli), Szekszárd (Pécs felőli); Dombóvár – Bátaszék (Budapest felőli), Kaposvár (Pécs felőli); Szentlőrinc – Szigetvár (Budapest felőli), Sellye (Pécs felőli). Az állomási nézetben „Kiágazások” panel: kézi tehermenet a kiágazás felől (a választott fogadóvágányra), engedély, vágányút, jelző, Megállj, törlés/oldás; a beérkezett menet a fővonalra adható át (Budapest/Pécs felé) vagy bármely kiágazáson kiküldhető; álló, nem menetrendi fővonali tehervonat kiágazásra terelhető. A kiágazási vágányút az adott állomásvéget kizárja a fővonali vágányutak elől és fordítva. A csonkok a pulton és a KÖFI-n is látszanak, a KÖFI-csonkra kattintva az állomás pultja nyílik.
- **Javított hiba:** a Fogadóvágány-választóba minden rajzoláskor újabb „Átmenő alapvágány” sor került; most egy marad.

**Nem hiteles:** a kiágazások állomásvége (melyik végen ágazik ki) és a menetidő játékparaméter, ÁVU-val nem ellenőrzött; a `LINE_BRANCHES` listában a `side` mező módosítható. A sorrendtartó engedély a D55 valós függőségeinek (foglalt vágányra csak hívójelzéssel) egyszerűsített játékmodellje.

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
