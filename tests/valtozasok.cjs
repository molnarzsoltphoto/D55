// A 0.12 változások ellenőrzése böngészőben: IC-k Budapest-Déliig, kiágazások, megállási idő,
// előengedély-korlát (kézzel 3 állomásköz, automatikusan 1), eltávolított godisai modul.
const { chromium } = require("playwright");
const path = require("path");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const hibak = [];
  page.on("pageerror", (e) => hibak.push(String(e).slice(0, 200)));
  await page.goto("file://" + path.resolve(__dirname, "../index.html"));
  await page.waitForFunction(() => typeof sim !== "undefined" && sim && Array.isArray(sim.trains));
  const r = await page.evaluate(() => {
    const out = {};
    // 1) IC-k
    const ic = REAL_TIMETABLE.filter((t) => /^8\d\d$/.test(t.number));
    out.icSzam = ic.length;
    out.icDeliVeg = ic.filter((t) => t.stops[0].station === 0 || t.stops.at(-1).station === 0).length;
    out.icPelda = ic
      .filter((t) => t.number === "800" || t.number === "809")
      .map((t) => t.number + ": " + t.stops.map((s) => STATIONS[s.station].name + " " + Math.floor(s.arr / 60) + ":" + String(Math.round(s.arr % 60)).padStart(2, "0")).join(" → "));
    // 2) kiágazások
    out.kiagazasok = (globalThis.LINE_BRANCH_LIST || []).length || null;
    out.godisaBranchModul = typeof GodisaBranch !== "undefined";
    out.godisaRajz = !!document.getElementById("godisaSource");
    out.kezdoAllomas = STATIONS[sim.selected].name;
    out.szazhalombatta = STATIONS[10].tracks.join(",");
    out.modellhatarSzo = document.body.innerHTML.includes("modellhatár");
    // 3) megállási idő: egy menetrendi vonat késve érkezik
    out.megallas = typeof timetableDeparture === "function"
      ? {
          idoben: timetableDeparture(100, { dep: 102, source: true }),
          keses_megallo: timetableDeparture(110, { dep: 102, source: true }),
          keses_athaladas: timetableDeparture(110, { dep: 102, source: false }),
        }
      : null;
    // 4) előengedély
    out.forwardLimit = (sim.forwardState(), sim.forwardLimit);
    out.autoForwardKorlat = sim._v40EloEngedely === true;
    return out;
  });
  // 5) gépi futás: ad-e a gép előengedélyt?
  const forward = await page.evaluate(() => {
    sim.auto = true;
    sim.playerControl = { stations: [] };
    for (let i = 0; i < 1800; i++) sim.tick(0.1);
    const lists = sim.trains.filter((t) => !t.finished).map((t) => sim.permissionList(t.id).length);
    return { max: lists.length ? Math.max(...lists) : 0, tobbEngedely: lists.filter((n) => n > 1).length, vonat: lists.length };
  });
  // 6) kézi előengedély: három állomásközre adható
  const manual = await page.evaluate(() => {
    const s = new Simulation();
    s.auto = false;
    s.forwardState();
    for (let i = 0; i < 20; i++) s.tick(0.1);
    let legjobb = { engedelyek: 0, lepesek: ["nincs alkalmas vonat"] };
    for (const t of s.trains) {
      if (t.finished || t.phase !== "parked" || s.next(t) == null) continue;
      const lepesek = [];
      for (let i = 0; i < 5; i++) {
        const jelolt = s.aheadCandidate(t.id);
        const r = jelolt ? s.grantAhead(t.id) : { ok: false, msg: "nincs jelölt (korlát)" };
        lepesek.push((jelolt ? "jelölt→" + STATIONS[jelolt.to].name : "–") + " · " + (r.ok ? "megadva" : r.msg));
        if (!r.ok) break;
      }
      const n = s.permissionList(t.id).length;
      if (n > legjobb.engedelyek) legjobb = { vonat: t.id, engedelyek: n, lepesek };
    }
    return legjobb;
  });
  await browser.close();
  console.log(JSON.stringify({ ...r, gepiElorekeszites: forward, keziElorekeszites: manual, hibak }, null, 1));
})();
