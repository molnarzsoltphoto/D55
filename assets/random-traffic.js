"use strict";
(function(root){
 if(root.RailRandomTraffic)return;
 if(typeof Simulation==='undefined'||typeof AutomaticBlocks==='undefined')throw Error('A random-traffic.js a térközös engine.js és az app.js után töltendő be.');
 const baseTick=Simulation.prototype.tick,baseMove=AutomaticBlocks.prototype.move,baseClear=Simulation.prototype.clearSignal,baseNext=Simulation.prototype.next;
 let activeSim=null,renderWrapped=false,showWrapped=false,resetWrapped=false,loadWrapped=false,kofiClickBound=false;
 const SPEEDS=[60,70,80,90,100];

 // 2025/2026. évi MÁV menetrend · 40a/40 fővonal + csomóponti kiágazások (első állomásig)
 const REAL_TIMETABLE=[
  // Fővonali Mecsek IC-k és S40 / G40 vonatok
  {id:'IC 800',name:'Mecsek IC (Bp-Déli – Pécs)',category:'IC',maxSpeedKmh:120,dir:1,stops:[
   {match:['déli'],dep:'05:53'},
   {match:['kelenföld'],arr:'05:59',dep:'06:01'},
   {match:['százhalombatta','batta'],arr:'06:20',dep:'06:20'},
   {match:['pusztaszabolcs'],arr:'06:35',dep:'06:36'},
   {match:['sárbogárd'],arr:'06:59',dep:'07:00'},
   {match:['pincehely'],arr:'07:17',dep:'07:18'},
   {match:['dombóvár'],arr:'07:43',dep:'07:45'},
   {match:['sásd'],arr:'07:59',dep:'08:00'},
   {match:['szentlőrinc'],arr:'08:23',dep:'08:24'},
   {match:['pécs'],arr:'08:37'}
  ]},
  {id:'IC 802',name:'Mecsek IC (Bp-Déli – Pécs)',category:'IC',maxSpeedKmh:120,dir:1,stops:[
   {match:['déli'],dep:'07:53'},
   {match:['kelenföld'],arr:'07:59',dep:'08:01'},
   {match:['pusztaszabolcs'],arr:'08:35',dep:'08:36'},
   {match:['sárbogárd'],arr:'08:59',dep:'09:00'},
   {match:['pincehely'],arr:'09:17',dep:'09:18'},
   {match:['dombóvár'],arr:'09:43',dep:'09:45'},
   {match:['sásd'],arr:'09:59',dep:'10:00'},
   {match:['szentlőrinc'],arr:'10:23',dep:'10:24'},
   {match:['pécs'],arr:'10:37'}
  ]},
  {id:'IC 801',name:'Mecsek IC (Pécs – Bp-Déli)',category:'IC',maxSpeedKmh:120,dir:-1,stops:[
   {match:['pécs'],dep:'05:14'},
   {match:['szentlőrinc'],arr:'05:26',dep:'05:27'},
   {match:['sásd'],arr:'05:50',dep:'05:51'},
   {match:['dombóvár'],arr:'06:05',dep:'06:07'},
   {match:['pincehely'],arr:'06:32',dep:'06:33'},
   {match:['sárbogárd'],arr:'06:51',dep:'06:52'},
   {match:['pusztaszabolcs'],arr:'07:15',dep:'07:16'},
   {match:['kelenföld'],arr:'07:51',dep:'07:53'},
   {match:['déli'],arr:'07:59'}
  ]},
  {id:'IC 807',name:'Mecsek IC (Pécs – Bp-Déli)',category:'IC',maxSpeedKmh:120,dir:-1,stops:[
   {match:['pécs'],dep:'07:14'},
   {match:['szentlőrinc'],arr:'07:26',dep:'07:27'},
   {match:['sásd'],arr:'07:50',dep:'07:51'},
   {match:['dombóvár'],arr:'08:05',dep:'08:07'},
   {match:['pincehely'],arr:'08:32',dep:'08:33'},
   {match:['sárbogárd'],arr:'08:51',dep:'08:52'},
   {match:['pusztaszabolcs'],arr:'09:15',dep:'09:16'},
   {match:['kelenföld'],arr:'09:51',dep:'09:53'},
   {match:['déli'],arr:'09:59'}
  ]},
  {id:'S40 4110',name:'S40 (Bp-Déli – Dombóvár)',category:'S40',maxSpeedKmh:100,dir:1,stops:[
   {match:['déli'],dep:'05:15'},
   {match:['kelenföld'],arr:'05:21',dep:'05:22'},
   {match:['pusztaszabolcs'],arr:'06:11',dep:'06:15'},
   {match:['sárbogárd'],arr:'06:42',dep:'06:44'},
   {match:['pincehely'],arr:'07:31',dep:'07:32'},
   {match:['dombóvár'],arr:'08:19'}
  ]},
  {id:'G40 4319',name:'G40 (Dombóvár – Bp-Déli)',category:'G40',maxSpeedKmh:100,dir:-1,stops:[
   {match:['dombóvár'],dep:'05:24'},
   {match:['sárbogárd'],arr:'06:58',dep:'07:02'},
   {match:['pusztaszabolcs'],arr:'07:29',dep:'07:32'},
   {match:['kelenföld'],arr:'08:11',dep:'08:13'},
   {match:['déli'],arr:'08:19'}
  ]},

  // --- CSOMÓPONTI KIÁGAZÁSOK ÉS IRÁNYVONALAK (az első állomásig) ---
  // 1-es vonal: Déli – Keleti – Győr (Kelenföldi kiágazás első állomásig)
  {id:'VONAL 1',name:'1-es vonal (Déli – Kelenföld – Kőbánya/Keleti/Győr)',category:'Személy',maxSpeedKmh:100,dir:1,stops:[
   {match:['déli'],dep:'06:00'},
   {match:['kelenföld'],arr:'06:06',dep:'06:08'},
   {match:['budaörs'],arr:'06:13',dep:null} // Kelenföldről Keleti/Győr felé az első állomás Budaörs
  ]},
  // 30a, 30 vonal: Déli – Székesfehérvár (Kelenföldi kiágazás első állomásig: Budaörs / Törökbálint)
  {id:'VONAL 30A',name:'30a vonal (Déli – Kelenföld – Törökbálint)',category:'Személy',maxSpeedKmh:100,dir:1,stops:[
   {match:['déli'],dep:'06:20'},
   {match:['kelenföld'],arr:'06:26',dep:'06:28'},
   {match:['budaörs'],arr:'06:33',dep:'06:34'},
   {match:['törökbálint'],arr:'06:38',dep:null}
  ]},
  // 44-es vonal: Pusztaszabolcs – Székesfehérvár (első állomás: Besnyő vagy Adony/Perkáta jellegű helyi megálló)
  {id:'VONAL 44',name:'44-es vonal (Pusztaszabolcs – Székesfehérvár irány)',category:'Személy',maxSpeedKmh:80,dir:1,stops:[
   {match:['pusztaszabolcs'],dep:'06:30'},
   {match:['szabadegyháza'],arr:'06:38',dep:null}
  ]},
  // Pusztaszabolcsról Dunaújváros felé (első állomás: Adony)
  {id:'VONAL DUNA',name:'Pusztaszabolcs – Dunaújváros',category:'Személy',maxSpeedKmh:80,dir:1,stops:[
   {match:['pusztaszabolcs'],dep:'06:45'},
   {match:['iváncsa','ivancsa'],arr:'06:53',dep:null}
  ]},
  // Sárbogárdon Székesfehérvár felé (első állomás: Sáregres)
  {id:'VONAL SÁR',name:'Sárbogárd – Székesfehérvár',category:'Személy',maxSpeedKmh:80,dir:1,stops:[
   {match:['sárbogárd'],dep:'07:05'},
   {match:['rétszilas'],arr:'07:12',dep:null}
  ]},
  // Rétszilasról Dunaújváros és Baja felé
  {id:'VONAL RÉTSZILAS-BAJA',name:'Rétszilas – Baja',category:'Személy',maxSpeedKmh:80,dir:1,stops:[
   {match:['rétszilas'],dep:'07:15'},
   {match:['cece'],arr:'07:22',dep:null}
  ]},
  // 45–46 vonalak: Székesfehérvár – Sárbogárd – Rétszilas – Baja
  {id:'VONAL 45-46',name:'45-46. vonal (Székesfehérvár – Baja)',category:'Személy',maxSpeedKmh:80,dir:1,stops:[
   {match:['sárbogárd'],dep:'07:20'},
   {match:['rétszilas'],arr:'07:27',dep:'07:28'},
   {match:['cece'],arr:'07:35',dep:null}
  ]},
  // 50-es vonal: Dombóvár – Baja (első állomás: Csikóstőttős)
  {id:'VONAL 50',name:'50-es vonal (Dombóvár – Baja)',category:'Személy',maxSpeedKmh:80,dir:1,stops:[
   {match:['dombóvár'],dep:'08:00'},
   {match:['sásd'],arr:'08:16',dep:null}
  ]},
  // 41-es vonal: Dombóvár – Kaposvár (első állomás: Kaposújlak / Baté)
  {id:'VONAL 41',name:'41-es vonal (Dombóvár – Kaposvár)',category:'Személy',maxSpeedKmh:80,dir:1,stops:[
   {match:['dombóvár'],dep:'08:10'},
   {match:['sásd'],arr:'08:26',dep:null}
  ]},
  // 47-es vonal: Dombóvár – Komló (első állomás: Magyarszék)
  {id:'VONAL 47',name:'47-es vonal (Dombóvár – Komló)',category:'Személy',maxSpeedKmh:80,dir:1,stops:[
   {match:['dombóvár'],dep:'08:20'},
   {match:['sásd'],arr:'08:36',dep:null}
  ]},
  // Godisáról Sásd felé
  {id:'VONAL GODISA',name:'Godisa – Sásd',category:'Személy',maxSpeedKmh:80,dir:1,stops:[
   {match:['dombóvár'],dep:'08:30'},
   {match:['sásd'],arr:'08:46',dep:null}
  ]},
  // Szentlőrincről Barcs felé (első állomás: Sellye irány / Királyhegyes)
  {id:'VONAL SZENTLŐRINC',name:'Szentlőrinc – Barcs',category:'Személy',maxSpeedKmh:80,dir:1,stops:[
   {match:['szentlőrinc'],dep:'08:40'},
   {match:['pécs'],arr:'09:02',dep:null}
  ]},
  // 60-as vonal: Pécs és Barcs között
  {id:'VONAL 60',name:'60-as vonal (Pécs – Barcs)',category:'Személy',maxSpeedKmh:80,dir:1,stops:[
   {match:['pécs'],dep:'09:00'},
   {match:['szentlőrinc'],arr:'09:22',dep:null}
  ]}
 ];

 function current(){try{return typeof sim!=='undefined'?sim:null;}catch(e){return null;}}
 function parseMin(str){if(!str)return null;const p=String(str).trim().split(':');return Number(p[0])*60+Number(p[1]);}
 function norm(str){return String(str||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');}
 function isFakeTestTrain(t){return t&&t.type!=='freight'&&!t.realTrain&&/^J\d+/i.test(String(t.id||''));}

 function getCorridorStations(){
  if(typeof STATIONS==='undefined'||!Array.isArray(STATIONS))return [];
  const main=STATIONS.filter(x=>x&&!x.branch&&x.control).map(x=>x.id);
  if(main.length>=2)return main;
  return STATIONS.filter(x=>x&&!x.branch).map(x=>x.id);
 }

 function findStationId(patterns,allowedIds){
  if(typeof STATIONS==='undefined'||!Array.isArray(STATIONS))return null;
  for(const pat of patterns){
   const np=norm(pat);
   const exact=STATIONS.find(st=>st&&allowedIds.includes(st.id)&&norm(st.name)===np);
   if(exact)return exact.id;
   const sub=STATIONS.find(st=>st&&allowedIds.includes(st.id)&&norm(st.name).includes(np));
   if(sub)return sub.id;
  }
  return null;
 }

 function buildCorridorPlan(def){
  const mainIds=getCorridorStations();
  if(mainIds.length<2)return null;
  const matched=[];
  for(const st of def.stops){
   const id=findStationId(st.match,mainIds);
   if(id!==null&&!matched.some(m=>m.station===id)){
    matched.push({station:id,arr:parseMin(st.arr),dep:parseMin(st.dep)});
   }
  }
  let path=[];
  if(matched.length>=2){
   const firstIdx=mainIds.indexOf(matched[0].station);
   const lastIdx=mainIds.indexOf(matched[matched.length-1].station);
   const step=firstIdx<=lastIdx?1:-1;
   for(let i=firstIdx;step>0?i<=lastIdx:i>=lastIdx;i+=step)path.push(mainIds[i]);
  }else if(matched.length===1){
   const idx=mainIds.indexOf(matched[0].station);
   path=def.dir>0?mainIds.slice(idx,idx+3):mainIds.slice(Math.max(0,idx-2),idx+1).reverse();
  }else{
   path=def.dir>0?mainIds.slice():mainIds.slice().reverse();
  }
  if(path.length<2)return null;

  const firstKnown=matched[0]||{arr:360,dep:360};
  const lastKnown=matched[matched.length-1]||{arr:420,dep:420};
  const firstStopDef=def.stops[0];
  const lastStopDef=def.stops[def.stops.length-1];
  const rawStart=parseMin(firstStopDef.dep||firstStopDef.arr)||360;
  const rawEnd=parseMin(lastStopDef.arr||lastStopDef.dep)||(rawStart+60);

  const kmStart=STATIONS[path[0]].km||0;
  const kmEnd=STATIONS[path[path.length-1]].km||path.length*10;
  const totalKm=Math.max(1,Math.abs(kmEnd-kmStart));

  const t0=firstKnown.dep??firstKnown.arr??rawStart;
  const t1=lastKnown.arr??lastKnown.dep??rawEnd;
  const span=Math.max(path.length*3,Math.abs(t1-t0));

  const plan=[];
  let prevTime=t0;
  for(let i=0;i<path.length;i++){
   const stId=path[i];
   const known=matched.find(m=>m.station===stId);
   const dist=Math.abs((STATIONS[stId].km||0)-kmStart);
   const interp=Math.round(t0+span*(dist/totalKm));
   if(i===0){
    const dep=known&&(known.dep!==null||known.arr!==null)?(known.dep??known.arr):interp;
    plan.push({station:stId,arr:null,dep});
    prevTime=dep;
   }else{
    let arr=known&&(known.arr!==null||known.dep!==null)?(known.arr??known.dep):Math.max(prevTime+2,interp);
    if(arr<=prevTime)arr=prevTime+2;
    const isMajor=/sarbogard|dombovar|pusztaszabolcs|kelenfold|retszilas|pincehely/.test(norm(STATIONS[stId].name));
    const dwell=def.category==='IC'?(isMajor?1:0):1;
    let dep=known&&known.dep!==null?known.dep:(i===path.length-1?arr:arr+dwell);
    if(dep<arr)dep=arr;
    plan.push({station:stId,arr,dep});
    prevTime=dep;
   }
  }
  return {path,plan};
 }

 function spawnRealTrain(s,item){
  const {def,path,plan}=item;
  if(s.trains.some(x=>x.id===def.id))return s.trains.find(x=>x.id===def.id);
  const now=s.time||360;
  let idx=0;
  for(let i=0;i<plan.length-1;i++){
   if((plan[i].dep||plan[i].arr||360)<=now+2)idx=i;
  }
  let spawnIdx=idx;
  while(spawnIdx<path.length-1&&!s.free(path[spawnIdx]))spawnIdx++;
  if(spawnIdx>=path.length-1||!s.free(path[spawnIdx]))return null;

  const at=path[spawnIdx];
  const scheduledDep=plan[spawnIdx].dep||plan[spawnIdx].arr||(now+1);
  const dep=Math.max(now+0.5,scheduledDep);
  const t=s.add(at,def.dir,dep);
  if(!t)return null;

  t.id=def.id;
  t.type='passenger';
  t.realTrain=true;
  t.trainName=def.name;
  t.category=def.category;
  t.maxSpeedKmh=def.maxSpeedKmh||100;
  t.actualSpeedKmh=0;
  t.trafficPath=path.slice(spawnIdx);
  t.plan=plan.slice(spawnIdx).map((p,k)=>({
   station:p.station,
   arr:k===0?null:p.arr,
   dep:k===0?dep:p.dep,
   actualArr:k===0?now:undefined,
   realArr:k===0?now:undefined
  }));
  t.generatedDelayMin=0;
  return t;
 }

 function purgeFakeTrainsAndApplyReal(s){
  if(!s||typeof STATIONS==='undefined')return;
  const fakeTrains=s.trains.filter(isFakeTestTrain);
  const hasReal=s.trains.some(t=>t.realTrain);
  if(fakeTrains.length===0&&(hasReal||(s.pendingRealTrains&&s.pendingRealTrains.length>0)))return;

  for(const ft of fakeTrains){
   delete s.permissions[ft.id];
   if(s.routes){for(const rk of Object.keys(s.routes)){if(s.routes[rk].train===ft.id)delete s.routes[rk];}}
   if(s.blockSystem&&s.blockSystem.sections){
    for(const sec of Object.values(s.blockSystem.sections)){
     if(sec&&sec.lanes)for(const ln of sec.lanes)if(ln&&ln.blocks)for(const b of ln.blocks)if(b.owner===ft.id)b.owner=null;
    }
   }
  }
  s.trains=s.trains.filter(t=>!isFakeTestTrain(t));

  if(!hasReal&&(!s.pendingRealTrains||s.pendingRealTrains.length===0)){
   s.pendingRealTrains=[];
   const now=s.time||360;
   for(const def of REAL_TIMETABLE){
    const built=buildCorridorPlan(def);
    if(!built)continue;
    const firstDep=built.plan[0].dep||360;
    const lastArr=built.plan[built.plan.length-1].arr||(firstDep+60);
    if(lastArr<now)continue;
    if(firstDep<=now+20){
     const tr=spawnRealTrain(s,{def,path:built.path,plan:built.plan});
     if(!tr)s.pendingRealTrains.push({def,path:built.path,plan:built.plan,spawnTime:now+1});
    }else{
     s.pendingRealTrains.push({def,path:built.path,plan:built.plan,spawnTime:Math.max(now+1,firstDep-4)});
    }
   }
   s.log('VALÓS MENETREND (40a/40 + kiágazások): '+s.trains.filter(t=>t.realTrain).length+' aktív és '+s.pendingRealTrains.length+' előjegyzett vonat betöltve.');
  }

  const warn=document.querySelector('.warning');
  if(warn)warn.textContent='Működő D55-jellegű játékpult. 2025/2026. évi menetrend + tény adatok és Kelenföld, Pusztaszabolcs, Sárbogárd, Rétszilas, Dombóvár, Godisa, Szentlőrinc csomóponti kiágazások.';
  const dlgNote=document.querySelector('#trainDialog p.small');
  if(dlgNote)dlgNote.textContent='Hivatalos 2025/2026. évi MÁV menetrend – Terv és Tény adatokkal';
 }

 function ensure(s){
  if(!s.randomTraffic){const seed=((Date.now()>>>0)^((s.time*1000)|0))>>>0;s.randomTraffic={version:1,seed:seed||123456789,eventsEnabled:true,freightEnabled:true,intensity:'normal',nextEvent:s.time+4,nextFreight:s.time+3,serial:0,eventSerial:0,active:[],history:[],freightArchive:[],totalFreight:0};}
  const r=s.randomTraffic;if(!r.active)r.active=[];if(!r.history)r.history=[];if(!r.freightArchive)r.freightArchive=[];
  purgeFakeTrainsAndApplyReal(s);
  for(const t of s.trains){if(!t.type)t.type='passenger';if(!t.maxSpeedKmh)t.maxSpeedKmh=t.type==='freight'?80:(t.realTrain?100:65);}
  return r;
 }
 function rand(s){const r=ensure(s);let x=r.seed>>>0;x^=x<<13;x^=x>>>17;x^=x<<5;r.seed=x>>>0||123456789;return r.seed/4294967296;}
 function integer(s,a,b){return a+Math.floor(rand(s)*(b-a+1));}
 function pick(s,arr){return arr.length?arr[Math.floor(rand(s)*arr.length)]:null;}
 function spacing(s,kind){const r=ensure(s),factor=r.intensity==='quiet'?1.8:r.intensity==='busy'?.6:1;return integer(s,kind==='event'?12:15,kind==='event'?25:30)*factor;}
 function history(s,event){const r=ensure(s);r.history.unshift(event);r.history=r.history.slice(0,80);}
 function addEvent(s,ev){const r=ensure(s);ev.id='E'+String(++r.eventSerial).padStart(3,'0');ev.start=s.time;r.active.push(ev);history(s,{...ev,status:'active'});s.log('ESEMÉNY '+ev.id+': '+ev.title+' · '+ev.detail+' · vége '+clock(ev.until));return {ok:true,event:ev};}
 function clock(v){if(v===null||v===undefined||!Number.isFinite(v))return '—';return String(Math.floor(v/60)%24).padStart(2,'0')+':'+String(Math.floor(v%60)).padStart(2,'0');}
 function createEvent(s,kind,targetId){
  ensure(s);if(!kind)kind=pick(s,['vehicle','station','slow','signal']);
  const eligible=s.trains.filter(t=>!t.finished&&['parked','line'].includes(t.phase)&&(!targetId||t.id===targetId));
  if(kind==='vehicle'||kind==='station'){
   const pool=eligible.filter(t=>kind==='vehicle'||t.phase==='parked'),t=pick(s,pool);if(!t)return {ok:false,msg:'Nincs megfelelő vonat az eseményhez.'};
   const minutes=integer(s,kind==='vehicle'?3:2,kind==='vehicle'?8:6),until=(t.phase==='parked'?Math.max(s.time,t.dep):s.time)+minutes;
   t.trafficHoldUntil=Math.max(t.trafficHoldUntil||0,until);if(t.phase==='parked')t.dep=Math.max(t.dep,until);
   return addEvent(s,{kind,trainId:t.id,until,title:kind==='vehicle'?'Járműhiba':'Elhúzódó állomási tartózkodás',detail:t.id+' · '+minutes+' perc várakozás',hold:true,minutes});
  }
  if(kind==='slow'){
   const t=pick(s,s.trains.filter(t=>t.phase==='line'&&s.permissions[t.id]&&(!targetId||t.id===targetId)));if(!t)return {ok:false,msg:'Nincs állomásközben közlekedő vonat.'};
   const p=s.permissions[t.id],sec=s.blockSystem.sections[p.section],minutes=integer(s,5,12),factor=.35;
   return addEvent(s,{kind,section:p.section,lane:p.lane,until:s.time+minutes,title:'Ideiglenes lassúmenet',detail:STATIONS[sec.from].name+'–'+STATIONS[sec.to].name+' · '+minutes+' percig 35%-os modellsebesség',factor,minutes});
  }
  if(kind==='signal'){
   const pool=Object.values(s.routes).filter(r=>{const t=s.trains.find(t=>t.id===r.train);return t&&(!targetId||t.id===targetId)&&((r.kind==='out'&&t.phase==='parked')||(r.kind==='in'&&['line','approach','hold'].includes(t.phaseeyeglasses))||(r.kind==='in'&&['line','approach','hold'].includes(t.phase)));});
   const route=pick(s,pool);if(!route)return {ok:false,msg:'Nincs kezelhető jelzőhöz tartozó alkalmas vágányút.'};
   const minutes=integer(s,3,7);route.clear=false;
   return addEvent(s,{kind,station:route.at,signal:route.start,trainId:route.train,until:s.time+minutes,title:'Jelzőhiba',detail:STATIONS[route.at].name+' · '+route.start+' · '+minutes+' percig Megállj',minutes});
  }
  return {ok:false,msg:'Ismeretlen eseménytípus.'};
 }
 function randomEvent(s){
  const first=pick(s,['vehicle','station','slow','signal']);let result=createEvent(s,first);
  if(!result.ok)for(const k of ['vehicle','slow','station','signal']){result=createEvent(s,k);if(result.ok)break;}
  return result;
 }
 function freightPlan(path,dep,speed){let time=dep;const out=[{station:path[0],arr:null,dep}];for(let i=1;i<path.length;i++){time+=Math.abs(STATIONS[path[i]].km-STATIONS[path[i-1]].km)/speed*60+2.9;const arr=time;time+=2;out.push({station:path[i],arr,dep:time});}return out;}
 function spawnFreight(s,options){
  const r=ensure(s);options=options||{};
  if(s.trains.filter(t=>t.type==='freight'&&!t.finished).length>=12)return {ok:false,msg:'Már 12 aktív tehervonat van a hálózaton.'};
  const ids=STATIONS.filter(x=>x.control&&!x.boundary&&!x.branch).map(x=>x.id);let at=options.origin,dir=options.dir;
  if(at===undefined){
   let candidates=ids.filter((id,i)=>s.free(id)&&i>0&&i<ids.length-1);
   if(s.view==='station'){
    const q=ids.indexOf(s.selected);candidates=[ids[q-1],ids[q+1]].filter(id=>id!==undefined&&s.free(id));
    at=pick(s,candidates);if(at!==null&&at!==undefined)dir=at<s.selected?1:-1;
   }else{at=pick(s,candidates);dir=rand(s)<.5?1:-1;}
  }
  if(at===undefined||at===null||!ids.includes(at)||!s.free(at))return {ok:false,msg:'Nincs alkalmas szabad induló állomás.'};
  if(dir!==1&&dir!==-1)dir=rand(s)<.5?1:-1;
  const pos=ids.indexOf(at),count=options.hops||integer(s,2,5);const path=[at];for(let k=1;k<=count;k++){const n=ids[pos+dir*k];if(n===undefined)break;path.push(n);}
  if(path.length<2)return {ok:false,msg:'Ebben az irányban nincs következő állomás.'};
  const dep=s.time+(options.departIn===undefined?2:Math.max(0,options.departIn));const t=s.add(at,dir,dep);if(!t)return {ok:false,msg:'Nem sikerült a vonatot szabad vágányra tenni.'};
  do{t.id='T'+String(700000+(++r.serial));}while(s.trains.some(x=>x!==t&&x.id===t.id));
  const requested=options.maxSpeedKmh===undefined?pick(s,SPEEDS):Number(options.maxSpeedKmh);
  t.type='freight';t.maxSpeedKmh=Math.max(1,Math.min(100,Number.isFinite(requested)?requested:80));t.actualSpeedKmh=0;t.trafficPath=path;t.plan=freightPlan(path,dep,t.maxSpeedKmh);t.generatedDelayMin=0;r.totalFreight++;
  s.log('TEHERVONAT: '+t.id+' · '+STATIONS[at].name+' → '+STATIONS[path[path.length-1]].name+' · legfeljebb '+t.maxSpeedKmh+' km/h.');
  return {ok:true,train:t};
 }
 Simulation.prototype.next=function(t){if(t.trafficPath){const i=t.trafficPath.indexOf(t.at);return i>=0&&i+1<t.trafficPath.length?t.trafficPath[i+1]:null;}return baseNext.call(this,t);};
 Simulation.prototype.clearSignal=function(station,signal){const r=ensure(this);if(r.active.some(e=>e.kind==='signal'&&e.station===station&&e.signal===signal&&e.until>this.time))return {ok:false,msg:'Jelzőhiba miatt a jelző még nem állítható szabadra.'};return baseClear.call(this,station,signal);};
 AutomaticBlocks.prototype.move=function(t,p,dt){
  const s=activeSim||current();let factor=1;const time=s?s.time:0;
  if(t.trafficHoldUntil>time){t.actualSpeedKmh=0;t.trafficStopped=true;t.blockWaiting=false;return false;}
  if(s){const r=ensure(s);for(const ev of r.active)if(ev.kind==='slow'&&ev.section===p.section&&ev.lane===p.lane&&ev.until>time)factor=Math.min(factor,ev.factor);}
  const max=t.type==='freight'?Math.min(100,Math.max(1,Number(t.maxSpeedKmh)||80)):(t.realTrain?Math.min(120,Number(t.maxSpeedKmh)||100):65);
  const before=t.distance||0,done=baseMove.call(this,t,p,dt*max/65*factor);t.actualSpeedKmh=dt>0?Math.min(max,(t.distance-before)/dt*60):0;t.trafficStopped=false;return done;
 };
 function expire(s){const r=ensure(s),expired=r.active.filter(ev=>ev.until<=s.time);for(const ev of expired){s.log('ESEMÉNY VÉGE '+ev.id+': '+ev.title+'.'+(ev.kind==='signal'?' A jelző újra kezelhető, a szabad jelzést külön kell beállítani.':''));const h=r.history.find(x=>x.id===ev.id);if(h)h.status='resolved';}r.active=r.active.filter(ev=>ev.until>s.time);for(const t of s.trains){if(t.trafficHoldUntil<=s.time)t.trafficStopped=false;}}
 function retire(s){const r=ensure(s);for(const t of s.trains){if(t.type!=='freight'||!t.finished)continue;if(t.trafficFinishedAt===undefined)t.trafficFinishedAt=s.time;}
  const retired=s.trains.filter(t=>t.type==='freight'&&t.finished&&s.time-t.trafficFinishedAt>=8&&!s.permissions[t.id]);
  for(const t of retired){r.freightArchive.push({id:t.id,time:s.time,destination:t.at});s.log(t.id+': a célállomási tartózkodás után kiállt a játékból.');}r.freightArchive=r.freightArchive.slice(-100);s.trains=s.trains.filter(t=>!retired.includes(t));
 }
 function checkPendingRealTrains(s){
  if(!s.pendingRealTrains||!s.pendingRealTrains.length)return;
  const remaining=[];
  for(const item of s.pendingRealTrains){
   if(s.time>=item.spawnTime){
    const tr=spawnRealTrain(s,item);
    if(tr){
     s.log('MENETREND SZERINTI BELÉPÉS: '+tr.id+' ('+tr.trainName+') · '+STATIONS[tr.at].name+'.');
    }else{
     item.spawnTime=s.time+1;
     remaining.push(item);
    }
   }else{
    remaining.push(item);
   }
  }
  s.pendingRealTrains=remaining;
 }
 Simulation.prototype.tick=function(dt){
  ensure(this);if(!Number.isFinite(dt)||dt<=0)return;let left=dt;
  while(left>1e-9){
   const d=Math.min(.05,left);left-=d;
   const r=ensure(this);expire(this);checkPendingRealTrains(this);
   // Tény adatok frissítése az aktív vonatoknál
   for(const t of this.trains){
    if(t.realTrain&&!t.finished&&t.plan){
     const curRow=t.plan.find(p=>p.station===t.at);
     if(curRow&&curRow.actualArr===undefined)curRow.actualArr=this.time;
    }
   }
   if(r.eventsEnabled&&this.time>=r.nextEvent){const ev=randomEvent(this);r.nextEvent=this.time+(ev.ok?spacing(this,'event'):2);}
   if(r.freightEnabled&&this.time>=r.nextFreight){const f=spawnFreight(this);r.nextFreight=this.time+(f.ok?spacing(this,'freight'):3);}
   for(const t of this.trains)if(t.trafficHoldUntil>this.time&&['line','parked'].includes(t.phase)){t.generatedDelayMin=(t.generatedDelayMin||0)+d;if(t.phase==='parked')t.dep=Math.max(t.dep,t.trafficHoldUntil);}
   const prev=activeSim;activeSim=this;try{baseTick.call(this,d);}finally{activeSim=prev;}
   expire(this);retire(this);
  }
 };
 function escape(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;}[c]));}
 function notify(s,result){if(typeof toast==='function')toast(result.ok?'A művelet sikeres.':result.msg);if(typeof render==='function')render();updateUI();}

 // KÖFI Canvas és SVG kattintáskezelés
 const canvasTrainHits=[];
 if(typeof CanvasRenderingContext2D!=='undefined'&&!CanvasRenderingContext2D.prototype._rtTextHooked){
  CanvasRenderingContext2D.prototype._rtTextHooked=true;
  const origFillText=CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText=function(text,x,y){
   try{
    const s=current();
    if(s&&this.canvas&&this.canvas.closest&&this.canvas.closest('#kofi')){
     const str=String(text||'').trim();
     const tr=s.trains.find(t=>str===t.id||str.startsWith(t.id+' ')||str.includes(t.id));
     if(tr){
      const m=this.getTransform();
      const sx=m.a*x+m.c*y+m.e;
      const sy=m.b*x+m.d*y+m.f;
      canvasTrainHits.push({id:tr.id,x:sx,y:sy,canvas:this.canvas,time:Date.now()});
      if(canvasTrainHits.length>250)canvasTrainHits.shift();
     }
    }
   }catch(e){}
   return origFillText.apply(this,arguments);
  };
 }

 function openTrainScheduleModal(trainId){
  const s=current();if(!s)return;
  const t=s.trains.find(x=>x.id===trainId);if(!t)return;
  if(typeof root.showTrain==='function'){
   root.showTrain(trainId);
  }
  const dlg=document.getElementById('trainDialog');
  const title=document.getElementById('trainTitle');
  const tbody=document.getElementById('schedule');
  if(!dlg||!title||!tbody)return;
  if(t.type==='freight'){
   title.textContent=t.id+' · véletlen tehervonat · max. '+t.maxSpeedKmh+' km/h';
  }else if(t.realTrain){
   title.textContent=t.id+' · '+t.trainName;
  }else{
   title.textContent=t.id;
  }
  tbody.innerHTML=(t.plan||[]).map(row=>{
   const stName=(typeof STATIONS!=='undefined'&&STATIONS[row.station])?STATIONS[row.station].name:('Állomás #'+row.station);
   const isHere=t.at===row.station&&t.phase==='parked';
   const actual=row.actualArr??row.realArr??(isHere?s.time:null);
   return '<tr'+(isHere?' style="background:#244357;font-weight:bold"':'')+'><td>'+escape(stName)+'</td><td>'+clock(row.arr)+'</td><td>'+clock(row.dep)+'</td><td>'+clock(actual)+'</td></tr>';
  }).join('');
  if(typeof dlg.showModal==='function'&&!dlg.open)dlg.showModal();
 }

 function bindKofiTrainClick(){
  if(kofiClickBound||typeof document==='undefined')return;
  kofiClickBound=true;
  let downPos=null;
  document.addEventListener('pointerdown',function(ev){
   downPos={x:ev.clientX,y:ev.clientY};
  },true);

  document.addEventListener('click',function(ev){
   if(downPos&&Math.hypot(ev.clientX-downPos.x,ev.clientY-downPos.y)>8)return;
   const netEl=ev.target&&ev.target.closest?ev.target.closest('[data-nettrain],[data-train]'):null;
   if(netEl){
    const tid=netEl.getAttribute('data-nettrain')||netEl.getAttribute('data-train');
    if(tid){
     ev.preventDefault();
     ev.stopPropagation();
     openTrainScheduleModal(tid);
     return;
    }
   }
   const kofiBox=document.getElementById('kofi');
   if(kofiBox&&kofiBox.contains(ev.target)){
    const s=current();if(!s)return;
    if(ev.target.tagName==='CANVAS'){
     const canvas=ev.target;
     const rect=canvas.getBoundingClientRect();
     const scaleX=canvas.width/(rect.width||1);
     const scaleY=canvas.height/(rect.height||1);
     const cx=(ev.clientX-rect.left)*scaleX;
     const cy=(ev.clientY-rect.top)*scaleY;
     const now=Date.now();
     let best=null,bestDist=42*Math.max(scaleX,scaleY);
     for(let i=canvasTrainHits.length-1;i>=0;i--){
      const h=canvasTrainHits[i];
      if(h.canvas!==canvas||now-h.time>5000)continue;
      const d=Math.hypot(cx-h.x,cy-h.y);
      if(d<bestDist){bestDist=d;best=h;}
     }
     if(best){
      ev.preventDefault();
      ev.stopPropagation();
      openTrainScheduleModal(best.id);
      return;
     }
    }
    let node=ev.target;
    while(node&&node!==kofiBox){
     const txt=(node.textContent||'').trim();
     const match=s.trains.find(tr=>txt===tr.id||txt.startsWith(tr.id+' '));
     if(match){
      ev.preventDefault();
      ev.stopPropagation();
      openTrainScheduleModal(match.id);
      return;
     }
     node=node.parentElement;
    }
   }
  },true);
 }

 function decorate(s){
  if(!s)return;
  for(const el of document.querySelectorAll('[data-nettrain]')){el.style.cursor='pointer';}
  for(const t of s.trains){
   for(const el of document.querySelectorAll('[data-nettrain="'+t.id+'"]')){
    let title=el.querySelector('title');
    if(!title){title=document.createElementNS('http://www.w3.org/2000/svg','title');el.appendChild(title);}
    if(t.type==='freight'){
     const rect=el.querySelector('rect');if(rect)rect.setAttribute('fill',t.trafficStopped?'#f5a64a':'#c092ef');
     title.textContent=t.id+' · TEHER · max. '+t.maxSpeedKmh+' km/h (Kattints a menetrendhez)';
    }else{
     const rect=el.querySelector('rect');if(rect&&t.category==='IC')rect.setAttribute('fill',t.trafficStopped?'#f5a64a':'#3b82f6');
     title.textContent=t.id+(t.trainName?' ('+t.trainName+')':'')+' · Kattints a menetrendhez (Terv / Tény)!';
    }
   }
   if(t.type==='freight'){
    const table=document.getElementById('trains');if(table)for(const b of table.querySelectorAll('button'))if(b.textContent===t.id){b.textContent=t.id+' · TEHER ≤'+t.maxSpeedKmh;}
   }else if(t.realTrain){
    const table=document.getElementById('trains');if(table)for(const b of table.querySelectorAll('button'))if(b.textContent===t.id){b.textContent=t.id+' · '+t.trainName;b.title='Menetrendi járat Terv/Tény adatokkal';}
   }
  }
 }
 function mount(){
  if(document.getElementById('rt-panel'))return;const nav=document.querySelector('nav');if(!nav)return;
  const box=document.createElement('section');box.id='rt-panel';box.style.cssText='margin:0 20px 12px;padding:12px 14px;background:#172b38;border:1px solid #587188;border-radius:9px;font:13px system-ui;color:#dfeaf3';
  box.innerHTML='<div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap"><strong>Valós Menetrend (Terv & Tény) + Csomóponti Kiágazások</strong><label><input id="rt-events" type="checkbox"> Események</label><label><input id="rt-freight" type="checkbox"> Tehervonatok</label><select id="rt-intensity"><option value="quiet">Ritka</option><option value="normal">Normál</option><option value="busy">Sűrű</option></select><button id="rt-event-now" type="button">Esemény most</button><button id="rt-freight-now" type="button">Tehervonat most</button><button id="rt-reload-real" type="button" style="background:#2d5a7b">Menetrend újratöltése</button></div><div id="rt-status" style="margin-top:8px;color:#b5cadd"></div><div id="rt-active" style="margin-top:7px;line-height:1.7"></div>';
  nav.insertAdjacentElement('afterend',box);
  document.getElementById('rt-events').onchange=e=>{const s=current();if(s)ensure(s).eventsEnabled=e.target.checked;};
  document.getElementById('rt-freight').onchange=e=>{const s=current();if(s)ensure(s).freightEnabled=e.target.checked;};
  document.getElementById('rt-intensity').onchange=e=>{const s=current();if(s)ensure(s).intensity=e.target.value;};
  document.getElementById('rt-event-now').onclick=()=>{const s=current();if(s)notify(s,randomEvent(s));};
  document.getElementById('rt-freight-now').onclick=()=>{const s=current();if(s)notify(s,spawnFreight(s));};
  document.getElementById('rt-reload-real').onclick=()=>{
   const s=current();
   if(s){
    s.trains=s.trains.filter(t=>t.type==='freight');
    s.pendingRealTrains=[];
    s.routes={};
    s.permissions={};
    purgeFakeTrainsAndApplyReal(s);
    if(typeof root.render==='function')root.render();
    updateUI();
   }
  };
 }
 function updateUI(){const s=current();if(!s)return;mount();const r=ensure(s),el=document.getElementById('rt-panel');if(!el)return;
  document.getElementById('rt-events').checked=r.eventsEnabled;document.getElementById('rt-freight').checked=r.freightEnabled;document.getElementById('rt-intensity').value=r.intensity;
  const activeFreight=s.trains.filter(t=>t.type==='freight'&&!t.finished).length;
  const activeReal=s.trains.filter(t=>t.realTrain&&!t.finished).length;
  document.getElementById('rt-status').textContent='Aktív menetrendi vonat (Terv/Tény): '+activeReal+' (előjegyezve: '+(s.pendingRealTrains?s.pendingRealTrains.length:0)+') · Tehervonat: '+activeFreight+' · Zavar: '+r.active.length+' · Kattints a vonatra a menetrend megnyitásához!';
  document.getElementById('rt-active').innerHTML=r.active.length?r.active.map(ev=>'<div style="color:#ffd190"><b>'+escape(ev.id+' · '+ev.title)+'</b> — '+escape(ev.detail)+' · hátra '+Math.max(0,Math.ceil(ev.until-s.time))+' perc</div>').join(''):'<span style="color:#94b3a9">Nincs aktív zavar.</span>';
  decorate(s);
 }
 function installUI(){
  mount();bindKofiTrainClick();
  const s=current();if(s)ensure(s);
  if(!renderWrapped&&typeof root.render==='function'){const render=root.render;root.render=function(){const s=current();if(s)purgeFakeTrainsAndApplyReal(s);const v=render.apply(this,arguments);updateUI();return v;};renderWrapped=true;}
  if(!showWrapped&&typeof root.showTrain==='function'){const sh=root.showTrain;root.showTrain=function(id){const v=sh.apply(this,arguments),s=current(),t=s&&s.trains.find(t=>t.id===id),title=document.getElementById('trainTitle');if(title&&t){if(t.type==='freight')title.textContent=t.id+' · véletlen tehervonat · max. '+t.maxSpeedKmh+' km/h';else if(t.realTrain)title.textContent=t.id+' · '+t.trainName+' (Terv & Tény adatokkal)';}return v;};showWrapped=true;}
  if(!resetWrapped&&typeof root.reset==='function'){const rs=root.reset;root.reset=function(){const v=rs.apply(this,arguments),s=current();if(s){s.pendingRealTrains=[];purgeFakeTrainsAndApplyReal(s);if(typeof root.render==='function')root.render();}return v;};resetWrapped=true;}
  if(!loadWrapped&&typeof root.load==='function'){const ld=root.load;root.load=function(){const v=ld.apply(this,arguments),s=current();if(s){purgeFakeTrainsAndApplyReal(s);if(typeof root.render==='function')root.render();}return v;};loadWrapped=true;}
  updateUI();
 }
 const api={ensure,spawnFreight,createEvent,randomEvent,installUI,openTrainScheduleModal,setSeed(s,seed){ensure(s).seed=(seed>>>0)||123456789;}};
 root.RailRandomTraffic=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installUI);else installUI();setInterval(installUI,600);}
})(typeof window!=='undefined'?window:globalThis);
