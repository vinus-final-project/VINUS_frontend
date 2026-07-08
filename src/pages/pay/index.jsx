import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ANONYMOUS } from "@tosspayments/tosspayments-sdk";
import useCart from "../../hooks/useCart";
import useSession from "../../hooks/useSession";
import usePayment from "../../hooks/usePayment";
import { getTossPayments } from "../../utils/toss";
import "./pay.css";

/* ──────────────────────────────────────────────────────────────
 * Pay — 결제 진행 페이지 (토스 결제창 호출 + backend confirm + 결과 분기)
 *
 * 흐름
 *   1) mount 시 URL query 의 result 파라미터 확인
 *      - 없음         → 결제창 첫 진입. 토스 결제창 open (status = processing)
 *      - "success"    → 토스가 결제 성공 후 리다이렉트.
 *                        → paymentKey/orderId/amount 파싱
 *                        → backend POST /payments/confirm 호출 (fsm_state PAYMENT→COMPLETE)
 *                        → 성공: status = done / 실패: status = fail
 *      - "fail"       → 결제 실패 리다이렉트 (status = fail)
 *
 *   2) status 별 후속 처리
 *      - processing   → 결제창/confirm 진행 중, 사용자 대기
 *      - done         → placeOrder() 후 1.5초 뒤 /receipt
 *      - fail         → 1.5초 뒤 /payment 복귀
 * ────────────────────────────────────────────────────────────── */

export default function Pay() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { items, placeOrder, totalPrice } = useCart();
  const { session_id } = useSession();
  const { confirmPayment } = usePayment();

  // URL query result 로 초기 상태 결정 — success 도 processing 유지
  //   (backend confirm 응답 성공 시에만 done 으로 전이)
  const initialResult = params.get("result"); // "success" | "fail" | null
  const [status, setStatus] = useState(
    initialResult === "fail" ? "fail" : "processing"
  );

  // Toss 리다이렉트로 온 결제 파라미터 (success 케이스만 유효)
  const paymentKey = params.get("paymentKey");
  const orderIdParam = params.get("orderId");
  const amountParam = Number(params.get("amount") || 0);

  // 결제창 이중 호출 방지 (StrictMode 이중 mount 대응)
  const openedRef = useRef(false);
  // confirm 이중 호출 방지 (StrictMode 이중 mount 대응)
  const confirmedRef = useRef(false);

  /* ── URL 정리 — result 판독 후 즉시 /pay 로 replaceState ─
   * 뒤로가기/재진입 시 이전 결과가 다시 판독되는 것을 방지.  */
  useEffect(() => {
    if (initialResult) {
      window.history.replaceState({}, "", "/pay");
    }
  }, [initialResult]);

  /* ── initialResult=success → backend confirm ─────────── */
  useEffect(() => {
    if (initialResult !== "success") return;
    if (confirmedRef.current) return;
    confirmedRef.current = true;

    (async () => {
      if (!session_id || !paymentKey || !orderIdParam || !amountParam) {
        console.error("[pay] confirm 필수 파라미터 누락", {
          session_id, paymentKey, orderIdParam, amountParam,
        });
        setStatus("fail");
        return;
      }
      const res = await confirmPayment({
        session_id,
        order_id: orderIdParam,
        payment_key: paymentKey,
        amount: amountParam,
      });
      if (res?.success) {
        setStatus("done");
      } else {
        console.error("[pay] confirm 실패", res);
        setStatus("fail");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialResult]);

  /* ── 첫 진입 (result 없음) → 토스 결제창 open ────────── */
  useEffect(() => {
    if (initialResult) return; // 리다이렉트 복귀는 결제창 재호출 X
    if (openedRef.current) return;
    openedRef.current = true;

    (async () => {
      if (!totalPrice || totalPrice <= 0) {
        console.error("[pay] 결제 금액 없음 — payment 로 복귀");
        navigate("/payment");
        return;
      }
      if (!session_id) {
        console.error("[pay] session_id 없음 — 홈으로 복귀");
        navigate("/");
        return;
      }

      const orderId = `${session_id}-${Date.now()}`;
      const firstName = items[0]?.m_name || "주문";
      const orderName =
        items.length > 1 ? `${firstName} 외 ${items.length - 1}건` : firstName;

      const successUrl = `${window.location.origin}/pay?result=success`;
      const failUrl = `${window.location.origin}/pay?result=fail`;

      try {
        const toss = await getTossPayments();
        const payment = toss.payment({ customerKey: ANONYMOUS });
        await payment.requestPayment({
          method: "CARD",
          amount: { currency: "KRW", value: totalPrice },
          orderId,
          orderName,
          successUrl,
          failUrl,
          card: {
            useEscrow: false,
            flowMode: "DEFAULT",
            useCardPoint: false,
            useAppCardOnly: false,
          },
        });
        // requestPayment 성공 시 브라우저가 successUrl 로 리다이렉트되므로
        // 아래 코드는 실행되지 않음.
      } catch (err) {
        /* 에러 종류
         *   USER_CANCEL — 사용자가 결제창을 닫음 (그냥 payment 복귀)
         *   그 외        — SDK/네트워크 오류 (fail 상태 표시 후 복귀) */
        console.error(
          "[pay] 결제창 오류 code=",
          err?.code,
          "message=",
          err?.message,
          err
        );
        if (err?.code === "USER_CANCEL") {
          // 사용자가 결제창을 닫은 것 — 조용히 payment 로 복귀
          navigate("/payment");
        } else {
          setStatus("fail");
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── done: placeOrder + 1.5초 후 receipt ──────────── */
  useEffect(() => {
    if (status !== "done") return;
    placeOrder();
    const id = setTimeout(() => navigate("/receipt"), 1500);
    return () => clearTimeout(id);
  }, [status, navigate, placeOrder]);

  /* ── fail: 1.5초 후 payment 복귀 ──────────────────── */
  useEffect(() => {
    if (status !== "fail") return;
    const id = setTimeout(() => navigate("/payment"), 1500);
    return () => clearTimeout(id);
  }, [status, navigate]);

  return (
    <div className="pay-body">
      <div
        className={`pay-indicator ${status === "processing" ? "is-loading" : ""}`}
        aria-hidden="true"
      />
      <p className="pay-message" role="status" aria-live="polite">
        {status === "processing" && (
          <>
            결제 중입니다...
            <br />
            잠시만 기다려주세요
          </>
        )}
        {status === "done" && (
          <>
            결제가 완료되었습니다!
            <br />
            카드를 제거해주세요
          </>
        )}
        {status === "fail" && (
          <>
            결제에 실패했습니다
            <br />
            결제 화면으로 돌아갑니다
          </>
        )}
      </p>
    </div>
  );
}
