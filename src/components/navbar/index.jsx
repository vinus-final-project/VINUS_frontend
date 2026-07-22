import { MdOutlineHome, MdOutlineNotifications, MdOutlineAccessTime } from "react-icons/md";
import vinusTextLight from "../../assets/VINUS_text_light.png";
import { showInfoAlert } from "../../utils/alertUtils";
import "./navbar.css";

/* ──────────────────────────────────────────────────────────────
 * Navbar — 공용 상단 네비게이션
 *
 * 페이지별 변형을 props 로 처리:
 *  - left         : "home"(처음으로) | "logo"(vinus) | "none"   (기본 "home")
 *  - timer        : 숫자를 주면 중앙에 타이머 표시
 *  - showCallStaff: 직원호출 표시 여부 (기본 true)
 *  - onHome       : '처음으로' 콜백
 *  - onCallStaff  : '직원호출' 콜백
 *
 * 아이콘은 react-icons (Material).
 * ────────────────────────────────────────────────────────────── */
export default function Navbar({
  left = "home",
  timer = null,
  showCallStaff = true,
  onHome,
  onCallStaff,
}) {
  const handleHome = () => {
    if (onHome) return onHome();
    showInfoAlert({ title: "처음으로", text: "홈으로 이동합니다." });
  };

  const handleCallStaff = () => {
    if (onCallStaff) return onCallStaff();
    showInfoAlert({ title: "직원호출", text: "직원이 도와드리러 갑니다." });
  };

  return (
    <nav className="navbar">
      {/* 좌측 */}
      <div className="navbar__left">
        {left === "home" && (
          <button className="nav-btn" onClick={handleHome} aria-label="처음으로">
            <MdOutlineHome className="nav-icon" aria-hidden="true" />
            처음으로
          </button>
        )}
        {left === "logo" && (
          <img className="navbar__logo" src={vinusTextLight} alt="vinus" />
        )}
      </div>

      {/* 중앙 타이머 */}
      <div className="navbar__center">
        {timer !== null && (
          <div
            className={`nav-timer${timer <= 30 ? " is-warning" : ""}`}
            aria-label={`남은 시간 ${timer}초`}
          >
            <MdOutlineAccessTime className="timer-icon" aria-hidden="true" />
            <span className="timer-num">{timer}</span>
          </div>
        )}
      </div>

      {/* 우측 */}
      <div className="navbar__right">
        {showCallStaff && (
          <button
            className="nav-btn nav-btn--accent"
            onClick={handleCallStaff}
            aria-label="직원호출"
          >
            <MdOutlineNotifications className="nav-icon" aria-hidden="true" />
            직원호출
          </button>
        )}
      </div>
    </nav>
  );
}
