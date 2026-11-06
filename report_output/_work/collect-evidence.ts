import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { frontendBackendEndpoints } from '../../scripts/lib/backend-endpoints';
try {
 const inventory=frontendBackendEndpoints(process.cwd());
 writeFileSync('report_output/_verification/api-inventory.json',JSON.stringify(inventory,null,2));
 console.log('Static API call variants:',inventory.length);
} catch(error) {
 const message=error instanceof Error?error.message:String(error);
 writeFileSync('report_output/_verification/api-inventory-error.txt',message+'\n');
 console.log('Static API inventory incomplete:',message);
}
const changes:Record<string,string[]>={
 '6a0a766':['src/routes/home.tsx','src/routes/mypage.tsx','src/lib/catalog-pages.ts'],
 '3a992f4':['src/lib/api/client.ts','src/lib/course-materials.ts'],
 'f8c9534':['src/lib/api/client.ts'],
 'a67fd89':['src/lib/recording-upload.ts','src/lib/api/remote.ts'],
 '872b807':['src/lib/my-page-queries.ts','src/routes/mypage.tsx','src/lib/api/client.ts'],
 '2257fab':['src/lib/title-exam.ts','src/components/title-exam-session.tsx'],
 'e120716':['src/lib/canonical-score.ts'],
};
for(const [sha,files] of Object.entries(changes)){
 const output=execFileSync('git',['show','--format=','--unified=3',sha,'--',...files],{encoding:'utf8'});
 writeFileSync(`report_output/_verification/git-${sha}.diff`,output);
 console.log(sha, output.split('\n').length, 'diff lines');
}
