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
  // számított menetvonal. A számítás 70 km/h-val dolgozik a vonat 80 km/h-s sebessége mellett, így a
  // vonat legfeljebb korábban hagyja el a szakaszt, mint a menetvonala – ütközést nem okoz. Korábban
  // 60-nal számolt: az indokolatlanul hosszú szakaszfoglalás miatt a 48 tervezett menetből 14-nek nem
  // volt hova illeszkednie, és a megtalált menetvonalak is szűkebb résbe kerültek.
  const HEADWAY = 3; // perc elő- és utóidő a személyvonati menetek körül
  const MAX_VARAKOZAS = 35; // perc: ennél többet egy állomáson nem várakoztatunk
  const SZAMITASI_SEBESSEG = 70; // km/h: a menetvonal ezzel készül, a vonat 80-nal mehet
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

    // Menetvonal keresése a célállomásig (cel nélkül a vonal végéig). Plan-t ad, vagy null-t.
    function menetvonal(s, at, dir, legkorabban, cel) {
      s.ensureBlocks();
      const plan = [];
      let akt = at,
        t = legkorabban;
      plan.push({ station: akt, arr: null, dep: t });
      while (true) {
        if (cel != null && akt === cel) break;
        const kov = kovetkezoFoszolgalat(akt, dir);
        if (kov == null) break;
        if (cel != null && (dir === 1 ? kov > cel : kov < cel)) break;
        const sec = s.blockSystem.section(akt, kov);
        const hossz = Math.abs(km(kov) - km(akt));
        const futas = (hossz / SZAMITASI_SEBESSEG) * 60;
        const be = legkorabbiBelepes(szakaszId(akt, kov), t, futas, dir, !!sec?.double);
        // célállomásig muszáj eljutnia; cél nélkül ameddig eljut, addig megy
        if (be == null) return cel != null ? null : plan.length > 2 ? plan : null;
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
      return plan.length > 1 || cel === at ? plan : null;
    }

    // A cél nem mindig forgalmi szolgálati hely (a Dunai Finomító nem az): a menetvonal a
    // legközelebbi szolgálati helyig készül, onnan a maradék megállóhelyeket menetidővel
    // fűzzük hozzá.
    function menetvonalIg(s, at, dir, legkorabban, cel) {
      let utolso = cel;
      while (utolso !== at && !STATIONS[utolso].control) utolso -= dir;
      const plan = menetvonal(s, at, dir, legkorabban, utolso);
      if (!plan || utolso === cel) return plan;
      const veg = plan.at(-1);
      veg.dep = veg.arr; // a szolgálati helyen nem áll meg, továbbmegy a célig
      for (let n = utolso + dir; ; n += dir) {
        const t = veg.arr + (Math.abs(km(n) - km(utolso)) / SZAMITASI_SEBESSEG) * 60;
        plan.push({ station: n, arr: t, dep: n === cel ? t : t });
        if (n === cel) break;
      }
      return plan;
    }

    // ── Viszonylatok ────────────────────────────────────────────────────────────
    // A teher eddig a vonal végpontjain keletkezett véletlenszerűen, és végigment a
    // vonalon. A valóságban csak néhány viszonylatban jár, a Keleti (Ferencváros felőli)
    // ág és négy célpont között, oda-vissza.
    const KELETI = "kelenfold-keleti";
    const VISZONYLAT = [
      { nev: "Győr", ag: "kelenfold-gyor" },
      { nev: "Dunaújváros", ag: "pszabolcs-dunaujvaros" },
      { nev: "Dunai Finomító", allomas: 11 },
      { nev: "Kaposvár", ag: "dombovar-kaposvar" },
    ];
    const NAPI = 6; // viszonylatonként és irányonként ennyi menet naponta

    // A megtervezett tehermenetvonalat is beírjuk a foglaltsági táblába, hogy a következő
    // teher már ehhez is rést keressen, ne csak a személyforgalomhoz.
    function rogzit(plan, dir) {
      const t = foglaltsag(),
        k = plan.filter((x) => STATIONS[x.station].control);
      for (let i = 0; i < k.length - 1; i++)
        (t[szakaszId(k[i].station, k[i + 1].station)] ||= []).push({ be: k[i].dep, ki: k[i + 1].arr, dir });
    }

    function viszonylatiSzolgalatok(s) {
      const LBr = globalThis.LineBranches;
      const ki = [];
      for (let i = 0; i < VISZONYLAT.length; i++) {
        const r = VISZONYLAT[i],
          cel = r.allomas != null ? r.allomas : LBr?.byId?.(r.ag)?.station;
        if (cel == null) continue;
        for (const vissza of [false, true]) {
          const honnan = vissza ? cel : 1,
            hova = vissza ? 1 : cel,
            dir = honnan === hova ? (vissza ? -1 : 1) : hova > honnan ? 1 : -1;
          for (let k = 0; k < NAPI; k++) {
            // nyers indulási idő, viszonylatonként eltolva; innen keresünk szabad menetvonalat
            const nyers = (i * 41 + (vissza ? 137 : 0) + k * Math.round(1440 / NAPI)) % 1440;
            let plan = null;
            for (let csuszas = 0; csuszas <= 240 && !plan; csuszas += 5) {
              const t0 = (nyers + csuszas) % 1440;
              plan =
                honnan === hova
                  ? [{ station: honnan, arr: t0, dep: t0 + ALLOMASI_IDO }]
                  : menetvonalIg(s, honnan, dir, t0, hova);
            }
            if (!plan) continue;
            if (honnan !== hova) rogzit(plan, dir);
            const szam = String(80000 + i * 100 + (vissza ? 50 : 0) + k);
            ki.push({
              id: "F" + szam,
              number: szam,
              from: vissza ? r.ag || null : KELETI,
              to: vissza ? KELETI : r.ag || null,
              stops: plan.map((x) => ({
                station: x.station,
                arr: Math.round(x.arr ?? x.dep),
                dep: Math.round(x.dep),
              })),
              dir,
              lines: [],
              freight: true,
            });
          }
        }
      }
      return ki;
    }

    // A véletlen teherindítás helyére a viszonylati menetrend lép: a motor saját
    // teherindítóját kikapcsoljuk (nextFreight = Infinity), a meneteket a kiágazási
    // menetrendbe tesszük, onnan a branchTraffic indítja őket.
    const prevReal = P.realTraffic;
    P.realTraffic = function () {
      const lista = (globalThis.BRANCH_TIMETABLE ||= []);
      if (!lista.some((x) => x.freight)) {
        try { lista.push(...viszonylatiSzolgalatok(this)); } catch (e) { console.warn("teherviszonylat:", e); }
      }
      this.nextFreight = Infinity;
      // A viszonylati tehermenetek a kiágazási menetrenden át keletkeznek, és eddig hiányzott
      // róluk a menetvonal-jelzés (azt csak a véletlen teher kapta meg). Az elsőbbségi rend
      // emiatt félreállította őket minden állomáson a következő személyvonat elől, pedig a
      // menetvonaluk eleve annak a résébe illeszkedik.
      for (const t of this.trains)
        if (t.branchService && t.kind === "freight" && !t.menetvonal && (t.plan || []).length > 1) t.menetvonal = true;
      return prevReal.call(this);
    };

    // A viszonylati tehermenetek a kiágazási menetrenden át keletkeznek (branchTraffic), és
    // eddig hiányzott róluk a menetvonal-jelzés. Az elsőbbségi rend emiatt úgy kezelte őket,
    // mint a véletlen tehervonatot: minden állomáson 12 percre előre megvárakoztatta őket a
    // következő személyvonat miatt, állomásonként negyedórát gyűjtve. Pedig a menetvonaluk
    // eleve a személyforgalom résébe illeszkedik — azt tartani kell, nem félreállni előle.
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
