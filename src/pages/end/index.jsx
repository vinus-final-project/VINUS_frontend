import { useMemo, useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AUTO_HOME_SEC, LIST_SCROLL_STEP, readOrderNo } from "../../constants";
import { formatKRW, formatCount } from "../../utils/format";
import useCart from "../../hooks/useCart";
import useMenu, { getMenuUnit } from "../../hooks/useMenu";
import useSessionCleanup from "../../hooks/useSessionCleanup";
import "./end.css";

/* ──────────────────────────────────────────────────────────────
 * End — 결제 완료 안내 (자동 홈 복귀)
 *
 * 홈("/") 으로 나가기 전에 cleanup("expire") 로 정상 종료:
 *   backend DELETE /sessions/{sid} (세션+cart 통째 소멸)
 *   + resetSession + clearLastOrder  (useSessionCleanup 이 통합 처리)
 * 이후 start 진입 시 sid 가 이미 null 이라 cancel 중복 호출 없음.
 * ────────────────────────────────────────────────────────────── */

export default function End() {
  const navigate = useNavigate();
  const { lastOrder } = useCart();
  const cleanup = useSessionCleanup();
  const { getAllMenus } = useMenu();

  /*  수량 단위(잔/개) 판정용 부트스트랩 캐시 웜업.
   *  Toss 리다이렉트 full reload 후엔 order 페이지를 안 거쳐 캐시가
   *  비어 있으므로 여기서 1회 로드 (캐시 있으면 서버 호출 없음).
   *  로드 완료 시 unitReady 로 재렌더 → getMenuUnit 이 실단위 반환.   */
  const [unitReady, setUnitReady] = useState(false);
  useEffect(() => {
    let alive = true;
    getAllMenus().then(() => {
      if (alive) setUnitReady(true);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // pay 단계에서 placeOrder() 로 snapshot 된 lastOrder 를 end-item 표시 형식으로 변환.
  // lastOrder 가 비어있으면(직접 /end 진입 등) 빈 리스트로 렌더.
  const displayItems = useMemo(() => {
    if (!lastOrder || lastOrder.length === 0) return [];
    return lastOrder.map((it) => ({
      id: it.id,
      name: it.m_name,
      count: it.o_m_qty,
      unit: getMenuUnit(it.m_id), // 디저트 "개" / 음료 "잔"
      price: it.unitPrice * it.o_m_qty,
      // 선택된 옵션 텍스트 (cart 페이지와 동일 포맷 — 누적 옵션은 개수 표시)
      opts: (it.options ?? [])
          .map((op) => (op.qty > 1 ? `${op.op_name} ${op.qty}개` : op.op_name))
          .join(", "),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastOrder, unitReady]);

  const listRef = useRef(null); // 메뉴 리스트 내부 스크롤 영역
  const [seconds, setSeconds] = useState(AUTO_HOME_SEC);

  /*  hook 함수를 최신 참조로 유지 (deps 재실행/무한 호출 방지 — #109) */
  const cleanupRef = useRef(cleanup);
  const navigateRef = useRef(navigate);
  useEffect(() => {
    cleanupRef.current = cleanup;
    navigateRef.current = navigate;
  }, [cleanup, navigate]);

  /*  한 번만 실행되도록 flag — seconds===0 재렌더 사이 재호출 방지.        */
  const finishedRef = useRef(false);

  /*  세션 완전 정리(정상 종료) + 홈 이동을 한 번만 수행.
   *  cleanup("expire") 는 backend DELETE + reset + clearLastOrder 통합.
   *  fire-and-forget — 홈 이동을 지연시키지 않는다.                        */
  const cleanupAndGoHome = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    try { cleanupRef.current?.("expire"); } catch { /* ignore */ }
    navigateRef.current?.("/");
  };

  // ── 카운트다운: 1초씩 감소 ──────────────────────────────
  useEffect(() => {
    if (seconds <= 0) return;
    const id = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [seconds]);

  // ── 시간 초과 시 정리(한 번만) + 메인 이동 ───────────────
  useEffect(() => {
    if (seconds > 0) return;
    cleanupAndGoHome();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds]);

  // 메뉴 리스트 내부 상하 스크롤
  const scrollList = (dir) => {
    listRef.current?.scrollBy({ top: dir * LIST_SCROLL_STEP, behavior: "smooth" });
  };

  // "처음으로" 버튼 — 사용자 수동 이동. 동일 정리 로직 재사용.
  const handleHome = () => cleanupAndGoHome();

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
                <div
                    className={`end-item${item.opts ? " has-opts" : ""}`}
                    key={item.id}
                >
                  <span className="end-name">{item.name}</span>
                  {/* 선택된 옵션 — 메뉴명 아래 (cart 카드와 동일 방식) */}
                  {item.opts && <span className="end-opts">{item.opts}</span>}
                  <span className="end-count">{formatCount(item.count, item.unit)}</span>
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
