(() => {
  "use strict";
  // VONAL 40 · 0.28 — a vonal éjfél óta jár.
  //
  // A szolgálat 6:00-kor kezdődik, de a vasút nem ekkor ébred. Eddig a 6:00 előtti
  // forgalomból csak annyi látszott, hogy a már elindult menetek a menetrendi helyükre
  // kerültek (0.26); ami ennél korábban történt — a hajnali fordulók, a végállomásokon
  // álló szerelvények, az addig összeszedett késések — nem létezett.
  //
  // Mostantól a szimuláció éjféltől indul és magától eljátssza a szolgálat kezdetéig
  // tartó órákat, csak utána adja át a pultot. Az óra továbbra is 6:00-kor indul: a
  // játékos egy éjfél óta üzemelő vonalat vesz át, benne a végállomásokon fordulóra váró
  // szerelvényekkel és a valóban összegyűlt késésekkel.
  //
  // A bemelegítés alatt minden állomás automata (a játékos területe is), a pontszámot és
  // a naplót a végén nullázzuk: a szolgálat a 6:00-s átadással kezdődik.

  function install() {
    if (typeof Simulation === "undefined" || typeof sim === "undefined") return false;
    const P = Simulation.prototype;
    // A javítórétegek külön-külön települnek; ez a réteg csak akkor dolgozhat, ha mind
    // megvan, különben a vonal hiányos szabályokkal indulna (a kiágazási menetrend
    // például a nagy rajzoló réteghez tartozik: nélküle egyetlen ági vonat sem keletkezne).
    const KELL = [
      "_v40DoubleQueueBranches", "_v40Korlat", "_v40Elsobbseg", "_v40Forgalom",
      "_v40InduloHelyzet", "_v40Fordulo",
      "_v40Ellenirany", "_v40Elkerulo", "_v40EloEngedely", "_v40Tehermenetvonal",
    ];
    if (P._v40Bemelegites) return true;
    if (!KELL.every((j) => P[j])) return false;
    if (typeof P.realTraffic !== "function" || typeof AutomaticBlocks !== "function") return false;
    P._v40Bemelegites = true;

    // Meddig visszafelé játsszuk le a forgalmat: hat óra, vagy az aznapi éjfélig, ha az
    // közelebb van. A 6:00-s szolgálatkezdésnél — a játék alapértelmezésénél — ez pont
    // éjfél. Ennyi forgalom lejátszása 3-4 másodperc; egy egész napé tizenöt lenne.
    const HOSSZ = 360;

    function bemelegit(s) {
      const cel = s.serviceStart,
        kezd = Math.max(Math.floor(cel / 1440) * 1440, cel - HOSSZ);
      // csak érintetlen, most létrehozott szolgálatnál: betöltött játékállást nem bántunk
      if (s._v40Fut || s._v40Bemelegitve === cel || !(cel > kezd) || s.time !== cel) return;
      // A bemelegítés alatt a serviceStart a kezdőidőre áll, és a lejátszás realTraffic-et
      // hív: ez újra ide jutna, és a bemelegítés önmagát hívná egyre korábbi kezdéssel.
      s._v40Fut = true;
      s._v40Bemelegitve = cel;

      const terulet = s.playerControl, auto = s.auto, nezet = s.view;
      s.time = kezd;
      s.serviceStart = kezd;
      s.trains = [];
      s.permissions = {};
      s.edges = {};
      s.routes = {};
      s.blockSystem = new AutomaticBlocks();
      // A kiágazások foglaltságát is nullázni kell. Enélkül az előző (konstruktorbeli)
      // bemelegítés menetei bentragadtak a kiágazási szakaszokon, és mivel a vonatok
      // eltűntek, az a foglalás soha nem oldódott fel: az adott kiágazásra onnantól
      // egyetlen vonat sem kapott engedélyt, és a csatlakozó állomás vágányai egyesével
      // teltek meg a várakozó menetekkel.
      s.lineBranches = {};
      s.ttSpawned = {};
      if (s.btSpawned) s.btSpawned = {};
      s.archive = [];
      s.nextFreight = s.time + 7;
      s.nextTrafficUpdate = s.time;
      s.playerControl = { stations: [] };
      s.auto = true;
      s.view = "station";
      try {
        s.realTraffic();
        let orzo = 0;
        // 0,1 perces lépés: az automata engedélykiadás tickenként fut, nagyobb lépésnél
        // ritkábban kapnának engedélyt a vonatok, és a bemelegítés alatt késések gyűlnének
        while (s.time < cel - 1e-9 && ++orzo < 200000) s.tick(Math.min(0.1, cel - s.time));
      } catch (e) {
        console.warn("bemelegítés:", e);
      } finally {
        s._v40Fut = false;
        s.playerControl = terulet;
        s.auto = auto;
        s.view = nezet;
        s.time = cel;
        s.score = 0;
        s.logs = [];
      }
      const uton = s.trains.filter((t) => !t.finished && t.phase !== "parked").length,
        allo = s.trains.filter((t) => t.finished && t.forduloRa).length;
      s.log(
        `Szolgálatátadás: a vonal ${fmt(kezd)} óta jár. ${s.trains.length} vonat a vonalon, ` +
          `ebből ${uton} menetben, ${allo} szerelvény fordulóra vár.`,
      );
    }

    const prevReal = P.realTraffic;
    P.realTraffic = function () {
      try { bemelegit(this); } catch (e) { console.warn("bemelegítés:", e); }
      return prevReal.call(this);
    };

    try { bemelegit(sim); } catch (e) { console.warn("bemelegítés:", e); }
    return true;
  }

  if (!install()) {
    let tries = 0;
    const timer = setInterval(() => {
      if (install() || ++tries > 60) clearInterval(timer);
    }, 50);
  }
})();
