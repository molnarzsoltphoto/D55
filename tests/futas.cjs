// Headless futásellenőrzés: betölti az index.html-t Chromiumban, gépi kezeléssel végigfuttat egy szolgálatot,
// és megszámolja, mely vonatok indultak el, érkeztek célba, illetve ragadtak be. Használat:
//   node tests/futas.cjs [óra] [kezdés perc]
const { chromium } = require("playwright");
const path = require("path");

(async () => {
  const hours = Number(process.argv[2] || 12);
  const start = Number(process.argv[3] || 360);
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const hibak = [];
  page.on("pageerror", (e) => hibak.push(String(e).slice(0, 200)));
  await page.goto("file://" + path.resolve(__dirname, "../index.html"));
  await page.waitForFunction(() => typeof sim !== "undefined" && sim && Array.isArray(sim.trains));
  const out = await page.evaluate(
    ([hours, start]) => {
      sim.time = start;
      sim.serviceStart = start;
      sim.auto = true;
      const auto = document.getElementById("auto");
      if (auto) auto.checked = true;
      sim.playerControl = { stations: [] };
      const steps = hours * 60 * 10;
      const seen = new Map();
      for (let i = 0; i < steps; i++) {
        sim.tick(0.1);
        if (i % 10 === 0)
          for (const t of sim.trains)
            seen.set(t.id, {
              line: (t.sourceLines || []).join("+") || "40",
              branch: !!t.branchService,
              menetrendi: !!t.menetrendi,
              kesz: t.finished,
              at: t.at,
              delay: t.delay || 0,
              branchId: t.lineBranch?.id || t.viaBranch || t.exitBranch || null,
            });
      }
      const osszes = {};
      for (const v of seen.values()) {
        const k = v.line + (v.branch ? " (kiágazás)" : "");
        osszes[k] ||= { indult: 0, celba: 0 };
        osszes[k].indult++;
        if (v.kesz) osszes[k].celba++;
      }
      const branchUse = {};
      for (const v of seen.values()) if (v.branchId) branchUse[v.branchId] = (branchUse[v.branchId] || 0) + 1;
      const line = (t) => (t.sourceLines || []).join("+") || "40";
      const stuck = sim.trains.filter((t) => !t.finished && t.phase === "parked" && sim.time - (t.dep ?? sim.time) > 20);
      const byLine = {};
      for (const t of sim.trains) {
        const k = line(t) + (t.branchService ? " (kiágazás)" : "");
        byLine[k] ||= { osszes: 0, kesz: 0, uton: 0, all: 0 };
        byLine[k].osszes++;
        if (t.finished) byLine[k].kesz++;
        else if (t.phase === "parked") byLine[k].all++;
        else byLine[k].uton++;
      }
      const branches = {};
      for (const t of sim.trains) {
        const b = t.lineBranch?.id || t.viaBranch || t.exitBranch;
        if (b) branches[b] = (branches[b] || 0) + 1;
      }
      const delays = sim.trains.filter((t) => t.menetrendi).map((t) => t.delay || 0);
      return {
        ido: sim.time,
        vonat: sim.trains.length,
        kesz: sim.trains.filter((t) => t.finished).length,
        beragadt: stuck.map((t) => t.id + "@" + (STATIONS[t.at]?.name || t.at)).slice(0, 15),
        beragadtSzam: stuck.length,
        atlagKeses: delays.length ? +(delays.reduce((a, b) => a + b, 0) / delays.length).toFixed(1) : 0,
        maxKeses: delays.length ? Math.max(...delays) : 0,
        osszesIndult: seen.size,
        osszesCelba: [...seen.values()].filter((v) => v.kesz).length,
        osszes,
        branchUse,
        byLine,
        branches,
        tt: (globalThis.REAL_TIMETABLE || []).length,
        bt: (globalThis.BRANCH_TIMETABLE || []).length,
      };
    },
    [hours, start]
  );
  await browser.close();
  console.log(JSON.stringify({ ...out, hibak: hibak.slice(0, 5) }, null, 1));
})();
