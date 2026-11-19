// Összeveti a rajzot a motorral: minden állomáson, minden oldalon, minden vágányra
// megnézi, hogy a kirajzolt vágányrajzon (visszatolatás nélkül, csak kifelé haladva)
// elérhető-e minden olyan kivezetés, amit a motor megenged — és fordítva.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 2300, height: 1300 } });
  await p.goto('file://' + require('path').resolve(process.argv[2] || require('path').join(__dirname, '..', 'index.html')));
  await p.waitForFunction(() => typeof sim !== 'undefined' && globalThis.D55Terv);
  const r = await p.evaluate(() => {
    const out = [];
    const K = (x, y) => Math.round(x) + ',' + Math.round(y);
    for (const st of STATIONS.filter((x) => x.control).map((x) => x.id)) {
      sim.view = 'station'; sim.selected = st; render();
      const svg = document.querySelector('#board svg'), g = geom(st);
      const { terv, stubok } = D55Terv(st);
      const segs = [];
      for (const e of svg.querySelectorAll('path')) {
        const d = e.getAttribute('d') || '';
        if (+(e.getAttribute('stroke-width') || 0) !== 12) continue;
        let cx = 0, cy = 0;
        for (const t of d.match(/[MLHV][-\d., ]+/g) || []) {
          const n = (t.slice(1).match(/-?\d+(\.\d+)?/g) || []).map(Number);
          if (t[0] === 'M') { for (let i = 0; i + 1 < n.length; i += 2) { if (i) segs.push([cx, cy, n[i], n[i + 1]]); cx = n[i]; cy = n[i + 1]; } }
          else if (t[0] === 'L') { for (let i = 0; i + 1 < n.length; i += 2) { segs.push([cx, cy, n[i], n[i + 1]]); cx = n[i]; cy = n[i + 1]; } }
          else if (t[0] === 'H') for (const x of n) { segs.push([cx, cy, x, cy]); cx = x; }
          else if (t[0] === 'V') for (const y of n) { segs.push([cx, cy, cx, y]); cy = y; }
        }
      }
      const rajta = (px, py, s) => {
        const dx = s[2] - s[0], dy = s[3] - s[1], L = dx * dx + dy * dy;
        if (!L) return false;
        const t = ((px - s[0]) * dx + (py - s[1]) * dy) / L;
        if (t < -0.004 || t > 1.004) return false;
        return Math.hypot(px - (s[0] + t * dx), py - (s[1] + t * dy)) < 2.5;
      };
      for (const { st: s2 } of stubok)
        for (const sor of [s2.pts, s2.pts2]) {
          if (!sor) continue;
          for (let i = 0; i + 1 < sor.length; i++) segs.push([sor[i][0], sor[i][1], sor[i + 1][0], sor[i + 1][1]]);
        }
      for (const side of ['L', 'R']) {
        const T = terv[side], tx = T.tx, ki = side === 'L' ? -1 : 1;
        const sd = D55Oldalak(st)[side];
        const P = D55Pult(st);
        const bejaratok = [{ id: 'fo', pts: (sd.double ? sd.lanes.map((l) => l.y) : [sd.in]).map((y) => [P.szel[side], y]) }];
        for (const { def, st: s2 } of stubok)
          if (def.side === side && s2.bazis) bejaratok.push({ id: def.id, pts: [s2.pts[0], ...(s2.pts2 ? [s2.pts2[0]] : [])] });
        // pontháló
        const pontok = new Map();
        const felvesz = (x, y) => { const k = K(x, y); if (!pontok.has(k)) pontok.set(k, [x, y]); };
        for (const s of segs) { felvesz(s[0], s[1]); felvesz(s[2], s[3]); }
        for (const t of g.tracks) felvesz(tx, g.y(t));
        for (const be of bejaratok) for (const q of be.pts) felvesz(q[0], q[1]);
        // a váltópontok (ahol a ferde váltósor a vágány vízszintesébe ér) a szakaszok
        // belsejébe esnek: csomópontként fel kell venni őket
        for (const be of bejaratok) for (const t of g.tracks) {
          const u = T.ut(be.id, t);
          if (u) for (const q of u) felvesz(q[0], q[1]);
        }
        const el = new Map(); for (const [k] of pontok) el.set(k, new Set());
        for (const s of segs) {
          const sor = [...pontok.values()].filter(([x, y]) => rajta(x, y, s)).sort((a, z) => (a[0] - z[0]) * ki);
          for (let i = 0; i + 1 < sor.length; i++) {
            const a = sor[i], z = sor[i + 1];
            if ((z[0] - a[0]) * ki > 0.5) el.get(K(a[0], a[1])).add(K(z[0], z[1]));
          }
        }
        for (const t of g.tracks) {
          const start = K(tx, g.y(t)), latott = new Set([start]), sor = [start];
          while (sor.length) { const k = sor.pop(); for (const q of el.get(k) || []) if (!latott.has(q)) { latott.add(q); sor.push(q); } }
          for (const be of bejaratok) {
            const rajz = be.pts.some((q) => latott.has(K(q[0], q[1])));
            const lista = be.id === 'fo'
              ? (window.VaganyKorlat?.[st]?.[side] || null)
              : (LineBranches.byId(be.id)?.tracks || null);
            const motor = (!lista || lista.includes(t)) && T.van(be.id, t);
            if (rajz !== motor) out.push({ allomas: STATIONS[st].name, side, vagany: t, be: be.id, motor, rajz });
          }
        }
      }
    }
    return out;
  });
  // A KÖFI állomásrajza ugyanabból a torokrajzból dolgozik, mint a pult: a vágánysorrendnek
  // egyeznie kell, és a torok nem lóghat ki az állomásdobozból.
  const kofi = await p.evaluate(() => {
    setView("kofi");
    render();
    const L = NW.layout, baj = [];
    for (const el of NW.svg.querySelectorAll("[data-nettrack]")) {
      const [sid] = el.getAttribute("data-nettrack").split(":");
      const n = L.nodes[sid], st = STATIONS[sid];
      const d = el.previousElementSibling?.getAttribute("d") || "";
      const nums = (d.match(/-?\d+(\.\d+)?/g) || []).map(Number);
      const xs = nums.filter((_, i) => i % 2 === 0), ys = nums.filter((_, i) => i % 2 === 1);
      if (!xs.length) continue;
      const top = n.y - (st.tracks.length - 1) * 13 - 60, bot = n.y + (st.tracks.length - 1) * 13 + 50;
      if (xs.some((x) => x < n.x - 1 || x > n.x + n.w + 1)) baj.push(st.name + ": a torok kilóg oldalt");
      if (ys.some((y) => y < top - 1 || y > bot + 1)) baj.push(st.name + ": a torok kilóg függőlegesen");
    }
    for (const sid of L.ids) {
      const g = geom(sid), n = L.nodes[sid];
      const a = [...STATIONS[sid].tracks].sort((x, y) => n.ty(x) - n.ty(y)).join();
      const b = [...g.tracks].sort((x, y) => g.y(x) - g.y(y)).join();
      if (a !== b) baj.push(STATIONS[sid].name + ": a KÖFI vágánysorrendje nem a pultét követi");
    }
    // Semmi nem lóghat a levegőbe: a torokrajz minden vonalvége vagy a doboz szélén, vagy a
    // vágányak egyenes szakaszánál, vagy a kiágazás cimkéjénél van, vagy másik vonal folytatja.
    for (const sid of L.ids) {
      const n = L.nodes[sid], utak = [];
      for (const el of NW.svg.querySelectorAll(`[data-nettrack^="${sid}:"]`)) {
        const pr = el.previousElementSibling;
        if (pr && pr.tagName === "path") utak.push(pr.getAttribute("d"));
      }
      const cimkeVeg = new Set();
      for (const g2 of NW.svg.querySelectorAll("[data-linebranch]")) {
        const def = LineBranches.byId(g2.getAttribute("data-linebranch"));
        if (!def || def.station !== sid) continue;
        for (const el of g2.querySelectorAll("path")) {
          const d = el.getAttribute("d");
          utak.push(d);
          const m = /H(-?[\d.]+)$/.exec(d);
          if (m) cimkeVeg.add(Number(m[1]).toFixed(0));
        }
      }
      const K = (x, y) => x.toFixed(0) + "," + y.toFixed(0), szak = new Set();
      for (const d of utak) {
        let cx = 0, cy = 0;
        for (const t of d.match(/[MLH][-\d. ]+/g) || []) {
          const c = t.slice(1).trim().split(/[ ,]+/).map(Number);
          const nx = c[0], ny = t[0] === "H" ? cy : c[1];
          if (t[0] !== "M" && K(cx, cy) !== K(nx, ny)) {
            const a2 = K(cx, cy), b2 = K(nx, ny);
            szak.add(a2 < b2 ? a2 + "|" + b2 : b2 + "|" + a2);
          }
          cx = nx; cy = ny;
        }
      }
      const fok = {};
      for (const s of szak) for (const v of s.split("|")) fok[v] = (fok[v] || 0) + 1;
      const szabad = (x) =>
        Math.abs(x - n.x) < 2 || Math.abs(x - (n.x + n.w)) < 2 ||
        Math.abs(x - (n.x + n.bal)) < 2 || Math.abs(x - (n.x + n.bal + 216)) < 2 ||
        cimkeVeg.has(x.toFixed(0));
      for (const [v, f] of Object.entries(fok))
        if (f === 1 && !szabad(Number(v.split(",")[0])))
          baj.push(STATIONS[sid].name + ": a KÖFI-ban a levegőbe lóg egy vonal (" + v + ")");
    }
    return [...new Set(baj)];
  });
  if (kofi.length) {
    console.log(JSON.stringify(kofi, null, 1));
    process.exitCode = 1;
  }

  if (r.length) {
    console.log(JSON.stringify(r, null, 1));
    process.exitCode = 1;
  }
  console.log(JSON.stringify({ eltérés: r.length, kofi: kofi.length }));
  await b.close();
})();
