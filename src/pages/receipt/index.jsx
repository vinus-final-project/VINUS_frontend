import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ReceiptModal from "../../components/modal/receiptModal";
import { ORDER_NUMBER, readOrderNo } from "../../constants";
import { buildPrintPayload, printReceipt } from "../../utils/printAgent";
import useCart from "../../hooks/useCart";
import useSession from "../../hooks/useSession";
import receiptPng from "../../assets/receipt.png";
import "./receipt.css";

export default function Receipt() {
  const navigate = useNavigate();
  const { lastOrder } = useCart();
  const { order_type } = useSession(); // Toss 리로드 후엔 null 일 수 있음 (줄 생략)

  // 결제 confirm 응답의 실제 주문번호 (SS 백업) — 없으면 임시 상수 fallback
  const orderNumber = readOrderNo() ?? ORDER_NUMBER;

  const [modalOpen, setModalOpen] = useState(false);

  const handleNoReceipt = () => {
    navigate("/end"); // 결제내역 확인 페이지로 이동
  };

  const handleReceipt = () => {
    /* 실물 영수증 출력 — 로컬 프린트 에이전트 (fire-and-forget).
     * 에이전트 미기동/프린터 오류여도 모달(주문번호+표)은 그대로 표시. */
    printReceipt(buildPrintPayload(lastOrder, orderNumber, order_type));
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
