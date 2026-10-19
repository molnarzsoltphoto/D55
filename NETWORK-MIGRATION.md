# Hálózati átállás – 1. lépés

Új modul: assets/network-model.js. Teszt: node tests/network-model.test.cjs.
Ez előkészítő lépés: az index.html-t, a menetrendet és a működő motorokat nem módosítja. Az új modult nem kapcsolja be automatikusan.

Explicit fővonali kapcsolatok: 31 irányított szolgálati hely, 30 állomásköz, 16 köztes pont. A hossz és a vágányszám a jelenlegi játék adata, nem új pályafelmérés.
Az útvonalkeresés nem függ a bemeneti állomáslista sorrendjétől. Az egy- és kétvágányú szakaszok, legfeljebb 2 km-es térközök és a régi szakaszazonosítók megmaradnak.
Az opcionális installLegacy illesztő a next/section/ensureBlocks működését kapcsolja a gráfhoz. Első lépésként csak a jelenlegi fővonalra alkalmazható; a külön Godisa-modellt nem váltja ki.

Helyi ellenőrzés: 1129 sikeres teszt a feltöltött 6-os motorral. A repó assets/engine.js fájljával is futtatható; a repó 5-ös motorját ebben a körben nem futtattuk külön.
Ellenőrzött: minden következő fővonali állomás mindkét irányban, sorrendfüggetlenség, mesterséges tesztelágazás, hibás adatok elutasítása, térközök, menetirány-megőrzés, visszaállítható illesztés és két próbamenet teljes állapotazonossága.

Még nincs kész: az élő index egységesítése és aktiválása, a valós mellékág és első szomszédos állomás adatainak bekötése, állomási váltógráf és hiteles jelzőfüggőségek. A tesztelágazás szoftverteszt, nem valós Godisa–Komló adat.
Következő lépés: a ténylegesen betöltött motorkód és a beillesztett javítások egységesítése, majd az adapter aktiválása és böngészős menetrendi próba. Az élő játék ehhez újabb, külön jóváhagyott változtatást igényel.
