import { useCallback } from "react";
import useSession, { takeStaleSessionId } from "./useSession";
import useSessionApi from "./useSessionApi";
import useWebSocket from "./useWebSocket";
import useCart from "./useCart";

/* ──────────────────────────────────────────────────────────────
 * useSessionCleanup — 세션 초기화 "단일 통로"
 *
 * 프론트 세션 정리(Context + sessionStorage)와 backend 세션 종료
 * API 호출을 한 함수로 통합한다. 세션을 끝내는 모든 지점은 이 훅만
 * 호출하면 된다:
 *
 *   cleanup("cancel")  — 비정상 이탈 (처음으로 / F5 / 도중 포기)
 *                        → backend POST /sessions/{sid}/cancel
 *   cleanup("expire")  — 정상 종료 (결제 완료 후 end 에서 복귀)
 *                        → backend DELETE /sessions/{sid}
 *   cleanup("none")    — backend 호출 없음 (SESSION_END 응답 수신 등
 *                        backend 가 이미 세션을 정리한 경우)
 *
 * 공통으로 항상 수행:
 *   disconnect()     — WS 연결 종료. 세션이 끝났으므로 음성 데이터가
 *                      더 이상 서버로 올라가면 안 된다. VoiceCapture 가
 *                      status 변화를 감지해 마이크 스트림도 정지시킨다.
 *                      (재연결은 main mount 의 connect() 가 담당)
 *   resetSession()   — useSession 상태 + SS session_id 백업 제거
 *   clearLastOrder() — 주문 스냅샷(SS lastOrder 백업) 제거
 *                      (opts.keepLastOrder=true 면 유지 — PAYMENT_SUCCESS
 *                       직후 end 페이지가 내역을 표시해야 하는 경우)
 *
 * sid 결정: Context session_id 우선, 없으면 full load 시
 * useSession 모듈이 보관해둔 staleSessionId (1회 소비).
 * 둘 다 없으면 backend 호출은 자연히 스킵 — 중복 종료 없음.
 *
 * backend 호출은 fire-and-forget: 실패해도 프론트 정리는 진행되고,
 * backend 는 180초 만료 타이머가 최종 안전망.
 * ────────────────────────────────────────────────────────────── */
const useSessionCleanup = () => {
    const { session_id, resetSession } = useSession();
    const { cancelSession, expireSession } = useSessionApi();
    const { disconnect } = useWebSocket();
    const { clearLastOrder } = useCart();

    const cleanup = useCallback(
        (mode = "cancel", { keepLastOrder = false } = {}) => {
            // "none" 은 backend 호출이 없으므로 staleSessionId 를 소비하지 않는다
            const sid =
                mode === "none" ? null : session_id || takeStaleSessionId();
            if (sid) {
                try {
                    if (mode === "cancel") cancelSession(sid); // fire-and-forget
                    else if (mode === "expire") expireSession(sid);
                    // mode === "none" → backend 호출 없음
                } catch {
                    /* ignore — 만료 타이머가 정리 */
                }
            }
            disconnect(); // WS 종료 → VoiceCapture 마이크 정지 (음성 송신 중단)
            resetSession();
            if (!keepLastOrder) clearLastOrder();
        },
        [session_id, cancelSession, expireSession, disconnect, resetSession, clearLastOrder]
    );

    return cleanup;
};

export default useSessionCleanup;
