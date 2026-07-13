/* ──────────────────────────────────────────────────────────────
 * fsmRoute — SessionResponse → 강제 라우팅 대상 결정 (순수 함수)
 *
 * 응답 출처(source)에 따라 라우팅 강도가 다르다:
 *
 * ▸ 공통 (source 무관) — response_type 이 "명시적 페이지 전이"일 때
 *   response_type       | 경로
 *   ------------------- | -------------------------
 *   PAYMENT_SUCCESS     | /end
 *   PAYMENT_CANCEL      | /cart        (결제 취소 후 카트로 복귀)
 *   SESSION_END         | /            (처음으로)
 *   SHOW_CART           | /cart        ("장바구니 보여줘")
 *   SHOW_MENU           | /order       ("돌아가기" / "메뉴 더 볼게")
 *   ERROR               | null         (현재 화면 유지, 안내만)
 *
 * ▸ source === "voice" (WS 음성 응답) — NORMAL 이어도 화면이 발화
 *   결과를 따라가야 하므로 fsm_state / order_item 기반 강제 라우팅:
 *   (명세서/FrontendResponse.md 매핑)
 *
 *   fsm_state | order_item                | 경로
 *   --------- | ------------------------- | ----------------------
 *   INIT      | -                         | /main
 *   ORDERING  | 존재 (menu_id)             | /menu/{menu_id}
 *             |   status 별 세부 단계는     |  (orderDetail 페이지가
 *             |   orderDetail 내부에서 처리 |   status 를 구독해 토글)
 *   ORDERING  | null                      | /order (주문 계속)
 *             |                           |  ※ 카트 이동은 SHOW_CART
 *             |                           |    response_type 이 담당
 *   PAYMENT   | -                         | /payment
 *   COMPLETE  | -                         | /end
 *
 * ▸ source === "rest" (터치 REST 응답) — 사용자가 이미 그 화면에서
 *   조작 중이므로 NORMAL 응답엔 라우팅하지 않는다 (페이지 튕김 방지).
 *   화면 전환은 각 페이지의 명시적 navigate 가 담당.
 * ────────────────────────────────────────────────────────────── */

export function resolveRoute({ response_type, fsm_state, order_item, cart, source }) {
    // ── 1) response_type 전이 (source 무관) ──────────────────
    switch (response_type) {
        case "PAYMENT_SUCCESS":
            return "/end";
        case "PAYMENT_CANCEL":
            return "/cart";
        case "SESSION_END":
            return "/";
        case "SHOW_CART":
            return "/cart"; // "장바구니 보여줘"
        case "SHOW_MENU":
            return "/order"; // "돌아가기" / "메뉴 더 볼게"
        case "SHOW_PAY":
            return "/pay"; // "카드로 할게요" — pay 페이지가 mount 시 토스 결제창 open
        case "ERROR":
            return null; // 현재 화면 유지 (안내는 별도 처리)
        default:
            break; // NORMAL → source 별 분기
    }

    // ── 2) 터치(REST) NORMAL — 라우팅 없음 ───────────────────
    if (source !== "voice") return null;

    // ── 3) 음성(WS) NORMAL — fsm_state / order_item 매핑 ─────
    switch (fsm_state) {
        case "INIT":
            return "/main";
        case "ORDERING": {
            const menuId = order_item?.menu_id ?? order_item?.m_id;
            if (menuId !== undefined && menuId !== null) {
                return `/menu/${menuId}`;
            }
            // order_item 없음 → 주문 계속 (담기 완료 포함) — 항상 전체 메뉴로.
            // "장바구니 보여줘"는 상태가 동일하므로 backend 가
            // response_type=SHOW_CART 로 구분해 내려준다 (위 공통 switch 처리).
            return "/order";
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
