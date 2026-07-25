import { useCallback, useEffect, useRef, useState } from "react";
import { HOLD_MOVE_TOLERANCE_PX } from "../constants";

/* ──────────────────────────────────────────────────────────────
 * useHoldTrigger — "N초 길게 누르기" 트리거 (start / receipt 공용)
 *
 * 한 번 누르기 시작하면 손가락이 어디로 움직여도 hold 가 유지된다.
 * 시각장애인 사용자는 화면을 더듬으며 누르기 때문에 손가락이 크게 흔들려
 * 진행 표시(원)를 쉽게 벗어나는데, 예전 구현은 onPointerLeave 로 즉시
 * 취소해 hold 가 거의 성공하지 못했다.
 *
 * 취소 조건 (이 2가지뿐)
 *   ▸ 포인터를 뗌            — window pointerup
 *   ▸ 시스템이 포인터를 회수 — window pointercancel
 *                              (네이티브 스크롤 시작, 전화 수신, 제스처 등)
 *
 * 이동 거리로는 취소하지 않는다 (tolerancePx 기본 Infinity — 원 밖으로
 * 나가도 유지). 목록 스크롤과 충돌하면 constants.HOLD_MOVE_TOLERANCE_PX
 * 에 숫자를 넣어 반경 제한을 켤 수 있다.
 *
 * ⚠ setPointerCapture 를 쓰지 않는 이유
 *   포인터를 캡처하면 이후 click 이벤트가 캡처 대상(컨테이너)으로 가서,
 *   receipt 페이지의 "영수증 받기 / 안 받기" 버튼 탭이 죽는다.
 *   대신 window 레벨 pointerup 으로 같은 효과를 낸다.
 *
 * 진행 표시(원형 프로그레스)는 처음 누른 좌표에 고정 — 손가락을 따라
 * 움직이면 오히려 흔들려 보인다.
 *
 * 사용 예
 *   const { isHolding, holdPos, onPointerDown } = useHoldTrigger({
 *     holdMs: 2000,
 *     onHold: () => navigate("/main"),
 *     enabled: !modalOpen,
 *   });
 *
 *   <div onPointerDown={onPointerDown}> ... </div>
 *   {isHolding && holdPos && <svg className="hold-progress" ... />}
 *
 * 반환
 *   isHolding     — 프로그레스 SVG 마운트 스위치
 *   holdPos       — { x, y } 최초 터치 좌표 (viewport px). 키보드 hold 는 null
 *   onPointerDown — 컨테이너에 붙일 핸들러
 *   startHold     — 좌표 없이 hold 시작 (키보드 hold 용)
 *   cancelHold    — 외부에서 강제 취소
 * ────────────────────────────────────────────────────────────── */

export default function useHoldTrigger({
    holdMs,
    onHold,
    enabled = true,
    tolerancePx = HOLD_MOVE_TOLERANCE_PX,
} = {}) {
    const [isHolding, setIsHolding] = useState(false);
    const [holdPos, setHoldPos] = useState(null);

    const timerRef = useRef(null);
    const originRef = useRef(null);   // 최초 포인터 좌표 (이동거리 기준점)
    const pointerIdRef = useRef(null);

    // 최신 콜백/설정 유지 (window 리스너가 stale closure 를 잡지 않도록)
    const onHoldRef = useRef(onHold);
    const enabledRef = useRef(enabled);
    useEffect(() => {
        onHoldRef.current = onHold;
        enabledRef.current = enabled;
    }, [onHold, enabled]);

    const cancelHold = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        originRef.current = null;
        pointerIdRef.current = null;
        setIsHolding(false);
        setHoldPos(null);
    }, []);

    /* hold 시작 — pos 가 없으면(키보드) 프로그레스는 표시되지 않는다 */
    const startHold = useCallback(
        (pos = null, pointerId = null) => {
            if (timerRef.current) return;      // 이미 진행 중
            if (!enabledRef.current) return;

            originRef.current = pos;
            pointerIdRef.current = pointerId;
            setHoldPos(pos);
            setIsHolding(true);

            timerRef.current = setTimeout(() => {
                timerRef.current = null;
                originRef.current = null;
                pointerIdRef.current = null;
                setIsHolding(false);
                setHoldPos(null);
                onHoldRef.current?.();
            }, holdMs);
        },
        [holdMs]
    );

    const onPointerDown = useCallback(
        (e) => {
            startHold({ x: e.clientX, y: e.clientY }, e.pointerId);
        },
        [startHold]
    );

    /* window 레벨 종료 감시 —
     * 요소 밖에서 손을 떼도 확실히 취소되고, 요소 경계를 벗어나는 것
     * 만으로는 취소되지 않는다 (onPointerLeave 를 쓰지 않는 이유).      */
    useEffect(() => {
        if (!isHolding) return;

        const isSamePointer = (e) =>
            pointerIdRef.current == null || e.pointerId === pointerIdRef.current;

        const onUp = (e) => {
            if (isSamePointer(e)) cancelHold();
        };

        window.addEventListener("pointerup", onUp);
        window.addEventListener("pointercancel", onUp);

        /* 이동 반경 제한은 옵션 — 기본(Infinity)은 리스너조차 붙이지 않아
         * 화면 어디로 끌고 가도 hold 가 유지된다.                        */
        const limited = Number.isFinite(tolerancePx);
        const onMove = (e) => {
            if (!isSamePointer(e)) return;
            const origin = originRef.current;
            if (!origin) return; // 키보드 hold — 이동 감시 대상 아님
            const dx = e.clientX - origin.x;
            const dy = e.clientY - origin.y;
            if (Math.hypot(dx, dy) > tolerancePx) cancelHold();
        };
        if (limited) window.addEventListener("pointermove", onMove);

        return () => {
            window.removeEventListener("pointerup", onUp);
            window.removeEventListener("pointercancel", onUp);
            if (limited) window.removeEventListener("pointermove", onMove);
        };
    }, [isHolding, cancelHold, tolerancePx]);

    // 언마운트 시 타이머 정리
    useEffect(() => cancelHold, [cancelHold]);

    return { isHolding, holdPos, onPointerDown, startHold, cancelHold };
}
