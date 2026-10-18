"use strict";
let K=null;const $=id=>document.getElementById(id);const sigCache={};
function rerender(){render(true);}
function keyMode(m){setMode(m,()=>render(true));}
function gm(si){return K.byIdx[si];}
function onPult(n,si){const g=gm(si);if(g.auto){setFb(false,g.name+" automata állomás – kapcsold kézire a fejlécén, ha te akarod kezelni.");render(true);return;}pressBtn(g,n,()=>render(true));}
function doGrant(si,id){const s=document.getElementById(`tr-${si}-${id}`);const r=gm(si).grant(id,s?s.value:undefined);setFb(r.ok,r.ok?ROUTE[si].n+" · "+id+": engedély megadva.":r.msg);render(true);}
function doRevoke(si,id){const r=gm(si).revokePermission(id);setFb(r.ok,r.ok?id+": engedély visszavonva.":r.msg);render(true);}
function doStopTrain(si,id){const r=gm(si).makeStop(id);setFb(r.ok,r.ok?id+": az állomáson megáll.":r.msg);render(true);}
function showTrain(si,id){trainDialog(si,id,$("dlgTitle"),$("dlgBody"),$("dlg"));}
function showTrainP(id){const t=K.games.flatMap(g=>g.trains).find(x=>x.id===id);showTrain(t?t.si:K.sel,id);}
function toggleAuto(si){const g=gm(si);g.auto=!g.auto;render(true);}
function jump(si){K.sel=si;const el=document.getElementById("st-"+si);if(el)el.scrollIntoView({behavior:"smooth",block:"start"});}
function newGame(){resetPult();K=new KofiGame(Number($("start").value));K.jumpTo(Math.max(K.time,K.firstAction()-10));K.speed=Number($("speed").value);K.setScope($("scope").value);K.paused=false;for(const k in sigCache)delete sigCache[k];$("grid").innerHTML="";render(true);}
function stSig(g){return g.trains.filter(t=>!["gone","sched"].includes(t.state)).map(t=>t.id+t.state+(t.track||"")+Math.round((t.prog||0)*12)+(["request","granted"].includes(t.state)?Math.round((g.time-t.arr)*1.5):"")).join(",")+"|"+g.routes.map(r=>r.start+r.clear+(r.releaseAt?1:0)).join(",")+"|"+g.auto+"|"+P.mode+"|"+(P.si===g.si?P.start+"/"+P.armed:"")+"|"+nextHint(g).btns.join();}
function render(force){
 if(!K)return;
 $("clock").textContent=fmtTime(K.time);$("play").textContent=K.paused?"▶ Indítás":"Ⅱ Szünet";$("score").textContent=K.totalScore();
 setHtml($("wall"),drawKofiWall(K));
 const pend=K.pending(),cnt={};for(const t of pend)cnt[t.si]=(cnt[t.si]||0)+1;
 setHtml($("chips"),K.games.map(x=>`<button class="chip${x.auto?"":" man"}" data-chip="${x.si}" onclick="jump(${x.si})">${esc(ROUTE[x.si].n)}${cnt[x.si]&&!x.auto?`<span class="n">${cnt[x.si]}</span>`:""}</button>`).join(""));
 const grid=$("grid");
 for(const g of K.games){
  let card=document.getElementById("st-"+g.si);
  if(!card){card=document.createElement("div");card.id="st-"+g.si;card.className="scard";card.innerHTML=`<div class="hd"><b></b><span class="small"></span><button data-auto="${g.si}" onclick="toggleAuto(${g.si})"></button></div><div class="board"></div>`;grid.appendChild(card);}
  card.classList.toggle("man",!g.auto);
  const sig=stSig(g);
  if(force||sigCache[g.si]!==sig){
   sigCache[g.si]=sig;
   card.querySelector("b").textContent=g.name;
   card.querySelector(".small").textContent=g.auto?"automata":"kézi";
   card.querySelector("button").textContent=g.auto?"Átveszem":"Automatára";
   const bd=card.querySelector(".board");if(!bd.dataset.bound){bindPult(bd);bd.dataset.bound="1";}
   setHtml(bd,drawKofiStation(g,"showTrainP"));
  }
 }
 const manual=K.games.filter(x=>!x.auto);
 const todo=manual.map(g=>({g,h:nextHint(g)})).filter(x=>x.h.btns.length).slice(0,8);
 setHtml($("todo"),todo.length?todo.map(x=>`<div><a href="#st-${x.g.si}" onclick="jump(${x.g.si});return false"><b>${esc(x.g.name)}</b></a>: ${esc(x.h.text)}</div>`).join(""):"Most nincs pultteendő a kézi állomásokon.");
 paintFb($("feedback"),todo[0]?todo[0].g.name+" – "+todo[0].h.text:"engedélykérés esetén a jobb oldali listából adj engedélyt.");
 const mine=manual.flatMap(x=>x.trains.filter(t=>t.state==="request"&&!t.perm)).sort((a,b)=>a.arr-b.arr);
 $("reqCount").textContent=mine.length;
 setHtml($("requests"),mine.slice(0,20).map(t=>reqCard(K.byIdx[t.si],t,ROUTE[t.si].n)).join("")||'<div class="body small">Nincs engedélykérés a kézi szakaszon.</div>');
 setHtml($("online"),K.onLine().slice(0,12).map(t=>`<tr><td>${t.id}</td><td>${t.dir===1?"→":"←"}</td><td>${esc(ROUTE[t.si].n)}</td><td>${fmtTime(t.arr)}</td></tr>`).join(""));
}
let last=performance.now(),n=0;
function init(){
 $("start").innerHTML=[0,4,5,6,8,12,16,20].map(h=>`<option value="${h*60}">${String(h).padStart(2,"0")}:00-tól</option>`).join("");$("start").value=300;
 $("scope").onchange=e=>{K.setScope(e.target.value);render(true);};$("start").onchange=newGame;
 $("play").onclick=()=>{K.paused=!K.paused;render(true);};$("speed").onchange=e=>{K.speed=Number(e.target.value);};
 bindPult($("wall"));$("speed").value=10;newGame();
 setInterval(()=>{const now=performance.now(),dt=Math.min((now-last)/1000,.25);last=now;if(!K.paused){K.tick(dt*K.speed/60);n++;if(n%3===0)render(false);}else if(++n%15===0)render(false);},100);
}
if(typeof document!=="undefined")init();
