"use strict";
if(typeof require!=="undefined"){Object.assign(globalThis,require("./adatok.js"));}
const fmtTime=t=>t==null?"—":`${String(Math.floor(t/60)%24).padStart(2,"0")}:${String(Math.floor(t%60)).padStart(2,"0")}`;
const DIR_MAINS={"Ercsi":{1:["03"],"-1":["04"]},"Százhalombatta":{1:["03"],"-1":["04"]}};
function stationDef(si){
 const name=ROUTE[si].n,d=STATION_DEFS[name];
 if(d)return {avu:true,src:d.avu,tracks:d.tracks.map(t=>({id:t[0],len:t[1],main:!!t[2]})),mainDir:DIR_MAINS[name]||null};
 let cnt=0;for(const t of TRAINS)for(const s of t.s)if(s[0]===si)cnt++;
 const n=cnt>=150?6:cnt>=80?5:cnt>=40?4:3,ids=["I","II","III","IV","V","VI"].slice(0,n),mi=Math.floor((n-1)/2),dbl=si<=14,mains=dbl?[ids[mi],ids[mi+1]]:[ids[mi]];
 return {avu:false,src:null,tracks:ids.map(id=>({id,len:"játéksablon",main:mains.includes(id)})),mainDir:dbl?{1:[ids[mi]],"-1":[ids[mi+1]]}:null};
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
  out.push({id:t.no,dir:t.d,si,kind:tr.kind,planArr:tr.arr,planDep:tr.dep,arr:tr.arr,dep:tr.dep,estimated:!!tr.estimated,alt:t.alt,state:"sched",perm:false,track:null,prog:0,delay:0,aArr:null,aDep:null,pred:null,succ:null,travel:0});
 }
 out.sort((a,b)=>(a.planArr??a.planDep)-(b.planArr??b.planDep));return out;
}
class StationGame{
 constructor(si,start=300){
  this.si=si;this.name=ROUTE[si].n;this.def=stationDef(si);this.tracks=this.def.tracks;this.mains=this.tracks.filter(t=>t.main).map(t=>t.id);this.mainDir=this.def.mainDir||{1:this.mains,"-1":this.mains};
  this.time=start;this.paused=true;this.speed=30;this.auto=false;this.routes=[];this.logs=[];this.score=0;this.changes=0;this.stats={arrived:0,departed:0,passed:0,lateMin:0};this.exitBlocked=null;
  this.trains=buildTrains(si,start);
  this.log(`Szolgálat kezdete: ${this.name}. Menetrend: 2026.08.31–12.12., korlátozások nélkül.`);
 }
 log(m){this.logs.unshift({t:this.time,m});if(this.logs.length>150)this.logs.pop();}
 byId(id){return this.trains.find(t=>t.id===id);}
 trackBusy(tr,except){return this.trains.some(t=>t.id!==except&&t.track===tr&&(["granted","signal","entering","stopped","parked","leaving","passing"].includes(t.state)||(t.perm&&t.state==="request")));}
 freeTracks(kind,except,dir){
  const ids=this.tracks.filter(t=>!this.trackBusy(t.id,except)).map(t=>t.id);
  if(kind==="pass"){const m=this.mainDir[dir]||this.mains;return ids.filter(id=>m.includes(id)).concat(ids.filter(id=>!m.includes(id)&&this.mains.includes(id))).concat(ids.filter(id=>!this.mains.includes(id)));}
  return ids.filter(id=>!this.mains.includes(id)).concat(ids.filter(id=>this.mains.includes(id)));
 }
 requests(){return this.trains.filter(t=>t.state==="request"&&!t.perm);}
 grant(id,track){
  const t=this.byId(id);if(!t||t.state!=="request")return {ok:false,msg:"Nincs aktív engedélykérés."};
  if(t.perm)return {ok:false,msg:"Már engedélyezve."};
  track=track||this.freeTracks(t.kind,t.id,t.dir)[0];
  if(!track)return {ok:false,msg:"Nincs szabad fogadóvágány."};
  if(!this.tracks.some(x=>x.id===track))return {ok:false,msg:"Ismeretlen vágány."};
  if(this.trackBusy(track,t.id))return {ok:false,msg:"A vágány foglalt vagy már le van foglalva."};
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
   const t=this.trains.filter(x=>x.dir===dir&&x.perm&&["request","granted","signal"].includes(x.state)&&x.kind!=="origin").sort((a,b)=>a.arr-b.arr)[0];
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
  if(!r)return {ok:false,msg:"Ez a kezdő–cél pár nem alkot vágányutat."};
  if(!r.train)return {ok:false,msg:r.kind==="in"?"Nincs engedélyezett bejáró vonat ebben az irányban. Előbb adj engedélyt az engedélykérő vonatnak.":"Nincs ezen a vágányon induló vagy áthaladó, engedélyezett vonat."};
  const tr=this.byId(r.train);
  if(this.routes.some(x=>x.start===start))return {ok:false,msg:"Ehhez a jelzőhöz már tartozik vágányút."};
  if(r.kind==="in"&&tr.track!==r.track){
   if(!this.tracks.some(x=>x.id===r.track))return {ok:false,msg:"Ismeretlen vágány."};
   if(this.trackBusy(r.track,tr.id)||this.routes.some(x=>x.train===tr.id))return {ok:false,msg:"A kiválasztott fogadóvágány foglalt, vagy a vonatnak már van vágányútja."};
   tr.track=r.track;this.log(`${tr.id}: fogadóvágány módosítva: ${r.track}.`);
  }
  if(r.kind==="out"&&tr.succ&&!tr.succ.perm)return {ok:false,msg:"A következő állomás még nem adott engedélyt a vonat fogadására."};
  if(r.kind==="out"&&this.exitBlocked&&this.exitBlocked(tr))return {ok:false,msg:"Az állomásköz foglalt: szembejövő vonat van a szakaszon, vagy a szemközti állomás már indít felénk."};
  const conf=this.routes.filter(x=>x.side===r.side&&x.train!==r.train);
  if(conf.length){
   const movable=conf.every(x=>!x.clear&&!["entering","leaving","passing"].includes(this.byId(x.train)?.state));
   if(this.auto&&movable){this.routes=this.routes.filter(x=>!conf.includes(x));}
   else return {ok:false,msg:"Az állomásvég másik vágányút miatt lezárt."};
  }
  r.clear=false;r.ever=false;r.releaseAt=null;this.routes.push(r);this.log(`${start} → ${goal}: vágányút lezárva (${r.train}). Jelző Megállj.`);return {ok:true,train:r.train};
 }
 route(start){return this.routes.find(r=>r.start===start);}
 clearSignal(start){
  const r=this.route(start);if(!r)return {ok:false,msg:"Előbb jelöld ki a vágányutat."};
  const t=this.byId(r.train);
  if(r.kind==="in"&&this.trains.some(x=>x.id!==t.id&&x.track===r.track&&["stopped","parked","entering","leaving","passing"].includes(x.state)))return {ok:false,msg:"A vágány foglalt."};
  if(["entering","leaving","passing"].includes(t.state))return {ok:false,msg:"A vonat már a vágányúton van."};
  r.clear=true;r.ever=true;r.releaseAt=null;this.log(`${start}: Szabad.`);return {ok:true};
 }
 stopSignal(start){const r=this.route(start);if(!r)return {ok:false,msg:"Nincs lezárt vágányút ennél a jelzőnél."};r.clear=false;this.log(`${start}: Megállj.`);return {ok:true};}
 cancelRoute(start){
  const r=this.route(start);if(!r)return {ok:false,msg:"Nincs törölhető vágányút."};
  const t=this.byId(r.train);
  if(["entering","leaving","passing"].includes(t?.state))return {ok:false,msg:"A vonat a vágányúton halad."};
  if(r.clear)return {ok:false,msg:"Előbb állítsd Megállj állásba a jelzőt."};
  if(r.ever){r.releaseAt=this.time+3;this.log(`${start}: időzített oldás, 3 szimulált perc.`);}else{this.routes=this.routes.filter(x=>x!==r);this.log(`${start}: vágányút törölve.`);}
  return {ok:true};
 }
 makeStop(id){
  const t=this.byId(id);if(!t||t.kind!=="pass"||!["request","granted","signal"].includes(t.state))return {ok:false,msg:"Csak az állomásra még be nem haladt áthaladó vonat állítható meg."};
  this.drop(t,"out");t.kind="stop";t.planDep=Math.max(t.planDep,t.planArr)+1;t.dep=Math.max(t.dep,t.arr+1);this.log(`${t.id}: megállítva az állomáson (keresztezés).`);return {ok:true};
 }
 inRoute(t){return this.routes.find(r=>r.train===t.id&&r.kind==="in");}
 outRoute(t){return this.routes.find(r=>r.train===t.id&&r.kind==="out");}
 drop(t,kind){this.routes=this.routes.filter(r=>!(r.train===t.id&&r.kind===kind));}
 readyDep(t){return this.time>=t.dep&&(t.kind==="origin"||this.time>=(t.aArr||0)+1);}
 predExit(p){if(p.state==="gone")return p.aDep??p.aArr??this.time;return Math.max(this.time,p.kind==="pass"?p.arr:p.dep);}
 autoAct(){
  for(const t of this.trains){
   const predGone=!t.pred||t.pred.state==="gone";
   if(t.state==="request"&&!t.perm)this.grant(t.id);
   if(t.kind==="pass"&&["granted","signal"].includes(t.state)&&t.perm&&predGone&&this.time>t.arr+4&&!this.outRoute(t))this.makeStop(t.id);
   if(["request","granted","signal"].includes(t.state)&&t.perm&&predGone&&this.time>=t.arr-3.2){
    if(!this.inRoute(t))this.setRoute(t.dir===1?"A":"B","T-"+t.track);
    if(t.kind==="pass"&&!this.outRoute(t))this.setRoute((t.dir===1?"R-":"L-")+t.track,t.dir===1?"VR":"VL");
    const i=this.inRoute(t),o=this.outRoute(t);
    if(i&&!i.clear&&(t.kind!=="pass"||o))this.clearSignal(i.start);
    if(o&&!o.clear&&i)this.clearSignal(o.start);
   }
   if(["stopped","parked"].includes(t.state)&&t.kind!=="term"&&this.readyDep(t)&&(!t.succ||t.succ.perm)){
    const st=(t.dir===1?"R-":"L-")+t.track;
    if(!this.route(st))this.setRoute(st,t.dir===1?"VR":"VL");
    const o=this.route(st);if(o&&!o.clear)this.clearSignal(st);
   }
  }
 }
 placeOrigin(t){
  const all=this.freeTracks("origin",t.id,t.dir),f=all.filter(id=>!this.mains.includes(id)),tr=f[0]??all[0];
  if(!tr)return false;t.track=tr;t.state="parked";t.perm=true;this.log(`${t.id}: a(z) ${tr}. vágányon készen áll.`);return true;
 }
 project(t){
  if(!t.pred)return;
  const ex=this.predExit(t.pred);
  t.arr=Math.max(t.planArr,ex+t.travel);
  t.dep=t.kind==="pass"?t.arr:Math.max(t.planDep,t.arr+Math.max(1,t.planDep-t.planArr));
 }
 leave(t,o){
  if(t.succ&&!t.succ.perm){t.blocked=true;return false;}
  if(this.exitBlocked&&this.exitBlocked(t)){t.blocked=true;return false;}
  t.blocked=false;t.state="leaving";t.t0=this.time;t.dur=1.0;o.clear=false;this.log(`${t.id}: indul.`);return true;
 }
 step(t){
  const T=this.time;
  switch(t.state){
   case "sched":
    if(t.kind==="origin"){if(T>=t.dep-12)this.placeOrigin(t);}
    else{
     this.project(t);const p=t.pred;let up=true;
     if(p)up=p.state==="gone"||p.state==="passing"||(["stopped","parked","leaving"].includes(p.state)&&T>=p.dep-8)||(p.kind==="pass"&&p.perm&&["granted","signal","entering"].includes(p.state)&&T>=p.arr-4);
     if(up&&p&&p.state!=="gone"&&p.state!=="passing"&&this.exitBlocked&&this.exitBlocked(p))up=false;
     if(up&&T>=t.arr-(p?t.travel+8:8)){t.state="request";this.log(`${t.id}: engedélykérés (${t.kind==="pass"?"áthalad":t.kind==="term"?"végállomásra érkezik":"megáll"}, várható ${fmtTime(t.arr)}).`);}
    }
    break;
   case "request":case "granted":case "signal":{
    this.project(t);
    if(t.perm&&t.state==="request")t.state="granted";
    const predOk=!t.pred||t.pred.state==="gone";
    if(T>=t.arr-1.5&&predOk){
     if(t.perm&&t.state!=="signal")t.state="signal";
     const i=this.inRoute(t),o=this.outRoute(t);
     if(t.perm&&i&&i.clear&&(t.kind!=="pass"||(o&&o.clear&&(!t.succ||t.succ.perm)))){
      t.state=t.kind==="pass"?"passing":"entering";t.t0=T;t.dur=t.kind==="pass"?1.6:1.2;i.clear=false;if(o)o.clear=false;this.log(`${t.id}: ${t.kind==="pass"?"áthalad":"behalad"}.`);
     }
    }
    break;}
   case "entering":case "passing":
    t.prog=Math.min(1,(T-t.t0)/t.dur);
    if(t.prog>=1){
     this.drop(t,"in");
     if(t.state==="passing"){this.drop(t,"out");t.state="gone";t.aArr=T;t.delay=Math.max(0,T-t.planArr);this.stats.passed++;this.stats.lateMin+=Math.floor(t.delay);this.score+=Math.max(1,6-Math.floor(t.delay));this.log(`${t.id}: áthaladt (${Math.floor(t.delay)} perc késés).`);t.track=null;}
     else{t.state="stopped";t.aArr=T;t.prog=0;const d=Math.max(0,T-t.planArr);t.delay=d;this.stats.arrived++;this.stats.lateMin+=Math.floor(d);this.score+=Math.max(1,10-Math.floor(d));this.log(`${t.id}: megállt, ${t.track}. vágány (${Math.floor(d)} perc késés).`);t.dep=Math.max(t.planDep,T+Math.max(1,t.planDep-t.planArr));}
    }
    break;
   case "stopped":
    if(t.kind==="term"){if(T>=t.aArr+4){t.state="gone";this.log(`${t.id}: kiállt a forgalomból.`);t.track=null;}}
    else{const o=this.outRoute(t);if(this.readyDep(t)&&o&&o.clear)this.leave(t,o);}
    break;
   case "parked":{const o=this.outRoute(t);if(T>=t.dep&&o&&o.clear)this.leave(t,o);break;}
   case "leaving":
    t.prog=Math.min(1,(T-t.t0)/t.dur);
    if(t.prog>=1){this.drop(t,"out");t.aDep=T;const d=Math.max(0,T-t.planDep);t.delay=Math.max(t.delay,d);this.stats.departed++;this.stats.lateMin+=Math.floor(d);this.score+=Math.max(1,10-Math.floor(d));this.log(`${t.id}: elindult (${Math.floor(d)} perc késés).`);t.state="gone";t.track=null;}
    break;
  }
 }
 tick(dt){
  let left=dt;
  while(left>1e-9){
   const d=Math.min(0.05,left);this.time+=d;left-=d;
   this.routes=this.routes.filter(r=>!(r.releaseAt&&this.time>=r.releaseAt));
   if(this.auto)this.autoAct();
   for(const t of this.trains){const b=t.state;this.step(t);if(t.state!==b)this.changes++;}
  }
 }
 relief(){
  let n=0;
  for(const t of this.trains){if(["granted","signal"].includes(t.state)&&t.perm){this.drop(t,"in");this.drop(t,"out");t.perm=false;t.track=null;t.state="request";n++;}}
  if(n)this.log(`Forgalmi zavar: ${n} vonat engedélye visszavonva, az engedélyek újraosztása indul.`);
  return n;
 }
}
class KofiGame{
 constructor(start=300){
  this.time=start;this.paused=true;this.speed=30;this.sel=ROUTE.findIndex(r=>r.n==="Sárbogárd");this.games=[];this.byIdx={};this.reliefs=0;
  ROUTE.forEach((r,i)=>{if(r.c){const g=new StationGame(i,start);g.exitBlocked=t=>this.blocked(t);this.games.push(g);this.byIdx[i]=g;}});
  const chains={};
  for(const g of this.games)for(const t of g.trains)(chains[t.id+"|"+t.dir]??=[]).push(t);
  for(const list of Object.values(chains)){
   list.sort((a,b)=>list[0].dir===1?a.si-b.si:b.si-a.si);
   for(let i=1;i<list.length;i++){const p=list[i-1],c=list[i];p.succ=c;c.pred=p;c.travel=Math.max(1,c.planArr-(p.kind==="pass"?p.planArr:p.planDep));}
  }
  this.setScope("kofi");
 }
 blocked(t){
  if(!t.succ||Math.min(t.si,t.succ.si)<14)return false;
  for(const g of this.games)for(const u of g.trains){
   if(u===t||u.dir===t.dir)continue;
   if(u.pred&&u.pred.state==="gone"&&u.pred.si===t.succ.si&&u.si===t.si&&["sched","request","granted","signal"].includes(u.state))return true;
   if(u.si===t.succ.si&&u.succ&&u.succ.si===t.si&&(u.state==="leaving"||(["parked","stopped"].includes(u.state)&&g.routes.some(r=>r.kind==="out"&&r.train===u.id))))return true;
  }
  return false;
 }
 tick(dt){
  let left=dt;
  while(left>1e-9){
   const d=Math.min(0.05,left);left-=d;this.time+=d;for(const g of this.games)g.tick(d);
   const sig=this.games.reduce((a,g)=>a+g.changes,0);
   if(this.lastSig!==sig){this.lastSig=sig;this.lastChange=this.time;}
   else if(this.time-(this.lastChange??this.time)>12){
    const act=this.games.some(g=>g.trains.some(t=>["stopped","parked","request","granted","signal"].includes(t.state)));
    if(act){let n=0;for(const g of this.games)if(g.auto)n+=g.relief();if(n)this.reliefs++;this.lastChange=this.time;}
   }
  }
 }
 setScope(kind){
  const lo=ROUTE.findIndex(r=>r.n==="Szabadegyháza"),hi=ROUTE.findIndex(r=>r.n==="Döbrököz");
  for(const g of this.games)g.auto=kind==="auto"?true:kind==="all"?false:!(g.si>=lo&&g.si<=hi);
  this.scope=kind;
 }
 totalScore(){return this.games.reduce((a,g)=>a+g.score,0);}
 pending(){const o=[];for(const g of this.games)for(const t of g.trains)if(t.state==="request"&&!t.perm)o.push(t);return o.sort((a,b)=>a.arr-b.arr);}
 onLine(){const o=[];for(const g of this.games)for(const u of g.trains)if(u.pred&&u.pred.state==="gone"&&["sched","request","granted","signal"].includes(u.state))o.push(u);return o.sort((a,b)=>a.arr-b.arr);}
}
if(typeof module!=="undefined")module.exports={StationGame,KofiGame,buildTrains,stationDef,fmtTime};
