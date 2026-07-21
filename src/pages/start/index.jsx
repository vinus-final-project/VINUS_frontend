import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { START_HOLD_MS as HOLD_MS } from "../../constants";
import useSessionCleanup from "../../hooks/useSessionCleanup";
import iconLight from "../../assets/VINUS_icon_light.png";
import textLight from "../../assets/VINUS_text_light.png";
import "./start.css";

/* ──────────────────────────────────────────────────────────────
 * Start — 프로그램 실행 시 가장 먼저 나오는 스플래시 페이지
 *
 * 시안: VINUS_icon_light.png (캐릭터) + VINUS_text_light.png (워드마크)
 *
 * 동작:
 *  - 키보드 키 또는 마우스/터치를 3초 이상 누르고 있으면 /main 으로 이동
 *  - 짧게 클릭 시 alert("화면")  — 이벤트 작성 위치 식별용
 *
 * 구현 노트:
 *  - root 를 <button> 대신 <div role="button"> 으로 둠
 *    (<button> 은 Enter/Space 가 keydown 단계에서 synthetic click 을 합성)
 *  - e.repeat (OS 자동 반복) 은 무시
 *  - 시각적 진행 표시는 시안에 없으므로 제거 (기능만 유지)
 * ────────────────────────────────────────────────────────────── */

export default function Start() {
  const navigate = useNavigate();
  const cleanup = useSessionCleanup();
  const holdTimerRef = useRef(null);
  const heldKeyRef = useRef(null);
  const pointerHoldingRef = useRef(false);
  /*  3초 hold 시각화:
   *    - isHolding : SVG 마운트/애니메이션 스위치
   *    - holdPos   : 실제 터치 좌표 (viewport 기준 px). 포인터 hold 만 세팅.
   *                  키보드 hold 는 좌표가 없으므로 null → 프로그레스 표시 안 함. */
  const [isHolding, setIsHolding] = useState(false);
  const [holdPos, setHoldPos] = useState(null);

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

  const startHold = () => {
    if (holdTimerRef.current) return;
    setIsHolding(true);
    holdTimerRef.current = setTimeout(() => {
      holdTimerRef.current = null;
      heldKeyRef.current = null;
      pointerHoldingRef.current = false;
      setIsHolding(false);
      navigate("/main");
    }, HOLD_MS);
  };

  const cancelHold = () => {
    if (!holdTimerRef.current) return;
    clearTimeout(holdTimerRef.current);
    holdTimerRef.current = null;
    heldKeyRef.current = null;
    pointerHoldingRef.current = false;
    setIsHolding(false);
    setHoldPos(null);
  };

  /* 키보드 hold */
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.repeat || heldKeyRef.current) return;
      heldKeyRef.current = e.key;
      startHold();
    };
    const onKeyUp = (e) => {
      if (heldKeyRef.current === e.key) cancelHold();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      cancelHold();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 포인터 hold (마우스/터치) — 실제 터치 좌표를 저장해 그 자리에 프로그레스 표시 */
  const onPointerDown = (e) => {
    pointerHoldingRef.current = true;
    setHoldPos({ x: e.clientX, y: e.clientY });
    startHold();
  };
  const onPointerEndAny = () => {
    if (pointerHoldingRef.current) cancelHold();
  };

  /* 짧게 클릭은 무시 (3초 hold 만 유효) */
  const handleScreenClick = () => {
    // TODO: 실제 동작 (예: 음성 안내 시작) 연결
  };

  return (
    <div
      className="start-screen"
      role="button"
      tabIndex={0}
      aria-label="시작 화면. 아무 키나 3초간 누르고 있으면 주문이 시작됩니다."
      onClick={handleScreenClick}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerEndAny}
      onPointerCancel={onPointerEndAny}
      onPointerLeave={onPointerEndAny}
    >
      <img className="start-icon" src={iconLight} alt="" aria-hidden="true" />
      <img className="start-logo-text" src={textLight} alt="vinus" />

      {/* 3초 hold 원형 프로그레스 — 실제 터치 좌표에 작게 표시.
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
          {/* 진행 링 — CSS keyframes 로 3초에 걸쳐 채워짐 */}
          <circle className="hold-progress-arc" cx="50" cy="50" r="45" />
        </svg>
      )}
    </div>
  );
}
