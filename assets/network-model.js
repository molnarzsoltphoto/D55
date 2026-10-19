/* D55 network migration, step 1. Opt-in: loading alone does not change the game. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.D55Network=api;})(globalThis,function(){
'use strict';
const MAIN_LINKS=[
 [0,1,true,[]],[1,3,true,[2]],[3,6,true,[4,5]],[6,8,true,[7]],
 [8,9,true,[]],[9,10,true,[]],[10,12,true,[11]],[12,14,true,[13]],
 [14,15,false,[]],[15,16,false,[]],[16,17,false,[]],[17,18,false,[]],
 [18,19,false,[]],[19,21,false,[20]],[21,22,false,[]],[22,23,false,[]],
 [23,25,false,[24]],[25,28,false,[26,27]],[28,31,false,[29,30]],
 [31,32,false,[]],[32,33,false,[]],[33,35,false,[34]],[35,36,false,[]],
 [36,37,false,[]],[37,39,false,[38]],[39,41,false,[40]],[41,43,false,[42]],
 [43,44,false,[]],[44,45,false,[]],[45,46,false,[]]
];
function check(value,message){if(!value)throw new Error(message);}
class Network{
 constructor(nodes,links){
  this.nodes=new Map();this.links=new Map();this.adjacency=new Map();this.legacy=new Map();this._routes=new Map();
  for(const n of nodes){check(n&&typeof n.id==='string'&&!this.nodes.has(n.id),'Invalid or duplicate node');this.nodes.set(n.id,{...n});this.adjacency.set(n.id,[]);if(n.legacyId!=null){check(!this.legacy.has(n.legacyId),'Duplicate legacy ID');this.legacy.set(n.legacyId,n.id);}}
  for(const e of links){
   check(e&&typeof e.id==='string'&&!this.links.has(e.id),'Invalid or duplicate link');
   check(this.nodes.has(e.a)&&this.nodes.has(e.b)&&e.a!==e.b,'Unknown or identical link endpoints');
   check(Number.isFinite(e.lengthKm)&&e.lengthKm>0,'Invalid link length');
   check(Number.isInteger(e.laneCount)&&e.laneCount>0,'Invalid lane count');
   const edge={...e,checkpoints:(e.checkpoints||[]).map(p=>({...p}))};this.links.set(edge.id,edge);
   this.adjacency.get(edge.a).push({linkId:edge.id,from:edge.a,to:edge.b,direction:1});
   this.adjacency.get(edge.b).push({linkId:edge.id,from:edge.b,to:edge.a,direction:-1});
  }
 }
 route(from,to){
  check(this.nodes.has(from)&&this.nodes.has(to),'Unknown route endpoint');if(from===to)return [];
  const key=JSON.stringify([from,to]);if(this._routes.has(key)){const saved=this._routes.get(key);return saved===null?null:saved.map(e=>({...e}));}
  const distance=new Map([[from,0]]),previous=new Map(),open=new Set(this.nodes.keys());
  while(open.size){
   let current=null,best=Infinity;for(const id of open){const d=distance.get(id)??Infinity;if(d<best){current=id;best=d;}}
   if(current===null){this._routes.set(key,null);return null;}open.delete(current);if(current===to)break;
   for(const arc of this.adjacency.get(current)){if(!open.has(arc.to))continue;const next=best+this.links.get(arc.linkId).lengthKm;if(next<(distance.get(arc.to)??Infinity)){distance.set(arc.to,next);previous.set(arc.to,arc);}}
  }
  if(!previous.has(to)){this._routes.set(key,null);return null;}const result=[];let at=to;
  while(at!==from){const arc=previous.get(at);result.push({...arc});at=arc.from;}
  result.reverse();this._routes.set(key,result.map(e=>({...e})));return result;
 }
 linkBetweenLegacy(a,b){const from=this.legacy.get(a),to=this.legacy.get(b);return from&&to?this.adjacency.get(from).filter(e=>e.to===to).map(e=>this.links.get(e.linkId)):[];}
 nextLegacy(train){
  if(!train||train.branchManaged)return null;const from=this.legacy.get(train.at);if(!from)return null;
  let target=(train.menetrendi||train.freightRoute)?train.endStation:null;
  if(target==null){const end=[...(train.plan||[])].reverse().find(p=>this.legacy.has(p.station));target=end?.station;}
  if(target==null)target=train.dir===1?46:0;
  const to=this.legacy.get(target);if(!to)return null;const route=this.route(from,to);
  if(!route?.length)return null;const first=route[0];
  if(first.direction!==train.dir)return null;return this.nodes.get(first.to).legacyId;
 }
 legacySections(blockKm=2){
  check(Number.isFinite(blockKm)&&blockKm>0,'Invalid block length');const result={};
  for(const e of this.links.values()){
   const from=this.nodes.get(e.a).legacyId,to=this.nodes.get(e.b).legacyId;
   check(Number.isInteger(from)&&Number.isInteger(to),'Legacy adapter requires numeric station IDs');
   const n=Math.ceil(e.lengthKm/blockKm),section={id:e.id,from,to,length:e.lengthKm,double:e.laneCount===2,lanes:[]};
   for(let lane=0;lane<e.laneCount;lane++)section.lanes.push({id:e.id+'/'+lane,direction:lane===0?1:-1,blocks:Array.from({length:n},(_,i)=>({index:i,from:i*blockKm,to:Math.min(e.lengthKm,(i+1)*blockKm),owner:null}))});
   result[e.id]=section;
  }return result;
 }
}
function mainline(stations){
 const metadata=new Map(stations.map(s=>[s.id,s]));check(metadata.size===stations.length,'Duplicate station metadata');const ids=new Set(MAIN_LINKS.flatMap(e=>[e[0],e[1]]));
 for(const id of ids)check(metadata.has(id)&&metadata.get(id).control,'Missing controlled station '+id);
 const nodes=[...ids].map(id=>({id:'station:'+id,legacyId:id,name:metadata.get(id).name}));
 const links=MAIN_LINKS.map(([a,b,double,via])=>{const start=metadata.get(a),end=metadata.get(b),length=Math.abs(end.km-start.km);return {id:a+'-'+b,a:'station:'+a,b:'station:'+b,lengthKm:length,laneCount:double?2:1,checkpoints:via.map(id=>{const s=metadata.get(id);check(s&&!s.control,'Missing checkpoint '+id);const offsetKm=Math.abs(s.km-start.km);check(offsetKm>0&&offsetKm<length,'Checkpoint outside link');return {legacyId:id,name:s.name,offsetKm};})};});
 return new Network(nodes,links);
}
function installLegacy({Simulation,AutomaticBlocks,stations}){
 check(Simulation?.prototype&&AutomaticBlocks?.prototype,'Missing legacy engine');const graph=mainline(stations),P=Simulation.prototype,B=AutomaticBlocks.prototype;
 check(!Object.prototype.hasOwnProperty.call(P,'_d55NetworkAdapter'),'Adapter already installed');
 const originalNext=P.next,originalEnsure=P.ensureBlocks,originalSection=B.section;
 function next(train){return graph.nextLegacy(train);}
 function ensure(){
  originalEnsure.call(this);if(this.blockSystem._d55GraphAttached)return;
  const old=this.blockSystem.sections,sections=graph.legacySections();
  for(const [id,section] of Object.entries(sections))for(let k=0;k<section.lanes.length;k++){
   const previous=old?.[id]?.lanes?.[k];if(previous)section.lanes[k].direction=previous.direction;
  }
  this.blockSystem.sections=sections;Object.defineProperty(this.blockSystem,'_d55GraphAttached',{value:true,configurable:true});this.blockSystem.refresh(this);
 }
 function section(a,b){const links=graph.linkBetweenLegacy(a,b);check(links.length<=1,'Parallel links require an explicit link ID');return links.length?this.sections[links[0].id]:undefined;}
 P.next=next;P.ensureBlocks=ensure;B.section=section;Object.defineProperty(P,'_d55NetworkAdapter',{value:true,configurable:true});
 return {graph,uninstall(){check(P.next===next&&P.ensureBlocks===ensure&&B.section===section,'Newer changes detected; do not overwrite them');P.next=originalNext;P.ensureBlocks=originalEnsure;B.section=originalSection;delete P._d55NetworkAdapter;}};
}
return {Network,mainline,installLegacy};
});
