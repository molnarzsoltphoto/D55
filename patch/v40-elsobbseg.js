(() => {
  "use strict";
  // VONAL 40 · 0.14 — személyvonati elsőbbség a gépi forgalomirányításban.
  //
  // 1) Az automata a menetrendi (személy)vonatokat veszi előre: az engedélykiadás sorrendje előbb a
  //    személyvonatoké (a tervezett indulás szerint), utána a tehervonatoké.
  // 2) Tehervonat csak akkor kap engedélyt egy állomásközre, ha nem állja el egy személyvonat útját:
  //    nem indul el, ha ugyanarra a szakaszra rövidesen személyvonat jön (az egyvágányú szakaszon
  //    bármelyik irányból, a kétvágányún a vele azonos irányból), vagy ha már van oda személyvonati
  //    engedély. Így nem ragad be személyvonat a lassabb tehervonat mögött.
  // 3) Kiéheztetés ellen: ha a tehervonat már régóta vár, és éppen nincs kiadott személyvonati
  //    engedély a szakaszra, elindulhat.
  const HORIZONT = 12; // perc: ennyivel a személyvonat tervezett indulása előtt már nem indul teher
  const MAX_VARAKOZAS = 45; // perc: ennyi után a teher akkor is mehet, ha csak várható személyvonat van

  function install() {
    if (typeof Simulation === "undefined" || typeof sim === "undefined") return false;
    const P = Simulation.prototype;
    if (P._v40Elsobbseg) return true;
    if (typeof P.grant !== "function") return false;
    P._v40Elsobbseg = true;

    const szemely = (t) => !!t.menetrendi || t.kind === "passenger";
    const teher = (t) => !szemely(t);

    // 1) sorrend: az automata futása alatt a személyvonatok állnak a lista elején
    if (typeof globalThis.autoOutside === "function" && !globalThis.autoOutside._v40elsobbseg) {
      const prev = globalThis.autoOutside;
      const wrapped = function (s) {
        const eredeti = s.trains;
        s._gepiEngedely = true;
        try {
          s.trains = [...eredeti].sort((a, b) => {
            const d = (szemely(b) ? 1 : 0) - (szemely(a) ? 1 : 0);
            return d || (a.dep ?? 0) - (b.dep ?? 0);
          });
          return prev(s);
        } finally {
          // a rendezés csak az automata döntési sorrendjét befolyásolja, a lista marad a régi
          const sorrend = new Map(eredeti.map((t, i) => [t.id, i]));
          s.trains = [...s.trains].sort((a, b) => (sorrend.get(a.id) ?? 1e9) - (sorrend.get(b.id) ?? 1e9));
          s._gepiEngedely = false;
        }
      };
      wrapped._v40elsobbseg = true;
      globalThis.autoOutside = wrapped;
    }

    // 2) a tehervonat visszatartása
    P.szemelyvonatVarhato = function (t, to) {
      const sec = this.blockSystem.section(t.at, to);
      if (!sec) return null;
      const vegek = [sec.from, sec.to];
      for (const p of this.trains) {
        if (p.id === t.id || p.finished || !szemely(p)) continue;
        const perm = this.permissions[p.id];
        if (perm && perm.section === sec.id && (!sec.double || p.dir === t.dir)) return { vonat: p, kiadott: true };
        if (p.phase !== "parked" || !vegek.includes(p.at)) continue;
        if (sec.double && p.dir !== t.dir) continue; // kétvágányún az ellenirány nem zavarja
        const kov = this.next(p);
        if (kov == null || !vegek.includes(kov) || kov === p.at) continue;
        if ((p.dep ?? 0) <= this.time + HORIZONT) return { vonat: p, kiadott: false };
      }
      return null;
    };

    const prevGrant = P.grant;
    P.grant = function (id, track) {
      const t = this.trains.find((x) => x.id === id);
      if (!this._gepiEngedely || !t || !teher(t)) return prevGrant.call(this, id, track);
      const to = this.next(t);
      if (to == null) return prevGrant.call(this, id, track);
      const utban = this.szemelyvonatVarhato(t, to);
      if (utban) {
        const varakozik = this.time - (t.dep ?? this.time);
        if (utban.kiadott || varakozik < MAX_VARAKOZAS) {
          t.vartElsobbseg = utban.vonat.id;
          return { ok: false, msg: `${utban.vonat.id} személyvonatnak elsőbbsége van, a tehervonat vár.` };
        }
      }
      delete t.vartElsobbseg;
      return prevGrant.call(this, id, track);
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
