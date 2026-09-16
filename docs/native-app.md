# SPEAK AI 네이티브 앱

이 저장소에는 Capacitor 8 기반 Android/iOS 프로젝트가 포함되어 있습니다.

## 구성

- 앱 ID: `site.voicecoaching.speakai`
- 앱 이름: `SPEAK AI`
- Android 최소 버전: API 24
- Android WebView: Chrome 111 이상
- iOS 최소 버전: iOS 15
- 앱 서버 기본값: `https://vc-fe.vercel.app`
- 마이크 권한: Android/iOS 모두 선언됨
- 화면 방향: 세로 고정

현재 Next.js 앱에는 서버 라우트와 동적 경로가 있으므로 정적 번들로 내보내지 않고, Capacitor WebView가 HTTPS 배포본을 불러옵니다. 네이티브 프로젝트를 동기화하기 전에 배포본이 먼저 최신 상태인지 확인해야 합니다. 다른 환경을 연결할 때는 `CAPACITOR_SERVER_URL`에 HTTPS 주소를 지정합니다.

## 자주 쓰는 명령

```bash
npm install
npm run native:sync
npm run native:assets
npm run native:doctor
```

Android Studio 열기:

```bash
npm run native:android
```

Xcode 열기:

```bash
npm run native:ios
```

앱 아이콘이나 스플래시 이미지를 바꿀 때는 `assets/logo.png`를 교체한 뒤 `npm run native:assets`와 `npm run native:sync`를 순서대로 실행합니다. 에셋 생성기는 상시 의존성으로 두지 않고 이 명령에서 일회성으로 실행됩니다.

## 배포 전 확인

1. Vercel 배포 주소와 OAuth 콜백 주소가 운영 환경으로 설정되어 있는지 확인합니다.
2. Android Studio에서 서명 키를 설정하고 AAB를 생성합니다.
3. Xcode에서 Apple Developer Team과 서명을 설정하고 Archive를 생성합니다.
4. 실제 기기에서 로그인, 마이크 권한, 5초 녹음, 재생을 확인합니다.

iOS 빌드에는 Xcode 26 이상과 Apple Developer 서명이 필요합니다. Android 빌드에는 Android SDK 36과 JDK 21이 필요합니다. Android 7~9 기기는 Play 스토어에서 Chrome/WebView를 최신 버전으로 업데이트해야 하며, 오래된 에뮬레이터의 고정 WebView로는 Next.js 16 번들이 실행되지 않습니다.
