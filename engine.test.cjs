const assert=require('node:assert/strict');
const {Simulation,STATIONS,SB}=require('../assets/engine.js');
let n=0;const check=(v,msg)=>{assert.ok(v,msg);n++;};
let s=new Simulation(),t=s.trains[0];s.auto=false;
check(s.paused,'Paused initially');check(s.request(t),'Initial request');check(s.next(t)===SB,'Target Sarbogard');
check(!s.depart(t.id).ok,'Departure needs permission');s.tick(5);check(t.phase==='station','No spontaneous departure');
check(s.grant(t.id,'IV').ok,'Grant');check(s.busy(SB,'IV'),'Track reservation');check(!s.toggle(SB,'IV').ok,'Reserved track closure blocked');
check(s.depart(t.id).ok,'Set departure');s.tick(.1);check(t.phase==='running','Running');check(!s.cancel(t.id).ok,'Cannot revoke moving train');
s.tick(30);check(t.phase==='entry','Wait at entry signal');check(s.entry(t.id).ok,'Entry route');s.tick(.1);
check(t.at===SB&&t.phase==='station'&&t.track==='IV','Correct arrival');check(!s.permissions[t.id],'Permission released');check(!Object.values(s.edges).includes(t.id),'Edge released');
let c=new Simulation();c.auto=false;check(c.grant(c.trains[0].id,'III').ok,'Grant for revoke');check(c.cancel(c.trains[0].id).ok,'Revoke before departure');check(!c.busy(SB,'III'),'Track released by revoke');check(c.toggle(SB,'III').ok,'Close free track');check(!c.grant(c.trains[0].id,'III').ok,'Closed track rejected');
let x=new Simulation();x.trains=[];x.permissions={};x.edges={};x.auto=false;let a=x.add(17,1,360),b=x.add(SB,-1,360);check(x.grant(a.id,'III').ok,'Single track permission');check(!x.grant(b.id,'II').ok,'Opposing train excluded');check(x.edge(0,1,1)!==x.edge(0,1,-1),'Double track directions separated');check(x.edge(17,18,1)===x.edge(17,18,-1),'Single track shared');
let z=new Simulation();z.trains=[];z.permissions={};z.edges={};z.auto=false;let q=z.add(0,1,360);check(q.plan.length===STATIONS.length,'All route points in plan');check(q.plan.every((p,i,arr)=>!i||p.arr>=arr[i-1].dep),'Plan is chronological');
for(let i=0;i<10000&&q.phase!=='done';i++){if(z.request(q))z.grant(q.id);if(z.permissions[q.id]){z.entry(q.id);if(q.phase==='station')z.depart(q.id);}z.tick(.1);}
check(q.phase==='done'&&q.at===46,'Complete Deli-Pecs run');check(q.history.length===STATIONS.filter(s=>s.control).length-1,'All control stations visited');
let loaded=Object.assign(new Simulation(),JSON.parse(JSON.stringify(z)));check(loaded.trains[0].phase==='done'&&typeof loaded.tick==='function','State round trip');
let m=new Simulation();m.trains=[];let v=m.add(19,1,360);check(m.next(v)===21,'Halt does not issue permission');
console.log(JSON.stringify({passed:n,routePoints:STATIONS.length,controlPoints:STATIONS.filter(s=>s.control).length}));
