import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ReceiptModal from "../../components/modal/receiptModal";
import {
  ORDER_NUMBER,
  STORE_NAME,
  RECEIPT_HOLD_MS as HOLD_MS,
  RECEIPT_AUTO_SKIP_MS,
} from "../../constants";
import { peekOrderNumber } from "../../utils/orderNumber";
import buildReceiptText from "../../utils/receiptText";
import useCart from "../../hooks/useCart";
import usePrinter from "../../hooks/usePrinter";
import useTts from "../../hooks/useTts";
import { ttsStartedMic, ttsEndedMic } from "../../utils/micGate";
import receiptPng from "../../assets/receipt.png";
import "./receipt.css";

/* ──────────────────────────────────────────────────────────────
 * Receipt — 영수증 수령 안내 페이지
 *
 * 흐름
 *   1) mount 즉시 ReceiptModal(대기번호 안내) 표시
 *      → 3초(RECEIPT_AUTO_END_MS) 후 자동으로 닫힘(onClose 콜백)
 *   2) 모달 닫히면 "영수증 받기/안 받기" 선택 UI 노출
 *      ├─ 짧게 [영수증 받기]                       → 인쇄 → /end
 *      ├─ 짧게 [영수증 안 받기]                    → /end
 *      ├─ 화면 아무 곳이나 3초 hold                → 인쇄 → /end
 *      └─ 10초 대기(RECEIPT_AUTO_SKIP_MS)          → /end
 *
 * 모든 트리거는 firedRef 로 한 번만 실행. hold 시각화(원형 프로그레스)는
 * start.css 의 .hold-progress 클래스를 재사용 (전역 CSS).
 * ────────────────────────────────────────────────────────────── */

export default function Receipt() {
  const navigate = useNavigate();
  const { lastOrder } = useCart();
  const { printReceipt } = usePrinter();
  const { speak } = useTts();

  /* 주문번호 — pay 페이지가 결제 확정 시 issueOrderNumber() 로 발급한
   * 당일 번호를 조회. 발급 이력이 없으면(개발/직접 진입) 임시 상수 fallback */
  const orderNumber = peekOrderNumber() || ORDER_NUMBER;

  // mount 즉시 뜨는 대기번호 모달 — 3초 후 닫힘
  const [introModalOpen, setIntroModalOpen] = useState(true);

  // hold 시각화용 상태 / 참조
  const [isHolding, setIsHolding] = useState(false);
  const [holdPos, setHoldPos] = useState(null);
  const holdTimerRef = useRef(null);
  const pointerHoldingRef = useRef(false);
  // 인쇄를 한 번만 실행하도록 방어 (버튼 탭 / hold / 자동스킵이 겹칠 때)
  const firedRef = useRef(false);
  // 아무 조작 없을 때 자동으로 "안 받기" 로 넘어가는 타이머
  const autoSkipTimerRef = useRef(null);

  const handleNoReceipt = () => {
    if (firedRef.current) return;
    firedRef.current = true;
    // end 페이지에 "안 받기 → 주문내역 팝업 잠깐 표시" 지시 전달
    navigate("/end", { state: { showSummary: true } });
  };

  const handleReceipt = () => {
    if (firedRef.current) return;
    firedRef.current = true;

    /* 실물 영수증 출력 — USB 프린터 (fire-and-forget).
     * 프린터 미연결/출력 실패여도 흐름은 그대로 /end 로 진행.
     * lastOrder 는 pay 단계 placeOrder() 스냅샷 (SS 백업 — 리로드 생존) */
    try {
      const totalPrice = (lastOrder ?? []).reduce(
        (s, it) => s + (it.unitPrice ?? 0) * (it.o_m_qty ?? 1),
        0
      );
      const text = buildReceiptText({
        storeName: STORE_NAME,
        orderNumber,
        items: lastOrder ?? [],
        totalPrice,
      });
      Promise.resolve()
        .then(() => printReceipt(text))
        .catch((e) => console.warn("[receipt] 인쇄 실패(무시):", e));
    } catch (e) {
      console.warn("[receipt] 인쇄 스킵:", e);
    }

    navigate("/end");
  };

  /* ── 3초 hold 로직 (start 페이지와 동일 패턴) ────────────── */
  const startHold = (e) => {
    if (firedRef.current || introModalOpen) return;
    if (holdTimerRef.current) return;
    pointerHoldingRef.current = true;
    setHoldPos({ x: e.clientX, y: e.clientY });
    setIsHolding(true);
    holdTimerRef.current = setTimeout(() => {
      holdTimerRef.current = null;
      pointerHoldingRef.current = false;
      setIsHolding(false);
      setHoldPos(null);
      handleReceipt(); // hold 완료 → 인쇄 → /end
    }, HOLD_MS);
  };

  const cancelHold = () => {
    if (!holdTimerRef.current && !pointerHoldingRef.current) return;
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    pointerHoldingRef.current = false;
    setIsHolding(false);
    setHoldPos(null);
  };

  /* ── intro 모달 자동 닫힘 콜백 ────────────────────────────
   *   모달 닫힘 → 선택 UI 노출 + 자동 스킵 타이머 시작.
   *   (자동 스킵은 사용자가 UI 를 볼 수 있는 시점부터 카운트)
   *   동시에 선택 방법 음성 안내.                                     */
  const handleIntroClose = () => {
    setIntroModalOpen(false);
    speak(
      "영수증이 필요하시면 화면을 3초간 눌러주세요. 필요하지 않으시면 13초간 기다려주세요.",
      { onStart: ttsStartedMic, onEnd: ttsEndedMic }
    );
    autoSkipTimerRef.current = setTimeout(() => {
      autoSkipTimerRef.current = null;
      handleNoReceipt();
    }, RECEIPT_AUTO_SKIP_MS);
  };

  // 언마운트 시 남은 타이머 정리
  useEffect(() => {
    return () => {
      cancelHold();
      if (autoSkipTimerRef.current) {
        clearTimeout(autoSkipTimerRef.current);
        autoSkipTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {/* ── 본문 (nav 없음) — 선택 UI 는 intro 모달 닫힌 뒤 노출 ── */}
      <main
        className="kiosk-scroll receipt-scroll"
        onPointerDown={startHold}
        onPointerUp={cancelHold}
        onPointerCancel={cancelHold}
        onPointerLeave={cancelHold}
      >
        <h1 className="receipt-title">영수증을 받으시겠습니까?</h1>

        {/* 영수증 일러스트 */}
        <div className="receipt-illu-wrap">
          <img className="receipt-illu" src={receiptPng} alt="영수증 그림" />
        </div>

        {/* 버튼 영역 */}
        <div className="receipt-actions">
          <button
            className="receipt-btn receipt-btn--accent"
            onClick={handleNoReceipt}
            aria-label="영수증 안 받기"
          >
            영수증 안 받기
          </button>
          <button
            className="receipt-btn receipt-btn--ghost"
            onClick={handleReceipt}
            aria-label="영수증 받기"
          >
            영수증 받기
          </button>
        </div>

        {/* 3초 hold 원형 프로그레스 — 실제 터치 좌표에 표시.
            .hold-progress 스타일은 start.css 에서 전역 로드됨. */}
        {isHolding && holdPos && (
          <svg
            className="hold-progress"
            viewBox="0 0 100 100"
            style={{
              "--hold-ms": `${HOLD_MS}ms`,
              left: `${holdPos.x}px`,
              top: `${holdPos.y}px`,
            }}
            aria-hidden="true"
          >
            <circle className="hold-progress-bg" cx="50" cy="50" r="45" />
            <circle className="hold-progress-arc" cx="50" cy="50" r="45" />
          </svg>
        )}
      </main>

      {/* Intro 모달 — mount 즉시 표시, RECEIPT_AUTO_END_MS 후 자동 닫힘 */}
      {introModalOpen && (
        <ReceiptModal orderNumber={orderNumber} onClose={handleIntroClose} />
      )}
    </>
  );
}
