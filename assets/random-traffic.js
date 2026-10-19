"use strict";
(function(root){
 if(root.RailRandomTraffic)return;
 
 // Teljesen önálló MÁV menetrendi és Terv/Tény kezelő modul
 let activeSim=null;

 function clock(v){
  if(v===null||v===undefined||!Number.isFinite(v))return '—';
  const m=Math.floor(v);
  return String(Math.floor(m/60)%24).padStart(2,'0')+':'+String(Math.floor(m%60)).padStart(2,'0');
 }

 const REAL_TIMETABLE_FULL=[
  {id:'IC 800',name:'Mecsek IC (Bp-Déli – Pécs)',category:'IC',maxSpeedKmh:120,dir:1,plan:[{st:'Budapest-Déli',dep:353},{st:'Kelenföld',arr:359,dep:361},{st:'Pusztaszabolcs',arr:395,dep:396},{st:'Sárbogárd',arr:419,dep:420},{st:'Dombóvár',arr:463,dep:465},{st:'Pécs',arr:517}]},
  {id:'IC 802',name:'Mecsek IC (Bp-Déli – Pécs)',category:'IC',maxSpeedKmh:120,dir:1,plan:[{st:'Budapest-Déli',dep:473},{st:'Kelenföld',arr:479,dep:481},{st:'Pusztaszabolcs',arr:515,dep:516},{st:'Sárbogárd',arr:539,dep:540},{st:'Dombóvár',arr:583,dep:585},{st:'Pécs',arr:637}]},
  {id:'IC 801',name:'Mecsek IC (Pécs – Bp-Déli)',category:'IC',maxSpeedKmh:120,dir:-1,plan:[{st:'Pécs',dep:314},{st:'Dombóvár',arr:365,dep:367},{st:'Sárbogárd',arr:411,dep:412},{st:'Pusztaszabolcs',arr:435,dep:436},{st:'Kelenföld',arr:471,dep:473},{st:'Budapest-Déli',arr:479}]},
  {id:'IC 807',name:'Mecsek IC (Pécs – Bp-Déli)',category:'IC',maxSpeedKmh:120,dir:-1,plan:[{st:'Pécs',dep:434},{st:'Dombóvár',arr:485,dep:487},{st:'Sárbogárd',arr:531,dep:532},{st:'Pusztaszabolcs',arr:555,dep:556},{st:'Kelenföld',arr:591,dep:593},{st:'Budapest-Déli',arr:599}]},
  {id:'S40 4110',name:'S40 (Bp-Déli – Dombóvár)',category:'S40',maxSpeedKmh:100,dir:1,plan:[{st:'Budapest-Déli',dep:315},{st:'Kelenföld',arr:321,dep:322},{st:'Pusztaszabolcs',arr:371,dep:375},{st:'Sárbogárd',arr:402,dep:404},{st:'Dombóvár',arr:499}]},
  {id:'G40 4319',name:'G40 (Dombóvár – Bp-Déli)',category:'G40',maxSpeedKmh:100,dir:-1,plan:[{st:'Dombóvár',dep:324},{st:'Sárbogárd',arr:418,dep:422},{st:'Pusztaszabolcs',arr:449,dep:452},{st:'Kelenföld',arr:491,dep:493},{st:'Budapest-Déli',arr:499}]},
  // Kért kiágazások (az első állomásig)
  {id:'KIÁG 1',name:'1-es vonal (Kelenföld – Budaörs)',category:'Személy',maxSpeedKmh:100,dir:1,plan:[{st:'Kelenföld',dep:360},{st:'Budaörs',arr:366}]},
  {id:'KIÁG 30A',name:'30a vonal (Kelenföld – Törökbálint)',category:'Személy',maxSpeedKmh:100,dir:1,plan:[{st:'Kelenföld',dep:370},{st:'Budaörs',arr:375,dep:376},{st:'Törökbálint',arr:380}]},
  {id:'KIÁG DUNA',name:'Pusztaszabolcs – Dunaújváros irány (Iváncsa)',category:'Személy',maxSpeedKmh:80,dir:1,plan:[{st:'Pusztaszabolcs',dep:385},{st:'Iváncsa',arr:393}]},
  {id:'KIÁG 44',name:'44-es vonal (Pusztaszabolcs – Szabadegyháza)',category:'Személy',maxSpeedKmh:80,dir:1,plan:[{st:'Pusztaszabolcs',dep:400},{st:'Szabadegyháza',arr:408}]},
  {id:'KIÁG SÁR',name:'Sárbogárd – Székesfehérvár irány (Rétszilas)',category:'Személy',maxSpeedKmh:80,dir:1,plan:[{st:'Sárbogárd',dep:420},{st:'Rétszilas',arr:427}]},
  {id:'KIÁG RÉTSZILAS',name:'Rétszilas – Baja irány (Cece)',category:'Személy',maxSpeedKmh:80,dir:1,plan:[{st:'Rétszilas',dep:430},{st:'Cece',arr:437}]},
  {id:'KIÁG 41',name:'41-es vonal (Dombóvár – Kaposvár / Sásd)',category:'Személy',maxSpeedKmh:80,dir:1,plan:[{st:'Dombóvár',dep:450},{st:'Sásd',arr:466}]},
  {id:'KIÁG 50',name:'50-es vonal (Dombóvár – Baja / Sásd)',category:'Személy',maxSpeedKmh:80,dir:1,plan:[{st:'Dombóvár',dep:465},{st:'Sásd',arr:481}]},
  {id:'KIÁG 47',name:'47-es vonal (Dombóvár – Komló / Sásd)',category:'Személy',maxSpeedKmh:80,dir:1,plan:[{st:'Dombóvár',dep:480},{st:'Sásd',arr:496}]},
  {id:'KIÁG SZENTLŐRINC',name:'Szentlőrinc – Barcs irány (Pécs felé)',category:'Személy',maxSpeedKmh:80,dir:1,plan:[{st:'Szentlőrinc',dep:510},{st:'Pécs',arr:532}]},
  {id:'KIÁG 60',name:'60-as vonal (Pécs – Barcs / Szentlőrinc)',category:'Személy',maxSpeedKmh:80,dir:1,plan:[{st:'Pécs',dep:540},{st:'Szentlőrinc',arr:562}]}
 ];

 function injectRealTrains(sim){
  if(!sim||sim._realTrainsInjected)return;
  sim._realTrainsInjected=true;
  if(!sim.trains)sim.trains=[];
  
  // Eredeti tesztvonatok törlése
  sim.trains=sim.trains.filter(t=>t.type==='freight');

  for(const def of REAL_TIMETABLE_FULL){
   const firstStop=def.plan[0];
   const lastStop=def.plan[def.plan.length-1];
   const newTrain={
    id:def.id,
    type:'passenger',
    realTrain:true,
    trainName:def.name,
    category:def.category,
    maxSpeedKmh:def.maxSpeedKmh,
    actualSpeedKmh:0,
    phase:'parked',
    at:0,
    dep:firstStop.dep||360,
    plan:def.plan.map((p,idx)=>({
     station:idx,
     arr:p.arr||null,
     dep:p.dep||null,
     actualArr:idx===0?(sim.time||360):undefined
    }))
   };
   sim.trains.push(newTrain);
  }
  sim.log('MÁV Menetrend (Terv & Tény) + Kiágazások sikeresen betöltve.');
 }

 // Menetrendi ablak felugrasztása Terv / Tény adatokkal
 function openTrainScheduleModal(trainId){
  const s=typeof sim!=='undefined'?sim:null;
  if(!s)return;
  const t=s.trains.find(x=>x.id===trainId);
  if(!t)return;
  
  const dlg=document.getElementById('trainDialog');
  const title=document.getElementById('trainTitle');
  const tbody=document.getElementById('schedule');
  if(!dlg||!title||!tbody)return;

  title.textContent=t.id+(t.trainName?' · '+t.trainName:'')+' (Terv & Tény adatok)';
  
  tbody.innerHTML=(t.plan||[]).map((row,idx)=>{
   const stName=row.stationName||('Állomás #'+row.station);
   const isHere=t.at===row.station;
   const actualTime=row.actualArr??(isHere?s.time:null);
   return '<tr'+(isHere?' style="background:#244357;font-weight:bold"':'')+'><td>'+stName+'</td><td>'+clock(row.arr)+'</td><td>'+clock(row.dep)+'</td><td>'+clock(actualTime)+'</td></tr>';
  }).join('');

  if(typeof dlg.showModal==='function'&&!dlg.open)dlg.showModal();
 }

 // Kattintáskezelés KÖFI és táblázat nézetben
 document.addEventListener('click',function(ev){
  const trEl=ev.target.closest?ev.target.closest('[data-nettrain],[data-train],tr'):null;
  if(trEl){
   const tid=trEl.getAttribute('data-nettrain')||trEl.getAttribute('data-train')||(trEl.cells&&trEl.cells[0]?trEl.cells[0].textContent.trim():null);
   const s=typeof sim!=='undefined'?sim:null;
   if(s&&tid){
    const found=s.trains.find(x=>tid.includes(x.id));
    if(found){
     ev.preventDefault();
     ev.stopPropagation();
     openTrainScheduleModal(found.id);
    }
   }
  }
 },true);

 const baseTick=Simulation.prototype.tick;
 Simulation.prototype.tick=function(dt){
  injectRealTrains(this);
  // Tény adatok folyamatos frissítése a szimulációs idő szerint
  for(const t of this.trains){
   if(t.realTrain&&t.plan){
    for(const p of t.plan){
     if(t.at===p.station&&p.actualArr===undefined)p.actualArr=this.time;
    }
   }
  }
  return baseTick.call(this,dt);
 };

 function installUI(){
  const s=typeof sim!=='undefined'?sim:null;
  if(s)injectRealStreams(s);
 }

 root.RailRandomTraffic={installUI,openTrainScheduleModal};
 if(typeof document!=='undefined'){
  document.addEventListener('DOMContentLoaded',installUI);
  setInterval(installUI,1000);
 }
})(window);
