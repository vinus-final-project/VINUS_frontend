import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/navbar";
import { PAYMENT_TIME_LIMIT_SEC } from "../../constants";
import { formatKRW } from "../../utils/format";
import { useCountdown } from "../../hooks/useCountdown";
import useCart from "../../hooks/useCart";
import "./payment.css";
import usePayment from "../../hooks/usePayment.jsx";
import useSession from "../../hooks/useSession.jsx";

/* ──────────────────────────────────────────────────────────────
 * Payment — 결제 방법 선택 (카운트다운은 여기까지)
 *
 *   ─ 30초 카운트다운: 결제 방식 클릭 없이 방치되면 / 로 복귀
 *   ─ 카드 선택 시 → navigate("/pay")
 *      토스 결제창 호출과 결과 분기는 /pay 페이지가 담당
 * ────────────────────────────────────────────────────────────── */
export default function Payment() {
  const navigate = useNavigate();
  /* 결제 금액 — useCart.totalPrice 는 내부에서 backend total_price 우선(단일 소스). */
  const { session_id, applySessionResponse } = useSession();
  const { cancelPayment } = usePayment();
  const { totalPrice } = useCart();

  // 결제 타이머 (30초). 카드 선택 없이 방치되면 홈으로.
  const onTimeout = useCallback(() => navigate("/"), [navigate]);
  const seconds = useCountdown(PAYMENT_TIME_LIMIT_SEC, onTimeout);

  const handleHome = () => navigate("/");
  const handleCallStaff = () => {
    alert("직원호출");
    // TODO: 직원호출 API 요청
  };
  const handleCancel = async () => {
    if (session_id) {
      const res = await cancelPayment(session_id);
      if (res) applySessionResponse(res);
    }
    navigate("/cart"); // 또는 /order
  };

  const handleSelectCard = () => {
    if (!totalPrice || totalPrice <= 0) {
      alert("결제할 금액이 없습니다.");
      return;
    }
    navigate("/pay");
  };

  return (
    <>
        {/* 상단 네비게이션 (공용 컴포넌트, 중앙 타이머) */}
        <Navbar
          timer={seconds}
          onHome={handleHome}
          onCallStaff={handleCallStaff}
        />

        {/* ── 스크롤 영역 ───────────────────────────────────── */}
        <main className="kiosk-scroll payment-scroll">
          <h1 className="pay-title">결제 방법을 선택하세요</h1>

          {/* 금액 */}
          <div className="price-box">
            <span className="price-label">금액</span>
            <span className="price-value">{formatKRW(totalPrice)}</span>
          </div>

          {/* 결제 방법 선택 */}
          <div className="pay-center">
            <button
              className="card-method-btn"
              onClick={handleSelectCard}
              aria-label="신용 체크카드"
            >
              <span>신용</span>
              <span className="dot">•</span>
              <span>체크카드</span>
            </button>
          </div>
        </main>

        {/* ── 하단 푸터 (항상 고정) ─────────────────────────── */}
        <footer className="kiosk-footer payment-footer">
          <button className="cancel-btn" onClick={handleCancel} aria-label="취소">
            취소
          </button>
        </footer>
    </>
  );
}
