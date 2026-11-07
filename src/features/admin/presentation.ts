import type { UserResource } from "./types";

/** Display names are separate from API values; operators never need database field names. */
export const adminLabels: Record<string, string> = {
  "/home": "홈",
  "/notifications": "알림",
  "/mypage": "마이페이지",
  ACTIVE: "이용 중",
  SUSPENDED: "이용 제한",
  WITHDRAWN: "탈퇴",
  USER: "일반 회원",
  ADMIN: "관리자",
  free: "무료",
  paid: "유료",
  admin: "시험 이용권",
  TEST: "시험 환경",
  LOCAL: "이메일 로그인",
  KAKAO: "카카오",
  GOOGLE: "구글",
  NAVER: "네이버",
  APPLE: "애플",
  DRAFT: "작성 중",
  PUBLISHED: "공개",
  HIDDEN: "숨김",
  RECEIVED: "접수",
  IN_PROGRESS: "처리 중",
  ANSWERED: "답변 완료",
  CLOSED: "종료",
  SENT: "발송 완료",
  GENERAL: "일반 안내",
  PLAN: "요금제 안내",
  ALL_ACTIVE: "이용 중인 전체 회원",
  SELECTED_USERS: "선택 회원",
  PRONUNCIATION: "발음",
  INTONATION: "억양",
  BOTH: "발음·억양",
  BEGINNER: "초급",
  INTERMEDIATE: "중급",
  ADVANCED: "고급",
  FINAL_CONSONANT: "받침",
  TENSE_CONSONANT: "된소리",
  CONSONANT: "자음",
  VOWEL: "모음",
  EXAMPLE_QUESTION: "예시 문장",
  TITLE_EXAM: "승급 심사",
  ANNOUNCER_PRACTICE: "아나운서 연습",
  SENTENCE: "문장",
  NEWS: "뉴스",
  ANNOUNCER: "아나운서",
  CLASS_PRACTICE: "클래스 문장",
  CUSTOM: "직접 작성",
  TRAINING_SESSIONS: "학습 기록",
  RECORDINGS: "녹음 내역",
  ANALYSES: "음성 평가",
  PAYMENTS: "결제 내역",
  CANCELLATIONS: "취소·환불",
  INQUIRIES: "문의",
  NOTIFICATIONS: "알림",
  COURSE_PROGRESS: "클래스 진도",
  TITLES: "현재 칭호",
  TITLE_EXAMS: "승급 심사",
  TITLE_EXAM_POLICY: "승급 시험 설정",
  TITLE_EXAM_POLICY_EDIT: "승급 시험 설정 변경",
  DIRECT_ANALYSES: "별도 음성 평가",
  COACHING_USAGE: "코칭 사용 내역",
  ONBOARDING: "학습 목표",
  SCRIPT_LIBRARY: "내 문장 보관함",
  NOTIFICATION_SETTINGS: "알림 설정",
  PROCESSING_CONSENTS: "정보 처리 동의",
  MEMBERSHIP_GRANTS: "시험 이용권 부여",
  PROFILE_IMAGES: "프로필 사진 내역",
  ANALYSIS_SEGMENTS: "구간별 평가",
  VOICE_ANALYSIS: "음성 평가",
  FACE_VIDEO_PROCESSING: "영상 처리",
  DELETE_PENDING: "삭제 대기",
  DELETED: "삭제 완료",
  MATCH: "일치",
  SUBSTITUTION: "다른 발음",
  OMISSION: "빠진 발음",
  ADDITION: "추가 발음",
  NORMAL: "양호",
  CAUTION: "주의",
  NEEDS_IMPROVEMENT: "연습 필요",
  PRIVATE_CONTENTS: "직접 작성한 문장",
  PENDING: "대기 중",
  RECORDING: "녹음 중",
  UPLOADING: "전송 중",
  ANALYZING: "평가 중",
  PROCESSING: "처리 중",
  COMPLETED: "완료",
  CANCELLED: "취소",
  CANCELED: "취소",
  FAILED: "실패",
  SUCCEEDED: "처리 완료",
  SUCCESS: "완료",
  UNKNOWN: "확인 중",
  PAID: "결제 완료",
  READY: "준비 완료",
  ACCEPT: "평가 가능",
  REJECT: "평가 불가",
  RESERVED: "접수 중",
  CONSUMED: "사용 완료",
  RELEASED: "반환 완료",
  PASS: "녹음 상태 양호",
  LOW_VOLUME: "녹음 소리가 작음",
  TOO_NOISY: "주변 소음이 큼",
  TOO_SHORT: "녹음이 짧음",
  NO_SPEECH: "말소리 없음",
  USER_ID: "회원 번호",
  ANALYSIS: "음성 평가",
  DIRECT_ANALYSIS: "별도 음성 평가",
  CONTENT: "학습 콘텐츠",
  NOTICE: "공지사항",
  INQUIRY: "문의",
  REFERENCE_AUDIO: "기준 음성",
  POPUP: "팝업",
  NOTIFICATION_CAMPAIGN: "알림 안내",
  CONTENT_CREATE: "학습 콘텐츠 등록",
  CONTENT_EDIT: "학습 콘텐츠 수정",
  CONTENT_PUBLICATION: "공개 상태 변경",
  CONTENT_DELETE: "학습 콘텐츠 삭제",
  NOTICE_CREATE: "공지 등록",
  NOTICE_EDIT: "공지 수정",
  NOTICE_DELETE: "공지 삭제",
  INQUIRY_ANSWER: "문의 답변",
  INQUIRY_STATUS: "문의 처리 변경",
  REFERENCE_AUDIO_REGISTER: "기준 음성 등록",
  REFERENCE_AUDIO_PRIMARY: "대표 음성 변경",
  REFERENCE_AUDIO_DELETE: "기준 음성 삭제",
  POPUP_CREATE: "팝업 등록",
  POPUP_EDIT: "팝업 수정",
  NOTIFICATION_CREATE: "알림 작성",
  NOTIFICATION_EDIT: "알림 초안 수정",
  NOTIFICATION_DELETE: "알림 초안 삭제",
  NOTIFICATION_DISPATCH: "알림 발송",
  USER_DELETE: "회원 및 업무 기록 삭제",
  ABSOLUTE_BEGINNER: "완전 초보",
  BEGINNER_SPEAKER: "초보 말하기",
  SPEAKING_BEGINNER: "말하기 입문",
  SPEAKING_INTERMEDIATE: "말하기 중급",
  SPEAKING_ADVANCED: "말하기 고급",
  SERVICE: "서비스 이용",
  TECHNICAL: "이용 오류",
  PAYMENT: "결제 문의",
  ACCOUNT: "계정 문의",
  OTHER: "기타",
};
export function displayLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return adminLabels[value] ?? (/[가-힣]/.test(value) ? value : "기타");
}
const columns: Record<string, string> = {
  currentLevel: "현재 학습 수준",
  goalText: "학습 목표",
  dailyGoalMinutes: "하루 목표 시간",
  weeklyGoalCount: "주간 목표 횟수",
  topicId: "보관함 분류 번호",
  reminderTime: "알림 시간",
  weekdays: "알림 요일",
  timezone: "시간대",
  scope: "동의 항목",
  policyRevision: "동의 약관 번호",
  grantedAt: "동의·부여일",
  revokedAt: "동의 철회일",
  activatedAt: "사용 시작일",
  cleanupAfter: "정리 예정일",
  sequenceNo: "구간 순서",
  startMs: "시작 시점",
  endMs: "종료 시점",
  matchType: "발음 비교",
  resultStatus: "평가 상태",
  errorType: "연습 항목",
  feedback: "평가 안내",
  memberDatabaseRecords: "회원 및 업무 기록",
  nickname: "회원 이름",
  profileImageUrl: "프로필 사진",
  email: "이메일",
  password: "로그인 정보",
  loginConnections: "로그인 연결",
  sessions: "로그인 상태",
  personalContents: "직접 작성한 문장",
  notifications: "알림 정보",
  uploadId: "업로드 번호",
  sizeBytes: "파일 크기",
  sha256: "파일 확인값",
  id: "내역 번호",
  userId: "회원 번호",
  contentId: "문장 번호",
  courseStepId: "학습 단계",
  courseId: "클래스 번호",
  sessionId: "학습 번호",
  recordingId: "녹음 번호",
  analysisId: "평가 번호",
  orderId: "주문 번호",
  attemptNo: "녹음 시도",
  mimeType: "파일 형식",
  fileSizeBytes: "파일 크기",
  durationMs: "녹음 길이",
  qualityStatus: "녹음 상태",
  status: "처리 상태",
  state: "처리 상태",
  learningFocus: "연습 분야",
  totalLearningSeconds: "학습 시간",
  failureCode: "실패 안내",
  requestId: "접수 번호",
  executionId: "처리 번호",
  resultEventId: "결과 번호",
  jobId: "평가 조회 번호",
  product: "이용권",
  amount: "결제 금액",
  currency: "통화",
  category: "분류",
  subject: "문의 제목",
  title: "제목",
  type: "안내 종류",
  rank: "칭호",
  targetRank: "심사 칭호",
  minimumTrainingCount: "필요 학습 횟수",
  lastStepId: "최근 학습 단계",
  progressPercent: "진도율",
  score: "심사 점수",
  overallScore: "종합 점수",
  pronunciationScore: "발음 점수",
  intonationScore: "억양 점수",
  contentType: "문장 종류",
  reason: "처리 사유",
  createdAt: "등록일",
  updatedAt: "최근 변경일",
  startedAt: "시작일",
  completedAt: "완료일",
  analyzedAt: "평가 완료일",
  requestedAt: "신청일",
  paidAt: "결제일",
  expiresAt: "종료일",
  startsAt: "시작일",
  readAt: "읽은 시각",
  answeredAt: "답변일",
  evaluatedAt: "심사일",
  linkedAt: "연결일",
  archivedAt: "보관일",
  deletedAt: "삭제일",
  enabled: "사용 여부",
  publishedAt: "최초 공개일",
  scriptText: "연습 원문",
  targetPronunciations: "집중 발음",
  estimatedSeconds: "예상 연습 시간",
  difficulty: "난이도",
  description: "짧은 소개",
  focus: "연습 분야",
  primary: "대표 음성",
  speakerName: "화자 이름",
  speakerType: "음성 종류",
  sections: "본문 구성",
  summary: "요약",
  body: "본문",
  pinned: "상단 고정",
  published: "공개 여부",
  audience: "안내 대상",
  kind: "안내 종류",
  userIds: "대상 회원",
  priority: "표시 순서",
  startsAtField: "표시 시작일",
  endsAt: "표시 종료일",
  durationDays: "표시 기간",
  deepLink: "이동 화면",
  sentCount: "전달 인원",
  referenceAudios: "기준 음성",
  ttsRevision: "자동 음성 변경 번호",
};
export function recordColumnLabel(key: string): string {
  return columns[key] ?? "추가 정보";
}
export function changedFieldLabels(value: string): string {
  return [
    ...new Set(value.split(",").map((k) => recordColumnLabel(k.trim()))),
  ].join(", ");
}
const enumFields = new Set([
  "status",
  "state",
  "qualityStatus",
  "rank",
  "targetRank",
  "learningFocus",
  "contentType",
  "type",
  "category",
  "currentLevel",
  "scope",
  "matchType",
  "resultStatus",
  "errorType",
]);
export function displayRecordValue(
  resource: UserResource,
  key: string,
  value: string | number | boolean | null,
): string {
  if (value === null || value === "") return "—";
  if (key === "failureCode") return "음성 평가를 완료하지 못했습니다";
  if (typeof value === "boolean") return value ? "예" : "아니요";
  if (key.endsWith("At")) {
    const date = new Date(String(value));
    return Number.isNaN(date.getTime())
      ? "시각 확인 필요"
      : date.toLocaleString("ko-KR");
  }
  if (key === "rank" || key === "targetRank")
    return (
      (
        {
          ABSOLUTE_BEGINNER: "왕초보",
          BEGINNER: "초보",
          LOCAL_ANNOUNCER: "동네 아나운서",
          ASPIRING_ANNOUNCER: "아나운서 지망생",
          ANNOUNCER: "아나운서",
        } as Record<string, string>
      )[String(value)] ?? "칭호 확인 필요"
    );
  if (enumFields.has(key)) return displayLabel(String(value));
  if (key === "product" && resource === "PAYMENTS")
    return value === "SPEAKAI_MONTHLY_TEST_V1"
      ? "월간 이용권 · 시험 결제"
      : "이용권";
  if (key === "currency") return value === "KRW" ? "원" : "기타 통화";
  if (key === "mimeType")
    return (
      (
        {
          "audio/mpeg": "MP3 음성",
          "audio/mp4": "M4A 음성",
          "audio/wav": "WAV 음성",
          "audio/webm": "웹 음성",
          "video/mp4": "MP4 영상",
        } as Record<string, string>
      )[String(value)] ?? "음성 파일"
    );
  if (key === "weekdays") {
    const days: Record<string, string> = {
      MONDAY: "월",
      TUESDAY: "화",
      WEDNESDAY: "수",
      THURSDAY: "목",
      FRIDAY: "금",
      SATURDAY: "토",
      SUNDAY: "일",
      MON: "월",
      TUE: "화",
      WED: "수",
      THU: "목",
      FRI: "금",
      SAT: "토",
      SUN: "일",
    };
    return String(value)
      .split(",")
      .map((day) => days[day.trim()] ?? "확인 필요")
      .join(", ");
  }
  if (key === "startMs" || key === "endMs") return `${Number(value) / 1000}초`;
  if (key === "dailyGoalMinutes") return `${value}분`;
  if (key === "weeklyGoalCount") return `${value}회`;
  if (key === "sizeBytes")
    return `${(Number(value) / 1024).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}KB`;
  if (key === "durationMs")
    return `${(Number(value) / 1000).toLocaleString("ko-KR")}초`;
  if (key === "fileSizeBytes")
    return `${(Number(value) / 1024).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}KB`;
  if (key === "totalLearningSeconds")
    return `${Number(value).toLocaleString("ko-KR")}초`;
  if (key === "progressPercent")
    return `${Number(value).toLocaleString("ko-KR")}%`;
  if (key === "amount") return Number(value).toLocaleString("ko-KR");
  return String(value);
}
