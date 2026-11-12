(() => {
  "use strict";
  // VONAL 40 · 0.16 — elsőbbségi rend a gépi forgalomirányításban: InterCity > személyvonat > tehervonat.
  //
  // 1) Az automata ebben a sorrendben ad engedélyt (azonos szinten a tervezett indulás dönt).
  // 2) Alacsonyabb rangú vonat nem indul el egy állomásközre, ha ott rövidesen magasabb rangú jön:
  //    tehervonat vár a személyvonatra (12 perces előretekintés), személyvonat vár az IC-re (6 perc,
  //    azonos irányban) — így az IC a félretett személyvonat mellett elhalad.
  // 3) Kiéheztetés ellen: a visszatartás legfeljebb 45 perc a tehernél és 8 perc a személyvonatnál,
  //    hogy a személyvonati késés ne nőjön meg a sorban állástól.
  const SZEMELY_HORIZONT = 12,
    IC_HORIZONT = 10,
    MAX_TEHER = 45,
    MAX_SZEMELY = 8;

  function install() {
    if (typeof Simulation === "undefined" || typeof sim === "undefined") return false;
    const P = Simulation.prototype;
    if (P._v40Elsobbseg) return true;
    if (typeof P.grant !== "function") return false;
    P._v40Elsobbseg = true;

    const ic = (t) => /^8\d\d$/.test(String(t.number || t.id || ""));
    // 2 = InterCity, 1 = egyéb menetrendi vonat, 0 = tehervonat
    const szint = (t) => (ic(t) ? 2 : t.menetrendi || t.kind === "passenger" ? 1 : 0);

    if (typeof globalThis.autoOutside === "function" && !globalThis.autoOutside._v40elsobbseg) {
      const prev = globalThis.autoOutside;
      const wrapped = function (s) {
        const eredeti = s.trains;
        s._gepiEngedely = true;
        try {
          s.trains = [...eredeti].sort((a, b) => szint(b) - szint(a) || (a.dep ?? 0) - (b.dep ?? 0));
          return prev(s);
        } finally {
          const sorrend = new Map(eredeti.map((t, i) => [t.id, i]));
          s.trains = [...s.trains].sort((a, b) => (sorrend.get(a.id) ?? 1e9) - (sorrend.get(b.id) ?? 1e9));
          s._gepiEngedely = false;
        }
      };
      wrapped._v40elsobbseg = true;
      globalThis.autoOutside = wrapped;
    }

    // Magasabb rangú vonat várható-e ugyanarra az állomásközre?
    P.elozoVonat = function (t, to) {
      const sec = this.blockSystem.section(t.at, to);
      if (!sec) return null;
      const vegek = [sec.from, sec.to];
      const sajatSzint = szint(t);
      const horizont = sajatSzint === 0 ? SZEMELY_HORIZONT : IC_HORIZONT;
      for (const p of this.trains) {
        if (p.id === t.id || p.finished || szint(p) <= sajatSzint) continue;
        // Utolérés megelőzése: ha a magasabb rangú vonat a tervek szerint velünk egy időben (vagy
        // előbb) érne a következő állomásra, nem állunk elé, mert az állomásközben már nem előzhet.
        if (p.dir === t.dir) {
          const mienk = t.plan?.find((x) => x.station === to),
            ove = p.plan?.find((x) => x.station === to);
          if (mienk && ove) {
            const sajatErk = mienk.arr + (t.delay || 0),
              oveErk = ove.arr + (p.delay || 0);
            if (oveErk >= this.time - 5 && oveErk <= sajatErk + 3) return { vonat: p, kiadott: false };
          }
        }
        // kétvágányú szakaszon az ellenirány nem zavar; egyvágányún igen (keresztezés), ezért ott az
        // alacsonyabb rangú vonat a szembejövő magasabb rangút is megvárja
        const ellenirany = p.dir !== t.dir;
        if (ellenirany && sec.double) continue;
        // Keresztezés az egyvágányú szakaszon: ha a szembejövő magasabb rangú vonat előbb ideérne,
        // mint ahogy mi a szakaszt elhagynánk, nem foglaljuk el előle.
        if (ellenirany && !sec.double) {
          const ide = p.plan?.find((x) => x.station === t.at),
            innen = t.plan?.find((x) => x.station === t.at),
            oda = t.plan?.find((x) => x.station === to);
          if (ide && innen && oda) {
            const futas = Math.max(2, oda.arr - innen.dep),
              oveIde = ide.arr + (p.delay || 0);
            if (oveIde >= this.time - 5 && oveIde <= this.time + futas + 3) return { vonat: p, kiadott: false };
          }
        }
        const perm = this.permissions[p.id];
        if (perm && perm.section === sec.id) return { vonat: p, kiadott: true };
        // menetvonallal közlekedő tehervonatot nem tartunk vissza előre: a menetvonala eleve a
        // személyforgalom résébe illeszkedik
        if (t.menetvonal) continue;
        if (p.phase !== "parked" || !vegek.includes(p.at)) continue;
        const kov = this.next(p);
        if (kov == null || !vegek.includes(kov) || kov === p.at) continue;
        if ((p.dep ?? 0) <= this.time + horizont) return { vonat: p, kiadott: false };
      }
      return null;
    };

    const prevGrant = P.grant;
    P.grant = function (id, track) {
      const t = this.trains.find((x) => x.id === id);
      if (!this._gepiEngedely || !t || szint(t) === 2) return prevGrant.call(this, id, track);
      const to = this.next(t);
      if (to == null) return prevGrant.call(this, id, track);
      const utban = this.elozoVonat(t, to);
      if (utban) {
        const varakozik = this.time - (t.dep ?? this.time);
        const max = szint(t) === 0 ? MAX_TEHER : MAX_SZEMELY;
        if (utban.kiadott || varakozik < max) {
          t.vartElsobbseg = utban.vonat.id;
          return { ok: false, msg: `${utban.vonat.id} elsőbbséget élvez, ${szint(t) === 0 ? "a tehervonat" : "a személyvonat"} vár.` };
        }
      }
      delete t.vartElsobbseg;
      return prevGrant.call(this, id, track);
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
