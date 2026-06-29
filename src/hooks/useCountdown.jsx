import { useEffect, useState } from "react";

/* ──────────────────────────────────────────────────────────────
 * useCountdown — N초에서 1초씩 감소, 0 이 되면 onExpire 호출.
 *
 * 사용:
 *   const seconds = useCountdown(180, () => navigate("/"));
 *   <Navbar timer={seconds} ... />
 * ────────────────────────────────────────────────────────────── */
export function useCountdown(initial, onExpire) {
  const [seconds, setSeconds] = useState(initial);
  useEffect(() => {
    if (seconds <= 0) {
      onExpire?.();
      return;
    }
    const id = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [seconds, onExpire]);
  return seconds;
}
