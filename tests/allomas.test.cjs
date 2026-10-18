const assert=require("node:assert/strict");
const {StationGame}=require("../allomas-motor.js");const {ROUTE,TRAINS}=require("../adatok.js");
let n=0;const ok=(v,m)=>{assert.ok(v,m);n++;};const names=ROUTE.map(r=>r.n);const SB=names.indexOf("Sárbogárd");
let g=new StationGame(SB,300);ok(g.trains.length>=30&&g.trains.length<=60,"Sárbogárd napi forgalom: "+g.trains.length);
ok(g.trains.some(t=>t.kind==="pass")&&g.trains.some(t=>t.kind==="stop"),"Megálló és áthaladó vonatok");ok(g.paused,"Szünetben indul");
g.auto=false;let tr=g.trains.find(t=>t.kind==="stop"&&t.dir===1);g.time=tr.arr-8.05;g.tick(.1);ok(tr.state==="request","Engedélykérés megjelenik");
ok(!g.setRoute("A","T-IV").ok,"Engedély nélkül nincs vágányút");ok(g.grant(tr.id,"V").ok,"Engedély V. vágányra");ok(!g.grant(tr.id,"V").ok,"Dupla engedély tiltva");
ok(!g.setRoute("B","T-V").ok,"Rossz irányú bejárat tiltva");ok(g.setRoute("A","T-V").ok,"Bejárati vágányút");ok(!g.route("A").clear,"Első lezárás után Megállj");
g.time=tr.arr-2;g.tick(1.0);ok(tr.state==="signal"&&tr.prog===0,"Megállj jelzőnél vár");
ok(g.clearSignal("A").ok,"Jelzőállítás");g.tick(.1);ok(tr.state==="entering","Behalad");g.tick(.5);ok(tr.prog>0&&tr.prog<1,"Folyamatos animáció");
ok(!g.cancelRoute("A").ok,"Mozgó vonat alatt nincs oldás");g.tick(1.0);ok(tr.state==="stopped"&&tr.track==="V","Megállt V-n");ok(!g.route("A"),"Bejárati út feloldva");
g.time=Math.max(g.time,tr.dep)+0.2;ok(g.setRoute("R-V","VR").ok,"Kijárati vágányút");ok(g.clearSignal("R-V").ok,"Kijárat szabad");g.tick(.1);ok(tr.state==="leaving","Kijár");g.tick(1.2);ok(tr.state==="gone"&&tr.aDep,"Elindult");
for(const name of ["Sárbogárd","Rétszilas","Kurd","Pusztaszabolcs","Dombóvár","Budapest-Kelenföld","Budapest-Déli","Pécs","Ercsi","Százhalombatta"]){
 const q=new StationGame(names.indexOf(name),0);q.auto=true;for(let i=0;i<6200;i++)q.tick(.25);
 const left=q.trains.filter(t=>t.state!=="gone"),maxd=Math.max(0,...q.trains.map(t=>t.delay||0));
 ok(left.length===0,name+": minden vonat feldolgozva ("+left.length+" maradt "+left.slice(0,3).map(t=>t.id+":"+t.state).join(",")+")");ok(maxd<8,name+": késés "+maxd.toFixed(1));ok(q.routes.length===0,name+": nincs beragadt vágányút");
}
console.log(JSON.stringify({passed:n}));
