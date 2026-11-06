import fs from 'node:fs';
const rows=fs.readFileSync('report_output/_verification/unit-tests.log','utf8').split(/\r?\n/);
const failed=[];
for(let i=0;i<rows.length;i++) if(rows[i].startsWith('not ok ')){
 const end=rows.findIndex((x,n)=>n>i&&x.trim()==='...');
 const block=rows.slice(i,end===-1?i+25:end);
 const firstError=block.findIndex(l=>/^  error:/.test(l));
 failed.push({line:i+1,test:rows[i],location:block.find(x=>/^  location:/.test(x))?.trim(),error:block.slice(firstError,firstError+3).join('\n')});
}
fs.writeFileSync('report_output/_verification/failures.json',JSON.stringify(failed,null,2));
console.log(JSON.stringify(failed,null,2));
