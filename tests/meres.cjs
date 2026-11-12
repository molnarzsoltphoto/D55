// 24 órás gépi futás osztályonkénti késésstatisztikával.
// A tehervonat-generálás véletlenszerű, ezért a Math.random-ot rögzített maggal
// helyettesítjük: csak így hasonlítható össze két változat egymással.
// Használat: node tests/meres.cjs [index.html útvonala] [mag]
const { chromium } = require("playwright");
const path = require("path");

const FAJL = path.resolve(process.argv[2] || path.join(__dirname, "..", "index.html"));
const MAG = Number(process.argv[3] || 1);

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e).slice(0, 250)));
  await p.addInitScript((mag) => {
    let a = mag >>> 0;
    Math.random = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }, MAG);
  await p.goto("file://" + FAJL);
  await p.waitForFunction(() => typeof sim !== "undefined");

  const r = await p.evaluate(() => {
    sim.auto = true;
    sim.playerControl = { stations: [] };
    const ic = (t) => /^8\d\d$/.test(String(t.number || ""));
    const ok = {
      "egyperces megállás": 0, "nincs engedély": 0,
      "kijárati jelző nem szabad": 0, "menetrend szerint vár": 0,
    };
    const vanKijarat = (t) => {
      const j = (t.dir === 1 ? "KR-" : "KL-") + t.track;
      const x = sim.getRoute(t.at, j);
      return !!(x && x.clear);
    };
    const latott = new Map();
    for (let i = 0; i < 24 * 60 * 10; i++) {
      sim.tick(0.1);
      if (i % 10) continue;
      for (const t of sim.trains) {
        if (!t.menetrendi) {
          latott.set(t.id, { oszt: "teher", kesz: t.finished, delay: t.delay || 0 });
          continue;
        }
        latott.set(t.id, { oszt: ic(t) ? "IC" : "személy", kesz: t.finished, delay: t.delay || 0 });
        if (t.finished || t.phase !== "parked") continue;
        const terv = t.plan?.find((x) => x.station === t.at);
        if (!terv || t.at === t.endStation || sim.time <= terv.dep + 0.001) continue;
        if (sim.time < (t.dep ?? 0)) ok["egyperces megállás"]++;
        else if (!sim.permissions[t.id]) ok["nincs engedély"]++;
        else if (!vanKijarat(t)) ok["kijárati jelző nem szabad"]++;
        else ok["menetrend szerint vár"]++;
      }
    }
    const osztaly = (nev, cel) => {
      const v = [...latott.values()].filter((x) => x.oszt === nev);
      const k = v.filter((x) => x.kesz).map((x) => x.delay).sort((a, b) => a - b);
      const atl = k.length ? k.reduce((a, b) => a + b, 0) / k.length : 0;
      return {
        indult: v.length, celba: k.length,
        atlag: Math.round(atl * 10) / 10,
        median: k.length ? Math.round(k[k.length >> 1] * 10) / 10 : 0,
        max: k.length ? Math.round(k[k.length - 1]) : 0,
        celonBelul: k.filter((x) => x <= cel).length,
      };
    };
    return {
      IC: osztaly("IC", 10), szemely: osztaly("személy", 15), teher: osztaly("teher", 30),
      varakozasOka: ok,
    };
  });
  console.log(JSON.stringify({ fajl: path.basename(path.dirname(FAJL)), mag: MAG, ...r }));
  if (errs.length) console.log("HIBÁK", errs);
  await b.close();
})();
