import api from "../utils/api";
import { useApiRunner, seg } from "./_request";

/* ──────────────────────────────────────────────────────────────
 * useCartApi — 장바구니(터치) REST API hook
 *
 * backend/app/routers/cart.py 기준.
 * 모든 응답은 SessionResponse — 호출자가 applySessionResponse 로 반영.
 *
 * Endpoints
 *   GET    /sessions/{sid}/cart              장바구니 조회(SHOW_CART)
 *   PATCH  /sessions/{sid}/cart/{item_id}    수량 증감 body={ delta: ±1 }
 *                                            (INCREASE_CART_ITEM / DECREASE_CART_ITEM)
 *   DELETE /sessions/{sid}/cart/{item_id}    항목 삭제(REMOVE_CART_ITEM)
 *   DELETE /sessions/{sid}/cart              장바구니 전체 삭제(CLEAR_CART)
 *
 * 사용 예
 *   const { patchCartQuantity, deleteCartItem, clearCart } = useCartApi();
 *   const res = await patchCartQuantity(session_id, cart_item_id, +1);
 *   if (res) applySessionResponse(res);
 * ────────────────────────────────────────────────────────────── */

const useCartApi = () => {
    const { error, setError, isLoading, run } = useApiRunner();

    // GET /sessions/{sid}/cart → SHOW_CART
    const getCart = (session_id) =>
        run(
            () => api.get(`/sessions/${seg(session_id)}/cart`),
            "장바구니 조회에 실패했습니다."
        );

    // PATCH /sessions/{sid}/cart/{cart_item_id} — 수량 증감
    //   delta > 0 → 증가, delta < 0 → 감소 (크기만큼 반복 적용, backend가 처리)
    const patchCartQuantity = (session_id, cart_item_id, delta) =>
        run(
            () =>
                api.patch(`/sessions/${seg(session_id)}/cart/${cart_item_id}`, {
                    delta,
                }),
            "수량 변경에 실패했습니다."
        );

    // DELETE /sessions/{sid}/cart/{cart_item_id} — 항목 삭제
    const deleteCartItem = (session_id, cart_item_id) =>
        run(
            () =>
                api.delete(`/sessions/${seg(session_id)}/cart/${cart_item_id}`),
            "항목 삭제에 실패했습니다."
        );

    // DELETE /sessions/{sid}/cart — 장바구니 전체 삭제(CLEAR_CART)
    const clearCart = (session_id) =>
        run(
            () => api.delete(`/sessions/${seg(session_id)}/cart`),
            "장바구니 비우기에 실패했습니다."
        );

    return {
        error,
        setError,
        isLoading,
        getCart,
        patchCartQuantity,
        deleteCartItem,
        clearCart,
    };
};

export default useCartApi;
