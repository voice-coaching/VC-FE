// Import candidate only. Map each set to actual DB course/step IDs before publication.
export const practiceExampleSets = {
  consonant: {
    label: "자음 구분",
    learningFocus: "PRONUNCIATION",
    examples: [
      {
        id: "consonant-1",
        text: "코끼리가 큰 강가를 천천히 걸어갑니다.",
        hint: "ㄱ·ㅋ·ㄲ의 세기를 구분해 읽어요.",
      },
      {
        id: "consonant-2",
        text: "토끼가 따뜻한 뜰에서 뛰어놀아요.",
        hint: "ㄷ·ㅌ·ㄸ의 공기 세기에 집중해요.",
      },
      {
        id: "consonant-3",
        text: "빨간 풍선을 품에 꼭 안았습니다.",
        hint: "ㅂ·ㅍ·ㅃ을 입술로 분명하게 구분해요.",
      },
      {
        id: "consonant-4",
        text: "새싹 사이로 시원한 바람이 스칩니다.",
        hint: "ㅅ과 ㅆ의 긴장도 차이를 느껴요.",
      },
      {
        id: "consonant-5",
        text: "주차장 쪽에서 친구를 기다렸습니다.",
        hint: "ㅈ·ㅊ·ㅉ을 짧고 또렷하게 읽어요.",
      },
    ],
  },
  vowel: {
    label: "모음 구분",
    learningFocus: "PRONUNCIATION",
    examples: [
      {
        id: "vowel-1",
        text: "아이는 어제 아버지와 언덕을 걸었습니다.",
        hint: "아와 어의 입 벌림 차이를 확인해요.",
      },
      {
        id: "vowel-2",
        text: "오후에 우리 모두 우체국에 모여요.",
        hint: "오와 우를 입술 모양으로 구분해요.",
      },
      {
        id: "vowel-3",
        text: "배 위에 베개와 세 개의 책을 놓았습니다.",
        hint: "애와 에를 천천히 이어 읽어요.",
      },
      {
        id: "vowel-4",
        text: "외로운 웨이터가 회색 외투를 입었습니다.",
        hint: "외와 웨 소리를 자연스럽게 연결해요.",
      },
      {
        id: "vowel-5",
        text: "의사는 희망의 의미를 이야기했습니다.",
        hint: "의가 놓인 위치에 따라 소리를 구분해요.",
      },
    ],
  },
  "final-consonant": {
    label: "받침 발음",
    learningFocus: "PRONUNCIATION",
    examples: [
      {
        id: "final-consonant-1",
        text: "따뜻한 국밥 한 그릇을 맛있게 먹었습니다.",
        hint: "받침 ㄱ과 ㅂ을 짧게 닫아 읽어요.",
      },
      {
        id: "final-consonant-2",
        text: "꽃밭 끝에 햇빛이 밝게 비칩니다.",
        hint: "받침 ㅊ·ㅌ·ㅅ이 대표음으로 나는 것을 익혀요.",
      },
      {
        id: "final-consonant-3",
        text: "산 너머 넓은 들판에 바람이 붑니다.",
        hint: "ㄴ·ㅁ·ㅇ 받침의 울림을 유지해요.",
      },
      {
        id: "final-consonant-4",
        text: "맑은 물결이 잔잔하게 흘러갑니다.",
        hint: "겹받침과 받침 ㄹ을 또렷하게 읽어요.",
      },
      {
        id: "final-consonant-5",
        text: "옷을 입고 밝은 아침길을 걸었습니다.",
        hint: "받침 뒤에 모음이 올 때 연음에 집중해요.",
      },
    ],
  },
  "tense-consonant": {
    label: "된소리 발음",
    learningFocus: "PRONUNCIATION",
    examples: [
      {
        id: "tense-consonant-1",
        text: "까치가 깨끗한 꽃가지를 물었습니다.",
        hint: "ㄱ과 ㄲ의 긴장도 차이를 느껴요.",
      },
      {
        id: "tense-consonant-2",
        text: "딸기가 든 따뜻한 떡을 나누었습니다.",
        hint: "ㄷ과 ㄸ을 혀끝으로 분명하게 구분해요.",
      },
      {
        id: "tense-consonant-3",
        text: "빵집에서 뽑은 번호표를 꼭 쥐었습니다.",
        hint: "ㅂ과 ㅃ을 입술의 긴장으로 구분해요.",
      },
      {
        id: "tense-consonant-4",
        text: "쌀쌀한 새벽에 쓰레기를 쓸었습니다.",
        hint: "ㅅ과 ㅆ의 마찰음 길이를 비교해요.",
      },
      {
        id: "tense-consonant-5",
        text: "작은 쪽지에 정확한 주소를 적었습니다.",
        hint: "ㅈ과 ㅉ을 힘 있게 구분해 읽어요.",
      },
    ],
  },
  "falling-intonation": {
    label: "평서문 억양",
    learningFocus: "INTONATION",
    examples: [
      {
        id: "falling-intonation-1",
        text: "오늘 회의는 세 시에 시작합니다.",
        hint: "마지막 음절의 높이를 자연스럽게 낮춰요.",
      },
      {
        id: "falling-intonation-2",
        text: "창밖에 가을비가 조용히 내리고 있습니다.",
        hint: "문장 끝으로 갈수록 속도와 높이를 낮춰요.",
      },
      {
        id: "falling-intonation-3",
        text: "준비한 자료는 책상 위에 놓았습니다.",
        hint: "정보 전달이 끝났다는 느낌으로 마무리해요.",
      },
      {
        id: "falling-intonation-4",
        text: "이번 주말에는 가족과 함께 여행을 갑니다.",
        hint: "마지막까지 힘을 유지한 뒤 부드럽게 내려요.",
      },
      {
        id: "falling-intonation-5",
        text: "새로운 안내 사항은 내일부터 적용됩니다.",
        hint: "끝을 끌지 않고 안정적으로 낮춰요.",
      },
    ],
  },
  "rising-intonation": {
    label: "의문문 억양",
    learningFocus: "INTONATION",
    examples: [
      {
        id: "rising-intonation-1",
        text: "오늘 저녁에 같이 산책할까요?",
        hint: "마지막 음절의 높이를 가볍게 올려요.",
      },
      {
        id: "rising-intonation-2",
        text: "이 서류를 여기 두면 될까요?",
        hint: "확인을 구하는 느낌이 들도록 끝을 올려요.",
      },
      {
        id: "rising-intonation-3",
        text: "주말에도 도서관이 문을 여나요?",
        hint: "질문의 핵심 뒤에서 억양을 자연스럽게 높여요.",
      },
      {
        id: "rising-intonation-4",
        text: "지금 바로 출발할 준비가 되었나요?",
        hint: "문장 전체는 안정적으로, 끝부분만 올려요.",
      },
      {
        id: "rising-intonation-5",
        text: "제가 다시 한번 설명해 드릴까요?",
        hint: "부드럽게 제안하는 질문의 억양을 익혀요.",
      },
    ],
  },
  "word-stress": {
    label: "강조 억양",
    learningFocus: "INTONATION",
    examples: [
      {
        id: "word-stress-1",
        text: "이번 발표는 제가 직접 준비했습니다.",
        hint: "누가 준비했는지 강조해요.",
        focus: "제가 직접",
      },
      {
        id: "word-stress-2",
        text: "약속 시간은 내일 오전 열 시입니다.",
        hint: "시간 정보를 조금 더 길고 높게 읽어요.",
        focus: "내일 오전 열 시",
      },
      {
        id: "word-stress-3",
        text: "가장 중요한 것은 안전입니다.",
        hint: "핵심 결론에 힘을 실어 읽어요.",
        focus: "안전",
      },
      {
        id: "word-stress-4",
        text: "이 자료는 팀 전체가 함께 확인해야 합니다.",
        hint: "참여 범위를 분명하게 강조해요.",
        focus: "팀 전체",
      },
      {
        id: "word-stress-5",
        text: "저는 결과보다 과정을 먼저 설명하겠습니다.",
        hint: "대조되는 핵심 단어를 또렷하게 읽어요.",
        focus: "결과보다 과정을",
      },
    ],
  },
} as const;
