(() => {
  "use strict";
  // VONAL 40 · 0.24 — állomási vágánykorlátozás.
  //
  // Nem minden vágányról vezet vágányút minden irányba. Kelenföldön a Déli felé csak az
  // 1–8. vágányról van kijárat (a Keleti felé a 7–15-ről, azt a kiágazás saját
  // `tracks` listája intézi). Eddig a gép bármelyik vágányt kioszthatta, és a játékos
  // is állíthatott olyan vágányutat, ami a valóságban nincs.
  //
  // A korlátozás a fővonali menetekre vonatkozik: a kiágazási menetek a saját águkhoz
  // tartozó listát követik.
  const KORLAT = {
    1: { L: ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"] }, // Budapest-Kelenföld, Déli felé
  };

  function install() {
    if (typeof Simulation === "undefined" || typeof sim === "undefined") return false;
    const P = Simulation.prototype;
    if (P._v40Korlat) return true;
    if (typeof P.freeReceivingTrack !== "function" || typeof P.setRoute !== "function") return false;
    P._v40Korlat = true;

    const lista = (station, side) => KORLAT[station]?.[side] || null;

    // A fővonali vonat Kelenföldön mindig a Déli felőli oldalt is használja (onnan jön
    // vagy arra megy), tehát a fogadóvágányának az L-listában kell lennie.
    // Melyik vágányokat használhatja ez a vonat ezen az állomáson? A kiágazási menet a
    // saját ágának listáját (Keleti felé 7–15), a fővonali a Déli felőli listát (1–8).
    const sajatLista = (station, train) => {
      const def = train?.lineBranch && window.LineBranches?.byId?.(train.lineBranch.id);
      if (def) return def.station === station && def.tracks ? def.tracks : null;
      // a korlátozás a Déli felőli vágányútra vonatkozik, nem az állásra: aki Pécs felől
      // jön és itt végállomásozik, sosem használja a Déli torkot, állhat bármelyik vágányon
      if (train) {
        const hasznalja =
          (train.dir === 1 && train.startStation !== station) ||
          (train.dir === -1 && train.endStation !== station);
        if (!hasznalja) return null;
      }
      return lista(station, "L");
    };

    P.vaganyEngedett = function (station, track, train) {
      const l = sajatLista(station, train);
      return !l || l.includes(track);
    };

    const szabad = (s, station, track, id) =>
      !s.closed[`${station}:${track}`] &&
      !s.busy(station, track, id) &&
      !Object.values(s.routes).some((r) => r.at === station && r.track === track && r.train !== id);

    const prevFree = P.freeReceivingTrack;
    P.freeReceivingTrack = function (station, trainId) {
      const t = this.trains.find((x) => x.id === trainId);
      const eng = sajatLista(station, t);
      const valasz = prevFree.call(this, station, trainId);
      if (!eng && KORLAT[station] && t) {
        // itt végállomásozó vagy innen induló menet: a fővonal vágányait hagyjuk szabadon
        const l = lista(station, "L") || [];
        const kulso = STATIONS[station].tracks.filter((x) => !l.includes(x) && szabad(this, station, x, trainId));
        if (kulso.length) return kulso[0];
      }
      if (!eng || (valasz && eng.includes(valasz))) return valasz;
      // a saját sávjából kapjon vágányt: így a Keleti felé tartó menetek nem szorítják
      // ki a Déli felőli forgalmat a 1–8-ról, és fordítva
      const jo = STATIONS[station].tracks.filter((x) => eng.includes(x) && szabad(this, station, x, trainId));
      return jo.length ? jo[0] : null;
    };

    const prevSet = P.setRoute;
    P.setRoute = function (station, start, goal) {
      const l = KORLAT[station];
      if (l && typeof this.describeRoute === "function") {
        let r = null;
        try { r = this.describeRoute(station, start, goal); } catch (e) { r = null; }
        const eng = r && lista(station, r.side);
        if (r && eng && !eng.includes(r.track)) {
          return { ok: false, msg: `${STATIONS[station].name}: a ${r.track}. vágányról nincs vágányút erre az irányra (csak ${eng[0]}–${eng[eng.length - 1]}).` };
        }
      }
      return prevSet.call(this, station, start, goal);
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
