# Ellenőrzés
- Motorteszt: 51/51 sikeres (node tests/allomas.test.cjs).
- Valódi böngésző (headless Chromium, asztali és 390×844 mobil-emuláció): 20 ellenőrzés sikeres, JavaScript-hiba nélkül.
- Ellenőrzött: Sárbogárdon engedélykérés, engedélyadás, A→T-V vágányút, külön jelzőállítás, behaladás, megállás, kijárati vágányút, indulás; Kurd teljes napi automata futtatása; menetrendi ablak; módválasztó.
- Tíz állomáson (Sárbogárd, Rétszilas, Kurd, Pusztaszabolcs, Dombóvár, Budapest-Kelenföld, Budapest-Déli, Pécs, Ercsi, Százhalombatta) a teljes nap automata futtatása beragadás nélkül lefutott, maximális késés 8 perc alatt.
- Nem történt: fizikai mobilteszt, éles GitHub Pages telepítés, a beolvasott menetrend teljes kézi egyeztetése a PDF-fel.
