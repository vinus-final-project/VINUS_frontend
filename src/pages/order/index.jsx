import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MdOutlineShoppingBasket } from "react-icons/md";
import { FaCaretLeft, FaCaretRight } from "react-icons/fa";
import Navbar from "../../components/navbar";
import { formatKRW, formatCount } from "../../utils/format";
import useSessionCountdown from "../../hooks/useSessionCountdown";
import useCart from "../../hooks/useCart";
import useMenu, { getMenuBootstrapCache } from "../../hooks/useMenu";
import useSession from "../../hooks/useSession";
import useSessionApi from "../../hooks/useSessionApi";
import useOrder from "../../hooks/useOrder";
import useWebSocket from "../../hooks/useWebSocket";
import "./order.css";

/* 한 화면 메뉴 개수 — 2열 × 3행 (좌측 1열은 카테고리).
 * 이 페이지의 grid CSS(order.css .menu-grid)와 강결합이라 여기 상주. */
const PAGE_SIZE = 6;

/* /menus/all 응답 → 화면 상태 어댑터 (캐시 시드와 fetch 반영 공용) */
const adaptBootstrap = (res) => {
  const cats = res?.categories ?? [];
  const catNameById = Object.fromEntries(cats.map((c) => [c.c_id, c.c_name]));
  return {
    categories: ["전체", ...cats.map((c) => c.c_name)],
    menus: (res?.menus ?? []).map((m) => ({
      id: m.m_id,
      name: m.m_name,
      price: m.m_price,
      category: catNameById[m.c_id],
    })),
  };
};

export default function Order() {
  const navigate = useNavigate();

  const [category, setCategory] = useState("전체");
  const [page, setPage] = useState(0);

  // backend 에서 받아온 카테고리/메뉴
  //   캐시가 있으면 첫 페인트부터 채워진 상태로 시작 (빈 그리드 구간 제거)
  //   데이터 없어도(backend 미기동 등) "전체" 는 기본 표시 — 레이아웃 확인용
  const [categories, setCategories] = useState(() => {
    const cached = getMenuBootstrapCache();
    return cached ? adaptBootstrap(cached).categories : ["전체"];
  });
  const [allMenus, setAllMenus] = useState(() => {
    const cached = getMenuBootstrapCache();
    return cached ? adaptBootstrap(cached).menus : [];
  });

  // 세션 공유 카운트다운 (order/orderDetail/cart 공용, 180초)
  // 세션 생성 시점부터 시작 → 페이지 이동해도 이어짐. 0 되면 홈 + 초기화.
  const onTimeout = useCallback(() => {
    navigate("/");
  }, [navigate]);
  const seconds = useSessionCountdown(onTimeout);

  // 장바구니 합계 (footer summary 표시용)
  const { totalCount, totalPrice } = useCart();

  // 메뉴 도메인 API hook
  const { getAllMenus } = useMenu();

  // 세션: main 에서 저장한 order_type 으로 mount 시 세션 생성
  const {
    order_type,
    session_id,
    applySessionResponse,
    category: voiceCategory, // 음성 카테고리 전환 힌트 (SHOW_MENU 응답의 c_name)
    page_move: voicePageMove, // 음성 페이지 넘김 힌트 ("NEXT"|"PREV")
    page_index: voicePageIndex, // 절대 페이지 (메뉴 낭독 — 화면 동기화)
    responseSeq,
  } = useSession();
  const { createSession } = useSessionApi();
  const { createOrder } = useOrder();
  const { bindSession } = useWebSocket();
  const sessionRequestedRef = useRef(false); // StrictMode 이중 mount / 재렌더 중복 호출 방지
  const [menuBusy, setMenuBusy] = useState(false);

  /* ── 마운트 시 세션 생성 (터치를 통한 session_id 생성) ────
   *    main 에서 order_type 선택됨 + 아직 session_id 없음 → POST /sessions
   *    응답(SessionResponse)은 applySessionResponse 로 반영하고,
   *    main 에서 이미 열려있는 WS 연결에 session_id 를 bind 한다
   *    (BIND_SESSION 제어 메시지 → backend manager 가 연결↔세션 매핑).
   *    (SessionRouter 는 이미 /order 에 있으므로 추가 navigate 없음)      */
  useEffect(() => {
    if (!order_type || session_id || sessionRequestedRef.current) return;
    sessionRequestedRef.current = true;
    (async () => {
      const res = await createSession(order_type);
      if (res) {
        applySessionResponse(res);
        if (res.session_id) bindSession(res.session_id);
      } else {
        sessionRequestedRef.current = false; // 실패 시 재시도 허용
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order_type, session_id]);

  /* ── 음성 카테고리 전환 ("커피 메뉴 보여줘") ─────────────
   *    backend SHOW_MENU 응답의 category(c_name) 를 구독해 탭 전환.
   *    categories fetch 완료 후 유효한 이름일 때만 반영.               */
  useEffect(() => {
    if (voiceCategory && categories.includes(voiceCategory)) {
      setCategory(voiceCategory);
      setPage(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceCategory, categories]);

  /* ── 음성 페이지 넘김 ("다음 페이지" → NEXT/PREV) ─────────
   *    responseSeq 기반 — 같은 방향 연속 발화도 매번 동작.
   *    범위 클램프(0 ~ totalPages-1)는 페이지 수를 아는 프론트 담당.   */
  useEffect(() => {
    if (!voicePageMove) return;
    setPage((p) => {
      const next = voicePageMove === "NEXT" ? p + 1 : p - 1;
      const total = Math.max(
        1,
        Math.ceil(
          (category === "전체"
            ? allMenus.length
            : allMenus.filter((m) => m.category === category).length) / PAGE_SIZE
        )
      );
      return Math.min(Math.max(next, 0), total - 1);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [responseSeq]);

  /* ── 절대 페이지 지정 (메뉴 낭독 — "커피 뭐 있어"/"다음") ──
   *    backend 가 낭독 중인 페이지 번호를 내려보내 화면을 동기화.
   *    클램프는 backend(총개수 아는 쪽)가 이미 수행 — 그대로 반영.
   *    카테고리 전환 effect 보다 뒤에 배치 — 같은 응답에 category 와
   *    page_index 가 함께 오면 절대 페이지가 최종 승자.               */
  useEffect(() => {
    if (typeof voicePageIndex === "number") {
      setPage(voicePageIndex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [responseSeq]);

  /* ── 마운트 시 카테고리 + 전체 메뉴 일괄 fetch (GET /menus/all 1회) ──
   *    기존 6회 호출(카테고리 1 + 카테고리별 메뉴 5)을 1회로 축소.
   *    "전체" 가상 카테고리는 client 측에서만 사용 (filter 미적용 시 전체 노출)
   *    응답 스키마: { categories:[{c_id,c_name}], menus:[{m_id,c_id,m_name,m_price}] } */
  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await getAllMenus(); // 캐시 있으면 서버 호출 없이 즉시 반환
      if (!alive || !res) return;
      const adapted = adaptBootstrap(res);
      setCategories(adapted.categories);
      setAllMenus(adapted.menus);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 선택된 카테고리로 메뉴 필터링 ("전체"면 전부)
  const menus =
    category === "전체" ? allMenus : allMenus.filter((m) => m.category === category);
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

  /* 메뉴 카드 클릭 → POST /orders (SELECT_MENU 이벤트)
   *   backend가 order_item 을 생성하고 current_menu 를 SessionResponse에 담아
   *   반환. 응답을 useSession 에 반영한 뒤 orderDetail 로 이동.                */
  const handleMenu = async (menu) => {
    if (menuBusy) return;
    if (!session_id) {
      alert("세션이 만료되었습니다. 처음부터 다시 시도해주세요.");
      navigate("/");
      return;
    }
    setMenuBusy(true);
    try {
      const res = await createOrder(session_id, menu.id);
      if (res) applySessionResponse(res);
      // res 실패해도 화면 이동은 시도 (backend 미완성 상황 대비)
      navigate(`/menu/${menu.id}`);
    } finally {
      setMenuBusy(false);
    }
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

          {/* ── 본문: [카테고리 1열] + [메뉴 2×3 + 페이지네이션] ── */}
          <div className="order-body">
            {/* 카테고리: 세로 목록 (좌측 1열) */}
            <div
              className="category-col"
              role="tablist"
              aria-label="메뉴 카테고리"
              aria-orientation="vertical"
            >
              {categories.map((c) => (
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

            <div className="menu-area">
              {/* 메뉴 격자: 2 x 3 */}
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

              {/* 페이지네이션: 한 번에 6개씩 (메뉴 두 열 아래 정렬) */}
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
            </div>
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
            결제
          </button>
        </footer>
    </>
  );
}
