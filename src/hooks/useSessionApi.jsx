import { useState } from "react";
import api from "../utils/api";

/* ──────────────────────────────────────────────────────────────
 * useSessionApi — Session REST API hook
 *
 * Endpoints (backend/app/routers/session.py 기준)
 *   POST /sessions
 *     body:     { order_type: "STORE" | "TAKEOUT" }
 *     response: SessionResponse  (201 Created)
 *     비고:     단순 생성이 아니라 SELECT_ORDER_TYPE event 를 EventExecutor
 *               경유로 처리한 SessionResponse 를 반환한다.
 *
 *   GET /sessions/{session_id}
 *     response: SessionResponse  (200 OK)
 *     비고:     빈 이벤트로 현재 세션 상태를 재조회한다.
 *
 * 사용 예
 *   const { createSession, getSession, error } = useSessionApi();
 *   const res = await createSession("STORE");
 *   if (res) applySessionResponse(res);   // useSession 에 반영
 *
 * 노출 메서드
 *   createSession(order_type)  — 세션 생성
 *   getSession(session_id)     — 세션 조회
 * ────────────────────────────────────────────────────────────── */

const useSessionApi = () => {
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    // 세션 생성 (매장/포장 선택)
    const createSession = async (order_type) => {
        try {
            setIsLoading(true);
            const response = await api.post("/sessions", { order_type });
            // backend 가 201 Created 로 반환
            if (response.status === 200 || response.status === 201) {
                return response.data;
            }
        } catch (error) {
            console.log(error);
            setError(error.response?.data.detail || "세션 생성에 실패했습니다.");
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    // 세션 조회 (현재 상태 SessionResponse 재수신)
    const getSession = async (session_id) => {
        try {
            setIsLoading(true);
            const response = await api.get(`/sessions/${session_id}`);
            if (response.status === 200) {
                return response.data;
            }
        } catch (error) {
            console.log(error);
            setError(error.response?.data.detail || "세션 조회에 실패했습니다.");
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    return {
        error,
        setError,
        isLoading,
        createSession,
        getSession,
    };
};

export default useSessionApi;
