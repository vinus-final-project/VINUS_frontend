import { useCallback, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "../../components/navbar";
import { MENU_OPTIONS, getMenuById } from "../../data/sampleData";
import { MAIN_TIME_LIMIT_SEC } from "../../constants";
import { formatKRW } from "../../utils/format";
import { useCountdown } from "../../hooks/useCountdown";
import useCart from "../../hooks/useCart";
import "./orderDetail.css";

const { cups: CUPS, sugarPumps: SUGAR_PUMPS, strengths: STRENGTHS, paid: PAID_OPTIONS } = MENU_OPTIONS;

const DEFAULT_DESC = "원하시는 옵션을 선택한 뒤 장바구니에 담아주세요.";

export default function OrderDetail() {
  const navigate = useNavigate();
  const { menuId } = useParams();
  const { addItem } = useCart();

  // 라우트 :menuId 로 메뉴 데이터 조회. 없으면 첫 번째 메뉴로 fallback.
  const menuData = getMenuById(menuId);
  const MENU = {
    id:    menuData?.id    ?? "unknown",
    name:  menuData?.name  ?? "메뉴",
    price: menuData?.price ?? 0,
    desc:  menuData?.desc  ?? DEFAULT_DESC,
  };

  // 자동 종료 타이머 (180초)
  const onTimeout = useCallback(() => navigate("/"), [navigate]);
  const seconds = useCountdown(MAIN_TIME_LIMIT_SEC, onTimeout);

  const [cup, setCup] = useState("일회용");
  const [freeOpen, setFreeOpen] = useState(false); // 무료 옵션 아코디언
  const [paidOpen, setPaidOpen] = useState(false); // 유료 옵션 아코디언
  const [sugar, setSugar] = useState(1);
  const [strength, setStrength] = useState("연하게");
  const [quantity, setQuantity] = useState(1);

  // 유료 옵션 개수 (사용자가 직접 +/- 로 조절)
  const [paidCounts, setPaidCounts] = useState({
    vanilla: 0,
    shot: 0,
    pearl: 0,
    javachip: 0,
    whip: 0,
  });

  const freeScrollRef = useRef(null); // 무료 옵션 내부 스크롤 영역
  const paidScrollRef = useRef(null); // 유료 옵션 내부 스크롤 영역

  const paidTotal = PAID_OPTIONS.reduce(
    (sum, o) => sum + o.price * (paidCounts[o.id] || 0),
    0
  );

  /* ── 핸들러: 클릭 위치 확인용 alert + 이동은 navigate 주석 ── */
  const handleHome = () => {
    navigate("/"); // 처음(홈) 화면으로 이동
  };
  const handleCallStaff = () => {
    alert("직원호출");
    // TODO: 직원호출 API 요청
  };

  const handleCup = (c) => setCup(c); // 컵 선택

  const toggleFree = () => setFreeOpen((v) => !v); // 무료 옵션 펼치기/접기
  const togglePaid = () => setPaidOpen((v) => !v); // 유료 옵션 펼치기/접기

  const handleSugar = (n) => setSugar(n); // 설탕시럽(펌프) 선택
  const handleStrength = (s) => setStrength(s); // 농도 선택

  const handlePaidCount = (option, delta) => {
    // 유료 옵션 개수 증감 (0 미만 방지)
    setPaidCounts((prev) => ({
      ...prev,
      [option.id]: Math.max(0, (prev[option.id] || 0) + delta),
    }));
  };

  // 옵션 영역 내부 상하 스크롤 (무료/유료 공용 로직)
  const scrollFree = (dir) => {
    freeScrollRef.current?.scrollBy({ top: dir * 130, behavior: "smooth" });
  };
  const scrollPaid = (dir) => {
    paidScrollRef.current?.scrollBy({ top: dir * 130, behavior: "smooth" });
  };

  const handleQuantity = (delta) => {
    setQuantity((q) => Math.max(1, q + delta)); // 수량 증감 (최소 1)
  };

  const handleCancel = () => {
    navigate("/order"); // 전체 메뉴 페이지로 이동
  };
  const handleConfirm = () => {
    // 선택한 옵션/수량을 장바구니에 담기
    const selectedPaid = PAID_OPTIONS
      .filter((o) => (paidCounts[o.id] || 0) > 0)
      .map((o) => ({
        id: o.id,
        name: o.name,
        price: o.price,
        count: paidCounts[o.id],
      }));
    const paidTotalPerUnit = selectedPaid.reduce(
      (sum, p) => sum + p.price * p.count,
      0
    );
    const unitPrice = MENU.price + paidTotalPerUnit;

    addItem({
      menuId: MENU.id,
      name: MENU.name,
      basePrice: MENU.price,
      cup,
      sugar,
      strength,
      paid: selectedPaid,
      quantity,
      unitPrice,
    });

    navigate("/order"); // 장바구니에 담은 뒤 전체 메뉴 페이지로 복귀
  };

  return (
    <>
        {/* 상단 네비게이션 (공용 컴포넌트, 중앙 타이머) */}
        <Navbar timer={seconds} onHome={handleHome} onCallStaff={handleCallStaff} />

        {/* ── 스크롤 영역 (스크롤은 오직 이 안에서만) ─────────── */}
        <main className="kiosk-scroll order-detail-scroll">
          {/* 메뉴 정보 카드 */}
          <section className="info-card">
            <h1 className="info-name">{MENU.name}</h1>
            <p className="info-desc">{MENU.desc}</p>
            <p className="info-price">{formatKRW(MENU.price)}</p>
          </section>

          {/* 필수옵션 카드 (컵 선택) — 항상 펼쳐진 형태 */}
          <section className="opt-card">
            <h2 className="opt-title">컵 선택</h2>
            <div className="chip-row">
              {CUPS.map((c) => (
                <button
                  key={c}
                  className={`chip ${cup === c ? "is-active" : ""}`}
                  aria-pressed={cup === c}
                  onClick={() => handleCup(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </section>

          {/* 무료 옵션 (아코디언) — 설탕시럽 + 농도 */}
          <section className={`acc ${freeOpen ? "is-open" : ""}`}>
            <button className="acc-head" onClick={toggleFree} aria-expanded={freeOpen}>
              <span className="acc-title">무료 옵션</span>
              <span className="acc-toggle">
                {freeOpen ? "접기 ▲" : "자세히 ▼"}
              </span>
            </button>

            {freeOpen && (
              <div className="acc-body">
                <div className="acc-scroll-area">
                  <div className="acc-scroll-list" ref={freeScrollRef}>
                    <p className="opt-label">설탕시럽(펌프)</p>
                    <div className="chip-row">
                      {SUGAR_PUMPS.map((n) => (
                        <button
                          key={n}
                          className={`chip ${sugar === n ? "is-active" : ""}`}
                          aria-pressed={sugar === n}
                          onClick={() => handleSugar(n)}
                        >
                          {n}
                        </button>
                      ))}
                    </div>

                    <hr className="opt-divider" />

                    <p className="opt-label">농도</p>
                    <div className="chip-row">
                      {STRENGTHS.map((s) => (
                        <button
                          key={s}
                          className={`chip ${strength === s ? "is-active" : ""}`}
                          aria-pressed={strength === s}
                          onClick={() => handleStrength(s)}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 내부 상하 스크롤 버튼 (유료옵션과 동일) */}
                  <div className="acc-scrollbtns">
                    <button
                      className="acc-scroll-btn"
                      onClick={() => scrollFree(-1)}
                      aria-label="옵션 위로 스크롤"
                    >
                      ▲
                    </button>
                    <button
                      className="acc-scroll-btn"
                      onClick={() => scrollFree(1)}
                      aria-label="옵션 아래로 스크롤"
                    >
                      ▼
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* 유료 옵션 (아코디언) */}
          <section className={`acc ${paidOpen ? "is-open" : ""}`}>
            <button className="acc-head" onClick={togglePaid} aria-expanded={paidOpen}>
              <span className="acc-title">유료 옵션</span>
              <span className="acc-toggle">
                {paidOpen ? "접기 ▲" : "자세히 ▼"}
              </span>
            </button>

            {paidOpen && (
              <div className="acc-body">
                <div className="acc-scroll-area">
                  {/* 내부 스크롤 영역: ▲▼ 버튼으로 더 많은 옵션 확인 */}
                  <div className="acc-scroll-list" ref={paidScrollRef}>
                    {PAID_OPTIONS.map((o, idx) => (
                      <div className="paid-item" key={o.id}>
                        <div className="paid-item-top">
                          <span className="paid-name">{o.name}</span>
                          <span className="paid-price">{formatKRW(o.price)}</span>
                        </div>
                        <div className="stepper">
                          <button
                            className="step-btn"
                            onClick={() => handlePaidCount(o, -1)}
                            aria-label={`${o.name} 감소`}
                          >
                            −
                          </button>
                          <span className="step-count">{paidCounts[o.id] || 0}</span>
                          <button
                            className="step-btn"
                            onClick={() => handlePaidCount(o, 1)}
                            aria-label={`${o.name} 증가`}
                          >
                            +
                          </button>
                        </div>
                        {idx < PAID_OPTIONS.length - 1 && (
                          <hr className="opt-divider" />
                        )}
                      </div>
                    ))}
                  </div>

                  {/* 내부 상하 스크롤 버튼 */}
                  <div className="acc-scrollbtns">
                    <button
                      className="acc-scroll-btn"
                      onClick={() => scrollPaid(-1)}
                      aria-label="옵션 위로 스크롤"
                    >
                      ▲
                    </button>
                    <button
                      className="acc-scroll-btn"
                      onClick={() => scrollPaid(1)}
                      aria-label="옵션 아래로 스크롤"
                    >
                      ▼
                    </button>
                  </div>
                </div>

                <div className="paid-total">
                  <span className="paid-total-label">합계</span>
                  <span className="paid-total-value">{formatKRW(paidTotal)}</span>
                </div>
              </div>
            )}
          </section>

          {/* 수량 */}
          <div className="qty-row">
            <button
              className="qty-btn"
              onClick={() => handleQuantity(-1)}
              aria-label="수량 감소"
            >
              −
            </button>
            <span className="qty-count">{quantity}</span>
            <button
              className="qty-btn"
              onClick={() => handleQuantity(1)}
              aria-label="수량 증가"
            >
              +
            </button>
          </div>
        </main>

        {/* ── 하단 푸터 (항상 고정) ─────────────────────────── */}
        <footer className="kiosk-footer order-detail-footer">
          <button className="bottom-btn bottom-btn--ghost" onClick={handleCancel}>
            취소
          </button>
          <button className="bottom-btn bottom-btn--accent" onClick={handleConfirm}>
            선택 완료
          </button>
        </footer>
    </>
  );
}
