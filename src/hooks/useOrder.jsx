import { useState } from "react";
import api from "../utils/api";

/* ──────────────────────────────────────────────────────────────
 * useOrder — 주문(터치) 도메인 API hook
 *
 * backend/app/routers/order.py 기준.
 * 모든 응답은 SessionResponse — 호출자가 applySessionResponse 로 반영.
 *
 * Endpoints
 *   POST /orders           body: { session_id, menu_id }   메뉴 선택(SELECT_MENU)
 *   POST /orders/quantity  body: { session_id, quantity }  수량 지정(SET_QUANTITY)
 *   POST /orders/option    body: { session_id, option_id } 옵션 선택(필수/선택 서버 판별)
 *   POST /orders/complete  body: { session_id }            담기(SKIP_OPTIONAL_OPTION → cart 이동)
 *
 * 사용 예
 *   const { createOrder, setQuantity, selectOption, completeOrder } = useOrder();
 *   const res = await createOrder(session_id, menu_id);
 *   if (res) applySessionResponse(res);
 * ────────────────────────────────────────────────────────────── */

const useOrder = () => {
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    // 메뉴 선택 → order_item 생성
    const createOrder = async (session_id, menu_id) => {
        try {
            setIsLoading(true);
            const response = await api.post("/orders", { session_id, menu_id });
            if (response.status === 200 || response.status === 201) {
                return response.data;
            }
        } catch (error) {
            console.log(error);
            setError(error.response?.data.detail || "메뉴 선택에 실패했습니다.");
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    // 수량 지정
    const setQuantity = async (session_id, quantity) => {
        try {
            setIsLoading(true);
            const response = await api.post("/orders/quantity", { session_id, quantity });
            if (response.status === 200) {
                return response.data;
            }
        } catch (error) {
            console.log(error);
            setError(error.response?.data.detail || "수량 변경에 실패했습니다.");
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    // 옵션 선택 (필수/선택 단계는 서버가 order_item.status 로 판별)
    const selectOption = async (session_id, option_id) => {
        try {
            setIsLoading(true);
            const response = await api.post("/orders/option", { session_id, option_id });
            if (response.status === 200) {
                return response.data;
            }
        } catch (error) {
            console.log(error);
            setError(error.response?.data.detail || "옵션 선택에 실패했습니다.");
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    // 주문 항목 완료 → 장바구니 담기
    const completeOrder = async (session_id) => {
        try {
            setIsLoading(true);
            const response = await api.post("/orders/complete", { session_id });
            if (response.status === 200) {
                return response.data;
            }
        } catch (error) {
            console.log(error);
            setError(error.response?.data.detail || "장바구니 담기에 실패했습니다.");
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    return {
        error,
        setError,
        isLoading,
        createOrder,
        setQuantity,
        selectOption,
        completeOrder,
    };
};

export default useOrder;
