import { useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/navbar";
import { LIST_SCROLL_STEP, MAIN_TIME_LIMIT_SEC } from "../../constants";
import { formatKRW, formatCount } from "../../utils/format";
import { useCountdown } from "../../hooks/useCountdown";
import useCart from "../../hooks/useCart";
import "./cart.css";

export default function Cart() {
  const navigate = useNavigate();

  const listRef = useRef(null); // 메뉴 리스트 내부 스크롤 영역

  // 자동 종료 타이머 (180초)
  const onTimeout = useCallback(() => navigate("/"), [navigate]);
  const seconds = useCountdown(MAIN_TIME_LIMIT_SEC, onTimeout);

  // 장바구니 전역 상태
  const { items, totalCount, totalPrice, changeQuantity, removeItem, clearCart } = useCart();

  /* ── 핸들러: 클릭 위치 확인용 alert + 이동은 navigate 주석 ── */
  const handleHome = () => {
    navigate("/"); // 처음(홈) 화면으로 이동
  };
  const handleCallStaff = () => {
    alert("직원호출");
    // TODO: 직원호출 API 요청
  };

  const handleBack = () => {
    navigate("/order"); // 전체 메뉴 페이지로 이동
  };

  // 메뉴 리스트 내부 상하 스크롤
  const scrollList = (dir) => {
    listRef.current?.scrollBy({ top: dir * LIST_SCROLL_STEP, behavior: "smooth" });
  };

  const handlePay = () => {
    navigate("/payment"); // 결제 방법 선택 페이지로 이동
  };

  return (
    <>
        {/* 상단 네비게이션 (공용 컴포넌트, 중앙 타이머) */}
        <Navbar timer={seconds} onHome={handleHome} onCallStaff={handleCallStaff} />

        {/* ── 스크롤 영역 (스크롤은 오직 이 안에서만) ─────────── */}
        <main className="kiosk-scroll cart-scroll">
          {/* 전체 삭제 (예전 '돌아가기' 위치 — 장바구니 비우기) */}
          <div className="back-row">
            <button
              className="cart-clear-btn"
              onClick={clearCart}
              disabled={items.length === 0}
              aria-label="장바구니 전체 삭제"
            >
              전체삭제
            </button>
          </div>

          {/* 수량 / 금액 요약 */}
          <div className="summary-grid">
            <span className="summary-head">수량</span>
            <span className="summary-head">금액</span>
            <span className="summary-count">{formatCount(totalCount)}</span>
            <span className="summary-total">{formatKRW(totalPrice)}</span>
          </div>

          {/* 메뉴 리스트 + 우측 ▲▼ 스크롤 버튼 */}
          <div className="list-area">
            <div className="cart-list" ref={listRef}>
              {items.map((item) => (
                <div className="cart-item" key={item.id}>
                  <span className="cart-name">{item.name}</span>

                  <button
                    className="cart-remove-btn"
                    onClick={() => removeItem(item.id)}
                    aria-label={`${item.name} 삭제`}
                  >
                    ×
                  </button>

                  <div className="cart-qty">
                    <button
                      className="cart-qty-btn"
                      onClick={() => changeQuantity(item.id, -1)}
                      aria-label={`${item.name} 수량 감소`}
                    >
                      −
                    </button>
                    <span className="cart-qty-count">{item.quantity}</span>
                    <button
                      className="cart-qty-btn"
                      onClick={() => changeQuantity(item.id, +1)}
                      aria-label={`${item.name} 수량 증가`}
                    >
                      +
                    </button>
                  </div>

                  <span className="cart-price">
                    {formatKRW(item.unitPrice * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            <div className="list-scrollbtns">
              <button
                className="cart-scroll-btn"
                onClick={() => scrollList(-1)}
                aria-label="목록 위로 스크롤"
              >
                ▲
              </button>
              <button
                className="cart-scroll-btn"
                onClick={() => scrollList(1)}
                aria-label="목록 아래로 스크롤"
              >
                ▼
              </button>
            </div>
          </div>
        </main>

        {/* ── 하단 푸터 (돌아가기 / 결제) ────────────────────── */}
        <footer className="kiosk-footer cart-footer">
          <button
            className="footer-back-btn"
            onClick={handleBack}
            aria-label="돌아가기"
          >
            돌아가기
          </button>
          <button className="pay-btn" onClick={handlePay} aria-label="결제하기">
            결제
          </button>
        </footer>
    </>
  );
}
