"use strict";
let game=null,mode="route",startBtn=null,fb=null;
const $=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const stateName={sched:"Később érkezik",request:"Engedélykérés",granted:"Engedélyezve",signal:"Jelző előtt vár",entering:"Behalad",stopped:"Áll",parked:"Indulásra kész",leaving:"Kijár",passing:"Áthalad",gone:"Lezárult"};
const kindName={stop:"megáll",pass:"áthalad",term:"végállomás",origin:"innen indul"};
function feedback(ok,m){fb={ok,m};}
function newGame(){const si=Number($("station").value),st=Number($("start").value);game=new StationGame(si,st);startBtn=null;fb=null;render();}
function act(r,okMsg){feedback(r.ok,r.ok?okMsg:r.msg);render();}
function press(name){
 if(mode==="route"){
  if(!startBtn){if(name==="VL"||name==="VR"||name.startsWith("T-")){feedback(false,"Kezdőgombnak jelzőt válassz (A, B, L-… vagy R-…).");render();return;}startBtn=name;feedback(true,name+" kijelölve. Válaszd a célgombot.");render();}
  else{if(name===startBtn){startBtn=null;feedback(true,"Kijelölés elvetve.");render();return;}const a=startBtn,r=game.setRoute(a,name);if(r.ok)startBtn=null;act(r,a+" → "+name+": vágányút lezárva, a jelző még Megállj.");}
 }else if(mode==="clear")act(game.clearSignal(name),name+": Szabad.");
 else if(mode==="stop")act(game.stopSignal(name),name+": Megállj.");
 else if(mode==="cancel")act(game.cancelRoute(name),name+": oldás elfogadva.");
}
function setMode(m){mode=m;startBtn=null;render();}
function grant(id){const sel=document.getElementById("tr-"+id);act(game.grant(id,sel?sel.value:undefined),id+": engedély megadva.");}
function revoke(id){act(game.revokePermission(id),id+": engedély visszavonva.");}
function path(d,c,w=5,x=""){return `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" ${x}/>`;}
function layout(){const n=game.tracks.length,ymid=100+Math.floor((n-1)/2)*52;return {n,ymid,y:i=>100+i*52,H:200+n*52};}
function btn(name,x,y,cls,label,lamp){const sel=startBtn===name,r=game.route(name);return `<g class="point" data-btn="${name}" tabindex="0" role="button" aria-label="${esc(label||name)}" onclick="press('${name}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();press('${name}')}"><circle class="ring" cx="${x}" cy="${y}" r="12" fill="${cls}" stroke="${sel?"#ffe479":"#8abe80"}" stroke-width="${sel?4:2}"/>${lamp?`<circle cx="${x}" cy="${y-21}" r="4" fill="${r&&r.clear?"#68ff91":"#273d29"}"/>`:""}<text x="${x}" y="${y+25}" text-anchor="middle" fill="#17331f" font-size="11">${esc(label||name)}</text></g>`;}
function samplePath(pts,f){let L=0;const seg=[];for(let i=1;i<pts.length;i++){const l=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);seg.push(l);L+=l;}let d=f*L;for(let i=0;i<seg.length;i++){if(d<=seg[i]||i===seg.length-1){const k=Math.min(1,d/seg[i]);return [pts[i][0]+(pts[i+1][0]-pts[i][0])*k,pts[i][1]+(pts[i+1][1]-pts[i][1])*k];}d-=seg[i];}return pts[0];}
function trainBox(t,x,y,col="#c0425a"){return `<g onclick="showTrain('${t.id}')" style="cursor:pointer"><rect x="${x-44}" y="${y-12}" width="88" height="24" rx="5" fill="${col}" stroke="#40101a"/><text x="${x}" y="${y+4}" text-anchor="middle" fill="#fff" font-size="12">${t.id} ${t.dir===1?"→":"←"}</text></g>`;}
function drawBoard(){
 const g=game,L=layout(),xl=250,xr=950,x0=330,x1=870;
 let h=`<svg viewBox="0 0 1200 ${L.H}" role="img" aria-label="${esc(g.name)} kezelőpult"><rect width="1200" height="${L.H}" fill="#6d806a"/><text x="20" y="28" fill="#132d1b" font-size="18">${esc(g.name.toUpperCase())} · KEZELŐPULT</text><text x="20" y="48" fill="#26391e" font-size="11">${g.def.avu?"Vágányok és hosszak: ÁVU. Állomásvégi váltókapcsolatok: egyszerűsített, nem hiteles rajz.":"Játéksablon: ennek az állomásnak az ÁVU-adatai még nincsenek feldolgozva."}</text>`;
 h+=path(`M20 ${L.ymid}H${xl}M${xr} ${L.ymid}H1180`,"#d0d9be",5);
 g.tracks.forEach((t,i)=>{const y=L.y(i),occ=g.trains.some(v=>v.track===t.id&&["stopped","parked","entering","leaving","passing"].includes(v.state)),res=g.trains.some(v=>v.track===t.id&&v.perm&&["request","granted","signal"].includes(v.state));
  h+=path(`M${xl} ${L.ymid}L${x0} ${y}M${x1} ${y}L${xr} ${L.ymid}`,"#52694a",3,'stroke-dasharray="7 5"')+path(`M${x0} ${y}H${x1}`,occ?"#ff5664":res?"#9fe3ad":"#c9d5c0",t.main?8:5,`data-track="${esc(t.id)}"`);
  h+=`<text x="${(x0+x1)/2}" y="${y+23}" text-anchor="middle" fill="#142f1d" font-size="11">${esc(t.id)}. vágány · ${esc(t.len)}${t.len.includes("m")||t.len==="játéksablon"?"":" m"}${t.main?" · átmenő":""}</text>`;});
 g.routes.forEach(r=>{const i=g.tracks.findIndex(t=>t.id===r.track),y=L.y(i);let pts;
  if(r.kind==="in")pts=r.side==="L"?[[20,L.ymid],[xl,L.ymid],[x0,y],[600,y]]:[[1180,L.ymid],[xr,L.ymid],[x1,y],[600,y]];
  else pts=r.side==="R"?[[600,y],[x1,y],[xr,L.ymid],[1180,L.ymid]]:[[600,y],[x0,y],[xl,L.ymid],[20,L.ymid]];
  h+=path("M"+pts.map(p=>p.join(",")).join("L"),r.releaseAt?"#ffd074":r.clear?"#8ef5af":"#f0f1df",8,`opacity=".85" data-route="${esc(r.start)}" data-sig="${r.clear?"clear":"stop"}"`);});
 h+=btn("A",110,L.ymid+55,"#a53f4d","A",1)+btn("B",1090,L.ymid+55,"#a53f4d","B",1)+btn("VL",50,L.ymid-45,"#34704f","VL")+btn("VR",1150,L.ymid-45,"#34704f","VR");
 g.tracks.forEach((t,i)=>{const y=L.y(i);h+=btn("T-"+t.id,600,y-28,"#496a7a","T"+t.id)+btn("L-"+t.id,x0+30,y+30,"#a53f4d","L"+t.id,1)+btn("R-"+t.id,x1-30,y+30,"#a53f4d","R"+t.id,1);});
 for(const t of g.trains){
  const i=t.track?g.tracks.findIndex(x=>x.id===t.track):-1,y=i>=0?L.y(i):L.ymid;
  const inP=t.dir===1?[[-60,L.ymid],[xl,L.ymid],[x0,y],[600,y]]:[[1260,L.ymid],[xr,L.ymid],[x1,y],[600,y]];
  const outP=t.dir===1?[[600,y],[x1,y],[xr,L.ymid],[1260,L.ymid]]:[[600,y],[x0,y],[xl,L.ymid],[-60,L.ymid]];
  const passP=t.dir===1?[[-60,L.ymid],[xl,L.ymid],[x0,y],[x1,y],[xr,L.ymid],[1260,L.ymid]]:[[1260,L.ymid],[xr,L.ymid],[x1,y],[x0,y],[xl,L.ymid],[-60,L.ymid]];
  if(t.state==="signal"){const x=t.dir===1?85:1115;h+=trainBox(t,x,L.ymid-18,"#8c5a2b");}
  else if(t.state==="entering"){const [x,yy]=samplePath(inP,t.prog);h+=trainBox(t,x,yy);}
  else if(t.state==="passing"){const [x,yy]=samplePath(passP,t.prog);h+=trainBox(t,x,yy,"#d98a2f");}
  else if(t.state==="leaving"){const [x,yy]=samplePath(outP,t.prog);h+=trainBox(t,x,yy);}
  else if(["stopped","parked"].includes(t.state))h+=trainBox(t,600,y);
 }
 h+="</svg>";$("board").innerHTML=h;
}
function render(){
 const g=game;if(!g)return;
 $("clock").textContent=fmtTime(g.time);$("play").textContent=g.paused?"▶ Indítás":"Ⅱ Szünet";$("score").textContent=g.score;
 document.querySelectorAll("[data-mode]").forEach(b=>b.classList.toggle("on",b.dataset.mode===mode));
 $("op").textContent=({route:"Vágányút kijelölése",clear:"Jelzőállítás",stop:"Jelző Megállj!",cancel:"Törlés / oldás"})[mode]+(startBtn?" · kezdő: "+startBtn:"");
 const f=$("feedback");f.textContent=fb?fb.m:"Készenlét. Az engedélykérésekre válaszolj, majd jelöld ki a vágányutat és állítsd szabadra a jelzőt.";f.className="feedback"+(fb?(fb.ok?" good":" bad"):"");
 drawBoard();
 const req=g.trains.filter(t=>["request","granted","signal"].includes(t.state));
 $("reqCount").textContent=g.requests().length;
 $("requests").innerHTML=req.map(t=>{const free=g.freeTracks(t.kind,t.id);return `<div class="req"><div class="row"><b>${t.id}</b><span class="${t.perm?"g":"a"}">${t.perm?"Engedélyezve: "+t.track+". vágány":"Engedélykérés"}</span></div><div class="small">${t.dir===1?"Budapest felől":"Pécs felől"} · ${kindName[t.kind]} · terv ${fmtTime(t.arr)}${t.estimated?" (becsült áthaladás)":""}${t.state==="signal"?` · vár ${Math.max(0,Math.floor(g.time-t.arr))} perce`:""}</div><div class="row">${t.perm?`<button onclick="revoke('${t.id}')" ${t.state==="signal"?"disabled":""}>Visszavon</button>`:`<select id="tr-${t.id}">${free.map(x=>`<option>${esc(x)}</option>`).join("")}</select><button onclick="grant('${t.id}')" ${free.length?"":"disabled"}>Engedélyt adok</button>`}<button onclick="showTrain('${t.id}')">Menetrend</button></div></div>`;}).join("")||'<div class="body small">Nincs aktív engedélykérés.</div>';
 const dep=g.trains.filter(t=>["stopped","parked"].includes(t.state)&&t.kind!=="term");
 $("deps").innerHTML=dep.map(t=>`<div class="req"><b>${t.id}</b> · ${t.track}. vágány · indul: ${fmtTime(t.dep)} ${g.readyDep(t)?'<span class="g">készen áll</span>':""}<div class="small">Kijárat: ${t.dir===1?"R-"+t.track+" → VR":"L-"+t.track+" → VL"}</div></div>`).join("")||'<div class="body small">Nincs induló vonat a pulton.</div>';
 const next=g.trains.filter(t=>t.state!=="gone").slice(0,14);
 $("trains").innerHTML=next.map(t=>`<tr><td><button onclick="showTrain('${t.id}')">${t.id}</button></td><td>${t.dir===1?"→ Pécs":"← Budapest"}</td><td>${kindName[t.kind]}</td><td>${fmtTime(t.arr)}</td><td>${fmtTime(t.dep)}</td><td>${t.track||"—"}</td><td>${stateName[t.state]}</td></tr>`).join("");
 $("stats").textContent=`Megállt: ${g.stats.arrived} · Elindult: ${g.stats.departed} · Áthaladt: ${g.stats.passed} · Késés összesen: ${g.stats.lateMin} perc`;
 $("log").innerHTML=g.logs.slice(0,40).map(l=>`<div><span class="g">${fmtTime(l.t)}</span> ${esc(l.m)}</div>`).join("");
 $("src").innerHTML=g.def.avu?`Állomási adatok: <a href="${AVU_BASE+g.def.src}" target="_blank" rel="noopener">hivatalos ÁVU</a> (vágányjegyzék).`:"Ehhez az állomáshoz még nincs feldolgozott ÁVU-adat: a vágányok játéksablonból jönnek.";
}
function showTrain(id){const t=game.byId(id),src=TRAINS.find(x=>x.no===id&&x.d===t.dir);$("dlgTitle").textContent=t.id+" · valós menetrendi sor";$("dlgBody").innerHTML=`<p class="small">Forrás: MÁV 2025–2026-os belföldi közszolgáltatási menetrend (2026.08.31–12.12.), 40a/40 vonal. Közlekedési korlátozások nélkül.${t.alt.length?" Azonos időrendű változat(ok): "+esc(t.alt.join(", "))+".":""}</p><table><thead><tr><th>Állomás</th><th>Érkezés</th><th>Indulás</th></tr></thead><tbody>${src.s.map(s=>`<tr><td>${esc(ROUTE[s[0]].n)}</td><td>${fmtTime(s[1])}</td><td>${fmtTime(s[2])}</td></tr>`).join("")}</tbody></table>`;$("dlg").showModal();}
let last=performance.now(),tickN=0;
function init(){
 const sel=$("station");sel.innerHTML=ROUTE.map((r,i)=>r.c?`<option value="${i}">${esc(r.n)}${STATION_DEFS[r.n]?" · ÁVU":""}</option>`:"").join("");
 sel.value=ROUTE.findIndex(r=>r.n==="Sárbogárd");
 $("start").innerHTML=[0,4,5,6,8,12,16,20].map(h=>`<option value="${h*60}">${String(h).padStart(2,"0")}:00</option>`).join("");$("start").value=300;
 sel.onchange=newGame;$("start").onchange=newGame;
 $("play").onclick=()=>{game.paused=!game.paused;render();};$("speed").onchange=e=>game.speed=Number(e.target.value);$("auto").onchange=e=>{game.auto=e.target.checked;render();};
 $("speed").value=30;newGame();
 setInterval(()=>{const now=performance.now(),dt=Math.min((now-last)/1000,.25);last=now;if(!game.paused)game.tick(dt*game.speed/60);tickN=(typeof tickN==='number'?tickN:0)+1;if(!game.paused||tickN%5===0)render();},100);
}
if(typeof document!=="undefined")init();
