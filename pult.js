"use strict";
const P={start:null,mode:"route",armed:null,fb:null};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function setFb(ok,m){P.fb={ok,m};}
function resetPult(){P.start=null;P.mode="route";P.armed=null;P.fb=null;}
function setMode(m,render){P.mode=P.mode===m&&m!=="route"?"route":m;P.start=null;P.armed=null;render();}
function pressBtn(g,name,render){
 const done=(r,okMsg)=>{setFb(r.ok,r.ok?okMsg:r.msg);render();return r;};
 if(P.mode==="stop")return done(g.stopSignal(name),name+": Megállj.");
 if(P.mode==="cancel")return done(g.cancelRoute(name),name+": oldás elfogadva.");
 if(P.mode==="clear"||P.armed===name){const r=g.clearSignal(name);P.armed=null;if(r.ok)P.mode="route";return done(r,name+": jelző Szabad.");}
 if(!P.start){
  if(g.route(name)){const r=g.clearSignal(name);return done(r,name+": jelző Szabad (második lezárás).");}
  if(name==="VL"||name==="VR"){setFb(false,"A zöld gomb célgomb: előbb jelöld ki a kezdő jelzőt (piros gomb).");render();return {ok:false};}
  P.start=name;setFb(true,name+" kijelölve. Most válaszd a vágányút célját.");render();return {ok:true};
 }
 const a=P.start;let goal=name;
 if(name===a){P.start=null;setFb(true,"Kijelölés elvetve.");render();return {ok:true};}
 if(a==="A"&&name.startsWith("R-"))goal="T-"+name.slice(2);
 else if(a==="B"&&name.startsWith("L-"))goal="T-"+name.slice(2);
 else if((a==="A"&&name.startsWith("L-"))||(a==="B"&&name.startsWith("R-"))){P.start=null;setFb(false,"A bejárati vágányút célja a vágány túlsó végén lévő jelző ("+(a==="A"?"R-":"L-")+"…).");render();return {ok:false};}
 const r=g.setRoute(a,goal);P.start=null;
 if(r.ok){P.armed=a;return done(r,a+" → "+name+": vágányút lezárva (fehér). Most a(z) "+a+" jelzőgomb megnyomásával állítsd szabadra a jelzőt.");}
 return done(r);
}
function geomP(g){const n=g.tracks.length,ymid=120+Math.floor((n-1)/2)*58;return {n,ymid,y:i=>120+i*58,H:230+n*58};}
function pPath(d,c,w=5,x=""){return `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" ${x}/>`;}
function pBtn(g,name,x,y,kind,label,lamp){
 const sel=P.start===name,r=g.route(name),armed=P.armed===name,fill=kind==="dest"?"#2f9a45":"#c8232c";
 return `<g class="point" data-btn="${name}" tabindex="0" role="button" aria-label="${esc(label)} gomb" onclick="onPult('${name}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();onPult('${name}')}"><rect x="${x-17}" y="${y-17}" width="34" height="34" rx="3" fill="#cfe5cf" stroke="#6a8f6e"/><circle class="ring" cx="${x}" cy="${y}" r="12" fill="${fill}" stroke="${sel||armed?"#fff200":"#17a34a"}" stroke-width="${sel||armed?5:3.5}"/>${lamp?`<circle cx="${x+22}" cy="${y-10}" r="5.5" fill="${r&&r.clear?"#4cff7d":"#ff4040"}" stroke="#222"/>`:""}<text x="${x}" y="${y+31}" text-anchor="middle" fill="#14301d" font-size="11" font-weight="700">${esc(label)}</text></g>`;
}
function samp(pts,f){let L=0;const seg=[];for(let i=1;i<pts.length;i++){const l=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);seg.push(l);L+=l;}let d=Math.max(0,Math.min(1,f))*L;for(let i=0;i<seg.length;i++){if(d<=seg[i]||i===seg.length-1){const k=seg[i]?Math.min(1,d/seg[i]):0;return [pts[i][0]+(pts[i+1][0]-pts[i][0])*k,pts[i][1]+(pts[i+1][1]-pts[i][1])*k];}d-=seg[i];}return pts[0];}
function trainTag(t,x,y,col,click){return `<g onclick="${click}('${t.id}')" style="cursor:pointer"><rect x="${x-46}" y="${y-13}" width="92" height="26" rx="5" fill="${col}" stroke="#111"/><text x="${x}" y="${y+5}" text-anchor="middle" fill="#fff" font-size="13" font-weight="700">${t.id} ${t.dir===1?"→":"←"}</text></g>`;}
function drawPult(g,trainClick){
 const L=geomP(g),xl=270,xr=930,x0=340,x1=860;
 let h=`<svg viewBox="0 0 1200 ${L.H}" role="img" aria-label="${esc(g.name)} D55-jellegű kezelőpult"><defs><pattern id="gr" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#7fae86" stroke-width="1"/></pattern></defs><rect width="1200" height="${L.H}" fill="#a9d6b0"/><rect width="1200" height="${L.H}" fill="url(#gr)"/><rect x="14" y="62" width="1172" height="${L.H-122}" rx="8" fill="#15181a" stroke="#4a5a4e" stroke-width="3"/><text x="24" y="30" fill="#14301d" font-size="19" font-weight="800">${esc(g.name.toUpperCase())}</text><text x="24" y="50" fill="#2a5a38" font-size="12">${g.def.avu?"Vágányok és hosszak: ÁVU-alapú, kézzel még nem ellenőrzött adat. Állomásvégi váltókapcsolatok: egyszerűsített, torzított ábra.":"Játéksablon: az állomás ÁVU-adatai még nincsenek feldolgozva."}</text>`;
 h+=pPath(`M30 ${L.ymid}H${xl}M${xr} ${L.ymid}H1170`,"#3a3f3c",9);
 g.tracks.forEach((t,i)=>{const y=L.y(i);h+=pPath(`M${xl} ${L.ymid}L${x0} ${y}M${x1} ${y}L${xr} ${L.ymid}`,"#2f3532",6,'stroke-dasharray="8 6"');});
 g.tracks.forEach((t,i)=>{
  const y=L.y(i),holder=g.trains.find(v=>v.track===t.id&&["stopped","parked","entering","leaving","passing"].includes(v.state)),resv=g.trains.find(v=>v.track===t.id&&v.perm&&["request","granted","signal"].includes(v.state));
  h+=pPath(`M${x0} ${y}H${x1}`,holder?"#ff3b30":"#3a3f3c",t.main?11:8,`data-track="${esc(t.id)}"`);
  if(resv&&!holder)h+=pPath(`M${x0} ${y+11}H${x1}`,"#ffb703",3,`data-resv="${esc(t.id)}"`);
  h+=`<rect x="${(x0+x1)/2-40}" y="${y-12}" width="80" height="24" rx="3" fill="#e9f2e9" stroke="#4a6a50"/><text x="${(x0+x1)/2}" y="${y+5}" text-anchor="middle" fill="#14301d" font-size="13" font-weight="800">${esc(t.id)}</text><text x="${(x0+x1)/2}" y="${y+25}" text-anchor="middle" fill="#9db3a2" font-size="10">${esc(t.len)}${/^\d/.test(t.len)?" m":""}${t.main?" · átmenő":""}</text>`;
 });
 g.routes.forEach(r=>{const i=g.tracks.findIndex(t=>t.id===r.track),y=L.y(i);let pts;
  if(r.kind==="in")pts=r.side==="L"?[[30,L.ymid],[xl,L.ymid],[x0,y],[x1,y]]:[[1170,L.ymid],[xr,L.ymid],[x1,y],[x0,y]];
  else pts=r.side==="R"?[[x0,y],[x1,y],[xr,L.ymid],[1170,L.ymid]]:[[x1,y],[x0,y],[xl,L.ymid],[30,L.ymid]];
  h+=pPath("M"+pts.map(p=>p.join(",")).join("L"),r.releaseAt?"#ffd166":"#ffffff",6,`opacity=".95" data-route="${esc(r.start)}" data-sig="${r.clear?"clear":"stop"}"`);});
 h+=pBtn(g,"A",150,L.ymid-45,"start","A",1)+pBtn(g,"B",1050,L.ymid+45,"start","B",1)+pBtn(g,"VL",70,L.ymid+50,"dest","VL")+pBtn(g,"VR",1130,L.ymid-50,"dest","VR");
 g.tracks.forEach((t,i)=>{const y=L.y(i);h+=pBtn(g,"L-"+t.id,x0+30,y-26,"start","L-"+t.id,1)+pBtn(g,"R-"+t.id,x1-30,y-26,"start","R-"+t.id,1);});
 for(const t of g.trains){
  const i=t.track?g.tracks.findIndex(x=>x.id===t.track):-1,y=i>=0?L.y(i):L.ymid,m=L.ymid;
  const inP=t.dir===1?[[-70,m],[xl,m],[x0,y],[600,y]]:[[1270,m],[xr,m],[x1,y],[600,y]];
  const outP=t.dir===1?[[600,y],[x1,y],[xr,m],[1270,m]]:[[600,y],[x0,y],[xl,m],[-70,m]];
  const passP=t.dir===1?[[-70,m],[xl,m],[x0,y],[x1,y],[xr,m],[1270,m]]:[[1270,m],[xr,m],[x1,y],[x0,y],[xl,m],[-70,m]];
  if(t.state==="signal")h+=trainTag(t,t.dir===1?95:1105,m+(t.dir===1?-95:95),"#8c5a2b",trainClick);
  else if(t.state==="entering"){const [x,yy]=samp(inP,t.prog);h+=trainTag(t,x,yy,"#c0425a",trainClick);}
  else if(t.state==="passing"){const [x,yy]=samp(passP,t.prog);h+=trainTag(t,x,yy,"#d98a2f",trainClick);}
  else if(t.state==="leaving"){const [x,yy]=samp(outP,t.prog);h+=trainTag(t,x,yy,"#c0425a",trainClick);}
  else if(["stopped","parked"].includes(t.state))h+=trainTag(t,600,y-1,"#c0425a",trainClick);
 }
 return h+"</svg>";
}
const kindName={stop:"megáll",pass:"áthalad",term:"végállomás",origin:"innen indul"};
const stateName={sched:"Később érkezik",request:"Engedélykérés",granted:"Engedélyezve",signal:"Jelző előtt vár",entering:"Behalad",stopped:"Áll",parked:"Indulásra kész",leaving:"Kijár",passing:"Áthalad",gone:"Lezárult"};
function reqCard(g,t,label){
 const free=g.freeTracks(t.kind,t.id,t.dir),dirTxt=t.dir===1?"Budapest felől":"Pécs felől";
 const sel=`<select id="tr-${g.si}-${t.id}" aria-label="Fogadóvágány">${(t.perm?[t.track]:free).map(x=>`<option value="${esc(x)}">${esc(x)}. vágány</option>`).join("")}</select>`;
 return `<div class="req" data-req="${t.id}"><div class="row"><b>${t.id}</b>${label?`<span class="small">${esc(label)}</span>`:""}<span class="${t.perm?"g":"a"}">${t.perm?"Engedélyezve: "+esc(t.track)+". vágány":"Engedélykérés"}</span></div><div class="small">${dirTxt} · ${kindName[t.kind]} · várható ${fmtTime(t.arr)}${t.estimated?" (becsült)":""}${t.state==="signal"?" · jelző előtt vár":""}</div><div class="row">${t.perm?`<button onclick="doRevoke(${g.si},'${t.id}')" ${t.state==="signal"?"disabled":""}>Engedély vissza</button>`:`${sel}<button data-grant="${t.id}" onclick="doGrant(${g.si},'${t.id}')" ${free.length?"":"disabled"}>Engedélyt adok</button>`}${t.kind==="pass"?`<button onclick="doStopTrain(${g.si},'${t.id}')">Megállít (keresztezés)</button>`:""}<button onclick="showTrain(${g.si},'${t.id}')">Menetrend</button></div></div>`;
}
function trainRows(g,list){return list.map(t=>`<tr><td><button onclick="showTrain(${g.si},'${t.id}')">${t.id}</button></td><td>${t.dir===1?"→ Pécs":"← Budapest"}</td><td>${kindName[t.kind]}</td><td>${fmtTime(t.planArr)}</td><td>${fmtTime(t.planDep)}</td><td>${t.track||"—"}</td><td>${stateName[t.state]}</td><td>${Math.floor(t.delay)}′</td></tr>`).join("");}
function trainDialog(si,id,dlgTitle,dlgBody,dlg){
 const src=TRAINS.find(x=>x.no===id&&x.s.some(s=>s[0]===si))||TRAINS.find(x=>x.no===id);
 dlgTitle.textContent=id+" · valós menetrendi sor";
 dlgBody.innerHTML=`<p class="small">Forrás: MÁV 2025–2026-os belföldi közszolgáltatási menetrend (2026.08.31–12.12.), 40a/40 vonal, korlátozások nélkül.</p><table><thead><tr><th>Állomás</th><th>Érkezés</th><th>Indulás</th></tr></thead><tbody>${src.s.map(s=>`<tr><td>${esc(ROUTE[s[0]].n)}</td><td>${fmtTime(s[1])}</td><td>${fmtTime(s[2])}</td></tr>`).join("")}</tbody></table>`;
 dlg.showModal();
}
function keysHtml(){return `<button data-mode="clear" onclick="keyMode('clear')">Közös jelzőállítás</button><button data-mode="stop" onclick="keyMode('stop')">Jelző Megállj!</button><button data-mode="cancel" onclick="keyMode('cancel')">Vágányút törlés</button><button onclick="P.start=null;P.armed=null;P.mode='route';rerender()">Kijelölés elvetése</button>`;}
function paintKeys(){document.querySelectorAll("[data-mode]").forEach(b=>b.classList.toggle("on",b.dataset.mode===P.mode));}
function paintFb(el){el.textContent=P.fb?P.fb.m:"Készenlét. 1. Engedélyt adsz a vonatnak (és kiválasztod a vágányt). 2. Kezdőgomb (A/B), majd a vágány túlsó végi jelzőgombja. 3. A kezdőgomb újabb megnyomásával a jelző szabadra áll.";el.className="feedback"+(P.fb?(P.fb.ok?" good":" bad"):"");}
if(typeof module!=="undefined")module.exports={P,pressBtn,drawPult};
