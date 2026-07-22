import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ReceiptModal from "../../components/modal/receiptModal";
import { ORDER_NUMBER, STORE_NAME, RECEIPT_HOLD_MS as HOLD_MS } from "../../constants";
import { peekOrderNumber } from "../../utils/orderNumber";
import buildReceiptText from "../../utils/receiptText";
import useCart from "../../hooks/useCart";
import usePrinter from "../../hooks/usePrinter";
import receiptPng from "../../assets/receipt.png";
import "./receipt.css";

/* ──────────────────────────────────────────────────────────────
 * Receipt — 영수증 수령 안내 페이지
 *
 * 인쇄 트리거 두 가지:
 *   1) "영수증 받기" 버튼 클릭 (짧은 탭)
 *   2) 화면 아무 곳이나 3초 이상 hold  ←  start 페이지와 동일 UX
 *
 * hold 로 트리거된 경우/버튼 클릭 모두 finishedRef 로 한 번만 실행.
 * hold 시각화(원형 프로그레스)는 start.css 에 정의된 .hold-progress
 * 클래스를 그대로 재사용 (전역 CSS).
 * ────────────────────────────────────────────────────────────── */

export default function Receipt() {
  const navigate = useNavigate();
  const { lastOrder } = useCart();
  const { printReceipt } = usePrinter();

  /* 주문번호 — pay 페이지가 결제 확정 시 issueOrderNumber() 로 발급한
   * 당일 번호를 조회. 발급 이력이 없으면(개발/직접 진입) 임시 상수 fallback */
  const orderNumber = peekOrderNumber() || ORDER_NUMBER;

  const [modalOpen, setModalOpen] = useState(false);

  // hold 시각화용 상태 / 참조
  const [isHolding, setIsHolding] = useState(false);
  const [holdPos, setHoldPos] = useState(null);
  const holdTimerRef = useRef(null);
  const pointerHoldingRef = useRef(false);
  // 인쇄를 한 번만 실행하도록 방어 (버튼 탭과 hold 만료가 겹칠 때)
  const firedRef = useRef(false);

  const handleNoReceipt = () => {
    if (firedRef.current) return;
    firedRef.current = true;
    navigate("/end"); // 결제내역 확인 페이지로 이동
  };

  const handleReceipt = () => {
    if (firedRef.current) return;
    firedRef.current = true;

    /* 실물 영수증 출력 — USB 프린터 (fire-and-forget).
     * 프린터 미연결/출력 실패여도 모달(주문번호 안내)은 그대로 진행.
     * lastOrder 는 pay 단계 placeOrder() 스냅샷 (SS 백업 — 리로드 생존) */
    setModalOpen(true); // UI 먼저

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
  };

  /* ── 3초 hold 로직 (start 페이지와 동일 패턴) ────────────── */
  const startHold = (e) => {
    if (firedRef.current || modalOpen) return;
    if (holdTimerRef.current) return;
    pointerHoldingRef.current = true;
    setHoldPos({ x: e.clientX, y: e.clientY });
    setIsHolding(true);
    holdTimerRef.current = setTimeout(() => {
      holdTimerRef.current = null;
      pointerHoldingRef.current = false;
      setIsHolding(false);
      setHoldPos(null);
      handleReceipt(); // hold 완료 → 인쇄
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

  // 언마운트 시 남은 타이머 정리
  useEffect(() => {
    return () => cancelHold();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {/* ── 본문 (nav 없음) ───────────────────────────────── */}
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

      {/* 영수증 받기 모달 — 닫힘 처리는 모달 내부에서 navigate("/end") 로 일원화 */}
      {modalOpen && <ReceiptModal orderNumber={orderNumber} />}
    </>
  );
}
