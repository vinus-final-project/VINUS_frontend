import axios from "axios";

/* .env 미로딩(예: vite dev 재시작 누락) 시에도 상대경로로 넘어가지 않도록
 * localhost:8000 을 명시적 fallback 으로 둔다. */
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://api.voice-in-us.com";

// 개발 편의: 실제 어떤 값이 로드됐는지 콘솔로 즉시 확인
console.log("[api] baseURL =", API_BASE_URL);

const api = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
    headers: {
        "ngrok-skip-browser-warning": "true",
    },
});

/* ⚠ TEMP DEBUG — APK 메뉴 미표시 원인 추적용. 원인 확인 후 반드시 제거!
 * adb 없이 실기기에서 실패 원인을 보기 위해 API 실패를 alert 로 표시 */
api.interceptors.response.use(
    (res) => res,
    (err) => {
        try {
            alert(
                `[API 실패]\nurl: ${err.config?.baseURL}${err.config?.url}\n` +
                `code: ${err.code}\nmessage: ${err.message}\n` +
                `status: ${err.response?.status ?? "(no response)"}`
            );
        } catch { /* ignore */ }
        return Promise.reject(err);
    }
);

export const buildFileUrl = (filePath) => filePath;

export default api;
