import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/navbar";
import { STORE_NAME } from "../../constants";
import useSession from "../../hooks/useSession";
import useWebSocket from "../../hooks/useWebSocket";
import "./main.css";

/* ──────────────────────────────────────────────────────────────
 * Main — 매장/포장 선택
 *
 * WebSocket 연결 시점 = 이 페이지 mount 직후 (start 3초 hold 후 진입).
 * 아직 session_id 가 없는 상태로 연결한다.
 *
 * session_id 생성 두 갈래:
 *   <터치>  매장/포장 선택 → order 페이지 mount 시 POST /sessions
 *           → SessionResponse 로 session_id 수신
 *   <음성>  "매장이요" 첫 발화가 session_id 없이 WS 로 전송
 *           → backend 가 세션 생성 + WS 매니저가 연결↔session_id 매핑
 *           → SessionResponse 에 session_id 실려 수신
 *
 * order_type 매핑:
 *   매장 → "STORE"  (backend OrderType enum)
 *   포장 → "TAKEOUT"
 *
 * ⚠ 이전 세션 이어쓰기 방지:
 *   sessionStorage 에 이전 session_id 가 남아 있으면 useSession 이 그 값으로
 *   시작한다(Toss 리다이렉트 대응 정책). 결제를 완주하지 않고 이탈한 경우
 *   backend 에는 이전 세션이 살아 있고, main 재진입 시 그 세션을 계속
 *   이어쓰면서 이전 cart/order_item 이 응답에 다시 나타나는 문제가 있다.
 *   → 매장/포장 선택 = "새 주문 시작" 의도이므로 이 시점에 resetSession()
 *     을 호출해 SS 백업까지 지우고 강제로 새 세션 흐름을 시작한다.
 *   Toss 리다이렉트는 /pay 로 복귀하므로 main 을 안 거쳐 SS 복구 기능은
 *   그대로 유지된다.
 * ────────────────────────────────────────────────────────────── */
export default function Main() {
  const navigate = useNavigate();
  const { setOrderType, resetSession } = useSession();
  const { connect } = useWebSocket();

  /* mount 즉시 WebSocket 연결 (session_id 없이) */
  useEffect(() => {
    connect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCallStaff = () => {
    alert("직원호출");
    // TODO: 직원호출 API 요청
  };

  const selectOrderType = (order_type) => {
    // (1) 이전 세션 완전 초기화 (SS_SID_KEY 도 함께 제거됨)
    resetSession();
    // (2) 새 주문의 order_type 설정 — 세션 생성은 order 페이지 mount 에서 이어짐
    setOrderType(order_type);
    navigate("/order");
  };

  const handleDineIn = () => selectOrderType("STORE");
  const handleTakeOut = () => selectOrderType("TAKEOUT");

  return (
    <>
        {/* 상단 네비게이션 (공용 컴포넌트, 좌측 로고) */}
        <Navbar left="logo" onCallStaff={handleCallStaff} />

        {/* ── 본문 (절대 위치 레이아웃) ─────────────────────── */}
        <main className="kiosk-scroll main-scroll">
          {/* 가맹점명 카드 */}
          <div className="store-name">{STORE_NAME}</div>

          {/* 안내 문구 */}
          <p className="main-guide">
            매장 / 포장 여부를 선택하여
            <br />
            주문을 시작하세요
          </p>

          {/* 매장 / 포장 선택 */}
          <div className="choice-row">
            <button className="choice-btn" onClick={handleDineIn} aria-label="매장">
              매장
            </button>
            <button className="choice-btn" onClick={handleTakeOut} aria-label="포장">
              포장
            </button>
          </div>
        </main>
    </>
  );
}
