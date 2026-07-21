import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ANONYMOUS } from "@tosspayments/tosspayments-sdk";
import { Capacitor } from "@capacitor/core";
import useCart from "../../hooks/useCart";
import useSession from "../../hooks/useSession";
import usePayment from "../../hooks/usePayment";
import { SS_OD_NO_KEY } from "../../constants";
import { getTossPayments } from "../../utils/toss";
import { issueOrderNumber } from "../../utils/orderNumber";
import { lockForPaymentMic, unlockForPaymentMic } from "../../utils/micGate";
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

  /* ── 결제 잠금 — pay 체류 중 마이크 전송·TTS 재생 차단 ──
   *   PC 팝업형 결제창은 우리 앱이 뒤에 살아있어, 발화가 backend 로
   *   흘러가면 ERROR 안내 TTS 재생·의도치 않은 화면 이동이 생긴다.
   *   mount 시 잠그고(재생 중 TTS 도 즉시 중단) unmount 시 해제.
   *   토스 리다이렉트(full reload) 복귀 시에도 mount 가 다시 잠근다. */
  useEffect(() => {
    lockForPaymentMic();
    return () => unlockForPaymentMic();
  }, []);

  /* ── (native) 딥링크 수신 — voiceinus://payment-{success|fail} ──
   *   backend /payments/toss/return 이 승인 처리 후 앱을 딥링크로
   *   복귀시킨다. 성공은 보통 WS PAYMENT_SUCCESS push 가 먼저 화면을
   *   전환하므로(SessionRouter), 여기의 success 처리는 WS 유실 대비
   *   백업. 실패는 이 경로가 유일한 통지다.                            */
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let handle;
    (async () => {
      const { App } = await import("@capacitor/app");
      handle = await App.addListener("appUrlOpen", ({ url }) => {
        if (!url) return;
        if (url.startsWith("voiceinus://payment-fail")) {
          setStatus("fail");
        } else if (url.startsWith("voiceinus://payment-success")) {
          setStatus("done"); // WS push 가 먼저 왔다면 이미 페이지 이탈됨
        }
      });
    })();
    return () => handle?.remove();
  }, []);

  /* ── (native) 무응답 워치독 — 외부 결제창에서 사용자가 창을 닫는 등
   *   딥링크도 WS push 도 없이 돌아오지 못하는 경우 3분 후 결제방법
   *   선택으로 복귀 (키오스크가 영원히 "결제 중"에 갇히는 것 방지)      */
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (status !== "processing") return;
    const id = setTimeout(() => navigate("/payment"), 180_000);
    return () => clearTimeout(id);
  }, [status, navigate]);

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
        /* 주문번호 발급 — 결제 확정 시점 1회 (localStorage, 영업일 리셋).
         * receipt/end 페이지는 peekOrderNumber() 로 조회만 한다. */
        issueOrderNumber();
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

      /* ⚠ lastOrder 스냅샷은 반드시 "결제창을 열기 전" 여기서 찍는다.
       *   토스 successUrl 리다이렉트는 full reload 라서 돌아온 시점엔
       *   cart(items)가 빈 상태 — done 시점에 placeOrder() 하면 빈
       *   스냅샷이 SS 를 덮어써 end 주문내역이 비는 버그가 재발한다.
       *   (placeOrder 는 SS vinus.cart.lastOrder 에 백업되므로 리로드 생존) */
      placeOrder();

      /* successUrl/failUrl — 웹/APK 공통 (내부 WebView 설계):
       *
       * capacitor.config 의 allowNavigation 으로 토스 결제창이 앱 WebView
       * "안"에서 열린다 (키오스크 봉인 — 외부 크롬 이탈 없음). 결제 후
       * 토스가 https://localhost/pay?result=... 로 리다이렉트하면 Capacitor
       * 가 자기 origin 이라 앱을 다시 로드하고, 아래 confirm 흐름이
       * 웹(dev)과 동일하게 이어진다 (session_id/lastOrder 는 SS 백업 생존).
       * 카드사 앱(intent://) 호출은 MainActivity.handlePaymentScheme 담당.
       *
       * (구) 외부 크롬 + backend /toss/return + voiceinus:// 딥링크 설계는
       * 폐기 — 합의 후 내부 WebView 방식으로 단일화 (2026-07-21).
       * backend 엔드포인트/딥링크 리스너는 데드코드로 남아 있으며 무해.     */
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

  /* ── done: 1.5초 후 receipt ─────────────────────────
   *   placeOrder 는 결제창 열기 직전에 이미 수행 — 리다이렉트 리로드 후
   *   items 가 빈 상태라 여기서 스냅샷하면 안 됨 (첫 진입 effect 주석 참조) */
  useEffect(() => {
    if (status !== "done") return;
    const id = setTimeout(() => navigate("/receipt"), 1500);
    return () => clearTimeout(id);
  }, [status, navigate]);

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
