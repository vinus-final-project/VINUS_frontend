import { useNavigate } from "react-router-dom";
import Navbar from "../../components/navbar";
import "./main.css";

import { STORE_NAME } from "../../data/sampleData";

export default function Main() {
  const navigate = useNavigate();

  const handleCallStaff = () => {
    alert("직원호출");
    // TODO: 직원호출 API 요청
  };

  const handleDineIn = () => {
    // 매장: 주문 유형을 state로 전달하며 전체 메뉴로 이동
    navigate("/order", { state: { orderType: "dineIn" } });
  };

  const handleTakeOut = () => {
    // 포장: 주문 유형을 state로 전달하며 전체 메뉴로 이동
    navigate("/order", { state: { orderType: "takeOut" } });
  };

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
