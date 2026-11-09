const fs=require('fs');
const E=require('./engine.js');
const samples=JSON.parse(fs.readFileSync(__dirname+'/source-samples.json','utf8'));
const result=E.selfTests(samples);
for(const t of result.tests) console.log(`${t.ok?'PASS':'FAIL'}  ${t.name}`, t.ok?'':JSON.stringify(t.got||t.error));
if(!result.ok) process.exit(1);
