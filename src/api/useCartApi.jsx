import { useState } from "react";
import api from "../utils/api";

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
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    // GET /sessions/{sid}/cart → SHOW_CART
    const getCart = async (session_id) => {
        try {
            setIsLoading(true);
            const res = await api.get(`/sessions/${encodeURIComponent(session_id)}/cart`);
            if (res.status === 200) return res.data;
        } catch (e) {
            console.log(e);
            setError(e.response?.data.detail || "장바구니 조회에 실패했습니다.");
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    // PATCH /sessions/{sid}/cart/{cart_item_id} — 수량 증감
    //   delta > 0 → 증가, delta < 0 → 감소 (크기만큼 반복 적용, backend가 처리)
    const patchCartQuantity = async (session_id, cart_item_id, delta) => {
        try {
            setIsLoading(true);
            const res = await api.patch(
                `/sessions/${encodeURIComponent(session_id)}/cart/${cart_item_id}`,
                { delta }
            );
            if (res.status === 200) return res.data;
        } catch (e) {
            console.log(e);
            setError(e.response?.data.detail || "수량 변경에 실패했습니다.");
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    // DELETE /sessions/{sid}/cart/{cart_item_id} — 항목 삭제
    const deleteCartItem = async (session_id, cart_item_id) => {
        try {
            setIsLoading(true);
            const res = await api.delete(
                `/sessions/${encodeURIComponent(session_id)}/cart/${cart_item_id}`
            );
            if (res.status === 200) return res.data;
        } catch (e) {
            console.log(e);
            setError(e.response?.data.detail || "항목 삭제에 실패했습니다.");
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    // DELETE /sessions/{sid}/cart — 장바구니 전체 삭제(CLEAR_CART)
    const clearCart = async (session_id) => {
        try {
            setIsLoading(true);
            const res = await api.delete(
                `/sessions/${encodeURIComponent(session_id)}/cart`
            );
            if (res.status === 200) return res.data;
        } catch (e) {
            console.log(e);
            setError(e.response?.data.detail || "장바구니 비우기에 실패했습니다.");
            return null;
        } finally {
            setIsLoading(false);
        }
    };

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
