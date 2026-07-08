import { useEffect, useRef, useState } from "react";
import useSession from "./useSession";

/* ──────────────────────────────────────────────────────────────
 * useSessionCountdown — order/orderDetail/cart 공유 카운트다운
 *
 * useSession.countdown_deadline_at (ms timestamp) 를 참조해 매 초 남은
 * 초를 계산한다. 페이지가 바뀌어도 deadline 은 useSession 에 남아 있으므로
 * 새로 시작되지 않고 이어진다.
 *
 * ▸ 시작 시점: session_id 최초 세팅 시(=order 페이지 세션 생성 완료).
 *   자세한 로직은 useSession.applySessionResponse 참조.
 * ▸ 만료 시: onExpire 콜백 실행. resetSession + navigate("/") 를 여기서 함께
 *   호출하는 게 일반적인 사용.
 * ▸ payment/pay 페이지는 자체 useCountdown(30) 을 유지해야 하므로 이 훅을
 *   사용하지 않는다.
 *
 * 사용 예
 *   const seconds = useSessionCountdown(() => {
 *     resetSession();
 *     navigate("/");
 *   });
 *   <Navbar timer={seconds} ... />
 * ────────────────────────────────────────────────────────────── */
export default function useSessionCountdown(onExpire) {
    const { countdown_deadline_at } = useSession();

    // onExpire 는 매 렌더마다 새 참조일 수 있으므로 ref 로 유지
    const cbRef = useRef(onExpire);
    cbRef.current = onExpire;

    // 남은 초 계산
    const calc = () => {
        if (!countdown_deadline_at) return 0;
        return Math.max(
            0,
            Math.ceil((countdown_deadline_at - Date.now()) / 1000)
        );
    };
    const [seconds, setSeconds] = useState(calc);

    useEffect(() => {
        if (!countdown_deadline_at) {
            setSeconds(0);
            return;
        }
        // deadline 이 바뀌면 즉시 재계산
        setSeconds(calc());

        const id = setInterval(() => {
            const remaining = Math.max(
                0,
                Math.ceil((countdown_deadline_at - Date.now()) / 1000)
            );
            setSeconds(remaining);
            if (remaining <= 0) {
                clearInterval(id);
                cbRef.current?.();
            }
        }, 1000);

        return () => clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [countdown_deadline_at]);

    return seconds;
}
