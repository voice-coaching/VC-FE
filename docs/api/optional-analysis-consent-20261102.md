# 선택적 음성 처리 동의 capability 연결

## 원인

2026-11-02 06:30 UTC의 공개 Backend `GET /api/analysis-capabilities`는 HTTP 200과
다음 정책 값을 반환했다.

```json
{
  "voiceProcessingConsentRequired": false,
  "videoProcessingConsentRequired": false,
  "consentPolicyRevision": null,
  "videoProcessingConsentPolicyRevision": null
}
```

프론트는 flag와 무관하게 consentPolicyRevision을 요구했고, null이면
`음성 처리 동의 정책 정보를 불러오지 못했습니다.`를 던졌다. 공통 녹음 흐름은
업로드·음질 확인·녹음 선택 뒤 이 검사에서 중단돼 분석 요청 POST를 보내지 못했다.
입술 연습의 음성 분석에도 같은 무조건 검사가 있었다.

Backend main 소스의 TrainingAnalysisController는 analyze/retry 모두
`@RequestBody(required=false)`를 사용하며 null 요청을 application으로 전달한다.
현재 정책에서 null revision은 서버 장애 응답이 아니다. 이 문서는 Backend의 실제
배포 SHA나 이번 수정 후 추론 성공을 확인했다는 의미가 아니다.

## 변경

- `voiceProcessingConsentInput`이 voiceProcessingConsentRequired가 명시적으로
  false이면 undefined를 반환한다. accepted나 policyRevision을 임의로 만들지 않는다.
- required가 true인 경로는 기존대로 실제 revision을 확인하고 동의 입력을 보낸다.
  정책이 필요한데 revision이 없거나 공백이면 기존 오류로 중단한다.
- 일반 문장·뉴스·아나운서·내 문장·클래스·기존 세션·시험의 공통 분석 요청과 retry,
  입술 연습의 음성 분석이 같은 함수를 사용한다.
- API 타입과 canonical client의 consent 인수를 선택적으로 바꾼다. HTTP client는
  body가 undefined이면 본문을 생략하므로 Backend의 선택적 body 계약과 일치한다.
- videoProcessingConsentPolicyRevision 타입도 서버 계약에 맞게 string|null로 보정한다.
- capability cache key를 `analysis-capabilities:mime-ranges-optional-consent-v3`로 바꿔
  이전 30분 cache의 필수 정책 값을 재사용하지 않는다. 기존 MIME wildcard 처리는 유지한다.

Backend·AI 서버 코드, 로그인·소유 관계·분석 identity·결과 계약은 변경하지 않는다.

## 확인 범위

현재 capability 응답, Backend controller/application 소스, HTTP 본문 직렬화,
변경된 타입·호출부와 Git diff만 정적으로 확인했다. 테스트·컴파일·브라우저 자동화·
실제 녹음·업로드·분석 POST·AI/GPT 생성은 실행하지 않았다.
개발자는 required=false/null의 최초 요청·retry, required=true의 revision 유무,
입술 연습 및 이전 capability cache가 남은 계정을 직접 확인한다. 배포는 별도다.
