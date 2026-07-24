/* ──────────────────────────────────────────────────────────────
 * micGate — TTS 재생 중 사용자 발화 처리 (duck 정책)
 *
 * 정책 (2026-07-24 개편):
 *   기존 barge-in : 발화 감지 시 TTS 즉시 중단
 *   신규 duck     : 발화 감지 시 시스템 미디어 볼륨을 50% 로 낮춤(duck),
 *                   발화 종료 시 원복(unduck). TTS 재생 자체는 끝까지 유지.
 *
 * duck 대상 구분:
 *   ▸ TtsPlayer (SessionResponse.message)
 *       → ttsStartedMic/ttsEndedMic 콜백 붙임 → isTtsActiveMic()=true
 *       → 발화 감지 시 duck 발동
 *   ▸ PageGuide, receipt/end 페이지 안내, ReceiptModal 대기번호 안내
 *       → 콜백 미등록 → isTtsActiveMic()=false
 *       → duck 발동 안 함. "무조건 끝까지" 원래 볼륨으로 재생.
 *
 * 역할 분담:
 *   TtsPlayer    : setTtsStopperMic(stop) — 결제 잠금 시 즉시 중단용
 *                  setTtsDuckerMic({duck, unduck}) — duck/unduck 함수 등록
 *                  ttsStartedMic() / ttsEndedMic() — 재생 상태 토글
 *   useMicStream : isTtsActiveMic() 확인, 발화 감지 시 duckTtsMic(),
 *                  발화 종료 시 unduckTtsMic()
 *
 * React 상태가 아닌 모듈 스코프인 이유:
 *   오디오 청크 콜백(초당 ~15회)에서 읽는 동기 플래그가 필요해서.
 *   full reload 시 모듈 재평가로 전부 초기화 — 원하는 초기 상태와 동일.
 * ────────────────────────────────────────────────────────────── */

/* 재생 종료 후 이 시간(ms) 동안 duck 판정 상태 유지 — 스피커 잔향 흡수 */
const TAIL_MS = 300;

let active = false;      // TTS 재생 중(+잔향 테일) 여부
let tailTimer = null;
let stopper = null;      // TtsPlayer 의 재생 중단 함수 (결제 잠금용)
let ducker = null;       // { duck, unduck } — 볼륨 조절자 (mediaVolume)
let duckedNow = false;   // 현재 duck 상태 (중복 호출 방지)

export const isTtsActiveMic = () => active;

/** TtsPlayer — 재생 중단 함수 등록/해제 (결제 잠금 시에만 사용) */
export const setTtsStopperMic = (fn) => {
    stopper = fn;
};

/** TtsPlayer — 볼륨 조절 함수 쌍 등록/해제 ({duck, unduck}) */
export const setTtsDuckerMic = (fn) => {
    ducker = fn;
};

/** TTS 재생 시작 — TTS-active 진입 (예약된 해제 취소) */
export const ttsStartedMic = () => {
    if (tailTimer) {
        clearTimeout(tailTimer);
        tailTimer = null;
    }
    active = true;
};

/** TTS 재생 종료 — 잔향 테일 지난 뒤 TTS-active 해제 + duck 안전망 원복 */
export const ttsEndedMic = () => {
    if (tailTimer) clearTimeout(tailTimer);
    tailTimer = setTimeout(() => {
        active = false;
        tailTimer = null;
        /* 자연 종료됐는데 duck 상태였다면(발화 중 재생 완료 등) 복구 */
        if (duckedNow) {
            duckedNow = false;
            try {
                ducker?.unduck?.();
            } catch {
                /* ignore */
            }
        }
    }, TAIL_MS);
};

/** 사용자 발화 감지 → TTS 볼륨 50% 감소 (중복 호출 idempotent) */
export const duckTtsMic = () => {
    if (duckedNow) return;
    duckedNow = true;
    try {
        ducker?.duck?.();
    } catch {
        /* ignore */
    }
};

/** 사용자 발화 종료 → TTS 볼륨 원복 */
export const unduckTtsMic = () => {
    if (!duckedNow) return;
    duckedNow = false;
    try {
        ducker?.unduck?.();
    } catch {
        /* ignore */
    }
};

/* ── 결제 잠금 (pay 페이지 체류 중) ─────────────────────────
 * 토스 결제창이 떠 있는 동안(PC 팝업형은 우리 앱이 뒤에 살아있음)
 * 음성 발화가 backend 로 흘러가 ERROR 안내 TTS 가 재생되거나,
 * "취소" 발화로 뒤의 앱이 이동해버리는 것을 막는다.
 *   ▸ useMicStream : 잠금 중 마이크 전송 전면 차단
 *   ▸ TtsPlayer    : 잠금 중 신규 재생 스킵
 *   ▸ 잠그는 순간 재생 중이던 TTS 도 즉시 중단 (stopper)
 *   ▸ duck 상태였다면 원복
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
    /* duck 상태 원복 (혹시 남아 있으면 미디어 볼륨 반영구 저하 방지) */
    if (duckedNow) {
        duckedNow = false;
        try {
            ducker?.unduck?.();
        } catch {
            /* ignore */
        }
    }
    if (tailTimer) {
        clearTimeout(tailTimer);
        tailTimer = null;
    }
    active = false;
};

export const unlockForPaymentMic = () => {
    paymentLocked = false;
};
