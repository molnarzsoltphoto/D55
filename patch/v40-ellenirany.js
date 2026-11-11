(() => {
  "use strict";
  // VONAL 40 · 0.14 — menetirány az engedélyekhez igazítva, ellenirányú kijárat a kézi és a gépi területen is.
  //
  // Eddig: az engedély csak arra a vonali vágányra volt kiadható, amelynek a menetiránya már a vonaté
  // volt. A motor csak állomási nézetben és csak teljesen szabad vágányon állította át az irányt, ezért
  // KÖFI-nézetben az egyvágányú szakaszon elakadt („Nincs megfelelő menetirány"), kétvágányún pedig nem
  // lehetett a másik menetirány szerinti vágányra kijáratni.
  //
  // Mostantól – a játékos és a gép területén egyaránt – a kijárat a másik menetirány szerinti vonali
  // vágányra is megy: a pult átállítja annak a vágánynak a menetirányát, és kiadja az engedélyt. Ha arra
  // a vágányra ellenkező irányú engedély van kiadva, de a vonat még az állomáson áll, azt az engedélyt
  // visszavonja (a vonat újra engedélyt kér, és a másik vágányt vagy a következő menetet kapja).
  //
  // Amit nem tesz: nem állítja át olyan vonali vágány irányát, amelyen fizikailag vonat van (a motor
  // szembeközlekedésnél térközfoglaltsági ütközést dobna), és nem vonja vissza már elindult vonat
  // engedélyét. Ilyenkor a kijárat elutasul, külön üzenettel.
  function install() {
    if (typeof Simulation === "undefined" || typeof sim === "undefined") return false;
    const P = Simulation.prototype;
    if (P._v40Ellenirany) return true;
    if (typeof P.grant !== "function" || typeof P.setLineDirection !== "function") return false;
    P._v40Ellenirany = true;

    const vonatRajta = (lane) => lane.blocks.some((b) => b.owner);
    const nev = (k) => k + 1 + ". vonali vágány";
    const hol = (sec) =>
      typeof STATIONS !== "undefined" && STATIONS[sec.from] && STATIONS[sec.to]
        ? `${STATIONS[sec.from].name}–${STATIONS[sec.to].name}`
        : sec.id;

    // Az adott vonali vágányra kiadott, még el nem indult ellenirányú engedélyek visszavonása.
    // Igazzal tér vissza, ha a vágány felszabadítható; hamissal, ha mozgásban lévő vonat tartja.
    function felszabadit(s, sec, k, sajatId) {
      for (const [tid, p] of Object.entries(s.permissions)) {
        if (tid === sajatId || p.section !== sec.id || p.lane !== k) continue;
        const t = s.trains.find((x) => x.id === tid);
        if (!t || t.phase !== "parked") return false;
        if (!s.revoke(tid).ok) return false;
        s.log(`${tid}: engedélye visszavonva – ${hol(sec)}, ${nev(k)} menetiránya a másik vonathoz állt át.`);
      }
      return true;
    }

    const prevGrant = P.grant;
    P.grant = function (id, track) {
      const r = prevGrant.call(this, id, track);
      if (r.ok || !/Nincs megfelelő menetirány/.test(r.msg || "")) return r;

      const t = this.trains.find((x) => x.id === id);
      if (!t) return r;
      const to = this.next(t);
      if (to == null) return r;
      const sec = this.blockSystem.section(t.at, to);
      if (!sec) return r;

      const claim = (k) => Object.values(this.permissions).some((p) => p.section === sec.id && p.lane === k);
      const jelolt = sec.lanes
        .map((l, k) => ({ l, k }))
        .filter(({ l }) => !vonatRajta(l))
        .sort((a, b) => claim(a.k) - claim(b.k));
      if (!jelolt.length)
        return { ok: false, msg: "A kijárat nem állítható: az állomásközben vonat van a vonali vágányon." };

      for (const { l, k } of jelolt) {
        if (!felszabadit(this, sec, k, id)) continue;
        l.direction = t.dir;
        this.log(`${hol(sec)}, ${nev(k)}: menetirány átállítva ${STATIONS[to].name} felé a kijárathoz.`);
        return prevGrant.call(this, id, track);
      }
      return { ok: false, msg: "A kijárat nem állítható: a vonali vágányt elindult, ellenkező irányú vonat tartja." };
    };

    // A KÖFI menetiránygombja is átállítja a vágányt, ha csak engedély foglalja, vonat nincs rajta.
    const prevSetLine = P.setLineDirection;
    P.setLineDirection = function (sectionId, lane, dir) {
      const r = prevSetLine.call(this, sectionId, lane, dir);
      if (r.ok) return r;
      const sec = this.blockSystem.sections[sectionId],
        l = sec?.lanes?.[lane];
      if (!l || ![1, -1].includes(dir)) return r;
      if (vonatRajta(l)) return { ok: false, msg: "A menetirány nem állítható: az állomásközben vonat van a vágányon." };
      if (!felszabadit(this, sec, lane, null))
        return { ok: false, msg: "A menetirány nem állítható: elindult vonat engedélye van a vágányon." };
      l.direction = dir;
      this.log(`${hol(sec)}, ${nev(lane)}: menetirány kézzel átállítva.`);
      return { ok: true };
    };

    return true;
  }

  if (!install()) {
    let tries = 0;
    const timer = setInterval(() => {
      if (install() || ++tries > 40) clearInterval(timer);
    }, 50);
  }
})();
