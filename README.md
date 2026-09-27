# VINUS Frontend

시각장애인 등 교통약자를 위한 **음성 인식 무인 주문 키오스크** VINUS의 프론트엔드입니다.
터치 조작과 음성 대화(STT/TTS)를 함께 지원하여, 화면을 보기 어려운 사용자도 카페 메뉴를 주문하고 결제할 수 있도록 설계되었습니다.

React + Vite로 개발된 웹 앱을 [Capacitor](https://capacitorjs.com/)로 감싸 안드로이드 키오스크 단말(APK)에 배포합니다.

## 주요 기능

- **음성 주문**: 마이크로 발화를 캡처해 백엔드로 스트리밍하고, 인식 결과(FSM 상태)에 따라 화면이 자동으로 전환됩니다.
- **음성 안내(TTS)**: 화면 진입/응답 시점마다 음성으로 다음 행동을 안내합니다.
- **터치 주문 병행**: 매장/포장 선택, 메뉴 탐색, 옵션 선택, 장바구니, 결제까지 터치만으로도 동일하게 진행할 수 있습니다.
- **결제**: [토스페이먼츠](https://docs.tosspayments.com/) SDK를 이용한 카드 결제 및 결제 성공/실패 리다이렉트 처리.
- **영수증 출력**: USB(OTG) ESC/POS 프린터로 영수증을 인쇄합니다(한글 인쇄를 위해 Canvas 이미지로 변환 후 출력).
- **접근성 배려**: 화면을 더듬으며 조작하는 사용자를 고려한 롱프레스(hold) 기반 인터랙션, 무응답 시 자동 진행(타임아웃) 등.
- **키오스크 하드닝**: 뒤로가기 무효화, 새로고침/직접 URL 진입 시 시작 화면으로 강제 복귀 등 키오스크 환경에 맞춘 라우팅 가드.

## 기술 스택

| 분류 | 사용 기술 |
| --- | --- |
| 프레임워크 | React 19, React Router 7, Vite |
| 네이티브 패키징 | Capacitor 8 (Android) |
| 통신 | Axios(REST), WebSocket(음성 스트리밍) |
| 결제 | @tosspayments/tosspayments-sdk |
| 하드웨어 연동 | @atomsolution/usb-printer-capacitor(영수증 프린터), @capacitor-community/text-to-speech |
| UI | react-icons, sweetalert2, wanted-sans |
| 언어/도구 | TypeScript(설정), ESLint |

## 폴더 구조

```
src/
├─ api/            # 도메인별 REST API 훅 (세션, 메뉴, 장바구니, 주문, 결제)
├─ components/      # 전역 상주 컴포넌트 (음성 캡처, TTS 재생, 세션 라우팅 등) 및 모달
├─ hooks/           # 세션/웹소켓/카트/프린터/마이크/TTS 등 커스텀 훅 (Context)
├─ pages/           # 라우트별 화면 (start, main, order, orderDetail, cart, payment, pay, receipt, end, fail)
├─ utils/           # FSM 라우팅, 결제, 영수증 텍스트/이미지, 포맷팅 등 순수 유틸
├─ styles/          # 디자인 토큰(CSS 변수)
├─ app.jsx          # 라우터 정의 및 Provider 구성, 키오스크 가드(BootRedirect/BackBlock)
└─ main.jsx         # 엔트리 포인트
android/             # Capacitor Android 네이티브 프로젝트
```

## 아키텍처 개요

- **세션(useSession)**: 백엔드가 내려주는 `SessionResponse`(WS/REST 공통 포맷)를 전역 상태로 보관합니다. 토스 결제 리다이렉트는 브라우저 풀 리로드를 유발하므로, `session_id`/`order_type`을 `sessionStorage`에 백업했다가 복구합니다.
- **웹소켓(useWebSocket)**: `${VITE_WS_URL}/ws/voice`에 연결해 음성 스트림(JSON 메타데이터 + PCM 바이너리)을 전송하고, 서버가 보내는 `SessionResponse`(JSON)를 수신합니다. VAD(음성 구간 감지)는 백엔드에서 수행합니다.
- **FSM 라우팅(utils/fsmRoute.js)**: 응답의 `response_type`/`fsm_state`/출처(`voice` 또는 `rest`)에 따라 다음 페이지를 결정하는 순수 함수입니다. 터치(REST) 흐름은 이미 사용자가 보고 있는 화면을 존중해 강제 라우팅하지 않고, 음성(WS) 흐름은 인식 결과에 맞춰 화면을 강제 전환합니다.
- **키오스크 가드(app.jsx)**: `BootRedirect`(새로고침/직접 URL 진입 시 시작 화면 강제 이동), `BackBlock`(브라우저/안드로이드 뒤로가기 무효화)로 키오스크가 버튼/음성으로만 조작되도록 강제합니다.

## 시작하기

### 요구 사항

- Node.js 18 이상
- (APK 빌드 시) Android Studio, JDK

### 설치

```bash
npm install
```

### 환경 변수

프로젝트 루트에 `.env` 파일을 생성하고 아래 값을 채워주세요.

| 변수 | 설명 | 기본값 |
| --- | --- | --- |
| `VITE_API_URL` | 백엔드 REST API 베이스 URL | `http://api.voice-in-us.com` |
| `VITE_WS_URL` | 백엔드 WebSocket 베이스 URL | `ws://localhost:8000` |
| `VITE_TOSS_CLIENT_KEY` | 토스페이먼츠 클라이언트 키(공개 키) | 없음(필수) |

### 개발 서버 실행

```bash
npm run dev
```

### 빌드 / 미리보기

```bash
npm run build
npm run preview
```

### Android(Capacitor) 빌드

```bash
# 웹 빌드 후 네이티브 프로젝트에 동기화
npm run cap:sync

# 웹 빌드 + 동기화 + Android Studio에서 열기
npm run cap:android

# 런처 아이콘 생성 (src/assets/VINUS_app.png 기준)
npm run cap:icons
```

USB 영수증 프린터를 사용하려면 `android/build.gradle`에 JitPack 저장소가 등록되어 있어야 하며, 매번 USB 권한 팝업이 뜨는 것을 막으려면 `AndroidManifest.xml`에 프린터의 VID/PID로 USB device filter를 등록해야 합니다.

## 스크립트

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 실행 |
| `npm run build` | 프로덕션 빌드 |
| `npm run preview` | 빌드 결과 미리보기 |
| `npm run cap:sync` | 빌드 후 Capacitor 네이티브 프로젝트 동기화 |
| `npm run cap:android` | 빌드 + 동기화 + Android Studio 실행 |
| `npm run cap:icons` | 앱 아이콘 리소스 생성 |
