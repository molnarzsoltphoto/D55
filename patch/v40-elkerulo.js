(() => {
  "use strict";
  // VONAL 40 · 0.15 — Százhalombatta–Iváncsa elkerülő.
  //
  // Az Ercsit elkerülő szakasz a modellben Százhalombatta és Pusztaszabolcs között önálló, kétvágányú
  // állomásközként szerepel (Iváncsa megállóhely a modellben amúgy sem forgalmi szolgálati hely, az
  // elkerülő ott csatlakozik vissza). Aki Ercsiben és a Dunai Finomítónál nem áll meg, az ezen jár:
  // a 8xx InterCityk és a 42xx vonatok nagy része. Aki Ercsiben megáll (például a 4220), marad a
  // fővonalon. A tehervonatok szintén a fővonalon közlekednek.
  //
  // Nem hiteles: az elkerülő hossza a fővonali távolsággal (23,9 km) azonos, hogy a menetrendi
  // helyzetszámítás pontos maradjon; a valóságban a szakasz valamivel rövidebb. Az állomási pulton az
  // elkerülő a szokásos vonali vágányokon jelenik meg, külön rajza csak a KÖFI-ben van.
  const ELK = "10-14";
  const INNEN = 10,
    ODA = 14,
    HOSSZ = 23.9;

  function install() {
    if (typeof Simulation === "undefined" || typeof AutomaticBlocks === "undefined") return false;
    const P = Simulation.prototype;
    if (P._v40Elkerulo) return true;
    if (typeof P.ensureBlocks !== "function" || typeof P.next !== "function") return false;
    P._v40Elkerulo = true;

    function szakaszt(bs) {
      if (!bs || bs.sections[ELK]) return;
      const n = Math.ceil(HOSSZ / 2);
      bs.sections[ELK] = {
        id: ELK,
        from: INNEN,
        to: ODA,
        length: HOSSZ,
        double: true,
        elkerulo: true,
        allomasok: [13], // Iváncsa megállóhely az elkerülőn van, Ercsi és a Dunai Finomító nincs
        lanes: [0, 1].map((k) => ({
          id: `${ELK}/${k}`,
          direction: k === 0 ? -1 : 1,
          blocks: Array.from({ length: n }, (_, i) => ({ index: i, from: i * 2, to: Math.min(HOSSZ, (i + 1) * 2), owner: null })),
        })),
      };
    }

    const prevEnsure = P.ensureBlocks;
    P.ensureBlocks = function () {
      const r = prevEnsure.call(this);
      szakaszt(this.blockSystem);
      return r;
    };
    szakaszt(sim.blockSystem);

    // Elkerülőt használ: menetrendi vonat, amely sem Ercsiben (12), sem a Dunai Finomítónál (11) nem áll meg.
    const elkerulos = (t) => {
      if (!t || !t.menetrendi || !Array.isArray(t.plan) || t.plan.length < 2) return false;
      if (t.elkerulo !== undefined) return t.elkerulo;
      const megall = new Set(t.plan.filter((p) => p.source !== false).map((p) => p.station));
      const erinti = t.plan.some((p) => p.station === INNEN) && t.plan.some((p) => p.station === ODA);
      t.elkerulo = erinti && !megall.has(11) && !megall.has(12);
      return t.elkerulo;
    };
    globalThis.elkeruloVonat = elkerulos;

    const prevNext = P.next;
    P.next = function (t) {
      const n = prevNext.call(this, t);
      if (n !== 12 || !elkerulos(t)) return n;
      if (t.at === INNEN && t.dir === 1) return ODA;
      if (t.at === ODA && t.dir === -1) return INNEN;
      return n;
    };

    // ── KÖFI: az elkerülő a fővonal alatt, külön ívvel ──────────────────────────
    if (typeof globalThis.nwLayout === "function" && !globalThis.nwLayout._v40elkerulo) {
      const prevLayout = globalThis.nwLayout;
      const wrapped = function () {
        const L = prevLayout();
        const a = L.nodes[INNEN],
          b = L.nodes[ODA];
        if (a && b) {
          L.links[ELK] = { x1: a.x + a.w, x2: b.x, y: 700 };
          L.height = Math.max(L.height || 0, 900);
        }
        return L;
      };
      wrapped._v40elkerulo = true;
      globalThis.nwLayout = wrapped;
    }

    if (typeof globalThis.drawNetwork === "function" && !globalThis.drawNetwork._v40elkerulo) {
      const prevDraw = globalThis.drawNetwork;
      const wrapped = function () {
        prevDraw();
        const L = typeof NW !== "undefined" && NW.layout;
        const lyt = L && L.links[ELK];
        if (!NW.svg || !lyt) return;
        const a = L.nodes[INNEN],
          b = L.nodes[ODA],
          g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.id = "elkerulo-csatlakozas";
        g.innerHTML =
          `<path d="M${a.x + a.w} 400L${lyt.x1} ${lyt.y}" stroke="#46697e" stroke-width="3" fill="none"/>` +
          `<path d="M${lyt.x2} ${lyt.y}L${b.x} 400" stroke="#46697e" stroke-width="3" fill="none"/>` +
          `<text x="${(lyt.x1 + lyt.x2) / 2}" y="${lyt.y - 60}" text-anchor="middle" fill="#8fb6c9" font-size="13">Százhalombatta–Iváncsa elkerülő · Ercsi érintése nélkül</text>`;
        NW.svg.append(g);
      };
      wrapped._v40elkerulo = true;
      globalThis.drawNetwork = wrapped;
    }

    return true;
  }

  if (!install()) {
    let tries = 0;
    const timer = setInterval(() => {
      if (install() || ++tries > 40) clearInterval(timer);
    }, 50);
  }
})();
