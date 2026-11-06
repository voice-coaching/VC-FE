import fs from 'node:fs';
import path from 'node:path';
const folder='report_output';
const files=fs.readdirSync(folder).filter(f=>f.endsWith('.md'));
const errors=[];
const references=[];
const defined=new Set();
const evidence=fs.readFileSync(path.join(folder,'06_기술근거_매핑표.md'),'utf8');
for(const match of evidence.matchAll(/^\| (E\d{2}) \|/gm)) defined.add(match[1]);
for(const file of files){
 const source=fs.readFileSync(path.join(folder,file),'utf8');
 let inFence=false, tableWidth=null;
 for(const [index,line] of source.split(/\r?\n/).entries()){
  if(line.startsWith('```')){inFence=!inFence;tableWidth=null;continue;}
  if(inFence) continue;
  if(line.startsWith('|')&&line.endsWith('|')){
   const cells=line.split(/(?<!\\)\|/).length-2;
   if(tableWidth!==null&&tableWidth!==cells) errors.push({file,error:'Inconsistent table cells',line:index+1,expected:tableWidth,actual:cells});
   tableWidth=cells;
  }else tableWidth=null;
 }
 if(source.includes('\uFFFD')) errors.push({file,error:'Replacement character'});
 if((source.match(/^```/gm)||[]).length%2) errors.push({file,error:'Unbalanced code fences'});
 for(const link of source.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)){
  const target=link[1].replace(/^<|>$/g,'');
  if(/^(?:https?:|#)/.test(target)) continue;
  const resolved=path.isAbsolute(target)?target:path.resolve(folder,target);
  if(!fs.existsSync(resolved)) errors.push({file,error:'Missing link',target});
 }
 for(const match of source.matchAll(/\bE\d{2}\b/g)){
  if(!defined.has(match[0])) errors.push({file,error:'Undefined evidence',id:match[0]});
 }
 for(const match of source.matchAll(/`((?:src|scripts|public|docs|node_modules)\/[^`\n]+|package(?:-lock)?\.json|next\.config\.ts|capacitor\.config\.ts):(\d+)-(\d+)`/g)){
  const [whole,filePath,start,end]=match;
  if(!fs.existsSync(filePath)){ errors.push({file,error:'Missing source',filePath});continue; }
  const count=fs.readFileSync(filePath,'utf8').split(/\r?\n/).length;
  if(+start<1||+end<+start||+end>count) errors.push({file,error:'Invalid line range',filePath,start:+start,end:+end,count});
  references.push({filePath,start:+start,end:+end});
 }
}
const result={documents:files.length,evidenceIds:defined.size,checkedLineReferences:references.length,errors};
fs.writeFileSync(path.join(folder,'_verification/report-audit.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
