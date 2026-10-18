"use strict";
const P={start:null,si:null,mode:"route",armed:null,fb:null};
const CHOICE={};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function setHtml(el,html){if(el.dataset.h===html)return false;if(document.activeElement&&document.activeElement.tagName==="SELECT"&&el.contains(document.activeElement))return false;el.innerHTML=html;el.dataset.h=html;return true;}
function bindPult(el){el.addEventListener("pointerdown",e=>{
 const j=e.target.closest&&e.target.closest("[data-jump]");if(j&&el.contains(j)&&typeof jump==="function"){e.preventDefault();jump(Number(j.dataset.jump));return;}
 const k=e.target.closest&&e.target.closest("[data-key]");if(k&&el.contains(k)){e.preventDefault();keyMode(k.dataset.key);return;}
 const b=e.target.closest&&e.target.closest("[data-btn]");if(b&&el.contains(b)){e.preventDefault();onPult(b.dataset.btn,Number(b.dataset.si));}});}
if(typeof document!=="undefined")document.addEventListener("change",e=>{const t=e.target;if(t&&t.id&&t.id.startsWith("tr-"))CHOICE[t.id]=t.value;});
function setFb(ok,m){P.fb={ok,m};}
function resetPult(){P.start=null;P.si=null;P.mode="route";P.armed=null;P.fb=null;}
function setMode(m,render){if(m==="reset"){P.start=null;P.armed=null;P.mode="route";render();return;}P.mode=P.mode===m&&m!=="route"?"route":m;P.start=null;P.armed=null;render();}
function pressBtn(g,name,render){
 const done=(r,okMsg)=>{setFb(r.ok,r.ok?okMsg:r.msg);render();return r;};
 if(P.start&&P.si!==g.si){P.start=null;P.armed=null;setFb(false,"A kezdő- és a célgomb ugyanahhoz az állomáshoz tartozzon. Kezdd újra a kijelölést.");render();return {ok:false};}
 if(P.mode==="stop")return done(g.stopSignal(name),name+": Megállj.");
 if(P.mode==="cancel")return done(g.cancelRoute(name),name+": oldás elfogadva.");
 if(P.mode==="clear"||(P.armed===name&&P.si===g.si)){const r=g.clearSignal(name);P.armed=null;if(r.ok)P.mode="route";return done(r,name+": jelző Szabad.");}
 if(!P.start){
  if(g.route(name)){const r=g.clearSignal(name);return done(r,name+": jelző Szabad (második lezárás).");}
  if(name==="VL"||name==="VR"){setFb(false,"A zöld gomb célgomb: előbb jelöld ki a kezdő jelzőt (piros gomb).");render();return {ok:false};}
  P.start=name;P.si=g.si;setFb(true,name+" kijelölve. Most válaszd a vágányút célját.");render();return {ok:true};
 }
 const a=P.start;let goal=name;
 if(name===a){P.start=null;setFb(true,"Kijelölés elvetve.");render();return {ok:true};}
 if(a==="A"&&name.startsWith("R-"))goal="T-"+name.slice(2);
 else if(a==="B"&&name.startsWith("L-"))goal="T-"+name.slice(2);
 else if((a==="A"&&name.startsWith("L-"))||(a==="B"&&name.startsWith("R-"))){P.start=null;setFb(false,"A bejárati vágányút célja a vágány túlsó végén lévő jelző ("+(a==="A"?"R-":"L-")+"…).");render();return {ok:false};}
 const r=g.setRoute(a,goal);P.start=null;
 if(r.ok){P.armed=a;P.si=g.si;return done(r,a+" → "+name+": vágányút lezárva (fehér). Nyomd meg újra a(z) "+a+" gombot: a jelző szabadra áll.");}
 return done(r);
}
function nextHint(g){
 if(P.start&&P.si===g.si){
  const s=P.start;
  if(s==="A"||s==="B"){const t=g.trains.filter(x=>x.dir===(s==="A"?1:-1)&&x.perm&&["request","granted","signal"].includes(x.state)).sort((a,b)=>a.arr-b.arr)[0];
   const b=(s==="A"?"R-":"L-")+(t?t.track:"");if(t)return {btns:[b],text:`Válaszd a(z) ${b} gombot (a ${t.track}. vágány túlsó vége) – ide fogadod a(z) ${t.id} vonatot.`};}
  else return {btns:[s[0]==="R"?"VR":"VL"],text:`Válaszd a zöld célgombot (${s[0]==="R"?"VR":"VL"}).`};
 }
 if(P.armed&&P.si===g.si)return {btns:[P.armed],text:`Nyomd meg újra a(z) ${P.armed} gombot: a jelző szabadra áll.`};
 const T=g.time,list=g.trains.filter(t=>t.state!=="gone"&&t.state!=="sched").sort((a,b)=>(a.arr??a.dep)-(b.arr??b.dep));
 for(const t of list){
  if(t.state==="request"&&!t.perm)return {btns:[],text:`${t.id} engedélyt kér: válassz fogadóvágányt a listában, majd „Engedélyt adok”.`,req:true};
  if(["request","granted","signal"].includes(t.state)&&t.perm){
   const i=g.inRoute(t),o=g.outRoute(t),sb=t.dir===1?"A":"B",ex=(t.dir===1?"R-":"L-")+t.track;
   if(!i)return {btns:[sb],text:`${t.id} bejárati vágányútja: nyomd meg a(z) ${sb} gombot.`};
   if(t.kind==="pass"&&!o)return {btns:[ex],text:`${t.id} áthalad: kijárati vágányút – nyomd meg a(z) ${ex} gombot.`};
   if(!i.clear)return {btns:[i.start],text:`${t.id}: állítsd szabadra a bejárati jelzőt (${i.start} gomb).`};
   if(o&&!o.clear)return {btns:[o.start],text:`${t.id}: állítsd szabadra a kijárati jelzőt (${o.start} gomb).`};
  }
  if(["stopped","parked"].includes(t.state)&&t.kind!=="term"&&T>=t.dep-3){
   const ex=(t.dir===1?"R-":"L-")+t.track,o=g.route(ex);
   if(!o)return {btns:[ex],text:`${t.id} indulása: nyomd meg a(z) ${ex} gombot, majd a zöld ${t.dir===1?"VR":"VL"} célgombot.`};
   if(!o.clear)return {btns:[ex],text:`${t.id}: nyomd meg újra a(z) ${ex} gombot: a kijárati jelző szabadra áll.`};
  }
 }
 return {btns:[],text:"Most nincs teendő – a forgalom halad."};
}
function pPath(d,c,w=5,x=""){return `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${x}/>`;}
function samp(pts,f){let L=0;const seg=[];for(let i=1;i<pts.length;i++){const l=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);seg.push(l);L+=l;}let d=Math.max(0,Math.min(1,f))*L;for(let i=0;i<seg.length;i++){if(d<=seg[i]||i===seg.length-1){const k=seg[i]?Math.min(1,d/seg[i]):0;return [pts[i][0]+(pts[i+1][0]-pts[i][0])*k,pts[i][1]+(pts[i+1][1]-pts[i][1])*k];}d-=seg[i];}return pts[0];}
/* ===== D55 (állomási játék) ===== */
const C={panel:"#8a9b78",tileA:"#7c8d6b",tileB:"#9bad89",track:"#313424",plate:"#e7e6cf",ink:"#1b2415"};
function plate(x,y,txt,fs=13,pad=6,fill=C.plate){const w=Math.max(18,txt.length*fs*0.62+pad*2);return `<rect x="${x-w/2}" y="${y-fs}" width="${w}" height="${fs+7}" rx="2" fill="${fill}" stroke="#5d6a50" stroke-width="1"/><text x="${x}" y="${y}" text-anchor="middle" fill="${C.ink}" font-size="${fs}" font-weight="800">${esc(txt)}</text>`;}
function pBtn(g,name,x,y,kind,label,lamp,hints){
 const sel=P.start===name&&P.si===g.si,r=g.route(name),armed=P.armed===name&&P.si===g.si,hint=hints.includes(name),inner=kind==="dest"?"#2f9a45":"#c42a20";
 return `<g class="point${hint?" hint":""}" data-btn="${name}" data-si="${g.si}" tabindex="0" role="button" aria-label="${esc(label)} gomb" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();onPult('${name}',${g.si})}"><rect class="pad" x="${x-26}" y="${y-26}" width="52" height="52" rx="3" fill="${hint?"#f4ef9a":"#98a985"}" stroke="${hint?"#e6a700":"#6d7d5d"}" stroke-width="${hint?4:1.5}"/><circle class="ring" cx="${x}" cy="${y}" r="17" fill="${inner}" stroke="${sel||armed?"#fff200":"#f6f6ee"}" stroke-width="${sel||armed?6:3.5}"/><circle cx="${x-4}" cy="${y-5}" r="4" fill="#ffffff" opacity=".35"/>${lamp?`<circle cx="${x+30}" cy="${y-17}" r="7" fill="${r&&r.clear?"#40e060":"#ff7a1a"}" stroke="#2a2a20" stroke-width="2"/>`:""}${plate(x,y+44,label,13,4)}</g>`;
}
function keyBtn(x,y,key,label,color){const on=P.mode===key;return `<g class="key${on?" on":""}" data-key="${key}" tabindex="0" role="button" aria-label="${esc(label)}" style="cursor:pointer"><circle cx="${x}" cy="${y}" r="19" fill="${color}" stroke="${on?"#fff200":"#f6f6ee"}" stroke-width="${on?6:3.5}"/><circle cx="${x-5}" cy="${y-6}" r="5" fill="#fff" opacity=".35"/>${plate(x,y+42,label,13,5)}</g>`;}
function trainTag(t,x,y,col,click,extra,txt="#fff"){return `<g data-train="${t.id}" onclick="${click}('${t.id}')" style="cursor:pointer"><rect x="${x-50}" y="${y-15}" width="100" height="30" rx="4" fill="${col}" stroke="#14180f" stroke-width="2.5"/><text x="${x}" y="${y+6}" text-anchor="middle" fill="${txt}" font-size="16" font-weight="800">${t.id} ${t.dir===1?"→":"←"}</text>${extra?`<text x="${x}" y="${y+31}" text-anchor="middle" fill="#14180f" font-size="13" font-weight="800" stroke="#e7e6cf" stroke-width="3" paint-order="stroke">${extra}</text>`:""}</g>`;}
function geomP(g){const n=g.tracks.length,ymid=150+Math.floor((n-1)/2)*70;return {n,ymid,y:i=>150+i*70,H:300+n*70};}
function lampsAlong(x0,x1,y,color){let s="";for(let x=x0+40;x<x1-20;x+=80)s+=`<circle cx="${x}" cy="${y-9}" r="4" fill="${color}" stroke="#2a2a20" stroke-width="1"/>`;return s;}
function drawPult(g,trainClick){
 const L=geomP(g),xl=270,xr=930,x0=340,x1=860,hint=nextHint(g),hb=hint.btns,H=L.H;
 let h=`<svg viewBox="0 0 1200 ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(g.name)} D55-jellegű kezelőpult"><defs><pattern id="gr${g.si}" width="60" height="60" patternUnits="userSpaceOnUse"><rect width="60" height="60" fill="${C.panel}"/><path d="M60 0H0V60" fill="none" stroke="${C.tileB}" stroke-width="2"/><path d="M60 3V60M3 60H60" fill="none" stroke="${C.tileA}" stroke-width="2"/></pattern></defs><rect width="1200" height="${H}" fill="url(#gr${g.si})"/>`;
 h+=`<rect x="0" y="0" width="1200" height="74" fill="#7d8e6c"/><rect x="0" y="72" width="1200" height="3" fill="#5f6d52"/>`;
 [50,100,150].forEach(x=>h+=`<rect x="${x-18}" y="22" width="36" height="22" rx="3" fill="#b1ac9e" stroke="#4b5440"/><circle cx="${x}" cy="33" r="6" fill="#2d3326"/>`);
 h+=`<circle cx="205" cy="33" r="13" fill="#c42a20" stroke="#f6f6ee" stroke-width="3"/>`;
 h+=`<rect x="330" y="10" width="540" height="54" rx="3" fill="${C.plate}" stroke="#5d6a50" stroke-width="2"/><text x="600" y="34" text-anchor="middle" fill="${C.ink}" font-size="22" font-weight="900">${esc(g.name.toUpperCase())}</text><text x="600" y="55" text-anchor="middle" fill="#3b4a30" font-size="12.5" font-weight="700">${g.def.avu?"Vágányok: ÁVU-alapú, ellenőrizetlen · váltók: egyszerűsített":"Játéksablon – az ÁVU-adatok még nincsenek feldolgozva"}</text>`;
 [[960,"#ff9a2a"],[1000,"#fdf6d0"],[1040,"#ff9a2a"],[1080,"#fdf6d0"],[1120,"#3dd16a"]].forEach(([x,c])=>h+=`<circle cx="${x}" cy="33" r="9" fill="${c}" stroke="#2a2a20" stroke-width="2"/>`);
 h+=pPath(`M30 ${L.ymid}H${xl}M${xr} ${L.ymid}H1170`,C.track,6);
 g.tracks.forEach((t,i)=>{const y=L.y(i);h+=pPath(`M${xl} ${L.ymid}L${x0} ${y}M${x1} ${y}L${xr} ${L.ymid}`,C.track,4.5);});
 g.tracks.forEach((t,i)=>{
  const y=L.y(i),holder=g.trains.find(v=>v.track===t.id&&["stopped","parked","entering","leaving","passing"].includes(v.state)),resv=g.trains.find(v=>v.track===t.id&&v.perm&&["request","granted","signal"].includes(v.state));
  h+=pPath(`M${x0} ${y}H${x1}`,holder?"#e8281e":C.track,t.main?7:5.5,`data-track="${esc(t.id)}"`);
  h+=lampsAlong(x0,x1,y,holder?"#ff4a3a":"#59614c");
  if(resv&&!holder)h+=pPath(`M${x0} ${y+12}H${x1}`,"#ffb703",4,`data-resv="${esc(t.id)}"`);
  h+=plate((x0+x1)/2,y-12,t.id,18,8);
  h+=`<text x="${(x0+x1)/2}" y="${y+28}" text-anchor="middle" fill="#202a18" font-size="12.5" font-weight="800">${esc(t.len)}${/^\d/.test(t.len)?" m":""}${t.main?" · átmenő":""}</text>`;
 });
 g.routes.forEach(r=>{const i=g.tracks.findIndex(t=>t.id===r.track),y=L.y(i);let pts;
  if(r.kind==="in")pts=r.side==="L"?[[30,L.ymid],[xl,L.ymid],[x0,y],[x1,y]]:[[1170,L.ymid],[xr,L.ymid],[x1,y],[x0,y]];
  else pts=r.side==="R"?[[x0,y],[x1,y],[xr,L.ymid],[1170,L.ymid]]:[[x1,y],[x0,y],[xl,L.ymid],[30,L.ymid]];
  const d="M"+pts.map(p=>p.join(",")).join("L");
  h+=pPath(d,"#1d2016",9)+pPath(d,r.releaseAt?"#ffd166":"#fffdf0",5,`data-route="${esc(r.start)}" data-sig="${r.clear?"clear":"stop"}"`);});
 h+=pBtn(g,"A",150,L.ymid-78,"start","A",1,hb)+pBtn(g,"B",1050,L.ymid+78,"start","B",1,hb)+pBtn(g,"VL",75,L.ymid+78,"dest","VL",0,hb)+pBtn(g,"VR",1125,L.ymid-78,"dest","VR",0,hb);
 g.tracks.forEach((t,i)=>{const y=L.y(i);h+=pBtn(g,"L-"+t.id,x0+40,y-40,"start","L-"+t.id,1,hb)+pBtn(g,"R-"+t.id,x1-40,y-40,"start","R-"+t.id,1,hb);});
 const ky=H-58;
 h+=`<rect x="320" y="${ky-34}" width="560" height="84" rx="4" fill="#7d8e6c" stroke="#5f6d52" stroke-width="2"/>`+keyBtn(380,ky,"clear","KÖZÖS SZABAD","#2f9a45")+keyBtn(500,ky,"stop","JELZŐ M!","#c42a20")+keyBtn(620,ky,"cancel","TÖRLÉS","#f2f1e4")+keyBtn(740,ky,"reset","ELVETÉS","#59614c")+`<circle cx="820" cy="${ky}" r="7" fill="${P.mode!=="route"?"#ffcf33":"#59614c"}" stroke="#2a2a20" stroke-width="2"/>`;
 h+=drawTrains(g,L,trainClick,"d55");
 return h+"</svg>";
}
function drawTrains(g,L,trainClick,style){
 const xl=270,xr=930,x0=340,x1=860;let h="";
 for(const t of g.trains){
  const i=t.track?g.tracks.findIndex(x=>x.id===t.track):-1,y=i>=0?L.y(i):L.ymid,m=L.ymid;
  const inP=t.dir===1?[[-80,m],[xl,m],[x0,y],[600,y]]:[[1280,m],[xr,m],[x1,y],[600,y]];
  const outP=t.dir===1?[[600,y],[x1,y],[xr,m],[1280,m]]:[[600,y],[x0,y],[xl,m],[-80,m]];
  const passP=t.dir===1?[[-80,m],[xl,m],[x0,y],[x1,y],[xr,m],[1280,m]]:[[1280,m],[xr,m],[x1,y],[x0,y],[xl,m],[-80,m]];
  const hx=t.dir===1?100:1100,K=style==="kofi";
  const tag=(x,yy,col,extra,txt)=>K?kTag(t,x,yy,col,trainClick,extra):trainTag(t,x,yy,col,trainClick,extra,txt);
  if(["request","granted"].includes(t.state)||(t.state==="sched"&&g.time>=t.arr-9&&t.kind!=="origin")){
   const f=Math.max(0,Math.min(1,(g.time-(t.arr-8))/6.5)),x=t.dir===1?-50+(hx+50)*f:1250-(1250-hx)*f;
   h+=`<g data-approach="${t.id}">`+tag(x,m,K?"#6d7f88":"#6f7c88","közeleg · érk. "+fmtTime(t.arr))+`</g>`;
  }
  else if(t.state==="signal")h+=tag(hx,m,K?"#ff9b2f":"#d98a2f","jelző előtt vár","#14180f");
  else if(t.state==="entering"){const [x,yy]=samp(inP,t.prog);h+=tag(x,yy,K?"#4fc3d0":"#22303f");}
  else if(t.state==="passing"){const [x,yy]=samp(passP,t.prog);h+=tag(x,yy,K?"#9be3ea":"#8a3b12");}
  else if(t.state==="leaving"){const [x,yy]=samp(outP,t.prog);h+=tag(x,yy,K?"#4fc3d0":"#22303f");}
  else if(["stopped","parked"].includes(t.state))h+=tag(600,y-1,K?"#4fc3d0":"#22303f");
 }
 return h;
}
/* ===== KÖFI (sötét munkaállomás-megjelenítés) ===== */
const Kc={bg:"#03060a",line:"#dfe8ea",dim:"#58646b",red:"#e04b4b",green:"#52d46e",cyan:"#4fc3d0",txt:"#e9f1f2",amber:"#ffb703",orange:"#ff9b2f"};
function kTag(t,x,y,col,click,extra){return `<g data-train="${t.id}" onclick="${click}('${t.id}')" style="cursor:pointer"><rect x="${x-46}" y="${y-13}" width="92" height="26" rx="2" fill="${col}" stroke="#d8f6fa" stroke-width="1.5"/><text x="${x}" y="${y+5}" text-anchor="middle" fill="#021016" font-size="15" font-weight="800">${t.id} ${t.dir===1?"→":"←"}</text>${extra?`<text x="${x}" y="${y+28}" text-anchor="middle" fill="${Kc.txt}" font-size="12" font-weight="700">${extra}</text>`:""}</g>`;}
function kBtn(g,name,x,y,kind,label,lamp,hints){
 const sel=P.start===name&&P.si===g.si,r=g.route(name),armed=P.armed===name&&P.si===g.si,hint=hints.includes(name);
 const col=kind==="dest"?Kc.green:(r&&r.clear?Kc.green:Kc.red);
 return `<g class="point${hint?" hint":""}" data-btn="${name}" data-si="${g.si}" tabindex="0" role="button" aria-label="${esc(label)} jelző" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();onPult('${name}',${g.si})}"><rect class="pad" x="${x-24}" y="${y-24}" width="48" height="48" rx="3" fill="${hint?"#3a3510":"#0a1218"}" stroke="${hint?"#ffd23f":"#27363f"}" stroke-width="${hint?3:1}"/>${kind==="dest"?`<path class="ring" d="M${x-12} ${y+9}L${x+12} ${y}L${x-12} ${y-9}Z" fill="${col}" stroke="${sel||armed?"#fff200":"#e9f1f2"}" stroke-width="${sel||armed?4:1.5}" transform="rotate(${name==="VL"?180:0} ${x} ${y})"/>`:`<circle class="ring" cx="${x}" cy="${y}" r="10" fill="${col}" stroke="${sel||armed?"#fff200":"#e9f1f2"}" stroke-width="${sel||armed?5:2}"/>`}<text x="${x}" y="${y+38}" text-anchor="middle" fill="${Kc.txt}" font-size="12.5" font-weight="700">${esc(label)}</text></g>`;
}
function kKey(x,y,key,label,color){const on=P.mode===key;return `<g class="key${on?" on":""}" data-key="${key}" tabindex="0" role="button" aria-label="${esc(label)}" style="cursor:pointer"><rect x="${x-62}" y="${y-17}" width="124" height="34" rx="3" fill="#0d1a22" stroke="${on?"#fff200":"#5b7686"}" stroke-width="${on?3:1.5}"/><circle cx="${x-44}" cy="${y}" r="7" fill="${color}"/><text x="${x+8}" y="${y+5}" text-anchor="middle" fill="${Kc.txt}" font-size="12.5" font-weight="700">${esc(label)}</text></g>`;}
function geomK(g){const n=g.tracks.length,ymid=120+Math.floor((n-1)/2)*58;return {n,ymid,y:i=>120+i*58,H:250+n*58};}
function drawKofiStation(g,trainClick){
 const L=geomK(g),xl=270,xr=930,x0=340,x1=860,hint=nextHint(g),hb=hint.btns,H=L.H,occ=g.trains.filter(t=>["stopped","parked","entering","leaving","passing"].includes(t.state)).length;
 let h=`<svg viewBox="0 0 1200 ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(g.name)} KÖFI-kép"><rect width="1200" height="${H}" fill="${Kc.bg}"/><text x="20" y="32" fill="${Kc.txt}" font-size="24" font-weight="800">${esc(g.name)}</text><rect x="${24+g.name.length*14.5}" y="12" width="${g.auto?120:92}" height="28" rx="2" fill="${g.auto?"#37434b":Kc.cyan}"/><text x="${24+g.name.length*14.5+(g.auto?60:46)}" y="32" text-anchor="middle" fill="#021016" font-size="14" font-weight="800">${g.auto?"AUTOMATA":"KÉZI"}</text><text x="1180" y="30" text-anchor="end" fill="${Kc.dim}" font-size="13" font-weight="700">${g.def.avu?"ÁVU-alapú (ellenőrizetlen)":"játéksablon"} · ${occ} vonat az állomáson</text>`;
 h+=pPath(`M20 ${L.ymid}H${xl}M${xr} ${L.ymid}H1180`,Kc.line,3.5);
 g.tracks.forEach((t,i)=>{const y=L.y(i);h+=pPath(`M${xl} ${L.ymid}L${x0} ${y}M${x1} ${y}L${xr} ${L.ymid}`,Kc.line,2.5);});
 g.tracks.forEach((t,i)=>{
  const y=L.y(i),holder=g.trains.find(v=>v.track===t.id&&["stopped","parked","entering","leaving","passing"].includes(v.state)),resv=g.trains.find(v=>v.track===t.id&&v.perm&&["request","granted","signal"].includes(v.state));
  h+=pPath(`M${x0} ${y}H${x1}`,holder?Kc.red:Kc.line,t.main?4.5:3,`data-track="${esc(t.id)}"`);
  if(resv&&!holder)h+=pPath(`M${x0} ${y+9}H${x1}`,Kc.amber,3,`data-resv="${esc(t.id)}"`);
  h+=`<text x="${x0-10}" y="${y+5}" text-anchor="end" fill="${Kc.txt}" font-size="17" font-weight="800">${esc(t.id)}</text><text x="${x1+10}" y="${y+5}" fill="${Kc.dim}" font-size="12">${esc(t.len)}${/^\d/.test(t.len)?" m":""}${t.main?" · átmenő":""}</text>`;
 });
 g.routes.forEach(r=>{const i=g.tracks.findIndex(t=>t.id===r.track),y=L.y(i);let pts;
  if(r.kind==="in")pts=r.side==="L"?[[20,L.ymid],[xl,L.ymid],[x0,y],[x1,y]]:[[1180,L.ymid],[xr,L.ymid],[x1,y],[x0,y]];
  else pts=r.side==="R"?[[x0,y],[x1,y],[xr,L.ymid],[1180,L.ymid]]:[[x1,y],[x0,y],[xl,L.ymid],[20,L.ymid]];
  const d="M"+pts.map(p=>p.join(",")).join("L");
  h+=pPath(d,r.releaseAt?Kc.amber:(r.clear?Kc.green:"#ffffff"),5,`opacity=".95" data-route="${esc(r.start)}" data-sig="${r.clear?"clear":"stop"}"`);});
 h+=kBtn(g,"A",150,L.ymid-62,"start","A",1,hb)+kBtn(g,"B",1050,L.ymid+62,"start","B",1,hb)+kBtn(g,"VL",75,L.ymid+62,"dest","VL",0,hb)+kBtn(g,"VR",1125,L.ymid-62,"dest","VR",0,hb);
 g.tracks.forEach((t,i)=>{const y=L.y(i);h+=kBtn(g,"L-"+t.id,x0+44,y-34,"start","L-"+t.id,1,hb)+kBtn(g,"R-"+t.id,x1-44,y-34,"start","R-"+t.id,1,hb);});
 const ky=H-34;
 h+=kKey(330,ky,"clear","KÖZÖS SZABAD",Kc.green)+kKey(470,ky,"stop","JELZŐ MEGÁLLJ",Kc.red)+kKey(610,ky,"cancel","TÖRLÉS","#e9f1f2")+kKey(750,ky,"reset","ELVETÉS","#58646b");
 h+=drawTrains(g,L,trainClick,"kofi");
 return h+"</svg>";
}
function drawKofiWall(K){
 const W=1600,H=250,xk=km=>40+(km+4)/226.6*1520,y1=120;
 let h=`<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Vonalkép: Budapest-Déli–Pécs"><rect width="${W}" height="${H}" fill="${Kc.bg}"/><text x="14" y="22" fill="${Kc.txt}" font-size="15" font-weight="800">VONALKÉP · Budapest-Déli – Pécs (40a, 40)</text><text x="${W-14}" y="22" text-anchor="end" fill="${Kc.dim}" font-size="13">${fmtTime(K.time)}</text>`;
 const x14=xk(ROUTE[14].km);
 h+=pPath(`M${xk(-4)} ${y1-4}H${x14}M${xk(-4)} ${y1+4}H${x14}`,Kc.line,2)+pPath(`M${x14} ${y1}H${xk(222.6)}`,Kc.line,2.5);
 ROUTE.forEach((r,i)=>{if(!r.c)h+=`<path d="M${xk(r.km)} ${y1-6}V${y1+6}" stroke="${Kc.dim}" stroke-width="1.5"/>`;});
 const cnt={};for(const t of K.pending())cnt[t.si]=(cnt[t.si]||0)+1;
 for(const g of K.games){
  const x=xk(ROUTE[g.si].km),on=g.trains.filter(t=>["stopped","parked","entering","leaving","passing"].includes(t.state)),req=cnt[g.si]||0,sel=g.si===K.sel;
  h+=`<g data-jump="${g.si}" style="cursor:pointer"><rect x="${x-12}" y="${y1-70}" width="30" height="96" fill="transparent"/><rect x="${x-8}" y="${y1-17}" width="16" height="34" rx="2" fill="${on.length?"#4a1414":"#0a1218"}" stroke="${g.auto?"#8fa0a8":Kc.cyan}" stroke-width="${g.auto?1.5:3}"/>`;
  for(let k=0;k<Math.min(4,g.tracks.length);k++)h+=`<path d="M${x-6} ${y1-11+k*7}H${x+6}" stroke="${on.some(t=>g.tracks.findIndex(q=>q.id===t.track)===k)?Kc.red:Kc.line}" stroke-width="1.5"/>`;
  h+=`<text transform="translate(${x+4},${y1-26}) rotate(-52)" fill="${g.auto?"#b6c3c9":Kc.txt}" font-size="12" font-weight="${g.auto?500:800}">${esc(ROUTE[g.si].n)}</text>`;
  if(req&&!g.auto)h+=`<circle cx="${x+10}" cy="${y1+22}" r="8" fill="${Kc.orange}"/><text x="${x+10}" y="${y1+26}" text-anchor="middle" fill="#111" font-size="11" font-weight="800">${req}</text>`;
  h+=`</g>`;
 }
 let k=0;
 for(const t of K.onLine().slice(0,40)){
  const p=t.pred,ex=p.aDep??p.aArr??K.time,f=Math.max(0,Math.min(1,(K.time-ex)/Math.max(1,t.arr-ex))),xa=xk(ROUTE[p.si].km),xb=xk(ROUTE[t.si].km),x=xa+(xb-xa)*f,dbl=Math.min(p.si,t.si)<14,yy=y1+(dbl?(t.dir===1?-4:4):0);
  h+=`<g data-train="${t.id}"><rect x="${x-20}" y="${yy+18+(k%3)*13}" width="40" height="12" rx="2" fill="${Kc.cyan}"/><text x="${x}" y="${yy+28+(k%3)*13}" text-anchor="middle" fill="#021016" font-size="10.5" font-weight="800">${t.id}</text><path d="M${x} ${yy+18+(k%3)*13}V${yy+4}" stroke="${Kc.cyan}" stroke-width="1"/></g>`;k++;
 }
 return h+"</svg>";
}
const kindName={stop:"megáll",pass:"áthalad",term:"végállomás",origin:"innen indul"};
const stateName={sched:"Később érkezik",request:"Engedélykérés",granted:"Engedélyezve",signal:"Jelző előtt vár",entering:"Behalad",stopped:"Áll",parked:"Indulásra kész",leaving:"Kijár",passing:"Áthalad",gone:"Lezárult"};
function reqCard(g,t,label){
 const free=g.freeTracks(t.kind,t.id,t.dir),dirTxt=t.dir===1?"Budapest felől":"Pécs felől";
 const sel=`<select id="tr-${g.si}-${t.id}" aria-label="Fogadóvágány">${(t.perm?[t.track]:free).map(x=>`<option value="${esc(x)}"${CHOICE[`tr-${g.si}-${t.id}`]===x?" selected":""}>${esc(x)}. vágány</option>`).join("")}</select>`;
 return `<div class="req" data-req="${t.id}"><div class="row"><b>${t.id}</b>${label?`<span class="small">${esc(label)}</span>`:""}<span class="${t.perm?"g":"a"}">${t.perm?"Engedélyezve: "+esc(t.track)+". vágány":"Engedélykérés"}</span></div><div class="small">${dirTxt} · ${kindName[t.kind]} · várható ${fmtTime(t.arr)}${t.estimated?" (becsült)":""}${t.state==="signal"?" · jelző előtt vár":""}</div><div class="row">${t.perm?`<button onclick="doRevoke(${g.si},'${t.id}')" ${t.state==="signal"?"disabled":""}>Engedély vissza</button>`:`${sel}<button data-grant="${t.id}" onclick="doGrant(${g.si},'${t.id}')" ${free.length?"":"disabled"}>Engedélyt adok</button>`}${t.kind==="pass"?`<button onclick="doStopTrain(${g.si},'${t.id}')">Megállít (keresztezés)</button>`:""}<button onclick="showTrain(${g.si},'${t.id}')">Menetrend</button></div></div>`;
}
function trainRows(g,list){return list.map(t=>`<tr><td><button onclick="showTrain(${g.si},'${t.id}')">${t.id}</button></td><td>${t.dir===1?"→ Pécs":"← Budapest"}</td><td>${kindName[t.kind]}</td><td>${fmtTime(t.planArr)}</td><td>${fmtTime(t.planDep)}</td><td>${t.track||"—"}</td><td>${stateName[t.state]}</td><td>${Math.floor(t.delay)}′</td></tr>`).join("");}
function trainDialog(si,id,dlgTitle,dlgBody,dlg){
 const src=TRAINS.find(x=>x.no===id&&x.s.some(s=>s[0]===si))||TRAINS.find(x=>x.no===id);
 dlgTitle.textContent=id+" · valós menetrendi sor";
 dlgBody.innerHTML=`<p class="small">Forrás: MÁV 2025–2026-os belföldi közszolgáltatási menetrend (2026.08.31–12.12.), 40a/40 vonal, korlátozások nélkül.</p><table><thead><tr><th>Állomás</th><th>Érkezés</th><th>Indulás</th></tr></thead><tbody>${src.s.map(s=>`<tr><td>${esc(ROUTE[s[0]].n)}</td><td>${fmtTime(s[1])}</td><td>${fmtTime(s[2])}</td></tr>`).join("")}</tbody></table>`;
 dlg.showModal();
}
function keysHtml(){return "";}
function paintKeys(){}
function paintFb(el,hintText){setHtml(el,(P.fb?esc(P.fb.m)+"<br>":"")+`<b>Teendő:</b> ${esc(hintText||"")}`);el.className="feedback"+(P.fb?(P.fb.ok?" good":" bad"):"");}
if(typeof module!=="undefined")module.exports={P,pressBtn,drawPult,drawKofiStation,drawKofiWall,nextHint};
