"use strict";
(function(root){
 if(root.RailRandomTraffic)return;
 if(typeof Simulation==='undefined'||typeof AutomaticBlocks==='undefined')throw Error('A random-traffic.js a térközös engine.js és az app.js után töltendő be.');
 const baseTick=Simulation.prototype.tick,baseMove=AutomaticBlocks.prototype.move,baseClear=Simulation.prototype.clearSignal,baseNext=Simulation.prototype.next;
 let activeSim=null,renderWrapped=false,showWrapped=false,resetWrapped=false,loadWrapped=false,kofiClickBound=false;
 const SPEEDS=[60,70,80,90,100];

 // Hivatalos 2025–2026. évi MÁV menetrend: 40a (Budapest–Pusztaszabolcs) és 40 (Pusztaszabolcs–Sárbogárd–Dombóvár–Pécs)
 const REAL_TIMETABLE=[
  // --- PÁROS IRÁNY (Budapest -> Pusztaszabolcs -> Sárbogárd -> Dombóvár -> Pécs, dir: 1) ---
  {id:'8010',name:'Személy (Sárbogárd–Pécs)',category:'Személy',maxSpeedKmh:100,dir:1,stops:[
   {match:['sárbogárd'],dep:'04:42'},
   {match:['rétszilas'],arr:'04:48',dep:'04:49'},
   {match:['cece'],arr:'04:54',dep:'04:55'},
   {match:['vajta'],arr:'05:01',dep:'05:02'},
   {match:['nagydorog'],arr:'05:09',dep:'05:10'},
   {match:['tengelic'],arr:'05:16',dep:'05:17'},
   {match:['szekszárd','pincehely','tolna'],arr:'05:25',dep:'05:26'},
   {match:['pincehely'],arr:'05:31',dep:'05:32'},
   {match:['keszőhidegkút','gyönk'],arr:'05:39',dep:'05:40'},
   {match:['szárazd'],arr:'05:44',dep:'05:44'},
   {match:['regöly'],arr:'05:47',dep:'05:48'},
   {match:['szakály','hőgyész'],arr:'05:54',dep:'05:55'},
   {match:['kurd'],arr:'06:03',dep:'06:04'},
   {match:['döbrököz'],arr:'06:11',dep:'06:12'},
   {match:['dombóvár'],arr:'06:20',dep:'06:24'},
   {match:['pécs'],arr:'07:28'}
  ]},
  {id:'S40 4110',name:'S40 (Bp-Déli – Dombóvár)',category:'S40',maxSpeedKmh:100,dir:1,stops:[
   {match:['déli'],dep:'05:15'},
   {match:['kelenföld'],arr:'05:21',dep:'05:22'},
   {match:['budafok'],arr:'05:27',dep:'05:28'},
   {match:['háros'],arr:'05:30',dep:'05:31'},
   {match:['nagytétény','tétény'],arr:'05:34',dep:'05:35'},
   {match:['érdliget'],arr:'05:38',dep:'05:38'},
   {match:['érd felső','érd'],arr:'05:40',dep:'05:41'},
   {match:['érd alsó','tárnok'],arr:'05:44',dep:'05:44'},
   {match:['százhalombatta','batta'],arr:'05:48',dep:'05:49'},
   {match:['dunai finomító','finomító'],arr:'05:52',dep:'05:53'},
   {match:['ercsi'],arr:'05:57',dep:'05:58'},
   {match:['iváncsa','ivancsa'],arr:'06:04',dep:'06:05'},
   {match:['pusztaszabolcs'],arr:'06:11',dep:'06:15'},
   {match:['szabadegyháza'],arr:'06:21',dep:'06:22'},
   {match:['sárosd'],arr:'06:28',dep:'06:29'},
   {match:['nagylók'],arr:'06:34',dep:'06:35'},
   {match:['sárbogárd'],arr:'06:42',dep:'06:44'},
   {match:['rétszilas'],arr:'06:51',dep:'06:52'},
   {match:['cece'],arr:'06:57',dep:'06:58'},
   {match:['vajta'],arr:'07:03',dep:'07:04'},
   {match:['nagydorog'],arr:'07:11',dep:'07:12'},
   {match:['tengelic'],arr:'07:18',dep:'07:19'},
   {match:['pincehely'],arr:'07:31',dep:'07:32'},
   {match:['keszőhidegkút','gyönk'],arr:'07:39',dep:'07:40'},
   {match:['szakály','hőgyész'],arr:'07:53',dep:'07:54'},
   {match:['kurd'],arr:'08:02',dep:'08:03'},
   {match:['döbrököz'],arr:'08:10',dep:'08:11'},
   {match:['dombóvár'],arr:'08:19'}
  ]},
  {id:'IC 800',name:'Mecsek IC (Bp-Déli – Pécs)',category:'IC',maxSpeedKmh:120,dir:1,stops:[
   {match:['déli'],dep:'05:53'},
   {match:['kelenföld'],arr:'05:59',dep:'06:01'},
   {match:['százhalombatta','batta'],arr:'06:20',dep:'06:20'},
   {match:['pusztaszabolcs'],arr:'06:35',dep:'06:36'},
   {match:['sárbogárd'],arr:'06:59',dep:'07:00'},
   {match:['pincehely'],arr:'07:17',dep:'07:18'},
   {match:['dombóvár'],arr:'07:43',dep:'07:45'},
   {match:['sásd'],arr:'07:59',dep:'08:00'},
   {match:['szentlőrinc'],arr:'08:23',dep:'08:24'},
   {match:['pécs'],arr:'08:37'}
  ]},
  {id:'8012',name:'Személy (Sárbogárd–Dombóvár)',category:'Személy',maxSpeedKmh:100,dir:1,stops:[
   {match:['sárbogárd'],dep:'06:05'},
   {match:['rétszilas'],arr:'06:11',dep:'06:12'},
   {match:['cece'],arr:'06:17',dep:'06:18'},
   {match:['vajta'],arr:'06:24',dep:'06:25'},
   {match:['nagydorog'],arr:'06:32',dep:'06:33'},
   {match:['tengelic'],arr:'06:39',dep:'06:40'},
   {match:['pincehely'],arr:'06:52',dep:'06:53'},
   {match:['keszőhidegkút','gyönk'],arr:'07:00',dep:'07:01'},
   {match:['szakály','hőgyész'],arr:'07:14',dep:'07:15'},
   {match:['kurd'],arr:'07:23',dep:'07:24'},
   {match:['döbrököz'],arr:'07:31',dep:'07:32'},
   {match:['dombóvár'],arr:'07:40'}
  ]},
  {id:'S40 4112',name:'S40 (Bp-Déli – Sárbogárd)',category:'S40',maxSpeedKmh:100,dir:1,stops:[
   {match:['déli'],dep:'06:15'},
   {match:['kelenföld'],arr:'06:21',dep:'06:22'},
   {match:['budafok'],arr:'06:27',dep:'06:28'},
   {match:['nagytétény','tétény'],arr:'06:34',dep:'06:35'},
   {match:['érd felső','érd'],arr:'06:40',dep:'06:41'},
   {match:['százhalombatta','batta'],arr:'06:48',dep:'06:49'},
   {match:['ercsi'],arr:'06:57',dep:'06:58'},
   {match:['iváncsa','ivancsa'],arr:'07:04',dep:'07:05'},
   {match:['pusztaszabolcs'],arr:'07:11',dep:'07:15'},
   {match:['szabadegyháza'],arr:'07:21',dep:'07:22'},
   {match:['sárosd'],arr:'07:28',dep:'07:29'},
   {match:['nagylók'],arr:'07:34',dep:'07:35'},
   {match:['sárbogárd'],arr:'07:42'}
  ]},
  {id:'IC 812',name:'Rippl-Rónai IC (Bp-Déli – Kaposvár)',category:'IC',maxSpeedKmh:120,dir:1,stops:[
   {match:['déli'],dep:'06:53'},
   {match:['kelenföld'],arr:'06:59',dep:'07:01'},
   {match:['pusztaszabolcs'],arr:'07:35',dep:'07:36'},
   {match:['sárbogárd'],arr:'07:59',dep:'08:00'},
   {match:['pincehely'],arr:'08:17',dep:'08:18'},
   {match:['dombóvár'],arr:'08:43',dep:'08:45'}
  ]},
  {id:'S40 4122',name:'S40 (Bp-Déli – Dombóvár)',category:'S40',maxSpeedKmh:100,dir:1,stops:[
   {match:['déli'],dep:'07:15'},
   {match:['kelenföld'],arr:'07:21',dep:'07:22'},
   {match:['budafok'],arr:'07:27',dep:'07:28'},
   {match:['nagytétény','tétény'],arr:'07:34',dep:'07:35'},
   {match:['érd felső','érd'],arr:'07:40',dep:'07:41'},
   {match:['százhalombatta','batta'],arr:'07:48',dep:'07:49'},
   {match:['ercsi'],arr:'07:57',dep:'07:58'},
   {match:['iváncsa','ivancsa'],arr:'08:04',dep:'08:05'},
   {match:['pusztaszabolcs'],arr:'08:11',dep:'08:15'},
   {match:['szabadegyháza'],arr:'08:21',dep:'08:22'},
   {match:['sárosd'],arr:'08:28',dep:'08:29'},
   {match:['nagylók'],arr:'08:34',dep:'08:35'},
   {match:['sárbogárd'],arr:'08:42',dep:'08:44'},
   {match:['rétszilas'],arr:'08:51',dep:'08:52'},
   {match:['cece'],arr:'08:57',dep:'08:58'},
   {match:['vajta'],arr:'09:03',dep:'09:04'},
   {match:['nagydorog'],arr:'09:11',dep:'09:12'},
   {match:['tengelic'],arr:'09:18',dep:'09:19'},
   {match:['pincehely'],arr:'09:31',dep:'09:32'},
   {match:['keszőhidegkút','gyönk'],arr:'09:39',dep:'09:40'},
   {match:['szakály','hőgyész'],arr:'09:53',dep:'09:54'},
   {match:['kurd'],arr:'10:02',dep:'10:03'},
   {match:['döbrököz'],arr:'10:10',dep:'10:11'},
   {match:['dombóvár'],arr:'10:19'}
  ]},
  {id:'IC 802',name:'Mecsek IC (Bp-Déli – Pécs)',category:'IC',maxSpeedKmh:120,dir:1,stops:[
   {match:['déli'],dep:'07:53'},
   {match:['kelenföld'],arr:'07:59',dep:'08:01'},
   {match:['pusztaszabolcs'],arr:'08:35',dep:'08:36'},
   {match:['sárbogárd'],arr:'08:59',dep:'09:00'},
   {match:['pincehely'],arr:'09:17',dep:'09:18'},
   {match:['dombóvár'],arr:'09:43',dep:'09:45'},
   {match:['sásd'],arr:'09:59',dep:'10:00'},
   {match:['szentlőrinc'],arr:'10:23',dep:'10:24'},
   {match:['pécs'],arr:'10:37'}
  ]},
  {id:'S40 4132',name:'S40 (Bp-Déli – Pusztaszabolcs)',category:'S40',maxSpeedKmh:100,dir:1,stops:[
   {match:['déli'],dep:'08:15'},
   {match:['kelenföld'],arr:'08:21',dep:'08:22'},
   {match:['budafok'],arr:'08:27',dep:'08:28'},
   {match:['nagytétény','tétény'],arr:'08:34',dep:'08:35'},
   {match:['érd felső','érd'],arr:'08:40',dep:'08:41'},
   {match:['százhalombatta','batta'],arr:'08:48',dep:'08:49'},
   {match:['ercsi'],arr:'08:57',dep:'08:58'},
   {match:['iváncsa','ivancsa'],arr:'09:04',dep:'09:05'},
   {match:['pusztaszabolcs'],arr:'09:11'}
  ]},
  {id:'IC 804',name:'Mecsek IC (Bp-Déli – Pécs)',category:'IC',maxSpeedKmh:120,dir:1,stops:[
   {match:['déli'],dep:'09:53'},
   {match:['kelenföld'],arr:'09:59',dep:'10:01'},
   {match:['pusztaszabolcs'],arr:'10:35',dep:'10:36'},
   {match:['sárbogárd'],arr:'10:59',dep:'11:00'},
   {match:['pincehely'],arr:'11:17',dep:'11:18'},
   {match:['dombóvár'],arr:'11:43',dep:'11:45'},
   {match:['pécs'],arr:'12:37'}
  ]},

  // --- PÁRATLAN IRÁNY (Pécs -> Dombóvár -> Sárbogárd -> Pusztaszabolcs -> Budapest, dir: -1) ---
  {id:'S40 4119',name:'S40 (Sárbogárd – Bp-Déli)',category:'S40',maxSpeedKmh:100,dir:-1,stops:[
   {match:['sárbogárd'],dep:'05:58'},
   {match:['nagylók'],arr:'06:05',dep:'06:06'},
   {match:['sárosd'],arr:'06:11',dep:'06:12'},
   {match:['szabadegyháza'],arr:'06:18',dep:'06:19'},
   {match:['pusztaszabolcs'],arr:'06:25',dep:'06:45'},
   {match:['iváncsa','ivancsa'],arr:'06:51',
