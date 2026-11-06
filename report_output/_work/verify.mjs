import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const walk = dir => fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
fs.mkdirSync('report_output/_verification',{recursive:true});
const tests=walk('scripts').concat(walk('src')).filter(p=>/\.test\.tsx?$/.test(p)).sort();
const guard='./report_output/_work/offline-guard.mjs';
const jobs=[
 ['unit-tests',['--import',guard,'--import','tsx','--test','--test-reporter=tap',...tests]],
 ['api-contract',['--import',guard,'--import','tsx','scripts/verify-api-contract.ts']],
 ['typecheck',['node_modules/typescript/bin/tsc','--noEmit','--incremental','false']],
];
const results=[];
for(const [name,args] of jobs){
 const start=Date.now(); const result=spawnSync(process.execPath,args,{encoding:'utf8',timeout:180000,maxBuffer:20*1024*1024,windowsHide:true});
 const output=(result.stdout||'')+(result.stderr||'');
 fs.writeFileSync(`report_output/_verification/${name}.log`,output);
 const summary={name,command:['node',...args],exitCode:result.status,signal:result.signal,error:result.error?.message,elapsedMs:Date.now()-start,testFiles:name==='unit-tests'?tests.length:undefined,summary:output.split(/\r?\n/).filter(l=>/^# (tests|suites|pass|fail|cancelled|skipped|todo|duration_ms)|^not ok |API contract/.test(l))};
 results.push(summary); console.log(JSON.stringify(summary));
}
fs.writeFileSync('report_output/_verification/results.json',JSON.stringify(results,null,2));
