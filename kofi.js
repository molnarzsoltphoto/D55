"use strict";
let K=null;const $=id=>document.getElementById(id);
function cur(){return K.byIdx[K.sel];}
function rerender(){render();}
function keyMode(m){setMode(m,render);}
function onPult(n){pressBtn(cur(),n,render);}
function gm(si){return K.byIdx[si];}
function doGrant(si,id){const s=document.getElementById(`tr-${si}-${id}`);const r=gm(si).grant(id,s?s.value:undefined);setFb(r.ok,r.ok?ROUTE[si].n+" · "+id+": engedély megadva.":r.msg);render();}
function doRevoke(si,id){const r=gm(si).revokePermission(id);setFb(r.ok,r.ok?id+": engedély visszavonva.":r.msg);render();}
function doStopTrain(si,id){const r=gm(si).makeStop(id);setFb(r.ok,r.ok?id+": az állomáson megáll.":r.msg);render();}
function showTrain(si,id){trainDialog(si,id,$("dlgTitle"),$("dlgBody"),$("dlg"));}
function showTrainP(id){showTrain(K.sel,id);}
function selectStation(si){K.sel=si;P.start=null;P.armed=null;render();}
function newGame(){resetPult();K=new KofiGame(Number($("start").value));K.speed=Number($("speed").value);K.setScope($("scope").value);render();}
function render(){
 if(!K)return;
 const g=cur();$("clock").textContent=fmtTime(K.time);$("play").textContent=K.paused?"▶ Indítás":"Ⅱ Szünet";$("score").textContent=K.totalScore();$("keys").innerHTML=keysHtml();paintKeys();paintFb($("feedback"));
 const pend=K.pending(),cnt={};for(const t of pend)cnt[t.si]=(cnt[t.si]||0)+1;
 $("chips").innerHTML=K.games.map(x=>`<button class="chip${x.si===K.sel?" sel":""}${x.auto?"":" man"}" data-chip="${x.si}" onclick="selectStation(${x.si})">${esc(ROUTE[x.si].n)}${cnt[x.si]&&!x.auto?`<span class="n">${cnt[x.si]}</span>`:""}</button>`).join("");
 $("who").innerHTML=`<b>${esc(g.name)}</b> · ${g.auto?'<span class="a">automata kezeli</span>':'<span class="g">kézi kezelés</span>'} · ${g.def.avu?'ÁVU-alapú vágányadat (ellenőrizetlen)':'játéksablon'}`;
 $("board").innerHTML=drawPult(g,"showTrainP");
 const mine=K.games.filter(x=>!x.auto).flatMap(x=>x.trains.filter(t=>t.state==="request"&&!t.perm));
 mine.sort((a,b)=>a.arr-b.arr);$("reqCount").textContent=mine.length;
 const forSel=g.trains.filter(t=>t.perm&&["granted","signal","request"].includes(t.state));
 $("requests").innerHTML=(mine.slice(0,25).map(t=>reqCard(K.byIdx[t.si],t,ROUTE[t.si].n)).join("")+(forSel.length?`<div class="body small"><b>${esc(g.name)}: engedélyezett érkezők</b></div>`+forSel.map(t=>reqCard(g,t)).join(""):""))||'<div class="body small">Nincs engedélykérés a kézi szakaszon.</div>';
 $("online").innerHTML=K.onLine().slice(0,12).map(t=>`<tr><td>${t.id}</td><td>${t.dir===1?"→":"←"}</td><td>${esc(ROUTE[t.si].n)}</td><td>${fmtTime(t.arr)}</td></tr>`).join("");
 $("trains").innerHTML=trainRows(g,g.trains.filter(t=>t.state!=="gone").slice(0,14));
 $("log").innerHTML=g.logs.slice(0,40).map(l=>`<div><span class="g">${fmtTime(l.t)}</span> ${esc(l.m)}</div>`).join("");
}
let last=performance.now(),n=0;
function init(){
 $("start").innerHTML=[0,4,5,6,8,12,16,20].map(h=>`<option value="${h*60}">${String(h).padStart(2,"0")}:00</option>`).join("");$("start").value=300;
 $("scope").onchange=e=>{K.setScope(e.target.value);render();};$("start").onchange=newGame;
 $("play").onclick=()=>{K.paused=!K.paused;render();};$("speed").onchange=e=>{K.speed=Number(e.target.value);};
 $("speed").value=30;newGame();
 setInterval(()=>{const now=performance.now(),dt=Math.min((now-last)/1000,.25);last=now;if(!K.paused){K.tick(dt*K.speed/60);n++;if(n%2===0)render();}else if(++n%10===0)render();},100);
}
if(typeof document!=="undefined")init();
