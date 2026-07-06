import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { START_HOLD_MS as HOLD_MS } from "../../constants";
import { useVad } from "../../hooks/useVad";
import iconLight from "../../assets/VINUS_icon_light.png";
import textLight from "../../assets/VINUS_text_light.png";
import "./start.css";

/* ──────────────────────────────────────────────────────────────
 * Start — 프로그램 실행 시 가장 먼저 나오는 스플래시 페이지
 * (설명 생략 — 기존 주석 유지)
 * ────────────────────────────────────────────────────────────── */

export default function Start() {
  const navigate = useNavigate();
  const holdTimerRef = useRef(null);
  const heldKeyRef = useRef(null);
  const pointerHoldingRef = useRef(false);

  /* ===== [VAD 테스트용] — 확인 끝나면 이 블록 지우면 됨 ===== */
  const { start: vadStart, stop: vadStop } = useVad({
    onUtterance: (pcm) => {
      console.log(
        "발화 감지! 샘플:",
        pcm.length,
        "≈",
        (pcm.length / 16000).toFixed(2),
        "초"
      );
    },
  });

  const handleVadStart = (e) => {
    e.stopPropagation(); // 스플래시 hold/click 안 걸리게
    vadStart().catch((err) => console.error("VAD start 실패:", err));
  };
  const handleVadStop = (e) => {
    e.stopPropagation();
    vadStop();
  };
  /* ===== [VAD 테스트용] 끝 ===== */

  const startHold = () => {
    if (holdTimerRef.current) return;
    holdTimerRef.current = setTimeout(() => {
      holdTimerRef.current = null;
      heldKeyRef.current = null;
      pointerHoldingRef.current = false;
      navigate("/main");
    }, HOLD_MS);
  };

  const cancelHold = () => {
    if (!holdTimerRef.current) return;
    clearTimeout(holdTimerRef.current);
    holdTimerRef.current = null;
    heldKeyRef.current = null;
    pointerHoldingRef.current = false;
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

  /* 포인터 hold (마우스/터치) */
  const onPointerDown = () => {
    pointerHoldingRef.current = true;
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
      {/* ===== [VAD 테스트용 버튼] — 확인 끝나면 지우면 됨 ===== */}
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          zIndex: 9999,
          display: "flex",
          gap: 8,
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button type="button" onClick={handleVadStart}>
          🎤 듣기 시작
        </button>
        <button type="button" onClick={handleVadStop}>
          ⏹ 정지
        </button>
      </div>
      {/* ===== [VAD 테스트용 버튼] 끝 ===== */}

      <img className="start-icon" src={iconLight} alt="" aria-hidden="true" />
      <img className="start-logo-text" src={textLight} alt="vinus" />
    </div>
  );
}