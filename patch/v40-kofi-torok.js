(() => {
  "use strict";
  // VONAL 40 · 0.30 — a KÖFI állomásrajza a pult geometriáját követi.
  //
  // A hálózati képen (KÖFI) minden állomás ugyanazt a sematikus rajzot kapta: a vágányak
  // az állomás két végén egyetlen közös pontból legyeztek ki, a sorrendjük pedig a nyers
  // vágánylistát követte. Ezért a két nézet ellentmondott egymásnak: Pusztaszabolcson a
  // pulton az 1. vágány van alul, a KÖFI-ban felül; Kelenföldön a pult szerint a XI–XV.
  // vágányról csak a Keleti felé van kijárat, a KÖFI szerint a Déli felé is; és a közös
  // kiágazási pont éppen az, amit a pultokról leszedtünk.
  //
  // Mostantól a KÖFI ugyanabból a torokrajzból dolgozik, mint a pult: a váltósorokat, a
  // kiágazások vezérvágányait és a csonkavágányokat is onnan veszi, csak a pult széles
  // koordinátáit tömöríti az állomásdobozba. Egy geometria, két nézet — nem tudnak
  // elcsúszni egymástól.
  //
  // A tömörítés szakaszos: a két torok a doboz 72-72 pixeles szélére, a vágányok egyenes
  // szakasza a középső 216 pixelre kerül; magasságban a pult 58 pixeles vágányköze a
  // KÖFI 26 pixelesére.

  const SZEL = 72, KOZEP = 216, KOZ = 26;

  function install() {
    if (typeof sim === "undefined" || typeof globalThis.drawNetwork !== "function") return false;
    if (globalThis.drawNetwork._v40KofiTorok) return true;
    if (!globalThis.D55Terv || !globalThis.D55Pult || !globalThis.D55Oldalak) return false;
    if (typeof globalThis.nwLayout !== "function" || typeof geom !== "function") return false;

    // A pult vágányköze (függőleges lépték kiszámításához).
    const pultKoz = (s) => {
      const g = geom(s);
      if (g.tracks.length < 2) return 58;
      return Math.abs(g.y(g.tracks[1]) - g.y(g.tracks[0])) || 58;
    };

    // A KÖFI vágánymagasság a pult geometriájából: így a sorrend is a pultét követi
    // (Pusztaszabolcson az 1. vágány alul).
    const prevLayout = globalThis.nwLayout;
    globalThis.nwLayout = function () {
      const L = prevLayout.apply(this, arguments);
      for (const sid of L.ids) {
        const g = geom(sid), lepte = KOZ / pultKoz(sid);
        L.nodes[sid].ty = (tr) => 400 + (g.y(tr) - g.mid) * lepte;
      }
      return L;
    };

    // Egy állomás koordináta-leképezése: pult → KÖFI doboz.
    function lekepez(s, n) {
      const P = D55Pult(s), g = geom(s), lepte = KOZ / pultKoz(s);
      const bal = P.szel.L, jobb = P.szel.R;
      const X = (px) =>
        px <= P.tx.L
          ? n.x + ((px - bal) / Math.max(1, P.tx.L - bal)) * SZEL
          : px >= P.tx.R
            ? n.x + SZEL + KOZEP + ((px - P.tx.R) / Math.max(1, jobb - P.tx.R)) * SZEL
            : n.x + SZEL + ((px - P.tx.L) / Math.max(1, P.tx.R - P.tx.L)) * KOZEP;
      const Y = (py) => 400 + (py - g.mid) * lepte;
      const ut = (pts) => "M" + pts.map((q) => X(q[0]).toFixed(1) + " " + Y(q[1]).toFixed(1)).join("L");
      return { X, Y, ut };
    }

    // Egy vágány összes torokrajza: minden bejárat (fővonal és kiágazások) felé, ahonnan
    // tényleg vezet rá vágányút. Amelyik végén egyik bejárathoz sem vezet, oda ütközőbak
    // kerül: a pusztaszabolcsi II. csonka Budapest felé, ahogy a pulton is.
    function vaganyRajz(s, n, tr) {
      const { terv, stubok } = D55Terv(s), m = lekepez(s, n), sdk = D55Oldalak(s);
      const d = [], bak = [];
      for (const side of ["L", "R"]) {
        const T = terv[side];
        if (!T) continue;
        const kint = side === "L" ? n.x : n.x + SZEL + KOZEP + SZEL;
        let van = false;
        // fővonal
        const fo = T.ut("fo", tr);
        if (fo) {
          van = true;
          // a vonali vágány a doboz széléről fut be a bejárat bázisába
          d.push("M" + kint + " 400L" + m.ut(fo).slice(1));
        }
        // kiágazások: a vezérvágányt a pult csonkrajzából vesszük (a keletis pár így a
        // Déli vágányai alatt bukik át a KÖFI-ban is)
        for (const { def, st } of stubok) {
          if (def.side !== side || !st.bazis) continue;
          const u = T.ut(def.id, tr);
          if (!u) continue;
          van = true;
          const sor = [st.pts, st.pts2].find((q) => q && Math.abs(q[q.length - 1][1] - u[0][1]) < 1.5);
          d.push(m.ut([...(sor ? sor.slice(0, -1) : []), ...u]));
        }
        if (!van) {
          const x = side === "L" ? n.x + SZEL : n.x + SZEL + KOZEP, j = side === "L" ? -1 : 1,
            y = n.ty(tr);
          bak.push(`M${x} ${y}H${x + 8 * j}M${x + 8 * j} ${y - 7}V${y + 7}`);
        }
      }
      return { d: d.join(""), bak: bak.join("") };
    }

    const prevDraw = globalThis.drawNetwork;
    const wrapped = function () {
      const r = prevDraw.apply(this, arguments);
      try { atrajzol(); } catch (e) { console.warn("KÖFI torok:", e); }
      return r;
    };
    wrapped._v40KofiTorok = true;
    globalThis.drawNetwork = wrapped;

    function atrajzol() {
      const svg = NW && NW.svg, L = NW && NW.layout;
      if (!svg || !L) return;
      // 1) vágányutak a torokban: a legyező helyére a pult váltósorai
      for (const el of svg.querySelectorAll("[data-nettrack]")) {
        const [sid, tr] = el.getAttribute("data-nettrack").split(":");
        const n = L.nodes[sid];
        if (!n) continue;
        const legyezo = el.previousElementSibling;
        const { d, bak } = vaganyRajz(Number(sid), n, tr);
        if (legyezo && legyezo.tagName === "path") legyezo.setAttribute("d", d || "M0 0");
        if (bak) {
          const b = document.createElementNS("http://www.w3.org/2000/svg", "path");
          b.setAttribute("d", bak);
          b.setAttribute("fill", "none");
          b.setAttribute("stroke", "#8fa08a");
          b.setAttribute("stroke-width", "3");
          b.setAttribute("stroke-linecap", "round");
          el.parentNode.insertBefore(b, el.nextSibling);
        }
      }
      // 2) a lezárt vágányutak lámpasávja ugyanazon az úton fusson
      if (typeof globalThis.D55Ut !== "function") return;
      for (const el of svg.querySelectorAll("[data-netroute]")) {
        const kulcs = el.getAttribute("data-netroute"), r = sim.routes[kulcs];
        if (!r) continue;
        const n = L.nodes[r.at];
        if (!n) continue;
        const pts = D55Ut(r.at, r.side, r.track, r.kind);
        if (!pts || !pts.length) continue;
        const m = lekepez(r.at, n);
        // a pulton a sáv a panel szélén kívülre is kifut; a dobozban a széléig tartjuk
        const belul = pts.filter((q) => q[0] >= D55Pult(r.at).szel.L - 1 && q[0] <= D55Pult(r.at).szel.R + 1);
        if (belul.length > 1) el.setAttribute("d", m.ut(belul));
      }
    }

    return true;
  }

  if (!install()) {
    let tries = 0;
    const timer = setInterval(() => {
      if (install() || ++tries > 80) clearInterval(timer);
    }, 50);
  }
})();
