import axios from "axios";
import Swal from "sweetalert2";

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
            const method = (err.config?.method || "").toLowerCase();
            const url = err.config?.url || "";
            const status = err.response?.status;

            /* 무해한 실패는 조용히 넘김 (alert 스킵).
             *   ▸ DELETE /sessions/{sid} 의 404 — backend 가 결제 확정 처리에서
             *     이미 세션을 정리한 상태에서 프론트가 후행 정리 호출하는 정상 경로. */
            const isSessionExpire404 =
                method === "delete" &&
                status === 404 &&
                /^\/sessions\/[^/]+$/.test(url);

            if (!isSessionExpire404) {
                // 순환 import 방지: alertUtils(→api) 대신 Swal 직접 사용
                Swal.fire({
                    title: "[API 실패]",
                    html:
                        `<div style="text-align:left; font-family:monospace; font-size:12px;">` +
                        `url: ${err.config?.baseURL ?? ""}${url}<br/>` +
                        `code: ${err.code ?? ""}<br/>` +
                        `message: ${err.message ?? ""}<br/>` +
                        `status: ${status ?? "(no response)"}` +
                        `</div>`,
                    icon: "error",
                    confirmButtonColor: "#A8C8D8",
                    width: "330px",
                });
            }
        } catch { /* ignore */ }
        return Promise.reject(err);
    }
);

export const buildFileUrl = (filePath) => filePath;

export default api;
