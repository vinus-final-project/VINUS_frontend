import { useMemo, useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AUTO_HOME_SEC, LIST_SCROLL_STEP } from "../../constants";
import { formatKRW, formatCount } from "../../utils/format";
import useCart from "../../hooks/useCart";
import "./end.css";

export default function End() {
  const navigate = useNavigate();
  const { lastOrder, clearCart } = useCart();

  // pay 단계에서 placeOrder() 로 snapshot 된 lastOrder 를 end-item 표시 형식으로 변환.
  // lastOrder 가 비어있으면(직접 /end 진입 등) 빈 리스트로 렌더.
  const displayItems = useMemo(() => {
    if (!lastOrder || lastOrder.length === 0) return [];
    return lastOrder.map((it) => ({
      id: it.id,
      name: it.m_name,
      count: it.o_m_qty,
      price: it.unitPrice * it.o_m_qty,
    }));
  }, [lastOrder]);

  const listRef = useRef(null); // 메뉴 리스트 내부 스크롤 영역
  const [seconds, setSeconds] = useState(AUTO_HOME_SEC);

  // ── 자동 복귀 타이머: 0이 되면 장바구니/lastOrder 비우고 메인 페이지로 ──
  useEffect(() => {
    if (seconds <= 0) {
      clearCart();      // items + lastOrder + sessionStorage 백업까지 정리
      navigate("/");
      return;
    }
    const id = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [seconds, navigate, clearCart]);

  // 메뉴 리스트 내부 상하 스크롤
  const scrollList = (dir) => {
    listRef.current?.scrollBy({ top: dir * LIST_SCROLL_STEP, behavior: "smooth" });
  };

  const handleHome = () => {
    clearCart();        // "처음으로" 버튼 눌러 나가는 경우도 동일
    navigate("/");
  };

  return (
    <main className="kiosk-scroll end-scroll">
      {/* 감사 문구 + 자동 복귀 안내 */}
      <div className="end-head">
        <h1 className="end-title">이용해 주셔서 감사합니다</h1>
        <p className="end-sub">
          <span className="end-sec">{seconds}초</span> 후 처음으로 돌아갑니다
        </p>
      </div>

      {/* 결제 내역 리스트 + 우측 ▲▼ 스크롤 (cart 와 동일 구조, 수량 표시 추가) */}
      <div className="list-area">
        <div className="end-list" ref={listRef}>
          {displayItems.map((item) => (
            <div className="end-item" key={item.id}>
              <span className="end-name">{item.name}</span>
              <span className="end-count">{formatCount(item.count)}</span>
              <span className="end-price">{formatKRW(item.price)}</span>
            </div>
          ))}
        </div>

        <div className="list-scrollbtns">
          <button
            className="end-scroll-btn"
            onClick={() => scrollList(-1)}
            aria-label="목록 위로 스크롤"
          >
            ▲
          </button>
          <button
            className="end-scroll-btn"
            onClick={() => scrollList(1)}
            aria-label="목록 아래로 스크롤"
          >
            ▼
          </button>
        </div>
      </div>

      {/* 처음으로 버튼 (footer 없이 frame 바닥에서 100u 위) */}
      <button className="home-btn" onClick={handleHome} aria-label="처음으로">
        <svg className="home-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M3 11.5 12 4l9 7.5M5 10v9h5v-5h4v5h5v-9"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
        처음으로
      </button>
    </main>
  );
}
