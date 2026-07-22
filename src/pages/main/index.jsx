import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/navbar";
import { STORE_NAME } from "../../constants";
import useSession from "../../hooks/useSession";
import useWebSocket from "../../hooks/useWebSocket";
import { showInfoAlert } from "../../utils/alertUtils";
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
 * ※ 세션 초기화는 여기서 하지 않는다.
 *   main 진입 경로는 start(3초 hold)뿐이고 — 뒤로가기는 RootLayout 의
 *   popstate 가드로 차단 — start mount 가 이미 cleanup("cancel") 로
 *   이전 세션(SS 백업 포함)을 정리한 뒤라 항상 깨끗한 상태로 도착한다.
 * ────────────────────────────────────────────────────────────── */
export default function Main() {
  const navigate = useNavigate();
  const { setOrderType } = useSession();
  const { connect } = useWebSocket();

  /* mount 즉시 WebSocket 연결 (session_id 없이) */
  useEffect(() => {
    connect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCallStaff = () => {
    showInfoAlert({ title: "직원호출", text: "직원이 도와드리러 갑니다." });
    // TODO: 직원호출 API 요청
  };

  const selectOrderType = (order_type) => {
    // order_type 설정 — 세션 생성은 order 페이지 mount 에서 이어짐
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
