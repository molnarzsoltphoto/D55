(() => {
  "use strict";
  // VONAL 40 · 0.16 — vágányúti időzítés és fogadóvágány-választás.
  //
  // 1) Bejárati vágányút csak az utolsó térközben. Eddig a gép a bejárati vágányutat már az engedély
  //    kiadásakor beállította, így a fogadó állomás váltókörzete a vonat teljes útja alatt zárva volt:
  //    Pusztaszabolcson a kijáró vonat megvárta a még állomásközben lévő vonat beérkezését. Mostantól a
  //    foglaltság az állomásközben csak a térközökre terjed ki (a bejárati jelzőig), a bejárati vágányutat
  //    pedig a gép akkor állítja be, amikor a vonat az utolsó térközbe ér. A kézi kezelést ez nem érinti:
  //    a játékos bármikor állíthat vágányutat.
  //
  // 2) Fogadóvágány: az InterCity (8xx) az átmenő fővágányt kapja, hogy kitérő nélkül haladjon; a
  //    személyvonatot a gép félreteszi mellékvágányra, ha arra az állomásra hamarosan IC érkezik.
  const BLOKK = 2; // km, egy térköz hossza
  const IC_ABLAK = 20; // perc: ennyivel előre számít a gép az IC érkezésére a félretételnél

  function install() {
    if (typeof Simulation === "undefined" || typeof sim === "undefined") return false;
    const P = Simulation.prototype;
    if (P._v40Forgalom) return true;
    if (typeof P.autoRoute !== "function" || typeof P.freeReceivingTrack !== "function") return false;
    P._v40Forgalom = true;

    const ic = (t) => !!t && /^8\d\d$/.test(String(t.number || t.id || ""));

    // a vonat az utolsó térközben jár (vagy már a bejárati jelzőnél áll)
    function utolsoTerkoz(s, t) {
      if (!t) return false;
      if (["approach", "hold", "entering"].includes(t.phase)) return true;
      if (t.phase !== "line") return false;
      const p = s.permissions[t.id],
        sec = p && s.blockSystem.sections[p.section];
      if (!sec) return false;
      return sec.length - (t.distance || 0) <= BLOKK + 1e-6;
    }

    const prevAutoRoute = P.autoRoute;
    P.autoRoute = function (station, start, goal) {
      if (start === "A" || start === "B") {
        const dir = start === "A" ? 1 : -1;
        const jelolt = this.trains.filter((x) => !x.finished && x.dir === dir && this.permissions[x.id]?.to === station);
        // amíg egyik közeledő vonat sem ért az utolsó térközbe, a váltókörzet maradjon szabad
        if (jelolt.length && !jelolt.some((x) => utolsoTerkoz(this, x))) return;
      }
      return prevAutoRoute.call(this, station, start, goal);
    };

    // IC érkezik-e hamarosan erre az állomásra ugyanabba az irányba?
    P.icVarhato = function (station, train) {
      for (const t of this.trains) {
        if (t.finished || !ic(t) || t.id === train?.id) continue;
        if (train && t.dir !== train.dir) continue;
        const p = this.permissions[t.id];
        if (p && p.to === station) return t;
        const pont = t.plan?.find((x) => x.station === station);
        if (pont && pont.arr >= this.time - 5 && pont.arr <= this.time + IC_ABLAK) return t;
      }
      return null;
    };

    // Jobb oldali közlekedés az állomáson is: a Pécs felé tartó vonat a vonal alsó, a Budapest felé
    // tartó a felső vonali vágányáról jár be. Ha olyan állomási vágányt kap, amelyik ehhez az oldalhoz
    // tartozik, a vágányútja nem megy át az átmenő kitérőn – így a másik állomásvégi irány egyszerre
    // kezelhető (párhuzamos bejárat és kijárat egy állomásvégen).
    const nemKeresztez = (station, dir, track) => {
      const g = globalThis.LBgeom;
      if (!g || typeof g.sideUse !== "function") return true;
      try {
        const u = g.sideUse(station, dir === 1 ? "L" : "R", track, "in");
        return !u || !u.cross;
      } catch {
        return true;
      }
    };

    const prevFree = P.freeReceivingTrack;
    P.freeReceivingTrack = function (station, trainId) {
      const t = this.trains.find((x) => x.id === trainId);
      const atmeno = this.throughTrack(station);
      const hasznalhato = (track) =>
        !this.closed[`${station}:${track}`] &&
        !this.busy(station, track, trainId) &&
        !Object.values(this.routes).some((r) => r.at === station && r.track === track && r.train !== trainId);
      const szabad = STATIONS[station].tracks.filter(hasznalhato);
      if (!szabad.length) return null;
      if (ic(t)) return szabad.includes(atmeno) ? atmeno : szabad[0];
      const dir = t?.dir ?? 1;
      const sajatOldal = szabad.filter((x) => nemKeresztez(station, dir, x));
      if (t && t.menetrendi && this.icVarhato(station, t)) {
        // félretesszük, hogy az IC kitérő nélkül haladhasson – lehetőleg a saját oldalán
        const mellek = (sajatOldal.length ? sajatOldal : szabad).filter((x) => x !== atmeno);
        if (mellek.length) return mellek[0];
      }
      if (sajatOldal.length) {
        const elsobb = prevFree.call(this, station, trainId);
        if (elsobb && sajatOldal.includes(elsobb)) return elsobb;
        return sajatOldal.includes(atmeno) ? atmeno : sajatOldal[0];
      }
      return prevFree.call(this, station, trainId);
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
