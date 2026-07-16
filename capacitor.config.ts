import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vinus.kiosk',
  appName: 'VINUS',
  webDir: 'dist',
  // API 가 https(api.voice-in-us.com)로 전환됨 — androidScheme 기본값(https)
  // 사용. https origin → https API 호출이라 mixed content/cleartext 불필요.
  // backend CORS 에는 "https://localhost" 가 등록되어 있어야 한다.
};

export default config;
