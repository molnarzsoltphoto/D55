(() => {
  "use strict";
  // VONAL 40 · 0.9 — kétvágányú állomási pult, sorrendtartó engedélyezés, kiágazások modellhatárral.
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
      const gb = this.godisaBranch;
      if (station === 37 && gb?.reserved?.track === track && gb.reserved.id !== id) ahead.push({ id: gb.reserved.id, why: "csatlakozó foglalás" });
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
    // 2) KIÁGAZÁSOK — egy-egy modellezett állomásköz egy modellhatárig (mint a godisai Komló-ág).
    //    A kiágazás oldala (L = Budapest felőli, R = Pécs felőli állomásvég) játékparaméter,
    //    nem ellenőrzött ÁVU-adat; a listában módosítható.
    // ───────────────────────────────────────────────────────────────────
    const LINE_BRANCHES = [
      { id: "kelenfold-keleti", station: 1, side: "L", name: "Budapest-Keleti felé" },
      { id: "kelenfold-gyor", station: 1, side: "R", name: "Győr felé" },
      { id: "kelenfold-szfvar", station: 1, side: "R", name: "Székesfehérvár felé" },
      { id: "pszabolcs-szfvar", station: 14, side: "L", name: "Székesfehérvár felé" },
      { id: "pszabolcs-dunaujvaros", station: 14, side: "R", name: "Dunaújváros felé" },
      { id: "sarbogard-szfvar", station: 18, side: "L", name: "Székesfehérvár felé" },
      { id: "retszilas-dunaujvaros", station: 19, side: "L", name: "Dunaújváros felé" },
      { id: "retszilas-szekszard", station: 19, side: "R", name: "Szekszárd felé" },
      { id: "dombovar-bataszek", station: 33, side: "L", name: "Bátaszék felé" },
      { id: "dombovar-kaposvar", station: 33, side: "R", name: "Kaposvár felé" },
      { id: "szentlorinc-szigetvar", station: 43, side: "L", name: "Szigetvár felé" },
      { id: "szentlorinc-sellye", station: 43, side: "R", name: "Sellye felé" },
    ];
    const TRAVEL = 5, // perc a modellhatár és a modelljelző között (játékparaméter)
      THROAT = 1; // perc a be-/kijárat

    Object.assign(phases, {
      branchRequest: "Kiágazásról engedélyt kér",
      branchLineIn: "Kiágazási szakaszon közelít",
      branchHold: "Kiágazási modelljelző előtt",
      branchEntering: "Kiágazási bejáraton",
      branchReady: "Kiágazási kijáratra vár",
      branchLeaving: "Kiágazási kijáraton",
      branchLineOut: "Kiágazási modellszakaszon",
      branchOutside: "Modellhatáron kívül",
    });

    const LB = (window.LineBranches = {
      list: LINE_BRANCHES,
      byId: (id) => LINE_BRANCHES.find((b) => b.id === id),
      at: (station) => LINE_BRANCHES.filter((b) => b.station === station),
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
        track = track && track !== "__through__" && STATIONS[def.station].tracks.includes(track) ? track : s.free(def.station);
        if (!track) return { ok: false, msg: `${STATIONS[def.station].name}: nincs szabad fogadóvágány.` };
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
        const b = this.state(s, def.id);
        if (b.edge) return { ok: false, msg: `${def.name}: a kiágazási szakasz foglalt vagy lefoglalt (${b.edge}).` };
        if ((t.lineBranch.direction === "in" && t.phase !== "branchRequest") || (t.lineBranch.direction === "out" && t.phase !== "parked"))
          return { ok: false, msg: "Ebben az állapotban nem engedélyezhető." };
        if (t.lineBranch.direction === "in") {
          if (s.closed[`${def.station}:${t.track}`] || s.busy(def.station, t.track, id))
            return { ok: false, msg: `${STATIONS[def.station].name}, ${t.track}. vágány foglalt vagy lezárt.` };
          b.reserved = { id, track: t.track };
        }
        b.edge = id;
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
        if (b.edge !== id) return { ok: false, msg: "A szakaszt másik menet foglalja." };
        if (b.route) return { ok: false, msg: "Ezen a kiágazáson már van lezárt vágányút." };
        if (prevThroat.call(s, def.station, def.side) || Object.values(s.lineBranches).some((x) => x !== b && x.station === def.station && x.route?.side === def.side))
          return { ok: false, msg: "Az állomásvég másik vágányút miatt lezárt." };
        if (!["branchLineIn", "branchHold", "branchReady"].includes(t.phase)) return { ok: false, msg: "A menet állapota nem megfelelő." };
        b.route = { id, track: t.track, kind: t.lineBranch.direction, side: def.side, clear: false, everCleared: false, releaseAt: null };
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
        if (Object.values(s.lineBranches || {}).some((b) => b.route?.id === id || b.edge === id)) return { ok: false, msg: "Előbb oldd a kiágazási vágányutat / engedélyt." };
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
            r = b.route?.id === t.id ? b.route : null;
          if (t.phase === "branchLineIn" && elapsed >= TRAVEL) t.phase = "branchHold";
          if (t.phase === "branchHold" && r?.clear) {
            t.phase = "branchEntering";
            t.branchSince = s.time;
            r.clear = false;
          } else if (t.phase === "branchEntering" && elapsed >= THROAT) {
            t.phase = "parked";
            t.history.push({ station: def.station, arr: s.time });
            t.branchPermission = false;
            t.lineBranch = { id: null, direction: "out", from: def.id };
            b.edge = null;
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
            b.reserved = null;
            b.route = null;
          } else if (t.phase === "branchLineOut" && elapsed >= TRAVEL) {
            t.phase = "branchOutside";
            t.finished = true;
            t.finishedAt = s.time;
            t.branchPermission = false;
            b.edge = null;
            s.log(`${t.id}: kilépett a modellhatáron (${def.name}).`);
          }
        }
      },
      // Nem kézi területen a gép kezeli a kiágazási meneteket is.
      autoHandle(s) {
        if (!s.auto) return;
        for (const t of s.trains) {
          if (!t.lineBranch?.id || t.finished || playerOwns(s, t.at)) continue;
          const b = this.state(s, t.lineBranch.id);
          if (t.phase === "branchRequest" || (t.phase === "parked" && t.lineBranch.direction === "out")) this.grant(s, t.id);
          if (t.branchPermission && b.edge === t.id && !b.route && ["branchLineIn", "branchHold", "branchReady"].includes(t.phase)) this.route(s, t.id);
          if (b.route?.id === t.id && !b.route.clear && !b.route.releaseAt && ["branchLineIn", "branchHold", "branchReady"].includes(t.phase)) this.clear(s, t.lineBranch.id);
        }
      },
    });

    P.throatLocked = function (station, side) {
      const lb = Object.values(this.lineBranches || {}).some((b) => b.station === station && b.route?.side === side);
      return lb || prevThroat.call(this, station, side);
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
    // 3) KÉTVÁGÁNYÚ ÁLLOMÁSI PULT — ahol az állomásköz kétvágányú, a pulton is két vonali vágány.
    //    Vágánykiosztás a KÖFI-vel azonos: 1. (felső) vonali vágány Pécs felé, 2. (alsó) Budapest felé,
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
    routePoints = function (s, side, track, kind, lane) {
      const g = geom(s),
        y = g.y(track),
        m = g.mid,
        sd = lineSides(s)[side];
      let ty = m;
      if (sd.double) ty = lane != null && sd.lanes[lane] ? sd.lanes[lane].y : kind === "in" ? sd.in : sd.out;
      let pts;
      if (sd.double)
        pts = side === "L" ? [[90, ty], [175, ty], [215, m], [350, y], [600, y]] : [[1110, ty], [1025, ty], [985, m], [850, y], [600, y]];
      else pts = side === "L" ? [[90, m], [215, m], [350, y], [600, y]] : [[1110, m], [985, m], [850, y], [600, y]];
      if (kind === "out") {
        pts.reverse();
        pts.push([side === "L" ? -80 : 1280, ty]);
      }
      return pts;
    };

    function branchStub(s, def, k, sides) {
      // k: hányadik kiágazás ezen az oldalon; a külső vonali vágányból ágazik ki, felfelé.
      const g = geom(s),
        sd = sides[def.side],
        outer = sd.double ? Math.min(...sd.lanes.map((l) => l.y)) : g.mid;
      const yb = outer - 44 - k * 36;
      return def.side === "L" ? { pts: [[15, yb], [68, yb], [130, outer]], label: [20, yb - 21], anchor: "start", sig: [68, yb] } : { pts: [[1185, yb], [1132, yb], [1070, outer]], label: [1180, yb - 21], anchor: "end", sig: [1132, yb] };
    }
    function branchTrainBox(t, x, y) {
      return `<g onclick="showTrain('${t.id}')" style="cursor:pointer"><rect x="${x - 27}" y="${y - 9}" width="54" height="18" rx="3" fill="#ffc36c" stroke="#603925" stroke-width="1.5"/><text x="${x}" y="${y + 4}" text-anchor="middle" fill="#2b1a05" font-size="10" font-weight="700">${esc(t.id)}</text></g>`;
    }

    drawStation = function () {
      const s = sim.selected,
        g = geom(s),
        sides = lineSides(s),
        branches = LB.at(s);
      let html = `<svg viewBox="0 0 1200 ${g.h}" role="img" aria-label="D55-jellegű kezelhető játékpult"><defs><pattern id="tiles" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" stroke="#26352255" stroke-width="1" fill="none"/></pattern></defs><rect width="1200" height="${g.h}" fill="url(#tiles)"/><text x="23" y="27" fill="#132a19" font-size="19">${esc(STATIONS[s].name.toUpperCase())} · D55-JELLEGŰ JÁTÉKPULT</text><text x="23" y="49" fill="#1a3221" font-size="12">Kezelhető gombok · első és második lezárás · sematikus vágányrajz, nem hiteles ÁVU-rajz${sides.L.double || sides.R.double ? " · kétvágányú vonali csatlakozás" : ""}</text>`;
      // vonali csatlakozások
      for (const side of ["L", "R"]) {
        const sd = sides[side];
        if (!sd.double) {
          html += drawPath(side === "L" ? `M15 ${g.mid}H215` : `M985 ${g.mid}H1185`, "#bac7b2", 6);
          continue;
        }
        for (const ln of sd.lanes) {
          const occupied = sd.sec.lanes[ln.lane].blocks.some((b) => b.owner);
          html += drawPath(side === "L" ? `M15 ${ln.y}H175L215 ${g.mid}` : `M985 ${g.mid}L1025 ${ln.y}H1185`, occupied ? "#d98c92" : "#bac7b2", 6);
          const lx = side === "L" ? 40 : 1160;
          html += `<text x="${lx}" y="${ln.y - 9}" text-anchor="middle" fill="#17321e" font-size="10">${ln.lane + 1}. vg ${ln.direction === 1 ? "→" : "←"}</text>`;
        }
      }
      g.tracks.forEach((tr) => {
        const y = g.y(tr),
          selectedL = (sim.switches[`${s}:L`] || g.tracks[0]) === tr,
          selectedR = (sim.switches[`${s}:R`] || g.tracks[0]) === tr,
          occ = sim.trains.some((t) => t.at === s && t.track === tr && t.phase === "parked"),
          closed = sim.closed[`${s}:${tr}`],
          queue = sim.queueAhead(s, tr, "__nobody__").length;
        html += drawPath(`M215 ${g.mid}L350 ${y}H850L985 ${g.mid}`, "#43573f", 6);
        if (selectedL) html += drawPath(`M215 ${g.mid}L350 ${y}H440`, "#d6dfc6", 4);
        if (selectedR) html += drawPath(`M760 ${y}H850L985 ${g.mid}`, "#d6dfc6", 4);
        html += drawPath(`M350 ${y}H850`, closed ? "#d9a358" : occ ? "#ff5b63" : "#bac7b2", 6);
        html += `<text x="600" y="${y + 26}" text-anchor="middle" fill="#17321e" font-size="12">${tr}. vágány${closed ? " · LEZÁRVA" : ""}${queue > (occ ? 1 : 0) ? ` · sorban: ${queue - (occ ? 1 : 0)}` : ""}</text>`;
        if (g.tracks.indexOf(tr) < 5) html += `<rect x="462" y="${y + 33}" width="276" height="7" fill="#c7cead" rx="2"/>`;
      });
      Object.values(sim.routes)
        .filter((r) => r.at === s)
        .forEach((r) => {
          const pts = routePoints(s, r.side, r.track, r.kind, routeLane(r)),
            d = "M" + pts.map((p) => p.join(",")).join("L");
          html += drawPath(d, r.releaseAt ? "#ffd16f" : "#f2f4df", 8, 'opacity=".85"');
        });
      // kiágazási csonkok
      const bySide = { L: 0, R: 0 };
      for (const def of branches) {
        const k = bySide[def.side]++,
          st = branchStub(s, def, k, sides),
          b = LB.state(sim, def.id),
          d = "M" + st.pts.map((p) => p.join(",")).join("L");
        html += drawPath(d, b.edge ? "#ff6d7c" : "#d9a358", 6);
        if (b.route)
          html += drawPath(
            "M" + [st.pts[1], st.pts[2], [def.side === "L" ? 215 : 985, g.mid], [def.side === "L" ? 350 : 850, g.y(b.route.track)], [600, g.y(b.route.track)]].map((p) => p.join(",")).join("L"),
            b.route.releaseAt ? "#ffd16f" : b.route.clear ? "#9df0b4" : "#f2f4df",
            8,
            'opacity=".85"',
          );
        html += `<circle cx="${st.sig[0]}" cy="${st.sig[1] - 10}" r="5" fill="${b.route?.clear ? "#65ff7e" : "#ff535e"}"/><text x="${st.label[0]}" y="${st.label[1]}" text-anchor="${st.anchor}" fill="#17321e" font-size="11">${esc(def.name)} · modellhatár${b.edge ? " · " + esc(b.edge) : ""}</text>`;
        // menetek a csonkon
        for (const t of sim.trains) {
          if (!t.lineBranch || t.finished || t.lineBranch.id !== def.id) continue;
          const el = sim.time - (t.branchSince ?? sim.time);
          let pos = null;
          const stub = [st.pts[0], st.pts[1]],
            throat = [st.pts[1], st.pts[2], [def.side === "L" ? 215 : 985, g.mid], [def.side === "L" ? 350 : 850, g.y(t.track)], [600, g.y(t.track)]];
          if (t.phase === "branchLineIn") pos = sample(stub, Math.min(1, el / TRAVEL) * length(stub));
          else if (t.phase === "branchHold") pos = sample(stub, length(stub));
          else if (t.phase === "branchEntering") pos = sample(throat, Math.min(1, el / THROAT) * length(throat));
          else if (t.phase === "branchLeaving") pos = sample([...throat].reverse(), Math.min(1, el / THROAT) * length(throat));
          else if (t.phase === "branchLineOut") pos = sample([...stub].reverse(), Math.min(1, el / TRAVEL) * length(stub));
          if (pos) html += branchTrainBox(t, pos.x, pos.y);
        }
      }
      g.tracks.forEach((tr) => {
        const y = g.y(tr);
        html += svgSignal(s, "KL-" + tr, 380, y, -1) + svgSignal(s, "KR-" + tr, 820, y, 1) + svgButton("KL-" + tr, 410, y + 17) + svgButton("KR-" + tr, 790, y + 17);
      });
      html +=
        svgSignal(s, "A", 145, sides.L.in, 1) +
        svgSignal(s, "B", 1055, sides.R.in, -1) +
        svgButton("A", 112, g.mid + 52) +
        svgButton("B", 1088, g.mid + 52) +
        svgButton("VL", 52, g.mid + 105, "exit") +
        svgButton("VR", 1148, g.mid + 105, "exit");
      html += svgButton("W-L", 265, 75, "switch") + svgButton("W-R", 935, 75, "switch");
      sim.trains.forEach((t) => {
        const p = sim.permissions[t.id];
        if (t.lineBranch && t.phase !== "parked") return; // a kiágazási menetek a csonkon mozognak
        if (t.phase === "parked" && t.at === s) {
          const y = g.y(t.track);
          html += consist(t, t.dir === 1 ? [[520, y], [680, y]] : [[680, y], [520, y]], 115);
        } else if (t.phase === "leaving" && t.at === s) {
          const pts = routePoints(s, t.dir === 1 ? "R" : "L", t.track, "out", p?.lane);
          html += consist(t, pts, 35 + t.progress * (length(pts) + 55));
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
          html += consist(t, pts, head);
          if (t.phase === "entering") {
            const a = sample(pts, head - 65),
              b = sample(pts, head);
            html += drawPath(`M${a.x} ${a.y}L${b.x} ${b.y}`, "#ff6262", 3);
          }
        }
      });
      const names = (side) => {
        const nb = side === "L" ? CONTROL_IDS[CONTROL_IDS.indexOf(s) - 1] : CONTROL_IDS[CONTROL_IDS.indexOf(s) + 1];
        return nb === undefined ? (side === "L" ? "Vonalvég" : "Vonalvég") : STATIONS[nb].name + " felől";
      };
      html += `<text x="20" y="${g.h - 18}" fill="#15321e" font-size="12">${esc(names("L"))} · A / VL${sides.L.double ? " · kétvágányú" : ""}</text><text x="1180" y="${g.h - 18}" text-anchor="end" fill="#15321e" font-size="12">B / VR · ${esc(names("R"))}${sides.R.double ? " · kétvágányú" : ""}</text></svg>`;
      $("board").innerHTML = html;
    };

    // ───────────────────────────────────────────────────────────────────
    // 4) FELÜLET — kiágazási panel az állomási nézetben, KÖFI-csonkok, sorrend a fogadóvágány-listában.
    // ───────────────────────────────────────────────────────────────────
    const panel = document.createElement("section");
    panel.id = "line-branch-controls";
    panel.className = "body";
    panel.hidden = true;
    (document.getElementById("godisa-controls") || document.getElementById("board")).after(panel);
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
      let html = `<h3>${esc(STATIONS[s].name)} · kiágazások (modellhatárig egy állomásköz)</h3><p class="small">${owned ? "Ezt az állomást te kezeled: a kiágazási engedély, vágányút és jelző a tiéd." : "Az állomás nincs a kézi területben: a kiágazásokat a gép kezeli."} A kiágazás állomásvége (Budapest/Pécs felőli) játékparaméter, nem ellenőrzött ÁVU-adat. A menetidő ${TRAVEL} perc, a be-/kijárat ${THROAT} perc.</p>`;
      for (const def of branches) {
        const b = LB.state(sim, def.id);
        html += `<div class="lb"><b>${esc(def.name)}</b> · ${def.side === "L" ? "Budapest felőli" : "Pécs felőli"} állomásvég · szakasz: ${b.edge ? '<span class="red">foglalt/lefoglalt: ' + esc(b.edge) + "</span>" : '<span class="green">szabad</span>'} · vágányút: ${b.route ? esc(b.route.id) + " · " + b.route.track + ". vg · " + (b.route.releaseAt ? "oldás folyamatban" : b.route.clear ? '<span class="green">Szabad</span>' : "Megállj") : "nincs"}<div><button onclick="lbAct('in','${def.id}')">Kézi tehermenet ${esc(def.name.replace(" felé", " felől"))}</button><button onclick="lbAct('clear','${def.id}')">Jelző Szabad</button><button onclick="lbAct('stop','${def.id}')">Megállj!</button><button onclick="lbAct('cancel','${def.id}')">Vágányút törlése / oldás</button></div><div class="small">A bejövő menet a Fogadóvágány-választóban kijelölt vágányra érkezik (alapvágány: első szabad).</div></div>`;
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
        o.textContent = o.dataset.base + (q.length ? ` · sorban fogadható (előtte ${q.length})` : "");
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
        const key = def.station + def.side,
          k = (counts[key] = (counts[key] || 0) + 1) - 1,
          b = LB.state(sim, def.id),
          x0 = def.side === "L" ? node.x : node.x + node.w,
          dx = def.side === "L" ? -1 : 1,
          yb = 250 - k * 62,
          x1 = x0 + dx * 110,
          x2 = x0 + dx * 250,
          g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute("data-linebranch", def.id);
        const tx = Math.min(x1, x2),
          w = Math.abs(x2 - x1);
        g.innerHTML = `<path d="M${x0} 400L${x1} ${yb}H${x2}" stroke="${b.edge ? "#ff747e" : "#e5b45f"}" stroke-width="4" fill="none"/><circle cx="${x1}" cy="${yb - 11}" r="4" fill="${b.route?.clear ? "#66ee95" : "#ff6c77"}"/><rect x="${tx}" y="${yb - 48}" width="${w}" height="30" rx="3" fill="#213f55" stroke="#e5b45f"/><text x="${tx + w / 2}" y="${yb - 36}" text-anchor="middle" fill="white" font-size="10">${esc(def.name)} · modellhatár</text><text x="${tx + w / 2}" y="${yb - 24}" text-anchor="middle" fill="#ffd085" font-size="9">${b.edge ? esc(b.edge) : "szabad"}${b.route ? " · vágányút " + (b.route.clear ? "Szabad" : "Megállj") : ""}</text>`;
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
