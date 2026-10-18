# Adatforrások és korlátok

## Útvonaladatok

Az útvonal nevei és távolságai a korábbi játékprototípusból származnak, amelynek forrása:
https://hu.wikipedia.org/wiki/Budapest%E2%80%93P%C3%A9cs-vas%C3%BAtvonal

Attribúció: a Wikipédia-szócikk szerzői. A származtatott útvonaladatok a szócikk aktuális CC BY-SA licencfeltételei szerint kezelendők. A szerzői előzmények a szócikk laptörténetében találhatók.

A Déli–Kelenföld részhez használt -4 km modellérték nem hiteles vasúti szelvényezés. A távolságadatok nem üzemi felhasználásra valók.
Az ercsi régi nyomvonal egyszerűsített pontsorát használjuk. Nincs külön elkerülő ág vagy Iváncsa forgalmi kitérő. A csatlakozó vonalak hiányoznak.
A 47 útvonalpont és a 31 vezérlési pont a játék tartalma, nem hivatalos statisztikai vagy üzemi darabszám.
A vezérlési pont besorolás sem mindenhol infrastruktúra-hitelesített.

## Állomási rajzok

Sárbogárdon a II–VIII. jelölésű vágányok szerepelnek, nem a teljes állomás. A korábbi állomási tájékozódás egyik dokumentuma:
https://www.mavcsoport.hu/sites/default/files/upload/page/sarbogard.pdf

A régi ÁVU nem bizonyítja a mai állapotot. Ebben a kiadásban a vágányhosszakat nem jelenítjük meg. A vágánykapcsolatok, peronok és jelzők rajza sematikus; a KI/BE jelölések játékjelzések, nem valós jelzőazonosítók.
Minden más állomás háromvágányos sablont kapott. Ez nem a valós vágányszámot állítja.

## Menetrend

A J001 stb. vonatok és időpontok kitalált tesztadatok. 65 km/h modellsebesség, közbenső megállóhelyenként 0,5 perc és játékállomásonként 1 perc tartózkodás alapján készülnek.
Hivatalos 2025–2026-os MÁV-menetrend és közlekedésinap-naptár NINCS importálva.
A következő tartalmi fejlesztés forrása lehet a 40a és 40 menetrendi tábla:
https://www.mavcsoport.hu/mav-szemelyszallitas/belfoldi-utazas/2025-2026-evi-belfoldi-vasuti-menetrend

## Szimuláció

- Engedély nélkül nincs indulás; a bejárati vágányút ettől külön művelet.
- Az engedély azonnal lefoglalja a modell-állomásközt és a fogadóvágányt.
- Északon irányonként külön állomásköz, délebbre közös egyvágányú kizárás működik.
- Nincs valós térközi követés, külön váltókezelés, oldalvédelem, tolatás vagy teljes D55-függőségrendszer.
- A vonatok pontszerűek; a megállóhelyi részidők csak az összes menetidőben érvényesülnek. A tényleges érkezési napló a vezérlési pontokon készül.
- A különböző irányú bejáratok kezelése konzervatív, nem teljes állomási vágányút-kizárási mátrix.
- Hibás forgalomszervezéssel tartós várakozás vagy patthelyzet alakítható ki.

A projekt játékprototípus, nem vasútüzemi vagy oktatási rendszer.
