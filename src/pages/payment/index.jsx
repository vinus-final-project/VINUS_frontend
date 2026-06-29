import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/navbar";
import { PAYMENT_TIME_LIMIT_SEC } from "../../constants";
import { formatKRW } from "../../utils/format";
import { useCountdown } from "../../hooks/useCountdown";
import useCart from "../../hooks/useCart";
import cardPng from "../../assets/card.png";
import "./payment.css";

export default function Payment() {
  const navigate = useNavigate();

  // step: "select"(결제 방법 선택) → "insert"(카드 투입)
  const [step, setStep] = useState("select");

  // 결제 타이머 (30초). 0 이 되면 시작 화면으로 복귀
  const onTimeout = useCallback(() => navigate("/"), [navigate]);
  const seconds = useCountdown(PAYMENT_TIME_LIMIT_SEC, onTimeout);

  // 장바구니 합계 (결제 금액 표시용)
  const { totalPrice } = useCart();

  // step "insert" → 데모용으로 3초 후 결제 진행 페이지로 이동.
  // TODO(실제): 카드 인식 이벤트(POS / 단말기) 수신 시 navigate("/pay").
  useEffect(() => {
    if (step !== "insert") return;
    const id = setTimeout(() => navigate("/pay"), 3000);
    return () => clearTimeout(id);
  }, [step, navigate]);

  /* ── 핸들러: 클릭 위치 확인용 alert + 이동은 navigate 주석 ── */
  const handleHome = () => {
    navigate("/"); // 처음(홈) 화면으로 이동
  };
  const handleCallStaff = () => {
    alert("직원호출");
    // TODO: 직원호출 API 요청
  };

  const handleSelectCard = () => {
    alert("신용 · 체크카드");
    setStep("insert"); // 카드 투입 안내 화면으로 전환
  };

  const handleCancel = () => {
    navigate("/order"); // 전체 메뉴 페이지로 이동
  };

  return (
    <>
        {/* 상단 네비게이션 (공용 컴포넌트, 중앙 타이머) */}
        <Navbar
          timer={seconds}
          onHome={handleHome}
          onCallStaff={handleCallStaff}
        />

        {/* ── 스크롤 영역 (스크롤은 오직 이 안에서만) ─────────── */}
        <main className="kiosk-scroll payment-scroll">
          {/* 안내 문구 (단계에 따라 변경) */}
          {step === "select" ? (
            <h1 className="pay-title">결제 방법을 선택하세요</h1>
          ) : (
            <div className="pay-title-group">
              <h1 className="pay-title">카드를 투입구에 넣으세요</h1>
              <p className="pay-subtitle">
                IC칩 방향이 위로 향하게 투입구에
                <br />
                넣어주세요
              </p>
            </div>
          )}

          {/* 금액 */}
          <div className="price-box">
            <span className="price-label">금액</span>
            <span className="price-value">{formatKRW(totalPrice)}</span>
          </div>

          {/* 단계별 콘텐츠 */}
          <div className="pay-center">
            {step === "select" ? (
              <button
                className="card-method-btn"
                onClick={handleSelectCard}
                aria-label="신용 체크카드"
              >
                <span>신용</span>
                <span className="dot">•</span>
                <span>체크카드</span>
              </button>
            ) : (
              <img
                className="reader-illu"
                src={cardPng}
                alt="카드 투입구에 카드를 넣는 그림"
              />
            )}
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
