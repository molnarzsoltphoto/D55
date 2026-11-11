(() => {
  "use strict";
  // VONAL 40 · 0.12 — előengedély-korlát.
  // Kézzel legfeljebb három egymás utáni állomásközre adható engedély egy vonatnak (ez a korábbi
  // v40-forward-v2 forwardLimit = 2 beállítása: első engedély + két további). A gép ezentúl nem ad
  // előengedélyt, csak a következő egy állomásközre — a kézzel kiadott előengedélyekhez tartozó
  // vágányutakat és jelzőket viszont a gép a maga területén továbbra is kezeli.
  function install() {
    if (typeof Simulation === "undefined") return false;
    const P = Simulation.prototype;
    if (P._v40EloEngedely) return true;
    if (typeof P.autoForward !== "function" || typeof P.aheadCandidate !== "function") return false;
    P._v40EloEngedely = true;

    const prevAutoForward = P.autoForward;
    const prevAheadCandidate = P.aheadCandidate;

    // Az automata futása alatt nincs előengedély-jelölt, így az autoForward előrekészítő ciklusa
    // azonnal kilép; a ForwardPanel kézi gombja változatlanul kap jelöltet.
    P.aheadCandidate = function (id) {
      if (this._autoForwardRunning) return null;
      return prevAheadCandidate.call(this, id);
    };

    P.autoForward = function () {
      this._autoForwardRunning = true;
      try {
        return prevAutoForward.call(this);
      } finally {
        this._autoForwardRunning = false;
      }
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
