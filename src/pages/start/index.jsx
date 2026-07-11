import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { START_HOLD_MS as HOLD_MS } from "../../constants";
import useSession, { takeStaleSessionId } from "../../hooks/useSession";
import useSessionApi from "../../hooks/useSessionApi";
import useCart from "../../hooks/useCart";
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
  const { session_id, resetSession } = useSession();
  const { cancelSession } = useSessionApi();
  const { clearLastOrder } = useCart();
  const holdTimerRef = useRef(null);
  const heldKeyRef = useRef(null);
  const pointerHoldingRef = useRef(false);

  /* start(/) 진입 = 새 손님/새 시작.
   * SPA 내부 navigate("/") 로 온 경우("처음으로" 버튼, 결제 도중 이탈
   * 포함)와 full load(F5/직접 입력) 모두 여기로 수렴한다.
   *
   *   ① backend CANCEL_SESSION — 살아있는 세션이 있으면 취소.
   *       - SPA 이동:  Context 의 session_id 사용
   *       - full load: Context 는 이미 초기화 → useSession 모듈이
   *         SS 정리 직전에 보관해둔 staleSessionId 사용
   *       - end 정상 종료 후: expireSession + resetSession 을 이미
   *         거쳤으므로 둘 다 null → 호출 스킵 (중복 취소 없음)
   *       fire-and-forget — 실패해도 backend 180초 만료가 정리.
   *   ② resetSession()   → useSession 상태 + SS session_id 백업 제거
   *   ③ clearLastOrder() → 이전 주문 스냅샷(SS lastOrder 백업) 제거   */
  useEffect(() => {
    const sid = session_id || takeStaleSessionId();
    if (sid) {
      try {
        cancelSession(sid); // fire-and-forget
      } catch {
        /* ignore — 만료 타이머가 정리 */
      }
    }
    resetSession();
    clearLastOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      <img className="start-icon" src={iconLight} alt="" aria-hidden="true" />
      <img className="start-logo-text" src={textLight} alt="vinus" />
    </div>
  );
}
