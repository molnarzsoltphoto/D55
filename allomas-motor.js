"use strict";
if(typeof require!=="undefined"){Object.assign(globalThis,require("./adatok.js"));}
const fmtTime=t=>t==null?"—":`${String(Math.floor(t/60)%24).padStart(2,"0")}:${String(Math.floor(t%60)).padStart(2,"0")}`;
function stationDef(si){
 const name=ROUTE[si].n,d=STATION_DEFS[name];
 if(d)return {avu:true,src:d.avu,tracks:d.tracks.map(t=>({id:t[0],len:t[1],main:!!t[2]}))};
 let cnt=0;for(const t of TRAINS)for(const s of t.s)if(s[0]===si)cnt++;
 const n=cnt>=150?6:cnt>=80?5:cnt>=40?4:3,ids=["I","II","III","IV","V","VI"].slice(0,n),mi=Math.floor((n-1)/2);
 return {avu:false,src:null,tracks:ids.map((id,i)=>({id,len:"játéksablon",main:i===mi||(n>=5&&i===mi+1)}))};
}
function buildTrains(si,start){
 const km=ROUTE[si].km,out=[];
 for(const t of TRAINS){
  const st=t.s,k=st.findIndex(x=>x[0]===si);let tr=null;
  if(k>=0){
   const [,arr,dep]=st[k],first=k===0,last=k===st.length-1;
   if(last)tr={kind:"term",arr:arr===dep?dep-1:arr,dep:dep+4};
   else if(first&&arr===dep)tr={kind:"origin",arr:null,dep};
   else tr={kind:"stop",arr:arr===dep?dep-1:arr,dep};
  }else{
   let p=null,n=null;
   for(const x of st){const before=t.d===1?x[0]<si:x[0]>si;if(before)p=x;else if(!n)n=x;}
   if(p&&n){const kp=ROUTE[p[0]].km,kn=ROUTE[n[0]].km,pt=p[2]+(n[1]-p[2])*(km-kp)/(kn-kp);tr={kind:"pass",arr:pt,dep:pt,estimated:true};}
  }
  if(!tr)continue;
  if((tr.dep!=null?tr.dep:tr.arr)<start-1)continue;
  out.push({id:t.no,dir:t.d,kind:tr.kind,arr:tr.arr,dep:tr.dep,estimated:!!tr.estimated,alt:t.alt,state:"sched",perm:false,track:null,prog:0,delay:0,aArr:null,aDep:null});
 }
 out.sort((a,b)=>(a.arr??a.dep)-(b.arr??b.dep));return out;
}
class StationGame{
 constructor(si,start=300){
  this.si=si;this.name=ROUTE[si].n;this.def=stationDef(si);this.tracks=this.def.tracks;this.mains=this.tracks.filter(t=>t.main).map(t=>t.id);
  this.time=start;this.paused=true;this.speed=30;this.auto=false;this.routes=[];this.logs=[];this.score=0;this.stats={arrived:0,departed:0,passed:0,lateMin:0};
  this.trains=buildTrains(si,start);
  this.log(`Szolgálat kezdete: ${this.name}. Menetrend: 2026.08.31–12.12., korlátozások nélkül.`);
 }
 log(m){this.logs.unshift({t:this.time,m});if(this.logs.length>150)this.logs.pop();}
 byId(id){return this.trains.find(t=>t.id===id);}
 trackBusy(tr,except){return this.trains.some(t=>t.id!==except&&t.track===tr&&(["granted","signal","entering","stopped","parked","leaving","passing"].includes(t.state)||(t.perm&&t.state==="request")));}
 freeTracks(kind,except){
  const ids=this.tracks.filter(t=>!this.trackBusy(t.id,except)).map(t=>t.id);
  if(kind==="pass")return ids.filter(id=>this.mains.includes(id));
  return ids.filter(id=>!this.mains.includes(id)).concat(ids.filter(id=>this.mains.includes(id)));
 }
 requests(){return this.trains.filter(t=>t.state==="request"&&!t.perm);}
 grant(id,track){
  const t=this.byId(id);if(!t||t.state!=="request")return {ok:false,msg:"Nincs aktív engedélykérés."};
  if(t.perm)return {ok:false,msg:"Már engedélyezve."};
  track=track||this.freeTracks(t.kind,t.id)[0];
  if(!track)return {ok:false,msg:"Nincs szabad fogadóvágány."};
  if(!this.tracks.some(x=>x.id===track))return {ok:false,msg:"Ismeretlen vágány."};
  if(this.trackBusy(track,t.id))return {ok:false,msg:"A vágány foglalt vagy már le van foglalva."};
  if(t.kind==="pass"&&!this.mains.includes(track))return {ok:false,msg:"Áthaladó vonatnak átmenő fővágány kell."};
  t.perm=true;t.track=track;this.log(`${t.id}: engedély, ${track}. vágány.`);return {ok:true};
 }
 revokePermission(id){
  const t=this.byId(id);if(!t||!t.perm||!["request","granted"].includes(t.state))return {ok:false,msg:"Már nem vonható vissza."};
  if(this.routes.some(r=>r.train===id))return {ok:false,msg:"Előbb oldd a vágányutat."};
  t.perm=false;t.track=null;t.state="request";this.log(`${t.id}: engedély visszavonva.`);return {ok:true};
 }
 describe(start,goal){
  if((start==="A"||start==="B")&&goal.startsWith("T-")){
   const dir=start==="A"?1:-1,track=goal.slice(2);
   const t=this.trains.filter(x=>x.dir===dir&&x.perm&&x.track===track&&["request","granted","signal"].includes(x.state)&&x.kind!=="origin").sort((a,b)=>a.arr-b.arr)[0];
   return {kind:"in",side:dir===1?"L":"R",track,start,goal,train:t?.id,dir};
  }
  if(/^[LR]-/.test(start)&&(goal==="VL"||goal==="VR")){
   const side=start[0],track=start.slice(2);if((side==="R")!==(goal==="VR"))return null;
   const dir=side==="R"?1:-1;
   let t=this.trains.find(x=>x.dir===dir&&x.track===track&&["stopped","parked"].includes(x.state)&&x.kind!=="term");
   if(!t)t=this.trains.filter(x=>x.dir===dir&&x.kind==="pass"&&x.perm&&x.track===track&&["request","granted","signal","entering"].includes(x.state)).sort((a,b)=>a.arr-b.arr)[0];
   return {kind:"out",side,track,start,goal,train:t?.id,dir};
  }
  return null;
 }
 setRoute(start,goal){
  const r=this.describe(start,goal);
  if(!r)return {ok:false,msg:"Érvénytelen kezdő–cél pár. Bejárat: A/B → T-vágány. Kijárat: R-vágány → VR vagy L-vágány → VL."};
  if(!r.train)return {ok:false,msg:r.kind==="in"?"Nincs engedélyezett bejáró vonat erre a vágányra és irányra.":"Nincs ezen a vágányon induló vagy áthaladó vonat."};
  if(this.routes.some(x=>x.start===start))return {ok:false,msg:"Ehhez a jelzőhöz már tartozik vágányút."};
  if(this.routes.some(x=>x.side===r.side&&x.train!==r.train))return {ok:false,msg:"Az állomásvég másik vágányút miatt lezárt."};
  r.clear=false;r.ever=false;r.releaseAt=null;this.routes.push(r);this.log(`${start} → ${goal}: vágányút lezárva (${r.train}). Jelző Megállj.`);return {ok:true};
 }
 route(start){return this.routes.find(r=>r.start===start);}
 clearSignal(start){
  const r=this.route(start);if(!r)return {ok:false,msg:"Előbb jelöld ki a vágányutat."};
  const t=this.byId(r.train);
  if(r.kind==="in"&&this.trains.some(x=>x.id!==t.id&&x.track===r.track&&["stopped","parked","entering","leaving","passing"].includes(x.state)))return {ok:false,msg:"A vágány foglalt."};
  if(["entering","leaving","passing"].includes(t.state))return {ok:false,msg:"A vonat már a vágányúton van."};
  r.clear=true;r.ever=true;r.releaseAt=null;this.log(`${start}: Szabad.`);return {ok:true};
 }
 stopSignal(start){const r=this.route(start);if(!r)return {ok:false,msg:"Nincs vágányút."};r.clear=false;this.log(`${start}: Megállj.`);return {ok:true};}
 cancelRoute(start){
  const r=this.route(start);if(!r)return {ok:false,msg:"Nincs törölhető vágányút."};
  const t=this.byId(r.train);
  if(["entering","leaving","passing"].includes(t?.state))return {ok:false,msg:"A vonat a vágányúton halad."};
  if(r.clear)return {ok:false,msg:"Előbb állítsd Megállj állásba a jelzőt."};
  if(r.ever){r.releaseAt=this.time+3;this.log(`${start}: időzített oldás, 3 szimulált perc.`);}else{this.routes=this.routes.filter(x=>x!==r);this.log(`${start}: vágányút törölve.`);}
  return {ok:true};
 }
 inRoute(t){return this.routes.find(r=>r.train===t.id&&r.kind==="in");}
 outRoute(t){return this.routes.find(r=>r.train===t.id&&r.kind==="out");}
 drop(t,kind){this.routes=this.routes.filter(r=>!(r.train===t.id&&r.kind===kind));}
 readyDep(t){return this.time>=t.dep&&(t.kind==="origin"||this.time>=(t.aArr||0)+1);}
 autoAct(){
  for(const t of this.trains){
   if(t.state==="request"&&!t.perm)this.grant(t.id);
   if(["request","granted","signal"].includes(t.state)&&t.perm&&this.time>=t.arr-3.2){
    if(!this.inRoute(t))this.setRoute(t.dir===1?"A":"B","T-"+t.track);
    if(t.kind==="pass"&&!this.outRoute(t))this.setRoute((t.dir===1?"R-":"L-")+t.track,t.dir===1?"VR":"VL");
    const i=this.inRoute(t),o=this.outRoute(t);
    if(i&&!i.clear&&(t.kind!=="pass"||o))this.clearSignal(i.start);
    if(o&&!o.clear&&i)this.clearSignal(o.start);
   }
   if(["stopped","parked"].includes(t.state)&&t.kind!=="term"&&this.readyDep(t)){
    const st=(t.dir===1?"R-":"L-")+t.track;
    if(!this.route(st))this.setRoute(st,t.dir===1?"VR":"VL");
    const o=this.route(st);if(o&&!o.clear)this.clearSignal(st);
   }
  }
 }
 placeOrigin(t){
  const all=this.freeTracks("origin",t.id),f=all.filter(id=>!this.mains.includes(id)),tr=f[0]??all[0];
  if(!tr)return false;t.track=tr;t.state="parked";t.perm=true;this.log(`${t.id}: a(z) ${tr}. vágányon készen áll.`);return true;
 }
 step(t){
  const T=this.time;
  switch(t.state){
   case "sched":
    if(t.kind==="origin"){if(T>=t.dep-12)this.placeOrigin(t);}
    else if(T>=t.arr-8){t.state="request";this.log(`${t.id}: engedélykérés (${t.kind==="pass"?"áthalad":t.kind==="term"?"végállomásra érkezik":"megáll"}, terv ${fmtTime(t.arr)}).`);}
    break;
   case "request":case "granted":case "signal":{
    if(t.perm&&t.state==="request")t.state="granted";
    if(T>=t.arr-1.5){
     if(t.perm&&t.state!=="signal")t.state="signal";
     const i=this.inRoute(t),o=this.outRoute(t);
     if(t.perm&&i&&i.clear&&(t.kind!=="pass"||(o&&o.clear))){
      t.state=t.kind==="pass"?"passing":"entering";t.t0=T;t.dur=t.kind==="pass"?1.6:1.2;i.clear=false;if(o)o.clear=false;this.log(`${t.id}: ${t.kind==="pass"?"áthalad":"behalad"}.`);
     }
    }
    break;}
   case "entering":case "passing":
    t.prog=Math.min(1,(T-t.t0)/t.dur);
    if(t.prog>=1){
     this.drop(t,"in");
     if(t.state==="passing"){this.drop(t,"out");t.state="gone";t.aArr=T;t.delay=Math.max(0,T-t.arr);this.stats.passed++;this.stats.lateMin+=Math.floor(t.delay);this.score+=Math.max(1,6-Math.floor(t.delay));this.log(`${t.id}: áthaladt (${Math.floor(t.delay)} perc késés).`);t.track=null;}
     else{t.state="stopped";t.aArr=T;t.prog=0;const d=Math.max(0,T-t.arr);t.delay=d;this.stats.arrived++;this.stats.lateMin+=Math.floor(d);this.score+=Math.max(1,10-Math.floor(d));this.log(`${t.id}: megállt, ${t.track}. vágány (${Math.floor(d)} perc késés).`);}
    }
    break;
   case "stopped":
    if(t.kind==="term"){if(T>=t.aArr+4){t.state="gone";this.log(`${t.id}: kiállt a forgalomból.`);t.track=null;}}
    else{const o=this.outRoute(t);if(this.readyDep(t)&&o&&o.clear){t.state="leaving";t.t0=T;t.dur=1.0;o.clear=false;this.log(`${t.id}: indul.`);}}
    break;
   case "parked":{
    const o=this.outRoute(t);
    if(T>=t.dep&&o&&o.clear){t.state="leaving";t.t0=T;t.dur=1.0;o.clear=false;this.log(`${t.id}: indul.`);}
    break;}
   case "leaving":
    t.prog=Math.min(1,(T-t.t0)/t.dur);
    if(t.prog>=1){this.drop(t,"out");t.aDep=T;const d=Math.max(0,T-t.dep);t.delay=Math.max(t.delay,d);this.stats.departed++;this.stats.lateMin+=Math.floor(d);this.score+=Math.max(1,10-Math.floor(d));this.log(`${t.id}: elindult (${Math.floor(d)} perc késés).`);t.state="gone";t.track=null;}
    break;
  }
 }
 tick(dt){
  let left=dt;
  while(left>1e-9){
   const d=Math.min(0.05,left);this.time+=d;left-=d;
   this.routes=this.routes.filter(r=>!(r.releaseAt&&this.time>=r.releaseAt));
   if(this.auto)this.autoAct();
   for(const t of this.trains)this.step(t);
  }
 }
}
if(typeof module!=="undefined")module.exports={StationGame,buildTrains,stationDef,fmtTime};
