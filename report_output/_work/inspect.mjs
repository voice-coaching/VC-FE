import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
const root = process.cwd();
const [mode, ...args] = process.argv.slice(2);
const walk = (dir) => fs.readdirSync(dir, {withFileTypes:true}).flatMap(e => e.isDirectory() ? walk(path.join(dir,e.name)) : [path.join(dir,e.name)]);
if (mode === 'read') {
  for (let i=0; i<args.length;i+=2) {
    const p=args[i], ranges=args[i+1] || '1-10000';
    if(!fs.existsSync(p)){console.log('MISSING '+p);continue;}
    const lines=fs.readFileSync(p,'utf8').split(/\r?\n/);
    console.log('\nFILE '+p+' ('+lines.length+' lines)');
    for(const range of ranges.split(',')){ const [a,b]=range.split('-').map(Number); for(let n=a;n<=Math.min(b||a,lines.length);n++) console.log(n+': '+lines[n-1]); }
  }
} else if(mode === 'inventory') {
  const pkg=JSON.parse(fs.readFileSync('package.json','utf8')), lock=JSON.parse(fs.readFileSync('package-lock.json','utf8'));
  console.log('DEPENDENCIES');
  for(const n of ['next','react','react-dom','typescript','tailwindcss','@tailwindcss/postcss','@tanstack/react-query','recharts','tsx','playwright','@capacitor/core','@google-cloud/text-to-speech','@radix-ui/react-dialog','react-hook-form','zod']) console.log(n, (pkg.dependencies?.[n]||pkg.devDependencies?.[n]),lock.packages['node_modules/'+n]?.version);
  console.log('ROUTES');
  for(const f of walk('src/app').filter(p=>/page\.tsx$/.test(p))) console.log(f.replaceAll('\\','/'),fs.readFileSync(f,'utf8').split(/\r?\n/).filter(l=>/^import|export.*from|redirect\(|notFound\(/.test(l)).join(' '));
  console.log('TESTS',walk('scripts').concat(walk('src')).filter(p=>/\.test\.tsx?$/.test(p)).length);
  console.log('ENVIRONMENT NAMES ONLY');
  for(const f of ['.env.example']) if(fs.existsSync(f)) console.log(f,fs.readFileSync(f,'utf8').split(/\r?\n/).map(l=>l.match(/^([A-Z][A-Z0-9_]*)\s*=/)?.[1]).filter(Boolean).join(', '));
} else if(mode === 'baseline') {
 const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
 const snapshot={commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),files:Object.fromEntries(files.filter(f=>fs.existsSync(f)).map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')]))};
 fs.writeFileSync('report_output/_work/source-baseline.json',JSON.stringify(snapshot,null,2)); console.log('Baseline recorded',snapshot.commit,files.length);
} else if(mode === 'verify-baseline') {
 const snapshot=JSON.parse(fs.readFileSync('report_output/_work/source-baseline.json','utf8'));
 const changed=Object.entries(snapshot.files).filter(([f,h])=>!fs.existsSync(f)||crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')!==h).map(([f])=>f);
 console.log(JSON.stringify({trackedFiles:Object.keys(snapshot.files).length,changed},null,2));
}
