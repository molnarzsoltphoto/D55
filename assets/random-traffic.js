"use strict";
(function(root){
 if(root.RailRandomTraffic)return;
 if(typeof Simulation==='undefined'||typeof AutomaticBlocks==='undefined')throw Error('A random-traffic.js a térközös engine.js és az app.js után töltendő be.');
 const baseTick=Simulation.prototype.tick,baseMove=AutomaticBlocks.prototype.move,baseClear=Simulation.prototype.clearSignal,baseNext=Simulation.prototype.next;
 let activeSim=null,renderWrapped=false,showWrapped=false;
 const SPEEDS=[60,70,80,90,100];
 function current(){try{return typeof sim!=='undefined'?sim:null;}catch(e){return null;}}
 function ensure(s){
  if(!s.randomTraffic){const seed=((Date.now()>>>0)^((s.time*1000)|0))>>>0;s.randomTraffic={version:1,seed:seed||123456789,eventsEnabled:true,freightEnabled:true,intensity:'normal',nextEvent:s.time+4,nextFreight:s.time+3,serial:0,eventSerial:0,active:[],history:[],freightArchive:[],totalFreight:0};}
  const r=s.randomTraffic;if(!r.active)r.active=[];if(!r.history)r.history=[];if(!r.freightArchive)r.freightArchive=[];
  for(const t of s.trains){if(!t.type)t.type='passenger';if(!t.maxSpeedKmh)t.maxSpeedKmh=t.type==='freight'?80:65;}
  return r;
 }
 function rand(s){const r=ensure(s);let x=r.seed>>>0;x^=x<<13;x^=x>>>17;x^=x<<5;r.seed=x>>>0||123456789;return r.seed/4294967296;}
 function integer(s,a,b){return a+Math.floor(rand(s)*(b-a+1));}
 function pick(s,arr){return arr.length?arr[Math.floor(rand(s)*arr.length)]:null;}
 function spacing(s,kind){const r=ensure(s),factor=r.intensity==='quiet'?1.8:r.intensity==='busy'?.6:1;return integer(s,kind==='event'?12:15,kind==='event'?25:30)*factor;}
 function history(s,event){const r=ensure(s);r.history.unshift(event);r.history=r.history.slice(0,80);}
 function addEvent(s,ev){const r=ensure(s);ev.id='E'+String(++r.eventSerial).padStart(3,'0');ev.start=s.time;r.active.push(ev);history(s,{...ev,status:'active'});s.log('ESEMÉNY '+ev.id+': '+ev.title+' · '+ev.detail+' · vége '+clock(ev.until));return {ok:true,event:ev};}
 function clock(v){return String(Math.floor(v/60)%24).padStart(2,'0')+':'+String(Math.floor(v%60)).padStart(2,'0');}
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
   const pool=Object.values(s.routes).filter(r=>{const t=s.trains.find(t=>t.id===r.train);return t&&(!targetId||t.id===targetId)&&((r.kind==='out'&&t.phase==='parked')||(r.kind==='in'&&['line','approach','hold'].includes(t.phase)));});
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
  const max=t.type==='freight'?Math.min(100,Math.max(1,Number(t.maxSpeedKmh)||80)):65;
  const before=t.distance||0,done=baseMove.call(this,t,p,dt*max/65*factor);t.actualSpeedKmh=dt>0?Math.min(max,(t.distance-before)/dt*60):0;t.trafficStopped=false;return done;
 };
 function expire(s){const r=ensure(s),expired=r.active.filter(ev=>ev.until<=s.time);for(const ev of expired){s.log('ESEMÉNY VÉGE '+ev.id+': '+ev.title+'.'+(ev.kind==='signal'?' A jelző újra kezelhető, a szabad jelzést külön kell beállítani.':''));const h=r.history.find(x=>x.id===ev.id);if(h)h.status='resolved';}r.active=r.active.filter(ev=>ev.until>s.time);for(const t of s.trains){if(t.trafficHoldUntil<=s.time)t.trafficStopped=false;}}
 function retire(s){const r=ensure(s);for(const t of s.trains){if(t.type!=='freight'||!t.finished)continue;if(t.trafficFinishedAt===undefined)t.trafficFinishedAt=s.time;}
  const retired=s.trains.filter(t=>t.type==='freight'&&t.finished&&s.time-t.trafficFinishedAt>=8&&!s.permissions[t.id]);
  for(const t of retired){r.freightArchive.push({id:t.id,time:s.time,destination:t.at});s.log(t.id+': a célállomási tartózkodás után kiállt a játékból.');}r.freightArchive=r.freightArchive.slice(-100);s.trains=s.trains.filter(t=>!retired.includes(t));
 }
 Simulation.prototype.tick=function(dt){
  ensure(this);if(!Number.isFinite(dt)||dt<=0)return;let left=dt;
  while(left>1e-9){const d=Math.min(.05,left);left-=d;const r=ensure(this);expire(this);
   if(r.eventsEnabled&&this.time>=r.nextEvent){const ev=randomEvent(this);r.nextEvent=this.time+(ev.ok?spacing(this,'event'):2);}
   if(r.freightEnabled&&this.time>=r.nextFreight){const f=spawnFreight(this);r.nextFreight=this.time+(f.ok?spacing(this,'freight'):3);}
   for(const t of this.trains)if(t.trafficHoldUntil>this.time&&['line','parked'].includes(t.phase)){t.generatedDelayMin=(t.generatedDelayMin||0)+d;if(t.phase==='parked')t.dep=Math.max(t.dep,t.trafficHoldUntil);}
   const prev=activeSim;activeSim=this;try{baseTick.call(this,d);}finally{activeSim=prev;}
   expire(this);retire(this);
  }
 };
 function escape(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
 function notify(s,result){if(typeof toast==='function')toast(result.ok?'A művelet sikeres.':result.msg);if(typeof render==='function')render();updateUI();}
 function decorate(s){
  if(!s)return;for(const t of s.trains){if(t.type!=='freight')continue;
   for(const el of document.querySelectorAll('[data-nettrain="'+t.id+'"]')){const rect=el.querySelector('rect');if(rect)rect.setAttribute('fill',t.trafficStopped?'#f5a64a':'#c092ef');let title=el.querySelector('title');if(title)title.textContent=t.id+' · TEHER · max. '+t.maxSpeedKmh+' km/h · aktuális '+Math.round(t.actualSpeedKmh||0)+' km/h'+(t.trafficStopped?' · esemény miatt vár':'');}
   const table=document.getElementById('trains');if(table)for(const b of table.querySelectorAll('button'))if(b.textContent===t.id){b.textContent=t.id+' · TEHER ≤'+t.maxSpeedKmh;b.title='Véletlenszerűen generált tehervonat';}
   for(const p of document.querySelectorAll('.pill'))if(p.textContent===t.id){p.textContent=t.id+' · TEHER';p.style.color='#dcb8ff';}
  }
 }
 function mount(){
  if(document.getElementById('rt-panel'))return;const nav=document.querySelector('nav');if(!nav)return;
  const box=document.createElement('section');box.id='rt-panel';box.style.cssText='margin:0 20px 12px;padding:12px 14px;background:#172b38;border:1px solid #587188;border-radius:9px;font:13px system-ui;color:#dfeaf3';
  box.innerHTML='<div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap"><strong>Véletlen forgalom és zavarok</strong><label><input id="rt-events" type="checkbox"> Események</label><label><input id="rt-freight" type="checkbox"> Tehervonatok (≤100 km/h)</label><select id="rt-intensity"><option value="quiet">Ritka</option><option value="normal">Normál</option><option value="busy">Sűrű</option></select><button id="rt-event-now" type="button">Esemény most</button><button id="rt-freight-now" type="button">Tehervonat most</button></div><div id="rt-status" style="margin-top:8px;color:#b5cadd"></div><div id="rt-active" style="margin-top:7px;line-height:1.7"></div>';
  nav.insertAdjacentElement('afterend',box);
  document.getElementById('rt-events').onchange=e=>{const s=current();if(s)ensure(s).eventsEnabled=e.target.checked;};
  document.getElementById('rt-freight').onchange=e=>{const s=current();if(s)ensure(s).freightEnabled=e.target.checked;};
  document.getElementById('rt-intensity').onchange=e=>{const s=current();if(s)ensure(s).intensity=e.target.value;};
  document.getElementById('rt-event-now').onclick=()=>{const s=current();if(s)notify(s,randomEvent(s));};
  document.getElementById('rt-freight-now').onclick=()=>{const s=current();if(s)notify(s,spawnFreight(s));};
 }
 function updateUI(){const s=current();if(!s)return;mount();const r=ensure(s),el=document.getElementById('rt-panel');if(!el)return;
  document.getElementById('rt-events').checked=r.eventsEnabled;document.getElementById('rt-freight').checked=r.freightEnabled;document.getElementById('rt-intensity').value=r.intensity;
  const active=s.trains.filter(t=>t.type==='freight'&&!t.finished).length;
  document.getElementById('rt-status').textContent='Aktív tehervonat: '+active+' · összes generált: '+r.totalFreight+' · aktív zavar: '+r.active.length+' · az időzítések játékpercekben értendők. Kikapcsoláskor az új generálás áll le, a már létrejött vonatok és zavarok megmaradnak.';
  document.getElementById('rt-active').innerHTML=r.active.length?r.active.map(ev=>'<div style="color:#ffd190"><b>'+escape(ev.id+' · '+ev.title)+'</b> — '+escape(ev.detail)+' · hátra '+Math.max(0,Math.ceil(ev.until-s.time))+' perc</div>').join(''):'<span style="color:#94b3a9">Nincs aktív zavar.</span>';
  decorate(s);
 }
 function installUI(){
  mount();if(!renderWrapped&&typeof root.render==='function'){const render=root.render;root.render=function(){const v=render.apply(this,arguments);updateUI();return v;};renderWrapped=true;}
  if(!showWrapped&&typeof root.showTrain==='function'){const sh=root.showTrain;root.showTrain=function(id){const v=sh.apply(this,arguments),s=current(),t=s&&s.trains.find(t=>t.id===id),title=document.getElementById('trainTitle');if(title&&t&&t.type==='freight')title.textContent=t.id+' · véletlen tehervonat · max. '+t.maxSpeedKmh+' km/h';return v;};showWrapped=true;}
  updateUI();
 }
 const api={ensure,spawnFreight,createEvent,randomEvent,installUI,setSeed(s,seed){ensure(s).seed=(seed>>>0)||123456789;}};
 root.RailRandomTraffic=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installUI);else installUI();setInterval(installUI,600);}
})(typeof window!=='undefined'?window:globalThis);
