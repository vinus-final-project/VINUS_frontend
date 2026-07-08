import { useMemo, useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AUTO_HOME_SEC, LIST_SCROLL_STEP } from "../../constants";
import { formatKRW, formatCount } from "../../utils/format";
import useCart from "../../hooks/useCart";
import useSession from "../../hooks/useSession";
import useSessionApi from "../../hooks/useSessionApi";
import "./end.css";

/* ──────────────────────────────────────────────────────────────
 * End — 결제 완료 안내 (자동 홈 복귀)
 *
 * 홈("/") 은 우리 서비스 밖의 기존 키오스크 화면이므로, 여기서 나가기 전에
 * backend 세션을 정상 종료(EXPIRE_SESSION)하고 프론트 세션도 완전 초기화해야
 * 다음 손님이 이전 세션을 이어쓰지 않는다.
 *   1) clearLastOrder()     — 로컬 lastOrder 스냅샷 초기화 (backend REST 없음)
 *   2) expireSession(sid)   — backend DELETE /sessions/{sid} (세션+cart 통째 소멸)
 *   3) resetSession()       — useSession 상태 INITIAL_STATE + SS session_id 백업 제거
 *   4) navigate("/")        — 스플래시로 복귀
 *
 * ※ backend cart 는 세션 소멸로 자동 삭제되므로 별도 clearCart 호출 안 함.
 *   fsm_state=COMPLETE 이후에도 CLEAR_CART 이벤트가 invalid transition 일 수 있어
 *   중복 호출을 제거하는 편이 안전.
 * ────────────────────────────────────────────────────────────── */

export default function End() {
  const navigate = useNavigate();
  const { lastOrder, clearLastOrder } = useCart();
  const { session_id, resetSession } = useSession();
  const { expireSession } = useSessionApi();

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

  /*  hook 내부 함수/값을 최신 참조로 유지하되 useEffect 는 재실행되지
   *  않도록 ref 로 래핑. hook 함수들이 매 렌더 새 참조라서 deps 에 넣으면
   *  seconds===0 시점에 무한 호출이 되던 문제(#109) 방어.                  */
  const clearLastOrderRef = useRef(clearLastOrder);
  const expireSessionRef = useRef(expireSession);
  const resetSessionRef = useRef(resetSession);
  const navigateRef = useRef(navigate);
  const sessionIdRef = useRef(session_id);
  useEffect(() => {
    clearLastOrderRef.current = clearLastOrder;
    expireSessionRef.current = expireSession;
    resetSessionRef.current = resetSession;
    navigateRef.current = navigate;
    sessionIdRef.current = session_id;
  }, [clearLastOrder, expireSession, resetSession, navigate, session_id]);

  /*  한 번만 실행되도록 flag — seconds===0 재렌더 사이 재호출 방지.        */
  const finishedRef = useRef(false);

  /*  세션 완전 정리 + 홈 이동을 한 번만 수행.
   *  expireSession 은 fire-and-forget — 홈 이동을 지연시키지 않는다.       */
  const cleanupAndGoHome = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const sid = sessionIdRef.current;
    try { clearLastOrderRef.current?.(); } catch { /* ignore */ }
    if (sid) {
      try { expireSessionRef.current?.(sid); } catch { /* ignore */ }
    }
    resetSessionRef.current?.();
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
