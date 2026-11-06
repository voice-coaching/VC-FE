import fs from 'node:fs';
import path from 'node:path';

const directory = 'report_output';
const names = [
  '01_기존보고서_검토표.md',
  '02_프론트엔드_보고서_본문.md',
  '03_Vercel_배포_보고서.md',
  '04_유저플로우.md',
  '05_프론트엔드_부록.md',
  '06_기술근거_매핑표.md',
  '07_캡처자료_목록.md',
  '08_검증필요_항목.md',
];
const documents = names.map(name => fs.readFileSync(path.join(directory, name), 'utf8').replace(/\r\n/g, '\n'));
const sections = documents.map(source => {
  const headings = [...source.matchAll(/^## (.+)$/gm)];
  return new Map(headings.map((heading, index) => [
    heading[1],
    source.slice(heading.index + heading[0].length, headings[index + 1]?.index ?? source.length).trim(),
  ]));
});
function get(document, prefix) {
  const matches = [...sections[document - 1]].filter(([title]) => title.startsWith(prefix));
  if (matches.length !== 1) throw new Error('Ambiguous section: ' + document + ' / ' + prefix);
  return matches[0][1].replace(/^\*\*삽입 안내[^\n]*\n*/gm, '').trim();
}
const sub = (title, body) => '### ' + title + '\n\n' + body;
const block = (anchor, title, body) => '<a id="' + anchor + '"></a>\n\n## ' + title + '\n\n' + body;
const join = parts => parts.join('\n\n');

const intro = [
  '# SpeakAI 프론트엔드 구현 통합보고서',
  '기준일: 2026-11-07 · 대상 저장소: VC-FE · 기준 커밋: `39d8b169f02387c6c8f120777520a5017c44e44b`.',
  '프론트엔드 구현, API 연동, 음성 녹음과 분석 결과 처리, 상태·캐시 관리, 기술적 문제 해결, Vercel 배포 구성 및 검증 내용을 하나의 문서로 통합하였다. 디자인 제작과 PPT 작업은 담당 범위에서 제외하였다. 본문과 상세 부록을 함께 수록하여 이 파일만으로 구현 내용과 검증 한계를 확인할 수 있도록 구성하였다.',
  '팀 통합 최종보고서 원본은 발견되지 않았다. 아래 1~8절과 부록 A~E는 이 프론트엔드 문서의 내부 번호이며, 팀 보고서의 실제 장 번호를 확정하거나 기존 1장을 수정한 것이 아니다. 본문·부록은 신규 추가안으로 작성하였고, 기존 문서의 정정 제안은 부록 E에 구분하였다.',
  '검증 요약: 기존 테스트 **388개 중 375개 통과·13개 실패**, 모의 API 계약 **90/90 및 토큰 갱신 재시도 통과**, **TypeScript 검사 통과**. 운영 API·DB·실제 배포·실결제 요청은 수행하지 않았다. 빌드·lint·브라우저 E2E는 미실행이며, 기존 소스와 설정은 변경하지 않았다.',
  '## 목차',
  [
    '- [1. 개발 환경 및 시스템 구성](#architecture)',
    '- [2. 주요 기능 구현](#features)',
    '- [3. API 연동 및 상태 관리](#integration)',
    '- [4. 성능 및 안정성 개선](#improvements)',
    '- [5. Vercel 배포 구성](#deployment)',
    '- [6. 사용자 흐름](#flow)',
    '- [7. 테스트 및 검증 결과](#verification)',
    '- [8. 구현 결과와 후속 과제](#followup)',
    '- [부록 A. 기술 스택과 디렉터리](#stack)',
    '- [부록 B. API 연동 명세](#api)',
    '- [부록 C. 기술근거 매핑표](#evidence)',
    '- [부록 D. 캡처자료 계획](#captures)',
    '- [부록 E. 기존 문서 검토와 취합 기준](#review)',
  ].join('\n'),
];

const improvementHistory = get(5, 'FE-G').replace(
  '각 사례의 보고서용 A~E 서술은 02 FE-D에 수록하였다. ',
  '',
);
const flowIntro = get(2, 'FE-F').replace(
  '각 화면의 세부 API와 실패·재시도 상태는 [04 유저 플로우](04_유저플로우.md)에 정리하였다.',
  '각 화면의 세부 API와 실패·재시도 상태는 아래 단계표에 정리하였다.',
);
const evidenceIntro = documents[5].slice(documents[5].indexOf('검증 수준의 의미는'), documents[5].indexOf('\n## 개발 환경')).trim();
const evidenceSections = [...sections[5]].filter(([title]) => title !== '기존 문서와 미확인 주장에 대한 근거');
const outputParts = [
  ...intro,
  block('architecture', '1. 개발 환경 및 시스템 구성', join([
    get(2, 'FE-A'),
    sub('시스템 데이터 흐름', get(4, '기술 구조도')),
    '기술별 적용 목적과 잠금 버전, 주요 디렉터리는 [부록 A](#stack)에 정리하였다.',
  ])),
  block('features', '2. 주요 기능 구현', get(2, 'FE-B')),
  block('integration', '3. API 연동 및 상태 관리', join([
    get(2, 'FE-C'),
    sub('문장 녹음 및 분석 API 시퀀스', get(4, '문장 녹음 및 분석 API 시퀀스')),
  ])),
  block('improvements', '4. 성능 및 안정성 개선', join([
    get(2, 'FE-D'),
    sub('변경 이력과 검증 근거', improvementHistory),
  ])),
  block('deployment', '5. Vercel 배포 구성', join([
    get(3, '보고서 삽입용 본문'),
    sub('확인된 구성과 운영 확인 대상', get(3, '확인된 구성')),
    sub('배포 단계별 확인 상태', get(3, '배포 단계별')),
    sub('배포 관련 문제 대응 근거', get(3, '배포 관련 문제')),
    sub('배포 구조도', get(3, '배포 구조도')),
    '대시보드 설정·성공 배포·실제 접속 자료는 아직 확보하지 않았다. 필요한 증빙과 캡션은 [부록 D](#captures)에 수록하였다.',
  ])),
  block('flow', '6. 사용자 흐름', join([
    flowIntro,
    sub('사용자 관점의 흐름도', get(4, '사용자 관점')),
    sub('화면별 사용자 동작과 상태 변화', get(4, '화면별')),
    sub('주요 예외와 복귀 동작', get(4, '주요 예외')),
    sub('직접 경로와 내부 화면의 구분', get(4, '직접 경로')),
  ])),
  block('verification', '7. 테스트 및 검증 결과', join([
    get(5, 'FE-H'),
    sub('실패 13건과 후속 확인', get(8, '실패 13건')),
  ])),
  block('followup', '8. 구현 결과와 후속 과제', join([
    get(2, 'FE-H'),
    sub('프론트엔드 실행 검증 과제', get(8, '프론트엔드 실행')),
    sub('실제 Vercel 환경 확인', get(8, '실제 Vercel')),
    sub('백엔드·AI 연동 확인', get(8, '백엔드·AI')),
  ])),
  block('stack', '부록 A. 기술 스택과 디렉터리', join([
    sub('기술 스택', get(5, 'FE-A')),
    sub('주요 디렉터리', get(5, 'FE-B')),
  ])),
  block('api', '부록 B. API 연동 명세', get(5, 'FE-D')),
  block('evidence', '부록 C. 기술근거 매핑표', join([
    '내부 검증용 근거이다. 경로는 저장소 루트 기준이며 코드 행 번호는 기준 커밋의 파일에 대응한다. E01~E46은 본문·표의 기술 설명과 연결된다.',
    evidenceIntro,
    ...evidenceSections.map(([title, body]) => sub(title, body)),
  ])),
  block('captures', '부록 D. 캡처자료 계획', join([
    '**전체 미촬영** 상태이다. 아래는 프론트엔드 구현 증빙을 위한 화면·배포 자료 계획이며, 디자인 제작이나 PPT 편집 지시가 아니다. 그림 번호 FE-01~FE-14는 최종 취합 시 재배정할 수 있다.',
    ...[...sections[6]].map(([title, body]) => sub(title, body)),
  ])),
  block('review', '부록 E. 기존 문서 검토와 취합 기준', join([
    '프로젝트 문서 검색에서 대학 통합 최종보고서로 식별할 수 있는 DOCX·HWP·HWPX·PDF를 찾지 못하였다. 발견한 두 화면 구현 보고서는 2026-09-21의 별도 기록이므로 팀 보고서의 원본으로 간주하지 않았다. 따라서 실제 2~8장의 제목·하위 목차·기존 문장과 기존 부록의 유지·수정·보완 여부는 원본 확인 필요이다. 원본 1장은 수정하지 않았다.',
    sub('발견한 문서 간 차이', get(1, '발견한 문서')),
    sub('기존 기술 설명의 유지 및 정정 제안', get(1, '기존 기술 설명')),
    sub('취합 기준', join([
      '본문 1~8절은 구현 설명·결과·한계의 서술형 자료이고, 부록 A~D는 상세 명세와 증빙이다. 팀 보고서에 반영할 때 실제 목차에 맞춰 장·절·그림 번호를 재배정하고 이미 작성된 내용과의 중복만 조정한다. 코드로 확인한 사실과 운영 미검증 상태는 그대로 유지한다.',
      '현재 산출물은 하나의 Markdown 파일이다. Mermaid 다이어그램은 편집 가능한 소스로 포함하였으며, 최종 편집 환경에서 렌더링·줄바꿈을 확인해야 한다. 서비스 화면 캡처나 운영 성공 증빙을 임의로 생성하지 않았다. API 구조와 환경변수 이름만 기재하고 비밀값·인증 토큰·개인 데이터는 수록하지 않았다.',
    ])),
  ])),
];

let output = join(outputParts);
const internalTargets = new Map([
  ['01_기존보고서_검토표.md', ['기존 문서 검토', 'review']],
  ['02_프론트엔드_보고서_본문.md', ['프론트엔드 구현 본문', 'architecture']],
  ['03_Vercel_배포_보고서.md', ['제5절 Vercel 배포 구성', 'deployment']],
  ['04_유저플로우.md', ['제6절 사용자 흐름', 'flow']],
  ['05_프론트엔드_부록.md', ['상세 부록', 'stack']],
  ['06_기술근거_매핑표.md', ['부록 C 기술근거 매핑표', 'evidence']],
  ['07_캡처자료_목록.md', ['부록 D 캡처자료 계획', 'captures']],
  ['08_검증필요_항목.md', ['제8절 후속 과제', 'followup']],
]);
output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (whole, label, target) => {
  const internal = internalTargets.get(target);
  if (internal) return '[' + internal[0] + '](#' + internal[1] + ')';
  if (target.startsWith('_verification/')) return '`report_output/' + target + '`';
  return whole;
});
const replacements = [
  ['02 FE-B', '제2절'], ['02 FE-D', '제4절'],
  ['05 FE-C', '제2절'], ['05 FE-D', '부록 B'], ['05 FE-G', '제4절'], ['05 FE-H', '제7절'],
  ['FE-D 부분 로딩', '제4절 부분 로딩'],
  ['04 시퀀스', '제3절 시퀀스'], ['03 확인된 구성 표 뒤', '제5절 구성 표 뒤'], ['03 배포 결과', '제5절 배포 구성'],
  ['06 근거 표', '부록 C 근거 표'], ['06의', '부록 C의'],
  ['07·08 후속 항목', '제8절·부록 D 후속 항목'],
  ['08에서', '제7절에서'], ['상세는 08', '상세는 아래 실패 분류'],
  ['아래 기술 시퀀스에서', '제3절의 기술 시퀀스에서'],
  ['Mermaid 소스는 03·04에 작성하였으며', 'Mermaid 소스는 제1·3·5·6절에 포함하였으며'],
  ['경로표는 04', '경로표는 제6절'],
  ['임시 FE-A~FE-H 구성', '이 문서의 본문·부록 구성'],
];
for (const [before, after] of replacements) output = output.replaceAll(before, after);
output = output.replace(/\n{3,}/g, '\n\n').trim() + '\n';
const target = path.join(directory, 'SpeakAI_프론트엔드_구현_통합보고서.md');
fs.writeFileSync(target, output, 'utf8');
const ids = [...output.matchAll(/<a id="([^"]+)"><\/a>/g)].map(match => match[1]);
const internalLinks = [...output.matchAll(/\]\(#([^)]+)\)/g)].map(match => match[1]);
const danglingLinks = internalLinks.filter(link => !ids.includes(link));
const oldFileLinks = [...output.matchAll(/\]\((0[1-8]_[^)]+\.md)\)/g)].map(match => match[1]);
const staleReferences = output.split('\n').filter(line => /(?:0[1-8]\s+FE-[A-H]|FE-[A-H]\b|0[1-8]의|0[1-8]에서)/.test(line));
const summary = {
  file: target,
  bytes: Buffer.byteLength(output),
  lines: output.split('\n').length,
  topLevelTitles: (output.match(/^# /gm) || []).length,
  mainSections: ids.length,
  evidenceRows: (output.match(/^\| E\d{2} \|/gm) || []).length,
  mermaidDiagrams: (output.match(/^```mermaid/gm) || []).length,
  danglingLinks,
  oldFileLinks,
  staleReferences,
};
fs.writeFileSync(path.join(directory, '_verification/consolidated-report-audit.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
if (danglingLinks.length || oldFileLinks.length || staleReferences.length) process.exitCode = 1;
