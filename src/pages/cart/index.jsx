import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/navbar";
import { LIST_SCROLL_STEP } from "../../constants";
import { formatKRW, formatCount } from "../../utils/format";
import useSessionCountdown from "../../hooks/useSessionCountdown";
import useCart from "../../hooks/useCart";
import useSession from "../../hooks/useSession";
import usePayment from "../../hooks/usePayment";
import "./cart.css";

export default function Cart() {
  const navigate = useNavigate();

  const listRef = useRef(null); // 메뉴 리스트 내부 스크롤 영역

  // 세션 공유 카운트다운 (order/orderDetail/cart 공용)
  const onTimeout = useCallback(() => navigate("/"), [navigate]);
  const seconds = useSessionCountdown(onTimeout);

  // 장바구니 전역 상태
  const { items, totalCount, totalPrice, changeQuantity, removeItem, clearCart } = useCart();

  // 세션 / 결제 API
  const { session_id, applySessionResponse } = useSession();
  const { startPayment } = usePayment();
  const [busy, setBusy] = useState(false);

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

  /* 결제 클릭 — POST /payments/start 로 세션을 PAYMENT 상태로 전이.
   *   응답(SessionResponse)을 useSession 에 반영한 뒤 결제 방법 선택 페이지로 이동.
   *   backend/app/routers/payment.py 참조.                                    */
  const handlePay = async () => {
    if (busy) return;
    if (items.length === 0) return;
    if (!session_id) {
      alert("세션이 만료되었습니다. 처음부터 다시 시도해주세요.");
      navigate("/");
      return;
    }
    setBusy(true);
    try {
      const res = await startPayment(session_id);
      if (!res) {
        alert("결제 시작에 실패했습니다. 잠시 후 다시 시도해주세요.");
        return;
      }
      applySessionResponse(res);
      navigate("/payment");
    } finally {
      setBusy(false);
    }
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
              disabled={busy || items.length === 0}
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
                  <span className="cart-name">{item.m_name}</span>

                  {/* 선택된 옵션 — 메뉴명과 스텝퍼 사이 (누적 옵션은 개수 표시) */}
                  {item.options?.length > 0 && (
                    <span className="cart-opts">
                      {item.options
                        .map((op) =>
                          op.qty > 1 ? `${op.op_name} ${op.qty}개` : op.op_name
                        )
                        .join(", ")}
                    </span>
                  )}

                  <button
                    className="cart-remove-btn"
                    onClick={() => removeItem(item.id)}
                    disabled={busy}
                    aria-label={`${item.m_name} 삭제`}
                  >
                    ×
                  </button>

                  <div className="cart-qty">
                    <button
                      className="cart-qty-btn"
                      onClick={() => changeQuantity(item.id, -1)}
                      disabled={busy}
                      aria-label={`${item.m_name} 수량 감소`}
                    >
                      −
                    </button>
                    <span className="cart-qty-count">{item.o_m_qty}</span>
                    <button
                      className="cart-qty-btn"
                      onClick={() => changeQuantity(item.id, +1)}
                      disabled={busy}
                      aria-label={`${item.m_name} 수량 증가`}
                    >
                      +
                    </button>
                  </div>

                  <span className="cart-price">
                    {formatKRW(item.unitPrice * item.o_m_qty)}
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
          <button
            className="pay-btn"
            onClick={handlePay}
            disabled={busy || items.length === 0}
            aria-label="결제하기"
          >
            결제
          </button>
        </footer>
    </>
  );
}
