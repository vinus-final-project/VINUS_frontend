import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MdOutlineShoppingBasket } from "react-icons/md";
import { FaCaretLeft, FaCaretRight } from "react-icons/fa";
import Navbar from "../../components/navbar";
import { CATEGORIES, MENUS } from "../../data/sampleData";
import { ORDER_PAGE_SIZE as PAGE_SIZE, MAIN_TIME_LIMIT_SEC } from "../../constants";
import { formatKRW, formatCount } from "../../utils/format";
import { useCountdown } from "../../hooks/useCountdown";
import useCart from "../../hooks/useCart";
import "./order.css";

export default function Order() {
  const navigate = useNavigate();

  const [category, setCategory] = useState("전체");
  const [page, setPage] = useState(0);

  // 자동 종료 타이머 (180초). 0 이 되면 시작 화면으로 복귀.
  const onTimeout = useCallback(() => navigate("/"), [navigate]);
  const seconds = useCountdown(MAIN_TIME_LIMIT_SEC, onTimeout);

  // 장바구니 합계 (footer summary 표시용)
  const { totalCount, totalPrice } = useCart();

  // 선택된 카테고리로 메뉴 필터링 ("전체"면 전부)
  const menus =
    category === "전체" ? MENUS : MENUS.filter((m) => m.category === category);
  const totalPages = Math.max(1, Math.ceil(menus.length / PAGE_SIZE));
  const pageItems = menus.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  // 3x3 격자를 항상 유지: 모자란 칸은 빈 placeholder로 채움
  const cells = [
    ...pageItems,
    ...Array(PAGE_SIZE - pageItems.length).fill(null),
  ];

  /* ── 핸들러 ────────────────────────────────────────────────
   * 클릭 이벤트 작성 위치 확인용으로 버튼 이름을 alert으로 띄움.
   * 실제 페이지 이동이 필요한 곳은 navigate(...) 를 주석으로 표시.
   * ──────────────────────────────────────────────────────── */
  const handleHome = () => {
    navigate("/"); // 처음(홈) 화면으로 이동
  };

  const handleCallStaff = () => {
    alert("직원호출");
    // TODO: 직원호출 API 요청
  };

  const handleCart = () => {
    navigate("/cart"); // 장바구니 페이지로 이동
  };

  const handleCategory = (name) => {
    setCategory(name); // 카테고리 선택 → 목록 필터링
    setPage(0); // 카테고리를 바꾸면 첫 페이지로
  };

  const handleMenu = (menu) => {
    navigate(`/menu/${menu.id}`); // 메뉴 상세 페이지로 이동
  };

  const handlePrev = () => {
    setPage((p) => Math.max(0, p - 1));
  };

  const handleNext = () => {
    setPage((p) => Math.min(totalPages - 1, p + 1));
  };

  const handleOrder = () => {
    navigate("/cart"); // 장바구니(주문 내역) 페이지로 이동
  };

  return (
    <>
        {/* 상단 네비게이션 (공용 컴포넌트, 중앙 타이머) */}
        <Navbar timer={seconds} onHome={handleHome} onCallStaff={handleCallStaff} />

        {/* ── 스크롤 영역 (스크롤은 오직 이 안에서만) ─────────── */}
        <main className="kiosk-scroll order-scroll">
          {/* 장바구니 */}
          <div className="cart-row">
            <button className="cart-btn" onClick={handleCart} aria-label="장바구니">
              <MdOutlineShoppingBasket className="cart-icon" aria-hidden="true" />
              장바구니
            </button>
          </div>

          {/* 카테고리: 가로 스크롤 (디저트까지 넘겨서 볼 수 있음) */}
          <div className="category-bar" role="tablist" aria-label="메뉴 카테고리">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                role="tab"
                aria-selected={category === c}
                className={`category-btn ${category === c ? "is-active" : ""}`}
                onClick={() => handleCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>

          {/* 메뉴 격자: 3 x 3 */}
          <div className="menu-grid">
            {cells.map((menu, i) =>
              menu ? (
                <button
                  key={menu.id}
                  className="menu-card"
                  onClick={() => handleMenu(menu)}
                  aria-label={`${menu.name} ${formatKRW(menu.price)}`}
                >
                  <span className="menu-name">{menu.name}</span>
                  <span className="menu-price">{formatKRW(menu.price)}</span>
                </button>
              ) : (
                <div
                  key={`empty-${i}`}
                  className="menu-card menu-card--empty"
                  aria-hidden="true"
                />
              )
            )}
          </div>

          {/* 페이지네이션: 한 번에 9개씩 */}
          <div className="pager">
            <button
              className="pager-btn"
              onClick={handlePrev}
              disabled={page === 0}
              aria-label="이전 페이지"
            >
              <FaCaretLeft className="pager-icon" aria-hidden="true" />
            </button>
            <button
              className="pager-btn"
              onClick={handleNext}
              disabled={page >= totalPages - 1}
              aria-label="다음 페이지"
            >
              <FaCaretRight className="pager-icon" aria-hidden="true" />
            </button>
          </div>
        </main>

        {/* ── 하단 푸터 (장바구니 합계 표시) ─────────────────── */}
        <footer className="kiosk-footer order-footer">
          <div className="summary">
            <div className="summary-row">
              <span className="summary-label">수량</span>
              <span className="summary-value">{formatCount(totalCount)}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">금액</span>
              <span className="summary-value">{formatKRW(totalPrice)}</span>
            </div>
          </div>
          <button className="order-btn" onClick={handleOrder} aria-label="주문하기">
            주문
          </button>
        </footer>
    </>
  );
}
