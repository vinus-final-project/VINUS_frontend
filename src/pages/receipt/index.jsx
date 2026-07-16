import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ReceiptModal from "../../components/modal/receiptModal";
import { ORDER_NUMBER, STORE_NAME } from "../../constants";
import { peekOrderNumber } from "../../utils/orderNumber";
import buildReceiptText from "../../utils/receiptText";
import useCart from "../../hooks/useCart";
import usePrinter from "../../hooks/usePrinter";
import receiptPng from "../../assets/receipt.png";
import "./receipt.css";

export default function Receipt() {
  const navigate = useNavigate();
  const { lastOrder } = useCart();
  const { printReceipt } = usePrinter();

  /* 주문번호 — pay 페이지가 결제 확정 시 issueOrderNumber() 로 발급한
   * 당일 번호를 조회. 발급 이력이 없으면(개발/직접 진입) 임시 상수 fallback */
  const orderNumber = peekOrderNumber() || ORDER_NUMBER;

  const [modalOpen, setModalOpen] = useState(false);

  const handleNoReceipt = () => {
    navigate("/end"); // 결제내역 확인 페이지로 이동
  };

  const handleReceipt = () => {
    /* 실물 영수증 출력 — USB 프린터 (fire-and-forget).
     * 프린터 미연결/출력 실패여도 모달(주문번호 안내)은 그대로 진행.
     * lastOrder 는 pay 단계 placeOrder() 스냅샷 (SS 백업 — 리로드 생존) */
    const totalPrice = (lastOrder ?? []).reduce(
      (s, it) => s + (it.unitPrice ?? 0) * (it.o_m_qty ?? 1),
      0
    );
    printReceipt(
      buildReceiptText({
        storeName: STORE_NAME,
        orderNumber,
        items: lastOrder ?? [],
        totalPrice,
      })
    );
    setModalOpen(true); // 주문번호 안내 모달 표시
  };

  return (
    <>
        {/* ── 본문 (nav 없음) ───────────────────────────────── */}
        <main className="kiosk-scroll receipt-scroll">
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
        </main>

        {/* 영수증 받기 모달 — 닫힘 처리는 모달 내부에서 navigate("/end") 로 일원화 */}
        {modalOpen && <ReceiptModal orderNumber={orderNumber} />}
    </>
  );
}
