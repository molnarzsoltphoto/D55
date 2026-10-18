"use strict";
const NW={camera:null,layout:null,drag:null,startStation:null,ready:false,svg:null,feedback:'',zoom:1};
function nwLayout(){
 const ids=STATIONS.filter(s=>s.control&&!s.branch).map(s=>s.id),nodes={},links={};let x=80;
 const make=(s,x,y)=>({id:s.id,x,w:360,y,height:Math.max(120,s.tracks.length*26),ty:tr=>y+(s.tracks.indexOf(tr)-(s.tracks.length-1)/2)*26});
 for(let i=0;i<ids.length;i++){
  const s=STATIONS[ids[i]];nodes[s.id]=make(s,x,400);
  if(i<ids.length-1){const sec=sim.blockSystem.section(s.id,ids[i+1]),gap=Math.max(280,sec.lanes[0].blocks.length*82);links[sec.id]={points:[[x+360,400],[x+360+gap,400]]};x+=360+gap;}
 }
 const sb=nodes[SB],aba=STATIONS[ABA];nodes[ABA]=make(aba,sb.x-1050,140);ids.push(ABA);
 links[`18-${ABA}`]={points:[[nodes[ABA].x+360,140],[sb.x-450,140],[sb.x-120,470],[sb.x,470]],branch:true};
 return {ids,nodes,links,width:x+440,height:820};
}
function nwSample(points,f){
 const seg=points.slice(1).map((p,i)=>Math.hypot(p[0]-points[i][0],p[1]-points[i][1]));let d=Math.max(0,Math.min(1,f))*seg.reduce((a,b)=>a+b,0);
 for(let i=0;i<seg.length;i++){if(d<=seg[i]||i===seg.length-1){const q=seg[i]?d/seg[i]:0;return [points[i][0]+(points[i+1][0]-points[i][0])*q,points[i][1]+(points[i+1][1]-points[i][1])*q];}d-=seg[i];}return points[0];
}
function nwPartial(points,a,b,offset=0){
 const seg=points.slice(1).map((p,i)=>Math.hypot(p[0]-points[i][0],p[1]-points[i][1])),len=seg.reduce((x,y)=>x+y,0),out=[nwSample(points,a)];let acc=0;
 for(let i=0;i<seg.length-1;i++){acc+=seg[i];if(acc>len*a&&acc<len*b)out.push(points[i+1]);}out.push(nwSample(points,b));return 'M'+out.map(p=>p[0]+','+(p[1]+offset)).join('L');
}
function nwBranchFocus(){
 if(!NW.layout)return;const n=NW.layout.nodes[SB],r=NW.svg.getBoundingClientRect(),w=1800,h=w*r.height/r.width;
 NW.camera={x:n.x-1300,y:300-h/2,w,h};nwApply();
}

function nwApply(){if(!NW.svg||!NW.camera)return;const c=NW.camera;NW.svg.setAttribute('viewBox',`${c.x} ${c.y} ${c.w} ${c.h}`);const z=document.getElementById('netZoom');if(z)z.textContent=Math.round((document.getElementById('kofi').clientWidth||1000)/c.w*100)+'%';}
function nwZoom(f,cx,cy){
 if(!NW.camera||!NW.svg)return;const r=NW.svg.getBoundingClientRect(),c=NW.camera,rx=cx===undefined?.5:Math.max(0,Math.min(1,(cx-r.left)/r.width)),ry=cy===undefined?.5:Math.max(0,Math.min(1,(cy-r.top)/r.height)),ww=Math.max(420,Math.min(NW.layout.width+200,c.w/f)),hh=ww*r.height/r.width;
 const wx=c.x+c.w*rx,wy=c.y+c.h*ry;c.x=wx-ww*rx;c.y=wy-hh*ry;c.w=ww;c.h=hh;nwApply();
}
function nwFocus(id){
 if(!NW.layout)return;const n=NW.layout.nodes[id];if(!n)return;
 const w=1400,r=NW.svg.getBoundingClientRect(),h=w*(r.height||600)/(r.width||1100);NW.camera={x:n.x+n.w/2-w/2,y:n.y-h/2,w,h};nwApply();
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
 sim.ensureBlocks();nwSetup();NW.layout=nwLayout();const L=NW.layout;if(!NW.camera)nwFocus(sim.selected);
 let h=`<defs><pattern id="netGrid" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M50 0H0V50" stroke="#14252f" stroke-width=".7" fill="none"/></pattern></defs><rect x="-100000" y="-100000" width="200000" height="200000" fill="#071119"/><rect x="-100000" y="-100000" width="200000" height="200000" fill="url(#netGrid)"/>`;
 for(const sec of Object.values(sim.blockSystem.sections)){
  const link=L.links[sec.id];if(!link)continue;const pts=link.points;
  for(let lane=0;lane<sec.lanes.length;lane++){
   const ln=sec.lanes[lane],offset=sec.double?(lane===0?-14:14):0;
   h+=drawPath(nwPartial(pts,0,1,offset),'#344d5c',4);
   for(const b of ln.blocks){
    h+=drawPath(nwPartial(pts,b.from/sec.length,b.to/sec.length,offset),b.owner?'#ff5d72':'#7397aa',4,`data-block="${ln.id}/${b.index}" data-owner="${b.owner||''}"`);
    const dir=ln.direction,aspect=sim.blockSystem.aspect(sec.id,lane,b.index,dir,sim),q=nwSample(pts,(dir===1?b.from+.08:b.to-.08)/sec.length),x=q[0],y=q[1]+offset,sy=y+(dir===1?-12:12),col={green:'#55dd8c',yellow:'#ffd166',red:'#ff5d72',off:'#3b4f5c'}[aspect];
    h+=`<g data-blocksignal="${ln.id}/${b.index}" data-aspect="${aspect}"><title>${esc(STATIONS[sec.from].name)}–${esc(STATIONS[sec.to].name)}, ${lane+1}. vonali vágány, ${b.index+1}. térköz: ${(b.to-b.from).toFixed(2)} km · ${b.owner?'foglalt: '+b.owner:'szabad'}</title><path d="M${x} ${y}V${sy}" stroke="#9ab6c5" stroke-width="1"/><path d="M${x-5} ${sy-4}L${x+5} ${sy}L${x-5} ${sy+4}Z" fill="${col}" transform="rotate(${dir===1?0:180} ${x} ${sy})"/></g>`;
    const mid=nwSample(pts,(b.from+b.to)/2/sec.length);h+=`<text x="${mid[0]}" y="${mid[1]+offset+(lane===0?-28:31)}" text-anchor="middle" fill="#64899f" font-size="9">${(b.to-b.from).toFixed(1)} km</text>`;
   }
   const mid=nwSample(pts,.5),x=mid[0],dy=mid[1]+70+lane*25,label=sec.branch?(ln.direction===1?sec.labels.forward:sec.labels.backward):(ln.direction===1?'Pécs →':'← Budapest');
   h+=`<g data-netdir="${-ln.direction}" data-section="${sec.id}" data-lane="${lane}" role="button" aria-label="Menetirány ${sec.id} ${lane}" style="cursor:pointer"><rect x="${x-120}" y="${dy-13}" width="240" height="23" rx="4" fill="#132d3b" stroke="#3f7b92"/><text x="${x}" y="${dy+3}" text-anchor="middle" fill="#85dded" font-size="10">${lane+1}. vágány: ${esc(label)} · irányváltás</text></g>`;
  }
  const mid=nwSample(pts,.5);h+=`<text x="${mid[0]}" y="${mid[1]+140}" text-anchor="middle" fill="${sec.branch?'#a9e3c2':'#7193a8'}" font-size="11">${sec.branch?'45-ös ág · ':''}${sec.length.toFixed(1)} km · ${sec.lanes[0].blocks.length} térköz / vágány</text>`;
  if(!sec.branch)STATIONS.filter(s=>!s.control&&s.id>sec.from&&s.id<sec.to).forEach(s=>{const q=nwSample(pts,(s.km-STATIONS[sec.from].km)/sec.length);h+=`<path d="M${q[0]} ${q[1]-24}V${q[1]+24}" stroke="#c7d5a5" stroke-width="2"/><text x="${q[0]}" y="${q[1]+194}" text-anchor="middle" fill="#b6c9d3" font-size="10">${esc(s.name)} · ${s.tracks.length||'—'} vágány</text>`;});
 }
 for(const sid of L.ids){const n=L.nodes[sid],s=STATIONS[sid],top=n.y-(s.tracks.length-1)*13-60,bottom=n.y+(s.tracks.length-1)*13+50;
  if(sid===sim.selected)h+=`<rect x="${n.x-18}" y="${top-20}" width="${n.w+36}" height="${bottom-top+40}" rx="10" fill="#0c2533" stroke="#3f98b1" stroke-dasharray="5 4"/>`;
  h+=`<g data-netstation="${sid}" style="cursor:pointer"><rect x="${n.x+25}" y="${top-8}" width="310" height="25" rx="4" fill="#183b4d"/><text x="${n.x+180}" y="${top+9}" text-anchor="middle" fill="#b5e8f0" font-size="13" font-weight="700">${esc(s.name)} · ${s.boundary?'külső határpont':s.tracks.length+' vágány'}</text></g>`;
  for(const tr of s.tracks){const y=n.ty(tr),occ=sim.trains.some(t=>t.at===sid&&t.track===tr&&['parked','leaving'].includes(t.phase)),p=Object.values(sim.permissions).find(p=>p.to===sid&&p.track===tr),closed=sim.closed[`${sid}:${tr}`];
   h+=drawPath(`M${n.x} ${n.y}L${n.x+72} ${y}H${n.x+288}L${n.x+360} ${n.y}`,'#46697e',2.5);
   if(sid===SB)h+=drawPath(`M${n.x} ${n.y+70}L${n.x+72} ${y}`,'#46725f',2,'stroke-dasharray="4 3"');
   h+=drawPath(`M${n.x+72} ${y}H${n.x+288}`,occ?'#ff5d72':closed?'#b88649':p?'#e4c164':'#a1b4bf',4,`data-nettrack="${sid}:${tr}"`);
   h+=`<text x="${n.x+180}" y="${y-7}" text-anchor="middle" fill="#9cb7c8" font-size="10">${esc(tr)}</text>`;
  }
  for(const [key,r] of Object.entries(sim.routes)){if(r.at!==sid)continue;const y=n.ty(r.track),left=r.side==='L',base=n.y+(r.branch&&sid===SB?70:0),pts=left?[[n.x,base],[n.x+72,y],[n.x+180,y]]:[[n.x+360,base],[n.x+288,y],[n.x+180,y]];h+=drawPath('M'+pts.map(p=>p.join(',')).join('L'),r.clear?'#67e69d':r.releaseAt?'#ffd166':'#fff8d9',5,`data-netroute="${esc(key)}"`);}
  h+=nwSignal('A',sid,n.x+18,n.y-19)+nwSignal('B',sid,n.x+342,n.y+19)+nwSignal('VL',sid,n.x-14,n.y+26,true)+nwSignal('VR',sid,n.x+374,n.y-26,true);
  if(sid===SB)h+=nwSignal('A45',sid,n.x+18,n.y+51)+nwSignal('VL45',sid,n.x-14,n.y+96,true);
  for(const tr of s.tracks){const y=n.ty(tr);h+=nwSignal('KL-'+tr,sid,n.x+86,y)+nwSignal('KR-'+tr,sid,n.x+274,y);}
 }
 for(const t of sim.trains){const p=sim.permissions[t.id];let x,y;
  if(t.phase==='parked'){const n=L.nodes[t.at];if(!n)continue;x=n.x+180;y=n.ty(t.track);}
  else if(p&&t.phase==='leaving'){const n=L.nodes[t.at],f=t.progress,base=n.y+(p.section===`18-${ABA}`&&t.at===SB?70:0);x=n.x+180+t.dir*f*180;y=n.ty(t.track)+(base-n.ty(t.track))*f;}
  else if(p&&t.phase==='line'){const s=sim.blockSystem.sections[p.section],l=L.links[p.section],q=(t.distance||0)/s.length,v=nwSample(l.points,t.dir===1?q:1-q);x=v[0];y=v[1]+(s.double?(p.lane===0?-14:14):0);}
  else if(p&&['approach','hold','entering'].includes(t.phase)){const n=L.nodes[p.to],f=t.phase==='entering'?t.progress:0,base=n.y+(p.section===`18-${ABA}`&&p.to===SB?70:0);x=t.dir===1?n.x+f*180:n.x+360-f*180;y=base+(n.ty(p.track)-base)*f;}
  if(x!==undefined)h+=nwTrain(t,x,y);
 }
 NW.svg.innerHTML=h;nwApply();
 const status=document.getElementById('netStatus');if(status)status.textContent=NW.feedback||'Húzás: mozgatás · görgő / + / −: nagyítás · 45-ös ág: Aba-Sárkeresztúr–Sárbogárd · A45 bejárat / VL45 kijárati cél.';
}
