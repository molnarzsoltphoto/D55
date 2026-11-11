(() => {
  "use strict";
  // VONAL 40 · 0.13 — ellenirányú kijárat a kétvágányú szakaszon.
  //
  // Eddig: az engedély csak arra a vonali vágányra volt kiadható, amelynek a menetiránya már a vonaté
  // volt; ha a másik irányból le volt foglalva (menetirány átállítva vagy ellenkező irányú engedély),
  // a kijárat elutasult („Nincs megfelelő menetirány"), és a menetirány sem volt átállítható.
  //
  // Mostantól a játékos saját kezelésű állomásán álló vonat kijárathatóvá válik a másik menetirány
  // szerinti vonali vágányra is: a pult átállítja annak a vágánynak a menetirányát, és kiadja az
  // engedélyt. Ez akkor is megy, ha arra a vágányra ellenkező irányú engedély van kiadva — az a vonat
  // a jelzője előtt marad, amíg a menetirány vissza nem áll. A gép (automata terület) ezt nem teszi meg.
  //
  // Egyetlen eset marad tiltott: ha a vonali vágányon fizikailag vonat van (a térközöknek van
  // gazdájuk). A motor szembeközlekedésnél térközfoglaltsági ütközést dobna, ezért ott a kijárat
  // továbbra is elutasul, külön üzenettel.
  function install() {
    if (typeof Simulation === "undefined" || typeof sim === "undefined") return false;
    const P = Simulation.prototype;
    if (P._v40Ellenirany) return true;
    if (typeof P.grant !== "function" || typeof P.setLineDirection !== "function") return false;
    P._v40Ellenirany = true;

    const sajat = (s, station) => typeof playerOwns !== "function" || playerOwns(s, station);
    const foglaltFizikailag = (lane) => lane.blocks.some((b) => b.owner);
    const nev = (lane) => lane + 1 + ". vonali vágány";

    // A gépi engedélykiadás alatt nem erőltetünk ellenirányt.
    if (typeof globalThis.autoOutside === "function" && !globalThis.autoOutside._v40wrapped) {
      const prevAutoOutside = globalThis.autoOutside;
      const wrapped = function (s) {
        s._gepiEngedely = true;
        try {
          return prevAutoOutside(s);
        } finally {
          s._gepiEngedely = false;
        }
      };
      wrapped._v40wrapped = true;
      globalThis.autoOutside = wrapped;
    }

    const prevGrant = P.grant;
    P.grant = function (id, track) {
      const r = prevGrant.call(this, id, track);
      if (r.ok || !/Nincs megfelelő menetirány/.test(r.msg || "")) return r;
      if (this._gepiEngedely) return r;

      const t = this.trains.find((x) => x.id === id);
      if (!t) return r;
      const to = this.next(t);
      if (to == null) return r;
      const section = this.blockSystem.section(t.at, to);
      if (!section || !section.double) return r;
      if (!sajat(this, t.at)) return r;

      // a szabad vágányt választjuk; ha mindkettőn van vonat, marad az elutasítás.
      // Elsőként az olyan vágány jön, amelyre nincs ellenkező irányú engedély kiadva.
      const claim = (k) => Object.values(this.permissions).some((p) => p.section === section.id && p.lane === k);
      const jelolt = section.lanes
        .map((l, k) => ({ l, k }))
        .filter(({ l }) => !foglaltFizikailag(l))
        .sort((a, b) => claim(a.k) - claim(b.k));
      if (!jelolt.length)
        return { ok: false, msg: "Ellenirányú kijárat sem lehetséges: mindkét vonali vágányon vonat van az állomásközben." };

      const { l, k } = jelolt[0];
      const ellenEngedely = Object.values(this.permissions).some((p) => p.section === section.id && p.lane === k);
      l.direction = t.dir;
      this.log(
        `${STATIONS[t.at].name}: ellenirányú kijárat a(z) ${nev(k)}on (${STATIONS[t.at].name}–${STATIONS[to].name})` +
          (ellenEngedely ? ", ellenkező irányú engedély mellett — az a vonat a jelzője előtt marad." : ".")
      );
      return prevGrant.call(this, id, track);
    };

    // A KÖFI menetiránygombja is átállítja a vágányt, ha csak engedély foglalja, vonat nincs rajta.
    const prevSetLine = P.setLineDirection;
    P.setLineDirection = function (sectionId, lane, dir) {
      const r = prevSetLine.call(this, sectionId, lane, dir);
      if (r.ok) return r;
      const sec = this.blockSystem.sections[sectionId],
        l = sec?.lanes?.[lane];
      if (!l || !sec.double || ![1, -1].includes(dir)) return r;
      if (foglaltFizikailag(l)) return { ok: false, msg: "A menetirány nem állítható: az állomásközben vonat van a vágányon." };
      l.direction = dir;
      const hol = STATIONS[sec.from] && STATIONS[sec.to] ? `${STATIONS[sec.from].name}–${STATIONS[sec.to].name}` : sectionId;
      this.log(`${hol}, ${nev(lane)}: menetirány átállítva kiadott engedély mellett — az ellenkező irányú vonat a jelzője előtt marad.`);
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
