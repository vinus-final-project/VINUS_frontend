/* ──────────────────────────────────────────────────────────────
 * fsmRoute — SessionResponse → 화면 경로 결정 (순수 함수)
 *
 * 매핑 근거: 명세서/FrontendResponse.md + FSM_Events.md
 *
 *   response_type       | 경로
 *   ------------------- | -------------------------
 *   PAYMENT_SUCCESS     | /end
 *   PAYMENT_CANCEL      | /payment
 *   SESSION_END         | /            (처음으로)
 *   ERROR               | 라우팅 없음 (현재 화면 유지, 안내만)
 *
 *   fsm_state | order_item           | 경로
 *   --------- | -------------------- | -------------------------
 *   INIT      | -                    | /main
 *   ORDERING  | 존재 (m_id)           | /menu/{m_id}
 *   ORDERING  | null + cart 비어있음   | /order   (전체 메뉴)
 *   ORDERING  | null + cart 있음      | /cart    (장바구니)
 *   PAYMENT   | -                    | /payment
 *   COMPLETE  | -                    | /end
 *
 * 참고:
 *  - order_item.status(SELECTING_REQUIRED_OPTION 등)에 따른
 *    토글리스트 여닫기는 orderDetail 페이지 내부에서 처리한다.
 *  - ORDERING + order_item==null 은 명세상 "장바구니" 화면이지만,
 *    세션 시작 직후처럼 cart 가 비어있으면 전체 메뉴(/order)가 자연스럽다.
 * ────────────────────────────────────────────────────────────── */

export function resolveRoute({ response_type, fsm_state, order_item, cart }) {
    // 1) response_type 우선 분기
    switch (response_type) {
        case "PAYMENT_SUCCESS":
            return "/end";
        case "PAYMENT_CANCEL":
            return "/payment";
        case "SESSION_END":
            return "/";
        case "ERROR":
            return null; // 현재 화면 유지 (안내는 별도 처리)
        default:
            break; // NORMAL 등 → fsm_state 분기로
    }

    // 2) fsm_state 분기
    switch (fsm_state) {
        case "INIT":
            return "/main";
        case "ORDERING": {
            const mId = order_item?.m_id;
            if (mId !== undefined && mId !== null) return `/menu/${mId}`;
            const hasCart = Array.isArray(cart) && cart.length > 0;
            return hasCart ? "/cart" : "/order";
        }
        case "PAYMENT":
            return "/payment";
        case "COMPLETE":
            return "/end";
        default:
            return null;
    }
}

export default resolveRoute;
