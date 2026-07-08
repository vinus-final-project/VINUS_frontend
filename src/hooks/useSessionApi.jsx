import { useState } from "react";
import api from "../utils/api";

/* ──────────────────────────────────────────────────────────────
 * useSessionApi — Session REST API hook
 *
 * Endpoints (backend/app/routers/session.py 기준)
 *   POST   /sessions
 *     body:     { order_type: "STORE" | "TAKEOUT" }
 *     response: SessionResponse  (201 Created)
 *     비고:     단순 생성이 아니라 SELECT_ORDER_TYPE 이벤트를 EventExecutor
 *               경유로 처리한 SessionResponse 를 반환한다.
 *
 *   GET    /sessions/{session_id}
 *     response: SessionResponse  (200 OK)
 *     비고:     빈 이벤트로 현재 세션 상태를 재조회한다.
 *
 *   DELETE /sessions/{session_id}                   — EXPIRE_SESSION
 *     response: SessionResponse  (200 OK)
 *     용도:     결제 완료 후 정상 종료. backend 메모리에서 세션 제거.
 *
 *   POST   /sessions/{session_id}/cancel            — CANCEL_SESSION
 *     response: SessionResponse  (200 OK)
 *     용도:     사용자가 도중에 이탈/취소하는 비정상 종료.
 *
 * 사용 예
 *   const { createSession, getSession, expireSession, cancelSession } = useSessionApi();
 *   const res = await createSession("STORE");
 *   if (res) applySessionResponse(res);   // useSession 에 반영
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

    // 세션 정상 종료 (EXPIRE_SESSION) — 결제 완료 후 홈 복귀 시
    const expireSession = async (session_id) => {
        try {
            setIsLoading(true);
            const response = await api.delete(
                `/sessions/${encodeURIComponent(session_id)}`
            );
            if (response.status === 200) {
                return response.data;
            }
        } catch (error) {
            console.log(error);
            setError(error.response?.data.detail || "세션 종료에 실패했습니다.");
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    // 세션 취소 (CANCEL_SESSION) — 사용자 도중 이탈 시
    const cancelSession = async (session_id) => {
        try {
            setIsLoading(true);
            const response = await api.post(
                `/sessions/${encodeURIComponent(session_id)}/cancel`
            );
            if (response.status === 200) {
                return response.data;
            }
        } catch (error) {
            console.log(error);
            setError(error.response?.data.detail || "세션 취소에 실패했습니다.");
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
        expireSession,
        cancelSession,
    };
};

export default useSessionApi;
