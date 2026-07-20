import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vinus.kiosk',
  appName: 'VINUS',
  webDir: 'dist',
  // API 가 https(api.voice-in-us.com)로 전환됨 — androidScheme 기본값(https)
  // 사용. https origin → https API 호출이라 mixed content/cleartext 불필요.
  // backend CORS 에는 "https://localhost" 가 등록되어 있어야 한다.
  server: {
    // 토스 결제 리다이렉트(토스→카드사 인증→successUrl)를 WebView 안에
    // 유지 — 없으면 외부 크롬으로 열려 결제 결과가 앱으로 못 돌아온다.
    // ⚠ 배포 전: 실결제 1회 완주하며 실제 거치는 도메인을 확인해
    //   ["*.tosspayments.com", ...] 목록 방식으로 좁힐 것 (보안 체크리스트)
    allowNavigation: ['*'],
  },
};

export default config;
