
"use strict";
Object.assign(phases,{branchRequest:'Csatlakozó engedélyt kér',branchLineIn:'Komló irányú modellszakaszon közelít',branchHold:'Godisai csatlakozó modelljelző előtt',branchEntering:'Csatlakozó bejáraton',branchReady:'Csatlakozó kijáratra vár',branchLeaving:'Csatlakozó kijáraton',branchLineOut:'Komló irányú modellszakaszon távozik',branchOutside:'A modellhatáron kívül'});
const originalDrawStation=drawStation;
function gbAct(action,id,dir){
 let r;if(action==='in'||action==='out')r=GodisaBranch.create(sim,action==='in');
 else if(action==='grant')r=GodisaBranch.grant(sim,id);
 else if(action==='route')r=GodisaBranch.route(sim,id);
 else if(action==='clear')r=GodisaBranch.clear(sim);
 else if(action==='stop')r=GodisaBranch.stop(sim);
 else if(action==='cancel')r=GodisaBranch.cancel(sim);
 else if(action==='handoff')r=GodisaBranch.handoff(sim,id,dir);
 if(!r.ok)toast(r.msg);else if(r.id)toast(r.id+': kézi tehermenet létrehozva.');render();
}
function godisaSignal(name,key,x,y,clear=false){return `<g role="button" tabindex="0" onclick="point('${key}')" onkeydown="if(event.key==='Enter')point('${key}')" style="cursor:pointer"><rect x="${x-20}" y="${y-20}" width="40" height="40" fill="transparent"/><circle cx="${x}" cy="${y}" r="7" fill="${clear?'#56e78e':'#ff6570'}"/><text x="${x}" y="${y-13}" text-anchor="middle" fill="#fff" font-size="12">${name}</text></g>`;}
drawStation=function(){
 if(sim.selected!==GODISA){originalDrawStation();return;}
 const b=GodisaBranch.state(sim),tracks=STATIONS[GODISA].tracks,ys=Object.fromEntries(tracks.map((tr,i)=>[tr,180+i*50]));
 let svg=`<svg viewBox="0 0 1380 530" xmlns="http://www.w3.org/2000/svg" style="width:100%;background:#102638"><text x="25" y="28" fill="#e0edf8" font-size="19">GODISA · működő, egyszerűsített csatlakozási játékpult</text><text x="25" y="51" fill="#f4c378" font-size="12">Sásd / Abaliget: fővonali motor. Komló: külön modellhatár, nem a teljes mellékvonal.</text><path d="M20 280H210M1020 280H1330M1020 280L1170 90H1340" stroke="#b7c6b5" stroke-width="5" fill="none"/><text x="25" y="320" fill="#fff">Sásd</text><text x="1210" y="320" fill="#fff">Abaliget</text><text x="1190" y="75" fill="#ffd47f">Komló irányú modellhatár</text>`;
 tracks.forEach((tr,i)=>{const y=ys[tr],occ=sim.trains.some(t=>t.at===GODISA&&t.track===tr&&t.phase==='parked'),reserved=b.reserved?.track===tr,locked=b.route?.track===tr;svg+=`<path d="M210 280L350 ${y}H880L1020 280" stroke="${occ?'#ff6774':locked?'#fff':reserved?'#e9b65e':'#9cafb8'}" stroke-width="5" fill="none"/><text x="605" y="${y-12}" fill="#e8eff7">${tr}. fővágány</text>`;
 const kl=sim.getRoute(GODISA,'KL-'+tr),kr=sim.getRoute(GODISA,'KR-'+tr);svg+=godisaSignal('K'+(i+2),'KL-'+tr,390,y,kl?.clear)+godisaSignal('V'+(i+2),'KR-'+tr,840,y,kr?.clear);
 sim.trains.filter(t=>t.at===GODISA&&t.track===tr&&t.phase==='parked').forEach(t=>svg+=`<rect x="520" y="${y-10}" width="100" height="20" rx="4" fill="#65d8ef"/><text x="570" y="${y+4}" text-anchor="middle" font-size="11">${esc(t.id)}</text>`);
 });
 svg+=godisaSignal('A','A',110,280,sim.getRoute(GODISA,'A')?.clear)+godisaSignal('C','B',1240,280,sim.getRoute(GODISA,'B')?.clear);
 svg+=`<circle cx="1125" cy="135" r="9" fill="${b.route?.clear?'#54ed91':'#ff6370'}"/><text x="995" y="120" fill="#fff">Csatlakozó modelljelző</text><text x="30" y="470" fill="#b9ccdc" font-size="12">K2…K6 ↔ bal oldali motorjelzők; V2…V6 ↔ jobb oldali motorjelzők. A csatlakozó vágányút külön kezelendő.</text>`;
 for(const t of sim.trains.filter(t=>t.branchManaged&&t.phase!=='parked')){
  let x=1280,y=90,p=Math.max(0,Math.min(1,(sim.time-(t.branchSince??sim.time))/5));
  if(t.phase==='branchLineIn'){x=1320-180*p;y=90+45*p;}
  else if(t.phase==='branchHold'){x=1140;y=135;}
  else if(t.phase==='branchEntering'){const f=Math.min(1,(sim.time-t.branchSince));x=1140-570*f;y=135+(ys[t.track]-135)*f;}
  else if(t.phase==='branchReady'){x=570;y=ys[t.track];}
  else if(t.phase==='branchLeaving'){const f=Math.min(1,(sim.time-t.branchSince));x=570+570*f;y=ys[t.track]+(135-ys[t.track])*f;}
  else if(t.phase==='branchLineOut'){x=1140+180*p;y=135-45*p;}
  svg+=`<rect x="${x-50}" y="${y-10}" width="100" height="20" rx="4" fill="#ffc56d"/><text x="${x}" y="${y+4}" text-anchor="middle" font-size="10">${esc(t.id)}</text>`;
 }

 for(const t of sim.trains.filter(t=>!t.branchManaged)){
  const p=sim.permissions[t.id];let x=null,y=280;
  if(t.at===GODISA&&t.phase==='leaving'){const f=t.progress||0;x=570+(t.dir===1?560:-540)*f;y=ys[t.track]+(280-ys[t.track])*f;}
  else if(p?.to===GODISA&&['approach','hold','entering'].includes(t.phase)){
   const targetY=ys[p.track]||280,f=t.phase==='entering'?t.progress||0:0;x=t.dir===1?100+470*f:1240-670*f;y=280+(targetY-280)*f;
  }
  if(x!==null)svg+=`<rect x="${x-43}" y="${y-10}" width="86" height="20" rx="4" fill="#6cdcf3"/><text x="${x}" y="${y+4}" text-anchor="middle" font-size="11">${esc(t.id)}</text>`;
 }
 svg+='</svg>';
 const rows=sim.trains.filter(t=>t.branchManaged&&!t.finished).map(t=>`<tr><td>${esc(t.id)}</td><td>${t.branchDirection==='in'?'Komló felől':'Komló felé'}</td><td>${phases[t.phase]||t.phase}</td><td><button onclick="gbAct('grant','${t.id}')">Engedély</button> <button onclick="gbAct('route','${t.id}')">Vágányút</button>${t.phase==='parked'?` <button onclick="gbAct('handoff','${t.id}',-1)">Sásd felé átadás</button> <button onclick="gbAct('handoff','${t.id}',1)">Abaliget felé átadás</button>`:''}</td></tr>`).join('');
 document.getElementById('board').innerHTML=svg+`<div style="padding:12px;background:#19354a;color:#e7eff8"><h3>Komló csatlakozó kezelés</h3><p>Kézi tehermenetek, nem valós menetrendi személyvonatok. A modellszakasz menetideje 5 perc; a be-/kijárat 1 perc. Ezek játékparaméterek, nem PDF-ből kiolvasott menetidők.</p><button onclick="gbAct('in')">Kézi tehermenet Komló felől</button> <button onclick="gbAct('out')">Kézi tehermenet Godisáról</button><p>Ág: ${b.edge?'foglalt / lefoglalt: '+esc(b.edge):'szabad'} · Vágányút: ${b.route?esc(b.route.id)+(b.route.clear?' · Szabad':' · Megállj'):'nincs'}</p><button onclick="gbAct('clear')">Csatlakozó jelző Szabad</button> <button onclick="gbAct('stop')">Megállj!</button> <button onclick="gbAct('cancel')">Vágányút törlése / oldás</button><table><thead><tr><th>Menet</th><th>Irány</th><th>Állapot</th><th>Kezelés</th></tr></thead><tbody>${rows||'<tr><td colspan="4">Nincs kézi csatlakozó menet.</td></tr>'}</tbody></table><p>A csatlakozó vágányút idejére a modell Godisa mindkét állomásvégét lezárja. Ez konzervatív játékszabály, nem a valós váltófüggőségek teljes rekonstrukciója.</p></div>`;
};
function timetableList(){document.getElementById('timetableRows').innerHTML=globalThis.REAL_TIMETABLE.map(t=>`<tr><td>${t.number}</td><td>${esc(STATIONS[t.stops[0].station].name)}</td><td>${fmt(t.stops[0].dep)}</td><td>${esc(STATIONS[t.stops.at(-1).station].name)}</td><td>${fmt(t.stops.at(-1).arr)}</td></tr>`).join('');document.getElementById('timetableDialog').showModal();}

const originalGodisaKofi=drawKofi;
drawKofi=function(){
 originalGodisaKofi();if(typeof NW==='undefined'||!NW.svg||!NW.layout?.nodes[GODISA])return;
 const node=NW.layout.nodes[GODISA],x=node.x+node.w,y=node.y||400,b=GodisaBranch.state(sim),ns='http://www.w3.org/2000/svg';
 const group=document.createElementNS(ns,'g');group.id='godisa-working-branch';
 group.innerHTML=`<path d="M${x} 400L${x+160} 170H${x+510}" fill="none" stroke="${b.edge?'#ff747e':'#e5b45f'}" stroke-width="5"/><rect x="${x+280}" y="130" width="245" height="66" rx="8" fill="#213e53" stroke="#e5b45f"/><text x="${x+292}" y="154" fill="#fff" font-size="15">Komló irányú modellhatár</text><text x="${x+292}" y="178" fill="#f2cb8f" font-size="12">${b.edge?esc(b.edge):'szabad'} · Godisa pult ↗</text>`;
 group.style.cursor='pointer';group.addEventListener('pointerdown',ev=>{ev.stopPropagation();selectStation(GODISA);setView('station');});NW.svg.append(group);
};
sim.selected=GODISA;render();
