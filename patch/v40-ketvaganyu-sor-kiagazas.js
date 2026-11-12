(() => {
  "use strict";
  // VONAL 40 · 0.9 — kétvágányú állomási pult, sorrendtartó engedélyezés, kiágazások.
  // Ugyanaz a patch-minta, mint a korábbi v40-* blokkok: a már betöltött motorra és felületre épül.

  function install() {
    if (typeof Simulation === "undefined" || typeof sim === "undefined" || typeof render !== "function" || typeof drawStation !== "function") {
      return setTimeout(install, 50);
    }
    const P = Simulation.prototype;
    if (P._v40DoubleQueueBranches) return;
    P._v40DoubleQueueBranches = true;

    // ───────────────────────────────────────────────────────────────────
    // 1) SORRENDTARTÓ ENGEDÉLYEZÉS — engedély már lefoglalt vagy foglalt fogadóvágányra is.
    //    Minden engedély sorszámot kap; a bejárati jelző csak akkor állítható Szabadra,
    //    ha a vágányon álló és a kisebb sorszámú engedélyek már elhagyták a vágányt.
    // ───────────────────────────────────────────────────────────────────
    const prevBusy = P.busy,
      prevGrant = P.grant,
      prevGrantAhead = P.grantAhead,
      prevClear = P.clearSignal,
      prevDescribe = P.describeRoute,
      prevThroat = P.throatLocked,
      prevTick = P.tick,
      prevNext = P.next,
      prevRequest = P.request;

    const permissionsOf = (s, id) => (typeof s.permissionList === "function" ? s.permissionList(id) : [s.permissions[id]].filter(Boolean));

    P.nextSeq = function () {
      this.permissionSerial = (this.permissionSerial || 0) + 1;
      return this.permissionSerial;
    };

    // Kik vannak a vágányon vagy a sorban az adott vonat előtt (fizikai foglaltság + kisebb sorszámú engedély).
    P.queueAhead = function (station, track, id) {
      const mine = permissionsOf(this, id).find((p) => p.to === station && p.track === track),
        mySeq = mine?.seq ?? Infinity,
        ahead = [];
      for (const t of this.trains) {
        if (t.id === id) continue;
        // a végállomásra ért (finished) szerelvény is a vágányon áll, amíg az archívumba nem kerül
        if (t.at === station && t.track === track && ["parked", "leaving"].includes(t.phase)) {
          ahead.push({ id: t.id, why: t.finished ? "végállomási szerelvény a vágányon" : "a vágányon áll" });
          continue;
        }
        if (t.finished) continue;
        for (const p of permissionsOf(this, t.id))
          if (p.to === station && p.track === track && (p.seq ?? 0) < mySeq) {
            ahead.push({ id: t.id, why: "előbb kapott engedélyt" });
            break;
          }
      }
      for (const b of Object.values(this.lineBranches || {}))
        if (b.station === station && b.reserved?.track === track && b.reserved.id !== id) ahead.push({ id: b.reserved.id, why: "kiágazási foglalás" });
      return ahead;
    };
    P.queueBlocker = function (station, track, id) {
      return this.queueAhead(station, track, id)[0] || null;
    };

    P.busy = function (station, track, except) {
      if (this._queueGrant) return false; // a sorrendet külön ellenőrizzük
      const lb = Object.values(this.lineBranches || {}).some((b) => b.station === station && b.reserved?.track === track && b.reserved.id !== except);
      return lb || prevBusy.call(this, station, track, except);
    };

    P.grant = function (id, track) {
      const manual = !!track && track !== "__through__";
      const train = this.trains.find((t) => t.id === id),
        to = train && this.next(train);
      this._queueGrant = manual;
      let r;
      try {
        r = prevGrant.call(this, id, manual ? track : undefined);
      } finally {
        this._queueGrant = false;
      }
      if (r?.ok && this.permissions[id] && this.permissions[id].seq == null) {
        this.permissions[id].seq = this.nextSeq();
        const ahead = to != null ? this.queueAhead(to, this.permissions[id].track, id) : [];
        if (ahead.length)
          this.log(`${id}: a(z) ${this.permissions[id].track}. vágányra sorban, előtte: ${ahead.map((a) => a.id).join(", ")}. Bejárat csak utánuk.`);
      }
      return r;
    };

    if (typeof prevGrantAhead === "function")
      P.grantAhead = function (id, track) {
        const manual = !!track && track !== "__through__";
        this._queueGrant = manual;
        let r;
        try {
          r = prevGrantAhead.call(this, id, manual ? track : undefined);
        } finally {
          this._queueGrant = false;
        }
        if (r?.ok) {
          const last = this.forwardPermissions?.[id]?.at(-1);
          if (last && last.seq == null) last.seq = this.nextSeq();
          if (this.permissions[id] && this.permissions[id].seq == null) this.permissions[id].seq = this.nextSeq();
        }
        return r;
      };

    P.describeRoute = function (station, start, goal) {
      const r = prevDescribe.call(this, station, start, goal);
      if (!r || r.kind !== "in") return r;
      let best = null,
        bestSeq = Infinity;
      for (const t of this.trains) {
        if (t.finished || t.branchManaged || t.lineBranch || t.dir !== r.dir) continue;
        for (const p of permissionsOf(this, t.id))
          if (p.to === station && p.track === r.track && (p.seq ?? 0) < bestSeq) {
            bestSeq = p.seq ?? 0;
            best = t;
          }
      }
      if (best) r.train = best.id;
      return r;
    };

    // Meglévő hiba javítása (automata állomások): a gép a bejárati jelzőhöz az előreengedélyek alapján a távolabbi, később
    // érkező vonatnak is lezárta a vágányutat, így a jelző előtt álló elöl haladó vonat nem kaphatott bejáratot → teljes torlódás.
    // Bejárati vágányút ezért csak a sorban első (a jelzőhöz legközelebbi) vonatnak állítható.
    const PHASE_RANK = { hold: 0, entering: 0, approach: 1, line: 2, leaving: 3, parked: 4 };
    P.entryLeader = function (station, dir) {
      let best = null, bestKey = null;
      for (const t of this.trains) {
        if (t.finished || t.lineBranch || t.branchManaged || t.dir !== dir) continue;
        const p = this.permissions[t.id];
        if (!p || p.to !== station) continue;
        // elöl az, aki már a jelzőnél áll; a nyílt vonalon a szakaszban megtett út (distance) dönt, nem az engedély sorszáma
        const key = [PHASE_RANK[t.phase] ?? 5, -(t.phase === "line" ? t.distance || 0 : 0), t.lineStart ?? p.seq ?? 0];
        if (!bestKey || key[0] < bestKey[0] || (key[0] === bestKey[0] && (key[1] < bestKey[1] || (key[1] === bestKey[1] && key[2] < bestKey[2])))) { best = t.id; bestKey = key; }
      }
      return best;
    };
    // Kétvágányú állomásvég: a két vonali vágány saját váltóval csatlakozik, ezért a bejárat (egyik vonali vágány) és a kijárat
    // (másik vonali vágány) egyszerre is beállítható, ha egyik sem megy át az átmenő kitérőn. Ugyanazt a vonali vágányt
    // vagy a kitérőt érintő vágányutak továbbra is kizárják egymást.
    function sideUse(station, side, track, kind) {
      const sd = lineSides(station)[side];
      if (!sd.double) return null;
      const g = geom(station), nat = naturalLane(sd, g.y(track), g.mid),
        ln = sd.lanes.find((l) => l.y === (kind === "in" ? sd.in : sd.out)) || sd.lanes[0];
      return { lane: ln.lane, cross: !nat || nat.lane !== ln.lane };
    }
    // A vágányút-geometria a többi modul számára is kell (fogadóvágány-választás), ezért kiajánljuk.
    globalThis.LBgeom = { sideUse, naturalLane, lineSides, geom };

    const prevSetRoute = P.setRoute;
    P.setRoute = function (station, start, goal) {
      const d = this.describeRoute(station, start, goal);
      if (d?.train && !playerOwns(this, station)) {
        const dt = this.trains.find((t) => t.id === d.train);
        // kijárati vágányút csak az állomáson álló vonatnak: az előre lezárt kijárat az egész állomásvéget megfogta, ebből lett a torlódás
        if (d.kind === "out" && dt && !(dt.at === station && dt.phase === "parked")) return { ok: false, msg: `${d.train}: még nincs az állomáson, a kijárati vágányút később állítható.` };
        if (d.kind === "in") {
          // csak annak, akinek az érvényes (nem előre kért) engedélye ide szól, és közülük is a legközelebbinek
          // még az előző állomáson álló vonatnak sem (addig egy áthaladó vonat megelőzheti)
          if (dt && dt.phase === "parked") return { ok: false, msg: `${d.train}: még nem indult el, bejárati vágányút az indulása után állítható.` };
          if (this.permissions[d.train]?.to !== station) return { ok: false, msg: `${d.train}: még nem ehhez az állomáshoz közelít, bejárati vágányút később állítható.` };
          const lead = this.entryLeader(station, d.dir);
          if (lead && lead !== d.train) return { ok: false, msg: `Sorrend: előbb ${lead} érkezik ${STATIONS[station].name} állomásra.` };
        }
      }
      this._routeCtx = d ? { station, side: d.side, track: d.track, kind: d.kind } : null;
      try {
        return prevSetRoute.call(this, station, start, goal);
      } finally {
        this._routeCtx = null;
      }
    };

    P.clearSignal = function (station, signal) {
      const route = this.getRoute(station, signal);
      if (route?.kind === "in" && route.train) {
        const blocker = this.queueBlocker(station, route.track, route.train);
        if (blocker)
          return {
            ok: false,
            msg: `A ${route.track}. vágányt még ${blocker.id} használja (${blocker.why}). Sorrend szerint előbb ő, utána ${route.train}.`,
          };
        this._queueGrant = true;
        try {
          return prevClear.call(this, station, signal);
        } finally {
          this._queueGrant = false;
        }
      }
      return prevClear.call(this, station, signal);
    };

    // ───────────────────────────────────────────────────────────────────
    // 2) KIÁGAZÁSOK — a csatlakozó állomástól egy modellezett állomásköz a kiágazó vonalon.
    //    A kiágazás oldala (L = Budapest felőli, R = Pécs felőli állomásvég; vert: up = felül, down = alul) játékparaméter,
    //    nem ellenőrzött ÁVU-adat; a listában módosítható.
    // ───────────────────────────────────────────────────────────────────
    const LINE_BRANCHES = [
      // double: irányonként külön vágány (egyszerre egy be- és egy kimenő vonat lehet a szakaszon); ownThroat: saját bejárati vágányok, nem zárja a fővonali állomásvéget
      { id: "kelenfold-keleti", station: 1, side: "L", name: "Budapest-Keleti felé", double: true, ownThroat: true, travel: 3,
        // Kelenföldön a Keleti felé csak a 7–15. vágányról vezet vágányút
        tracks: ["VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV"] },
      { id: "kelenfold-szfvar", station: 1, side: "R", vert: "up", name: "Székesfehérvár felé (30a, Érd alsón át)", double: true, ownThroat: true, travel: 3 },
      { id: "kelenfold-gyor", station: 1, side: "R", vert: "down", name: "Győr felé", double: true, ownThroat: true, travel: 3 },
      // a 30a Érd felsőt érintő vonatai itt hagyják el a modellt (Tárnok felé), saját váltókörzettel
      { id: "erdfelso-szfvar", station: 8, side: "R", vert: "down", name: "Székesfehérvár felé", double: true, ownThroat: true, travel: 3 },
      { id: "pszabolcs-dunaujvaros", station: 14, side: "R", vert: "up", name: "Dunaújváros felé" },
      { id: "pszabolcs-szfvar", station: 14, side: "R", vert: "down", name: "Székesfehérvár felé (Börgöndön át)" },
      { id: "sarbogard-szfvar", station: 18, side: "L", vert: "down", name: "Székesfehérvár felé" },
      { id: "retszilas-dunaujvaros", station: 19, side: "L", name: "Dunaújváros felé" },
      { id: "retszilas-szekszard", station: 19, side: "R", name: "Baja felé (Szekszárd, Bátaszék)" },
      { id: "dombovar-bataszek", station: 33, side: "R", vert: "up", name: "Bátaszék felé" },
      { id: "dombovar-kaposvar", station: 33, side: "R", vert: "down", name: "Kaposvár felé" },
      { id: "godisa-komlo", station: 37, side: "R", vert: "up", name: "Komló felé" },
      { id: "szentlorinc-szigetvar", station: 43, side: "L", vert: "down", name: "Szigetvár felé" },
      { id: "szentlorinc-sellye", station: 43, side: "R", vert: "down", name: "Sellye felé" },
    ];
    const TRAVEL = 5, // perc a modellezett szakasz vége és a kiágazási modelljelző között (játékparaméter)
      THROAT = 1; // perc a be-/kijárat

    Object.assign(phases, {
      branchRequest: "Kiágazásról engedélyt kér",
      branchLineIn: "Kiágazási szakaszon közelít",
      branchHold: "Kiágazási modelljelző előtt",
      branchEntering: "Kiágazási bejáraton",
      branchReady: "Kiágazási kijáratra vár",
      branchLeaving: "Kiágazási kijáraton",
      branchLineOut: "Kiágazási szakaszon távolodik",
      branchOutside: "A modellezett szakaszon kívül",
    });

    const LB = (window.LineBranches = {
      list: LINE_BRANCHES,
      byId: (id) => LINE_BRANCHES.find((b) => b.id === id),
      at: (station) => LINE_BRANCHES.filter((b) => b.station === station),
      travel: (def) => def?.travel ?? TRAVEL,
      edgeKey: (def, direction) => (def.double ? (direction === "in" ? "edgeIn" : "edgeOut") : "edge"),
      holds: (b, id) => b.edge === id || b.edgeIn === id || b.edgeOut === id,
      release(b, id) { for (const k of ["edge", "edgeIn", "edgeOut"]) if (b[k] === id) b[k] = null; },
      occupants: (b) => [b.edge, b.edgeIn, b.edgeOut].filter(Boolean),
      state(s, id) {
        s.lineBranches ||= {};
        const def = this.byId(id);
        return (s.lineBranches[id] ||= { station: def.station, side: def.side, edge: null, reserved: null, route: null });
      },
      train: (s, id) => s.trains.find((t) => t.id === id && t.lineBranch),
      trainsAt: (s, station) => s.trains.filter((t) => t.lineBranch && !t.finished && t.at === station),
      create(s, branchId, incoming, track) {
        const def = this.byId(branchId);
        if (!def) return { ok: false, msg: "Ismeretlen kiágazás." };
        if (s.trains.filter((t) => t.lineBranch && !t.finished).length >= 12) return { ok: false, msg: "Legfeljebb 12 kiágazási kézi menet lehet aktív." };
        const hasznalhato = def.tracks
          ? STATIONS[def.station].tracks.filter((x) => def.tracks.includes(x))
          : STATIONS[def.station].tracks;
        track = track && track !== "__through__" && hasznalhato.includes(track)
          ? track
          : hasznalhato.find((x) => !s.closed[`${def.station}:${x}`] && !s.busy(def.station, x));
        if (!track)
          return { ok: false, msg: `${STATIONS[def.station].name}: nincs szabad fogadóvágány${def.tracks ? " a " + def.tracks[0] + "–" + def.tracks[def.tracks.length - 1] + ". vágányok közt" : ""}.` };
        if (s.closed[`${def.station}:${track}`]) return { ok: false, msg: "A választott vágány lezárva." };
        s.lineBranchSerial = (s.lineBranchSerial || 0) + 1;
        const id = "KIAG-" + String(s.lineBranchSerial).padStart(3, "0");
        s.trains.push({
          id,
          at: def.station,
          dir: def.side === "L" ? 1 : -1,
          track,
          dep: s.time,
          phase: incoming ? "branchRequest" : "parked",
          delay: 0,
          finished: false,
          history: incoming ? [] : [{ station: def.station, arr: s.time }],
          plan: [{ station: def.station, arr: null, dep: s.time }],
          lineBranch: { id: branchId, direction: incoming ? "in" : "out" },
          kind: "freight",
          menetrendi: false,
          maxSpeed: 80,
          freightRoute: true, // a V3 tehergenerátor ne alakítsa fővonali menetté
          originStation: def.station,
        });
        s.log(`${id}: kézi tehermenet ${incoming ? def.name.replace(" felé", " felől") : def.name}; nem valós menetrendi vonat.`);
        return { ok: true, id };
      },
      // Fővonali, nem menetrendi, álló vonat átadása kiágazásra.
      toBranch(s, trainId, branchId) {
        const def = this.byId(branchId),
          t = s.trains.find((x) => x.id === trainId);
        if (!def || !t) return { ok: false, msg: "Nincs ilyen vonat vagy kiágazás." };
        if (t.menetrendi) return { ok: false, msg: "Menetrendi személyvonat nem terelhető kiágazásra." };
        if (t.lineBranch || t.branchManaged) return { ok: false, msg: "A menet már kiágazási kezelésben van." };
        if (t.at !== def.station || t.phase !== "parked") return { ok: false, msg: "Csak az állomáson álló menet adható át." };
        if (s.permissions[t.id] || permissionsOf(s, t.id).length || Object.values(s.routes).some((r) => r.train === t.id))
          return { ok: false, msg: "Előbb vond vissza az engedélyt és oldd a vágányutakat." };
        t.lineBranch = { id: branchId, direction: "out" };
        t.finished = false;
        delete t.finishedAt;
        t.freightRoute = true;
        t.originStation = t.at;
        t.endStation = undefined;
        t.passStations = [];
        t.plan = [{ station: t.at, arr: t.history?.at(-1)?.arr ?? null, dep: s.time }];
        t.dep = s.time;
        s.log(`${t.id}: átadva a kiágazásra (${def.name}).`);
        return { ok: true };
      },
      assign(s, trainId, branchId) {
        const t = this.train(s, trainId),
          def = this.byId(branchId);
        if (!t || !def || t.phase !== "parked") return { ok: false, msg: "Csak álló kiágazási menetnek választható irány." };
        if (def.station !== t.at) return { ok: false, msg: "A kiágazás nem ezen az állomáson van." };
        t.lineBranch = { id: branchId, direction: "out" };
        return { ok: true };
      },
      grant(s, id, branchId) {
        const t = this.train(s, id);
        if (!t || t.finished) return { ok: false, msg: "Nincs aktív kiágazási menet." };
        if (branchId && t.phase === "parked") {
          const a = this.assign(s, id, branchId);
          if (!a.ok) return a;
        }
        const def = this.byId(t.lineBranch.id);
        if (!def) return { ok: false, msg: "A menetnek még nincs kiválasztott kiágazása." };
        const b = this.state(s, def.id), ek = this.edgeKey(def, t.lineBranch.direction);
        if (b[ek]) return { ok: false, msg: `${def.name}: a kiágazási szakasz foglalt vagy lefoglalt (${b[ek]}).` };
        if ((t.lineBranch.direction === "in" && t.phase !== "branchRequest") || (t.lineBranch.direction === "out" && t.phase !== "parked"))
          return { ok: false, msg: "Ebben az állapotban nem engedélyezhető." };
        if (t.lineBranch.direction === "in") {
          if (b.reserved && b.reserved.id !== id) return { ok: false, msg: `${def.name}: másik érkező vonat fogadása folyamatban.` };
          // Az ághoz tartozó vágánylista (pl. Kelenföldön a Keleti felé csak 7–15):
          // ha a vonat máshol áll, át kell tenni, nem elutasítani — különben beragad.
          const jo = (tr) => !def.tracks || def.tracks.includes(tr);
          const rossz = !jo(t.track) || s.closed[`${def.station}:${t.track}`] || s.busy(def.station, t.track, id);
          if (rossz) {
            const alt = STATIONS[def.station].tracks.find(
              (tr) => jo(tr) && !s.closed[`${def.station}:${tr}`] && !s.busy(def.station, tr, id)
            );
            if (!alt)
              return { ok: false, msg: jo(t.track)
                ? `${STATIONS[def.station].name}, ${t.track}. vágány foglalt vagy lezárt.`
                : `${def.name}: csak a ${def.tracks[0]}–${def.tracks[def.tracks.length - 1]}. vágányról vezet vágányút, és ott nincs szabad vágány.` };
            t.track = alt;
          }
          b.reserved = { id, track: t.track };
        }
        b[ek] = id;
        t.branchPermission = true;
        if (t.lineBranch.direction === "in") {
          t.phase = "branchLineIn";
          t.branchSince = s.time;
        } else t.phase = "branchReady";
        s.log(`${id}: kiágazási engedély (${def.name}).`);
        return { ok: true };
      },
      route(s, id) {
        const t = this.train(s, id);
        if (!t || !t.branchPermission) return { ok: false, msg: "Előbb kiágazási engedély kell." };
        const def = this.byId(t.lineBranch.id),
          b = this.state(s, def.id);
        if (!this.holds(b, id)) return { ok: false, msg: "A szakaszt másik menet foglalja." };
        if (b.route) return { ok: false, msg: "Ezen a kiágazáson már van lezárt vágányút." };
        // az állomásvég kizárása csak a kézzel kezelt állomáson él; automata állomáson a gép a fővonali bejárati vágányutat
        // jóval a vonat érkezése előtt lezárja, ami a kiágazási vonatokat feleslegesen negyedórákra megfogná
        const exclusive = !def.ownThroat && playerOwns(s, def.station);
        if (exclusive && (prevThroat.call(s, def.station, def.side) || Object.entries(s.lineBranches).some(([k, x]) => x !== b && !this.byId(k)?.ownThroat && x.station === def.station && x.route?.side === def.side)))
          return { ok: false, msg: "Az állomásvég másik vágányút miatt lezárt." };
        if (!["branchLineIn", "branchHold", "branchReady"].includes(t.phase)) return { ok: false, msg: "A menet állapota nem megfelelő." };
        b.route = { id, track: t.track, kind: t.lineBranch.direction, side: def.side, own: !exclusive, clear: false, everCleared: false, releaseAt: null };
        s.switches[`${def.station}:${def.side}`] = t.track;
        s.log(`${STATIONS[def.station].name}: kiágazási vágányút ${def.name}, ${t.track}. vágány, első lezárás.`);
        return { ok: true };
      },
      clear(s, branchId) {
        const b = this.state(s, branchId),
          r = b.route,
          t = r && this.train(s, r.id);
        if (!r || !t) return { ok: false, msg: "Nincs kiágazási vágányút." };
        if (r.releaseAt) return { ok: false, msg: "Időzített oldás folyamatban." };
        if (["branchEntering", "branchLeaving", "branchLineOut"].includes(t.phase)) return { ok: false, msg: "A menet már meghaladta a modelljelzőt." };
        if (r.kind === "in") {
          const blocker = s.queueBlocker(b.station, r.track, t.id);
          if (blocker) return { ok: false, msg: `A ${r.track}. vágányt még ${blocker.id} használja (${blocker.why}).` };
        }
        r.clear = true;
        r.everCleared = true;
        return { ok: true };
      },
      stop(s, branchId) {
        const r = this.state(s, branchId).route;
        if (!r) return { ok: false, msg: "Nincs kiágazási vágányút." };
        r.clear = false;
        return { ok: true };
      },
      cancel(s, branchId) {
        const b = this.state(s, branchId),
          r = b.route,
          t = r && this.train(s, r.id);
        if (!r) return { ok: false, msg: "Nincs törölhető kiágazási vágányút." };
        if (["branchEntering", "branchLeaving"].includes(t?.phase)) return { ok: false, msg: "Menet közben oldás tiltott." };
        if (r.clear) return { ok: false, msg: "Előbb Megállj-kezelés kell." };
        if (r.everCleared) r.releaseAt = s.time + 3;
        else b.route = null;
        return { ok: true };
      },
      handoff(s, id, dir) {
        const t = this.train(s, id);
        if (!t || t.phase !== "parked") return { ok: false, msg: "Csak álló menet adható át a fővonalra." };
        if (Object.values(s.lineBranches || {}).some((b) => b.route?.id === id || this.holds(b, id))) return { ok: false, msg: "Előbb oldd a kiágazási vágányutat / engedélyt." };
        delete t.lineBranch;
        t.branchPermission = false;
        t.dir = dir;
        t.dep = s.time + 1;
        t.freightRoute = false;
        t.plan = [{ station: t.at, arr: s.time, dep: t.dep }];
        let tm = t.dep,
          prev = t.at;
        for (let n = t.at + dir; n >= 0 && n < STATIONS.length; n += dir) {
          tm += (Math.abs(STATIONS[n].km - STATIONS[prev].km) / 80) * 60;
          const arr = tm;
          tm += STATIONS[n].control ? 2 : 0.5;
          t.plan.push({ station: n, arr, dep: tm });
          prev = n;
        }
        if (window.FreightRoutesV3?.migrate) window.FreightRoutesV3.migrate(s); // V3 célállomást ad neki
        s.log(`${id}: átadva a fővonalra, ${dir === 1 ? "Pécs" : "Budapest"} felé.`);
        return { ok: true };
      },
      advance(s) {
        for (const b of Object.values(s.lineBranches || {})) if (b.route?.releaseAt && s.time >= b.route.releaseAt) b.route = null;
        for (const t of s.trains) {
          if (!t.lineBranch || t.finished) continue;
          const def = this.byId(t.lineBranch.id);
          if (!def) continue;
          const b = this.state(s, def.id),
            elapsed = s.time - (t.branchSince ?? s.time),
            travel = this.travel(def),
            r = b.route?.id === t.id ? b.route : null;
          if (t.phase === "branchLineIn" && elapsed >= travel) t.phase = "branchHold";
          if (t.phase === "branchHold" && r?.clear) {
            t.phase = "branchEntering";
            t.branchSince = s.time;
            r.clear = false;
          } else if (t.phase === "branchEntering" && elapsed >= THROAT) {
            t.phase = "parked";
            t.history.push({ station: def.station, arr: s.time });
            t.branchPermission = false;
            t.lineBranch = { id: null, direction: "out", from: def.id };
            this.release(b, t.id);
            b.reserved = null;
            b.route = null;
            s.log(`${t.id}: beért ${STATIONS[def.station].name} állomásra (${def.name.replace(" felé", " felől")}), ${t.track}. vágány.`);
          } else if (t.phase === "branchReady" && r?.clear) {
            t.phase = "branchLeaving";
            t.branchSince = s.time;
            r.clear = false;
          } else if (t.phase === "branchLeaving" && elapsed >= THROAT) {
            t.phase = "branchLineOut";
            t.branchSince = s.time;
            b.route = null;
          } else if (t.phase === "branchLineOut" && elapsed >= travel) {
            t.phase = "branchOutside";
            t.finished = true;
            t.finishedAt = s.time;
            t.branchPermission = false;
            this.release(b, t.id);
            s.log(`${t.id}: elhagyta a modellezett szakaszt (${def.name}).`);
          }
        }
      },
      // Nem kézi területen a gép kezeli a kiágazási meneteket is.
      autoHandle(s) {
        if (!s.auto) return;
        for (const t of s.trains) {
          if (!t.lineBranch?.id || t.finished || playerOwns(s, t.at)) continue;
          const b = this.state(s, t.lineBranch.id), out = t.lineBranch.direction === "out";
          if (t.phase === "branchRequest" || (t.phase === "parked" && out && s.time >= (t.dep ?? 0) - 0.5)) this.grant(s, t.id);
          // bejáratnál a vágányút csak a modelljelző előtt, kijáratnál indulásra készen
          if (t.branchPermission && this.holds(b, t.id) && !b.route && ["branchHold", "branchReady"].includes(t.phase)) this.route(s, t.id);
          if (b.route?.id === t.id && !b.route.clear && !b.route.releaseAt && ["branchHold", "branchReady"].includes(t.phase)) this.clear(s, t.lineBranch.id);
        }
      },
    });

    P.throatLocked = function (station, side) {
      const lb = Object.values(this.lineBranches || {}).some((b) => b.station === station && b.route?.side === side && !b.route.own);
      if (lb) return true;
      const ctx = this._routeCtx;
      if (ctx && ctx.station === station && ctx.side === side) {
        const mine = sideUse(station, side, ctx.track, ctx.kind);
        if (mine) {
          return Object.values(this.routes).some((r) => {
            if (r.at !== station || r.side !== side) return false;
            const other = sideUse(station, side, r.track, r.kind);
            return !other || mine.cross || other.cross || mine.lane === other.lane;
          });
        }
      }
      return prevThroat.call(this, station, side);
    };
    P.next = function (t) {
      if (t?.lineBranch) return null;
      return prevNext.call(this, t);
    };
    P.request = function (t) {
      if (t?.lineBranch) return false;
      return prevRequest.call(this, t);
    };
    P.tick = function (dt) {
      const r = prevTick.call(this, dt);
      LB.advance(this);
      LB.autoHandle(this);
      return r;
    };


    // ───────────────────────────────────────────────────────────────────
    // 5) MENETRENDI VONATOK A KIÁGAZÁSOKON — globalThis.BRANCH_TIMETABLE (adatok/pdf → adatok/kiagazas_pdfbol.py → build.sh)
    //    { id, number, from, to, dir, stops:[{station, arr, dep}], replaces? }  — stops: csak a modellezett állomások;
    //    from: erről a kiágazásról érkezik az első megállóhoz; to: az utolsó megállótól ezen a kiágazáson távozik;
    //    replaces: a fővonali menetrend ugyanilyen számú vonata helyett közlekedik (ne legyen kétszer).
    // ───────────────────────────────────────────────────────────────────
    const TT = () => globalThis.BRANCH_TIMETABLE || [];
    const branchPlan = (svc, offset) => (svc.stops.length > 1 ? makeTimetablePlan(svc, offset) : [{ station: svc.stops[0].station, arr: svc.stops[0].arr + offset, dep: svc.stops[0].dep + offset, source: true }]);
    const dayRange = (s) => { const out = []; for (let d = Math.floor(s.time / 1440) - 1; d <= Math.floor((s.time + 3) / 1440); d++) out.push(d); return out; };
    const prevReal = P.realTraffic;
    if (typeof prevReal === "function")
      P.realTraffic = function () {
        this.ttSpawned ||= {};
        for (const svc of TT()) if (svc.replaces) for (const d of dayRange(this)) this.ttSpawned[d + ":" + svc.replaces] ||= "branch";
        return prevReal.call(this);
      };
    P.branchTraffic = function () {
      const list = TT();
      this.btSpawned ||= {};
      const start = this.serviceStart ?? 0;
      for (const day of dayRange(this))
        for (const svc of list) {
          const key = day + ":" + svc.id;
          if (this.btSpawned[key]) continue;
          const fromDef = svc.from && LB.byId(svc.from), toDef = svc.to && LB.byId(svc.to);
          if ((svc.from && !fromDef) || (svc.to && !toDef)) { this.btSpawned[key] = "nobranch"; continue; }
          const offset = day * 1440, plan = branchPlan(svc, offset), id = svc.number + (day === 0 ? "" : "/D" + day);
          if (plan.at(-1).dep < start) { this.btSpawned[key] = "past"; continue; }
          if (this.trains.some((t) => t.id === id)) { this.btSpawned[key] = true; continue; }
          const base = { id, number: svc.number, delay: 0, finished: false, history: [], plan, menetrendi: true, kind: "passenger", maxSpeed: 120, endStation: plan.at(-1).station, sourceLines: svc.lines || [], branchService: true };
          if (fromDef && plan[0].arr >= start) {
            // a kiágazás felől érkezik
            const lead = (fromDef.travel ?? TRAVEL) + THROAT + 1;
            if (plan[0].arr - lead > this.time) continue;
            const track = STATIONS[fromDef.station].tracks.find((tr) => !this.closed[`${fromDef.station}:${tr}`] && !this.busy(fromDef.station, tr, id));
            if (!track) continue;
            this.trains.push({ ...base, at: fromDef.station, dir: svc.dir || (fromDef.side === "L" ? 1 : -1), track, dep: plan[0].dep, phase: "branchRequest", lineBranch: { id: fromDef.id, direction: "in" }, scheduledBranch: true, exitBranch: svc.to || null });
          } else if (plan.length === 1) {
            // a csatlakozó állomásról indul a kiágazásra
            if (!toDef) { this.btSpawned[key] = "past"; continue; }
            if (plan[0].dep - 3 > this.time) continue;
            const track = this.free(toDef.station);
            if (!track) continue;
            this.trains.push({ ...base, at: toDef.station, dir: toDef.side === "L" ? -1 : 1, track, dep: Math.max(this.time, plan[0].dep), phase: "parked", history: [{ station: toDef.station, arr: this.time }], lineBranch: { id: toDef.id, direction: "out" } });
          } else {
            // a fővonalon indul (vagy a szimuláció kezdetekor már úton van), a végén a kiágazásra megy
            const first = plan[0].dep;
            if (first > this.time + 3) continue;
            let at = plan[0].station;
            if (first < start) { const past = plan.filter((x) => STATIONS[x.station].control && x.dep <= start); if (past.length) at = past.at(-1).station; }
            const track = this.free(at);
            if (!track) continue;
            const point = plan.find((x) => x.station === at);
            this.trains.push({ ...base, at, dir: svc.dir, track, dep: Math.max(this.time, point.dep), phase: "parked", delay: Math.max(0, this.time - point.dep), viaBranch: svc.to || null });
          }
          this.btSpawned[key] = true;
        }
      // meglévő hiba javítása: a szimuláció indulásakor már a végállomásán álló menetrendi vonat sosem fejezte be az útját,
      // és örökre foglalta a vágányt (Érd felső, Kelenföld, Déli idővel betelt)
      for (const t of this.trains)
        if (t.menetrendi && !t.finished && !t.lineBranch && t.phase === "parked" && t.at === t.endStation && this.time >= (t.dep ?? 0) && !this.permissions[t.id] && this.next(t) == null) {
          t.finished = true;
          t.finishedAt = this.time;
        }
      // a csatlakozó állomásra ért vonat átadása a kiágazásra
      for (const t of this.trains) {
        if (!t.viaBranch || t.lineBranch || !t.finished || t.phase !== "parked") continue;
        const def = LB.byId(t.viaBranch);
        if (!def || t.at !== def.station) continue;
        t.finished = false; delete t.finishedAt;
        t.lineBranch = { id: def.id, direction: "out" };
        t.branchPermission = false;
        t.dep = Math.max(this.time, t.plan.at(-1).dep);
        delete t.viaBranch;
      }
    };
    // beérkezett menetrendi kiágazási vonat: folytatás a fővonalon, továbbhaladás másik kiágazásra, vagy végállomás
    const prevAdvance = LB.advance.bind(LB);
    LB.advance = function (s) {
      prevAdvance(s);
      for (const t of s.trains) {
        if (!t.scheduledBranch || t.phase !== "parked" || !t.lineBranch || t.lineBranch.id !== null) continue;
        delete t.scheduledBranch;
        t.delay = Math.max(0, s.time - t.plan[0].arr);
        t.branchPermission = false;
        if (t.plan.length > 1) { delete t.lineBranch; t.dep = Math.max(s.time, t.plan[0].dep); t.history = [{ station: t.at, arr: s.time }]; if (t.exitBranch) t.viaBranch = t.exitBranch; }
        else if (t.exitBranch) { t.lineBranch = { id: t.exitBranch, direction: "out" }; t.dep = Math.max(s.time + 0.5, t.plan[0].dep); }
        else { delete t.lineBranch; t.finished = true; t.finishedAt = s.time; }
        delete t.exitBranch;
      }
    };
    const prevTick2 = P.tick;
    P.tick = function (dt) { const r = prevTick2.call(this, dt); this.branchTraffic(); return r; };

    // ───────────────────────────────────────────────────────────────────
    // 3) KÉTVÁGÁNYÚ ÁLLOMÁSI PULT — ahol az állomásköz kétvágányú, a pulton is két vonali vágány.
    //    Vágánykiosztás a KÖFI-vel azonos: 1. (felső) vonali vágány Budapest felé, 2. (alsó) Pécs felé (jobb oldali közlekedés),
    //    menetirányváltással követve. A bejárati jelző (A/B) a beérkező, a kijárati cél (VL/VR) a kimenő vágányon.
    // ───────────────────────────────────────────────────────────────────
    const CONTROL_IDS = STATIONS.filter((x) => x.control).map((x) => x.id);
    function lineSides(s) {
      sim.ensureBlocks();
      const i = CONTROL_IDS.indexOf(s),
        g = geom(s);
      const info = (side) => {
        const nb = side === "L" ? CONTROL_IDS[i - 1] : CONTROL_IDS[i + 1],
          sec = nb === undefined ? null : sim.blockSystem.section(s, nb);
        if (!sec || !sec.double) return { double: false, sec, in: g.mid, out: g.mid, lanes: [], laneY: () => g.mid };
        const lanes = sec.lanes.map((ln, k) => ({ lane: k, direction: ln.direction, y: g.mid + (k === 0 ? -17 : 17) }));
        const inDir = side === "L" ? 1 : -1,
          inc = lanes.find((l) => l.direction === inDir) || lanes[0],
          out = lanes.find((l) => l !== inc && l.direction === -inDir) || lanes.find((l) => l !== inc) || inc;
        return { double: true, sec, lanes, in: inc.y, out: out.y, laneY: (k) => (lanes[k] ? lanes[k].y : inc.y) };
      };
      return { L: info("L"), R: info("R") };
    }
    function routeLane(r) {
      const p = permissionsOf(sim, r.train).find((x) => (r.kind === "in" ? x.to === r.at : x.from === r.at));
      return p?.lane;
    }
    // Kétvágányú oldalon: mindkét vonali vágány a saját váltóján (x=215 / 985) csatlakozik az állomás saját térfelén
    // lévő vágányokhoz; a két vonali vágány közt X alakú átmenő kitérő (x 178–212 / 988–1022), így bármelyikről bármelyik vágány elérhető.
    const XO = { L: [178, 212], R: [1022, 988] }; // átmenő kitérő két vége (vonal felől → állomás felé)
    function naturalLane(sd, y, m) {
      if (!sd.double) return null;
      const upper = sd.lanes.reduce((a, b) => (a.y < b.y ? a : b)), lower = sd.lanes.reduce((a, b) => (a.y > b.y ? a : b));
      return y <= m ? upper : lower;
    }
    routePoints = function (s, side, track, kind, lane) {
      const g = geom(s),
        y = g.y(track),
        m = g.mid,
        sd = lineSides(s)[side],
        sx = side === "L" ? 215 : 985,
        tx = side === "L" ? 350 : 850,
        ex = side === "L" ? 90 : 1110;
      let pts;
      if (sd.double) {
        const ln = lane != null && sd.lanes[lane] ? sd.lanes[lane] : sd.lanes.find((l) => l.y === (kind === "in" ? sd.in : sd.out)) || sd.lanes[0];
        const nat = naturalLane(sd, y, m);
        if (nat && nat.lane !== ln.lane) pts = [[ex, ln.y], [XO[side][0], ln.y], [XO[side][1], nat.y], [sx, nat.y], [tx, y], [600, y]];
        else pts = [[ex, ln.y], [sx, ln.y], [tx, y], [600, y]];
      } else pts = [[ex, m], [sx, m], [tx, y], [600, y]];
      if (kind === "out") {
        pts.reverse();
        pts.push([side === "L" ? -80 : 1280, pts[pts.length - 1][1]]);
      }
      return pts;
    };

    function branchStub(s, def, k, sides) {
      // k: hányadik kiágazás ezen az oldalon és irányban; a külső vonali vágányból ágazik ki, fölfelé vagy lefelé.
      const g = geom(s),
        sd = sides[def.side],
        down = def.vert === "down",
        ys = sd.double ? sd.lanes.map((l) => l.y) : [g.mid],
        outer = down ? Math.max(...ys) : Math.min(...ys),
        koz = def.double ? 26 : 0,
        yb = down ? outer + 150 + k * (36 + koz) : outer - 44 - k * (36 + koz),
        // a kétvágányú ág két vágánya egymás alatt, a fővonaltól kifelé
        yb2 = down ? yb + koz : yb - koz,
        ly = down ? Math.max(yb, yb2) + 24 : Math.min(yb, yb2) - 21;
      const alak = (x0, x1, x2, y) => [[x0, y], [x1, y], [x2, outer]];
      return def.side === "L"
        ? { pts: alak(15, 68, 130, yb), pts2: koz ? alak(15, 68, 130, yb2) : null,
            label: [20, ly], anchor: "start", sig: [68, yb], vg: [40, yb, 40, yb2] }
        : { pts: alak(1185, 1132, 1070, yb), pts2: koz ? alak(1185, 1132, 1070, yb2) : null,
            label: [1180, ly], anchor: "end", sig: [1132, yb], vg: [1160, yb, 1160, yb2] };
    }

    svgSignal = function (s, name, x, y, dir) {
      const r = sim.getRoute(s, name), clear = !!r?.clear, tx = dir === 1 ? x + 40 : x - 40;
      return `<g class="point" tabindex="0" role="button" aria-label="${name} jelző" onclick="point('${name}')" onkeydown="if(event.key==='Enter')point('${name}')"><path d="M${x} ${y}v-17h${dir === 1 ? 18 : -18}" stroke="#111" stroke-width="3" fill="none"/><rect x="${dir === 1 ? x + 10 : x - 35}" y="${y - 25}" width="25" height="15" rx="7" fill="#111"/><circle cx="${dir === 1 ? x + 22 : x - 23}" cy="${y - 18}" r="5" fill="${clear ? "#35e36a" : "#ff3636"}"/><text x="${tx}" y="${y - 14}" text-anchor="${dir === 1 ? "start" : "end"}" fill="#19321f" font-size="11" stroke="#bdd7ae" stroke-width="4" paint-order="stroke">${name}</text></g>`;
    };

    // ---- D55 pultkép: világoszöld mozaiklapok, fekete vágánysáv, benne világító szakaszok (sárga = lezárt vágányút, vörös = foglalt),
    // a gombok a vágányban ülnek, alul a csoportgombok, felül középen a számlálók. A kezelés marad kétütemű (első / második lezárás).
    const D55 = { off: "#3d3f37", lit: "#ffd62e", occ: "#ff3636", pos: "#efe9c6", closed: "#ff9d2e" };
    const band = (d) => `<path d="${d}" fill="none" stroke="#101010" stroke-width="12" stroke-linejoin="round"/>`;
    const lamps = (d, c, w = 5, extra = "") => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-dasharray="15 6" stroke-linejoin="round" ${extra}/>`;
    const tag = (t, x, y) =>
      `<g onclick="showTrain('${t.id}')" style="cursor:pointer"><rect x="${x - 25}" y="${y - 9}" width="50" height="17" rx="2" fill="#f7f5ea" stroke="#111" stroke-width="1.5"/><text x="${x}" y="${y + 4}" text-anchor="middle" fill="#111" font-size="11" font-weight="700">${esc(t.id)}</text></g>`;
    // a vonat a pulton nem „kocsi”, hanem a vágánysávban haladó vörös foglaltság + vonatszámtábla
    function litTrain(t, pts, head, len = 78) {
      const q = [];
      for (let d = head - len; d <= head; d += 6) {
        const p = sample(pts, d);
        q.push(p.x.toFixed(1) + "," + p.y.toFixed(1));
      }
      const m = sample(pts, head - len / 2);
      return `<path d="M${q.join("L")}" fill="none" stroke="${D55.occ}" stroke-width="7" stroke-dasharray="15 6" stroke-linejoin="round"/>` + tag(t, m.x, m.y - 21);
    }
    function branchTrainBox(t, x, y) {
      return `<circle cx="${x}" cy="${y}" r="5" fill="${D55.occ}" stroke="#111"/>` + tag(t, x, y - 19);
    }
    for (const [fn, key] of [["cancelRoute", "oldas"], ["stopSignal", "megallj"]]) {
      const prev = P[fn];
      P[fn] = function (station, signal) {
        const r = prev.apply(this, arguments);
        if (r?.ok && playerOwns(this, station)) {
          this.d55Counters ||= { oldas: 0, megallj: 0 };
          this.d55Counters[key]++;
        }
        return r;
      };
    }
    const GROUP_BUTTONS = [["route", "Vágányút"], ["clear", "Jelző szabad"], ["stop", "Megállj"], ["cancel", "Törlés / oldás"], ["switch", "Váltóállítás"]];

    drawStation = function () {
      const s = sim.selected,
        g = geom(s),
        sides = lineSides(s),
        branches = LB.at(s),
        H = g.h + 64,
        blink = Math.floor(Date.now() / 450) % 2 ? 1 : 0.25,
        cnt = sim.d55Counters || { oldas: 0, megallj: 0 };
      let html = `<svg viewBox="0 0 1200 ${H}" role="img" aria-label="D55-jellegű kezelhető játékpult"><defs><pattern id="tiles" width="34" height="34" patternUnits="userSpaceOnUse"><rect width="34" height="34" fill="#bdd7ae"/><path d="M0 33.5H34M33.5 0V34" stroke="#8eac82" stroke-width="1" fill="none"/><path d="M0 .5H34M.5 0V34" stroke="#d6ead0" stroke-width="1" fill="none"/></pattern></defs><rect width="1200" height="${H}" fill="url(#tiles)"/><text x="23" y="27" fill="#132a19" font-size="19">${esc(STATIONS[s].name.toUpperCase())} · D55-JELLEGŰ JÁTÉKPULT</text><text x="23" y="49" fill="#1a3221" font-size="12">Kétütemű kezelés · első és második lezárás · sematikus vágányrajz</text>`;
      // számlálók (a valódi pulton a rendkívüli kezeléseket számláló regisztrálja)
      [["Oldás", cnt.oldas], ["Megállj", cnt.megallj]].forEach(([label, n], i) => {
        const x = 530 + i * 76;
        html += `<rect x="${x}" y="8" width="64" height="38" rx="2" fill="#f7f5ea" stroke="#6d7d66"/><text x="${x + 32}" y="20" text-anchor="middle" fill="#333" font-size="8">${label}</text><rect x="${x + 9}" y="24" width="46" height="17" fill="#111"/><text x="${x + 32}" y="37" text-anchor="middle" fill="#f4f4f4" font-size="12" font-family="monospace">${String(n).padStart(4, "0")}</text>`;
      });
      let bands = "", lights = "";
      const trk = (d, c) => {
        bands += band(d);
        lights += lamps(d, c || D55.off);
      };
      // vonali csatlakozások
      for (const side of ["L", "R"]) {
        const sd = sides[side];
        if (!sd.double) {
          trk(side === "L" ? `M15 ${g.mid}H215` : `M985 ${g.mid}H1185`);
          continue;
        }
        const sx = side === "L" ? 215 : 985, ex = side === "L" ? 15 : 1185;
        for (const ln of sd.lanes) {
          const occupied = sd.sec.lanes[ln.lane].blocks.some((b) => b.owner);
          const ly = ln.y;
          trk(`M${ex} ${ly}H${sx}`, occupied ? D55.occ : null);
          const lx = side === "L" ? 40 : 1160;
          html += `<text x="${lx}" y="${ly - 11}" text-anchor="middle" fill="#17321e" font-size="10">${ln.lane + 1}. vg ${ln.direction === 1 ? "→" : "←"}</text>`;
        }
        // átmenő kitérő (X) a két vonali vágány közt
        const [y0, y1] = sd.lanes.map((l) => l.y), [xa, xb] = XO[side];
        trk(`M${xa} ${y0}L${xb} ${y1}`);
        trk(`M${xa} ${y1}L${xb} ${y0}`);
      }
      g.tracks.forEach((tr) => {
        const y = g.y(tr),
          selectedL = (sim.switches[`${s}:L`] || g.tracks[0]) === tr,
          selectedR = (sim.switches[`${s}:R`] || g.tracks[0]) === tr,
          occ = sim.trains.some((t) => t.at === s && t.track === tr && t.phase === "parked"),
          closed = sim.closed[`${s}:${tr}`],
          queue = sim.queueAhead(s, tr, "__nobody__").length;
        const nL = naturalLane(sides.L, y, g.mid), nR = naturalLane(sides.R, y, g.mid),
          yL = nL ? nL.y : g.mid, yR = nR ? nR.y : g.mid;
        trk(`M215 ${yL}L350 ${y}`);
        trk(`M850 ${y}L985 ${yR}`);
        trk(`M350 ${y}H850`, closed ? D55.closed : occ ? D55.occ : null);
        // váltóállás-visszajelentés: rövid világító szakasz a váltónál
        if (selectedL) lights += lamps(`M215 ${yL}L${215 + 48} ${yL + (y - yL) * (48 / 135)}`, D55.pos);
        if (selectedR) lights += lamps(`M985 ${yR}L${985 - 48} ${yR + (y - yR) * (48 / 135)}`, D55.pos);
        html += `<text x="600" y="${y + 24}" text-anchor="middle" fill="#17321e" font-size="12">${tr}. vágány${closed ? " · LEZÁRVA" : ""}${queue > 1 ? ` · sorban: ${queue}` : ""}</text>`;
      });
      Object.values(sim.routes)
        .filter((r) => r.at === s)
        .forEach((r) => {
          const pts = routePoints(s, r.side, r.track, r.kind, routeLane(r)),
            d = "M" + pts.map((p) => p.join(",")).join("L");
          lights += lamps(d, D55.lit, 6, r.releaseAt ? `opacity="${blink}"` : "");
        });
      // kiágazási csonkok
      const bySide = {};
      let stubTrains = "";
      for (const def of branches) {
        const key = def.side + (def.vert === "down" ? "d" : "u"),
          k = (bySide[key] = (bySide[key] || 0) + 1) - 1,
          st = branchStub(s, def, k, sides),
          b = LB.state(sim, def.id),
          d = "M" + st.pts.map((p) => p.join(",")).join("L");
        trk(d, LB.occupants(b).length ? D55.occ : null);
        if (st.pts2) {
          // kétvágányú ág: a második vágány is kirajzolódik, a vonali vágányok jelölésével
          trk("M" + st.pts2.map((p) => p.join(",")).join("L"));
          // a felső vágány az 1., ahogy a vonali vágányoknál is
          const [felso, also] = [st.vg[1], st.vg[3]].sort((a, z) => a - z);
          html += `<text x="${st.vg[0]}" y="${felso - 7}" text-anchor="middle" fill="#17321e" font-size="10">1. vg</text>` +
                  `<text x="${st.vg[0]}" y="${also - 7}" text-anchor="middle" fill="#17321e" font-size="10">2. vg</text>`;
        }
        if (b.route)
          lights += lamps(
            "M" + [st.pts[1], st.pts[2], [def.side === "L" ? 215 : 985, (naturalLane(sides[def.side], g.y(b.route.track), g.mid) || { y: g.mid }).y], [def.side === "L" ? 350 : 850, g.y(b.route.track)], [600, g.y(b.route.track)]].map((p) => p.join(",")).join("L"),
            D55.lit,
            6,
            b.route.releaseAt ? `opacity="${blink}"` : "",
          );
        stubTrains += `<circle cx="${st.sig[0]}" cy="${st.sig[1] + (def.vert === "down" ? 13 : -13)}" r="5" fill="${b.route?.clear ? "#35e36a" : "#ff3636"}" stroke="#111" stroke-width="2"/><text x="${st.label[0]}" y="${st.label[1]}" text-anchor="${st.anchor}" fill="#17321e" font-size="11">${esc(def.name)}${LB.occupants(b).length ? " · " + esc(LB.occupants(b).join(", ")) : ""}</text>`;
        // menetek a csonkon
        for (const t of sim.trains) {
          if (!t.lineBranch || t.finished || t.lineBranch.id !== def.id) continue;
          const el = sim.time - (t.branchSince ?? sim.time);
          let pos = null;
          const stub = [st.pts[0], st.pts[1]],
            throat = [st.pts[1], st.pts[2], [def.side === "L" ? 215 : 985, (naturalLane(sides[def.side], g.y(t.track), g.mid) || { y: g.mid }).y], [def.side === "L" ? 350 : 850, g.y(t.track)], [600, g.y(t.track)]];
          if (t.phase === "branchLineIn") pos = sample(stub, Math.min(1, el / LB.travel(def)) * length(stub));
          else if (t.phase === "branchHold") pos = sample(stub, length(stub));
          else if (t.phase === "branchEntering") pos = sample(throat, Math.min(1, el / THROAT) * length(throat));
          else if (t.phase === "branchLeaving") pos = sample([...throat].reverse(), Math.min(1, el / THROAT) * length(throat));
          else if (t.phase === "branchLineOut") pos = sample([...stub].reverse(), Math.min(1, el / LB.travel(def)) * length(stub));
          if (pos) stubTrains += branchTrainBox(t, pos.x, pos.y);
        }
      }
      html += bands + lights + stubTrains;
      g.tracks.forEach((tr) => {
        const y = g.y(tr);
        html += svgSignal(s, "KL-" + tr, 380, y, -1) + svgSignal(s, "KR-" + tr, 820, y, 1) + svgButton("KL-" + tr, 412, y) + svgButton("KR-" + tr, 788, y);
      });
      html +=
        svgSignal(s, "A", 145, sides.L.in, 1) +
        svgSignal(s, "B", 1055, sides.R.in, -1) +
        svgButton("A", 100, sides.L.in) +
        svgButton("B", 1100, sides.R.in) +
        svgButton("VL", 52, g.mid + 105, "exit") +
        svgButton("VR", 1148, g.mid + 105, "exit");
      html += svgButton("W-L", 265, 75, "switch") + svgButton("W-R", 935, 75, "switch");
      sim.trains.forEach((t) => {
        const p = sim.permissions[t.id];
        if (t.lineBranch && t.phase !== "parked") return; // a kiágazási menetek a csonkon mozognak
        if (t.phase === "parked" && t.at === s) {
          const y = g.y(t.track);
          html += tag(t, 600, y - 21);
        } else if (t.phase === "leaving" && t.at === s) {
          const pts = routePoints(s, t.dir === 1 ? "R" : "L", t.track, "out", p?.lane);
          html += litTrain(t, pts, 35 + t.progress * (length(pts) + 55));
        } else if (p && p.to === s && ["approach", "hold", "entering"].includes(t.phase)) {
          let pts, head;
          const side = t.dir === 1 ? "L" : "R",
            sd = sides[side],
            ty = sd.double ? sd.laneY(p.lane) : g.mid;
          if (t.phase === "approach") {
            pts = t.dir === 1 ? [[-80, ty], [90, ty]] : [[1280, ty], [1110, ty]];
            head = 35 + t.progress * length(pts);
          } else {
            pts = routePoints(s, side, p.track, "in", p.lane);
            head = t.phase === "hold" ? 35 : 35 + t.progress * length(pts);
          }
          html += litTrain(t, pts, head);
        }
      });
      const names = (side) => {
        const nb = side === "L" ? CONTROL_IDS[CONTROL_IDS.indexOf(s) - 1] : CONTROL_IDS[CONTROL_IDS.indexOf(s) + 1];
        return nb === undefined ? (side === "L" ? "Vonalvég" : "Vonalvég") : STATIONS[nb].name + " felől";
      };
      html += `<text x="20" y="${g.h - 18}" fill="#15321e" font-size="12">${esc(names("L"))} · A / VL${sides.L.double ? " · kétvágányú" : ""}</text><text x="1180" y="${g.h - 18}" text-anchor="end" fill="#15321e" font-size="12">B / VR · ${esc(names("R"))}${sides.R.double ? " · kétvágányú" : ""}</text>`;
      // csoportgombok az alsó sorban (a felső eszköztár gombjaival egyenértékűek)
      html += `<rect x="250" y="${g.h + 4}" width="700" height="54" rx="3" fill="#a9c69b" stroke="#7d9a72"/>`;
      GROUP_BUTTONS.forEach(([m, label], i) => {
        const x = 320 + i * 140, y = g.h + 24, on = mode === m;
        html += `<g class="point" tabindex="0" role="button" aria-label="${label}" onclick="setMode('${m}')" onkeydown="if(event.key==='Enter')setMode('${m}')"><circle cx="${x}" cy="${y}" r="12" fill="#1c1c1c" stroke="${on ? "#ffd62e" : "#5d6f57"}" stroke-width="${on ? 4 : 2}"/><circle cx="${x}" cy="${y}" r="7" fill="${m === "stop" ? "#c8322f" : m === "cancel" ? "#e0a12a" : "#e9e6d8"}"/><text x="${x}" y="${y + 27}" text-anchor="middle" fill="#132a19" font-size="11" font-weight="${on ? 700 : 400}">${label}</text></g>`;
      });
      html += "</svg>";
      $("board").innerHTML = html;
    };

    // ───────────────────────────────────────────────────────────────────
    // 4) FELÜLET — kiágazási panel az állomási nézetben, KÖFI-csonkok, sorrend a fogadóvágány-listában.
    // ───────────────────────────────────────────────────────────────────
    const panel = document.createElement("section");
    panel.id = "line-branch-controls";
    panel.className = "body";
    panel.hidden = true;
    document.getElementById("board").after(panel);
    const style = document.createElement("style");
    style.textContent = `#line-branch-controls h3{margin:4px 0 8px;font-size:15px}#line-branch-controls .lb{border:1px solid #3b5565;border-radius:8px;padding:9px;margin:8px 0;background:#132431}#line-branch-controls .lb b{color:#ffd28c}#line-branch-controls button{font-size:12px;padding:6px 8px;margin:3px 3px 0 0}#line-branch-controls table{margin-top:8px}`;
    document.head.append(style);

    window.lbAct = function (action, a, b, c) {
      let r;
      if (action === "in") r = LB.create(sim, a, true, $("track")?.value);
      else if (action === "grant") r = LB.grant(sim, a, b);
      else if (action === "route") r = LB.route(sim, a);
      else if (action === "clear") r = LB.clear(sim, a);
      else if (action === "stop") r = LB.stop(sim, a);
      else if (action === "cancel") r = LB.cancel(sim, a);
      else if (action === "handoff") r = LB.handoff(sim, a, b);
      else if (action === "toBranch") r = LB.toBranch(sim, a, b);
      if (!r) return;
      if (!r.ok) toast(r.msg);
      else if (r.id) toast(r.id + ": kézi tehermenet a kiágazásról.");
      render();
    };

    function paintBranchPanel() {
      const s = sim.selected,
        branches = LB.at(s);
      panel.hidden = !branches.length || sim.view !== "station";
      if (panel.hidden) return;
      const owned = !sim.auto || playerOwns(sim, s);
      let html = `<h3>${esc(STATIONS[s].name)} · kiágazások (egy modellezett állomásköz)</h3><p class="small">${owned ? "Ezt az állomást te kezeled: a kiágazási engedély, vágányút és jelző a tiéd." : "Az állomás nincs a kézi területben: a kiágazásokat a gép kezeli."} A kiágazás állomásvége (Budapest/Pécs felőli) játékparaméter, nem ellenőrzött ÁVU-adat. A menetidő kiágazásonként 3–${TRAVEL} perc, a be-/kijárat ${THROAT} perc.</p>`;
      for (const def of branches) {
        const b = LB.state(sim, def.id);
        html += `<div class="lb"><b>${esc(def.name)}</b> · ${def.side === "L" ? "Budapest felőli" : "Pécs felőli"} állomásvég · szakasz: ${LB.occupants(b).length ? '<span class="red">foglalt/lefoglalt: ' + esc(LB.occupants(b).join(", ")) + "</span>" : '<span class="green">szabad</span>'} · vágányút: ${b.route ? esc(b.route.id) + " · " + b.route.track + ". vg · " + (b.route.releaseAt ? "oldás folyamatban" : b.route.clear ? '<span class="green">Szabad</span>' : "Megállj") : "nincs"}<div><button onclick="lbAct('in','${def.id}')">Kézi tehermenet ${esc(def.name.replace(" felé", " felől"))}</button><button onclick="lbAct('clear','${def.id}')">Jelző Szabad</button><button onclick="lbAct('stop','${def.id}')">Megállj!</button><button onclick="lbAct('cancel','${def.id}')">Vágányút törlése / oldás</button></div><div class="small">A bejövő menet a Fogadóvágány-választóban kijelölt vágányra érkezik (alapvágány: első szabad).</div></div>`;
      }
      const trains = LB.trainsAt(sim, s);
      const rows = trains
        .map((t) => {
          const def = LB.byId(t.lineBranch.id),
            from = LB.byId(t.lineBranch.from);
          let ops = "";
          if (t.phase === "branchRequest") ops += `<button onclick="lbAct('grant','${t.id}')">Engedély</button>`;
          if (["branchLineIn", "branchHold", "branchReady"].includes(t.phase) && t.branchPermission) ops += `<button onclick="lbAct('route','${t.id}')">Vágányút</button>`;
          if (t.phase === "parked") {
            for (const d of branches) ops += `<button onclick="lbAct('grant','${t.id}','${d.id}')">Engedély ${esc(d.name)}</button>`;
            ops += `<button onclick="lbAct('handoff','${t.id}',-1)">Fővonalra Budapest felé</button><button onclick="lbAct('handoff','${t.id}',1)">Fővonalra Pécs felé</button>`;
          }
          return `<tr><td>${esc(t.id)}</td><td>${def ? esc(t.lineBranch.direction === "in" ? def.name.replace(" felé", " felől") : def.name) : from ? "érkezett: " + esc(from.name.replace(" felé", " felől")) : "—"}</td><td>${t.track}.</td><td>${phases[t.phase] || t.phase}</td><td>${ops}</td></tr>`;
        })
        .join("");
      const mainFreight = sim.trains.filter(
        (t) => t.at === s && t.phase === "parked" && !t.finished && !t.menetrendi && !t.lineBranch && !t.branchManaged && !permissionsOf(sim, t.id).length && !Object.values(sim.routes).some((r) => r.train === t.id),
      );
      html += `<table><thead><tr><th>Menet</th><th>Kiágazás</th><th>Vágány</th><th>Állapot</th><th>Kezelés</th></tr></thead><tbody>${rows || '<tr><td colspan="5">Nincs kiágazási menet ezen az állomáson.</td></tr>'}</tbody></table>`;
      if (mainFreight.length)
        html += `<p class="small">Álló fővonali tehervonat átadása kiágazásra:</p>${mainFreight
          .map((t) => `<div class="lb">${esc(t.id)} · ${t.track}. vágány ${branches.map((d) => `<button onclick="lbAct('toBranch','${t.id}','${d.id}')">${esc(d.name)}</button>`).join("")}</div>`)
          .join("")}`;
      panel.innerHTML = html;
    }

    function decorateTrackSelect() {
      const sel = document.getElementById("track");
      if (!sel) return;
      // meglévő hiba: a korábbi blokk minden rajzoláskor újabb „Átmenő alapvágány” sort tett a listába
      const through = [...sel.options].filter((o) => o.value === "__through__");
      through.slice(1).forEach((o) => o.remove());
      for (const o of sel.options) {
        if (o.value === "__through__") continue;
        o.dataset.base ??= o.textContent;
        const q = sim.queueAhead(sim.selected, o.value, "__nobody__");
        o.textContent = o.dataset.base + (q.length ? ` · foglalt/lefoglalt, sorban fogadható (előtte ${q.length})` : "");
      }
    }
    function tidyPanels() {
      // a korábbi panelek „Előkérés 3 állomásra” gombja a kiágazási meneteknél értelmetlen
      document.querySelectorAll("#trains tr").forEach((row) => {
        const id = row.querySelector("td button")?.textContent.trim(),
          t = sim.trains.find((x) => x.id === id);
        if (t?.lineBranch) row.querySelector("[data-three-ahead]")?.remove();
      });
    }

    const prevRender = render;
    render = function (...args) {
      const r = prevRender.apply(this, args);
      decorateTrackSelect();
      paintBranchPanel();
      tidyPanels();
      return r;
    };

    const prevKofi = drawKofi;
    drawKofi = function () {
      prevKofi();
      if (!NW.svg || !NW.layout) return;
      const counts = {};
      for (const def of LINE_BRANCHES) {
        const node = NW.layout.nodes[def.station];
        if (!node) continue;
        const down = def.vert === "down",
          key = def.station + def.side + (down ? "d" : "u"),
          k = (counts[key] = (counts[key] || 0) + 1) - 1,
          b = LB.state(sim, def.id),
          x0 = def.side === "L" ? node.x : node.x + node.w,
          dx = def.side === "L" ? -1 : 1,
          yb = down ? 640 + k * 62 : 250 - k * 62,
          x1 = x0 + dx * 110,
          x2 = x0 + dx * 250,
          g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute("data-linebranch", def.id);
        const tx = Math.min(x1, x2),
          w = Math.abs(x2 - x1);
        const masodik = def.double
          ? `<path d="M${x0} 400L${x1} ${yb + (down ? 16 : -16)}H${x2}" stroke="${LB.occupants(b).length ? "#ff747e" : "#e5b45f"}" stroke-width="4" fill="none"/>`
          : "";
        g.innerHTML = masodik + `<path d="M${x0} 400L${x1} ${yb}H${x2}" stroke="${LB.occupants(b).length ? "#ff747e" : "#e5b45f"}" stroke-width="4" fill="none"/><circle cx="${x1}" cy="${yb + (down ? 11 : -11)}" r="4" fill="${b.route?.clear ? "#66ee95" : "#ff6c77"}"/><rect x="${tx}" y="${down ? yb + 18 : yb - 48}" width="${w}" height="30" rx="3" fill="#213f55" stroke="#e5b45f"/><text x="${tx + w / 2}" y="${down ? yb + 30 : yb - 36}" text-anchor="middle" fill="white" font-size="10">${esc(def.name)}</text><text x="${tx + w / 2}" y="${down ? yb + 42 : yb - 24}" text-anchor="middle" fill="#ffd085" font-size="9">${LB.occupants(b).length ? esc(LB.occupants(b).join(", ")) : "szabad"}${b.route ? " · vágányút " + (b.route.clear ? "Szabad" : "Megállj") : ""}</text>`;
        g.style.cursor = "pointer";
        g.onpointerdown = (ev) => {
          ev.stopPropagation();
          selectStation(def.station);
          setView("station");
        };
        NW.svg.append(g);
      }
    };

    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();
