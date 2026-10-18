"use strict";
let game=null;const $=id=>document.getElementById(id);
function rerender(){render();}
function keyMode(m){setMode(m,render);}
function onPult(n){pressBtn(game,n,render);}
function doGrant(si,id){const s=document.getElementById(`tr-${si}-${id}`);const r=game.grant(id,s?s.value:undefined);setFb(r.ok,r.ok?id+": engedély megadva.":r.msg);render();}
function doRevoke(si,id){const r=game.revokePermission(id);setFb(r.ok,r.ok?id+": engedély visszavonva.":r.msg);render();}
function doStopTrain(si,id){const r=game.makeStop(id);setFb(r.ok,r.ok?id+": az állomáson megáll.":r.msg);render();}
function showTrain(si,id){trainDialog(game.si,id,$("dlgTitle"),$("dlgBody"),$("dlg"));}
function showTrainP(id){showTrain(game.si,id);}
function newGame(){resetPult();game=new StationGame(Number($("station").value),Number($("start").value));game.speed=Number($("speed").value);game.auto=$("auto").checked;render();}
function render(){
 const g=game;if(!g)return;
 $("clock").textContent=fmtTime(g.time);$("play").textContent=g.paused?"▶ Indítás":"Ⅱ Szünet";$("score").textContent=g.score;$("keys").innerHTML=keysHtml();paintKeys();paintFb($("feedback"));
 $("board").innerHTML=drawPult(g,"showTrainP");
 const req=g.trains.filter(t=>["request","granted","signal"].includes(t.state)&&(t.state==="request"||t.perm||t.state==="signal"));
 $("reqCount").textContent=g.requests().length;
 $("requests").innerHTML=req.map(t=>reqCard(g,t)).join("")||'<div class="body small">Nincs aktív engedélykérés.</div>';
 const dep=g.trains.filter(t=>["stopped","parked"].includes(t.state)&&t.kind!=="term");
 $("deps").innerHTML=dep.map(t=>`<div class="req"><b>${t.id}</b> · ${t.track}. vágány · indul: ${fmtTime(t.dep)} ${g.readyDep(t)?'<span class="g">készen áll</span>':""}<div class="small">Kijárat: ${t.dir===1?"R-"+t.track+" → VR":"L-"+t.track+" → VL"}</div></div>`).join("")||'<div class="body small">Nincs induló vonat a pulton.</div>';
 $("trains").innerHTML=trainRows(g,g.trains.filter(t=>t.state!=="gone").slice(0,14));
 $("stats").textContent=`Megállt: ${g.stats.arrived} · Elindult: ${g.stats.departed} · Áthaladt: ${g.stats.passed} · Késés összesen: ${g.stats.lateMin} perc`;
 $("log").innerHTML=g.logs.slice(0,40).map(l=>`<div><span class="g">${fmtTime(l.t)}</span> ${esc(l.m)}</div>`).join("");
 $("src").innerHTML=g.def.avu?`Állomási adatok: <a href="${AVU_BASE+g.def.src}" target="_blank" rel="noopener">hivatalos ÁVU</a> alapján (kézzel még nem ellenőrzött vágányjegyzék).`:"Ehhez az állomáshoz még nincs feldolgozott ÁVU-adat: a vágányok játéksablonból jönnek.";
}
let last=performance.now(),n=0;
function init(){
 $("station").innerHTML=ROUTE.map((r,i)=>r.c?`<option value="${i}">${esc(r.n)}${STATION_DEFS[r.n]?" · ÁVU-alapú":""}</option>`:"").join("");
 $("station").value=ROUTE.findIndex(r=>r.n==="Sárbogárd");
 $("start").innerHTML=[0,4,5,6,8,12,16,20].map(h=>`<option value="${h*60}">${String(h).padStart(2,"0")}:00</option>`).join("");$("start").value=300;
 $("station").onchange=newGame;$("start").onchange=newGame;
 $("play").onclick=()=>{game.paused=!game.paused;render();};$("speed").onchange=e=>{game.speed=Number(e.target.value);};$("auto").onchange=e=>{game.auto=e.target.checked;};
 $("speed").value=30;newGame();
 setInterval(()=>{const now=performance.now(),dt=Math.min((now-last)/1000,.25);last=now;if(!game.paused){game.tick(dt*game.speed/60);n++;if(n%2===0)render();}else if(++n%10===0)render();},100);
}
if(typeof document!=="undefined")init();
