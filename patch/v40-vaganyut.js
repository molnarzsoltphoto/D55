(() => {
  "use strict";
  // VONAL 40 · 0.20 — valódi állomási vágányút-összeférhetőség a vázlatos helyszínrajzokból.
  //
  // Eddig egyetlen lezárt vágányút az egész állomásvéget zárta: amíg az egyik vonat bejárt,
  // a másik nem indulhatott ki, akkor sem, ha a valóságban külön váltócsoporton mennek.
  // Ahol a helyszínrajzból kiolvasott vágányút-tábla rendelkezésre áll (adatok/allomasok),
  // két vágányút csak akkor zárja ki egymást, ha van közös váltójuk. A kétvágányú oldalon
  // a bejárat és a kijárat jellemzően külön váltócsoportot érint, tehát egyszerre kezelhető.
  //
  // Ahol nincs adat (állomás, vágány vagy szerep hiányzik a táblából), marad a korábbi,
  // szigorúbb közelítés — inkább maradjon zárva, mint hogy ütköző menetet engedjen.
  const TABLA = globalThis.ALLOMAS_VAGANYUT || {};
  const szerep = (side, kind) => `${side}.${kind === "in" ? "be" : "ki"}`;

  function install() {
    if (typeof Simulation === "undefined" || typeof sim === "undefined") return false;
    const P = Simulation.prototype;
    if (P._v40Vaganyut) return true;
    // a throughTrack-et is más folt adja; megvárjuk, különben nincs mire visszaesni
    if (typeof P.throatLocked !== "function" || typeof P.throughTrack !== "function") return false;
    P._v40Vaganyut = true;

    const prevThroat = P.throatLocked;

    // egy vágányút váltói: a bejárat/kijárat szerepe + a fogadó vágány alapján
    const valtok = (station, side, kind, track) =>
      TABLA[station]?.utak?.[szerep(side, kind)]?.[track] || null;

    const agZar = (s, station, side) =>
      Object.values(s.lineBranches || {}).some(
        (b) => b.station === station && b.route?.side === side && !b.route.own
      );

    P.vaganyutValtoi = function (station, side, kind, track) {
      return valtok(station, side, kind, track);
    };

    P.throatLocked = function (station, side) {
      const ctx = this._routeCtx;
      if (!TABLA[station] || !ctx || ctx.station !== station) {
        return prevThroat.call(this, station, side);
      }
      const mine = valtok(station, ctx.side, ctx.kind, ctx.track);
      if (!mine) return prevThroat.call(this, station, side);

      for (const r of Object.values(this.routes)) {
        if (r.at !== station) continue;
        const other = valtok(station, r.side, r.kind, r.track);
        if (!other) {
          // ismeretlen vágányút: a régi szabály szerint az azonos állomásvég zárt
          if (r.side === side) return true;
          continue;
        }
        if (mine.some((v) => other.includes(v))) return true;
      }
      return agZar(this, station, side);
    };

    // Az átmenő fővágány a rajz szerinti. Egy állomásnak két átmenője van – „jobb átmenő"
    // a Pécs felé, „bal átmenő" a Budapest felé haladónak –, a modell viszont egyet ismert.
    // Ahol van adat, menetirány szerint adjuk vissza a helyeset.
    const prevThrough = P.throughTrack;

    P.atmenoVagany = function (station, dir) {
      this.forwardState?.();
      const sajat = this.throughTracks?.[station];
      if (sajat && STATIONS[station]?.tracks.includes(sajat)) return sajat;
      const t = TABLA[station]?.atmeno?.[String(dir === -1 ? -1 : 1)];
      if (t && STATIONS[station]?.tracks.includes(t)) return t;
      return prevThrough.call(this, station);
    };

    P.throughTrack = function (station) {
      return this.atmenoVagany(station, 1);
    };

    return true;
  }

  if (!install()) {
    let tries = 0;
    const timer = setInterval(() => {
      if (install() || ++tries > 60) clearInterval(timer);
    }, 50);
  }
})();
