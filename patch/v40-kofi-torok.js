(() => {
  "use strict";
  // VONAL 40 · 0.31 — a KÖFI állomásrajza a pult geometriáját követi.
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
  // 0.31: az állomásdoboz a torok méretéhez igazodik. A 360 pixeles doboz két szélére
  // 72-72 pixel jutott, miközben a kelenföldi jobb torok a pulton 750 pixel széles: a
  // váltósorok ötszörösen összenyomva, majdnem függőlegesen futottak egymáson. Most a
  // doboz szélessége állomásonként a saját torkából jön (a függőleges léptékkel számolva),
  // így a váltók ugyanabban a szögben állnak, mint a pulton. A doboz belsejében minden
  // elem — jelzőgombok, vágánycímkék, vonatok — az új szélességhez igazodik.

  const KOZEP = 216, KOZ = 26, MAXTOROK = 340, MINTOROK = 44;

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

    // Meddig ér ténylegesen a torokrajz a pulton: a váltósorok és a vezérvágányak
    // legkülső pontja. A pultszél ennél jóval kintebb van (üres kifutás), azt nem
    // érdemes a dobozba tömöríteni.
    const kiterCache = {};
    function kiter(sid) {
      if (kiterCache[sid]) return kiterCache[sid];
      const { terv, stubok } = D55Terv(sid), g = geom(sid), P = D55Pult(sid);
      const o = { L: P.tx.L, R: P.tx.R };
      for (const side of ["L", "R"]) {
        const T = terv[side];
        if (!T) continue;
        const idk = ["fo", ...stubok.filter((x) => x.def.side === side).map((x) => x.def.id)];
        for (const tr of g.tracks)
          for (const id of idk) {
            const u = T.ut(id, tr);
            if (!u) continue;
            for (const q of u) o[side] = side === "L" ? Math.min(o[side], q[0]) : Math.max(o[side], q[0]);
          }
        for (const { def, st } of stubok)
          if (def.side === side && st.bazis)
            o[side] = side === "L" ? Math.min(o[side], st.bazis.x) : Math.max(o[side], st.bazis.x);
      }
      return (kiterCache[sid] = o);
    }

    // Az állomásdoboz mérete: a két torok a saját szélességét kapja, a vágányak egyenes
    // szakasza a középső 216 pixelt; magasságban a pult vágányköze a KÖFI 26 pixelesére.
    const dobozCache = {};
    function doboz(sid) {
      if (dobozCache[sid]) return dobozCache[sid];
      const P = D55Pult(sid), lepte = KOZ / pultKoz(sid), k = kiter(sid);
      const meret = (px) => Math.max(MINTOROK, Math.min(MAXTOROK, Math.round(px * lepte)));
      const bal = meret(P.tx.L - k.L), jobb = meret(k.R - P.tx.R);
      return (dobozCache[sid] = { bal, jobb, w: bal + KOZEP + jobb, kiL: k.L, kiR: k.R, lepte });
    }

    const prevLayout = globalThis.nwLayout;
    globalThis.nwLayout = function () {
      const L = prevLayout.apply(this, arguments);
      const szakasz = (sid) => {
        for (const [key, l] of Object.entries(L.links)) {
          const sec = sim.blockSystem.sections[key];
          if (sec && sec.from === sid) return l;
        }
        return null;
      };
      let tol = 0;
      for (const sid of L.ids) {
        const n = L.nodes[sid], D = doboz(sid), g = geom(sid);
        n.x += tol;
        n.w = D.w;
        n.bal = D.bal;
        n.jobb = D.jobb;
        // a vágánysorrend és a vágányköz is a pultból jön (Pusztaszabolcson az 1. alul)
        n.ty = (tr) => 400 + (g.y(tr) - g.mid) * D.lepte;
        tol += D.w - 360;
        const l = szakasz(sid);
        if (l) { l.x1 += tol; l.x2 += tol; }
      }
      L.width += tol;
      return L;
    };

    // Egy állomás koordináta-leképezése: pult → KÖFI doboz.
    function lekepez(s, n) {
      const P = D55Pult(s), g = geom(s), D = doboz(s), bal = n.bal ?? D.bal, w = n.w ?? D.w;
      const X = (px) =>
        px <= P.tx.L
          ? n.x + ((px - D.kiL) / Math.max(1, P.tx.L - D.kiL)) * bal
          : px >= P.tx.R
            ? n.x + bal + KOZEP + ((px - P.tx.R) / Math.max(1, D.kiR - P.tx.R)) * (w - bal - KOZEP)
            : n.x + bal + ((px - P.tx.L) / Math.max(1, P.tx.R - P.tx.L)) * KOZEP;
      const Y = (py) => 400 + (py - g.mid) * D.lepte;
      const ut = (pts) => "M" + pts.map((q) => X(q[0]).toFixed(1) + " " + Y(q[1]).toFixed(1)).join("L");
      return { X, Y, ut, D, bal, w };
    }

    // Egy vágány összes torokrajza: minden bejárat (fővonal és kiágazások) felé, ahonnan
    // tényleg vezet rá vágányút. Amelyik végén egyik bejárathoz sem vezet, oda ütközőbak
    // kerül: a pusztaszabolcsi II. csonka Budapest felé, ahogy a pulton is.
    function vaganyRajz(s, n, tr) {
      const { terv, stubok } = D55Terv(s), m = lekepez(s, n);
      const d = [], bak = [];
      for (const side of ["L", "R"]) {
        const T = terv[side];
        if (!T) continue;
        const kint = side === "L" ? n.x : n.x + m.w;
        let van = false;
        // fővonal
        const fo = T.ut("fo", tr);
        if (fo) {
          van = true;
          // a vonali vágány a doboz széléről fut be a bejárat bázisába
          d.push("M" + kint + " 400L" + m.ut(fo).slice(1));
        }
        // Kiágazások: csak a torokban futó részt rajzoljuk, a bázistól a vágányig. A
        // vezérvágányt a kiágazási rátét húzza ki a cimkéig — ha itt is megrajzolnánk,
        // két külön vonal mutatná ugyanazt (Kelenföldön a Keleti felé épp ez történt).
        for (const { def, st } of stubok) {
          if (def.side !== side || !st.bazis) continue;
          const u = T.ut(def.id, tr);
          if (!u) continue;
          van = true;
          d.push(m.ut(u));
        }
        if (!van) {
          const x = side === "L" ? n.x + m.bal : n.x + m.bal + KOZEP, j = side === "L" ? -1 : 1,
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

    const tolj = (el, dx) => { if (el && dx) el.setAttribute("transform", `translate(${dx.toFixed(1)} 0)`); };

    function atrajzol() {
      const svg = NW && NW.svg, L = NW && NW.layout;
      if (!svg || !L) return;
      // 1) vágányutak a torokban: a legyező helyére a pult váltósorai
      for (const el of svg.querySelectorAll("[data-nettrack]")) {
        const [sid, tr] = el.getAttribute("data-nettrack").split(":");
        const n = L.nodes[sid];
        if (!n) continue;
        const legyezo = el.previousElementSibling, cimke = el.nextElementSibling;
        const { d, bak } = vaganyRajz(Number(sid), n, tr);
        if (legyezo && legyezo.tagName === "path") legyezo.setAttribute("d", d || "M0 0");
        // a vágány egyenes szakasza a doboz közepét tölti ki
        el.setAttribute("d", `M${n.x + n.bal} ${n.ty(tr)}H${n.x + n.bal + KOZEP}`);
        if (cimke && cimke.tagName === "text") cimke.setAttribute("x", n.x + n.bal + KOZEP / 2);
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
      // 2) az állomásdoboz többi eleme az új szélességhez
      for (const sid of L.ids) {
        const n = L.nodes[sid], belso = n.bal - 72, szeles = n.w - 360;
        const fej = svg.querySelector(`[data-netstation="${sid}"]`);
        if (fej) tolj(fej, belso + KOZEP / 2 - 108);
        for (const el of svg.querySelectorAll(`[data-netpoint][data-station="${sid}"]`)) {
          const nev = el.getAttribute("data-netpoint");
          tolj(el, nev === "A" || nev === "VL" ? 0 : nev === "B" || nev === "VR" ? szeles : belso);
        }
      }
      // 3) vonatok: az állomásdoboz közepe és széle is elmozdult
      for (const el of svg.querySelectorAll("[data-nettrain]")) {
        const t = sim.trains.find((x) => String(x.id) === el.getAttribute("data-nettrain"));
        if (!t || t.phase === "line") continue;
        const p = sim.permissions[t.id];
        const n = t.phase === "parked" || t.phase === "leaving" ? L.nodes[t.at] : p && L.nodes[p.to];
        if (!n) continue;
        const kz = n.bal + KOZEP / 2;
        let regi, uj;
        if (t.phase === "parked") { regi = n.x + 180; uj = n.x + kz; }
        else if (t.phase === "leaving") {
          const f = t.progress;
          regi = n.x + 180 + t.dir * f * 180;
          uj = n.x + kz + t.dir * f * (t.dir === 1 ? n.w - kz : kz);
        } else {
          const f = t.phase === "entering" ? t.progress : 0;
          regi = t.dir === 1 ? n.x + f * 180 : n.x + 360 - f * 180;
          uj = t.dir === 1 ? n.x + f * kz : n.x + n.w - f * (n.w - kz);
        }
        tolj(el, uj - regi);
      }
      // 4) a lezárt vágányutak lámpasávja ugyanazon az úton fusson
      if (typeof globalThis.D55Ut !== "function") return;
      for (const el of svg.querySelectorAll("[data-netroute]")) {
        const kulcs = el.getAttribute("data-netroute"), r = sim.routes[kulcs];
        if (!r) continue;
        const n = L.nodes[r.at];
        if (!n) continue;
        const pts = D55Ut(r.at, r.side, r.track, r.kind);
        if (!pts || !pts.length) continue;
        const m = lekepez(r.at, n);
        // a pulton a sáv a torokrajzon túlra is kifut; a dobozban a széléig tartjuk
        const belul = pts.filter((q) => q[0] >= m.D.kiL - 1 && q[0] <= m.D.kiR + 1);
        if (belul.length > 1) el.setAttribute("d", m.ut(belul));
      }
    }

    // A kiágazási rátét (drawKofi) a doboz szélének közepéből, a vonali vágány
    // magasságából indította a kiágazást, a kétvágányúnál mindkét vágányat ugyanabból a
    // pontból. Most a pult szerinti vezérvágány-bázisból indulnak, és a két vágány végig
    // külön fut — ahogy a fővonal két vágánya.
    if (typeof globalThis.drawKofi === "function" && !globalThis.drawKofi._v40KofiTorok) {
      const prevKofi = globalThis.drawKofi;
      const w2 = function () {
        const r = prevKofi.apply(this, arguments);
        try { agakat(); } catch (e) { console.warn("KÖFI kiágazás:", e); }
        return r;
      };
      w2._v40KofiTorok = true;
      globalThis.drawKofi = w2;
    }

    function agakat() {
      const svg = NW && NW.svg, L = NW && NW.layout;
      if (!svg || !L || !globalThis.LineBranches) return;
      for (const g of svg.querySelectorAll("[data-linebranch]")) {
        const def = LineBranches.byId(g.getAttribute("data-linebranch"));
        if (!def) continue;
        const n = L.nodes[def.station];
        if (!n) continue;
        const st = (D55Terv(def.station).stubok || []).find((x) => x.def.id === def.id)?.st;
        if (!st || !st.bazis) continue;
        const utak = [...g.querySelectorAll("path")];
        if (!utak.length) continue;
        // a meglévő útvonalból vesszük a cimke felé tartó szakaszt: M{x0} 400L{x1} {yb}H{x2}
        const sz = (utak[utak.length - 1].getAttribute("d").match(/-?\d+(\.\d+)?/g) || []).map(Number);
        if (sz.length < 5) continue;
        const [, , x1, yb, x2] = sz;
        const m = lekepez(def.station, n), le = yb > 400 ? 1 : -1;
        // A kétvágányú kiágazás két vezérvágányának nem közös a bázispontja: a külső a
        // torokban kijjebb kezdődik (a két vágány ott keresztezi egymást). A bázis x-ét
        // ezért nem a kiágazás közös adatából vesszük, hanem onnan, ahol a vágányrajzok
        // tényleg kezdődnek — különben a vezérvágány a bázis előtt a levegőben indul.
        const T = D55Terv(def.station).terv[def.side], pontok = new Map();
        if (T)
          for (const tr of geom(def.station).tracks) {
            const u = T.ut(def.id, tr);
            if (!u || !u.length) continue;
            const [px, py] = u[0], volt = pontok.get(py);
            // a vágányak a vezérvágány több pontján is rácsatlakozhatnak: a vezérvágányt
            // a legbelső csatlakozástól a legkülsőig húzzuk, különben a belső lelóg
            if (!volt) pontok.set(py, { min: px, max: px });
            else { volt.min = Math.min(volt.min, px); volt.max = Math.max(volt.max, px); }
          }
        if (!pontok.size) for (const y of st.bazis.ys) pontok.set(y, { min: st.bazis.x, max: st.bazis.x });
        // A vezérvágányak ugyanabban a sorrendben kapcsolódnak a bázisokhoz, ahogy
        // egymás alatt futnak — különben a pár két vágánya rögtön a torok után
        // keresztezné egymást (a székesfehérvári ágnál ez látszott).
        const ys = [...pontok.keys()].sort((a, b) => (le === 1 ? a - b : b - a));
        utak.reverse().forEach((el, i) => {
          const y = ys[Math.min(i, ys.length - 1)];
          if (y == null) return;
          const v = pontok.get(y), belso = def.side === "R" ? v.min : v.max,
            kulso = def.side === "R" ? v.max : v.min, yy = m.Y(y).toFixed(1);
          el.setAttribute(
            "d",
            `M${m.X(belso).toFixed(1)} ${yy}H${m.X(kulso).toFixed(1)}L${x1} ${yb + i * le * KOZ}H${x2}`,
          );
        });
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
