"use strict";
const STATIONS=[{"id": 0, "name": "Budapest-Déli", "km": -4, "control": true, "tracks": ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII"]}, {"id": 1, "name": "Budapest-Kelenföld", "km": 0, "control": true, "tracks": ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV"]}, {"id": 2, "name": "Budafok", "km": 5, "control": false, "tracks": ["I", "II", "III", "IV"]}, {"id": 3, "name": "Háros", "km": 6.4, "control": true, "tracks": ["I", "II", "III", "IV"]}, {"id": 4, "name": "Budatétény", "km": 8.2, "control": false, "tracks": ["I", "II"]}, {"id": 5, "name": "Barosstelep", "km": 10.4, "control": false, "tracks": ["I", "II"]}, {"id": 6, "name": "Nagytétény-Diósd", "km": 11.5, "control": true, "tracks": ["I", "II", "III", "IV"]}, {"id": 7, "name": "Érdliget", "km": 14.6, "control": false, "tracks": []}, {"id": 8, "name": "Érd felső", "km": 16.2, "control": true, "tracks": ["I", "II"]}, {"id": 9, "name": "Érd", "km": 18.6, "control": true, "tracks": ["I", "II", "III", "IV"]}, {"id": 10, "name": "Százhalombatta", "km": 24.3, "control": true, "tracks": ["I", "II", "III"]}, {"id": 11, "name": "Dunai Finomító", "km": 28, "control": false, "tracks": ["I", "II", "III", "IV"]}, {"id": 12, "name": "Ercsi", "km": 33.3, "control": true, "tracks": ["I", "II", "III", "IV"]}, {"id": 13, "name": "Iváncsa", "km": 42.4, "control": false, "tracks": ["I", "II"]}, {"id": 14, "name": "Pusztaszabolcs", "km": 48.2, "control": true, "tracks": ["I", "II", "III", "IV", "V", "VI", "VII"]}, {"id": 15, "name": "Szabadegyháza", "km": 56.2, "control": true, "tracks": ["I", "II", "III", "IV"]}, {"id": 16, "name": "Sárosd", "km": 62.1, "control": true, "tracks": ["I", "II", "III", "IV", "V"]}, {"id": 17, "name": "Nagylók", "km": 69.2, "control": true, "tracks": ["I", "II", "III"]}, {"id": 18, "name": "Sárbogárd", "km": 78.5, "control": true, "tracks": ["II", "III", "IV", "V", "VI", "VII", "VIII"]}, {"id": 19, "name": "Rétszilas", "km": 87.9, "control": true, "tracks": ["I", "II", "III"]}, {"id": 20, "name": "Sáregres", "km": 91.5, "control": false, "tracks": ["I"]}, {"id": 21, "name": "Simontornya", "km": 96.7, "control": true, "tracks": ["I", "II", "III", "IV", "V"]}, {"id": 22, "name": "Tolnanémedi", "km": 102.6, "control": true, "tracks": ["I", "II", "III", "IV"]}, {"id": 23, "name": "Pincehely", "km": 109, "control": true, "tracks": ["I", "II", "III", "IV", "V"]}, {"id": 24, "name": "Belecska", "km": 114.1, "control": false, "tracks": ["I"]}, {"id": 25, "name": "Keszőhidegkút-Gyönk", "km": 119, "control": true, "tracks": ["I", "II", "III", "IV", "V"]}, {"id": 26, "name": "Szárazd", "km": 122.2, "control": false, "tracks": ["I"]}, {"id": 27, "name": "Regöly", "km": 124.2, "control": false, "tracks": ["I"]}, {"id": 28, "name": "Szakály-Hőgyész", "km": 129.5, "control": true, "tracks": ["I", "II", "III", "IV"]}, {"id": 29, "name": "Dúzs", "km": 133.5, "control": false, "tracks": ["I"]}, {"id": 30, "name": "Csibrák", "km": 138.3, "control": false, "tracks": ["I"]}, {"id": 31, "name": "Kurd", "km": 140.7, "control": true, "tracks": ["I", "II", "III", "IV"]}, {"id": 32, "name": "Döbrököz", "km": 148.7, "control": true, "tracks": ["I", "II", "III"]}, {"id": 33, "name": "Dombóvár", "km": 159, "control": true, "tracks": ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"]}, {"id": 34, "name": "Kaposszekcső", "km": 163.5, "control": false, "tracks": []}, {"id": 35, "name": "Vásárosdombó", "km": 165.9, "control": true, "tracks": ["I", "II", "III"]}, {"id": 36, "name": "Sásd", "km": 172.5, "control": true, "tracks": ["I", "II", "III"]}, {"id": 37, "name": "Godisa", "km": 176.3, "control": true, "tracks": ["II", "III", "IV", "V", "VI"]}, {"id": 38, "name": "Szatina-Kishajmás", "km": 179.4, "control": false, "tracks": []}, {"id": 39, "name": "Abaliget", "km": 185.9, "control": true, "tracks": ["I", "II", "III"]}, {"id": 40, "name": "Hetvehely", "km": 189.7, "control": false, "tracks": []}, {"id": 41, "name": "Bükkösd", "km": 194.2, "control": true, "tracks": ["I", "II", "III"]}, {"id": 42, "name": "Cserdi-Helesfa", "km": 197.4, "control": false, "tracks": []}, {"id": 43, "name": "Szentlőrinc", "km": 204, "control": true, "tracks": ["I", "II", "III"]}, {"id": 44, "name": "Bicsérd", "km": 209, "control": true, "tracks": ["I", "II", "III"]}, {"id": 45, "name": "Mecsekalja-Cserkút", "km": 216.7, "control": true, "tracks": ["I", "II", "III"]}, {"id": 46, "name": "Pécs", "km": 222.6, "control": true, "tracks": ["I", "II", "III"]}];

const SB=18;

class AutomaticBlocks{
 constructor(){
  this.sections={};let prev=null;
  for(const s of STATIONS){if(!s.control)continue;if(prev!==null){
    const a=STATIONS[prev],id=`${prev}-${s.id}`,length=Math.abs(s.km-a.km),n=Math.max(1,Math.ceil(length/2)),double=s.id<=14;
    const section={id,from:prev,to:s.id,length,double,lanes:[]};
    for(let lane=0;lane<(double?2:1);lane++)section.lanes.push({id:`${id}/${lane}`,direction:lane===0?1:-1,blocks:Array.from({length:n},(_,i)=>({index:i,from:i*2,to:Math.min(length,(i+1)*2),owner:null}))});
    this.sections[id]=section;
  }prev=s.id;}
 }
 section(a,b){return this.sections[`${Math.min(a,b)}-${Math.max(a,b)}`];}
 range(section,block,dir){return dir===1?{from:block.from,to:block.to}:{from:section.length-block.to,to:section.length-block.from};}
 lane(p){return this.sections[p.section]?.lanes[p.lane];}
 first(p,dir){const l=this.lane(p);return dir===1?l.blocks[0]:l.blocks[l.blocks.length-1];}
 setDirection(id,lane,dir,sim){
  const s=this.sections[id],l=s?.lanes[lane];if(!l||![1,-1].includes(dir))return {ok:false,msg:'Ismeretlen állomásköz, vágány vagy menetirány.'};
  if(l.direction===dir)return {ok:true};
  const claimed=Object.values(sim.permissions).some(p=>p.section===id&&p.lane===lane);
  if(claimed||l.blocks.some(b=>b.owner))return {ok:false,msg:'Menetirányváltás tiltva: az állomásközben vonat vagy kiadott engedély van. Előbb érjen be, vagy vond vissza az engedélyt.'};
  l.direction=dir;sim.log(`${STATIONS[s.from].name}–${STATIONS[s.to].name}, ${lane+1}. vonali vágány: ${dir===1?'Pécs':'Budapest'} felé.`);return {ok:true};
 }
 refresh(sim){
  for(const s of Object.values(this.sections))for(const l of s.lanes)for(const b of l.blocks)b.owner=null;
  for(const t of sim.trains){const p=sim.permissions[t.id];if(!p||!p.section)continue;const s=this.sections[p.section],l=this.lane(p);if(!l)continue;
   if(!['leaving','line','approach','hold','entering'].includes(t.phase))continue;
   const head=t.phase==='leaving'?0:t.phase==='line'?(t.distance||0):s.length;
   const rear=Math.max(0,head-.2);
   for(const b of l.blocks){const r=this.range(s,b,t.dir);
    if((t.phase==='leaving'&&r.from===0)||(r.to>rear+1e-7&&r.from<=head+1e-7)){
      if(b.owner&&b.owner!==t.id)throw Error(`Térközfoglaltsági ütközés: ${l.id}/${b.index}, ${b.owner} és ${t.id}`);
      b.owner=t.id;
    }
   }
  }
 }
 canEnter(p,dir,id){const l=this.lane(p);return !!l&&l.direction===dir&&(!this.first(p,dir).owner||this.first(p,dir).owner===id);}
 aspect(id,lane,index,dir,sim){
  const s=this.sections[id],l=s.lanes[lane];if(l.direction!==dir)return 'off';
  const b=l.blocks[index];if(b.owner)return 'red';
  const ni=index+dir;
  if(ni>=0&&ni<l.blocks.length)return l.blocks[ni].owner?'yellow':'green';
  const target=dir===1?s.to:s.from,r=sim.getRoute(target,dir===1?'A':'B');
  return r?.clear?'green':'yellow';
 }
 move(t,p,dt){
  const s=this.sections[p.section],l=this.lane(p);let d=t.distance||0,next=Math.min(s.length,d+(t.maxSpeed||65)/60*dt),waiting=false;if(t.menetrendi)next=Math.max(d,Math.min(next,timetableDistance(t,p,t.clock,s.length)));
  const ordered=l.blocks.map(b=>({b,r:this.range(s,b,t.dir)})).sort((a,b)=>a.r.from-b.r.from);
  for(const {b,r} of ordered){if(r.to<=d+1e-7)continue;if(r.from>next+.0200001)break;
   if(b.owner&&b.owner!==t.id){next=Math.max(d,Math.min(next,r.from-.02));waiting=true;break;}
  }
  t.distance=next;t.progress=next/s.length;t.blockWaiting=waiting;
  return next>=s.length-1e-7;
 }
}

class LegacySimulation {
 constructor(){this.version=3;this.blockSystem=new AutomaticBlocks();this.time=360;this.paused=true;this.speed=30;this.view='station';this.selected=SB;this.auto=true;this.trains=[];this.permissions={};this.edges={};this.routes={};this.switches={};this.closed={};this.logs=[];this.serial=0;this.score=0;this.add(17,1,360);this.add(19,-1,363);this.add(0,1,363);this.add(46,-1,364);this.add(33,-1,368);this.log('Szolgálat kezdete. Kezelhető D55-jellegű pult, kitalált tesztmenetrend.');}
 log(msg){this.logs.unshift({time:this.time,msg});this.logs=this.logs.slice(0,120);}
 next(t){let n=t.at+t.dir;while(n>=0&&n<STATIONS.length&&!STATIONS[n].control)n+=t.dir;return n<0||n>=STATIONS.length?null:n;}
 edge(a,b,d){return Math.max(a,b)<=14?`${Math.min(a,b)}:${Math.max(a,b)}:${d}`:`${Math.min(a,b)}:${Math.max(a,b)}`;}
 busy(s,tr,except){return this.trains.some(t=>t.id!==except&&t.at===s&&t.track===tr&&['parked','leaving'].includes(t.phase))||Object.values(this.permissions).some(p=>p.id!==except&&p.to===s&&p.track===tr);}
 free(s){return STATIONS[s].tracks.find(tr=>!this.busy(s,tr)&&!this.closed[`${s}:${tr}`]);}
 add(at,dir,dep){let track=this.free(at);if(!track)return null;let t={id:'J'+String(++this.serial).padStart(3,'0'),at,dir,track,dep,phase:'parked',delay:0,history:[],plan:[],finished:false};let tm=dep,prev=at;t.plan.push({station:at,arr:null,dep:tm});for(let n=at+dir;n>=0&&n<STATIONS.length;n+=dir){tm+=Math.abs(STATIONS[n].km-STATIONS[prev].km)/65*60;let arr=tm;tm+=STATIONS[n].control?2:0.5;t.plan.push({station:n,arr,dep:tm});prev=n;}this.trains.push(t);return t;}
 request(t){return !t.finished&&t.phase==='parked'&&this.next(t)!==null&&this.time>=t.dep-3&&!this.permissions[t.id];}
 grant(id,track){
 this.ensureBlocks();const t=this.trains.find(t=>t.id===id);
 if(!t||!this.request(t))return {ok:false,msg:'Nincs aktív engedélykérés.'};
 const to=this.next(t),section=this.blockSystem.section(t.at,to);track=track||this.free(to);
 if(!track||!STATIONS[to].tracks.includes(track)||this.busy(to,track)||this.closed[`${to}:${track}`])return {ok:false,msg:'A fogadóvágány foglalt, lezárt vagy nem létezik.'};
 if(!section)return {ok:false,msg:'Ehhez a két állomáshoz nincs összekötött állomásköz.'};
 let lane=section.lanes.findIndex(l=>l.direction===t.dir);
 if(lane<0&&this.view==='station'&&this.auto){for(let k=0;k<section.lanes.length;k++){if(this.blockSystem.setDirection(section.id,k,t.dir,this).ok){lane=k;break;}}}
 if(lane<0)return {ok:false,msg:'Nincs megfelelő menetirány. A hálózaton az állomásköz menetiránygombjával állítsd a vonat irányára.'};
 const key=`${section.id}/${lane}/${id}`;
 this.edges[key]=id;this.permissions[id]={id,from:t.at,to,track,key,section:section.id,lane};
 this.log(`${id}: engedély ${STATIONS[t.at].name} → ${STATIONS[to].name}, ${track}. vágány, ${lane+1}. vonali vágány.`);return {ok:true};
 }
 ensureBlocks(){
 if(this.blockSystem instanceof AutomaticBlocks)return;
 const saved=this.blockSystem,bs=new AutomaticBlocks();
 if(saved?.sections)for(const [id,s] of Object.entries(bs.sections)){const old=saved.sections[id];if(old)for(let k=0;k<s.lanes.length;k++)if(old.lanes?.[k])s.lanes[k].direction=old.lanes[k].direction;}
 this.blockSystem=bs;bs.refresh(this);
 }
 setLineDirection(id,lane,dir){this.ensureBlocks();return this.blockSystem.setDirection(id,lane,dir,this);}

 routeId(s,signal){return `${s}:${signal}`;}
 getRoute(s,signal){return this.routes[this.routeId(s,signal)];}
 throatLocked(s,side){return Object.values(this.routes).some(r=>r.at===s&&r.side===side);}
 describeRoute(s,start,goal){let track,dir,kind,t;
 if(start==='A'&&goal.startsWith('KR-')){track=goal.slice(3);dir=1;kind='in';}
 else if(start==='B'&&goal.startsWith('KL-')){track=goal.slice(3);dir=-1;kind='in';}
 else if(start.startsWith('KR-')&&goal==='VR'){track=start.slice(3);dir=1;kind='out';}
 else if(start.startsWith('KL-')&&goal==='VL'){track=start.slice(3);dir=-1;kind='out';}
 else return null;
 if(!STATIONS[s].tracks.includes(track))return null;
 if(kind==='in')t=this.trains.find(t=>t.dir===dir&&this.permissions[t.id]?.to===s&&this.permissions[t.id]?.track===track);
 else t=this.trains.find(t=>t.at===s&&t.phase==='parked'&&t.track===track&&t.dir===dir&&!t.finished);
 return {at:s,start,goal,track,dir,kind,side:kind==='in'?(dir===1?'L':'R'):(dir===1?'R':'L'),train:t?.id};}
 setRoute(s,start,goal){let r=this.describeRoute(s,start,goal);if(!r)return {ok:false,msg:'Érvénytelen kezdő–cél pár. Bejárat: A→KR vagy B→KL. Kijárat: KR→VR vagy KL→VL.'};if(!r.train)return {ok:false,msg:'Nincs erre engedélyezett bejáró vagy megfelelő induló vonat.'};if(this.getRoute(s,start))return {ok:false,msg:'Ehhez a jelzőhöz már tartozik lezárt vágányút.'};if(this.throatLocked(s,r.side))return {ok:false,msg:'Az állomásvég másik vágányút miatt lezárt.'};if(this.closed[`${s}:${r.track}`])return {ok:false,msg:'A vágány lezárva.'};if(r.kind==='out'&&!this.permissions[r.train])return {ok:false,msg:'Kijárathoz előbb engedély kell a következő állomástól.'};r.clear=false;r.everCleared=false;r.releaseAt=null;this.routes[this.routeId(s,start)]=r;this.switches[`${s}:${r.side}`]=r.track;this.log(`${STATIONS[s].name}: ${start} → ${goal}, első lezárás. Jelző még Megállj.`);return {ok:true};}
 clearSignal(s,signal){let r=this.getRoute(s,signal);if(!r)return {ok:false,msg:'Nincs lezárt vágányút. Előbb kezdő- és célgombbal jelöld ki.'};let t=this.trains.find(t=>t.id===r.train),p=this.permissions[r.train];if(!t||!p)return {ok:false,msg:'Hiányzik a vonat vagy az engedély.'};if(r.kind==='in'&&this.busy(s,r.track,t.id))return {ok:false,msg:'A fogadóvágány foglalt.'};if((r.kind==='in'&&t.phase==='entering')||(r.kind==='out'&&t.phase==='leaving'))return {ok:false,msg:'A vonat már meghaladta a jelzőt.'};if(r.kind==='out'){this.ensureBlocks();this.blockSystem.refresh(this);if(!this.blockSystem.canEnter(p,t.dir,t.id))return {ok:false,msg:'A kijárati jelző nem állítható szabadra: az első térköz foglalt vagy a menetirány nem megfelelő.'};}r.clear=true;r.everCleared=true;r.releaseAt=null;this.log(`${STATIONS[s].name}, ${signal}: Szabad (második lezárás).`);return {ok:true};}
 stopSignal(s,signal){let r=this.getRoute(s,signal);if(!r)return {ok:false,msg:'A jelző alapállásban Megállj.'};r.clear=false;this.log(`${STATIONS[s].name}, ${signal}: Megállj. A vágányút lezárva marad.`);return {ok:true};}
 cancelRoute(s,signal){let r=this.getRoute(s,signal);if(!r)return {ok:false,msg:'Nincs törölhető vágányút.'};let t=this.trains.find(t=>t.id===r.train);if((r.kind==='in'&&t?.phase==='entering')||(r.kind==='out'&&t?.phase==='leaving'))return {ok:false,msg:'A vonat a vágányúton halad; oldás tiltva.'};if(r.clear)return {ok:false,msg:'Előbb állítsd Megállj állásba a jelzőt.'};if(r.everCleared){r.releaseAt=this.time+3;this.log(`${signal}: játékbeli időzített oldás indult, 3 szimulált perc.`);}else{delete this.routes[this.routeId(s,signal)];this.log(`${signal}: első lezárás törölve.`);}return {ok:true};}
 toggleSwitch(s,side){if(this.throatLocked(s,side))return {ok:false,msg:'A váltócsoport lezárt vágányútban szerepel.'};let tracks=STATIONS[s].tracks,current=this.switches[`${s}:${side}`]||tracks[0];this.switches[`${s}:${side}`]=tracks[(tracks.indexOf(current)+1)%tracks.length];this.log(`${STATIONS[s].name}, ${side} modell-váltócsoport → ${this.switches[`${s}:${side}`]}. vágány.`);return {ok:true};}
 toggleTrack(s,tr){if(this.busy(s,tr)||Object.values(this.routes).some(r=>r.at===s&&r.track===tr))return {ok:false,msg:'Foglalt vagy lezárt vágányútban lévő vágány nem zárható ki.'};let k=`${s}:${tr}`;this.closed[k]=!this.closed[k];return {ok:true};}
 revoke(id){let p=this.permissions[id],t=this.trains.find(t=>t.id===id);if(!p||t.phase!=='parked')return {ok:false,msg:'Csak indulás előtt vonható vissza.'};if(Object.values(this.routes).some(r=>r.train===id))return {ok:false,msg:'Előbb oldd fel a hozzá tartozó vágányutakat.'};delete this.edges[p.key];delete this.permissions[id];this.log(`${id}: engedély visszavonva.`);return {ok:true};}
 autoRoute(s,start,goal){if(!this.getRoute(s,start))this.setRoute(s,start,goal);let r=this.getRoute(s,start);if(r&&!r.clear&&!r.releaseAt)this.clearSignal(s,start);}
 tick(dt){
 this.ensureBlocks();let remain=dt;
 while(remain>1e-9){const d=Math.min(.025,remain);remain-=d;this.time+=d;
 for(const [key,r] of Object.entries(this.routes))if(r.releaseAt&&this.time>=r.releaseAt){delete this.routes[key];this.log(`${r.start}: időzített oldás befejezve.`);}
 this.blockSystem.refresh(this);
 for(const t of this.trains){if(t.finished)continue;t.clock=this.time;const n=this.next(t);
 if(this.auto&&this.view==='station'&&t.phase==='parked'){
  if(n!==null&&n!==SB&&this.request(t))this.grant(t.id);
  const p=this.permissions[t.id];if(p){if(p.to!==SB)this.autoRoute(p.to,t.dir===1?'A':'B',(t.dir===1?'KR-':'KL-')+p.track);if(t.at!==SB)this.autoRoute(t.at,(t.dir===1?'KR-':'KL-')+t.track,t.dir===1?'VR':'VL');}
 }
 const p=this.permissions[t.id];if(!p)continue;
 const out=this.getRoute(t.at,(t.dir===1?'KR-':'KL-')+t.track),inc=this.getRoute(p.to,t.dir===1?'A':'B');
 if(t.phase==='parked'&&out?.train===t.id&&out.clear&&this.time>=t.dep){
  if(this.blockSystem.canEnter(p,t.dir,t.id)){t.phase='leaving';t.motionStart=this.time;t.motionDuration=t.menetrendi?.08:1.2;t.progress=0;t.distance=0;t.blockWaiting=false;out.clear=false;this.log(`${t.id}: kijár ${STATIONS[t.at].name} állomásról.`);}
  else t.blockWaiting=true;
 }
 else if(t.phase==='leaving'){t.progress=Math.min(1,(this.time-t.motionStart)/t.motionDuration);if(t.progress>=1){delete this.routes[this.routeId(t.at,(t.dir===1?'KR-':'KL-')+t.track)];t.phase='line';t.lineStart=this.time;t.segmentOffset=Math.max(0,this.time-(t.plan.find(x=>x.station===t.at)?.dep??this.time));t.distance=0;t.progress=0;this.log(`${t.id}: állomásközben, önműködő térközökön közlekedik.`);}}
 else if(t.phase==='line'){
  if(this.blockSystem.move(t,p,d)){t.phase='approach';t.motionStart=this.time;t.motionDuration=t.menetrendi?.04:.5;t.progress=0;t.blockWaiting=false;this.log(`${t.id}: megközelítette ${STATIONS[p.to].name} bejáratát.`);}
 }
 else if(t.phase==='approach'){t.progress=Math.min(1,(this.time-t.motionStart)/t.motionDuration);if(t.progress>=1){t.phase='hold';t.progress=0;}}
 else if(t.phase==='hold'&&inc?.train===t.id&&inc.clear){t.phase='entering';t.motionStart=this.time;t.motionDuration=t.menetrendi?.08:1.2;t.progress=0;inc.clear=false;this.log(`${t.id}: behalad ${STATIONS[p.to].name} állomásra.`);}
 else if(t.phase==='entering'){t.progress=Math.min(1,(this.time-t.motionStart)/t.motionDuration);if(t.progress>=1){const plan=t.plan.find(x=>x.station===p.to);t.history.push({station:p.to,arr:this.time});t.delay=Math.max(0,this.time-(plan?.arr||this.time));t.at=p.to;t.track=p.track;t.phase='parked';t.progress=0;t.distance=0;t.blockWaiting=false;t.dep=t.menetrendi?Math.max(this.time+.025,plan?.dep??this.time):Math.max(this.time+2,plan?.dep||this.time+2);delete this.routes[this.routeId(p.to,t.dir===1?'A':'B')];delete this.edges[p.key];delete this.permissions[t.id];this.score+=Math.max(1,10-Math.floor(t.delay));if(this.next(t)===null){t.finished=true;t.finishedAt=this.time;this.score+=100;}this.log(`${t.id}: megállt ${STATIONS[t.at].name}, ${t.track}. vágány; a térközök feloldva.`);}}
 this.blockSystem.refresh(this);
 }
 }
 }

}

function makeTimetablePlan(service,offset){
 const stops=service.stops.map(p=>({...p,arr:p.arr+offset,dep:p.dep+offset,source:true,stop:true})),plan=[];
 for(let sid=stops[0].station;service.dir===1?sid<=stops.at(-1).station:sid>=stops.at(-1).station;sid+=service.dir){
  const exact=stops.find(x=>x.station===sid);if(exact){plan.push(exact);continue;}
  const before=stops.filter(x=>(sid-x.station)*service.dir>0).at(-1),after=stops.find(x=>(x.station-sid)*service.dir>0);
  const f=(STATIONS[sid].km-STATIONS[before.station].km)/(STATIONS[after.station].km-STATIONS[before.station].km),tm=before.dep+f*(after.arr-before.dep);
  plan.push({station:sid,arr:tm,dep:tm,source:false,stop:false,refs:[]});
 }return plan;
}
function timetableDistance(t,p,time,length){
 const from=t.plan.findIndex(x=>x.station===p.from),to=t.plan.findIndex(x=>x.station===p.to),points=t.plan.slice(from,to+1),offset=t.segmentOffset||0;
 let previous={time:points[0].dep+offset,distance:0};
 for(const point of points.slice(1)){
  const distance=Math.abs(STATIONS[point.station].km-STATIONS[p.from].km),arrival=point.arr+offset,departure=point.dep+offset;
  if(time<arrival){const span=arrival-previous.time;return span<=0?distance:previous.distance+(distance-previous.distance)*Math.max(0,(time-previous.time)/span);}
  if(time<departure)return distance;previous={time:departure,distance};
 }return length;
}
class Simulation extends LegacySimulation{
 constructor(){super();this.version=5;this.trains=[];this.logs=[];this.serial=0;this.ttSpawned={};this.archive=[];this.serviceStart=this.time;this.nextTrafficUpdate=this.time;this.freightEnabled=true;this.nextFreight=this.time+7;this.realTraffic();this.log('PDF-alapú 40a/40 menetrend. Godisa csatlakozási játékréteg.');}
 next(t){if(t.branchManaged||t.menetrendi&&t.at===t.endStation)return null;return super.next(t);}
 request(t){return t.branchManaged?false:super.request(t);}
 add(at,dir,dep){const t=super.add(at,dir,dep);if(t){t.id='T'+String(this.serial).padStart(3,'0');t.kind='freight';t.maxSpeed=80;}return t;}
 tick(dt){if(this.time>=this.nextTrafficUpdate){this.realTraffic();this.nextTrafficUpdate=this.time+.25;}super.tick(dt);}
 realTraffic(){
  this.ttSpawned=this.ttSpawned||{};this.archive=this.archive||[];
  for(let day=Math.floor(this.time/1440)-1;day<=Math.floor((this.time+3)/1440);day++)for(const service of globalThis.REAL_TIMETABLE||[]){
   const key=day+':'+service.id;if(this.ttSpawned[key])continue;
   const offset=day*1440,first=service.stops[0].dep+offset,last=service.stops.at(-1).arr+offset;
   if(last<this.serviceStart){this.ttSpawned[key]='past';continue;}if(first>this.time+3)continue;
   const plan=makeTimetablePlan(service,offset);let at=plan[0].station;
   if(first<this.serviceStart){const past=plan.filter(x=>STATIONS[x.station].control&&x.dep<=this.serviceStart);if(past.length)at=past.at(-1).station;}
   const track=this.free(at);if(!track)continue;const id=service.number+(day===0?'':'/D'+day),point=plan.find(x=>x.station===at);
   if(this.trains.some(t=>t.id===id)){this.ttSpawned[key]=true;continue;}
   this.trains.push({id,number:service.number,at,dir:service.dir,track,dep:Math.max(this.time,point.dep),phase:'parked',delay:Math.max(0,this.time-point.dep),history:[],plan,finished:false,menetrendi:true,kind:'passenger',maxSpeed:160,endStation:plan.at(-1).station,sourceLines:service.lines,approximateStart:first<this.serviceStart});this.ttSpawned[key]=true;
  }
  const gone=this.trains.filter(t=>t.finished&&this.time-(t.finishedAt??this.time)>=5);
  for(const t of gone)this.archive.push({id:t.id,at:t.at,time:this.time,delay:t.delay,plan:t.plan,history:t.history});
  if(gone.length){const ids=new Set(gone.map(t=>t.id));this.trains=this.trains.filter(t=>!ids.has(t.id));this.archive=this.archive.slice(-500);}
  if(this.freightEnabled&&this.time>=this.nextFreight){const ends=[0,14,18,33,46],at=ends[Math.floor(Math.random()*ends.length)],dir=at===0?1:at===46?-1:Math.random()<.5?1:-1;const t=this.add(at,dir,this.time+2);if(t)t.maxSpeed=60+Math.floor(Math.random()*5)*10;this.nextFreight=this.time+15+Math.floor(Math.random()*16);}
 }
}
if(typeof module!=='undefined')module.exports={Simulation,STATIONS,SB,AutomaticBlocks};
