/* ──────────────────────────────────────────────────────────────
 * micGate — TTS 재생 중 마이크 처리 (누설음 차단 + duck)
 *
 * ⚠ 서로 다른 두 관심사를 별개 플래그로 관리한다.
 *   예전에는 하나의 플래그(active)가 둘을 겸해서, PageGuide 에서 duck 을
 *   끄려고 콜백을 떼자 누설음 차단까지 함께 꺼지는 버그가 있었다.
 *   (main 진입 안내가 자기 TTS 를 마이크로 되먹어 중간에 끊기던 원인)
 *
 *   ① playing  — "지금 TTS 가 재생 중인가"
 *        ▸ 모든 TTS 가 토글 (TtsPlayer / PageGuide / receipt / end / modal)
 *        ▸ useMicStream 이 스피커 누설음(bleed)을 거르는 데 사용.
 *          재생 중에는 더 높은 임계값(UTTER_ENTER_DB)만 통과시킨다.
 *
 *   ② duckable — "이 재생은 발화 감지 시 볼륨을 낮춰도 되는가"
 *        ▸ TtsPlayer(SessionResponse.message) 만 true
 *        ▸ 페이지 입장 안내는 false — 원래 볼륨으로 끝까지 재생돼야 한다
 *
 *   두 값의 조합이 만드는 동작:
 *     playing=false            → 일반 게이트 (THRESHOLD_DB)
 *     playing=true, duck=false → bleed 차단만. 볼륨 유지 (페이지 안내)
 *     playing=true, duck=true  → bleed 차단 + 발화 시 볼륨 50% (TtsPlayer)
 *
 * 역할 분담:
 *   모든 TTS 호출부 : speak(text, { onStart: ttsStartedMic, onEnd: ttsEndedMic })
 *                     TtsPlayer 만 onStart 에서 ttsStartedMic({duckable:true})
 *   TtsPlayer       : setTtsStopperMic(stop)  — 결제 잠금 시 즉시 중단용
 *                     setTtsDuckerMic({duck, unduck}) — 볼륨 조절자 등록
 *   useMicStream    : isTtsPlayingMic() / isDuckableMic() 확인,
 *                     발화 감지 시 duckTtsMic(), 종료 시 unduckTtsMic()
 *
 * React 상태가 아닌 모듈 스코프인 이유:
 *   오디오 청크 콜백(초당 ~15회)에서 읽는 동기 플래그가 필요해서.
 *   full reload 시 모듈 재평가로 전부 초기화 — 원하는 초기 상태와 동일.
 * ────────────────────────────────────────────────────────────── */

/* 재생 종료 후 이 시간(ms) 동안 재생 중으로 간주 — 스피커 잔향 흡수 */
const TAIL_MS = 300;

let playing = false;     // ① TTS 재생 중(+잔향 테일) 여부 — 모든 TTS
let duckable = false;    // ② 현재 재생이 duck 대상인지 — TtsPlayer 만
let tailTimer = null;

let stopper = null;      // TtsPlayer 의 재생 중단 함수 (결제 잠금용)
let ducker = null;       // { duck, unduck } — 볼륨 조절자 (mediaVolume)
let duckedNow = false;   // 현재 duck 적용 상태 (중복 호출 방지)

/** TTS 재생 중인가 — 누설음 차단 판정용 (모든 TTS) */
export const isTtsPlayingMic = () => playing;

/** 현재 재생이 duck 대상인가 — 볼륨 감쇠 판정용 (TtsPlayer 만) */
export const isDuckableMic = () => playing && duckable;

/** TtsPlayer — 재생 중단 함수 등록/해제 (결제 잠금 시에만 사용) */
export const setTtsStopperMic = (fn) => {
    stopper = fn;
};

/** TtsPlayer — 볼륨 조절 함수 쌍 등록/해제 ({duck, unduck}) */
export const setTtsDuckerMic = (fn) => {
    ducker = fn;
};

/* 내부 — duck 상태를 원복 (등록된 ducker 가 있으면 호출) */
const restoreVolume = () => {
    if (!duckedNow) return;
    duckedNow = false;
    try {
        ducker?.unduck?.();
    } catch {
        /* ignore */
    }
};

/** TTS 재생 시작 — 모든 TTS 가 호출.
 *  duckable:true 는 TtsPlayer 만 (발화 감지 시 볼륨 감쇠 허용) */
export const ttsStartedMic = ({ duckable: canDuck = false } = {}) => {
    if (tailTimer) {
        clearTimeout(tailTimer);
        tailTimer = null;
    }
    playing = true;
    duckable = canDuck;
};

/** TTS 재생 종료 — 잔향 테일이 지난 뒤 해제 + duck 안전망 원복 */
export const ttsEndedMic = () => {
    if (tailTimer) clearTimeout(tailTimer);
    tailTimer = setTimeout(() => {
        playing = false;
        duckable = false;
        tailTimer = null;
        // 발화 중에 재생이 끝난 경우 등 — duck 이 남아 있으면 복구
        restoreVolume();
    }, TAIL_MS);
};

/** 사용자 발화 감지 → TTS 볼륨 감쇠 (duck 대상일 때만, idempotent) */
export const duckTtsMic = () => {
    if (duckedNow || !isDuckableMic()) return;
    duckedNow = true;
    try {
        ducker?.duck?.();
    } catch {
        /* ignore */
    }
};

/** 사용자 발화 종료 → TTS 볼륨 원복 */
export const unduckTtsMic = () => {
    restoreVolume();
};

/* ── 결제 잠금 (pay 페이지 체류 중) ─────────────────────────
 * 토스 결제창이 떠 있는 동안(PC 팝업형은 우리 앱이 뒤에 살아있음)
 * 음성 발화가 backend 로 흘러가 ERROR 안내 TTS 가 재생되거나,
 * "취소" 발화로 뒤의 앱이 이동해버리는 것을 막는다.
 *   ▸ useMicStream : 잠금 중 마이크 전송 전면 차단
 *   ▸ TtsPlayer    : 잠금 중 신규 재생 스킵
 *   ▸ 잠그는 순간 재생 중이던 TTS 도 즉시 중단 (stopper)
 *   ▸ duck 상태였다면 원복 (미디어 볼륨이 낮은 채 남는 것 방지)
 * full reload(토스 리다이렉트) 시 모듈 재평가로 해제 상태에서 시작
 * → pay 페이지 mount 가 다시 잠근다.                                */
let paymentLocked = false;

export const isPaymentLockedMic = () => paymentLocked;

export const lockForPaymentMic = () => {
    paymentLocked = true;
    try {
        stopper?.(); // 재생 중이던 안내 즉시 중단
    } catch {
        /* ignore */
    }
    restoreVolume();
    if (tailTimer) {
        clearTimeout(tailTimer);
        tailTimer = null;
    }
    playing = false;
    duckable = false;
};

export const unlockForPaymentMic = () => {
    paymentLocked = false;
};
