import { useState } from "react";
import api from "../utils/api";

/* ──────────────────────────────────────────────────────────────
 * usePayment — 토스페이먼츠 결제 도메인 API hook
 *
 * 결제 전체 흐름
 *   1) cart 결제 버튼 → startPayment(session_id)
 *      → backend START_PAYMENT 이벤트 (ORDERING → PAYMENT) → SessionResponse
 *   2) payment 페이지 → /pay → tossPayments.requestPayment → 결제창
 *      → successUrl(/pay?result=success) 로 리다이렉트
 *   3) confirmPayment({ session_id, order_id, payment_key, amount })
 *      → backend 가 시크릿 키로 토스 서버에 최종 승인 요청 (위변조 검증)
 *      → PaymentConfirmResponse
 *
 * Endpoints (backend/app/routers/payment.py)
 *   POST /payments/start     body: { session_id }
 *                            response: SessionResponse
 *   POST /payments/cancel    body: { session_id }
 *                            response: SessionResponse (PAYMENT_CANCEL → ORDERING)
 *   POST /payments/confirm   body: PaymentConfirmRequest
 *                            response: PaymentConfirmResponse
 *
 * 사용 예
 *   const { startPayment, cancelPayment, confirmPayment } = usePayment();
 *   const res = await cancelPayment(session_id);
 *   if (res) applySessionResponse(res);
 * ────────────────────────────────────────────────────────────── */

const usePayment = () => {
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    // ── 0) 결제 시작 (ORDERING → PAYMENT) ────────────────────
    //   backend/app/routers/payment.py 의 POST /payments/start
    //   body: { session_id }, response: SessionResponse
    //   cart 페이지 결제 버튼 클릭 시 호출.
    const startPayment = async (session_id) => {
        try {
            setIsLoading(true);
            const response = await api.post("/payments/start", { session_id });
            if (response.status === 200 || response.status === 201) {
                return response.data;
            }
        } catch (error) {
            console.log(error);
            setError(error.response?.data.detail || "결제 시작에 실패했습니다.");
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    // ── 결제 취소 (PAYMENT → ORDERING) ──────────────────────
    //   backend/app/routers/payment.py 의 POST /payments/cancel
    //   body: { session_id }, response: SessionResponse (PAYMENT_CANCEL)
    //   payment 페이지의 "취소" 버튼 클릭 시 호출 → cart 페이지 복귀.
    const cancelPayment = async (session_id) => {
        try {
            setIsLoading(true);
            const response = await api.post("/payments/cancel", { session_id });
            if (response.status === 200) {
                return response.data;
            }
        } catch (error) {
            console.log(error);
            setError(error.response?.data.detail || "결제 취소에 실패했습니다.");
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    /* ── 최종 승인 (토스 결제 confirm) ──────────────
     *   backend PaymentConfirmRequest 스키마 정합 필드 4개 모두 필수.
     *   응답: PaymentConfirmResponse { success, od_id, od_state, od_no }
     *   (SessionResponse 아니므로 applySessionResponse 호출 X)              */
    const confirmPayment = async ({ session_id, order_id, payment_key, amount }) => {
        try {
            setIsLoading(true);
            const response = await api.post("/payments/confirm", {
                session_id,
                order_id,
                payment_key,
                amount,
            });
            if (response.status === 200) {
                return response.data;
            }
        } catch (error) {
            console.log(error);
            setError(error.response?.data.detail || "결제 승인에 실패했습니다.");
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    return {
        error,
        setError,
        isLoading,
        startPayment,
        cancelPayment,
        confirmPayment,
    };
};

export default usePayment;
