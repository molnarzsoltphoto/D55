# VONAL 40 – 0.4, állomási játék valós menetrenddel (első működő részlet)

Statikus böngészős játék, build és backend nélkül. Két teljesen különálló játékmód lesz; ebben a csomagban az **állomási játék** működik, a KÖFI-játék még nincs kész.

## Mi van benne?

- **Valós menetrend:** a MÁV 2025–2026-os belföldi közszolgáltatási menetrendje (érvényes: 2026.08.31–12.12.) 40a és 40 vonalának táblázataiból beolvasva, mindkét irányban. Korlátozások (időszakos közlekedés, vágányzár) nélkül, a lábjegyzetek figyelmen kívül hagyásával.
- 221 vonat; az azonos időrendű változatokat (például 4110/4220) egyetlen vonatként kezeljük, a változatok a vonat menetrendi ablakában szerepelnek.
- **31 játékállomás**, egyszerre egy állomás irányítható (állomásválasztó).
- Az állomási pult: engedélykérés érkezés előtt 8 perccel, fogadóvágány-választás, vágányút (kezdő–cél gombok), külön jelzőállítás, Megállj, törlés/időzített oldás, kijárati vágányút.
- Megálló, áthaladó, végállomásra érkező és onnan induló vonatok. Az áthaladó vonat idejét az állomások távolságából becsüljük (a menetrend nem ad időt oda, ahol nem áll meg).
- Az ÁVU-ból feldolgozott vágányadatú állomások: Sárbogárd, Rétszilas, Sárosd, Kurd, Vásárosdombó, Bükkösd, Ercsi, Százhalombatta, Godisa. A többi játékállomás játéksablon (a vágányszám a napi forgalom alapján).

## Feltöltés GitHub Pagesre

1. Csomagold ki a ZIP-et.
2. Töltsd a mappa tartalmát a repository gyökerébe (Add file → Upload files). Ne a ZIP-et, és ne egy külön almappát töltsd fel.
3. Settings → Pages → Deploy from a branch → `main` → `/ (root)` → Save.
4. A Pages Visit site címén nyisd meg az `index.html`-t.

Fájlok: `index.html` (módválasztó), `allomas.html`, `allomas.js`, `allomas-motor.js`, `adatok.js`, `style.css`.
A régi `engine.js`, `app.js` és `index.html` (0.2/0.3) ne maradjon a gyökérben; az új `index.html` felülírja a régit. A régi játék nem része ennek a csomagnak.

## Ismert korlátok

- Csak a 40a és 40 vonal menetrendje van beolvasva. A csatlakozó vonalak (30a, 41, 42, 43, 44, 45/46, 47, 50, 60/61, 65) és a KÖFI-játék még hiányoznak.
- A pályahálózat az ercsi régi nyomvonalat követő 47 pontos prototípus; az ercsi elkerülő és az érdi összekötők nincsenek benne. A beolvasott menetrend csak a prototípus pontjaira vonatkozó megállásokat tartalmazza, a többi állomás sorait (például Dunaújváros, Kaposvár, Bátaszék) csak csatlakozási információként kezeltük, nem játsszuk.
- Az állomásvégi váltókapcsolatok egyszerűsítettek (két oldal, egy vágányút oldalanként); ez nem hiteles ÁVU-topológia. Az átmenő vágányok kijelölése kétvágányú szakaszon irányhelyesség nélkül, pusztán „fővágány”-jelöléssel történik.
- A pályán nincs térközi követés és nincs szomszéd-állomási szimuláció: az engedélyadás és a vonatok érkezése a menetrendből jön.
- A menetrend olvasása automatikus (táblázatoszlopok és -sorok koordináta alapján). Minden vonat időpontjai állomásról állomásra növekedőek, de a teljes menetrend minden eleme nem lett kézzel összevetve a PDF-fel.
- Játék, nem vasúti oktatási vagy üzemi rendszer.

## Teszt

`node tests/allomas.test.cjs` – 51 motorellenőrzés, köztük tíz állomás teljes napi automata futtatása.
