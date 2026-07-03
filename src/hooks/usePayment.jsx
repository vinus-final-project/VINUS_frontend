import { useState } from "react";
import api from "../utils/api";

/* ──────────────────────────────────────────────────────────────
 * usePayment — 결제 도메인 API hook
 *
 * 응답 스키마 (backend/app/routers/paymentRouter.py 기준)
 *   POST /payments/result
 *     body: { session_id: str, payment_status: str }   // "success" 또는 그 외
 *     response: { success: bool }
 *
 * 사용 예:
 *   const { sendPaymentResult, error } = usePayment();
 *   const result = await sendPaymentResult({ session_id, payment_status: "success" });
 * ────────────────────────────────────────────────────────────── */

const usePayment = () => {
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    // 결제 결과 콜백
    const sendPaymentResult = async ({ session_id, payment_status }) => {
        try {
            setIsLoading(true);
            const response = await api.post("/payments/result", {
                session_id,
                payment_status,
            });
            if (response.status === 200) {
                return response.data;
            }
        } catch (error) {
            console.log(error);
            setError(error.response?.data.detail || "결제 결과 전송에 실패했습니다.");
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    return {
        error,
        setError,
        isLoading,
        sendPaymentResult,
    };
};

export default usePayment;
