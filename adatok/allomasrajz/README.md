# Állomásrajz-feldolgozó

Vázlatos helyszínrajz PDF-ből állítja elő az állomás vágányút-modelljét:
melyik bejáratból melyik vágányra vezető vágányút mely váltókat foglalja.
Két vágányút akkor fér össze, ha a váltóhalmazuk metszete üres.

## Lépések

1. `pdftoppm -r 400 -png -singlefile <rajz>.pdf <nev>` — raszterizálás.
2. `halo.py <nev>.png <nev>.halo.json 400` — a vágányhálózat gráfja.
   A vágány a rajz legvastagabb fekete vonala: morfológiai nyitás választja le
   a feliratokról, majd csontvázasítás + síkbeli gráf. A rajzi jelek
   (kisiklasztó, útátjáró) megszakítják a vonalat, ezeket a `bridge()`
   irányfolytonosság alapján összeköti. Minden él eltárolja a valódi vonalát
   (poliline), mert a vágányok nem egyenesek.
3. `cimke.py <rajz>.pdf <nev>.cimke.json` — a PDF szövegrétegéből: váltó- és
   jelzőtáblázat (szám + szelvény), vágánynevek, iránynyilak, rajzi váltószámok.
4. `allomas.py <nev>.halo.json <nev>.cimke.json <nev>.allomas.json` — vágányok
   (a nevük alatti vonalra horgonyozva), bejáratok, és minden bejárat–vágány
   párra az x-monoton legrövidebb út = a vágányút, rajta a váltók.
   A váltószám-hozzárendelés monoton illesztés: a váltók fizikai sorrendje a
   szelvényszám, ez a rajzon balról jobbra nő.
5. `ellenorzo.py <nev>.halo.json <nev>.allomas.json <nev>.png <ki>.png` —
   ellenőrző kép: a kinyert hálózat az eredeti rajzra vetítve.
6. `tune.py` — a morfológiai sugarat a rajz saját váltószámaihoz hangolja.

## Amit kézzel kell megadni

A rajzok nem egyforma szabvány szerint készültek. Rajzonként ellenőrizni kell:

- a morfológiai sugarat (`r`), ha a rajzon nincs kiolvasható váltószám;
- a bejáratokat, ha a rajzon nincs `<<` / `>>` iránynyíl;
- a vágányneveket, ahol római számozás vagy egyedi jelölés van.

Az eredményt mindig az ellenőrző képen kell visszanézni, nem vakon elhinni.

## Forrásrajzok

A forrás PDF-ek nincsenek a repóban. Csak a levezetett adat (vágány- és
váltószámok, vágányutak) kerül ide.
