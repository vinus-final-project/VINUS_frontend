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
 *   ▸ 포인터를 뗌            — pointerup / touchend
 *   ▸ 시스템이 포인터를 회수 — pointercancel / touchcancel
 *
 * 이동 거리로는 취소하지 않는다 (tolerancePx 기본 Infinity — 원 밖으로
 * 나가도 유지). 목록 스크롤과 충돌하면 constants.HOLD_MOVE_TOLERANCE_PX
 * 에 숫자를 넣어 반경 제한을 켤 수 있다.
 *
 * ── APK(Android WebView) 대응 ──────────────────────────────
 * 웹뷰는 브라우저보다 훨씬 공격적으로 터치를 가로채므로 2가지가 필요하다:
 *
 *   1) 컨테이너에 className="hold-target" (index.css)
 *      touch-action / user-select / touch-callout 을 꺼서 웹뷰가
 *      스크롤·텍스트선택·컨텍스트메뉴로 제스처를 클레임하며 쏘는
 *      pointercancel 자체를 막는다. ★ 이게 없으면 웹뷰에서 hold 실패
 *
 *   2) 터치 이벤트 폴백 (이 훅)
 *      구형 WebView(Chrome 55 미만 — SM-T580 같은 미업데이트 기기)는
 *      PointerEvent 가 없어 onPointerDown 이 아예 발화하지 않는다.
 *      PointerEvent 미지원이면 touchstart/touchend 경로로 자동 전환.
 *
 * ⚠ setPointerCapture 를 쓰지 않는 이유
 *   포인터를 캡처하면 이후 click 이벤트가 캡처 대상(컨테이너)으로 가서,
 *   receipt 페이지의 "영수증 받기 / 안 받기" 버튼 탭이 죽는다.
 *   대신 window 레벨 pointerup/touchend 로 같은 효과를 낸다.
 *
 * 진행 표시(원형 프로그레스)는 처음 누른 좌표에 고정 — 손가락을 따라
 * 움직이면 오히려 흔들려 보인다.
 *
 * 사용 예
 *   const { isHolding, holdPos, holdHandlers } = useHoldTrigger({
 *     holdMs: 2000,
 *     onHold: () => navigate("/main"),
 *     enabled: !modalOpen,
 *   });
 *
 *   <div className="hold-target" {...holdHandlers}> ... </div>
 *   {isHolding && holdPos && <svg className="hold-progress" ... />}
 *
 * 반환
 *   isHolding    — 프로그레스 SVG 마운트 스위치
 *   holdPos      — { x, y } 최초 터치 좌표 (viewport px). 키보드 hold 는 null
 *   holdHandlers — 컨테이너에 스프레드할 이벤트 핸들러 묶음
 *   startHold    — 좌표 없이 hold 시작 (키보드 hold 용)
 *   cancelHold   — 외부에서 강제 취소
 * ────────────────────────────────────────────────────────────── */

/* PointerEvent 지원 여부 — 모듈 로드 시 1회 판정.
 * 미지원(구형 WebView)이면 터치 이벤트 경로로 동작한다.            */
const HAS_POINTER =
    typeof window !== "undefined" && typeof window.PointerEvent === "function";

export default function useHoldTrigger({
    holdMs,
    onHold,
    enabled = true,
    tolerancePx = HOLD_MOVE_TOLERANCE_PX,
} = {}) {
    const [isHolding, setIsHolding] = useState(false);
    const [holdPos, setHoldPos] = useState(null);

    const timerRef = useRef(null);
    const originRef = useRef(null);   // 최초 좌표 (이동거리 기준점)
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

    // ── 이벤트 핸들러 (PointerEvent 우선, 없으면 Touch) ──────
    const onPointerDown = useCallback(
        (e) => {
            if (!HAS_POINTER) return;
            startHold({ x: e.clientX, y: e.clientY }, e.pointerId);
        },
        [startHold]
    );

    const onTouchStart = useCallback(
        (e) => {
            if (HAS_POINTER) return;          // 포인터 경로가 이미 처리
            const t = e.touches?.[0];
            if (!t) return;
            startHold({ x: t.clientX, y: t.clientY }, t.identifier);
        },
        [startHold]
    );

    /* window 레벨 종료 감시 —
     * 요소 밖에서 손을 떼도 확실히 취소되고, 요소 경계를 벗어나는 것
     * 만으로는 취소되지 않는다 (onPointerLeave 를 쓰지 않는 이유).      */
    useEffect(() => {
        if (!isHolding) return;

        const limited = Number.isFinite(tolerancePx);
        const overTolerance = (x, y) => {
            const origin = originRef.current;
            if (!origin) return false; // 키보드 hold — 이동 감시 대상 아님
            return Math.hypot(x - origin.x, y - origin.y) > tolerancePx;
        };

        const cleanups = [];
        const on = (type, fn) => {
            window.addEventListener(type, fn, { passive: true });
            cleanups.push(() => window.removeEventListener(type, fn));
        };

        if (HAS_POINTER) {
            const isSame = (e) =>
                pointerIdRef.current == null ||
                e.pointerId === pointerIdRef.current;
            const onUp = (e) => {
                if (isSame(e)) cancelHold();
            };
            on("pointerup", onUp);
            on("pointercancel", onUp);
            if (limited) {
                on("pointermove", (e) => {
                    if (isSame(e) && overTolerance(e.clientX, e.clientY)) {
                        cancelHold();
                    }
                });
            }
        } else {
            // 구형 WebView — 터치 이벤트 경로
            on("touchend", cancelHold);
            on("touchcancel", cancelHold);
            if (limited) {
                on("touchmove", (e) => {
                    const t = e.touches?.[0];
                    if (t && overTolerance(t.clientX, t.clientY)) cancelHold();
                });
            }
        }

        return () => cleanups.forEach((fn) => fn());
    }, [isHolding, cancelHold, tolerancePx]);

    // 언마운트 시 타이머 정리
    useEffect(() => cancelHold, [cancelHold]);

    /* 컨테이너에 스프레드할 핸들러 묶음.
     * 두 경로 모두 등록하되 내부에서 HAS_POINTER 로 한쪽만 동작 —
     * 포인터/터치 이벤트가 함께 발화해도 hold 가 중복 시작되지 않는다. */
    const holdHandlers = { onPointerDown, onTouchStart };

    return {
        isHolding,
        holdPos,
        holdHandlers,
        onPointerDown, // 하위 호환
        startHold,
        cancelHold,
    };
}
