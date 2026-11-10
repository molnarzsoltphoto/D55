#!/bin/sh
# 1) kiágazási menetrend a MÁV-füzetoldalakból (adatok/pdf) → JSON; 2) a JSON és a patch blokk beillesztése/frissítése az index.html végén.
python3 adatok/kiagazas_pdfbol.py || exit 1
node -e "
const fs=require('fs');let s=fs.readFileSync('index.html','utf8');
const put=(id,body)=>{const tag='<script id=\"'+id+'\">\n'+body+'\n</script>';const re=new RegExp('<script id=\"'+id+'\">[\\\\s\\\\S]*?</script>');if(re.test(s))s=s.replace(re,()=>tag);else{const i=s.lastIndexOf('</body>');s=s.slice(0,i)+tag+'\n'+s.slice(i);}};
put('kiagazas-menetrend','\"use strict\";globalThis.BRANCH_TIMETABLE='+fs.readFileSync('adatok/kiagazas-menetrend.json','utf8')+';');
put('v40-ketvaganyu-sor-kiagazas',fs.readFileSync('patch/v40-ketvaganyu-sor-kiagazas.js','utf8'));
fs.writeFileSync('index.html',s);console.log('index.html frissítve,', s.length, 'bájt');"
