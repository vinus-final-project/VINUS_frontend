import { useNavigate } from "react-router-dom";
import Navbar from "../../components/navbar";
import { STORE_NAME } from "../../constants";
import useSession from "../../hooks/useSession";
import "./main.css";

/* ──────────────────────────────────────────────────────────────
 * Main — 매장/포장 선택
 *
 * 1차 배포 흐름 (REST-only, WebSocket 은 backend 완성 후 재개):
 *   1) 매장/포장 선택 → order_type 만 저장 (세션 생성 X)
 *   2) /order 로 navigate
 *   3) order 페이지 mount 시 order_type 으로 세션 생성 API 호출
 *
 * order_type 매핑:
 *   매장 → "STORE"  (backend OrderType enum)
 *   포장 → "TAKEOUT"
 *
 * ⚠ WebSocket 재개 시:
 *   아래 주석 처리된 useEffect(connect()) 를 다시 활성화하거나,
 *   세션 생성 후 order.jsx 에서 connect(res.session_id) 를 호출하는
 *   방식(더 자연스러움) 으로 되돌린다.
 * ────────────────────────────────────────────────────────────── */
export default function Main() {
  const navigate = useNavigate();
  const { setOrderType } = useSession();

  // TODO(WebSocket 재개): import useWebSocket + 아래 useEffect 되살리기
  // const { connect } = useWebSocket();
  // useEffect(() => { connect(); }, []);

  const handleCallStaff = () => {
    alert("직원호출");
    // TODO: 직원호출 API 요청
  };

  const selectOrderType = (order_type) => {
    setOrderType(order_type); // 세션 생성은 order 페이지 mount 에서
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
