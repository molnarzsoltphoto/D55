(() => {
  "use strict";
  // VONAL 40 · 0.12.1 — a PDF-menetrend ablak a kiágazó vonalak vonatait is mutatja.
  // Eddig csak a fővonali REAL_TIMETABLE 239 vonata szerepelt benne, a BRANCH_TIMETABLE 542 vonata
  // (győri, székesfehérvári, dunaújvárosi, bajai, kaposvári, komlói, sellyei, szigetvári stb. menetek)
  // közlekedett, de nem látszott a listában. A fővonali menetrendnek azt a vonatát, amelyet egy
  // kiágazási bejegyzés kivált (`replaces`), a lista a kiágazási változatban mutatja.
  function install() {
    if (typeof STATIONS === "undefined" || typeof document === "undefined") return false;
    const dialog = document.getElementById("timetableDialog");
    if (!dialog) return false;

    const fmt = (m) => {
      const t = ((Math.round(m) % 1440) + 1440) % 1440;
      return Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0");
    };
    const esc = (v) =>
      String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const branches = () => (typeof LineBranches !== "undefined" && LineBranches.list) || globalThis.LINE_BRANCHES || [];
    const branchName = (id) => {
      const def = branches().find((b) => b.id === id);
      if (!def) return id || "kiágazás";
      // „Baja felé (Szekszárd, Bátaszék)” → „Baja”
      return def.name.replace(/\s*\(.*\)\s*$/, "").replace(/\s+felé$/, "");
    };

    function sorok() {
      const real = globalThis.REAL_TIMETABLE || [];
      const branch = globalThis.BRANCH_TIMETABLE || [];
      const kivaltott = new Set(branch.map((t) => t.replaces).filter(Boolean));
      const list = [];
      for (const t of real) {
        if (kivaltott.has(t.id)) continue;
        list.push({
          szam: t.number,
          vonal: (t.lines || []).join(", ") || "40",
          hon: STATIONS[t.stops[0].station].name,
          ind: t.stops[0].dep,
          hova: STATIONS[t.stops.at(-1).station].name,
          erk: t.stops.at(-1).arr,
          kiagazas: false,
        });
      }
      for (const t of branch) {
        // A kiágazáson érkező/távozó vonatnál az idő a modellezett szakasz széle (a csatlakozó állomás),
        // nem a vonal végállomásának menetrendi ideje – ezért szerepel zárójelben a csatlakozó állomás.
        const first = t.stops[0], last = t.stops.at(-1);
        list.push({
          szam: t.number,
          vonal: (t.lines || []).join(", "),
          hon: t.from ? branchName(t.from) + " felől (" + STATIONS[first.station].name + ")" : STATIONS[first.station].name,
          ind: first.dep,
          hova: t.to ? branchName(t.to) + " felé (" + STATIONS[last.station].name + ")" : STATIONS[last.station].name,
          erk: last.arr,
          kiagazas: true,
        });
      }
      return list.sort((a, b) => a.ind - b.ind || a.szam.localeCompare(b.szam));
    }

    let osszes = null;
    function rajzol(szuro) {
      osszes ||= sorok();
      const q = (szuro || "").trim().toLowerCase();
      const sz = q
        ? osszes.filter((r) => (r.szam + " " + r.vonal + " " + r.hon + " " + r.hova).toLowerCase().includes(q))
        : osszes;
      document.getElementById("timetableRows").innerHTML =
        sz
          .slice(0, 900)
          .map(
            (r) =>
              `<tr><td>${esc(r.szam)}</td><td>${esc(r.vonal)}</td><td>${esc(r.hon)}</td><td>${fmt(r.ind)}</td><td>${esc(r.hova)}</td><td>${fmt(r.erk)}</td></tr>`
          )
          .join("") || '<tr><td colspan="6">Nincs találat.</td></tr>';
      const info = document.getElementById("timetableInfo");
      if (info)
        info.textContent =
          sz.length +
          " vonat" +
          (q ? " a szűrésben" : "") +
          " · ebből " +
          sz.filter((r) => r.kiagazas).length +
          " érinti valamelyik kiágazást" +
          (sz.length > 900 ? " · az első 900 látszik" : "");
    }

    // fejléc és szűrőmező
    const fej = dialog.querySelector("thead tr");
    if (fej && fej.children.length === 5)
      fej.innerHTML = "<th>Vonat</th><th>Vonal</th><th>Kezdőpont</th><th>Indulás</th><th>Végpont</th><th>Érkezés</th>";
    if (!document.getElementById("timetableFilter")) {
      const sor = document.createElement("div");
      sor.className = "body row";
      sor.innerHTML =
        '<label>Szűrés <input id="timetableFilter" type="search" placeholder="vonatszám, vonal vagy állomás" size="28"></label> <span id="timetableInfo" class="small"></span>';
      dialog.querySelector("h2").after(sor);
      sor.querySelector("input").addEventListener("input", (e) => rajzol(e.target.value));
    }
    const cim = dialog.querySelector("h2");
    if (cim) cim.textContent = "Menetrend · fővonal és kiágazó vonalak";
    dialog.style.width = "min(1150px,94vw)";

    globalThis.timetableList = function () {
      rajzol(document.getElementById("timetableFilter")?.value || "");
      dialog.showModal();
    };

    // a menüsor gombján a teljes vonatszám
    for (const b of document.querySelectorAll("nav button"))
      if (/PDF-menetrend/.test(b.textContent)) b.textContent = "Menetrend · " + sorok().length;

    return true;
  }

  if (!install()) {
    let tries = 0;
    const timer = setInterval(() => {
      if (install() || ++tries > 40) clearInterval(timer);
    }, 50);
  }
})();
