import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { START_HOLD_MS as HOLD_MS } from "../../constants";
import useSessionCleanup from "../../hooks/useSessionCleanup";
import useHoldTrigger from "../../hooks/useHoldTrigger";
import iconLight from "../../assets/VINUS_icon_light.png";
import textLight from "../../assets/VINUS_text_light.png";
import "./start.css";

/* ──────────────────────────────────────────────────────────────
 * Start — 프로그램 실행 시 가장 먼저 나오는 스플래시 페이지
 *
 * 시안: VINUS_icon_light.png (캐릭터) + VINUS_text_light.png (워드마크)
 *
 * 동작:
 *  - 키보드 키 또는 마우스/터치를 START_HOLD_MS 이상 누르고 있으면 /main 이동
 *  - 짧게 클릭은 무시 (hold 만 유효)
 *
 * hold 판정은 useHoldTrigger 가 담당 — 처음 누른 자리에서 조금 움직여도
 * 유지되고(HOLD_MOVE_TOLERANCE_PX), 손을 떼거나 크게 끌면 취소된다.
 *
 * 구현 노트:
 *  - root 를 <button> 대신 <div role="button"> 으로 둠
 *    (<button> 은 Enter/Space 가 keydown 단계에서 synthetic click 을 합성)
 *  - e.repeat (OS 자동 반복) 은 무시
 * ────────────────────────────────────────────────────────────── */

export default function Start() {
  const navigate = useNavigate();
  const cleanup = useSessionCleanup();
  const heldKeyRef = useRef(null);

  const { isHolding, holdPos, holdHandlers, startHold, cancelHold } =
    useHoldTrigger({
      holdMs: HOLD_MS,
      onHold: () => navigate("/main"),
    });

  /* start(/) 진입 = 새 손님/새 시작 — 세션 정리의 "이탈 수렴점".
   * "처음으로" 버튼 / 결제 도중 이탈 / F5 / 직접 입력 전부 여기로 온다.
   *   cleanup("cancel"):
   *     backend CANCEL_SESSION (sid 없으면 자동 스킵 — end 정상 종료
   *     후처럼 이미 정리된 경우 중복 호출 없음)
   *     + resetSession + clearLastOrder                             */
  useEffect(() => {
    cleanup("cancel");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 키보드 hold (개발 편의) — 좌표가 없어 프로그레스는 표시되지 않음 */
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.repeat || heldKeyRef.current) return;
      heldKeyRef.current = e.key;
      startHold(); // pos 없음
    };
    const onKeyUp = (e) => {
      if (heldKeyRef.current === e.key) {
        heldKeyRef.current = null;
        cancelHold();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [startHold, cancelHold]);

  return (
    <div
      className="start-screen hold-target"
      role="button"
      tabIndex={0}
      aria-label="시작 화면. 아무 키나 2초간 누르고 있으면 주문이 시작됩니다."
      {...holdHandlers}
    >
      <img className="start-icon" src={iconLight} alt="" aria-hidden="true" />
      <img className="start-logo-text" src={textLight} alt="vinus" />

      {/* hold 원형 프로그레스 — 최초 터치 좌표에 고정 표시.
          키보드 hold(dev)는 holdPos 가 없어 렌더 안 함. */}
      {isHolding && holdPos && (
        <svg
          className="hold-progress"
          viewBox="0 0 100 100"
          style={{
            "--hold-ms": `${HOLD_MS}ms`,
            left: `${holdPos.x}px`,
            top: `${holdPos.y}px`,
          }}
          aria-hidden="true"
        >
          {/* 배경 링 */}
          <circle className="hold-progress-bg" cx="50" cy="50" r="45" />
          {/* 진행 링 — CSS keyframes 로 HOLD_MS 에 걸쳐 채워짐 */}
          <circle className="hold-progress-arc" cx="50" cy="50" r="45" />
        </svg>
      )}
    </div>
  );
}
