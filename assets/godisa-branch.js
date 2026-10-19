
"use strict";
const GODISA=37;
const GodisaBranch={
 state(s){return s.godisaBranch||(s.godisaBranch={serial:0,edge:null,reserved:null,route:null});},
 train(s,id){return s.trains.find(t=>t.id===id&&t.branchManaged);},
 create(s,incoming){
  const b=this.state(s);if(s.trains.filter(t=>t.branchManaged&&!t.finished).length>=10)return {ok:false,msg:'Legfeljebb 10 kézi csatlakozó menet lehet aktív.'};
  const track=incoming?'III':s.free(GODISA);if(!track)return {ok:false,msg:'Nincs szabad godisai vágány.'};
  const id='KEZI-K'+String(++b.serial).padStart(3,'0');
  s.trains.push({id,at:GODISA,dir:1,track,dep:s.time,phase:incoming?'branchRequest':'parked',delay:0,finished:false,history:[],plan:[{station:GODISA,arr:null,dep:s.time}],branchManaged:true,branchDirection:incoming?'in':'out',kind:'freight',menetrendi:false,maxSpeed:80});
  s.log(id+': kézi tehermenet, '+(incoming?'Komló irányú modellhatár → Godisa':'Godisa → Komló irányú modellhatár')+'. Nem valós menetrendi vonat.');return {ok:true,id};
 },
 grant(s,id){
  const b=this.state(s),t=this.train(s,id);if(!t||t.finished)return {ok:false,msg:'Nincs aktív kézi menet.'};
  if(b.edge)return {ok:false,msg:'A csatlakozó modellszakasz foglalt vagy lefoglalt.'};
  if(t.branchDirection==='in'&&t.phase!=='branchRequest'||t.branchDirection==='out'&&t.phase!=='parked')return {ok:false,msg:'A menet ebben az állapotban nem engedélyezhető.'};
  const track=t.branchDirection==='in'?'III':t.track;
  if(s.closed[GODISA+':'+track]||s.busy(GODISA,track,t.id))return {ok:false,msg:'A godisai vágány foglalt vagy lezárt.'};
  b.edge=id;b.reserved={id,track};t.branchPermission=true;
  if(t.branchDirection==='in'){t.phase='branchLineIn';t.branchSince=s.time;}else t.phase='branchReady';
  s.log(id+': csatlakozó engedély megadva, '+track+'. vágány.');return {ok:true};
 },
 route(s,id){
  const b=this.state(s),t=this.train(s,id);if(!t||!t.branchPermission||b.edge!==id)return {ok:false,msg:'Előbb csatlakozó engedély kell.'};
  if(b.route||Object.values(s.routes).some(r=>r.at===GODISA))return {ok:false,msg:'Godisán másik lezárt vágányút van. A csatlakozó modell kizárólagos állomási lezárást használ.'};
  if(!['branchLineIn','branchHold','branchReady'].includes(t.phase))return {ok:false,msg:'A menet már a vágányúton van, vagy még nincs engedélyezve.'};
  b.route={id,track:t.track,kind:t.branchDirection,clear:false,everCleared:false,releaseAt:null};s.log(id+': csatlakozó vágányút lezárva; jelző még Megállj.');return {ok:true};
 },
 clear(s){
  const b=this.state(s),r=b.route,t=r&&this.train(s,r.id);if(!r||!t)return {ok:false,msg:'Nincs csatlakozó vágányút.'};
  if(r.releaseAt)return {ok:false,msg:'Időzített oldás folyamatban.'};
  if(['branchEntering','branchLeaving','branchLineOut'].includes(t.phase))return {ok:false,msg:'A menet már meghaladta a modelljelzőt.'};
  if(s.closed[GODISA+':'+r.track]||s.busy(GODISA,r.track,t.id))return {ok:false,msg:'A vágány foglalt vagy lezárt.'};
  r.clear=true;r.everCleared=true;return {ok:true};
 },
 stop(s){const r=this.state(s).route;if(!r)return {ok:false,msg:'Nincs kezelt csatlakozó vágányút.'};r.clear=false;return {ok:true};},
 cancel(s){const b=this.state(s),r=b.route,t=r&&this.train(s,r.id);if(!r)return {ok:false,msg:'Nincs törölhető csatlakozó vágányút.'};
  if(['branchEntering','branchLeaving'].includes(t?.phase))return {ok:false,msg:'A menet a vágányúton van, az oldás tiltott.'};
  if(r.clear)return {ok:false,msg:'Előbb állítsd Megállj állásba a modelljelzőt.'};
  if(r.everCleared)r.releaseAt=s.time+3;else b.route=null;return {ok:true};
 },
 handoff(s,id,dir){const t=this.train(s,id),b=this.state(s);if(!t||t.phase!=='parked'||b.route?.id===id)return {ok:false,msg:'Csak godisai álló, lezárt vágányút nélküli menet adható át.'};
  if(s.permissions[id])return {ok:false,msg:'Már van fővonali engedély.'};
  t.branchManaged=false;t.branchDirection=null;t.dir=dir;t.dep=s.time+1;t.plan=[];let tm=t.dep,prev=t.at;
  t.plan.push({station:t.at,arr:s.time,dep:tm});for(let n=t.at+dir;n>=0&&n<STATIONS.length;n+=dir){tm+=Math.abs(STATIONS[n].km-STATIONS[prev].km)/80*60;let arr=tm;tm+=STATIONS[n].control?2:.5;t.plan.push({station:n,arr,dep:tm});prev=n;}
  s.log(id+': kézi tehermenet átadva a fővonali motornak, '+(dir===1?'Abaliget':'Sásd')+' felé.');return {ok:true};
 },
 advance(s){
  const b=this.state(s);if(b.route?.releaseAt&&s.time>=b.route.releaseAt)b.route=null;
  for(const t of s.trains){if(!t.branchManaged||t.finished)continue;const elapsed=s.time-(t.branchSince??s.time),r=b.route?.id===t.id?b.route:null;
   if(t.phase==='branchLineIn'&&elapsed>=5){t.phase='branchHold';s.log(t.id+': a godisai csatlakozó modelljelző előtt.');}
   if(t.phase==='branchHold'&&r?.clear){t.phase='branchEntering';t.branchSince=s.time;r.clear=false;}
   else if(t.phase==='branchEntering'&&elapsed>=1){t.phase='parked';t.history.push({station:GODISA,arr:s.time});t.branchPermission=false;t.branchDirection='out';b.edge=null;b.reserved=null;b.route=null;s.log(t.id+': beért Godisára, III. vágány; csatlakozó szakasz és vágányút felszabadult.');}
   else if(t.phase==='branchReady'&&r?.clear){t.phase='branchLeaving';t.branchSince=s.time;r.clear=false;}
   else if(t.phase==='branchLeaving'&&elapsed>=1){t.phase='branchLineOut';t.branchSince=s.time;b.reserved=null;b.route=null;}
   else if(t.phase==='branchLineOut'&&elapsed>=5){t.phase='branchOutside';t.finished=true;t.finishedAt=s.time;t.branchPermission=false;b.edge=null;s.log(t.id+': kilépett a Komló irányú modellhatáron.');}
  }
 }
};
const godisaBaseBusy=Simulation.prototype.busy,godisaBaseLocked=Simulation.prototype.throatLocked,godisaBaseTick=Simulation.prototype.tick;
Simulation.prototype.busy=function(s,tr,except){const b=this.godisaBranch;return !!(s===GODISA&&b?.reserved?.track===tr&&b.reserved.id!==except)||godisaBaseBusy.call(this,s,tr,except);};
Simulation.prototype.throatLocked=function(s,side){return !!(s===GODISA&&this.godisaBranch?.route)||godisaBaseLocked.call(this,s,side);};
Simulation.prototype.tick=function(dt){godisaBaseTick.call(this,dt);GodisaBranch.advance(this);};
if(typeof module!=='undefined')module.exports.GodisaBranch=GodisaBranch;
