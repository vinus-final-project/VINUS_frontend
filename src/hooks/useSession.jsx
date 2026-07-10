import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { MAIN_TIME_LIMIT_SEC } from "../constants";

/*  session_id sessionStorage 백업 키.
 *  Toss 결제창 successUrl/failUrl 리다이렉트는 브라우저 페이지 전체 리로드라
 *  React Context 가 초기화된다. 결제 성공 후 backend cart 조회 등을 다시
 *  하려면 session_id 가 필요하므로 SS 에 백업한다.
 *  sessionStorage 이유: 탭/앱 세션 종료 시 자동 삭제 → 다음 손님 노출 방지. */
const SS_SID_KEY = "vinus.session.session_id";
const readSSString = (key) => {
    try {
        const raw = sessionStorage.getItem(key);
        return typeof raw === "string" && raw.length > 0 ? raw : null;
    } catch {
        return null;
    }
};

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
    // Toss 리로드 대응 — SS 백업이 있으면 그 값으로 시작
    session_id: readSSString(SS_SID_KEY),
    /*  주문 흐름(order/orderDetail/cart) 공유 카운트다운 데드라인 (ms).
     *  session_id 가 처음 세팅되는 시점(=order 페이지에서 세션 생성 완료)
     *  에 Date.now() + MAIN_TIME_LIMIT_SEC*1000 로 세팅. resetSession 시 null. */
    countdown_deadline_at: null,
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
    /* lastSource — 마지막 SessionResponse 의 출처.
     *   "rest"  : 터치 REST 응답 → 사용자가 이미 해당 화면에 있으므로
     *             response_type 전이 외 강제 라우팅 없음
     *   "voice" : WS 음성 응답  → fsm_state/order_item 기반으로
     *             화면을 따라가게 강제 라우팅 (SessionRouter)          */
    lastSource: null,
};

const SessionContext = createContext(null);

export const SessionProvider = ({ children }) => {
    const [session, setSession] = useState(INITIAL_STATE);

    /* SessionResponse(JSON) → 상태 반영
     *
     * ⚠ undefined 와 null 을 구분한다.
     *    - 응답에 **필드 자체가 없음(undefined)** → 이전 값 유지
     *    - 응답에 **명시적으로 null** → null 로 세팅 (실제 초기화)
     *    - 그 외 값                    → 그 값으로 갱신
     *
     *    예: /orders/option 응답에 order_item 필드가 빠져 있어도 로컬
     *        order_item 을 지우지 않도록. (backend가 필드 생략과 명시적
     *        null 을 구분해서 보내는 걸 신뢰)                              */
    const applySessionResponse = useCallback((res, source = "rest") => {
        if (!res || typeof res !== "object") return;

        // 디버그: SessionResponse 핵심 3필드 (라우팅 판정 근거)
        console.log(res);

        const merge = (key, prevVal) =>
            res[key] === undefined ? prevVal : res[key];

        setSession((prev) => {
            const nextSessionId = merge("session_id", prev.session_id);
            /*  세션이 새로 시작될 때(이전엔 null, 이번엔 값이 새로 옴)에만
             *  공유 카운트다운 데드라인을 세팅. 그 외엔 유지.                     */
            const nextDeadline =
                !prev.session_id && nextSessionId
                    ? Date.now() + MAIN_TIME_LIMIT_SEC * 1000
                    : prev.countdown_deadline_at;

            return {
                ...prev,
                response_type: merge("response_type", prev.response_type),
                session_id: nextSessionId,
                success: merge("success", prev.success),
                message: merge("message", prev.message),
                fsm_state: merge("fsm_state", prev.fsm_state),
                order_type: merge("order_type", prev.order_type),
                order_item: merge("order_item", prev.order_item),
                current_menu: merge("current_menu", prev.current_menu),
                // 배열류는 명시적으로 배열이 있으면 반영, 없으면 이전 유지
                cart: Array.isArray(res.cart) ? res.cart : prev.cart,
                total_price:
                    typeof res.total_price === "number"
                        ? res.total_price
                        : prev.total_price,
                recommendation_list: Array.isArray(res.recommendation_list)
                    ? res.recommendation_list
                    : prev.recommendation_list,
                error_code: merge("error_code", prev.error_code),
                session_end: merge("session_end", prev.session_end),
                countdown_deadline_at: nextDeadline,
                responseSeq: prev.responseSeq + 1,
                lastSource: source,
            };
        });
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
        try {
            sessionStorage.removeItem(SS_SID_KEY);
        } catch {
            /* ignore */
        }
        setSession({ ...INITIAL_STATE, session_id: null });
    }, []);

    /* session_id 변경 시 SS 백업 (리로드 대응) */
    useEffect(() => {
        try {
            if (session.session_id) {
                sessionStorage.setItem(SS_SID_KEY, session.session_id);
            }
        } catch {
            /* ignore */
        }
    }, [session.session_id]);

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
