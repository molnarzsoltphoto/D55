#!/bin/sh
# A patch/ könyvtár blokkját beilleszti (vagy frissíti) az index.html végén.
node -e "
const fs=require('fs');let s=fs.readFileSync('index.html','utf8');const js=fs.readFileSync('patch/v40-ketvaganyu-sor-kiagazas.js','utf8');
const tag='<script id=\"v40-ketvaganyu-sor-kiagazas\">\n'+js+'\n</script>';
if(s.includes('id=\"v40-ketvaganyu-sor-kiagazas\"')) s=s.replace(/<script id=\"v40-ketvaganyu-sor-kiagazas\">[\s\S]*?<\/script>/, ()=>tag);
else { const i=s.lastIndexOf('</body>'); s=s.slice(0,i)+tag+'\n'+s.slice(i); }
fs.writeFileSync('index.html',s);console.log('index.html frissítve,', s.length, 'bájt');"
