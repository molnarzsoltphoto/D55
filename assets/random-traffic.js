"use strict";
(function(root){
 if(root.RailRandomTraffic)return;
 
 function clock(v){
  if(v===null||v===undefined||!Number.isFinite(v))return '—';
  const m=Math.floor(v);
  return String(Math.floor(m/60)%24).padStart(2,'0')+':'+String(Math.floor(m%60)).padStart(2,'0');
 }

 // Valós MÁV menetrendi adatok és kiágazások
 const TIMETABLE_ITEMS=[
  {id:'IC 800',name:'Mecsek IC (Bp-Déli – Pécs)',category:'IC',maxSpeedKmh:120,origin:'Budapest-Déli',dest:'Pécs',dep:353,arr:517},
  {id:'IC 802',name:'Mecsek IC (Bp-Déli – Pécs)',category:'IC',maxSpeedKmh:120,origin:'Budapest-Déli',dest:'Pécs',dep:473,arr:637},
  {id:'IC 801',name:'Mecsek IC (Pécs – Bp-Déli)',category:'IC',maxSpeedKmh:120,origin:'Pécs',dest:'Budapest-Déli',dep:314,arr:479},
  {id:'IC 807',name:'Mecsek IC (Pécs – Bp-Déli)',category:'IC',maxSpeedKmh:120,origin:'Pécs',dest:'Budapest-Déli',dep:434,arr:599},
  {id:'S40 4110',name:'S40 személy (Bp-Déli – Dombóvár)',category:'S40',maxSpeedKmh:100,origin:'Budapest-Déli',dest:'Dombóvár',dep:315,arr:499},
  {id:'G40 4319',name:'G40 gyorsított (Dombóvár – Bp-Déli)',category:'G40',maxSpeedKmh:100,origin:'Dombóvár',dest:'Budapest-Déli',dep:324,arr:499},
  // Kért kiágazások (az első állomásig)
  {id:'KIÁG 1',name:'1-es vonal (Kelenföld – Budaörs)',category:'Személy',maxSpeedKmh:100,origin:'Kelenföld',dest:'Budaörs',dep:360,arr:366},
  {id:'KIÁG 30A',name:'30a vonal (Kelenföld – Törökbálint)',category:'Személy',maxSpeedKmh:100,origin:'Kelenföld',dest:'Törökbálint',dep:370,arr:380},
  {id:'KIÁG DUNA',name:'Pusztaszabolcs – Dunaújváros irány',category:'Személy',maxSpeedKmh:80,origin:'Pusztaszabolcs',dest:'Iváncsa',dep:385,arr:393},
  {id:'KIÁG 44',name:'44-es vonal (Pusztaszabolcs – Szabadegyháza)',category:'Személy',maxSpeedKmh:80,origin:'Pusztaszabolcs',dest:'Szabadegyháza',dep:400,arr:408},
  {id:'KIÁG SÁR',name:'Sárbogárd – Székesfehérvár irány',category:'Személy',maxSpeedKmh:80,origin:'Sárbogárd',dest:'Rétszilas',dep:420,arr:427},
  {id:'KIÁG RÉTSZILAS',name:'Rétszilas – Baja irány (Cece)',category:'Személy',maxSpeedKmh:80,origin:'Rétszilas',dest:'Cece',dep:430,arr:437},
  {id:'KIÁG 41',name:'41-es vonal (Dombóvár – Kaposvár)',category:'Személy',maxSpeedKmh:80,origin:'Dombóvár',dest:'Sásd',dep:450,arr:466},
  {id:'KIÁG 50',name:'50-es vonal (Dombóvár – Baja)',category:'Személy',maxSpeedKmh:80,origin:'Dombóvár',dest:'Sásd',dep:465,arr:481},
  {id:'KIÁG 47',name:'47-es vonal (Dombóvár – Komló)',category:'Személy',maxSpeedKmh:80,origin:'Dombóvár',dest:'Sásd',dep:480,arr:496},
  {id:'KIÁG SZENTLŐRINC',name:'Szentlőrinc – Barcs irány',category:'Személy',maxSpeedKmh:80,origin:'Szentlőrinc',dest:'Pécs',dep:510,arr:532},
  {id:'KIÁG 60',name:'60-as vonal (Pécs – Barcs)',category:'Személy',maxSpeedKmh:80,origin:'Pécs',dest:'Szentlőrinc',dep:540,arr:562}
 ];

 function initTimetable(sim){
  if(!sim||sim._timetableInitialized)return;
  sim._timetableInitialized=true;
  if(!sim.trains)sim.trains=[];

  for(const item of TIMETABLE_ITEMS){
   if(sim.trains.some(t=>t.id===item.id))continue;
   
   let stIndex=0;
   if(typeof STATIONS!=='undefined'&&Array.isArray(STATIONS)){
    const found=STATIONS.findIndex(st=>st&&st.name&&st.name.toLowerCase().includes(item.origin.toLowerCase().split(' ')[0]));
    if(found>=0)stIndex=found;
   }
   
   let t=null;
   try{
    if(typeof sim.add==='function'){
     t=sim.add(stIndex, 1, item.dep);
    }
   }catch(e){}

   if(!t){
    t={id:item.id,type:'passenger',phase:'parked',at:stIndex,dep:item.dep,distance:0,tracks:[]};
    sim.trains.push(t);
   }

   t.id=item.id;
   t.realTrain=true;
   t.trainName=item.name;
   t.category=item.category||'Személy';
   t.maxSpeedKmh=item.maxSpeedKmh||100;
   t.plan=[
    {stationName:item.origin, arr:null, dep:item.dep, actualArr:item.dep},
    {stationName:item.dest, arr:item.arr, dep:null, actualArr:undefined}
   ];
  }
 }

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
  
  const plan=t.plan||[
   {stationName:'Indulás', arr:null, dep:t.dep||360, actualArr:t.dep||360},
   {stationName:'Érkezés', arr:(t.dep||360)+60, dep:null, actualArr:undefined}
  ];

  tbody.innerHTML=plan.map((row,idx)=>{
   const stName=row.stationName||('Állomás #'+idx);
   const actualTime=row.actualArr??(t.at===idx?s.time:null);
   return '<tr><td>'+stName+'</td><td>'+clock(row.arr)+'</td><td>'+clock(row.dep)+'</td><td>'+clock(actualTime)+'</td></tr>';
  }).join('');

  if(typeof dlg.showModal==='function'&&!dlg.open)dlg.showModal();
 }

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
  initTimetable(this);
  for(const t of this.trains){
   if(t.realTrain&&t.plan){
    for(const p of t.plan){
     if(p.actualArr===undefined)p.actualArr=this.time;
    }
   }
  }
  return baseTick.call(this,dt);
 };

 function installUI(){
  const s=typeof sim!=='undefined'?sim:null;
  if(s)initTimetable(s);
 }

 root.RailRandomTraffic={installUI,openTrainScheduleModal};
 if(typeof document!=='undefined'){
  document.addEventListener('DOMContentLoaded',installUI);
  setInterval(installUI,1000);
 }
})(window);
