/* ──────────────────────────────────────────────────────────────
 * micGate — TTS 재생 중 barge-in 처리 (사용자 발화가 TTS 를 끊음)
 *
 * 정책: TTS 가 사용자 발화를 막으면 안 된다.
 *   ▸ TTS 재생 중 마이크를 끄지 않는다.
 *   ▸ 대신 useMicStream 이 재생 중에는 "더 높은 임계값(BARGE_IN_DB)"
 *     으로만 게이트를 연다 — 스피커에서 새어 들어오는 TTS 소리(bleed)는
 *     걸러지고, 그보다 큰 사용자 발화만 통과.
 *   ▸ 임계값을 넘는 발화 감지 → bargeInMic() → TTS 즉시 중단 후
 *     그 발화를 정상 스트리밍.
 *
 * 역할 분담:
 *   TtsPlayer    : ttsStartedMic() / ttsEndedMic() 토글 +
 *                  setTtsStopperMic(stopFn) 으로 중단 함수 등록
 *   useMicStream : isTtsActiveMic() 확인, 발화 감지 시 bargeInMic()
 *
 * React 상태가 아닌 모듈 스코프인 이유:
 *   오디오 청크 콜백(초당 ~15회)에서 읽는 동기 플래그가 필요해서.
 *   full reload 시 모듈 재평가로 전부 초기화 — 원하는 초기 상태와 동일.
 * ────────────────────────────────────────────────────────────── */

/* 재생 종료 후 이 시간(ms) 동안 barge-in 임계값 유지 — 스피커 잔향 흡수 */
const TAIL_MS = 300;

let active = false;      // TTS 재생 중(+잔향 테일) 여부
let tailTimer = null;
let stopper = null;      // TtsPlayer 의 재생 중단 함수

export const isTtsActiveMic = () => active;

/* TtsPlayer — 재생 중단 함수 등록/해제 (mount 시 1회) */
export const setTtsStopperMic = (fn) => {
    stopper = fn;
};

/* TTS 재생 시작 — barge-in 모드 진입 (예약된 해제 취소) */
export const ttsStartedMic = () => {
    if (tailTimer) {
        clearTimeout(tailTimer);
        tailTimer = null;
    }
    active = true;
};

/* TTS 재생 종료 — 잔향 테일 지난 뒤 일반 모드 복귀 */
export const ttsEndedMic = () => {
    if (tailTimer) clearTimeout(tailTimer);
    tailTimer = setTimeout(() => {
        active = false;
        tailTimer = null;
    }, TAIL_MS);
};

/* 사용자 발화 감지 → TTS 즉시 중단 + 일반 모드 즉시 복귀
 * (useMicStream 이 호출. 이후 청크부터 일반 임계값으로 발화 스트리밍) */
export const bargeInMic = () => {
    try {
        stopper?.();
    } catch {
        /* ignore */
    }
    if (tailTimer) {
        clearTimeout(tailTimer);
        tailTimer = null;
    }
    active = false;
};
