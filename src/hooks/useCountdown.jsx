import { useEffect, useRef, useState } from "react";

/* ──────────────────────────────────────────────────────────────
 * useCountdown — N초에서 1초씩 감소, 0 이 되면 onExpire 호출.
 *
 * onExpire 는 매 렌더마다 새 참조일 수 있으므로 useRef 로 최신값만
 * 유지하고, useEffect 의 dependency 는 seconds 하나로 둔다.
 * (그렇지 않으면 매 렌더마다 setTimeout 이 clear/set 되면서
 *  카운트다운이 정지되거나 예기치 않게 재시작될 수 있음.)
 *
 * 사용:
 *   const seconds = useCountdown(180, () => navigate("/"));
 *   <Navbar timer={seconds} ... />
 * ────────────────────────────────────────────────────────────── */
export function useCountdown(initial, onExpire) {
  const [seconds, setSeconds] = useState(initial);
  const cbRef = useRef(onExpire);
  // 매 렌더에서 최신 콜백을 참조에 저장(re-render 로 인한 dep 변경 방지)
  cbRef.current = onExpire;

  useEffect(() => {
    if (seconds <= 0) {
      cbRef.current?.();
      return;
    }
    const id = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [seconds]);

  return seconds;
}
