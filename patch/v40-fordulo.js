(() => {
  "use strict";
  // VONAL 40 · 0.27 — szerelvényforduló a végállomásokon.
  //
  // Eddig a végállomásra beérkezett vonat öt perc múlva eltűnt, a visszainduló menet pedig
  // a semmiből keletkezett, tetszőleges szabad vágányon. A valóságban ugyanaz a szerelvény
  // áll a vágányon a fordulóidő alatt, és azzal indul vissza az új vonatszámmal.
  //
  // Mostantól a menetrendből előre összepárosítjuk az érkező és az induló meneteket a
  // végállomásokon (Déli, Kelenföld, Pusztaszabolcs, Sárbogárd, Dombóvár, Szentlőrinc,
  // Pécs). A beérkezett szerelvény a vágányán marad — foglalja is azt —, és amikor a
  // párjának indulnia kell, ugyanaz a vonat veszi fel az új számot, menetrendet és irányt.
  //
  // Párosítás: minden induló menethez a LEGKÉSŐBBI olyan érkezés tartozik, ami még belefér
  // a fordulóidőbe. Így rövid fordulók keletkeznek, nem áll órákig szerelvény a vágányon.
  // Irányváltásnál legalább 8 perc, azonos irányban továbbközlekedve 2 perc kell.
  const ALLOMASOK = [0, 1, 14, 18, 33, 43, 46];
  const MIN_FORDULO = 8; // perc, irányváltással
  const MIN_ATMENET = 2; // perc, azonos irányban tovább
  const MAX_VARAKOZAS = 180; // ennél tovább nem állítjuk a szerelvényt a vágányon
  const TURELEM = 30; // ennyit vár a menet a saját szerelvényére, utána nélküle indul

  function install() {
    if (typeof Simulation === "undefined" || typeof sim === "undefined") return false;
    const P = Simulation.prototype;
    if (P._v40Fordulo) return true;
    if (typeof P.realTraffic !== "function" || typeof globalThis.makeTimetablePlan !== "function") return false;
    if (!(globalThis.REAL_TIMETABLE || []).length) return false;
    P._v40Fordulo = true;

    // vonatszám → az a menet, amivel a szerelvény visszaindul
    let parok = null;
    function parositas() {
      if (parok) return parok;
      parok = new Map();
      for (const st of ALLOMASOK) {
        const erk = REAL_TIMETABLE.filter((s) => s.stops.at(-1).station === st)
          .map((s) => ({ sv: s, t: s.stops.at(-1).arr }))
          .sort((a, b) => a.t - b.t);
        const ind = REAL_TIMETABLE.filter((s) => s.stops[0].station === st)
          .map((s) => ({ sv: s, t: s.stops[0].dep }))
          .sort((a, b) => a.t - b.t);
        const hasznalt = new Set();
        for (const j of ind) {
          let valasztott = null;
          for (const a of erk) {
            if (hasznalt.has(a.sv.id)) continue;
            const kell = a.sv.dir === j.sv.dir ? MIN_ATMENET : MIN_FORDULO;
            if (j.t >= a.t + kell && j.t <= a.t + MAX_VARAKOZAS) valasztott = a; // a legkésőbbi illeszkedő
          }
          if (valasztott) {
            hasznalt.add(valasztott.sv.id);
            parok.set(valasztott.sv.id, j.sv);
          }
        }
      }
      return parok;
    }

    // a vonat melyik fővonali menetet viszi? (a kiágazási menetrendben 97 vonatszám
    // ugyanúgy szerepel, ezért a menet azonosítójával dolgozunk, és a kiágazási
    // vonatokat külön kizárjuk)
    const fovonali = (t) => !!t && t.menetrendi && !t.branchService;
    const szolgalat = (t) => String(t.id || "").replace(/\/D\d+$/, "");
    const napja = (t) => {
      const m = /\/D(\d+)$/.exec(String(t.id || ""));
      return m ? Number(m[1]) : 0;
    };

    // A szerelvény elengedése: innentől a szokásos módon archiválódik.
    const elenged = (s, t) => {
      t.forduloRa = null;
      t.forduloIrany = null;
      if (!Number.isFinite(t.finishedAt)) t.finishedAt = s.time;
    };

    // Az álló szerelvény felveszi az új menetet: marad a vágányán, de új szám, menetrend,
    // irány és indulási idő kerül rá.
    function atvesz(s, t, f, key) {
      const plan = makeTimetablePlan(f.sv, f.offset),
        pont = plan.find((x) => x.station === t.at);
      if (!pont) return elenged(s, t);
      // van-e kijárat erről a vágányról a menete irányába? (Kelenföldön a XI–XV. vágányról
      // a Déli felé nincs) — ha nincs, a szerelvény elmegy, a menet a szokásos módon indul
      const proba = { dir: f.sv.dir, startStation: t.at, endStation: plan.at(-1).station, plan, menetrendi: true };
      if (typeof s.vaganyEngedett === "function" && !s.vaganyEngedett(t.at, t.track, proba)) return elenged(s, t);

      // ugyanazzal az azonosítóval nem lehet két vonat: 97 vonatszám a kiágazási
      // menetrendben is szerepel, és azt a motor már elindíthatta
      const ujId = f.sv.number + (f.day === 0 ? "" : "/D" + f.day);
      if (s.trains.some((x) => x !== t && x.id === ujId)) return elenged(s, t);
      t.id = ujId;
      t.number = f.sv.number;
      t.dir = f.sv.dir;
      t.plan = plan;
      t.endStation = plan.at(-1).station;
      t.sourceLines = f.sv.lines;
      t.finished = false;
      t.finishedAt = undefined;
      t.phase = "parked";
      t.progress = 0;
      t.distance = 0;
      t.blockWaiting = false;
      t.history = [];
      t.approximateStart = false;
      t.dep = Math.max(s.time, pont.dep);
      t.delay = Math.max(0, s.time - pont.dep);
      // undefined, nem null: a következő végállomáson újra kaphat fordulót
      t.forduloRa = undefined;
      t.forduloIrany = (parositas().get(f.sv.id) || {}).dir ?? null;
      t.fordulobol = true;
      s.ttSpawned[key] = true;
      s.log(`${t.id}: a ${STATIONS[t.at].name}, ${t.track}. vágányon álló szerelvénnyel indul.`);
    }

    const prevReal = P.realTraffic;
    P.realTraffic = function () {
      // 1) a fordulóra váró szerelvények átveszik az új menetet, mielőtt a motor újat
      //    keltene belőle. Amelyik menetnek a szerelvénye még úton van, azt visszatartjuk:
      //    a szerelvény késése így — a valósághoz hasonlóan — átterhelődik a fordulójára.
      //    A türelmi idő után a menet mégis elindul, hogy egy beragadt vonat ne fektessen
      //    meg egy másikat a nap hátralévő részére.
      const tabla = parositas();
      const nap0 = Math.floor(this.time / 1440);
      for (const [szam, kov] of tabla) {
        for (let day = nap0 - 1; day <= Math.floor((this.time + 3) / 1440); day++) {
          const key = day + ":" + kov.id;
          if (this.ttSpawned[key] === true) continue;
          const elso = kov.stops[0].dep + day * 1440;
          if (elso > this.time + 3) continue;
          const all = this.trains.find(
            (t) => t.finished && t.forduloRa && t.forduloRa.sv === kov && t.forduloRa.day === day,
          );
          if (all) {
            delete this.ttSpawned[key];
            try { atvesz(this, all, all.forduloRa, key); } catch (e) { console.warn("forduló:", e); elenged(this, all); }
            continue;
          }
          // ha ezzel az azonosítóval már jár vonat (kiágazási menetrendből), nem tartjuk vissza
          if (this.trains.some((t) => t.id === kov.number + (day === 0 ? "" : "/D" + day))) {
            if (this.ttSpawned[key] === "fordulora-var") delete this.ttSpawned[key];
            continue;
          }
          const uton = this.trains.find(
            (t) => !t.finished && fovonali(t) && szolgalat(t) === szam && napja(t) === day,
          );
          if (uton && this.time <= elso + TURELEM) this.ttSpawned[key] = "fordulora-var";
          else if (this.ttSpawned[key] === "fordulora-var") delete this.ttSpawned[key];
        }
      }
      // akinek a menete már elindult nélküle, azt elengedjük
      for (const t of this.trains) {
        const f = t.forduloRa;
        if (!f || !t.finished) continue;
        if (this.ttSpawned[f.day + ":" + f.sv.id] === true) elenged(this, t);
      }
      const r = prevReal.call(this);
      // 2) az új menetekre felírjuk, merre indul tovább a szerelvényük: a fogadóvágány
      //    választásánál ezt is figyelembe kell venni
      const p = parositas();
      for (const t of this.trains) {
        if (t.forduloIrany !== undefined || !fovonali(t)) continue;
        const kov = p.get(szolgalat(t));
        t.forduloIrany = kov ? kov.dir : null;
      }
      return r;
    };

    // A frissen beérkezett szerelvényt megtartjuk, ha van fordulója.
    const prevTick = P.tick;
    P.tick = function (dt) {
      prevTick.call(this, dt);
      const p = parositas();
      for (const t of this.trains) {
        if (!t.finished || t.forduloRa !== undefined) continue;
        const kov = fovonali(t) && ALLOMASOK.includes(t.at) ? p.get(szolgalat(t)) : null;
        if (!kov) {
          t.forduloRa = null;
          continue;
        }
        const day = napja(t), offset = day * 1440;
        t.forduloRa = { sv: kov, day, offset, first: kov.stops[0].dep + offset };
        t.finishedAt = Infinity; // amíg a fordulóra vár, nem archiváljuk
      }
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
