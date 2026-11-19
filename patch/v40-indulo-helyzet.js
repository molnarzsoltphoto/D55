(() => {
  "use strict";
  // VONAL 40 · 0.26 — induló forgalmi helyzet.
  //
  // A szolgálat 6:00-kor kezdődik, de a vonal nem ekkor ébred: a hajnali menetek már órák
  // óta úton vannak. Eddig minden olyan menet, ami 6:00 előtt indult, az utolsó olyan
  // forgalmi szolgálati helyen állt, ahonnan már el kellett volna indulnia — vagyis a
  // szolgálat kezdetén egyszerre húsz vonat várt kijáratra az állomásokon, és egy sem volt
  // állomásközben. A valóságban az ügyeletátadáskor a vonatok nagy része útközben van,
  // kiadott engedéllyel, lezárt bejárati vágányút előtt.
  //
  // Mostantól a 6:00 előtt indult menetek oda kerülnek, ahol a menetrendjük szerint ekkor
  // tartaniuk kell:
  //   · állomásközben, a menetrend szerinti helyen, kiadott engedéllyel (phase: line),
  //   · vagy annál az állomásnál, ahol a menetrend szerint éppen tartózkodnak.
  //
  // A térközfoglaltságot a motor számolja (blockSystem.refresh): ha egy vonat elhelyezése
  // ütközést okozna, azt a vonatot az eddigi módon, az állomáson hagyjuk.

  function install() {
    if (typeof Simulation === "undefined" || typeof sim === "undefined") return false;
    const P = Simulation.prototype;
    // A javítórétegek külön-külön települnek; ez a réteg csak akkor dolgozhat, ha mind
    // megvan, különben a vonal hiányos szabályokkal indulna (a kiágazási menetrend
    // például a nagy rajzoló réteghez tartozik: nélküle egyetlen ági vonat sem keletkezne).
    const KELL = [
      "_v40DoubleQueueBranches", "_v40Korlat", "_v40Elsobbseg", "_v40Forgalom",
      "_v40Ellenirany", "_v40Elkerulo", "_v40EloEngedely", "_v40Tehermenetvonal",
    ];
    if (P._v40InduloHelyzet) return true;
    if (!KELL.every((j) => P[j])) return false;
    if (typeof P.realTraffic !== "function" || typeof globalThis.timetableDistance !== "function") return false;
    P._v40InduloHelyzet = true;

    const kov = (plan, i) => {
      for (let k = i + 1; k < plan.length; k++) if (STATIONS[plan[k].station].control) return k;
      return -1;
    };

    // A vonat visszahelyezése az állomásra, ha az állomásközi elhelyezés nem sikerült.
    function vissza(s, t, mentes) {
      const p = s.permissions[t.id];
      if (p) {
        delete s.edges[p.key];
        delete s.permissions[t.id];
      }
      Object.assign(t, mentes);
    }

    function utkozbe(s, t) {
      const plan = t.plan,
        i = plan.findIndex((x) => x.station === t.at),
        j = i < 0 ? -1 : kov(plan, i);
      if (j < 0) return false;

      // Ha a menetrend szerint már beért a következő szolgálati helyre, ott tartózkodik.
      if (plan[j].arr <= s.time) {
        const hova = plan[j].station,
          vagany =
            (typeof s.freeReceivingTrack === "function" && s.freeReceivingTrack(hova, t.id)) || s.free(hova);
        if (!vagany || s.busy(hova, vagany, t.id)) return false;
        t.at = hova;
        t.track = vagany;
        t.dep = Math.max(s.time, plan[j].dep);
        t.delay = Math.max(0, s.time - plan[j].arr);
        t.history.push({ station: hova, arr: plan[j].arr });
        return true;
      }

      // Ha még nem kellett volna elindulnia, marad az állomáson: a szolgálat kezdetén
      // induló menetek a saját idejükben járnak ki.
      if ((plan[i].dep ?? s.time) > s.time) return false;

      // Különben állomásközben van. Engedély a következő szolgálati helyig, majd a
      // menetrend szerinti helyre állítjuk a vonal mentén.
      const mentes = {
        at: t.at, track: t.track, dep: t.dep, delay: t.delay,
        phase: t.phase, distance: t.distance, progress: t.progress,
        segmentOffset: t.segmentOffset, lineStart: t.lineStart, clock: t.clock,
      };
      if (!s.request(t)) return false;
      const r = s.grant(t.id);
      if (!r || !r.ok) return false;
      const p = s.permissions[t.id];
      if (!p || !p.section) {
        vissza(s, t, mentes);
        return false;
      }
      const sec = s.blockSystem.sections[p.section];
      if (!sec) {
        vissza(s, t, mentes);
        return false;
      }
      t.phase = "line";
      t.lineStart = s.time;
      // menetrend szerint halad: nincs eltolás, a késése nulla
      t.segmentOffset = 0;
      t.delay = 0;
      t.progress = 0;
      t.blockWaiting = false;
      t.clock = s.time;
      t.distance = Math.max(0.05, Math.min(sec.length - 0.05, timetableDistance(t, p, s.time, sec.length)));
      if (plan[i].arr != null) t.history.push({ station: t.at, arr: plan[i].arr });
      try {
        s.blockSystem.refresh(s);
      } catch (e) {
        // térközütközés: ez a vonat marad az állomáson
        vissza(s, t, mentes);
        try { s.blockSystem.refresh(s); } catch (e2) { /* a visszaállítás után már nem ütközhet */ }
        return false;
      }
      return true;
    }

    function induloHelyzet(s) {
      // Csak a szolgálat kezdetén, és vonatlistánként egyszer: az „Új szolgálat ezzel az
      // idővel" a konstruktor után kicseréli a vonatlistát és újra feltölti, azt is el kell
      // helyezni. Menet közben (time > serviceStart) nincs dolgunk.
      if (s.time !== s.serviceStart || s._v40Indulas === s.trains) return;
      s._v40Indulas = s.trains;
      s.ensureBlocks();
      let utkozben = 0, allomason = 0;
      // a vonal mentén haladva helyezzük el őket, hogy az egymás mögöttiek sorrendje tartson
      const sorrend = s.trains
        .filter((t) => t.approximateStart && t.phase === "parked" && !t.finished)
        .sort((a, b) => a.at - b.at || a.dir - b.dir);
      for (const t of sorrend) {
        const volt = t.at;
        if (!utkozbe(s, t)) continue;
        if (t.phase === "line") utkozben++;
        else if (t.at !== volt) allomason++;
      }
      if (utkozben || allomason)
        s.log(
          `Szolgálatátadás: ${utkozben} vonat állomásközben, menetrend szerinti helyén, kiadott engedéllyel; ` +
            `${allomason} a menetrend szerinti állomásán.`,
        );
    }

    const prev = P.realTraffic;
    P.realTraffic = function () {
      const r = prev.call(this);
      // a konstruktorból hívott első menetrendi feltöltés után azonnal
      try { induloHelyzet(this); } catch (e) { console.warn("induló helyzet:", e); }
      return r;
    };

    // A már létrejött szimuláció (a javítóréteg a konstruktor után települ) utólag.
    try { induloHelyzet(sim); } catch (e) { console.warn("induló helyzet:", e); }
    return true;
  }

  if (!install()) {
    let tries = 0;
    const timer = setInterval(() => {
      if (install() || ++tries > 60) clearInterval(timer);
    }, 50);
  }
})();
