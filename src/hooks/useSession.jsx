import { createContext, useCallback, useContext, useMemo, useState } from "react";

/* ──────────────────────────────────────────────────────────────
 * useSession — 음성 주문 Session 전역 상태 (Context + Custom Hook)
 *
 * Backend WebSocket(/ws/voice) 및 REST(POST /sessions) 응답인
 * SessionResponse 를 한 곳에 보관한다. WS/REST 둘 다 응답 형식이
 * 동일하므로 applySessionResponse(json) 하나로 처리.
 *
 * SessionResponse 스키마 (backend/app/interface/dto/sessionResponse.py — 13필드)
 *   필드                  | 타입                     | 필수 | 설명
 *   --------------------- | ------------------------ | --- | ----------------------
 *   response_type         | ResponseType             |  O  | NORMAL / ERROR /
 *                                                            PAYMENT_SUCCESS /
 *                                                            PAYMENT_CANCEL / SESSION_END
 *   session_id            | str (UUID)               |  O  | 세션 식별자
 *   success               | bool                     |  O  | 처리 성공 여부
 *   message               | str | null               |  X  | TTS/UI 안내 문구
 *   fsm_state             | FSMState                 |  O  | INIT / ORDERING /
 *                                                            PAYMENT / COMPLETE
 *   order_type            | OrderType | null         |  X  | STORE / TAKEOUT
 *   order_item            | OrderItem | null         |  X  | 현재 작성 중 주문
 *                                                            (status 포함)
 *   current_menu          | MenusDetailResponse|null |  X  | 현재 주문 메뉴 상세
 *                                                            (옵션 렌더용, orderDetail
 *                                                             에서 GET /menus/{id} 대체 가능)
 *   cart                  | List<CartItem>           |  X  | 장바구니
 *   total_price           | int                      |  O  | 장바구니 총액 (결제 금액)
 *   recommendation_list   | List<int>                |  X  | 추천 메뉴 (1차 미사용)
 *   error_code            | str | null               |  X  | 오류 코드 (ERROR 시)
 *   session_end           | bool                     |  O  | 세션 종료 여부
 *
 * 사용 예
 *   // 1) 루트에 Provider
 *   import { SessionProvider } from "./hooks/useSession";
 *   <SessionProvider><App /></SessionProvider>
 *
 *   // 2) 컴포넌트에서 default export 사용
 *   import useSession from "../hooks/useSession";
 *   const { fsm_state, cart, applySessionResponse } = useSession();
 *
 * 노출 메서드
 *   applySessionResponse(json)  — SessionResponse 전체 반영
 *   setSessionId(id)            — session_id 만 직접 설정 (부트스트랩용)
 *   resetSession()              — 전체 초기 상태로
 * ────────────────────────────────────────────────────────────── */

const INITIAL_STATE = {
    session_id: null,
    response_type: null,
    success: false,
    message: null,
    fsm_state: "INIT",
    order_type: null,
    order_item: null,
    current_menu: null,       // MenusDetailResponse — orderDetail 렌더용
    cart: [],
    total_price: 0,           // 장바구니 총액 (결제 금액)
    recommendation_list: [],
    error_code: null,
    session_end: false,
    /* responseSeq — SessionResponse 수신 횟수.
     * 같은 fsm_state 가 연속 수신되어도 SessionRouter 등 구독자가
     * "새 응답 도착" 을 감지할 수 있게 하는 트리거. */
    responseSeq: 0,
};

const SessionContext = createContext(null);

export const SessionProvider = ({ children }) => {
    const [session, setSession] = useState(INITIAL_STATE);

    /* SessionResponse(JSON) → 상태 반영
     * 명세상 선택 필드(order_item, cart, recommendation_list, message,
     * error_code)는 누락 시 null/빈 배열로 reset 한다. (이전 응답 값이
     * 다음 응답에 잔존하지 않도록) */
    const applySessionResponse = useCallback((res) => {
        if (!res || typeof res !== "object") return;
        setSession((prev) => ({
            ...prev,
            response_type: res.response_type ?? prev.response_type,
            session_id: res.session_id ?? prev.session_id,
            success: res.success ?? prev.success,
            message: res.message ?? null,
            fsm_state: res.fsm_state ?? prev.fsm_state,
            order_type: res.order_type ?? null,
            order_item: res.order_item ?? null,
            current_menu: res.current_menu ?? null,
            cart: Array.isArray(res.cart) ? res.cart : [],
            total_price: typeof res.total_price === "number" ? res.total_price : 0,
            recommendation_list: Array.isArray(res.recommendation_list)
                ? res.recommendation_list
                : [],
            error_code: res.error_code ?? null,
            session_end: res.session_end ?? false,
            responseSeq: prev.responseSeq + 1,
        }));
    }, []);

    const setSessionId = useCallback((id) => {
        setSession((prev) => ({ ...prev, session_id: id }));
    }, []);

    /* order_type 만 로컬에서 먼저 저장 (main 에서 매장/포장 선택 시).
     * 세션 생성 API 는 order 페이지 mount 시점에 이 값으로 호출된다. */
    const setOrderType = useCallback((order_type) => {
        setSession((prev) => ({ ...prev, order_type }));
    }, []);

    const resetSession = useCallback(() => {
        setSession(INITIAL_STATE);
    }, []);

    const value = useMemo(
        () => ({
            ...session,
            applySessionResponse,
            setSessionId,
            setOrderType,
            resetSession,
        }),
        [session, applySessionResponse, setSessionId, setOrderType, resetSession]
    );

    return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};

export const useSession = () => {
    const context = useContext(SessionContext);
    if (!context) throw new Error("useSession을 사용하려면 SessionProvider로 감싸야 합니다");
    return context;
};

export default useSession;
