/* Run: node tests/network-model.test.cjs */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {Network,mainline,installLegacy}=require('../assets/network-model.js');
function engine(){const context=vm.createContext({console,REAL_TIMETABLE:[]});vm.runInContext(fs.readFileSync(path.join(__dirname,'../assets/engine.js'),'utf8')+'\n;globalThis.engineTypes={Simulation,AutomaticBlocks,STATIONS};',context);return context.engineTypes;}
const STATIONS=engine().STATIONS;
let checks=0;function equal(a,b){assert.deepEqual(a,b);checks++;}function ok(value){assert.ok(value);checks++;}function throws(fn){assert.throws(fn);checks++;}
const graph=mainline(STATIONS),control=STATIONS.filter(s=>s.control);
equal(graph.nodes.size,31);equal(graph.links.size,30);
for(let i=0;i<control.length;i++)for(const dir of [-1,1])equal(graph.nextLegacy({at:control[i].id,dir}),control[i+dir]?.id??null);
const shuffled=mainline([...STATIONS].reverse());
for(const a of control)for(const b of control)equal(shuffled.route('station:'+a.id,'station:'+b.id),graph.route('station:'+a.id,'station:'+b.id));
equal(graph.nextLegacy({at:37,dir:1,menetrendi:true,endStation:37}),null);
equal(graph.nextLegacy({at:37,dir:1,freightRoute:true,endStation:37}),null);
equal(graph.nextLegacy({at:37,dir:1,branchManaged:true}),null);
equal(graph.nextLegacy({at:37,dir:-1,menetrendi:true,endStation:39}),null);
equal(graph.nextLegacy({at:36,dir:1,menetrendi:true,endStation:39}),37);
equal(graph.nextLegacy({at:37,dir:1,menetrendi:true,endStation:39}),39);
let checkpoints=0;for(const e of graph.links.values())checkpoints+=e.checkpoints.length;equal(checkpoints,16);
for(const sec of Object.values(graph.legacySections()))for(const lane of sec.lanes){ok(lane.blocks.every(b=>b.to-b.from<=2+1e-9));equal(lane.blocks.at(-1).to,sec.length);}
const branch=new Network([{id:'west'},{id:'junction'},{id:'east'},{id:'branch-test'}],[{id:'w',a:'west',b:'junction',lengthKm:2,laneCount:1},{id:'e',a:'junction',b:'east',lengthKm:3,laneCount:1},{id:'b',a:'junction',b:'branch-test',lengthKm:1,laneCount:1}]);
equal(branch.route('west','branch-test').map(e=>e.linkId),['w','b']);equal(branch.route('east','branch-test').map(e=>e.linkId),['e','b']);equal(branch.route('branch-test','west').map(e=>e.direction),[-1,-1]);
const disconnected=new Network([{id:'a'},{id:'b'}],[]);equal(disconnected.route('a','b'),null);
throws(()=>new Network([{id:'a'},{id:'a'}],[]));throws(()=>new Network([{id:'a'}],[{id:'x',a:'a',b:'missing',lengthKm:1,laneCount:1}]));throws(()=>graph.route('missing','station:37'));throws(()=>graph.legacySections(0));
const changed=graph.route('station:36','station:39');changed[0].to='broken';equal(graph.route('station:36','station:39')[0].to,'station:37');
const types=engine(),sim=new types.Simulation(),before=JSON.stringify(sim.blockSystem.sections);sim.setLineDirection('36-37',0,-1);
const originalDirection=sim.blockSystem.sections['36-37'].lanes[0].direction;
const adapter=installLegacy({...types,stations:types.STATIONS});sim.ensureBlocks();equal(sim.blockSystem.sections['36-37'].lanes[0].direction,originalDirection);
equal(Object.keys(sim.blockSystem.sections),Object.keys(JSON.parse(before)));equal(sim.blockSystem.section(37,36).id,'36-37');equal(sim.blockSystem.section(35,39),undefined);
throws(()=>installLegacy({...types,stations:types.STATIONS}));adapter.uninstall();ok(!Object.prototype.hasOwnProperty.call(types.Simulation.prototype,'_d55NetworkAdapter'));
function movement(useGraph,dir){
 const E=engine(),s=new E.Simulation();s.trains=[];s.permissions={};s.routes={};s.edges={};s.freightEnabled=false;s.auto=true;s.view='station';s.playerControl={stations:[]};s.realTraffic=()=>{};
 if(useGraph)installLegacy({...E,stations:E.STATIONS});
 const start=dir===1?35:39,end=dir===1?39:35,t=s.add(start,dir,s.time);t.menetrendi=true;t.endStation=end;
 t.plan=[{station:start,arr:null,dep:s.time}];let time=s.time,prev=start;
 for(let n=start+dir;dir===1?n<=end:n>=end;n+=dir){time+=Math.abs(E.STATIONS[n].km-E.STATIONS[prev].km)/65*60;t.plan.push({station:n,arr:time,dep:time+(E.STATIONS[n].control?2:0.5)});time=t.plan.at(-1).dep;prev=n;}
 for(let i=0;i<4000&&!t.finished;i++){
  if(s.request(t))s.grant(t.id);const p=s.permissions[t.id];if(p){s.autoRoute(p.to,t.dir===1?'A':'B',(t.dir===1?'KR-':'KL-')+p.track);if(t.phase==='parked')s.autoRoute(t.at,(t.dir===1?'KR-':'KL-')+t.track,t.dir===1?'VR':'VL');}s.tick(.025);
 }
 ok(t.finished);return JSON.parse(JSON.stringify({at:t.at,history:t.history,time:s.time,score:s.score,permissions:s.permissions,routes:s.routes}));
}
for(const dir of [1,-1])equal(movement(true,dir),movement(false,dir));
console.log(JSON.stringify({checks,nodes:graph.nodes.size,links:graph.links.size,checkpoints,branchesInGenericGraph:true,legacyMovementBothDirections:'identical',status:'PASS'}));
