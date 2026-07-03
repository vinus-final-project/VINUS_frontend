import axios from "axios";

/* .env 미로딩(예: vite dev 재시작 누락) 시에도 상대경로로 넘어가지 않도록
 * localhost:8000 을 명시적 fallback 으로 둔다. */
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// 개발 편의: 실제 어떤 값이 로드됐는지 콘솔로 즉시 확인
console.log("[api] baseURL =", API_BASE_URL);

const api = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
    headers: {
        "ngrok-skip-browser-warning": "true",
    },
});

export const buildFileUrl = (filePath) => filePath;

export default api;
