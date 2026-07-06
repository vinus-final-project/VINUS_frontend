import { useState } from "react";
import api from "../utils/api";

/* ──────────────────────────────────────────────────────────────
 * usePayment — 토스페이먼츠 결제 도메인 API hook
 *
 * 결제 전체 흐름
 *   1) payment 페이지에서 tossPayments.requestPayment("CARD", ...) 호출
 *      → 토스 결제창 → 사용자가 카드 정보 입력 → successUrl 리다이렉트
 *   2) /success 페이지에서 URL query 로 paymentKey/orderId/amount 파싱
 *   3) registerPayment({ session_id, payment_key, order_id })
 *      → backend DB 의 pa_key 필드에 토스 영수증 매핑
 *   4) confirmPayment({ session_id, amount })
 *      → backend 가 시크릿 키로 토스 서버에 최종 승인 요청 (위변조 검증)
 *      → { success: true } 응답 시 결제 완료
 *
 * Endpoints (backend/app/routers/payment.py)
 *   POST /payments/register  body: { session_id, payment_key, order_id }
 *                            response: 성공/실패
 *   POST /payments/confirm   body: { session_id, amount }
 *                            response: { success: bool }
 *
 * 사용 예
 *   const { registerPayment, confirmPayment, error } = usePayment();
 *   await registerPayment({ session_id, payment_key, order_id });
 *   const res = await confirmPayment({ session_id, amount });
 *   if (res?.success) navigate("/receipt");
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

    // ── 1) 결제 정보 등록 (토스 영수증 → DB 매핑) ─────────────
    const registerPayment = async ({ session_id, payment_key, order_id }) => {
        try {
            setIsLoading(true);
            const response = await api.post("/payments/register", {
                session_id,
                payment_key,
                order_id,
            });
            if (response.status === 200 || response.status === 201) {
                return response.data;
            }
        } catch (error) {
            console.log(error);
            setError(error.response?.data.detail || "결제 정보 등록에 실패했습니다.");
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    // ── 2) 최종 승인 (session_id + amount 만) ──────────────
    const confirmPayment = async ({ session_id, amount }) => {
        try {
            setIsLoading(true);
            const response = await api.post("/payments/confirm", {
                session_id,
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
        registerPayment,
        confirmPayment,
    };
};

export default usePayment;
