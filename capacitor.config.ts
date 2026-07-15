import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vinus.kiosk',
  appName: 'VINUS',
  webDir: 'dist',
  server: {
    // WebView origin 을 http://localhost 로 — 백엔드 CORS allow_origins 에
    // 이미 있는 origin 이라 백엔드 수정 불필요. https 기본값이면
    // ① CORS 미허용(https://localhost) ② http API 호출이 mixed content 로
    // 차단되는 문제가 생긴다. API 가 https 로 바뀌면 이 블록 제거.
    androidScheme: 'http',
    cleartext: true,
  },
};

export default config;
