import api from "../utils/api";
import { useApiRunner } from "./_request";

/* ──────────────────────────────────────────────────────────────
 * useOrder — 주문(터치) 도메인 API hook
 *
 * backend/app/routers/order.py 기준.
 * 모든 응답은 SessionResponse — 호출자가 applySessionResponse 로 반영.
 *
 * Endpoints
 *   POST /orders               body: { session_id, menu_id }   메뉴 선택(SELECT_MENU)
 *   POST /orders/quantity      body: { session_id, quantity }  수량 지정(SET_QUANTITY)
 *   POST /orders/option        body: { session_id, option_id } 옵션 추가(SELECT_OPTION, +1)
 *                              누적 옵션은 반복 호출 시 개수 증가.
 *                              단일선택 그룹(og_max=1)은 backend가 자동 교체.
 *                              ※ 토글 아님 — 해제하려면 /orders/option/remove 호출.
 *   POST /orders/option/remove body: { session_id, option_id } 옵션 감소(DESELECT_OPTION, -1)
 *   POST /orders/cancel        body: { session_id }            현재 order_item 취소(CANCEL_ORDER_ITEM)
 *   POST /orders/complete      body: { session_id }            담기(SKIP_OPTIONAL_OPTION → cart 이동)
 *
 * 사용 예
 *   const { createOrder, setQuantity, selectOption, deselectOption, completeOrder } = useOrder();
 *   const res = await createOrder(session_id, menu_id);
 *   if (res) applySessionResponse(res);
 * ────────────────────────────────────────────────────────────── */

const useOrder = () => {
    const { error, setError, isLoading, run } = useApiRunner();

    // 메뉴 선택 → order_item 생성
    const createOrder = (session_id, menu_id) =>
        run(
            () => api.post("/orders", { session_id, menu_id }),
            "메뉴 선택에 실패했습니다."
        );

    // 수량 지정
    const setQuantity = (session_id, quantity) =>
        run(
            () => api.post("/orders/quantity", { session_id, quantity }),
            "수량 변경에 실패했습니다."
        );

    // 옵션 추가 (+1) — SELECT_OPTION
    //   단일선택 그룹(og_max=1)은 backend가 자동 교체.
    //   같은 op_id 반복 호출 시 개수 증가(누적 그룹).
    const selectOption = (session_id, option_id) =>
        run(
            () => api.post("/orders/option", { session_id, option_id }),
            "옵션 선택에 실패했습니다."
        );

    // 옵션 감소 (-1) — DESELECT_OPTION
    //   해당 op_id 개수 하나 제거. 0 이면 그룹에서 제외.
    const deselectOption = (session_id, option_id) =>
        run(
            () => api.post("/orders/option/remove", { session_id, option_id }),
            "옵션 해제에 실패했습니다."
        );

    // 현재 order_item 취소 → CANCEL_ORDER_ITEM
    const cancelOrder = (session_id) =>
        run(
            () => api.post("/orders/cancel", { session_id }),
            "주문 취소에 실패했습니다."
        );

    // 주문 항목 완료 → 장바구니 담기
    const completeOrder = (session_id) =>
        run(
            () => api.post("/orders/complete", { session_id }),
            "장바구니 담기에 실패했습니다."
        );

    return {
        error,
        setError,
        isLoading,
        createOrder,
        setQuantity,
        selectOption,
        deselectOption,
        cancelOrder,
        completeOrder,
    };
};

export default useOrder;
