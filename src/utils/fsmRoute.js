/* ──────────────────────────────────────────────────────────────
 * fsmRoute — SessionResponse → 강제 라우팅 대상 결정 (순수 함수)
 *
 * ⚠ 예전엔 fsm_state 만 보고도 라우팅했지만, backend가 옵션 선택/취소
 *   같은 자잘한 이벤트마다 order_item 상태를 조금씩 바꿔서 응답하므로,
 *   그때마다 SessionRouter 가 페이지를 튕겨버리는 문제가 있었다.
 *
 *   → 이제는 response_type 이 "명시적 페이지 전이"를 의미하는 경우에만
 *     라우팅 결과를 반환한다. NORMAL 응답 시엔 null 을 반환해서
 *     현재 페이지를 유지한다 (사용자가 터치로 자유롭게 이동).
 *
 *   response_type       | 경로
 *   ------------------- | -------------------------
 *   PAYMENT_SUCCESS     | /end
 *   PAYMENT_CANCEL      | /cart        (결제 취소 후 카트로 복귀)
 *   SESSION_END         | /            (처음으로)
 *   ERROR               | null         (현재 화면 유지, 안내만)
 *   NORMAL              | null         (현재 화면 유지)
 *
 *   fsm_state / order_item.status 에 따른 화면 전환은 각 페이지가
 *   자체적으로 useSession 을 구독해서 처리한다.
 *   (필수 옵션 선택 후 다음 단계 UI 를 여는 등 세부 흐름)
 * ────────────────────────────────────────────────────────────── */

export function resolveRoute({ response_type }) {
    switch (response_type) {
        case "PAYMENT_SUCCESS":
            return "/end";
        case "PAYMENT_CANCEL":
            return "/cart";
        case "SESSION_END":
            return "/";
        case "ERROR":
        default:
            return null;
    }
}

export default resolveRoute;
