import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import useCart from "../hooks/useCart";
import useSession from "../hooks/useSession";
import useWebSocket from "../hooks/useWebSocket";
import resolveRoute from "../utils/fsmRoute";

/* ──────────────────────────────────────────────────────────────
 * SessionRouter — SessionResponse 기반 전역 라우팅 감시자
 *
 * RootLayout(라우터 내부)에 <SessionRouter /> 로 배치한다.
 * 화면에 아무것도 렌더하지 않는다 (return null).
 *
 * 동작 (responseSeq 가 바뀔 때만 = 새 SessionResponse 수신 시만):
 *   1) 라우팅            — resolveRoute() 결과로 navigate
 *   2) session_end 처리  — WS disconnect + 상태 초기화
 *
 * ※ cart 는 useCart 가 useSession.cart 의 파생 selector 로 항상 최신을
 *   반영하므로 여기서 별도 동기화 로직 필요 없음.
 *
 * 사용자가 화면을 터치로 자유롭게 이동하는 것은 간섭하지 않는다.
 * (fsm_state 값 자체가 아니라 "새 응답 도착" 시에만 반응하므로)
 * ────────────────────────────────────────────────────────────── */
export default function SessionRouter() {
    const session = useSession();
    const { disconnect } = useWebSocket();
    const { placeOrder } = useCart();
    const navigate = useNavigate();
    const location = useLocation();

    // 이미 처리한 응답 seq (재렌더로 인한 중복 처리 방지)
    const handledSeqRef = useRef(0);

    useEffect(() => {
        const {
            responseSeq,
            response_type,
            fsm_state,
            order_item,
            cart,
            session_end,
            lastSource,
            resetSession,
        } = session;

        // 새 SessionResponse 가 아닐 때(초기 렌더 포함)는 무시
        if (responseSeq === 0 || responseSeq === handledSeqRef.current) return;
        handledSeqRef.current = responseSeq;

        // (1) 라우팅 — source 별 강도 차등 (fsmRoute.js 주석 참조)
        //     voice: fsm_state/order_item 기반 강제 라우팅
        //     rest : response_type 전이만
        const next = resolveRoute({
            response_type,
            fsm_state,
            order_item,
            cart,
            source: lastSource,
        });
        if (next && next !== location.pathname) {
            navigate(next);
        }

        // (2) 세션 종료
        if (session_end) {
            // 결제 완료 응답에는 결제된 cart 가 그대로 담겨 있다 (backend 가
            // 세션 삭제 전에 조립). 리셋 전에 lastOrder 스냅샷으로 보존해
            // end 페이지 내역이 비는 레이스를 방지한다.
            if (response_type === "PAYMENT_SUCCESS") {
                placeOrder();
            }
            disconnect();
            resetSession();
        }
        // location.pathname 은 의존성에서 제외 — 사용자의 터치 이동에는 반응하지 않는다.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session.responseSeq]);

    return null;
}
