"use strict";
(function(root){
 if(root.RailRandomTraffic)return;
 if(typeof Simulation==='undefined'||typeof AutomaticBlocks==='undefined')throw Error('A random-traffic.js a térközös engine.js és az app.js után töltendő be.');
 const baseTick=Simulation.prototype.tick,baseMove=AutomaticBlocks.prototype.move,baseClear=Simulation.prototype.clearSignal,baseNext=Simulation.prototype.next;
 let activeSim=null,renderWrapped=false,showWrapped=false,resetWrapped=false,kofiClickBound=false;
 const SPEEDS=[60,70,80,90,100];

 // Valós 2025/2026-os menetrendi adatok a 40a/40-es (Budapest–Pusztaszabolcs–Sárbogárd–Dombóvár–Pécs) vonalra
 const REAL_TIMETABLE=[
  {id:'IC 800',name:'Mecsek IC',category:'IC',maxSpeedKmh:120,dir:1,stops:[
   {match:['déli'],arr:null,dep:'05:53'},
   {match:['kelenföld'],arr:'05:59',dep:'06:01'},
   {match:['százhalombatta','batta'],arr:'06:21',dep:'06:21'},
   {match:['pusztaszabolcs'],arr:'06:36',dep:'06:37'},
   {match:['rétszilas'],arr:'06:53',dep:'06:53'},
   {match:['sárbogárd'],arr:'06:59',dep:'07:00'},
   {match:['pincehely'],arr:'07:17',dep:'07:18'},
   {match:['dombóvár'],arr:'07:43',dep:'07:45'},
   {match:['sásd'],arr:'07:59',dep:'08:00'},
   {match:['szentlőrinc'],arr:'08:23',dep:'08:24'},
   {match:['pécs'],arr:'08:37',dep:null}
  ]},
  {id:'IC 802',name:'Mecsek IC',category:'IC',maxSpeedKmh:120,dir:1,stops:[
   {match:['déli'],arr:null,dep:'07:53'},
   {match:['kelenföld'],arr:'07:59',dep:'08:01'},
   {match:['pusztaszabolcs'],arr:'08:36',dep:'08:37'},
   {match:['sárbogárd'],arr:'08:59',dep:'09:00'},
   {match:['pincehely'],arr:'09:17',dep:'09:18'},
   {match:['dombóvár'],arr:'09:43',dep:'09:45'},
   {match:['sásd'],arr:'09:59',dep:'10:00'},
   {match:['szentlőrinc'],arr:'10:23',dep:'10:24'},
   {match:['pécs'],arr:'10:37',dep:null}
  ]},
  {id:'IC 804',name:'Mecsek IC',category:'IC',maxSpeedKmh:120,dir:1,stops:[
   {match:['déli'],arr:null,dep:'09:53'},
   {match:['kelenföld'],arr:'09:59',dep:'10:01'},
   {match:['pusztaszabolcs'],arr:'10:36',dep:'10:37'},
   {match:['sárbogárd'],arr:'10:59',dep:'11:00'},
   {match:['pincehely'],arr:'11:17',dep:'11:18'},
   {match:['dombóvár'],arr:'11:43',dep:'11:45'},
   {match:['sásd'],arr:'11:59',dep:'12:00'},
   {match:['szentlőrinc'],arr:'12:23',dep:'12:24'},
   {match:['pécs'],arr:'12:37',dep:null}
  ]},
  {id:'IC 801',name:'Mecsek IC',category:'IC',maxSpeedKmh:120,dir:-1,stops:[
   {match:['pécs'],arr:null,dep:'05:14'},
   {match:['szentlőrinc'],arr:'05:26',dep:'05:27'},
   {match:['sásd'],arr:'05:50',dep:'05:51'},
   {match:['dombóvár'],arr:'06:05',dep:'06:07'},
   {match:['pincehely'],arr:'06:32',dep:'06:33'},
   {match:['sárbogárd'],arr:'06:51',dep:'06:52'},
   {match:['rétszilas'],arr:'06:58',dep:'06:58'},
   {match:['pusztaszabolcs'],arr:'07:14',dep:'07:15'},
   {match:['százhalombatta','batta'],arr:'07:30',dep:'07:30'},
   {match:['kelenföld'],arr:'07:51',dep:'07:53'},
   {match:['déli'],arr:'07:59',dep:null}
  ]},
  {id:'IC 807',name:'Mecsek IC',category:'IC',maxSpeedKmh:120,dir:-1,stops:[
   {match:['pécs'],arr:null,dep:'07:14'},
   {match:['szentlőrinc'],arr:'07:26',dep:'07:27'},
   {match:['sásd'],arr:'07:50',dep:'07:51'},
   {match:['dombóvár'],arr:'08:05',dep:'08:07'},
   {match:['pincehely'],arr:'08:32',dep:'08:33'},
   {match:['sárbogárd'],arr:'08:51',dep:'08:52'},
   {match:['pusztaszabolcs'],arr:'09:14',dep:'09:15'},
   {match:['kelenföld'],arr:'09:51',dep:'09:53'},
   {match:['déli'],arr:'09:59',dep:null}
  ]},
  {id:'IC 805',name:'Mecsek IC',category:'IC',maxSpeedKmh:120,dir:-1,stops:[
   {match:['pécs'],arr:null,dep:'09:14'},
   {match:['szentlőrinc'],arr:'09:26',dep:'09:27'},
   {match:['sásd'],arr:'09:50',dep:'09:51'},
   {match:['dombóvár'],arr:'10:05',dep:'10:07'},
   {match:['pincehely'],arr:'10:32',dep:'10:33'},
   {match:['sárbogárd'],arr:'10:51',dep:'10:52'},
   {match:['pusztaszabolcs'],arr:'11:14',dep:'11:15'},
   {match:['kelenföld'],arr:'11:51',dep:'11:53'},
   {match:['déli'],arr:'11:59',dep:null}
  ]},
  {id:'S40 4110',name:'S40 személy',category:'S40',maxSpeedKmh:100,dir:1,stops:[
   {match:['déli'],arr:null,dep:'05:15'},
   {match:['kelenföld'],arr:'05:21',dep:'05:22'},
   {match:['budafok'],arr:'05:27',dep:'05:28'},
   {match:['nagytétény','tétény'],arr:'05:34',dep:'05:35'},
   {match:['érd felső','érd'],arr:'05:40',dep:'05:41'},
   {match:['százhalombatta','batta'],arr:'05:48',dep:'05:49'},
   {match:['ercsi'],arr:'05:57',dep:'05:58'},
   {match:['ivancsa','iváncsa'],arr:'06:04',dep:'06:05'},
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
   {match:['szekszárd','pincehely'],arr:'07:25',dep:'07:26'},
   {match:['dombóvár'],arr:'07:55',dep:null}
  ]},
  {id:'S40 4112',name:'S40 személy',category:'S40',maxSpeedKmh:100,dir:1,stops:[
   {match:['déli'],arr:null,dep:'06:15'},
   {match:['kelenföld'],arr:'06:21',dep:'06:22'},
   {match:['budafok'],arr:'06:27',dep:'06:28'},
   {match:['nagytétény','tétény'],arr:'06:34',dep:'06:35'},
   {match:['érd felső','érd'],arr:'06:40',dep:'06:41'},
   {match:['százhalombatta','batta'],arr:'06:48',dep:'06:49'},
   {match:['ercsi'],arr:'06:57',dep:'06:58'},
   {match:['ivancsa','iváncsa'],arr:'07:04',dep:'07:05'},
   {match:['pusztaszabolcs'],arr:'07:11',dep:'07:15'},
   {match:['szabadegyháza'],arr:'07:21',dep:'07:22'},
   {match:['sárosd'],arr:'07:28',dep:'07:29'},
   {match:['nagylók'],arr:'07:34',dep:'07:35'},
   {match:['sárbogárd'],arr:'07:42',dep:'07:45'},
   {match:['rétszilas'],arr:'07:52',dep:'07:53'},
