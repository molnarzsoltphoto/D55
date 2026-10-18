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
