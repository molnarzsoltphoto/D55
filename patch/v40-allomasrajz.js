(() => {
  "use strict";
  // VONAL 40 · 0.21 — valódi vágányrajz az állomási pulton.
  //
  // A pult eddig sematikus volt: a vágányok egyenlő közű vízszintesek, a torok egy V alak.
  // Ahol a vázlatos helyszínrajzból kiolvasott rajzadat rendelkezésre áll, a pult a valódi
  // vágányhálózatot mutatja: a tényleges váltókörzetet, a vágányok tényleges magasságát és
  // sorrendjét, és a vágányutat a valódi nyomvonalán.
  //
  // Ez a blokk nem rajzol: a `geom`-ot teszi valóságossá, és közzéteszi a VALOS_PULT
  // felületet, amit a pultrajzoló (v40-ketvaganyu-sor-kiagazas) használ. Így a kiágazások,
  // a kezelésszámlálók és a kétütemű kezelés változatlanul megmarad.
  const RAJZ = globalThis.ALLOMAS_RAJZ || {};
  const szerep = (side, kind) => `${side}.${kind === "in" ? "be" : "ki"}`;

  globalThis.VALOS_PULT = {
    van: (s) => !!RAJZ[s],
    halozat: (s) => RAJZ[s]?.halozat || [],
    vagany: (s, tr) => RAJZ[s]?.vagany?.[tr] || null,
    torok: (s) => RAJZ[s]?.torok || null,
    veg: (s, side) => RAJZ[s]?.vegek?.[side + ".be"] || RAJZ[s]?.vegek?.[side + ".ki"] || null,
    // a vonali vég a szerepe szerint: a Pécs felé haladó az alsó, a Budapest felé a felső vágányon
    vegSzerep: (s, side, dir) =>
      RAJZ[s]?.vegek?.[`${side}.${(side === "L") === (dir === 1) ? "be" : "ki"}`] || null,
    ut: (s, side, track, kind) => {
      const p = RAJZ[s]?.utak?.[`${szerep(side, kind)}|${track}`];
      return p && p.length > 1 ? p : null;
    },
  };

  function install() {
    if (typeof sim === "undefined" || typeof globalThis.geom !== "function") return false;
    if (globalThis.geom._v40rajz) return true;

    const elozo = globalThis.geom;
    const uj = function (s) {
      const r = RAJZ[s];
      if (!r) return elozo(s);
      const g = elozo(s);
      const be = r.vegek["L.be"] || r.vegek["L.ki"], ki = r.vegek["R.be"] || r.vegek["R.ki"];
      const kozep = be && ki ? (be[1] + ki[1]) / 2 : g.mid;
      return {
        tracks: g.tracks,
        h: r.h,
        mid: Math.round(kozep),
        y: (tr) => (r.vagany[tr] ? r.vagany[tr].y : g.y(tr)),
      };
    };
    uj._v40rajz = true;
    globalThis.geom = uj;
    if (typeof render === "function") try { render(); } catch (e) {}
    return true;
  }

  if (!install()) {
    let tries = 0;
    const timer = setInterval(() => {
      if (install() || ++tries > 60) clearInterval(timer);
    }, 50);
  }
})();
