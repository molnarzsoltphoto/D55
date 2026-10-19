"use strict";
const NW={camera:null,layout:null,drag:null,startStation:null,ready:false,svg:null,feedback:'',zoom:1};
function nwLayout(){
 const ids=STATIONS.filter(s=>s.control).map(s=>s.id),nodes={},links={};let x=80;
 for(let i=0;i<ids.length;i++){
  const s=STATIONS[ids[i]];nodes[s.id]={id:s.id,x,w:360,y:400,height:Math.max(120,s.tracks.length*26),ty:tr=>400+(s.tracks.indexOf(tr)-(s.tracks.length-1)/2)*26};
  if(i<ids.length-1){const sec=sim.blockSystem.section(s.id,ids[i+1]),gap=Math.max(280,sec.lanes[0].blocks.length*82);links[sec.id]={x1:x+360,x2:x+360+gap,y:400};x+=360+gap;}
 }
 return {ids,nodes,links,width:x+440,height:820};
}
function nwApply(){if(!NW.svg||!NW.camera)return;const c=NW.camera;NW.svg.setAttribute('viewBox',`${c.x} ${c.y} ${c.w} ${c.h}`);const z=document.getElementById('netZoom');if(z)z.textContent=Math.round((document.getElementById('kofi').clientWidth||1000)/c.w*100)+'%';}
function nwZoom(f,cx,cy){
 if(!NW.camera||!NW.svg)return;const r=NW.svg.getBoundingClientRect(),c=NW.camera,rx=cx===undefined?.5:Math.max(0,Math.min(1,(cx-r.left)/r.width)),ry=cy===undefined?.5:Math.max(0,Math.min(1,(cy-r.top)/r.height)),ww=Math.max(420,Math.min(NW.layout.width+200,c.w/f)),hh=ww*r.height/r.width;
 const wx=c.x+c.w*rx,wy=c.y+c.h*ry;c.x=wx-ww*rx;c.y=wy-hh*ry;c.w=ww;c.h=hh;nwApply();
}
function nwFocus(id){
 if(!NW.layout)return;const n=NW.layout.nodes[id];if(!n)return;
 const w=1400,r=NW.svg.getBoundingClientRect(),h=w*(r.height||600)/(r.width||1100);NW.camera={x:n.x+n.w/2-w/2,y:400-h/2,w,h};nwApply();
}
function nwFit(){const r=NW.svg.getBoundingClientRect(),w=NW.layout.width+100,h=w*r.height/r.width;NW.camera={x:-20,y:400-h/2,w,h};nwApply();}
function nwPoint(s,name){
 if(start&&NW.startStation!==s){start=null;NW.startStation=null;NW.feedback='A vágányút kezdő- és célpontjának ugyanazon az állomáson kell lennie.';render();return;}
 sim.selected=s;if(!start)NW.startStation=s;
 point(name);if(!start)NW.startStation=null;
}
function nwDirection(section,lane,dir){const r=sim.setLineDirection(section,lane,dir);NW.feedback=r.ok?'Menetirány beállítva.':r.msg;if(!r.ok)toast(r.msg);render();}
function nwSignal(name,s,x,y,goal=false){
 const route=sim.getRoute(s,name),sel=start===name&&NW.startStation===s,col=goal?'#51cf8b':route?.clear?'#51df80':'#ff6477';
 return `<g data-netpoint="${name}" data-station="${s}" tabindex="0" role="button" aria-label="${esc(STATIONS[s].name)} ${name}"><title>${esc(STATIONS[s].name)} · ${name}</title><rect x="${x-13}" y="${y-13}" width="26" height="26" fill="transparent"/>${goal?`<path d="M${x-7} ${y-6}L${x+8} ${y}L${x-7} ${y+6}Z" fill="${col}" stroke="${sel?'#ffe27a':col}" stroke-width="2"/>`:`<circle cx="${x}" cy="${y}" r="5" fill="${col}" stroke="${sel?'#ffe27a':'#172b37'}" stroke-width="${sel?4:1.5}"/>`}<text x="${x}" y="${y-10}" text-anchor="middle" fill="${sel?'#ffe27a':'#8ba7b7'}" font-size="9">${esc(name)}</text></g>`;
}
function nwTrain(t,x,y){return `<g data-nettrain="${t.id}"><rect x="${x-24}" y="${y-9}" width="48" height="18" rx="3" fill="${t.blockWaiting?'#e7a843':'#58c5da'}" stroke="#ddf4fa" stroke-width="1"/><text x="${x}" y="${y+4}" text-anchor="middle" fill="#03121b" font-size="10" font-weight="800">${t.id}${t.dir===1?'→':'←'}</text><title>${t.id}: ${t.blockWaiting?'térközjelző előtt vár':phases[t.phase]}</title></g>`;}
function nwSetup(){
 if(NW.ready)return;
 const el=document.getElementById('kofi');el.innerHTML='<svg id="networkSvg" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Összekötött vasúti hálózat"></svg>';NW.svg=document.getElementById('networkSvg');NW.ready=true;
 NW.svg.addEventListener('wheel',e=>{e.preventDefault();nwZoom(e.deltaY<0?1.16:1/1.16,e.clientX,e.clientY);},{passive:false});
 NW.svg.addEventListener('pointerdown',e=>{
  const p=e.target.closest('[data-netpoint]');if(p){e.preventDefault();nwPoint(Number(p.dataset.station),p.dataset.netpoint);return;}
  const d=e.target.closest('[data-netdir]');if(d){e.preventDefault();nwDirection(d.dataset.section,Number(d.dataset.lane),Number(d.dataset.netdir));return;}
  const n=e.target.closest('[data-netstation]');if(n){sim.selected=Number(n.dataset.netstation);render();}
  if(e.button===0||e.pointerType==='touch'){NW.drag={x:e.clientX,y:e.clientY,cx:NW.camera.x,cy:NW.camera.y};NW.svg.setPointerCapture(e.pointerId);NW.svg.classList.add('dragging');}
 });
 NW.svg.addEventListener('pointermove',e=>{if(!NW.drag)return;const r=NW.svg.getBoundingClientRect(),d=NW.drag;NW.camera.x=d.cx-(e.clientX-d.x)*NW.camera.w/r.width;NW.camera.y=d.cy-(e.clientY-d.y)*NW.camera.h/r.height;nwApply();});
 const end=()=>{NW.drag=null;NW.svg.classList.remove('dragging');};NW.svg.addEventListener('pointerup',end);NW.svg.addEventListener('pointercancel',end);
 NW.svg.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){const p=e.target.closest('[data-netpoint]');if(p){e.preventDefault();nwPoint(Number(p.dataset.station),p.dataset.netpoint);}}});
}
function drawNetwork(){
 sim.ensureBlocks();nwSetup();NW.layout=nwLayout();const L=NW.layout;
 if(!NW.camera)nwFocus(sim.selected);
 let h=`<defs><pattern id="netGrid" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M50 0H0V50" stroke="#14252f" stroke-width=".7" fill="none"/></pattern></defs><rect x="-100000" y="-100000" width="200000" height="200000" fill="#071119"/><rect x="-100000" y="-100000" width="200000" height="200000" fill="url(#netGrid)"/>`;
 for(const sec of Object.values(sim.blockSystem.sections)){
  const lyt=L.links[sec.id],left=L.nodes[sec.from],right=L.nodes[sec.to];
  for(let lane=0;lane<sec.lanes.length;lane++){
   const ln=sec.lanes[lane],y=400+(sec.double?(lane===0?-14:14):0);
   h+=drawPath(`M${lyt.x1} ${y}H${lyt.x2}`,'#344d5c',4);
   for(const b of ln.blocks){const x1=lyt.x1+(lyt.x2-lyt.x1)*b.from/sec.length,x2=lyt.x1+(lyt.x2-lyt.x1)*b.to/sec.length;
    h+=drawPath(`M${x1+3} ${y}H${x2-3}` ,b.owner?'#ff5d72':'#7397aa',4,`data-block="${ln.id}/${b.index}" data-owner="${b.owner||''}"`);
    const dir=ln.direction,aspect=sim.blockSystem.aspect(sec.id,lane,b.index,dir,sim),x=dir===1?x1+9:x2-9,c={green:'#55dd8c',yellow:'#ffd166',red:'#ff5d72',off:'#3b4f5c'}[aspect],sy=y+(dir===1?-12:12);
    h+=`<g data-blocksignal="${ln.id}/${b.index}" data-aspect="${aspect}"><title>${esc(STATIONS[sec.from].name)}–${esc(STATIONS[sec.to].name)}, ${lane+1}. vonali vágány, ${b.index+1}. térköz: ${(b.to-b.from).toFixed(2)} km · ${b.owner?'foglalt: '+b.owner:'szabad'}</title><path d="M${x} ${y}V${sy}" stroke="#9ab6c5" stroke-width="1"/><path d="M${x-5} ${sy-4}L${x+5} ${sy}L${x-5} ${sy+4}Z" fill="${c}" transform="rotate(${dir===1?0:180} ${x} ${sy})"/></g>`;
    h+=`<text x="${(x1+x2)/2}" y="${y+(lane===0?-28:31)}" text-anchor="middle" fill="#64899f" font-size="9">${(b.to-b.from).toFixed(1)} km</text>`;
   }
   const x=(lyt.x1+lyt.x2)/2,dy=400+75+lane*25;
   h+=`<g data-netdir="${-ln.direction}" data-section="${sec.id}" data-lane="${lane}" role="button" aria-label="Menetirány ${sec.id} ${lane}" style="cursor:pointer"><rect x="${x-105}" y="${dy-13}" width="210" height="23" rx="4" fill="#132d3b" stroke="#3f7b92"/><text x="${x}" y="${dy+3}" text-anchor="middle" fill="#85dded" font-size="10">${lane+1}. vágány: ${ln.direction===1?'Pécs →':'← Budapest'} · irányváltás</text></g>`;
  }
  h+=`<text x="${(lyt.x1+lyt.x2)/2}" y="550" text-anchor="middle" fill="#7193a8" font-size="11">${sec.length.toFixed(1)} km · ${sec.lanes[0].blocks.length} térköz / vágány</text>`;
  STATIONS.filter(s=>!s.control&&s.id>sec.from&&s.id<sec.to).forEach(s=>{const q=(s.km-STATIONS[sec.from].km)/sec.length,x=lyt.x1+q*(lyt.x2-lyt.x1);h+=`<path d="M${x} 376V424" stroke="#c7d5a5" stroke-width="2"/><text x="${x}" y="594" text-anchor="middle" fill="#b6c9d3" font-size="10">${esc(s.name)} · ${s.tracks.length||'—'} vágány</text>`;});
 }
 for(const sid of L.ids){const n=L.nodes[sid],s=STATIONS[sid],top=n.y-(s.tracks.length-1)*13-60,bottom=n.y+(s.tracks.length-1)*13+50;
  if(sid===sim.selected)h+=`<rect x="${n.x-18}" y="${top-20}" width="${n.w+36}" height="${bottom-top+40}" rx="10" fill="#0c2533" stroke="#3f98b1" stroke-dasharray="5 4"/>`;
  h+=`<g data-netstation="${sid}" style="cursor:pointer"><rect x="${n.x+55}" y="${top-8}" width="250" height="25" rx="4" fill="#183b4d"/><text x="${n.x+180}" y="${top+9}" text-anchor="middle" fill="#b5e8f0" font-size="13" font-weight="700">${esc(s.name)} · ${s.tracks.length} vágány</text></g>`;
  for(const tr of s.tracks){const y=n.ty(tr),occ=sim.trains.some(t=>t.at===sid&&t.track===tr&&['parked','leaving'].includes(t.phase)),p=Object.values(sim.permissions).find(p=>p.to===sid&&p.track===tr),closed=sim.closed[`${sid}:${tr}`];
   h+=drawPath(`M${n.x} 400L${n.x+72} ${y}H${n.x+288}L${n.x+360} 400`,'#46697e',2.5);
   h+=drawPath(`M${n.x+72} ${y}H${n.x+288}`,occ?'#ff5d72':closed?'#b88649':p?'#e4c164':'#a1b4bf',4,`data-nettrack="${sid}:${tr}"`);
   h+=`<text x="${n.x+180}" y="${y-7}" text-anchor="middle" fill="#9cb7c8" font-size="10">${esc(tr)}</text>`;
  }
  for(const [key,r] of Object.entries(sim.routes)){if(r.at!==sid)continue;const y=n.ty(r.track),left=r.side==='L',pts=left?[[n.x,400],[n.x+72,y],[n.x+180,y]]:[[n.x+360,400],[n.x+288,y],[n.x+180,y]];h+=drawPath('M'+pts.map(p=>p.join(',')).join('L'),r.clear?'#67e69d':r.releaseAt?'#ffd166':'#fff8d9',5,`data-netroute="${esc(key)}"`);}
  h+=nwSignal('A',sid,n.x+18,381)+nwSignal('B',sid,n.x+342,419)+nwSignal('VL',sid,n.x-14,426,true)+nwSignal('VR',sid,n.x+374,374,true);
  for(const tr of s.tracks){const y=n.ty(tr);h+=nwSignal('KL-'+tr,sid,n.x+86,y)+nwSignal('KR-'+tr,sid,n.x+274,y);}
 }
 for(const t of sim.trains){const p=sim.permissions[t.id];let x,y;
  if(t.phase==='parked'){const n=L.nodes[t.at];if(!n)continue;x=n.x+180;y=n.ty(t.track);}
  else if(p&&t.phase==='leaving'){const n=L.nodes[t.at],f=t.progress;x=n.x+180+t.dir*f*180;y=n.ty(t.track)+(400-n.ty(t.track))*f;}
  else if(p&&t.phase==='line'){const s=sim.blockSystem.sections[p.section],l=L.links[p.section],q=(t.distance||0)/s.length;x=t.dir===1?l.x1+(l.x2-l.x1)*q:l.x2-(l.x2-l.x1)*q;y=400+(s.double?(p.lane===0?-14:14):0);}
  else if(p&&['approach','hold','entering'].includes(t.phase)){const n=L.nodes[p.to],f=t.phase==='entering'?t.progress:0;x=t.dir===1?n.x+f*180:n.x+360-f*180;y=400+(n.ty(p.track)-400)*f;}
  if(x!==undefined)h+=nwTrain(t,x,y);
 }
 NW.svg.innerHTML=h;nwApply();
 const status=document.getElementById('netStatus');if(status)status.textContent=NW.feedback||'Húzás: mozgatás · görgő / + / −: nagyítás · kattintás: jelzőgomb · a kék menetiránygomb irányt vált.';
}
