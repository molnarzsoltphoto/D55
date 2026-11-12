(() => {
  "use strict";
  // VONAL 40 · 0.18 — tehervonati menetvonalak.
  //
  // Eddig a tehervonat véletlenül keletkezett a vonal végpontjain, menetrend nélkül, és 60–100 km/h-val
  // indult el a személyforgalom közé: gördülő útlezárás volt, ezért kellett rangsorral visszatartani, és
  // ezért lett az átlagkésése 30 perc fölött.
  //
  // Mostantól a teher is menetvonalat kap. A személyvonati menetrendből (REAL_TIMETABLE + a kiágazási
  // menetek fővonali szakaszai) felépítünk egy foglaltsági táblát állomásközönként, és ebben keresünk
  // rést: a vonat annyit vár az állomásokon, amennyit a keresztezések és az előzések megkívánnak.
  // A menetvonal a vonat tervébe kerül (plan), így a motor a várakozásokat magától betartja.
  //
  // Nem hiteles: ez nem a valódi tehervonati menetrend, hanem a személyforgalom réseibe illesztett,
  // számított menetvonal. A számítás 60 km/h-val dolgozik, így a tényleges (60–100) sebesség mellett a
  // vonat legfeljebb korábban hagyja el a szakaszt, mint a menetvonala – ütközést nem okoz.
  const HEADWAY = 3; // perc elő- és utóidő a személyvonati menetek körül
  const MAX_VARAKOZAS = 35; // perc: ennél többet egy állomáson nem várakoztatunk
  const SZAMITASI_SEBESSEG = 60; // km/h
  const ALLOMASI_IDO = 2; // perc tartózkodás forgalmi szolgálati helyen

  function install() {
    if (typeof Simulation === "undefined" || typeof sim === "undefined") return false;
    const P = Simulation.prototype;
    if (P._v40Tehermenetvonal) return true;
    if (typeof P.add !== "function" || typeof globalThis.makeTimetablePlan !== "function") return false;
    P._v40Tehermenetvonal = true;

    const km = (id) => STATIONS[id].km;
    const kovetkezoFoszolgalat = (from, dir) => {
      let n = from + dir;
      while (n >= 0 && n < STATIONS.length && !STATIONS[n].control) n += dir;
      return n >= 0 && n < STATIONS.length ? n : null;
    };
    const szakaszId = (a, b) => `${Math.min(a, b)}-${Math.max(a, b)}`;

    // Két pont közötti utat állomásközökre vágjuk, az időt a távolsággal arányosan osztva.
    function szakaszokra(aId, aTime, bId, bTime, dir, ki) {
      const teljes = Math.abs(km(bId) - km(aId));
      if (!teljes) return;
      let akt = aId,
        t = aTime;
      while (akt !== bId) {
        const kov = kovetkezoFoszolgalat(akt, dir);
        if (kov == null || (dir === 1 ? kov > bId : kov < bId)) break;
        const resz = (Math.abs(km(kov) - km(akt)) / teljes) * (bTime - aTime);
        ki(szakaszId(akt, kov), t, t + resz, dir);
        t += resz;
        akt = kov;
      }
    }

    // Foglaltsági tábla: állomásközönként a személyvonati menetek [be, ki] időpontjai.
    let tabla = null;
    function foglaltsag() {
      if (tabla) return tabla;
      tabla = {};
      const be = (id, b, k, dir) => {
        (tabla[id] ||= []).push({ be: b, ki: k, dir });
      };
      for (const service of globalThis.REAL_TIMETABLE || []) {
        const plan = makeTimetablePlan(service, 0).filter((x) => STATIONS[x.station].control);
        for (let i = 0; i < plan.length - 1; i++)
          be(szakaszId(plan[i].station, plan[i + 1].station), plan[i].dep, plan[i + 1].arr, service.dir);
      }
      for (const service of globalThis.BRANCH_TIMETABLE || []) {
        const st = (service.stops || []).filter((x) => STATIONS[x.station]?.control);
        for (let i = 0; i < st.length - 1; i++)
          szakaszokra(st[i].station, st[i].dep, st[i + 1].station, st[i + 1].arr, service.dir, be);
      }
      for (const lista of Object.values(tabla)) lista.sort((a, b) => a.be - b.be);
      return tabla;
    }

    // A legkorábbi ütközésmentes belépés egy állomásközre (null, ha nincs belátható résen belül).
    function legkorabbiBelepes(secId, mikor, futas, dir, kettos) {
      const lista = foglaltsag()[secId] || [];
      let t = mikor;
      for (let kor = 0; kor < 60; kor++) {
        const utkozes = lista.find(
          (x) => (kettos ? x.dir === dir : true) && t < x.ki + HEADWAY && x.be - HEADWAY < t + futas
        );
        if (!utkozes) return t;
        t = utkozes.ki + HEADWAY;
        if (t - mikor > MAX_VARAKOZAS) return null;
      }
      return null;
    }

    // Menetvonal keresése a vonal végéig. Visszaad egy plan-t, vagy null-t.
    function menetvonal(s, at, dir, legkorabban) {
      s.ensureBlocks();
      const plan = [];
      let akt = at,
        t = legkorabban;
      plan.push({ station: akt, arr: null, dep: t });
      while (true) {
        const kov = kovetkezoFoszolgalat(akt, dir);
        if (kov == null) break;
        const sec = s.blockSystem.section(akt, kov);
        const hossz = Math.abs(km(kov) - km(akt));
        const futas = (hossz / SZAMITASI_SEBESSEG) * 60;
        const be = legkorabbiBelepes(szakaszId(akt, kov), t, futas, dir, !!sec?.double);
        if (be == null) return plan.length > 2 ? plan : null; // ameddig eljut, addig megy
        plan.at(-1).dep = be;
        const erk = be + futas;
        // a megállóhelyeket is betesszük, hogy a rajz és a helyzetszámítás egyenletes legyen
        for (let n = akt + dir; n !== kov; n += dir) {
          const f = Math.abs(km(n) - km(akt)) / hossz;
          plan.push({ station: n, arr: be + futas * f, dep: be + futas * f });
        }
        plan.push({ station: kov, arr: erk, dep: erk + ALLOMASI_IDO });
        akt = kov;
        t = erk + ALLOMASI_IDO;
      }
      return plan.length > 1 ? plan : null;
    }

    const prevAdd = P.add;
    P.add = function (at, dir, dep) {
      const t = prevAdd.call(this, at, dir, dep);
      if (!t || t.menetrendi) return t;
      const mv = menetvonal(this, at, dir, dep);
      if (!mv) {
        // nincs szabad menetvonal: ez a teher most nem indul
        this.trains = this.trains.filter((x) => x !== t);
        return null;
      }
      t.plan = mv;
      t.dep = mv[0].dep;
      t.menetvonal = true;
      t.maxSpeed = SZAMITASI_SEBESSEG;
      t.endStation = mv.at(-1).station;
      return t;
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
